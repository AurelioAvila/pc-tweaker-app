import type { Pool } from "pg";
import { eraseUserReferralData, ReferralError } from "./referrals";
import { LIVE_STATUSES } from "./trial";

/**
 * Executes a verified deletion request (operator only, routes/admin.ts), in one transaction:
 * the referral side first (eraseUserReferralData), then the account row, whose foreign keys
 * delete licences and bonus grants, installation and sign-in records, receipts and action
 * tokens with it, and Tweaky Driver's sessions, tokens and plan for the shared account. The
 * newsletter subscription and ratings sent from the same address go too, with or without an
 * account. Kept on purpose (PRIVACY.md): trial claims and Tweaky Driver's free scans, which have
 * no link to the account table so that one trial or free scan per email, card and PC still
 * holds, and the unlinked referral hashes. Without `erase` it reports and rolls everything back.
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
      // The user row is locked above. Inserting a new reservation needs a
      // foreign-key lock on that row, so creation cannot race this check and
      // subsequent deletion. The table is optional when the guard is disabled.
      const reservationTable = await tx.query("SELECT to_regclass('public.web_checkout_reservations') AS name, to_regclass('public.billing_lifetime_purchases') AS purchases");
      if (reservationTable.rows[0]?.name) {
        if (reservationTable.rows[0]?.purchases) {
          // A signed and processed Lifetime purchase is no longer payable.
          // Both the ledger write and erasure acquire the same user row lock.
          await tx.query(`DELETE FROM web_checkout_reservations WHERE user_id=$1 AND session_id IN
            (SELECT checkout_id FROM billing_lifetime_purchases WHERE user_id=$1)`, [userId]);
        }
        const pending = await tx.query("SELECT 1 FROM web_checkout_reservations WHERE user_id=$1 LIMIT 1", [userId]);
        if (pending.rowCount) throw new ReferralError("checkout_reconciliation_required");
      }
      // Stripe would keep charging a subscription whose account is gone: it is cancelled there first.
      const live = await tx.query(
        `SELECT 1 FROM users WHERE id=$1 AND (subscription_status = ANY($2)
          OR (is_pro AND COALESCE(plan,'') <> 'lifetime' AND stripe_subscription_id IS NOT NULL))
        UNION ALL SELECT 1 FROM entitlements WHERE user_id=$1 AND (subscription_status = ANY($2)
          OR (stripe_subscription_id IS NOT NULL AND subscription_status IS NULL
            AND (expires_at IS NULL OR expires_at > $3)))`,
        [userId, [...LIVE_STATUSES], now],
      );
      // Tweaky Driver signs in with this account; its service keeps sign-in sessions, action tokens
      // and its plan (Stripe customer, subscription, activated PCs) in the same database, in dc_*
      // tables without a foreign key. Its free scans and trial claims are kept, like trial_claims.
      const { rows: [tweaky] } = await tx.query(
        "SELECT to_regclass('public.dc_sessions') AS sessions, to_regclass('public.dc_billing_accounts') AS billing",
      );
      const tweakyLive =
        tweaky.billing &&
        (await tx.query(
          `SELECT 1 FROM dc_billing_accounts WHERE store_scope='pc-tweaker-shared' AND user_id=$1
          AND (subscription->>'status' = ANY($2) OR subscription->>'access' = 'true')`,
          [userId, [...LIVE_STATUSES]],
        )).rowCount;
      if (live.rowCount || tweakyLive) throw new ReferralError("active_subscription");
      if (tweaky.sessions && tweaky.billing)
        for (const [name, table] of [["tweakySessions", "dc_sessions"], ["tweakyActions", "dc_actions"], ["tweakyPlans", "dc_billing_accounts"]])
          counts[name] =
            (await tx.query(`DELETE FROM ${table} WHERE store_scope='pc-tweaker-shared' AND user_id=$1`, [userId]))
              .rowCount ?? 0;
      Object.assign(counts, await eraseUserReferralData(tx, userId, now));
      counts.checkoutReminders =
        (await tx.query("DELETE FROM checkout_reminders WHERE user_id=$1", [userId])).rowCount ?? 0;
      counts.accounts = (await tx.query("DELETE FROM users WHERE id=$1", [userId])).rowCount ?? 0;
    }
    counts.newsletter =
      (await tx.query("DELETE FROM newsletter_subscribers WHERE lower(email)=$1", [address]))
        .rowCount ?? 0;
    counts.waitlists =
      (await tx.query("DELETE FROM newsletter_waitlists WHERE lower(email)=$1", [address])).rowCount ?? 0;
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
