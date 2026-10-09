import crypto from "crypto";
import { getPool } from "./db";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Creates a single-use, expiring token for the given purpose (e.g.
 * "email_verify" or "password_reset"). Only the SHA-256 hash is stored, so a
 * database leak alone doesn't hand out usable tokens — mirrors how
 * password_hash is stored, not the password itself.
 *
 * Returns the raw token (to embed in the email link); it is never
 * recoverable from the database afterwards.
 */
async function createActionToken(userId: number, purpose: string, ttlMs: number): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);
  await getPool().query(
    "INSERT INTO action_tokens (user_id, token_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)",
    [userId, hashToken(rawToken), purpose, expiresAt],
  );
  return rawToken;
}

/**
 * Validates and consumes a token: it must exist, match the purpose, not be
 * expired, and not have been used before. Returns the associated user id, or
 * null if the token is invalid for any reason (deliberately not distinguishing
 * why, to avoid leaking which case applies).
 */
async function consumeActionToken(rawToken: string, purpose: string): Promise<number | null> {
  const result = await getPool().query(
    `UPDATE action_tokens
       SET used_at = now()
     WHERE token_hash = $1
       AND purpose = $2
       AND used_at IS NULL
       AND expires_at > now()
     RETURNING user_id`,
    [hashToken(rawToken), purpose],
  );
  return result.rowCount && result.rowCount > 0 ? result.rows[0].user_id : null;
}

/**
 * True when a verification token belongs to an account whose address is
 * already confirmed. Mail scanners open links before people do, and people
 * click twice: that link has nothing left to do, so it is not an error.
 */
async function confirmsVerifiedAddress(rawToken: string): Promise<boolean> {
  const result = await getPool().query(
    `SELECT 1 FROM action_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.purpose = 'email_verify' AND u.email_verified`,
    [hashToken(rawToken)],
  );
  return result.rows.length > 0;
}

export { createActionToken, consumeActionToken, confirmsVerifiedAddress };
