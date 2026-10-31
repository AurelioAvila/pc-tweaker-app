import { createHash } from "crypto";
import { getPool } from "./db";

/** How long an installation is remembered after its last licence refresh;
 * PRIVACY.md states the same figure. */
export const INSTALL_RETENTION_DAYS = 90;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function installHash(header: unknown): string | null {
  return typeof header === "string" && UUID_V4.test(header)
    ? createHash("sha256").update(header.toLowerCase()).digest("hex")
    : null;
}

/** The X-Device-Label header (Windows edition and processor, percent-encoded
 *  by the app so any character survives a header), decoded and made safe to
 *  print, or null. It only names the PC for its owner in the account's PC list. */
export function deviceLabel(header: unknown): string | null {
  if (typeof header !== "string" || header.length > 400) return null;
  let label: string;
  try {
    label = decodeURIComponent(header);
  } catch {
    return null;
  }
  label = Array.from(label.replace(/\s+/g, " ").trim()).slice(0, 80).join("").trim();
  // Control, zero-width and bidirectional-override characters could disguise a label.
  return label && !/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿<>]/.test(label) ? label : null;
}

/**
 * Counts on how many installations an account refreshes its licence, and
 * keeps what the account's PC list shows for each: the PC's label and
 * whether the licence it was last sent was Pro. The desktop app sends a
 * random identifier it generated itself (nothing derived from the hardware);
 * only its SHA-256 is stored. Nothing here decides whether a licence is
 * issued, and a failure is swallowed.
 */
export async function recordInstall(
  userId: number,
  product: string,
  header: unknown,
  seen: { label?: string | null; pro?: boolean } = {},
): Promise<boolean> {
  const hash = installHash(header);
  if (!hash) return false;
  try {
    const pool = getPool();
    // An app that sends no label (older versions) keeps the one already known.
    await pool.query(
      `INSERT INTO license_installs (user_id, product, install_hash, device_label, pro) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, product, install_hash)
       DO UPDATE SET last_seen = now(), device_label = COALESCE(EXCLUDED.device_label, license_installs.device_label), pro = EXCLUDED.pro`,
      [userId, product, hash, seen.label ?? null, seen.pro ?? null],
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

export type AccountDevice = {
  product: string;
  label: string | null;
  /** Whether the last licence this installation fetched was Pro; null before it was recorded. */
  pro: boolean | null;
  firstSeen: string;
  lastSeen: string;
  /** The installation that asked (its X-Install-Id), so the app can say "This PC". */
  current: boolean;
};

/**
 * The account's installations from the last 90 days, newest first. Only the
 * signed-in account's own rows, and never their hashes: the caller's own
 * installation is recognised by hashing the id it sent.
 */
export async function listInstalls(userId: number, currentHeader: unknown): Promise<AccountDevice[]> {
  const current = installHash(currentHeader);
  const { rows } = await getPool().query(
    `SELECT product, install_hash, device_label, pro, first_seen, last_seen FROM license_installs
     WHERE user_id = $1 AND last_seen >= $2 ORDER BY last_seen DESC LIMIT 50`,
    [userId, new Date(Date.now() - INSTALL_RETENTION_DAYS * 86_400_000)],
  );
  return rows
    .map((row) => ({
      product: row.product,
      label: row.device_label ?? null,
      pro: typeof row.pro === "boolean" ? row.pro : null,
      firstSeen: new Date(row.first_seen).toISOString(),
      lastSeen: new Date(row.last_seen).toISOString(),
      current: current !== null && row.install_hash === current,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}
