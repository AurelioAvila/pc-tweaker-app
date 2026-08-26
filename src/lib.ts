// Shared non-visual helpers: config, session, error reporting, formatting.
import { getVersion } from "@tauri-apps/api/app";
import { format, Lang, Strings } from "./i18n";
import { DriverAudit } from "./types";

// The first-party Cloudflare hostname is the stable production endpoint.
// VITE_API_BASE_URL remains available for an explicit local/staging build.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://api.pctweaker.app";

// ---- Anonymous, opt-in error reporting --------------------------------------
// Off by default; the AccountMenu toggle flips a localStorage flag that is
// read at send time (no state plumbing). What leaves the machine: app name,
// version, and the error message the user already saw — nothing else.
export const ERROR_REPORTS_KEY = "pc-tweaker-error-reports";

export let cachedAppVersion = "";
void getVersion()
  .then((v) => {
    cachedAppVersion = v;
  })
  .catch(() => {
    // Without a version the backend rejects the report; reporting simply
    // stays silent, which is the correct failure mode for telemetry.
  });

export function errorReportsEnabled(): boolean {
  return localStorage.getItem(ERROR_REPORTS_KEY) === "on";
}

export function reportError(message: string) {
  if (!API_BASE_URL || !cachedAppVersion || !errorReportsEnabled()) return;
  fetch(`${API_BASE_URL}/api/error-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app: "pctweaker",
      appVersion: cachedAppVersion,
      message: message.slice(0, 500),
    }),
  }).catch(() => {
    // Fire-and-forget by design: a failed report must never surface an error.
  });
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Resolves a tweak/cleanup id to its translated name and description, falling
 * back to the English text the Rust side ships with when a locale is missing
 * the id. Module-level so every screen resolves text the same way — the Scan
 * list used to read `tweak.name` directly and so showed English rows inside a
 * translated UI.
 */
export function textFor(
  dict: Record<string, { name: string; description: string }>,
  id: string,
  fallbackName: string,
  fallbackDescription: string,
): { name: string; description: string } {
  return dict[id] ?? { name: fallbackName, description: fallbackDescription };
}

export const LARGE_FILE_THRESHOLD_BYTES = 100 * 1024 * 1024;

/** Gauge geometry: a 260-degree arc opening at the bottom, like a rev counter. */
export const GAUGE_START = 140;
export const GAUGE_SWEEP = 260;
export const GAUGE_R = 62;
export const GAUGE_C = 80;

export function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: GAUGE_C + radius * Math.cos(rad), y: GAUGE_C + radius * Math.sin(rad) };
}

export function arcPath(fromFrac: number, toFrac: number, radius: number) {
  const a0 = GAUGE_START + GAUGE_SWEEP * fromFrac;
  const a1 = GAUGE_START + GAUGE_SWEEP * toFrac;
  const p0 = polar(a0, radius);
  const p1 = polar(a1, radius);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

/** "12.4 / 31.1 GB" — one unit shown once, so it fits next to the gauge. */
export function gbPair(used: number, total: number): string {
  const gb = (n: number) => (n / 1024 ** 3).toFixed(1);
  return `${gb(used)} / ${gb(total)} GB`;
}

/** Green under light load, amber when it starts to matter, red when it hurts. */
export function loadColor(pct: number): string {
  if (pct >= 85) return "#f87171";
  if (pct >= 60) return "#fbbf24";
  return "#34d399";
}

/** Auto-cleanup choices, in minutes. `0` means "off". */
export const RAM_AUTO_INTERVALS = [0, 10, 30, 60, 180, 360] as const;

export const RAM_AUTO_STORAGE_KEY = "pc-tweaker-ram-auto";

/** Only honor a stored value we actually offer: a hand-edited or stale entry
 *  must not become a rogue interval (or a 0ms one, which would spin the CPU). */
export const TOKEN_KEY = "pc-tweaker-token";

export const EMAIL_KEY = "pc-tweaker-email";

/**
 * The session token, from whichever store it was put in.
 *
 * localStorage survives a restart, sessionStorage does not — which is exactly
 * the difference "remember me" promises. Reading checks both so the rest of
 * the app never has to care which one was used.
 */
export function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function readStoredEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY) ?? sessionStorage.getItem(EMAIL_KEY);
}

export function storeSession(token: string, email: string, remember: boolean) {
  // Clear both first, so switching the choice can never leave a stale token
  // behind in the store that is no longer being written to.
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(EMAIL_KEY, email);
}

export function clearSession() {
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(TOKEN_KEY);
    store.removeItem(EMAIL_KEY);
  }
}

export function storedRamAutoMinutes(): number {
  const stored = Number(localStorage.getItem(RAM_AUTO_STORAGE_KEY));
  return (RAM_AUTO_INTERVALS as readonly number[]).includes(stored) ? stored : 0;
}

export function ramIntervalLabel(minutes: number, s: Strings): string {
  if (minutes === 0) return s.ram.autoOff;
  const text = minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
  return format(s.ram.autoEvery, { interval: text });
}

// Pro pricing, in EUR. Kept here so the displayed price, the "you save X%"
// badge and the per-month equivalent are all derived from the same two
// numbers — a hardcoded badge that drifts from the real price is the kind of
// thing that turns into a refund request.
export const PRICE_MONTHLY = 9.99;

export const PRICE_ANNUAL = 59;

export const savingsPercent = Math.round((1 - PRICE_ANNUAL / (PRICE_MONTHLY * 12)) * 100);

export function money(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatEpochDate(epochSeconds: string): string {
  const n = Number(epochSeconds);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(n * 1000).toLocaleDateString();
}

/** SHA-1 hex digest via the Web Crypto API already available in the webview. */
export async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Device-local profile photo, stored as a small data URL. It never leaves
 * this machine: the backend has no avatar endpoint on purpose — a picture of
 * the user is not data a PC tweaker needs to hold.
 */
export const AVATAR_KEY = "pc-tweaker-avatar";

export function readAvatar(): string | null {
  const v = localStorage.getItem(AVATAR_KEY);
  return v && v.startsWith("data:image/") ? v : null;
}

/**
 * Downscales a picked image to a 128px cover-cropped square JPEG so the
 * stored data URL stays a few KB instead of megabytes of phone photo.
 */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const SIZE = 128;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas unavailable"));
        return;
      }
      // Cover crop: scale the short side to SIZE and center the long one.
      const scale = SIZE / Math.min(img.width, img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("not an image"));
    };
    img.src = url;
  });
}

/**
 * Feature flag for the PC Tweaker Intelligence slice (Advisor + Change
 * Ledger). Compile-time on purpose: flipping it to false removes the nav
 * entry and both surfaces in one place, with no dead UI left behind.
 */
export const FEATURE_INTELLIGENCE = true;

// ---- Driver scan cache -------------------------------------------------------
// Walking every device class takes about sixteen seconds. A module-level
// variable alone survives switching screens but not relaunching the app -
// which is what made "open Hardware" look like it was scanning on its own
// again every time the app started, even though nothing had changed since
// the last read. Persisting the last result means a relaunch shows it
// immediately; only the explicit Rescan button ever pays the sixteen
// seconds again.
const DRIVER_AUDIT_KEY = "pc-tweaker-driver-audit";

export function readCachedDriverAudit(): { audit: DriverAudit; at: Date } | null {
  const raw = localStorage.getItem(DRIVER_AUDIT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { audit: DriverAudit; at: string };
    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime())) return null;
    return { audit: parsed.audit, at };
  } catch {
    // A corrupted or pre-format entry is worth exactly one re-scan, not a
    // permanently broken cache.
    localStorage.removeItem(DRIVER_AUDIT_KEY);
    return null;
  }
}

export function writeCachedDriverAudit(audit: DriverAudit, at: Date) {
  try {
    localStorage.setItem(DRIVER_AUDIT_KEY, JSON.stringify({ audit, at: at.toISOString() }));
  } catch {
    // Over quota or blocked storage: the in-memory cache for this session
    // still works, only the next relaunch loses it. Not worth surfacing.
  }
}
