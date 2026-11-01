import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;

const { getPool, initSchema } = await import("../dist/db.js");
const { Telegram, telegramConfig, secretMatches, GATE_DAYS, REFERRAL_DAYS, REFERRAL_QUALIFIED, INTENT_MS } = await import("../dist/telegram.js");
await initSchema();

const DAY = 86_400;
const CONFIG = { token: "123:fixture", bot: "PCTweakerBot", channel: "@pctweaker", secret: "s".repeat(40) };
let sequence = 0;

function fakes() {
  const sent = [];
  const members = new Set();
  const subs = new Map();
  const updates = [];
  const bot = async (method, body) => {
    if (method === "getChatMember") return { status: members.has(body.user_id) ? "member" : "left" };
    sent.push({ method, ...body });
    return {};
  };
  const subscriptions = {
    retrieve: async (id) => subs.get(id),
    update: async (id, params) => { updates.push({ id, ...params }); subs.get(id).trial_end = params.trial_end; return {}; },
  };
  return { sent, members, subs, updates, bot, subscriptions };
}

async function account({ trial = true, f } = {}) {
  const sub = `sub_tg_${++sequence}`;
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash, email_verified, stripe_subscription_id, subscription_status) VALUES ($1,'fixture',TRUE,$2,$3) RETURNING id",
    [`tg-${sequence}@example.com`, sub, trial ? "trialing" : null],
  );
  const trialEnd = Math.floor(Date.now() / 1000) + 2 * DAY;
  if (trial) f.subs.set(sub, { id: sub, status: "trialing", trial_end: trialEnd });
  return { id: rows[0].id, sub, trialEnd };
}

const nonceOf = (url) => url.split("start=g_")[1];
const lastText = (f) => f.sent.filter((m) => m.method === "sendMessage").at(-1)?.text ?? "";

test("off unless enabled with every setting and a real webhook secret", () => {
  const env = { TELEGRAM_ENABLED: "true", TELEGRAM_BOT_TOKEN: "1:x", TELEGRAM_BOT_USERNAME: "@PCTweakerBot", TELEGRAM_CHANNEL: "@pctweaker", TELEGRAM_WEBHOOK_SECRET: "a".repeat(32) };
  assert.equal(telegramConfig({}), null);
  assert.equal(telegramConfig({ ...env, TELEGRAM_ENABLED: "false" }), null);
  assert.equal(telegramConfig({ ...env, TELEGRAM_WEBHOOK_SECRET: "short" }), null);
  assert.equal(telegramConfig(env).bot, "PCTweakerBot");
  assert.equal(secretMatches(CONFIG, CONFIG.secret), true);
  assert.equal(secretMatches(CONFIG, "x"), false);
  assert.equal(secretMatches(CONFIG, undefined), false);
});

test("gate: join check, +4 trial days once per account and per Telegram user", async () => {
  const f = fakes();
  const t = new Telegram(getPool(), CONFIG, f.bot, f.subscriptions);
  const a = await account({ f });
  const intent = await t.createIntent(a.id);
  assert.match(intent.url, /^https:\/\/t\.me\/PCTweakerBot\?start=g_[A-Za-z0-9_-]{32}$/);

  await t.handleUpdate({ message: { chat: { id: 501, type: "private" }, from: { id: 501 }, text: `/start g_${nonceOf(intent.url)}` } });
  assert.equal((await t.intentStatus(a.id, intent.id)).status, "not_member");
  assert.equal(f.updates.length, 0);

  f.members.add(501);
  await t.handleUpdate({ callback_query: { id: "cb1", from: { id: 501 }, data: `chk_${nonceOf(intent.url)}`, message: { chat: { id: 501 } } } });
  assert.equal((await t.intentStatus(a.id, intent.id)).status, "granted");
  assert.deepEqual(f.updates, [{ id: a.sub, trial_end: a.trialEnd + GATE_DAYS * DAY, proration_behavior: "none" }]);

  const again = await t.createIntent(a.id);
  await t.gate(501, 501, nonceOf(again.url));
  assert.equal((await t.intentStatus(a.id, again.id)).status, "already");
  assert.equal(f.updates.length, 1);

  // The same Telegram user cannot claim for a second account.
  const b = await account({ f });
  const other = await t.createIntent(b.id);
  await t.gate(501, 501, nonceOf(other.url));
  assert.equal((await t.intentStatus(b.id, other.id)).status, "rejected");
  assert.equal(f.updates.length, 1);
  // Another account cannot read this intent.
  assert.equal(await t.intentStatus(b.id, intent.id), null);
});

test("gate: no trial links without reward, expired links do nothing", async () => {
  const f = fakes();
  f.members.add(601);
  const t = new Telegram(getPool(), CONFIG, f.bot, f.subscriptions);
  const a = await account({ trial: false, f });
  const intent = await t.createIntent(a.id);
  await t.gate(601, 601, nonceOf(intent.url));
  assert.equal((await t.intentStatus(a.id, intent.id)).status, "linked");
  assert.match(lastText(f), /start your 3-day trial/);

  const later = new Telegram(getPool(), CONFIG, f.bot, f.subscriptions, () => new Date(Date.now() + INTENT_MS + 1000));
  const c = await account({ f });
  const old = await t.createIntent(c.id);
  await later.gate(602, 602, nonceOf(old.url));
  assert.match(lastText(f), /expired/);
  assert.equal(f.updates.length, 0);
});

test("referral: every 3 friends who unlock a real trial give the inviter +14 days", async () => {
  const f = fakes();
  const t = new Telegram(getPool(), CONFIG, f.bot, f.subscriptions);
  const inviter = await account({ f });
  f.members.add(700);
  // The inviter links (and gets their own gate bonus) first.
  await t.gate(700, 700, nonceOf((await t.createIntent(inviter.id)).url));
  await t.invite(700, 700);
  const code = lastText(f).match(/start=r_([A-Z2-9]{10})/)[1];

  // Self-invitation and an already known Telegram user are ignored.
  await t.handleUpdate({ message: { chat: { id: 700, type: "private" }, from: { id: 700 }, text: `/start r_${code}` } });
  const { rows: none } = await getPool().query("SELECT * FROM telegram_referrals WHERE inviter_tg_id=700");
  assert.equal(none.length, 0);

  for (let i = 1; i <= REFERRAL_QUALIFIED; i++) {
    const friendTg = 710 + i;
    await t.handleUpdate({ message: { chat: { id: friendTg, type: "private" }, from: { id: friendTg }, text: `/start r_${code}` } });
    assert.equal(f.updates.filter((u) => u.id === inviter.sub).length, 1); // only the inviter's own gate so far
    const friend = await account({ f });
    f.members.add(friendTg);
    await t.gate(friendTg, friendTg, nonceOf((await t.createIntent(friend.id)).url));
  }
  const reward = f.updates.find((u) => u.id === inviter.sub && u.trial_end === inviter.trialEnd + (GATE_DAYS + REFERRAL_DAYS) * DAY);
  assert.ok(reward, "inviter's trial extended by the referral days");
  const { rows } = await getPool().query("SELECT state, days FROM telegram_grants WHERE kind='referral' AND tg_user_id=700");
  assert.deepEqual(rows, [{ state: "applied", days: REFERRAL_DAYS }]);
});

test("referral: a friend without a real trial never counts; a paying inviter's reward waits for the owner", async () => {
  const f = fakes();
  const t = new Telegram(getPool(), CONFIG, f.bot, f.subscriptions);
  const inviter = await account({ trial: false, f });
  f.members.add(800);
  await t.gate(800, 800, nonceOf((await t.createIntent(inviter.id)).url));
  await t.invite(800, 800);
  const code = lastText(f).match(/start=r_([A-Z2-9]{10})/)[1];

  // A throwaway Telegram account that joins the channel but has no trial: not counted.
  await t.handleUpdate({ message: { chat: { id: 801, type: "private" }, from: { id: 801 }, text: `/start r_${code}` } });
  f.members.add(801);
  await t.gate(801, 801, nonceOf((await t.createIntent((await account({ trial: false, f })).id)).url));
  const { rows: started } = await getPool().query("SELECT state FROM telegram_referrals WHERE invitee_tg_id=801");
  assert.equal(started[0].state, "started");

  for (let i = 1; i <= REFERRAL_QUALIFIED; i++) {
    const friendTg = 810 + i;
    await t.handleUpdate({ message: { chat: { id: friendTg, type: "private" }, from: { id: friendTg }, text: `/start r_${code}` } });
    f.members.add(friendTg);
    await t.gate(friendTg, friendTg, nonceOf((await t.createIntent((await account({ f })).id)).url));
  }
  const { rows } = await getPool().query("SELECT state FROM telegram_grants WHERE kind='referral' AND tg_user_id=800");
  assert.deepEqual(rows, [{ state: "awaiting_owner" }]);
  assert.equal(f.updates.some((u) => u.id === inviter.sub), false);
});
