import test from "node:test";
import assert from "node:assert/strict";

const {
  formatChargedAmount,
  isSettledCheckout,
  planFromPrice,
  productFromMetadata,
  tipQuantity,
  tipSessionParams,
  TIP_MAX_QUANTITY,
} = await import("../dist/stripe-policy.js");

test("checkout access requires a settled payment state", () => {
  assert.equal(isSettledCheckout("paid"), true);
  assert.equal(isSettledCheckout("no_payment_required"), true);
  assert.equal(isSettledCheckout("unpaid"), false);
  assert.equal(isSettledCheckout(null), false);
});

test("unknown product metadata fails closed while missing legacy metadata remains PC Tweaker", () => {
  assert.equal(productFromMetadata(undefined), "pctweaker");
  assert.equal(productFromMetadata({}), "pctweaker");
  assert.equal(productFromMetadata({ product: "pctweaker" }), "pctweaker");
  assert.equal(productFromMetadata({ product: "uninstaller" }), "uninstaller");
  assert.equal(productFromMetadata({ product: "future-product" }), null);
  assert.equal(productFromMetadata({ product: "__proto__" }), null);
});

test("the plan comes from the price, so a portal switch is not missed", () => {
  const prices = { monthly: "price_m", annual: "price_a", lifetime: "price_l" };
  assert.equal(planFromPrice("price_a", prices), "annual");
  assert.equal(planFromPrice("price_l", prices), "lifetime");
});

test("an unknown or absent price yields nothing rather than a guess", () => {
  // The caller falls back to the subscription's own metadata here. Returning
  // a default plan instead would label every unrecognised price "monthly".
  const prices = { monthly: "price_m", annual: "price_a" };
  assert.equal(planFromPrice("price_someone_made_in_the_dashboard", prices), null);
  assert.equal(planFromPrice(null, prices), null);
  assert.equal(planFromPrice(undefined, prices), null);
});

test("an unconfigured price never matches an unconfigured subscription", () => {
  // Both sides undefined must not compare equal, or an account with no
  // lifetime price set would read every subscription as lifetime.
  assert.equal(planFromPrice(undefined, { lifetime: undefined }), null);
  assert.equal(planFromPrice("price_m", { monthly: undefined, annual: "price_a" }), null);
});

test("the receipt line quotes what Stripe actually charged", () => {
  assert.equal(formatChargedAmount(5900, "eur", "year"), "€59.00 / year");
  assert.equal(formatChargedAmount(7499, "eur", null), "€74.99 once");
  assert.equal(formatChargedAmount(999, "usd", "month"), "$9.99 / month");
});

test("zero-decimal currencies are not divided by a hundred", () => {
  // Dividing JPY by 100 would quote a hundredth of the real price.
  assert.equal(formatChargedAmount(5900, "jpy", "year"), "¥5,900 / year");
});

test("a missing amount omits the line instead of printing zero", () => {
  assert.equal(formatChargedAmount(null, "eur", "year"), null);
  assert.equal(formatChargedAmount(5900, null, "year"), null);
});

test("an unknown currency code still produces a readable line", () => {
  // Intl accepts any well-formed three-letter code and prints it verbatim,
  // so this stays inside the formatter rather than hitting the fallback.
  assert.equal(formatChargedAmount(5900, "zzz", "year"), "ZZZ 59.00 / year");
});

test("a malformed currency code falls back instead of throwing", () => {
  // Intl does throw on a code that is not three letters, and a receipt is
  // not worth losing over it.
  assert.equal(formatChargedAmount(5900, "euro!", "year"), "59 EURO! / year");
});

test("a tip carries no identity, so the webhook can never grant it access", () => {
  // handleCheckoutSession grants Pro off client_reference_id / metadata.userId.
  // Adding either to a tip session would turn a €1 thank-you into a licence.
  const params = tipSessionParams("price_coffee", "https://pctweaker.app");
  assert.equal(params.client_reference_id, undefined);
  assert.equal(params.metadata, undefined);
  assert.equal(params.mode, "payment");
});

test("the tipper is sent back to a page that says thank you", () => {
  const params = tipSessionParams("price_coffee", "http://localhost:5173");
  assert.equal(params.success_url, "http://localhost:5173?tip=thanks");
  assert.equal(params.cancel_url, "http://localhost:5173");
});

test("Checkout keeps its own stepper, within bounds", () => {
  const [item] = tipSessionParams("price_coffee", "https://pctweaker.app").line_items;
  assert.equal(item.price, "price_coffee");
  assert.equal(item.quantity, 1);
  assert.deepEqual(item.adjustable_quantity, {
    enabled: true,
    minimum: 1,
    maximum: TIP_MAX_QUANTITY,
  });
});

test("the caller's coffee count is carried through", () => {
  assert.equal(tipSessionParams("p", "https://x", 4).line_items[0].quantity, 4);
});

test("an unauthenticated quantity cannot be talked out of range", () => {
  // /tip takes no auth, so this number arrives from anyone. Out of range it
  // must clamp, never reach Stripe as a five-figure total in our name.
  assert.equal(tipQuantity(1e9), TIP_MAX_QUANTITY);
  assert.equal(tipQuantity(11), TIP_MAX_QUANTITY);
  assert.equal(tipQuantity(0), 1);
  assert.equal(tipQuantity(-5), 1);
  assert.equal(tipQuantity(Infinity), 1);
});

test("a quantity that is not a usable number falls back to one coffee", () => {
  // Losing the payment over a malformed field would protect nothing.
  assert.equal(tipQuantity(undefined), 1);
  assert.equal(tipQuantity(null), 1);
  assert.equal(tipQuantity("banana"), 1);
  assert.equal(tipQuantity({}), 1);
  assert.equal(tipQuantity(2.7), 2);
  assert.equal(tipQuantity("3"), 3);
});
