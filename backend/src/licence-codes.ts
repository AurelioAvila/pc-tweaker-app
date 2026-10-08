import { createHmac } from "crypto";
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

export type RedeemFailure =
  | "invalid"
  | "not_started"
  | "ended"
  | "already_redeemed"
  | "duplicate"
  | "sold_out"
  | "no_device"
  | "verify_email"
  | "already_pro";

export type RedeemContext = {
  now?: Date;
  /** Client address, only ever stored as a keyed hash. */
  ip?: string;
  /** The app's one-way key for this Windows installation (64 hex). */
  device?: unknown;
};

/** Accounts on one connection that may activate the same code: a household
 *  shares a router, a farm of throwaway accounts shares it too. */
export const MAX_PER_CONNECTION = 3;

/** The person behind an address, so "name+1@" and "n.a.m.e@gmail" count once. */
export function emailKey(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  const base = local.split("+")[0];
  return `${gmail ? base.replace(/\./g, "") : base}@${gmail ? "gmail.com" : domain}`;
}

function keyed(purpose: string, value: string): string | null {
  const secret = process.env.REVIEW_IP_SECRET || process.env.JWT_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex").slice(0, 32);
}

/** Keyed one-way hash of the client address; the address itself is never stored. */
export function connectionHash(ip: string | undefined): string | null {
  return ip ? keyed("licence", ip) : null;
}

/** The app sends a one-way key for the PC; it is hashed again here, with the
 *  server's secret, before being stored. */
export function deviceHash(device: unknown): string | null {
  if (typeof device !== "string" || !/^[0-9a-f]{64}$/.test(device)) return null;
  return keyed("licence-device", device) ?? device;
}
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

export async function redeemLicenceCode(
  userId: number,
  raw: unknown,
  { now = new Date(), ip, device }: RedeemContext = {},
): Promise<RedeemResult> {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: "invalid" };
  const machine = deviceHash(device);
  if (!machine) return { ok: false, reason: "no_device" };
  const pool = getPool();

  const { rows: codes } = await pool.query(
    "SELECT months, max_redemptions, starts_at, ends_at FROM licence_codes WHERE code = $1",
    [code],
  );
  const found = codes[0];
  if (!found) return { ok: false, reason: "invalid" };
  if (now.getTime() < new Date(found.starts_at).getTime()) return { ok: false, reason: "not_started" };
  if (now.getTime() >= new Date(found.ends_at).getTime()) return { ok: false, reason: "ended" };
  if (found.max_redemptions != null) {
    // ponytail: count-then-insert, so two activations racing for the very last
    // place can both succeed; the cap may be exceeded by a handful, never more.
    const { rows: used } = await pool.query(
      "SELECT count(*)::int AS n FROM licence_code_redemptions WHERE code = $1",
      [code],
    );
    if (Number(used[0]?.n ?? 0) >= Number(found.max_redemptions)) return { ok: false, reason: "sold_out" };
  }

  const { rows: earlier } = await pool.query(
    "SELECT 1 FROM licence_code_redemptions WHERE code = $1 AND user_id = $2",
    [code, userId],
  );
  if (earlier.length) return { ok: false, reason: "already_redeemed" };

  const { rows: users } = await pool.query(
    "SELECT email, is_pro, plan, pro_expires_at, legacy_pro_grant, email_verified FROM users WHERE id = $1",
    [userId],
  );
  const user = users[0];
  if (!user) return { ok: false, reason: "invalid" };
  // A verified address is the cost of a code: it keeps one shared giveaway
  // code from being farmed with throwaway accounts.
  if (!user.email_verified) return { ok: false, reason: "verify_email" };
  if (isEntitled(user, now)) return { ok: false, reason: "already_pro" };

  // One code, one person: the same PC, the same address under another alias,
  // or a run of accounts from one connection does not get a second six months.
  const person = emailKey(String(user.email));
  const connection = connectionHash(ip);
  const { rows: same } = await pool.query(
    "SELECT 1 FROM licence_code_redemptions WHERE code = $1 AND email_key = $2",
    [code, person],
  );
  if (same.length) return { ok: false, reason: "duplicate" };
  const { rows: samePc } = await pool.query(
    "SELECT 1 FROM licence_code_redemptions WHERE code = $1 AND device_hash = $2",
    [code, machine],
  );
  if (samePc.length) return { ok: false, reason: "duplicate" };
  if (connection) {
    const { rows: nearby } = await pool.query(
      "SELECT count(*)::int AS n FROM licence_code_redemptions WHERE code = $1 AND ip_hash = $2",
      [code, connection],
    );
    if (Number(nearby[0]?.n ?? 0) >= MAX_PER_CONNECTION) return { ok: false, reason: "duplicate" };
  }

  const expiresAt = addMonths(now, Number(found.months));
  // No conflict target: a race on the account, person or PC key ends
  // here as a refusal rather than a second grant.
  const inserted = await pool.query(
    `INSERT INTO licence_code_redemptions (code, user_id, redeemed_at, expires_at, email_key, device_hash, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
    [code, userId, now, expiresAt, person, machine, connection],
  );
  if (!inserted.rowCount) return { ok: false, reason: "duplicate" };

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
