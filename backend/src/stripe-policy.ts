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

/**
 * What the customer was actually charged, written out for the receipt line
 * of the confirmation email.
 *
 * Read from the Stripe object rather than a table of prices in this file.
 * A table has to be kept in step with the dashboard by hand, and it silently
 * lies the moment it is not: the Uninstaller's loyalty price and its standard
 * price are different Prices under the same plan name, so no per-plan label
 * could have described both. An amount taken from the charge is right by
 * construction.
 *
 * Returns null when the amount is missing, and the caller then omits the
 * line rather than printing a confident "0.00".
 */
export function formatChargedAmount(
  amountInMinorUnits: number | null | undefined,
  currency: string | null | undefined,
  interval?: string | null,
): string | null {
  if (amountInMinorUnits == null || !currency) return null;
  // Zero-decimal currencies (JPY and friends) are not divided by 100. Doing
  // it anyway would quote a hundredth of the real price.
  const zeroDecimal = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
  const code = currency.toLowerCase();
  const amount = zeroDecimal.has(code) ? amountInMinorUnits : amountInMinorUnits / 100;
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: zeroDecimal.has(code) ? 0 : 2,
    })
      .format(amount)
      // Intl separates an unrecognised code from the number with a
      // non-breaking space. It looks identical and compares unequal, which
      // is a poor thing to leave in a string other code may match on.
      .replace(/ /g, " ");
  } catch {
    // An unrecognised currency code must not cost the customer their receipt.
    formatted = `${amount} ${currency.toUpperCase()}`;
  }
  if (!interval) return `${formatted} once`;
  return `${formatted} / ${interval}`;
}
