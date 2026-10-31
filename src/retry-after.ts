/** Seconds a 429 asks to wait, from its Retry-After header (seconds or an
 *  HTTP date), or null when it is missing, malformed or already past. */
export function retryAfterSeconds(header: string | null, now = Date.now()): number | null {
  const value = header?.trim();
  if (!value) return null;
  const seconds = /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.ceil(seconds), 86_400) : null;
}

/** "in 5 minutes", "tra 5 minuti": seconds under a minute, whole minutes
 *  (rounded up) above, worded and inflected by the language itself. */
export function waitPhrase(seconds: number, locale: string): string {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  return seconds < 60
    ? relative.format(seconds, "second")
    : relative.format(Math.ceil(seconds / 60), "minute");
}
