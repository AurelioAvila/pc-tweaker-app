/** A time-limited promotion as published by GET /api/offers/promo. Display
 *  only: the server decides the discount at checkout, from its own clock. */
export type PromoOffer = {
  product: string;
  plan: string;
  /** Euro cents, excluding VAT, like every Stripe price. */
  regular: number;
  /** The lowest price of the previous 30 days: the only one that may be struck through. */
  reference: number;
  price: number;
  firstPeriodOnly: boolean;
};

export type Promo = {
  serverTime: string;
  id: string;
  status: "scheduled" | "active";
  startsAt: string;
  endsAt: string;
  offers: PromoOffer[];
};

const cents = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const time = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

/** Null for "no promotion" and for anything malformed: a broken payload must
 *  never draw a struck price. A price that is not a real reduction is dropped. */
export function parsePromo(value: unknown): Promo | null {
  const v = value as Record<string, unknown> | null;
  if (!v || (v.status !== "active" && v.status !== "scheduled")) return null;
  if (typeof v.id !== "string" || !time(v.serverTime) || !time(v.startsAt) || !time(v.endsAt))
    return null;
  if (!Array.isArray(v.offers)) return null;
  const offers = (v.offers as Record<string, unknown>[]).filter(
    (o) =>
      o &&
      typeof o.product === "string" &&
      typeof o.plan === "string" &&
      o.currency === "eur" &&
      cents(o.regular) &&
      cents(o.reference) &&
      cents(o.price) &&
      (o.price as number) < (o.reference as number) &&
      (o.price as number) < (o.regular as number) &&
      typeof o.firstPeriodOnly === "boolean",
  ) as unknown as PromoOffer[];
  return { ...(v as unknown as Promo), offers: v.status === "active" ? offers : [] };
}

/** Rounded down, so the badge never claims more than the real discount. */
export function promoPercent(offer: PromoOffer): number {
  return Math.floor(((offer.reference - offer.price) * 100) / offer.reference);
}

/** Milliseconds until `iso`, measured on the server's clock plus the time
 *  elapsed since the response arrived, so a wrong PC clock cannot extend it. */
export function msUntil(promo: Promo, iso: string, elapsedMs: number): number {
  return Date.parse(iso) - Date.parse(promo.serverTime) - Math.max(0, elapsedMs);
}

/** Development-only sample (VITE_PROMO_PREVIEW=active|scheduled). */
export function previewPromo(kind: string | undefined, now: number): Promo | null {
  if (kind !== "active" && kind !== "scheduled") return null;
  const offer = (product: string, plan: string, regular: number, price: number) => ({
    product,
    plan,
    regular,
    reference: regular,
    price,
    firstPeriodOnly: plan !== "lifetime",
  });
  return {
    serverTime: new Date(now).toISOString(),
    id: "developer-preview",
    status: kind,
    startsAt: new Date(now + (kind === "active" ? -1 : 1) * 86_400_000).toISOString(),
    endsAt: "2026-11-06T23:00:00.000Z",
    offers:
      kind === "active"
        ? [
            offer("pctweaker", "monthly", 799, 639),
            offer("pctweaker", "annual", 5999, 4799),
            offer("pctweaker", "lifetime", 9900, 7900),
            offer("uninstaller", "annual", 999, 799),
          ]
        : [],
  };
}
