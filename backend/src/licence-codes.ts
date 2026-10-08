import { getPool } from "./db";
import { isEntitled } from "./entitlement";

/**
 * Time-limited Pro from a licence code, e.g. a partner's one-day giveaway.
 *
 * The grant lives on the same `users` columns as a subscription
 * (`plan = 'promo'` with a dated `pro_expires_at`), so the signed licence, the
 * desktop's expiry check and every Pro gate treat it exactly like a paid
 * period that ends on its own. It never replaces access someone already has:
 * a code redeemed by a Lifetime owner or an active subscriber is refused, so
 * it cannot shorten or overwrite what they paid for.
 */

export const PROMO_PLAN = "promo";

export type RedeemFailure = "invalid" | "not_started" | "ended" | "already_redeemed" | "verify_email" | "already_pro";
export type RedeemResult = { ok: true; expiresAt: Date } | { ok: false; reason: RedeemFailure };

/** Codes are shown grouped ("PCT-7KQ2-M9XD"); people type them with or
 *  without dashes, spaces or capitals. Stored without separators. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.toUpperCase().replace(/[\s-]+/g, "");
  return /^[A-Z0-9]{6,32}$/.test(code) ? code : null;
}

/** Calendar months, clamped to the last day: 31 Aug + 6 months is 28/29 Feb. */
export function addMonths(from: Date, months: number): Date {
  const end = new Date(from);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, last));
  return end;
}

export async function redeemLicenceCode(userId: number, raw: unknown, now: Date = new Date()): Promise<RedeemResult> {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: "invalid" };
  const pool = getPool();

  const { rows: codes } = await pool.query("SELECT months, starts_at, ends_at FROM licence_codes WHERE code = $1", [code]);
  const found = codes[0];
  if (!found) return { ok: false, reason: "invalid" };
  if (now.getTime() < new Date(found.starts_at).getTime()) return { ok: false, reason: "not_started" };
  if (now.getTime() >= new Date(found.ends_at).getTime()) return { ok: false, reason: "ended" };

  const { rows: earlier } = await pool.query(
    "SELECT 1 FROM licence_code_redemptions WHERE code = $1 AND user_id = $2",
    [code, userId],
  );
  if (earlier.length) return { ok: false, reason: "already_redeemed" };

  const { rows: users } = await pool.query(
    "SELECT is_pro, plan, pro_expires_at, legacy_pro_grant, email_verified FROM users WHERE id = $1",
    [userId],
  );
  const user = users[0];
  if (!user) return { ok: false, reason: "invalid" };
  // A verified address is the cost of a code: it keeps one shared giveaway
  // code from being farmed with throwaway accounts.
  if (!user.email_verified) return { ok: false, reason: "verify_email" };
  if (isEntitled(user, now)) return { ok: false, reason: "already_pro" };

  const expiresAt = addMonths(now, Number(found.months));
  const inserted = await pool.query(
    `INSERT INTO licence_code_redemptions (code, user_id, redeemed_at, expires_at)
     VALUES ($1, $2, $3, $4) ON CONFLICT (code, user_id) DO NOTHING`,
    [code, userId, now, expiresAt],
  );
  if (!inserted.rowCount) return { ok: false, reason: "already_redeemed" };

  // The entitlement check is repeated inside the UPDATE, so a purchase that
  // lands between the read above and this write is never overwritten.
  const granted = await pool.query(
    `UPDATE users
        SET is_pro = TRUE, plan = $2, pro_expires_at = $3, legacy_pro_grant = FALSE
      WHERE id = $1
        AND NOT (is_pro = TRUE AND (COALESCE(plan, '') = 'lifetime'
                                    OR legacy_pro_grant = TRUE
                                    OR (pro_expires_at IS NOT NULL AND pro_expires_at > $4)))`,
    [userId, PROMO_PLAN, expiresAt, now],
  );
  if (!granted.rowCount) {
    await pool.query("DELETE FROM licence_code_redemptions WHERE code = $1 AND user_id = $2", [code, userId]);
    return { ok: false, reason: "already_pro" };
  }
  return { ok: true, expiresAt };
}
