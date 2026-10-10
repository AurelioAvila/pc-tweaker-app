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
  STRIPE_PRICE_LIFETIME_PROMO: "price_lifetime_promo_fixture",
  STRIPE_COUPON_HALLOWEEN_UNINSTALLER: "coupon_uninstaller",
  CHECKOUT_SUCCESS_URL: "https://example.com/success",
  CHECKOUT_CANCEL_URL: "https://example.com/cancel",
};

test("the offer ends at 23:59:59 on 6 November, Rome time", () => {
  const rome = (ms) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "medium" }).format(ms);
  assert.equal(rome(END - 1000), "06/11/2026, 23:59:59");
  assert.equal(rome(END), "07/11/2026, 00:00:00");
  assert.ok(START <= Date.parse("2026-10-10T12:00:00Z"));
});

// Prices charged to the public, from live Stripe Checkout Sessions and the
// configuration changes of 14 September (UTC). [from, until, cents]
const HISTORY = {
  "pctweaker:lifetime": [["2026-08-31T01:24Z", "2026-09-07T22:36Z", 7499], ["2026-09-07T22:36Z", "2026-09-11T08:24Z", 8999], ["2026-09-11T08:24Z", "2026-09-14T02:06Z", 7999], ["2026-09-14T02:06Z", null, 9900]],
  "pctweaker:annual": [["2026-08-03T11:35Z", "2026-09-14T02:03Z", 5900], ["2026-09-14T02:03Z", "2026-09-14T02:20Z", 4999], ["2026-09-14T02:20Z", null, 5999]],
  "pctweaker:monthly": [["2026-08-03T11:33Z", "2026-09-14T02:03Z", 999], ["2026-09-14T02:03Z", null, 799]],
  "uninstaller:annual": [["2026-08-19T23:59Z", null, 999]],
};
// Owner rule: the highest price at or below half the reference that ends in
// .99 or is a whole euro amount (a multiple of €5 from €100).
function bestPromoPrice(reference) {
  const half = reference / 2;
  const x99 = Math.floor((half - 99) / 100) * 100 + 99;
  const whole = half >= 10000 ? Math.floor(half / 500) * 500 : Math.floor(half / 100) * 100;
  return Math.max(x99, whole);
}

function lowestBefore(key, startMs) {
  const from = startMs - 30 * 86_400_000;
  return Math.min(...HISTORY[key]
    .filter(([a, b]) => Date.parse(a) < startMs && (b === null || Date.parse(b) > from))
    .map(([, , cents]) => cents));
}

test("every struck price is the lowest charged in the 30 days before the start, and never above it later", () => {
  for (const offer of PROMO.offers) {
    const key = `${offer.product}:${offer.plan}`;
    assert.equal(offer.reference, lowestBefore(key, START), key);
    // A later go-live (up to the end) can only make the lawful reference higher, never lower.
    for (let t = START; t < END; t += 3_600_000) assert.ok(offer.reference <= lowestBefore(key, t), `${key} at ${new Date(t).toISOString()}`);
    assert.ok(offer.price < offer.reference && offer.reference <= offer.regular);
    assert.equal(offer.price, bestPromoPrice(offer.reference), `${key} is the highest round price at or below half its reference`);
  }
  assert.deepEqual(PROMO.offers.map((o) => [o.reference, o.price]), [[799, 399], [4999, 2499], [7999, 3999], [999, 499]]);
  assert.deepEqual(PROMO.offers.map((o) => percentOff(o.reference, o.price)), [50, 50, 50, 50]);
});

test("the percentage is rounded down, never up", () => {
  assert.equal(percentOff(7999, 3999), 50); // 50.006%
  assert.equal(percentOff(4999, 2499), 50); // 50.01%
  assert.equal(percentOff(799, 399), 50); // 50.06%
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
      { product: "pctweaker", plan: "lifetime", currency: "eur", regular: 9900, reference: 7999, price: 3999, percentOff: 50, firstPeriodOnly: false });
    assert.equal(state.offers.find((o) => o.plan === "monthly").firstPeriodOnly, true);
  }
  for (const now of [END, END + 86_400_000, Date.parse("2027-10-31T12:00:00Z")]) {
    assert.deepEqual(promoState(environment, now), { serverTime: new Date(now).toISOString(), id: null, status: "disabled", startsAt: null, endsAt: null, offers: [] });
  }
});

test("the kill switch and missing coupons turn offers off", () => {
  assert.equal(promoState({ ...environment, PROMO_DISABLED: "1" }, DURING).status, "disabled");
  assert.equal(promoState({ ...environment, PROMO_DISABLED: "0" }, DURING).status, "active");
  const noCoupons = Object.fromEntries(Object.entries(environment).filter(([k]) => !k.startsWith("STRIPE_COUPON_") && k !== "STRIPE_PRICE_LIFETIME_PROMO"));
  assert.equal(promoState(noCoupons, DURING).status, "disabled");
  const onlyLifetime = { ...noCoupons, STRIPE_PRICE_LIFETIME_PROMO: "price_lifetime_promo_fixture" };
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
    [{ plan: "lifetime" }, null],
    [{ product: "uninstaller", plan: "annual" }, "coupon_uninstaller"],
  ]) {
    const during = await checkout(body, DURING);
    if (coupon) assert.deepEqual(during.discounts, [{ coupon }]);
    else {
      // Lifetime: its own promo Price, no coupon, so Stripe shows only what is paid.
      assert.equal(during.discounts, undefined);
      assert.deepEqual(during.line_items, [{ price: "price_lifetime_promo_fixture", quantity: 1 }]);
    }
    assert.equal(during.metadata.promo_id, "halloween50r-2026");
    assert.deepEqual(during.after_expiration, { recovery: { enabled: false } });
    if (during.mode === "subscription") assert.equal(during.subscription_data.metadata.promo_id, "halloween50r-2026");
    if (coupon) assert.equal(during.line_items[0].price.includes("promo"), false, "subscriptions keep their regular Price");
    for (const now of [START - 1, END, END + 7 * 86_400_000]) {
      const outside = await checkout(body, now);
      assert.equal(outside.discounts, undefined);
      assert.equal(outside.metadata.promo_id, undefined);
      assert.equal(outside.expires_at, undefined);
      assert.equal(outside.line_items[0].price.includes("promo"), false, "outside the window every plan sells at its regular Price");
    }
  }
});

test("the Uninstaller loyalty price is not discounted again", async () => {
  const subscriber = await user({ pctweakerUntil: new Date(DURING + 30 * 86_400_000) });
  const params = await checkout({ product: "uninstaller", plan: "annual" }, DURING, subscriber);
  assert.equal(params.line_items[0].price, "price_uninstaller_loyalty_fixture");
  assert.equal(params.discounts, undefined);
});
