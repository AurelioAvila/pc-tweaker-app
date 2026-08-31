import { isKnownProduct, type Product } from "./products";

/** Missing product metadata is the only legacy case: every checkout created
 * before multi-product support belonged to PC Tweaker. A present but unknown
 * value is corruption or an unsupported product and must fail closed. */
export function productFromMetadata(
  metadata: Record<string, string> | null | undefined,
): Product | null {
  const value = metadata?.product;
  if (value == null || value === "") return "pctweaker";
  return isKnownProduct(value) ? value : null;
}

/** Checkout completion alone is not proof of payment. Async payment methods
 * emit completed while still unpaid and later send async_payment_succeeded.
 * Trials and fully discounted checkouts legitimately use no_payment_required. */
export function isSettledCheckout(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

/**
 * Which plan a price id belongs to.
 *
 * The alternative — reading `metadata.plan` off the subscription — is written
 * once when the checkout session is created and never updated again, so a
 * customer who switches monthly to annual in Stripe's billing portal would
 * stay labelled "monthly" while being billed annually. The price is the thing
 * Stripe actually changes, so it is the thing to read.
 *
 * The id-to-plan map is passed in rather than read from the environment here,
 * which is what lets this be tested without a configured account.
 */
export function planFromPrice(
  priceId: string | null | undefined,
  prices: Record<string, string | undefined>,
): string | null {
  if (!priceId) return null;
  for (const [plan, configured] of Object.entries(prices)) {
    if (configured && configured === priceId) return plan;
  }
  return null;
}
