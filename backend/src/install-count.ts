import { createHash } from "crypto";
import { getPool } from "./db";

/** How long an installation is remembered after its last licence refresh;
 * PRIVACY.md states the same figure. */
export const INSTALL_RETENTION_DAYS = 90;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Counts on how many installations an account refreshes its licence. The
 * desktop app sends a random identifier it generated itself (nothing derived
 * from the hardware); only its SHA-256 is stored. Measurement only: nothing
 * here decides whether a licence is issued, and a failure is swallowed.
 */
export async function recordInstall(userId: number, product: string, header: unknown): Promise<boolean> {
  if (typeof header !== "string" || !UUID_V4.test(header)) return false;
  const installHash = createHash("sha256").update(header.toLowerCase()).digest("hex");
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO license_installs (user_id, product, install_hash) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product, install_hash) DO UPDATE SET last_seen = now()`,
      [userId, product, installHash],
    );
    await pool.query("DELETE FROM license_installs WHERE user_id = $1 AND last_seen < $2", [
      userId,
      new Date(Date.now() - INSTALL_RETENTION_DAYS * 86_400_000),
    ]);
    return true;
  } catch {
    return false;
  }
}
