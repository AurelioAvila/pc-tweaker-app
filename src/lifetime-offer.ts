export type OfferStatus = "disabled" | "scheduled" | "active" | "expired" | "invalid";

export type LifetimeOffer = {
  serverTime: string;
  id: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: OfferStatus;
  available: boolean;
  product: "pctweaker";
  plan: "lifetime";
  checkoutGraceSeconds: number;
};

const HOURS_48 = 48 * 60 * 60 * 1000;
const STATUSES: OfferStatus[] = ["disabled", "scheduled", "active", "expired", "invalid"];

/** Only server-authored, bounded campaign data may become an offer clock. */
export function parseLifetimeOffer(value: unknown): LifetimeOffer | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    v.product !== "pctweaker" ||
    v.plan !== "lifetime" ||
    !STATUSES.includes(v.status as OfferStatus) ||
    typeof v.available !== "boolean" ||
    typeof v.serverTime !== "string" ||
    !Number.isFinite(Date.parse(v.serverTime)) ||
    typeof v.checkoutGraceSeconds !== "number" ||
    !Number.isInteger(v.checkoutGraceSeconds) ||
    v.checkoutGraceSeconds < 0 ||
    v.checkoutGraceSeconds > 3600
  )
    return null;
  if (v.status === "disabled") {
    if (v.id !== null || v.startsAt !== null || v.endsAt !== null) return null;
  } else if (v.status !== "invalid") {
    if (
      typeof v.id !== "string" ||
      !v.id ||
      v.id.length > 100 ||
      typeof v.startsAt !== "string" ||
      typeof v.endsAt !== "string"
    )
      return null;
    const start = Date.parse(v.startsAt);
    const end = Date.parse(v.endsAt);
    const now = Date.parse(v.serverTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start !== HOURS_48) return null;
    if (v.status === "active" && !(start <= now && now < end)) return null;
    if (v.status === "scheduled" && !(now < start && !v.available)) return null;
    if (v.status === "expired" && !(now >= end && !v.available)) return null;
  } else if (v.available !== false) return null;
  return v as LifetimeOffer;
}

export function offerRemainingSeconds(offer: LifetimeOffer, elapsedMs: number): number {
  if (offer.status !== "active" || !offer.endsAt) return 0;
  const remaining =
    Date.parse(offer.endsAt) - Date.parse(offer.serverTime) - Math.max(0, elapsedMs);
  return Math.max(0, Math.ceil(remaining / 1000));
}

export function offerClock(seconds: number): [string, string, string] {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60].map((v) =>
    String(v).padStart(2, "0"),
  ) as [string, string, string];
}

/** An explicit development-only deadline; never a timer reset by opening a page. */
export function previewLifetimeOffer(
  deadline: string | undefined,
  now: number,
): LifetimeOffer | null {
  if (!deadline || !Number.isFinite(Date.parse(deadline))) return null;
  const end = Date.parse(deadline);
  const start = end - HOURS_48;
  return {
    serverTime: new Date(now).toISOString(),
    id: "developer-preview",
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    status: now < start ? "scheduled" : now >= end ? "expired" : "active",
    available: start <= now && now < end,
    product: "pctweaker",
    plan: "lifetime",
    checkoutGraceSeconds: 1860,
  };
}
