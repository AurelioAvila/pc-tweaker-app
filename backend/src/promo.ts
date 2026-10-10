import { LIFETIME_CHECKOUT_GRACE_SECONDS } from "./lifetime-offer";

/**
 * Halloween 2026: half the lawful reference price on every paid plan, from
 * 10 October to 23:59:59 on 6 November (Europe/Rome). Owner decisions of
 * 10 October 2026: a real -50% on the struck price, rounded down to X.99.
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
 * The offer began on 10 October, so the references are €79.99, €49.99, €7.99
 * and €9.99 (test/promo.test.mjs recomputes this from the history above), and
 * they stay fixed for the whole promotion. Each promo price is the highest
 * X.99 at or below half its reference.
 *
 * How the price is charged: subscriptions get a once-only coupon, so the
 * plan still renews at its regular price and Stripe says so. Lifetime is
 * sold at its own one-time Price instead of a coupon, so the Stripe page shows
 * €39.99 and not "€99 minus €59.01". STRIPE_PRICE_LIFETIME_PROMO must stay
 * configured after the offer: refunds of those purchases are matched by it.
 *
 * Next promotions: until about 6 December the lowest prices of the previous
 * 30 days are these promo prices, so a Black Friday reduction must strike
 * them. Live checks opened by halloween-coupons.mjs carry
 * metadata.promo_verification and are not prices offered to anyone. Coupons
 * cannot be edited: a different amount or end date needs new coupon IDs, and
 * no STRIPE_PRICE_* may change during the window. Unused earlier coupons
 * "halloween-2026-*" and "halloween50-2026-*" are referenced by nothing.
 *
 * Every amount is in euro cents and excludes VAT, like the Stripe Prices.
 */
export const PROMO = {
  id: "halloween50r-2026",
  // The first go-live; the offer runs while its coupons and prices are configured.
  startsAt: "2026-10-10T00:00:00.000Z",
  // Exclusive: the last second on sale is 23:59:59 on 6 November, Rome (CET).
  endsAt: "2026-11-06T23:00:00.000Z",
  offers: [
    { product: "pctweaker", plan: "monthly", priceEnv: "STRIPE_PRICE_MONTHLY", couponEnv: "STRIPE_COUPON_HALLOWEEN_MONTHLY", regular: 799, reference: 799, price: 399 },
    { product: "pctweaker", plan: "annual", priceEnv: "STRIPE_PRICE_ANNUAL", couponEnv: "STRIPE_COUPON_HALLOWEEN_ANNUAL", regular: 5999, reference: 4999, price: 2499 },
    { product: "pctweaker", plan: "lifetime", priceEnv: "STRIPE_PRICE_LIFETIME", promoPriceEnv: "STRIPE_PRICE_LIFETIME_PROMO", regular: 9900, reference: 7999, price: 3999 },
    // Standard price only: the loyalty price (€4.99) already equals the promo price and is not discounted twice.
    { product: "uninstaller", plan: "annual", priceEnv: "STRIPE_PRICE_UNINSTALLER_ANNUAL", couponEnv: "STRIPE_COUPON_HALLOWEEN_UNINSTALLER", regular: 999, reference: 999, price: 499 },
  ],
} as const;

type Offer = (typeof PROMO.offers)[number];
/** The variable that makes an offer chargeable: its coupon, or its own Price. */
const chargeEnv = (offer: Offer): string => ("couponEnv" in offer ? offer.couponEnv : offer.promoPriceEnv);

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
  return Boolean(environment[chargeEnv(offer)]) && offer.price < offer.reference && offer.price < offer.regular;
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

/** An explicit expiry is sent only near the deadline, and always well inside
 *  Stripe's 24-hour maximum: Stripe measures that limit on its own clock and
 *  rejects even a couple of seconds over (verified live on 10 Oct 2026), so a
 *  server clock slightly ahead would otherwise fail every promo checkout.
 *  Further from the end, Stripe's default 24-hour expiry already ends before
 *  the deadline plus the grace. */
export const EXPLICIT_EXPIRY_WITHIN_SECONDS = 23.5 * 60 * 60;

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
    ...("couponEnv" in offer
      ? { coupon: environment[offer.couponEnv]!, price: undefined }
      : { coupon: undefined, price: environment[offer.promoPriceEnv]! }),
    id: PROMO.id,
    expiresAt: endSeconds - nowSeconds > EXPLICIT_EXPIRY_WITHIN_SECONDS
      ? undefined
      : Math.max(endSeconds, nowSeconds + LIFETIME_CHECKOUT_GRACE_SECONDS),
  };
}
