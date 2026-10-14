import { createHash } from "crypto";
import { getPool } from "./db";

/**
 * Three-day free trial on the subscription plans (owner decision, 14 October
 * 2026). Checkout collects a card or another recurring method Stripe accepts,
 * the first charge follows on its own, and a failed charge blocks Pro at once
 * with no grace period. One trial per product, per account, per normalised
 * email and, where Stripe exposes one, per card fingerprint.
 *
 * Off unless TRIAL_ENABLED=true. The owner turns it on once the apps and the
 * copy are ready; trials already running keep their rules when it is off.
 */
export const TRIAL_DAYS = 3;
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
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

export type BlockedReason = "none" | "payment_failed" | "canceled" | "trial_already_used";

export function blockedReason(status: string | null | undefined): BlockedReason {
  if (!status || status === "active" || status === "trialing") return "none";
  if (status === "canceled") return "canceled";
  if (status === TRIAL_REJECTED) return "trial_already_used";
  return "payment_failed";
}

export async function trialUsed(userId: number | string, product: string, email: string): Promise<boolean> {
  const { rows } = await getPool().query(
    "SELECT 1 FROM trial_claims WHERE product = $1 AND (user_id = $2 OR email_hash = $3) LIMIT 1",
    [product, userId, emailHash(email)],
  );
  return rows.length > 0;
}

/** Server-side trial decision for a new checkout or the status endpoint. */
export async function trialEligible(
  userId: number | string,
  product: string,
  { active, status }: { active: boolean; status?: string | null },
  environment: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  if (!trialEnabled(environment) || active || (status && LIVE_STATUSES.has(status))) return false;
  const { rows } = await getPool().query("SELECT email FROM users WHERE id = $1", [userId]);
  if (!rows[0]?.email) return false;
  return !(await trialUsed(userId, product, rows[0].email));
}

/**
 * Records the trial of `subscriptionId`. True when this subscription holds
 * the claim (first time or a replayed event), false when the account, the
 * email or the card already had this product's trial. The unique indexes are
 * the arbiter, so two concurrent checkouts cannot both win.
 */
export async function claimTrial({ product, userId, fingerprint, subscriptionId }: {
  product: string; userId: number | string; fingerprint: string | null; subscriptionId: string;
}): Promise<boolean> {
  const { rows: users } = await getPool().query("SELECT email FROM users WHERE id = $1", [userId]);
  if (!users[0]?.email) return false;
  const inserted = await getPool().query(
    `INSERT INTO trial_claims (product, user_id, email_hash, card_fingerprint, subscription_id)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING subscription_id`,
    [product, userId, emailHash(users[0].email), fingerprint, subscriptionId],
  );
  if (inserted.rows.length) return true;
  const { rows } = await getPool().query("SELECT 1 FROM trial_claims WHERE subscription_id = $1", [subscriptionId]);
  return rows.length > 0;
}
