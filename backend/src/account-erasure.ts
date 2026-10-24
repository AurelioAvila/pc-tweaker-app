import type { Pool } from "pg";
import { eraseUserReferralData, ReferralError } from "./referrals";
import { LIVE_STATUSES } from "./trial";

/**
 * Executes a verified deletion request (operator only, routes/admin.ts), in one transaction:
 * the referral side first (eraseUserReferralData), then the account row, whose foreign keys
 * delete licences and bonus grants, installation and sign-in records, receipts and action
 * tokens with it. The newsletter subscription and ratings sent from the same address go too,
 * with or without an account. Kept on purpose (PRIVACY.md): trial claims, which have no link to
 * the account table so that one trial per email, card and PC still holds, and the unlinked
 * referral hashes. Without `erase` it reports the counts and rolls everything back.
 */
export async function eraseAccount(
  db: Pool,
  email: string,
  { erase = false, now = new Date() }: { erase?: boolean; now?: Date } = {},
) {
  const address = email.trim().toLowerCase();
  const tx = await db.connect();
  try {
    await tx.query("BEGIN");
    const { rows } = await tx.query("SELECT id FROM users WHERE email=$1 FOR UPDATE", [address]);
    const userId: number | null = rows[0]?.id ?? null;
    const counts: Record<string, number> = {};
    if (userId !== null) {
      // Stripe would keep charging a subscription whose account is gone: it is cancelled there first.
      const live = await tx.query(
        `SELECT 1 FROM users WHERE id=$1 AND (subscription_status = ANY($2)
          OR (is_pro AND COALESCE(plan,'') <> 'lifetime' AND stripe_subscription_id IS NOT NULL))
        UNION ALL SELECT 1 FROM entitlements WHERE user_id=$1 AND (subscription_status = ANY($2)
          OR (stripe_subscription_id IS NOT NULL AND subscription_status IS NULL
            AND (expires_at IS NULL OR expires_at > $3)))`,
        [userId, [...LIVE_STATUSES], now],
      );
      if (live.rowCount) throw new ReferralError("active_subscription");
      Object.assign(counts, await eraseUserReferralData(tx, userId, now));
      counts.checkoutReminders =
        (await tx.query("DELETE FROM checkout_reminders WHERE user_id=$1", [userId])).rowCount ?? 0;
      counts.accounts = (await tx.query("DELETE FROM users WHERE id=$1", [userId])).rowCount ?? 0;
    }
    counts.newsletter =
      (await tx.query("DELETE FROM newsletter_subscribers WHERE lower(email)=$1", [address]))
        .rowCount ?? 0;
    counts.ratings =
      (await tx.query("DELETE FROM reviews WHERE lower(email)=$1", [address])).rowCount ?? 0;
    await tx.query(erase ? "COMMIT" : "ROLLBACK");
    return { erased: erase, accountFound: userId !== null, userId, counts };
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}
