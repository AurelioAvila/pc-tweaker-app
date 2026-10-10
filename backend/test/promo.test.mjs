import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;

const { PROMO, promoState, promoCheckout, percentOff } = await import("../dist/promo.js");
const { promoHandler } = await import("../dist/routes/offers.js");
const { createCheckoutHandler } = await import("../dist/routes/stripe.js");
const { getPool, initSchema } = await import("../dist/db.js");
await initSchema();

const START = Date.parse(PROMO.startsAt);
const END = Date.parse(PROMO.endsAt);
const DURING = Date.parse("2026-10-31T20:00:00Z");
const environment = {
  STRIPE_SECRET_KEY: "sk_test_synthetic_fixture_only",
  STRIPE_PRICE_MONTHLY: "price_monthly_fixture",
  STRIPE_PRICE_ANNUAL: "price_annual_fixture",
  STRIPE_PRICE_LIFETIME: "price_lifetime_fixture",
  STRIPE_PRICE_UNINSTALLER_ANNUAL: "price_uninstaller_fixture",
  STRIPE_PRICE_UNINSTALLER_LOYALTY: "price_uninstaller_loyalty_fixture",
  STRIPE_COUPON_HALLOWEEN_MONTHLY: "coupon_monthly",
  STRIPE_COUPON_HALLOWEEN_ANNUAL: "coupon_annual",
  STRIPE_COUPON_HALLOWEEN_LIFETIME: "coupon_lifetime",
  STRIPE_COUPON_HALLOWEEN_UNINSTALLER: "coupon_uninstaller",
  CHECKOUT_SUCCESS_URL: "https://example.com/success",
  CHECKOUT_CANCEL_URL: "https://example.com/cancel",
};

test("the window is 15 October 00:00 to 6 November 23:59:59, Rome time", () => {
  const rome = (ms) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "medium" }).format(ms);
  assert.equal(rome(START), "15/10/2026, 00:00:00");
  assert.equal(rome(END - 1000), "06/11/2026, 23:59:59");
  assert.equal(rome(END), "07/11/2026, 00:00:00");
});

test("every struck price is the lowest one charged in the 30 days before the start", () => {
  // Last lower prices (Stripe history): Lifetime €79.99 until 2026-09-14 02:06 UTC,
  // Annual €49.99 until 02:19 UTC the same night. Moving the start earlier breaks this.
  assert.ok(START - 30 * 86_400_000 > Date.parse("2026-09-14T02:20:00Z"));
  const current = { "pctweaker:monthly": 799, "pctweaker:annual": 5999, "pctweaker:lifetime": 9900, "uninstaller:annual": 999 };
  for (const offer of PROMO.offers) {
    assert.equal(offer.reference, current[`${offer.product}:${offer.plan}`]);
    assert.equal(offer.regular, offer.reference);
    assert.ok(offer.price < offer.reference);
    assert.equal(percentOff(offer.reference, offer.price), 20);
  }
});

test("the percentage is rounded down, never up", () => {
  assert.equal(percentOff(799, 639), 20); // 20.03%
  assert.equal(percentOff(1000, 801), 19); // 19.9%
});

test("simulated clock: nothing before the start, every offer during, nothing from the end", () => {
  const before = promoState(environment, START - 1);
  assert.equal(before.status, "scheduled");
  assert.deepEqual(before.offers, [], "no price is published before the start");
  for (const now of [START, DURING, END - 1]) {
    const state = promoState(environment, now);
    assert.equal(state.status, "active");
    assert.equal(state.offers.length, 4);
    assert.equal(state.endsAt, PROMO.endsAt);
    assert.deepEqual(state.offers.find((o) => o.plan === "lifetime"),
      { product: "pctweaker", plan: "lifetime", currency: "eur", regular: 9900, reference: 9900, price: 7900, percentOff: 20, firstPeriodOnly: false });
    assert.equal(state.offers.find((o) => o.plan === "monthly").firstPeriodOnly, true);
  }
  for (const now of [END, END + 86_400_000, Date.parse("2027-10-31T12:00:00Z")]) {
    assert.deepEqual(promoState(environment, now), { serverTime: new Date(now).toISOString(), id: null, status: "disabled", startsAt: null, endsAt: null, offers: [] });
  }
});

test("the kill switch and missing coupons turn offers off", () => {
  assert.equal(promoState({ ...environment, PROMO_DISABLED: "1" }, DURING).status, "disabled");
  assert.equal(promoState({ ...environment, PROMO_DISABLED: "0" }, DURING).status, "active");
  const noCoupons = Object.fromEntries(Object.entries(environment).filter(([k]) => !k.startsWith("STRIPE_COUPON_")));
  assert.equal(promoState(noCoupons, DURING).status, "disabled");
  const onlyLifetime = { ...noCoupons, STRIPE_COUPON_HALLOWEEN_LIFETIME: "coupon_lifetime" };
  assert.deepEqual(promoState(onlyLifetime, DURING).offers.map((o) => o.plan), ["lifetime"]);
  assert.equal(promoCheckout(onlyLifetime, DURING, "STRIPE_PRICE_ANNUAL"), null);
});

test("checkout deadline stays inside Stripe's limits and the 31-minute grace", () => {
  for (const now of [START, DURING, END - 3600_000, END - 1000]) {
    const { expiresAt } = promoCheckout(environment, now, "STRIPE_PRICE_LIFETIME");
    const nowSeconds = Math.floor(now / 1000);
    assert.ok(expiresAt >= nowSeconds + 30 * 60);
    assert.ok(expiresAt <= nowSeconds + 24 * 60 * 60);
    assert.ok(expiresAt <= END / 1000 + 31 * 60);
  }
});

test("the public route is uncached and carries no Stripe identifiers", () => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, json(b) { this.body = b; } };
  promoHandler(environment, () => DURING)({}, res);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(res.body.status, "active");
  assert.equal(/coupon_|price_|sk_test/.test(JSON.stringify(res.body)), false);
});

let sequence = 0;
async function user({ pctweakerUntil = null } = {}) {
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash, is_pro, plan, pro_expires_at, email_verified) VALUES ($1, 'fixture', $2, $3, $4, TRUE) RETURNING id",
    [`promo-${++sequence}@example.com`, Boolean(pctweakerUntil), pctweakerUntil ? "annual" : null, pctweakerUntil],
  );
  return rows[0].id;
}

async function checkout(body, now, userId) {
  const calls = [];
  const handler = createCheckoutHandler({ environment, now: () => now,
    async createSession(params) { calls.push(params); return { url: "https://example.com/synthetic-checkout" }; } });
  const res = { statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } };
  await handler({ userId: userId ?? await user(), body }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  return calls[0];
}

test("checkout applies the plan's own coupon only inside the window", async () => {
  for (const [body, coupon] of [
    [{ plan: "monthly" }, "coupon_monthly"],
    [{ plan: "annual" }, "coupon_annual"],
    [{ plan: "lifetime" }, "coupon_lifetime"],
    [{ product: "uninstaller", plan: "annual" }, "coupon_uninstaller"],
  ]) {
    const during = await checkout(body, DURING);
    assert.deepEqual(during.discounts, [{ coupon }]);
    assert.equal(during.metadata.promo_id, "halloween-2026");
    assert.deepEqual(during.after_expiration, { recovery: { enabled: false } });
    if (during.mode === "subscription") assert.equal(during.subscription_data.metadata.promo_id, "halloween-2026");
    assert.equal(during.line_items[0].price.endsWith("_fixture"), true, "the base price never changes");
    for (const now of [START - 1, END, END + 7 * 86_400_000]) {
      const outside = await checkout(body, now);
      assert.equal(outside.discounts, undefined);
      assert.equal(outside.metadata.promo_id, undefined);
      assert.equal(outside.expires_at, undefined);
    }
  }
});

test("the Uninstaller loyalty price is not discounted again", async () => {
  const subscriber = await user({ pctweakerUntil: new Date(DURING + 30 * 86_400_000) });
  const params = await checkout({ product: "uninstaller", plan: "annual" }, DURING, subscriber);
  assert.equal(params.line_items[0].price, "price_uninstaller_loyalty_fixture");
  assert.equal(params.discounts, undefined);
});
