import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;

const { lifetimeOffer, lifetimeCheckoutDecision, LIFETIME_CHECKOUT_GRACE_SECONDS } = await import("../dist/lifetime-offer.js");
const { lifetimeOfferHandler } = await import("../dist/routes/offers.js");
const { createCheckoutHandler, handleEvent } = await import("../dist/routes/stripe.js");
const { getPool, initSchema } = await import("../dist/db.js");
const { productEntitlement } = await import("../dist/products.js");
await initSchema();

const START = Date.parse("2026-10-01T12:00:00Z");
const END = START + 48 * 60 * 60 * 1000;
const checkoutEnvironment = {
  STRIPE_SECRET_KEY: "sk_test_synthetic_fixture_only",
  STRIPE_PRICE_LIFETIME: "price_lifetime_fixture",
  STRIPE_PRICE_MONTHLY: "price_monthly_fixture",
  STRIPE_PRICE_ANNUAL: "price_annual_fixture",
  CHECKOUT_SUCCESS_URL: "https://example.com/success",
  CHECKOUT_CANCEL_URL: "https://example.com/cancel",
};
const campaignEnvironment = {
  ...checkoutEnvironment,
  LIFETIME_CAMPAIGN_ID: "lifetime-transition-fixture",
  LIFETIME_CAMPAIGN_STARTS_AT: new Date(START).toISOString(),
  LIFETIME_CAMPAIGN_ENDS_AT: new Date(END).toISOString(),
};

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

let sequence = 0;
async function user({ lifetime = false } = {}) {
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash, is_pro, plan) VALUES ($1, 'fixture', $2, $3) RETURNING id",
    [`offer-${++sequence}@example.com`, lifetime, lifetime ? "lifetime" : null],
  );
  return rows[0].id;
}

async function startCheckout({ environment = campaignEnvironment, now = START, userId, body = { plan: "lifetime" } } = {}) {
  const calls = [];
  const handler = createCheckoutHandler({
    environment,
    now: () => now,
    async createSession(params) { calls.push(params); return { url: "https://example.com/synthetic-checkout" }; },
  });
  const res = response();
  await handler({ userId: userId ?? await user(), body }, res);
  return { res, calls };
}

test("absent campaign settings leave normal Lifetime available without a countdown", () => {
  const offer = lifetimeOffer(checkoutEnvironment, START);
  assert.equal(offer.status, "disabled");
  assert.equal(offer.available, true);
  assert.equal(offer.id, null);
  assert.equal(offer.startsAt, null);
  assert.equal(offer.endsAt, null);
  assert.deepEqual(lifetimeCheckoutDecision(offer, false), { allowed: true });
});

test("public availability also requires configured checkout, without exposing its keys or prices", () => {
  const offer = lifetimeOffer({ ...campaignEnvironment, STRIPE_SECRET_KEY: undefined }, START);
  assert.equal(offer.status, "active");
  assert.equal(offer.available, false);
  assert.equal(lifetimeCheckoutDecision(offer, false).status, 503);
  assert.equal(JSON.stringify(offer).includes("price_lifetime_fixture"), false);
  assert.equal(JSON.stringify(offer).includes("sk_test"), false);
});

test("one absolute 48-hour window has exact inclusive start and exclusive end", () => {
  for (const [now, status, available] of [
    [START - 1, "scheduled", false],
    [START, "active", true],
    [END - 1, "active", true],
    [END, "expired", false],
    [END + 365 * 86_400_000, "expired", false],
  ]) {
    const offer = lifetimeOffer(campaignEnvironment, now);
    assert.equal(offer.status, status);
    assert.equal(offer.available, available);
    assert.equal(Date.parse(offer.endsAt) - Date.parse(offer.startsAt), 48 * 60 * 60 * 1000);
    assert.equal(offer.serverTime, new Date(now).toISOString());
  }
});

test("visitors and process restarts cannot reset a configured campaign deadline", () => {
  const first = lifetimeOffer({ ...campaignEnvironment }, START + 1000);
  const later = lifetimeOffer({ ...campaignEnvironment }, END - 1000);
  assert.equal(first.id, later.id);
  assert.equal(first.startsAt, later.startsAt);
  assert.equal(first.endsAt, later.endsAt);
});

test("partial, empty, malformed, impossible, and non-48-hour configurations fail closed", () => {
  const invalid = [
    { ...checkoutEnvironment, LIFETIME_CAMPAIGN_ID: "incomplete" },
    { ...checkoutEnvironment, LIFETIME_CAMPAIGN_ID: "" },
    { ...campaignEnvironment, LIFETIME_CAMPAIGN_ID: "bad id" },
    { ...campaignEnvironment, LIFETIME_CAMPAIGN_ENDS_AT: undefined },
    { ...campaignEnvironment, LIFETIME_CAMPAIGN_STARTS_AT: "2026-02-30T12:00:00Z" },
    { ...campaignEnvironment, LIFETIME_CAMPAIGN_STARTS_AT: "2026-10-01T12:00:00" },
    { ...campaignEnvironment, LIFETIME_CAMPAIGN_STARTS_AT: "2026-10-01T12:00:00+00:00" },
    { ...campaignEnvironment, LIFETIME_CAMPAIGN_ENDS_AT: new Date(END - 1000).toISOString() },
    { ...campaignEnvironment, LIFETIME_CAMPAIGN_ENDS_AT: new Date(END + 1000).toISOString() },
  ];
  for (const environment of invalid) {
    const offer = lifetimeOffer(environment, START);
    assert.equal(offer.status, "invalid");
    assert.equal(offer.available, false);
    assert.equal(offer.id, null);
    assert.equal(lifetimeCheckoutDecision(offer, false).status, 503);
  }
});

test("UTC timestamps without fractional seconds are accepted and normalized", () => {
  const offer = lifetimeOffer({
    ...campaignEnvironment,
    LIFETIME_CAMPAIGN_STARTS_AT: "2026-10-01T12:00:00Z",
    LIFETIME_CAMPAIGN_ENDS_AT: "2026-10-03T12:00:00Z",
  }, START);
  assert.equal(offer.status, "active");
  assert.equal(offer.startsAt, "2026-10-01T12:00:00.000Z");
});

test("campaign checkout expiry stays within Stripe limits and a bounded deadline grace", () => {
  for (const now of [START, END - 86_400_000, END - 3600_000, END - 1000, END - 1]) {
    const decision = lifetimeCheckoutDecision(lifetimeOffer(campaignEnvironment, now), false);
    assert.equal(decision.allowed, true);
    const nowSeconds = Math.floor(now / 1000);
    assert.ok(decision.expiresAt >= nowSeconds + 30 * 60);
    assert.ok(decision.expiresAt <= nowSeconds + 24 * 60 * 60);
    assert.ok(decision.expiresAt <= END / 1000 + LIFETIME_CHECKOUT_GRACE_SECONDS);
    assert.equal(decision.metadata.lifetime_campaign_id, campaignEnvironment.LIFETIME_CAMPAIGN_ID);
    assert.equal(decision.metadata.lifetime_checkout_expires_at, String(decision.expiresAt));
  }
});

test("the public expired endpoint returns a stable closed offer and no-store", () => {
  const res = response();
  lifetimeOfferHandler(campaignEnvironment, () => END)({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(res.body.status, "expired");
  assert.equal(res.body.available, false);
  assert.equal(res.body.endsAt, campaignEnvironment.LIFETIME_CAMPAIGN_ENDS_AT);
});

test("the public invalid endpoint returns 503 and no-store instead of an invented deadline", () => {
  const res = response();
  lifetimeOfferHandler({ LIFETIME_CAMPAIGN_ID: "partial" }, () => START)({}, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(res.body.status, "invalid");
  assert.equal(res.body.endsAt, null);
  assert.equal(res.body.available, false);
});

test("the actual checkout handler enforces server campaign metadata and Stripe expiry", async () => {
  const { res, calls } = await startCheckout({ now: END - 1, body: {
    plan: "lifetime", price: "price_forged", campaignId: "forged", endsAt: "2099-01-01T00:00:00Z",
  } });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  const params = calls[0];
  assert.equal(params.line_items[0].price, checkoutEnvironment.STRIPE_PRICE_LIFETIME);
  assert.equal(params.mode, "payment");
  assert.equal(params.metadata.lifetime_campaign_id, campaignEnvironment.LIFETIME_CAMPAIGN_ID);
  assert.equal(params.metadata.lifetime_campaign_ends_at, campaignEnvironment.LIFETIME_CAMPAIGN_ENDS_AT);
  assert.equal(params.payment_intent_data.metadata.lifetime_campaign_id, campaignEnvironment.LIFETIME_CAMPAIGN_ID);
  assert.equal(params.after_expiration.recovery.enabled, false);
  assert.ok(params.expires_at <= END / 1000 + LIFETIME_CHECKOUT_GRACE_SECONDS);
});

test("scheduled, expired, and invalid campaigns cannot create Lifetime checkouts", async () => {
  for (const [environment, now, status, code] of [
    [campaignEnvironment, START - 1, 409, "LIFETIME_OFFER_NOT_STARTED"],
    [campaignEnvironment, END, 409, "LIFETIME_OFFER_ENDED"],
    [{ ...campaignEnvironment, LIFETIME_CAMPAIGN_ENDS_AT: "invalid" }, START, 503, "LIFETIME_OFFER_UNAVAILABLE"],
  ]) {
    const { res, calls } = await startCheckout({ environment, now });
    assert.equal(res.statusCode, status);
    assert.equal(res.body.code, code);
    assert.equal(calls.length, 0);
  }
});

test("normal Lifetime checkout has no urgency fields when the campaign is absent", async () => {
  const { res, calls } = await startCheckout({ environment: checkoutEnvironment });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].expires_at, undefined);
  assert.equal(calls[0].metadata.lifetime_campaign_id, undefined);
});

test("an active Lifetime owner cannot repurchase during or outside a campaign", async () => {
  const userId = await user({ lifetime: true });
  for (const environment of [campaignEnvironment, checkoutEnvironment]) {
    for (const plan of ["lifetime", "monthly", "annual"]) {
      const { res, calls } = await startCheckout({ environment, userId, body: { plan } });
      assert.equal(res.statusCode, 409);
      assert.equal(res.body.code, "LIFETIME_ALREADY_OWNED");
      assert.equal(calls.length, 0);
      assert.equal((await productEntitlement(userId, "pctweaker")).active, true);
    }
  }
});

test("an expired Lifetime campaign does not block monthly or annual checkout", async () => {
  for (const plan of ["monthly", "annual"]) {
    const { res, calls } = await startCheckout({ now: END, body: { plan } });
    assert.equal(res.statusCode, 200);
    assert.equal(calls[0].mode, "subscription");
    assert.equal(calls[0].expires_at, undefined);
    assert.equal(calls[0].metadata.lifetime_campaign_id, undefined);
  }
});

test("a paid pre-deadline session is honored even when settlement arrives after the campaign", async () => {
  const userId = await user();
  const { calls } = await startCheckout({ userId, now: END - 1000 });
  const params = calls[0];
  assert.equal(lifetimeOffer(campaignEnvironment, END + 3600_000).status, "expired");
  await handleEvent({
    id: "evt_paid_after_campaign_fixture",
    type: "checkout.session.async_payment_succeeded",
    created: END / 1000 + 3600,
    data: { object: {
      id: "cs_pre_deadline_fixture",
      created: END / 1000 - 1,
      client_reference_id: String(userId),
      mode: "payment",
      payment_status: "paid",
      customer: "cus_paid_after_deadline_fixture",
      metadata: params.metadata,
    } },
  }, {
    async loadCheckout() { throw new Error("Unexpected external call"); },
    async loadSubscription() { throw new Error("Unexpected external call"); },
    async stopSubscriptions() {},
    async welcome() {},
    notifySale() {},
  });
  const entitlement = await productEntitlement(userId, "pctweaker");
  assert.equal(entitlement.active, true);
  assert.equal(entitlement.plan, "lifetime");
});
