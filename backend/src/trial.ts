import { createHash, createHmac } from "crypto";
import { getPool } from "./db";

/**
 * Three-day free trial on the subscription plans (owner decision, 14 October
 * 2026). Checkout collects a card or another recurring method Stripe accepts,
 * the first charge follows on its own, and a failed charge blocks Pro at once
 * with no grace period. One trial per product, per account, per normalised
 * email, per PC (the hash the apps bind licences to) and, where Stripe
 * exposes one, per card fingerprint.
 *
 * Off unless TRIAL_ENABLED=true. The owner turns it on once the apps and the
 * copy are ready; trials already running keep their rules when it is off.
 */
export const TRIAL_DAYS = 3;
/** Card and PC hashes of a claim are cleared this long after the trial started (PRIVACY.md). */
export const TRIAL_HASH_RETENTION_MONTHS = 24;

/** Card fingerprints and PC ids are stored only as HMACs under TRIAL_HASH_KEY
 *  (32 random bytes, hex), never raw. Without the key no trial is offered or
 *  claimed: the card and PC checks could not run. */
export function trialHash(kind: "card" | "device", value: string | null | undefined, environment: NodeJS.ProcessEnv = process.env): string | null {
  const key = environment.TRIAL_HASH_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(key ?? "")) return null;
  return createHmac("sha256", Buffer.from(key!, "hex")).update(`${kind}:${value}`).digest("hex");
}
export function trialKeyConfigured(environment: NodeJS.ProcessEnv = process.env): boolean {
  return /^[a-f0-9]{64}$/i.test(environment.TRIAL_HASH_KEY ?? "");
}
/** Written into the metadata of every trial this backend sells. */
export const TRIAL_MARK = "3d";
/** Our own status for a trial subscription cancelled because the trial was already used. */
export const TRIAL_REJECTED = "trial_rejected";

export function trialEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.TRIAL_ENABLED === "true";
}

/** Lowercase, trimmed, without a +tag; Gmail also ignores dots. */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  let local = email.slice(0, at).split("+")[0];
  let domain = email.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export function emailHash(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

type SubscriptionLike = { status: string; trial_end?: number | null; metadata?: Record<string, string> | null };

/** A subscription sold with our trial. Dashboard-made trials are not policed. */
export function isOurTrial(subscription: SubscriptionLike): boolean {
  return subscription.metadata?.trial === TRIAL_MARK;
}

/**
 * Whether a subscription in this Stripe status keeps Pro. Only active and
 * trialing do. `past_due` keeps its old grace (Pro to the end of the period)
 * only for a subscription that never had a trial while the switch is off, so
 * deploying this changes nothing for existing subscribers until the owner
 * turns trials on.
 */
export function grantsAccess(subscription: SubscriptionLike, environment: NodeJS.ProcessEnv = process.env): boolean {
  if (subscription.status === "active" || subscription.status === "trialing") return true;
  const strict = trialEnabled(environment) || subscription.trial_end != null || isOurTrial(subscription);
  return subscription.status === "past_due" && !strict;
}

/** Stripe statuses of a subscription that still exists and could bill. */
export const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

export type BlockedReason = "none" | "payment_failed" | "canceled" | "trial_already_used";

export function blockedReason(status: string | null | undefined): BlockedReason {
  if (!status || status === "active" || status === "trialing") return "none";
  if (status === "canceled") return "canceled";
  if (status === TRIAL_REJECTED) return "trial_already_used";
  return "payment_failed";
}

/** `device` is the keyed PC hash (trialHash "device"), or null when the app sent none. */
export async function trialUsed(userId: number | string, product: string, email: string, device: string | null = null): Promise<boolean> {
  const { rows } = await getPool().query(
    "SELECT 1 FROM trial_claims WHERE product = $1 AND (user_id = $2 OR email_hash = $3 OR device_hash = $4) LIMIT 1",
    [product, userId, emailHash(email), device],
  );
  return rows.length > 0;
}

/** Server-side trial decision for a new checkout or the status endpoint.
 *  `device` as in trialUsed: apps that send their PC id learn up front that
 *  this PC already had the trial. */
export async function trialEligible(
  userId: number | string,
  product: string,
  { active, status }: { active: boolean; status?: string | null },
  environment: NodeJS.ProcessEnv = process.env,
  device: string | null = null,
): Promise<boolean> {
  if (!trialEnabled(environment) || !trialKeyConfigured(environment) || active || (status && LIVE_STATUSES.has(status))) return false;
  const { rows } = await getPool().query("SELECT email FROM users WHERE id = $1", [userId]);
  if (!rows[0]?.email) return false;
  return !(await trialUsed(userId, product, rows[0].email, device));
}

/**
 * Records the trial of `subscriptionId`. True when this subscription holds
 * the claim (first time or a replayed event), false when the account, the
 * email, the PC or the card already had this product's trial. The unique
 * indexes are the arbiter, so two concurrent checkouts cannot both win.
 * `device` is the keyed PC hash the checkout wrote into the subscription.
 */
export async function claimTrial({ product, userId, fingerprint, subscriptionId, device = null }: {
  product: string; userId: number | string; fingerprint: string | null; subscriptionId: string; device?: string | null;
}, environment: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const { rows: users } = await getPool().query("SELECT email FROM users WHERE id = $1", [userId]);
  if (users[0]?.email && trialKeyConfigured(environment)) {
    const inserted = await getPool().query(
      `INSERT INTO trial_claims (product, user_id, email_hash, card_hash, device_hash, subscription_id)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING subscription_id`,
      [product, userId, emailHash(users[0].email), trialHash("card", fingerprint, environment),
        device && /^[a-f0-9]{64}$/.test(device) ? device : null, subscriptionId],
    );
    if (inserted.rows.length) return true;
  }
  const { rows } = await getPool().query("SELECT 1 FROM trial_claims WHERE subscription_id = $1", [subscriptionId]);
  return rows.length > 0;
}

/**
 * Whether the PC asking for a licence may use this account's running trial.
 * The trial belongs to one PC: the one that started the checkout, or else the
 * first one that asks for a licence (checkouts from apps that did not send the
 * PC id). A PC that already had another account's trial never takes one over;
 * apps that send no PC id at all (older releases, or a PC whose id cannot be
 * read) keep the trial as before, until it is bound. Called only while the
 * entitlement is trialing; an account without a claim had no trial of ours.
 */
export async function trialAllowsDevice(
  userId: number | string,
  product: string,
  deviceHeader: string | null | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const read = () => getPool().query("SELECT device_hash FROM trial_claims WHERE product = $1 AND user_id = $2", [product, userId]);
  let claim = (await read()).rows[0];
  if (!claim) return true;
  if (!claim.device_hash) {
    if (!deviceHeader) return true;
    const device = trialHash("device", deviceHeader, environment);
    if (!device) return false;
    try {
      await getPool().query(
        "UPDATE trial_claims SET device_hash = $3 WHERE product = $1 AND user_id = $2 AND device_hash IS NULL",
        [product, userId, device],
      );
    } catch (err) {
      // This PC already had the trial on another account.
      if ((err as { code?: string }).code === "23505") return false;
      throw err;
    }
    claim = (await read()).rows[0];
  }
  return claim?.device_hash === trialHash("device", deviceHeader, environment);
}

/**
 * Additive migration and retention for trial claims: raw card fingerprints
 * (stored before 24 Oct 2026) become keyed hashes, and card and PC hashes are
 * cleared once a claim is older than TRIAL_HASH_RETENTION_MONTHS. The account
 * and email part of a claim stays, so an account still cannot trial twice.
 */
export async function maintainTrialClaims(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const pool = getPool();
  if (trialKeyConfigured(environment)) {
    const { rows } = await pool.query("SELECT product, user_id, card_fingerprint FROM trial_claims WHERE card_fingerprint IS NOT NULL");
    for (const row of rows) {
      await pool.query(
        "UPDATE trial_claims SET card_hash = COALESCE(card_hash, $3), card_fingerprint = NULL WHERE product = $1 AND user_id = $2",
        [row.product, row.user_id, trialHash("card", row.card_fingerprint, environment)],
      );
    }
  } else if (trialEnabled(environment)) {
    console.error("TRIAL_HASH_KEY is missing: no trial is offered or claimed until it is set");
  }
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - TRIAL_HASH_RETENTION_MONTHS);
  await pool.query(
    "UPDATE trial_claims SET card_hash = NULL, device_hash = NULL, card_fingerprint = NULL WHERE created_at < $1 AND (card_hash IS NOT NULL OR device_hash IS NOT NULL OR card_fingerprint IS NOT NULL)",
    [cutoff],
  );
}
