import { LIFETIME_CHECKOUT_GRACE_SECONDS } from "./lifetime-offer";

/**
 * Halloween 2026: half price on every paid plan, from release to 23:59:59 on
 * 6 November (Europe/Rome). Owner decision of 10 October 2026.
 *
 * `reference` is the price that may be struck through. EU law (Omnibus
 * Directive, art. 17-bis Codice del consumo) allows only the LOWEST price
 * charged to the public in the 30 days before the reduction starts, and the
 * percentage shown is measured against it. Reconstructed from live Stripe
 * Checkout Sessions and the price changes of 14 September:
 *   - Lifetime  €89.99 until 11 Sep 08:24 UTC, €79.99 (48-hour campaign, then
 *               still configured) until 14 Sep 02:06 UTC, €99 since.
 *   - Annual    €59 until 14 Sep 02:03 UTC, €49.99 configured until 02:19 UTC
 *               that night, €59.99 since.
 *   - Monthly   €9.99 until 14 Sep 02:03 UTC, €7.99 since.
 *   - Uninstaller standard €9.99 since 19 Aug.
 * So for a start on 10 October the references are €79.99, €49.99, €7.99 and
 * €9.99, and Lifetime and Annual show smaller percentages than "half price"
 * (test/promo.test.mjs recomputes this from the history above). The reference
 * stays fixed for the whole promotion even after the older prices leave the
 * 30-day window.
 *
 * Next promotions: until about 6 December the lowest prices of the previous
 * 30 days are these promo prices, so a Black Friday reduction must strike
 * them. Live checks opened by halloween-coupons.mjs carry
 * metadata.promo_verification and are not prices offered to anyone. Coupons
 * cannot be edited: a different amount or end date needs new coupon IDs, and
 * no STRIPE_PRICE_* may change during the window (amount_off is fixed). The
 * unused 20% coupons "halloween-2026-*" created earlier on 10 October are not
 * referenced by anything.
 *
 * Every amount is in euro cents and excludes VAT, like the Stripe Prices.
 * The coupon behind each offer must take exactly `regular - price` off once
 * (see scripts/halloween-coupons.mjs); this file never talks to Stripe.
 */
export const PROMO = {
  id: "halloween50-2026",
  // The earliest go-live; the offer runs once the coupon variables are set.
  startsAt: "2026-10-10T00:00:00.000Z",
  // Exclusive: the last second on sale is 23:59:59 on 6 November, Rome (CET).
  endsAt: "2026-11-06T23:00:00.000Z",
  offers: [
    { product: "pctweaker", plan: "monthly", priceEnv: "STRIPE_PRICE_MONTHLY", couponEnv: "STRIPE_COUPON_HALLOWEEN_MONTHLY", regular: 799, reference: 799, price: 399 },
    { product: "pctweaker", plan: "annual", priceEnv: "STRIPE_PRICE_ANNUAL", couponEnv: "STRIPE_COUPON_HALLOWEEN_ANNUAL", regular: 5999, reference: 4999, price: 2999 },
    { product: "pctweaker", plan: "lifetime", priceEnv: "STRIPE_PRICE_LIFETIME", couponEnv: "STRIPE_COUPON_HALLOWEEN_LIFETIME", regular: 9900, reference: 7999, price: 4950 },
    // Standard price only: the loyalty price (€4.99) already equals the promo price and is not discounted twice.
    { product: "uninstaller", plan: "annual", priceEnv: "STRIPE_PRICE_UNINSTALLER_ANNUAL", couponEnv: "STRIPE_COUPON_HALLOWEEN_UNINSTALLER", regular: 999, reference: 999, price: 499 },
  ],
} as const;

type Offer = (typeof PROMO.offers)[number];

export type PublicPromo = {
  serverTime: string;
  id: string | null;
  status: "disabled" | "scheduled" | "active";
  startsAt: string | null;
  endsAt: string | null;
  offers: {
    product: string;
    plan: string;
    currency: "eur";
    regular: number;
    reference: number;
    price: number;
    percentOff: number;
    /** Subscriptions: only the first billing period is discounted. */
    firstPeriodOnly: boolean;
  }[];
};

/** Rounded down, so the badge never claims more than the real discount. */
export function percentOff(reference: number, price: number): number {
  return Math.floor(((reference - price) * 100) / reference);
}

function sellable(offer: Offer, environment: NodeJS.ProcessEnv): boolean {
  // A price that is not below its lawful reference is not a reduction and is never shown as one.
  return Boolean(environment[offer.couponEnv]) && offer.price < offer.reference && offer.price < offer.regular;
}

/** The promotion as of `nowMs`. Off after the end, before the start (no prices
 *  are published early), without coupons, or with PROMO_DISABLED=1. */
export function promoState(environment: NodeJS.ProcessEnv = process.env, nowMs: number = Date.now()): PublicPromo {
  const base: PublicPromo = { serverTime: new Date(nowMs).toISOString(), id: null, status: "disabled", startsAt: null, endsAt: null, offers: [] };
  const offers = PROMO.offers.filter((offer) => sellable(offer, environment));
  if (environment.PROMO_DISABLED === "1" || offers.length === 0 || nowMs >= Date.parse(PROMO.endsAt)) return base;
  const window = { id: PROMO.id, startsAt: PROMO.startsAt, endsAt: PROMO.endsAt };
  if (nowMs < Date.parse(PROMO.startsAt)) return { ...base, ...window, status: "scheduled" };
  return {
    ...base,
    ...window,
    status: "active",
    offers: offers.map(({ product, plan, regular, reference, price }) => ({
      product, plan, currency: "eur" as const, regular, reference, price,
      percentOff: percentOff(reference, price),
      firstPeriodOnly: plan !== "lifetime",
    })),
  };
}

/** The discount for a checkout about to be created, decided by the server
 *  from the Price it resolved. A checkout opened before the deadline stays
 *  payable for the usual grace (Stripe's 30-minute minimum), never longer. */
export function promoCheckout(environment: NodeJS.ProcessEnv, nowMs: number, priceEnv: string) {
  if (promoState(environment, nowMs).status !== "active") return null;
  const offer = PROMO.offers.find((candidate) => candidate.priceEnv === priceEnv && sellable(candidate, environment));
  if (!offer) return null;
  const nowSeconds = Math.floor(nowMs / 1000);
  const endSeconds = Math.floor(Date.parse(PROMO.endsAt) / 1000);
  return {
    coupon: environment[offer.couponEnv]!,
    id: PROMO.id,
    expiresAt: Math.min(nowSeconds + 24 * 60 * 60, Math.max(endSeconds, nowSeconds + LIFETIME_CHECKOUT_GRACE_SECONDS)),
  };
}
