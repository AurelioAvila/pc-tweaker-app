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
