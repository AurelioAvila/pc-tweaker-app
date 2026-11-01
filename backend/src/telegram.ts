import { randomBytes, randomUUID, timingSafeEqual } from "crypto";
import Stripe from "stripe";
import type { Pool } from "pg";

/**
 * Telegram channel gate and bot referral (owner decision, 1 Nov 2026).
 *
 * Gate: the app asks for an intent, opens t.me/<bot>?start=g_<nonce>; the bot binds the Telegram
 * user to the app account and checks channel membership with getChatMember. A PC Tweaker account
 * in its 3-day trial then gets +4 days (Stripe trial_end). Others are linked and told why nothing
 * was added. Once per account and once per Telegram user.
 *
 * Referral: t.me/<bot>?start=r_<code>. An invitee counts only after completing the gate with a
 * real trial (card-backed, one per card and PC: trial.ts), so throwaway Telegram accounts earn
 * nothing. Every REFERRAL_QUALIFIED qualified invitees give the inviter +REFERRAL_DAYS days while
 * in trial; a paying inviter's reward is recorded for the owner (shifting a paid renewal would put
 * the subscription in a Stripe trial state the billing emails do not expect).
 *
 * Off unless TELEGRAM_ENABLED=true with TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_CHANNEL
 * and TELEGRAM_WEBHOOK_SECRET set. The bot must be an administrator of the channel.
 */
export const GATE_DAYS = 4;
export const REFERRAL_DAYS = 14;
export const REFERRAL_QUALIFIED = 3;
/** Rewards per inviter per rolling 12 months (like referral-policy INVITER_CAP). */
export const REFERRAL_YEAR_CAP = 4;
export const INTENT_MS = 10 * 60_000;
const DAY = 86_400;
const MEMBER = new Set(["creator", "administrator", "member"]);

export type TelegramConfig = { token: string; bot: string; channel: string; secret: string };

export function telegramConfig(environment: NodeJS.ProcessEnv = process.env): TelegramConfig | null {
  const { TELEGRAM_ENABLED, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_CHANNEL, TELEGRAM_WEBHOOK_SECRET } = environment;
  if (TELEGRAM_ENABLED !== "true" || !TELEGRAM_BOT_TOKEN || !TELEGRAM_BOT_USERNAME || !TELEGRAM_CHANNEL) return null;
  // Telegram allows 1-256 characters A-Z a-z 0-9 _ - in secret_token; require a real secret.
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(TELEGRAM_WEBHOOK_SECRET ?? "")) return null;
  return { token: TELEGRAM_BOT_TOKEN, bot: TELEGRAM_BOT_USERNAME.replace(/^@/, ""), channel: TELEGRAM_CHANNEL, secret: TELEGRAM_WEBHOOK_SECRET! };
}

export type BotApi = (method: string, body: Record<string, unknown>) => Promise<any>;
export type SubscriptionApi = {
  retrieve(id: string): Promise<{ id: string; status: string; trial_end: number | null }>;
  update(id: string, params: { trial_end: number; proration_behavior: "none" }): Promise<unknown>;
};

export function botApi(config: TelegramConfig): BotApi {
  return async (method, body) => {
    const response = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; description?: string };
    if (!data.ok) throw new Error(`telegram ${method}: ${response.status} ${String(data.description ?? "").slice(0, 120)}`);
    return data.result;
  };
}

export function stripeSubscriptions(environment: NodeJS.ProcessEnv = process.env): SubscriptionApi | null {
  const key = environment.STRIPE_SECRET_KEY;
  if (!key) return null;
  const stripe = new Stripe(key, { apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion });
  return {
    retrieve: async (id) => {
      const s = await stripe.subscriptions.retrieve(id);
      return { id: s.id, status: s.status, trial_end: s.trial_end ?? null };
    },
    update: (id, params) => stripe.subscriptions.update(id, params),
  };
}

export async function initTelegramSchema(db: Pick<Pool, "query">): Promise<void> {
  // Additive. Rollback: DROP TABLE telegram_intents, telegram_users, telegram_grants, telegram_referrals.
  await db.query(`
    CREATE TABLE IF NOT EXISTS telegram_intents (
      id TEXT PRIMARY KEY, nonce TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL,
      tg_user_id BIGINT, status TEXT NOT NULL, detail TEXT,
      created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telegram_users (
      tg_user_id BIGINT PRIMARY KEY, ref_code TEXT NOT NULL UNIQUE, user_id INTEGER UNIQUE,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telegram_grants (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id INTEGER NOT NULL, tg_user_id BIGINT NOT NULL,
      state TEXT NOT NULL, days INTEGER NOT NULL, subscription_id TEXT, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS telegram_gate_user_idx ON telegram_grants (kind, user_id) WHERE kind = 'gate';
    CREATE UNIQUE INDEX IF NOT EXISTS telegram_gate_tg_idx ON telegram_grants (kind, tg_user_id) WHERE kind = 'gate';
    CREATE TABLE IF NOT EXISTS telegram_referrals (
      invitee_tg_id BIGINT PRIMARY KEY, inviter_tg_id BIGINT NOT NULL, invitee_user_id INTEGER UNIQUE,
      state TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, qualified_at TIMESTAMPTZ, rewarded BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
}

const token = (bytes: number) => randomBytes(bytes).toString("base64url");
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function refCode(): string {
  return Array.from(randomBytes(10), (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
}

export function secretMatches(config: TelegramConfig, header: unknown): boolean {
  const given = Buffer.from(typeof header === "string" ? header : "");
  const want = Buffer.from(config.secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

export class Telegram {
  constructor(
    public db: Pick<Pool, "query">,
    public config: TelegramConfig,
    public bot: BotApi,
    public subscriptions: SubscriptionApi | null,
    public now: () => Date = () => new Date(),
  ) {}

  link(payload: string): string {
    return `https://t.me/${this.config.bot}?start=${payload}`;
  }

  /** App side: one pending intent per call, valid INTENT_MS. */
  async createIntent(userId: number): Promise<{ id: string; url: string; expiresAt: string }> {
    const id = randomUUID();
    const nonce = token(24);
    const expires = new Date(this.now().getTime() + INTENT_MS);
    await this.db.query(
      "INSERT INTO telegram_intents (id, nonce, user_id, status, created_at, expires_at) VALUES ($1,$2,$3,'pending',$4,$5)",
      [id, nonce, userId, this.now(), expires],
    );
    return { id, url: this.link(`g_${nonce}`), expiresAt: expires.toISOString() };
  }

  async intentStatus(userId: number, id: string): Promise<{ status: string; detail: string | null } | null> {
    const { rows } = await this.db.query("SELECT status, detail, expires_at FROM telegram_intents WHERE id=$1 AND user_id=$2", [id, userId]);
    const row = rows[0];
    if (!row) return null;
    const expired = row.status === "pending" && new Date(row.expires_at) <= this.now();
    return { status: expired ? "expired" : row.status, detail: row.detail ?? null };
  }

  private async tgUser(tgUserId: number): Promise<{ ref_code: string; user_id: number | null }> {
    await this.db.query(
      "INSERT INTO telegram_users (tg_user_id, ref_code, created_at) VALUES ($1,$2,$3) ON CONFLICT (tg_user_id) DO NOTHING",
      [tgUserId, refCode(), this.now()],
    );
    const { rows } = await this.db.query("SELECT ref_code, user_id FROM telegram_users WHERE tg_user_id=$1", [tgUserId]);
    return rows[0];
  }

  async isMember(tgUserId: number): Promise<boolean> {
    const member = await this.bot("getChatMember", { chat_id: this.config.channel, user_id: tgUserId });
    return MEMBER.has(member?.status) || (member?.status === "restricted" && member?.is_member === true);
  }

  private say(chatId: number, text: string, buttons?: { text: string; url?: string; callback_data?: string }[][]) {
    return this.bot("sendMessage", {
      chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    });
  }

  private channelUrl(): string {
    return this.config.channel.startsWith("@") ? `https://t.me/${this.config.channel.slice(1)}` : this.config.channel;
  }

  /** Webhook entry point: one Telegram update. Never throws for a malformed update. */
  async handleUpdate(update: any): Promise<void> {
    const message = update?.message;
    const callback = update?.callback_query;
    if (message?.chat?.type === "private" && typeof message.text === "string" && typeof message.from?.id === "number") {
      const [command, payload = ""] = message.text.trim().split(/\s+/, 2);
      if (command === "/start" || command.startsWith("/start@")) return this.start(message.from.id, message.chat.id, payload);
      if (command === "/invite") return this.invite(message.from.id, message.chat.id);
      return;
    }
    if (callback && typeof callback.from?.id === "number" && typeof callback.data === "string") {
      await this.bot("answerCallbackQuery", { callback_query_id: callback.id }).catch(() => undefined);
      const chatId = callback.message?.chat?.id ?? callback.from.id;
      if (callback.data.startsWith("chk_")) return this.gate(callback.from.id, chatId, callback.data.slice(4));
      if (callback.data === "invite") return this.invite(callback.from.id, chatId);
    }
  }

  private async start(tgUserId: number, chatId: number, payload: string): Promise<void> {
    if (payload.startsWith("g_")) return this.gate(tgUserId, chatId, payload.slice(2));
    if (payload.startsWith("r_")) return this.referred(tgUserId, chatId, payload.slice(2));
    if (payload === "invite") return this.invite(tgUserId, chatId);
    await this.tgUser(tgUserId);
    await this.say(chatId,
      "<b>PC Tweaker bot</b>\n\nTo unlock <b>+4 days of Pro trial</b>, open PC Tweaker → your account menu → <i>Unlock with Telegram</i>. The app sends you back here with a one-time link.",
      [[{ text: "📢 Join the channel", url: this.channelUrl() }], [{ text: "🤝 Invite friends", callback_data: "invite" }]]);
  }

  /** Bind the Telegram user to the account behind the intent, then reward once if eligible. */
  async gate(tgUserId: number, chatId: number, nonce: string): Promise<void> {
    const { rows } = await this.db.query("SELECT id, user_id, status, tg_user_id, expires_at FROM telegram_intents WHERE nonce=$1", [nonce]);
    const intent = rows[0];
    if (!intent || (intent.status === "pending" && new Date(intent.expires_at) <= this.now())) {
      await this.say(chatId, "This link has expired. Open PC Tweaker and tap <i>Unlock with Telegram</i> again.");
      return;
    }
    if (intent.tg_user_id && Number(intent.tg_user_id) !== tgUserId) {
      await this.say(chatId, "This link belongs to another Telegram account.");
      return;
    }
    if (!["pending", "not_member"].includes(intent.status)) {
      await this.say(chatId, "Already done ✅ — check PC Tweaker.");
      return;
    }
    const me = await this.tgUser(tgUserId);
    if (me.user_id !== null && Number(me.user_id) !== Number(intent.user_id)) {
      await this.finish(intent.id, tgUserId, "rejected", "telegram_linked_to_another_account");
      await this.say(chatId, "This Telegram account is already linked to another PC Tweaker account.");
      return;
    }
    const owner = await this.db.query("SELECT tg_user_id FROM telegram_users WHERE user_id=$1", [intent.user_id]);
    if (owner.rows[0] && Number(owner.rows[0].tg_user_id) !== tgUserId) {
      await this.finish(intent.id, tgUserId, "rejected", "account_linked_to_another_telegram");
      await this.say(chatId, "This PC Tweaker account is already linked to another Telegram account.");
      return;
    }
    await this.db.query("UPDATE telegram_intents SET tg_user_id=$2 WHERE id=$1", [intent.id, tgUserId]);
    if (!(await this.isMember(tgUserId))) {
      await this.finish(intent.id, tgUserId, "not_member", null);
      await this.say(chatId, "Join the channel first, then tap the button below.",
        [[{ text: "📢 Join the channel", url: this.channelUrl() }], [{ text: "✅ I've joined", callback_data: `chk_${nonce}` }]]);
      return;
    }
    // A link claimed by two accounts at once: the unique index on user_id keeps only the first.
    await this.db.query("UPDATE telegram_users SET user_id=$2 WHERE tg_user_id=$1 AND user_id IS NULL", [tgUserId, intent.user_id]);
    const result = await this.reward(Number(intent.user_id), tgUserId);
    await this.finish(intent.id, tgUserId, result.status, result.detail);
    const texts: Record<string, string> = {
      granted: `✅ <b>+${GATE_DAYS} days added to your Pro trial.</b> PC Tweaker shows the new end date within a minute.`,
      linked: "✅ Telegram linked. The +4 days apply to an active PC Tweaker trial: start your 3-day trial in the app, then tap <i>Unlock with Telegram</i> again.",
      already: "You already received the Telegram bonus on this account ✅",
    };
    await this.say(chatId, texts[result.status] ?? "Linked ✅", [[{ text: "🤝 Invite friends", callback_data: "invite" }]]);
    if (result.status === "granted") await this.qualify(tgUserId, Number(intent.user_id));
  }

  private finish(id: string, tgUserId: number, status: string, detail: string | null) {
    return this.db.query("UPDATE telegram_intents SET status=$2, detail=$3, tg_user_id=$4 WHERE id=$1", [id, status, detail, tgUserId]);
  }

  /** +GATE_DAYS on a PC Tweaker trial, once per account and per Telegram user. */
  private async reward(userId: number, tgUserId: number): Promise<{ status: string; detail: string | null }> {
    const done = await this.db.query("SELECT 1 FROM telegram_grants WHERE kind='gate' AND (user_id=$1 OR tg_user_id=$2)", [userId, tgUserId]);
    if (done.rows.length) return { status: "already", detail: null };
    const sub = await this.trialSubscription(userId);
    if (!sub) return { status: "linked", detail: "no_active_trial" };
    const id = randomUUID();
    try {
      // The row first: a concurrent second claim fails on the unique index before Stripe is touched.
      await this.db.query(
        "INSERT INTO telegram_grants (id, kind, user_id, tg_user_id, state, days, subscription_id, created_at) VALUES ($1,'gate',$2,$3,'applying',$4,$5,$6)",
        [id, userId, tgUserId, GATE_DAYS, sub.id, this.now()],
      );
    } catch {
      return { status: "already", detail: null };
    }
    try {
      await this.subscriptions!.update(sub.id, { trial_end: sub.trial_end + GATE_DAYS * DAY, proration_behavior: "none" });
    } catch (error) {
      await this.db.query("DELETE FROM telegram_grants WHERE id=$1", [id]);
      console.error("telegram gate: trial extension failed:", (error as Error).message);
      return { status: "linked", detail: "stripe_error" };
    }
    await this.db.query("UPDATE telegram_grants SET state='applied' WHERE id=$1", [id]);
    return { status: "granted", detail: null };
  }

  /** The account's PC Tweaker subscription when Stripe says it is trialing with a future trial end. */
  private async trialSubscription(userId: number): Promise<{ id: string; trial_end: number } | null> {
    if (!this.subscriptions) return null;
    const { rows } = await this.db.query("SELECT stripe_subscription_id, subscription_status FROM users WHERE id=$1", [userId]);
    const id = rows[0]?.stripe_subscription_id;
    if (!id || rows[0]?.subscription_status !== "trialing") return null;
    const sub = await this.subscriptions.retrieve(id);
    const nowSeconds = Math.floor(this.now().getTime() / 1000);
    return sub.status === "trialing" && sub.trial_end && sub.trial_end > nowSeconds ? { id: sub.id, trial_end: sub.trial_end } : null;
  }

  async invite(tgUserId: number, chatId: number): Promise<void> {
    const me = await this.tgUser(tgUserId);
    const stats = await this.referralStats(tgUserId);
    const url = this.link(`r_${me.ref_code}`);
    const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Signed, reversible Windows tweaks from the dev of PC Tweaker. Join here:")}`;
    await this.say(chatId,
      `<b>Invite friends</b>\n\nYour link: <code>${url}</code>\n\nA friend counts when they join the channel and unlock their trial with Telegram in PC Tweaker. Every ${REFERRAL_QUALIFIED} friends = <b>+${REFERRAL_DAYS} days of Pro</b>.\n\nCounted so far: <b>${stats.qualified % REFERRAL_QUALIFIED}/${REFERRAL_QUALIFIED}</b>${me.user_id === null ? "\n\n⚠️ Link your own PC Tweaker account first (app → <i>Unlock with Telegram</i>), or rewards wait." : ""}`,
      [[{ text: "📤 Share my link", url: share }]]);
  }

  private async referred(tgUserId: number, chatId: number, code: string): Promise<void> {
    const { rows } = await this.db.query("SELECT tg_user_id FROM telegram_users WHERE ref_code=$1", [code]);
    const inviter = rows[0] ? Number(rows[0].tg_user_id) : null;
    const known = await this.db.query("SELECT 1 FROM telegram_users WHERE tg_user_id=$1", [tgUserId]);
    await this.tgUser(tgUserId);
    // Only a Telegram user the bot has never seen can be invited, and never by themselves.
    if (inviter !== null && inviter !== tgUserId && !known.rows.length) {
      await this.db.query(
        "INSERT INTO telegram_referrals (invitee_tg_id, inviter_tg_id, state, created_at) VALUES ($1,$2,'started',$3) ON CONFLICT (invitee_tg_id) DO NOTHING",
        [tgUserId, inviter, this.now()],
      );
    }
    await this.say(chatId,
      "👋 <b>Welcome!</b>\n\n1. Join the channel\n2. Install PC Tweaker and start the 3-day free trial\n3. In the app: account menu → <i>Unlock with Telegram</i> → <b>+4 more days</b>",
      [[{ text: "📢 Join the channel", url: this.channelUrl() }], [{ text: "⚡ Get PC Tweaker", url: "https://pctweaker.app/?utm_source=telegram&utm_medium=bot&utm_campaign=tg_referral" }]]);
  }

  private async referralStats(inviterTgId: number): Promise<{ qualified: number; rewarded: number }> {
    const { rows } = await this.db.query(
      "SELECT COUNT(*) AS qualified FROM telegram_referrals WHERE inviter_tg_id=$1 AND state='qualified'", [inviterTgId]);
    const grants = await this.db.query(
      "SELECT COUNT(*) AS n FROM telegram_grants g JOIN telegram_users u ON u.user_id = g.user_id WHERE u.tg_user_id=$1 AND g.kind='referral'", [inviterTgId]);
    return { qualified: Number(rows[0]?.qualified ?? 0), rewarded: Number(grants.rows[0]?.n ?? 0) };
  }

  /** The invitee completed the gate on a real trial: count them, reward the inviter on every Nth. */
  private async qualify(inviteeTgId: number, inviteeUserId: number): Promise<void> {
    const { rows } = await this.db.query("SELECT inviter_tg_id FROM telegram_referrals WHERE invitee_tg_id=$1 AND state='started'", [inviteeTgId]);
    if (!rows[0]) return;
    try {
      await this.db.query("UPDATE telegram_referrals SET state='qualified', invitee_user_id=$2, qualified_at=$3 WHERE invitee_tg_id=$1", [inviteeTgId, inviteeUserId, this.now()]);
    } catch {
      return; // this account was already counted for someone
    }
    const inviterTg = Number(rows[0].inviter_tg_id);
    const pending = await this.db.query(
      "SELECT invitee_tg_id FROM telegram_referrals WHERE inviter_tg_id=$1 AND state='qualified' AND rewarded=FALSE ORDER BY qualified_at LIMIT $2",
      [inviterTg, REFERRAL_QUALIFIED]);
    if (pending.rows.length < REFERRAL_QUALIFIED) {
      await this.say(inviterTg, `🎉 A friend you invited just counted: <b>${pending.rows.length}/${REFERRAL_QUALIFIED}</b>.`).catch(() => undefined);
      return;
    }
    const inviter = await this.db.query("SELECT user_id FROM telegram_users WHERE tg_user_id=$1", [inviterTg]);
    const inviterUser = inviter.rows[0]?.user_id ?? null;
    if (inviterUser === null) {
      await this.say(inviterTg, `🎉 ${REFERRAL_QUALIFIED} friends counted! Link your PC Tweaker account (app → <i>Unlock with Telegram</i>) to receive +${REFERRAL_DAYS} days.`).catch(() => undefined);
      return; // stays unrewarded until the inviter links an account and the next friend qualifies
    }
    const year = await this.db.query(
      "SELECT COUNT(*) AS n FROM telegram_grants WHERE kind='referral' AND user_id=$1 AND created_at > $2",
      [inviterUser, new Date(this.now().getTime() - 365 * DAY * 1000)]);
    if (Number(year.rows[0]?.n ?? 0) >= REFERRAL_YEAR_CAP) return;
    for (const row of pending.rows) {
      await this.db.query("UPDATE telegram_referrals SET rewarded=TRUE WHERE invitee_tg_id=$1", [row.invitee_tg_id]);
    }
    const sub = await this.trialSubscription(Number(inviterUser)).catch(() => null);
    const grant = randomUUID();
    let state = "awaiting_owner";
    if (sub) {
      try {
        await this.subscriptions!.update(sub.id, { trial_end: sub.trial_end + REFERRAL_DAYS * DAY, proration_behavior: "none" });
        state = "applied";
      } catch (error) {
        console.error("telegram referral: trial extension failed:", (error as Error).message);
      }
    }
    await this.db.query(
      "INSERT INTO telegram_grants (id, kind, user_id, tg_user_id, state, days, subscription_id, created_at) VALUES ($1,'referral',$2,$3,$4,$5,$6,$7)",
      [grant, inviterUser, inviterTg, state, REFERRAL_DAYS, sub?.id ?? null, this.now()]);
    await this.say(inviterTg, state === "applied"
      ? `🏆 <b>+${REFERRAL_DAYS} days of Pro added</b> for inviting ${REFERRAL_QUALIFIED} friends. Thank you!`
      : `🏆 ${REFERRAL_QUALIFIED} friends counted! Your +${REFERRAL_DAYS} days are recorded and applied by the team to your next renewal.`).catch(() => undefined);
  }
}

let shared: Telegram | null | undefined;
export function telegram(db: () => Pick<Pool, "query">, environment: NodeJS.ProcessEnv = process.env): Telegram | null {
  if (shared !== undefined) return shared;
  const config = telegramConfig(environment);
  shared = config ? new Telegram(db(), config, botApi(config), stripeSubscriptions(environment)) : null;
  return shared;
}
