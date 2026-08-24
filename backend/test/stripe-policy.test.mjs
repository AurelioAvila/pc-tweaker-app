import test from "node:test";
import assert from "node:assert/strict";

const { isSettledCheckout, productFromMetadata } = await import("../dist/stripe-policy.js");

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
