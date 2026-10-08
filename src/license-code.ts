import { invoke } from "@tauri-apps/api/core";
import { API_BASE_URL, readToken } from "./lib";
import { Strings } from "./i18n";

/**
 * Licence codes (a partner giveaway, a promotion): Pro for a fixed period on
 * the signed-in account. The server decides everything — window, one use per
 * account, never over a purchase — so the client only formats, sends and
 * explains the answer in the user's language.
 */

export type LicenseCodeError = keyof Strings["menu"]["licenseCodeErrors"];
export type RedeemOutcome =
  { ok: true; expiresAt: string } | { ok: false; reason: LicenseCodeError | "verify" };

/** The placeholder is the shape of a real code, so it is not translated. */
export const LICENSE_CODE_PLACEHOLDER = "PCT-XXXX-XXXX-XXXX";

/** "pct7kq2m9xd" -> "PCT-7KQ2-M9XD": our codes start with PCT, then groups
 *  of four as the user types. Other codes are grouped from the start. */
export function formatLicenseCode(raw: string): string {
  const clean = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 32);
  const groups = (text: string) => text.match(/.{1,4}/g)?.join("-") ?? "";
  if (clean.startsWith("PCT") && clean.length > 3) return "PCT-" + groups(clean.slice(3));
  return groups(clean);
}

export function isCompleteLicenseCode(formatted: string): boolean {
  return formatted.replace(/-/g, "").length >= 6;
}

const SERVER_REASONS: Record<string, LicenseCodeError | "verify"> = {
  invalid: "invalid",
  not_started: "notStarted",
  ended: "ended",
  already_redeemed: "alreadyRedeemed",
  duplicate: "duplicate",
  sold_out: "soldOut",
  already_pro: "alreadyPro",
  rate_limited: "tooMany",
  verify_email: "verify",
};

export async function redeemLicenseCode(code: string): Promise<RedeemOutcome> {
  const token = readToken();
  if (!API_BASE_URL || !token) return { ok: false, reason: "failed" };
  try {
    // One activation per PC: a one-way key of this Windows installation,
    // computed natively (see license_device_key in src-tauri/src/license.rs).
    const device = await invoke<string>("license_device_key");
    const res = await fetch(`${API_BASE_URL}/api/account/redeem`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code, device }),
    });
    const body = (await res.json().catch(() => ({}))) as { code?: string; proExpiresAt?: string };
    if (res.ok && body.proExpiresAt) return { ok: true, expiresAt: body.proExpiresAt };
    if (res.status === 429) return { ok: false, reason: "tooMany" };
    return { ok: false, reason: SERVER_REASONS[body.code ?? ""] ?? "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

// A code typed before the address is verified waits here, for that account
// only, and is redeemed by the first account refresh that sees it verified.
const PENDING_KEY = "pct.pendingLicenseCode";

export function readPendingCode(email: string): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as {
      email?: string;
      code?: string;
    } | null;
    return saved?.email === email && saved.code ? saved.code : null;
  } catch {
    return null;
  }
}

export function savePendingCode(email: string, code: string): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ email, code }));
  } catch {
    // Storage refused: the user can still enter the code after verifying.
  }
}

export function clearPendingCode(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

export function formatExpiry(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date(iso));
}
