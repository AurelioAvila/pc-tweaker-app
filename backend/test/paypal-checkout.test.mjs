import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { freePort } from "./free-port.mjs";

// PayPal through Stripe for PC Tweaker plans, Lifetime and the 7-day pass, behind
// PAYPAL_CHECKOUT_ENABLED (owner decision 6 Nov 2026). Nothing here reaches
// Stripe: every price and session is a fixture.
process.env.DATABASE_URL = "pgmem";
process.env.EMAIL_SINK = "1";
process.env.JWT_SECRET = "synthetic-paypal-test-not-a-production-secret";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.PAYPAL_CHECKOUT_ENABLED;
delete process.env.CHECKOUT_CONSENT_REQUIRED;

const { paypalEnabled, paypalSessionParams, checkoutSessionParams } = await import("../dist/stripe-policy.js");
const { createCheckoutHandler, parityQuote, publicPaypal, publicPrices, handleEvent } = await import("../dist/routes/stripe.js");
const { checkoutNotice, invoiceNotice } = await import("../dist/owner-sales.js");
const { checkoutTerms } = await import("../dist/checkout-terms.js");
const evidence = await import("../dist/purchase-evidence.js");
const { PROMO } = await import("../dist/promo.js");
const { getPool, initSchema } = await import("../dist/db.js");
const { productEntitlement } = await import("../dist/products.js");
await initSchema();

const AFTER_PROMO = Date.parse(PROMO.endsAt) + 86_400_000;
const DURING_PROMO = Date.parse("2026-10-31T20:00:00Z");
const base = {
  JWT_SECRET: process.env.JWT_SECRET,
  STRIPE_SECRET_KEY: "sk_test_synthetic_fixture_only",
  STRIPE_PRICE_LIFETIME: "price_lifetime_fixture",
  STRIPE_PRICE_LIFETIME_PROMO: "price_lifetime_promo_fixture",
  STRIPE_PRICE_MONTHLY: "price_monthly_fixture",
  STRIPE_PRICE_ANNUAL: "price_annual_fixture",
  STRIPE_PRICE_PASS_7D: "price_pass_fixture",
  STRIPE_COUPON_HALLOWEEN_ANNUAL: "coupon_annual_fixture",
  PASS_7D_ENABLED: "1",
  CHECKOUT_SUCCESS_URL: "https://example.com/success",
  CHECKOUT_CANCEL_URL: "https://example.com/cancel",
};
const on = { ...base, PAYPAL_CHECKOUT_ENABLED: "1" };
const catalogue = {
  price_lifetime_fixture: { active: true, unit_amount: 9900, currency: "eur", product: "prod_lifetime", recurring: null },
  price_lifetime_promo_fixture: { active: true, unit_amount: 3999, currency: "eur", product: "prod_lifetime", recurring: null },
  price_monthly_fixture: { active: true, unit_amount: 799, currency: "eur", product: "prod_monthly", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } },
  price_annual_fixture: { active: true, unit_amount: 5999, currency: "eur", product: { id: "prod_annual" }, recurring: { interval: "year", interval_count: 1 } },
  price_pass_fixture: { active: true, unit_amount: 499, currency: "eur", product: "prod_pass", recurring: null },
};
const read = async (id) => catalogue[id];

let sequence = 0;
async function user({ verified = true, lifetime = false } = {}) {
  const email = `paypal-${++sequence}@example.com`;
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash, email_verified, is_pro, plan) VALUES ($1, 'fixture', $2, $3, $4) RETURNING id",
    [email, verified, lifetime, lifetime ? "lifetime" : null],
  );
  return rows[0].id;
}
const emailOf = async (id) => (await getPool().query("SELECT email FROM users WHERE id = $1", [id])).rows[0].email;
const response = () => ({ statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });

async function checkout({ environment = on, now = AFTER_PROMO, body = { plan: "lifetime" }, paypal = true, consentPage = false, userId, quote, country = "IT", guardedCreate } = {}) {
  const calls = [];
  const handler = createCheckoutHandler({
    environment,
    now: () => now,
    async createSession(params, key) { calls.push({ params, key }); return { url: "https://checkout.stripe.com/c/pay/cs_fixture", id: "cs_fixture" }; },
    paypalQuote: quote ?? ((id, c) => parityQuote(id, read, c)),
    async buyerCountry() { return country; },
    ...(guardedCreate ? { guardedCreate } : {}),
  }, { replaceDifferentTerms: true, paypal, consentPage });
  const res = response();
  const id = userId ?? await user();
  await handler({ userId: id, body, ip: "203.0.113.9", get: () => undefined }, res);
  return { res, calls, userId: id };
}

test("the switch is on only for exactly PAYPAL_CHECKOUT_ENABLED=1", () => {
  assert.equal(paypalEnabled({}), false);
  for (const value of ["", "0", "true", "yes", " 1"]) assert.equal(paypalEnabled({ PAYPAL_CHECKOUT_ENABLED: value }), false, value);
  assert.equal(paypalEnabled({ PAYPAL_CHECKOUT_ENABLED: "1" }), true);
});

test("PayPal params: PayPal only, outside Managed Payments, euro card total, invoice and receipt for one-offs", () => {
  const card = checkoutSessionParams({
    priceId: "price_lifetime_fixture", mode: "payment", userId: "7", planKey: "lifetime", product: "pctweaker",
    customerId: "cus_fixture", customerEmail: "buyer@example.com", successUrl: "https://example.com/s", cancelUrl: "https://example.com/c",
  });
  const once = paypalSessionParams(structuredClone(card), { unitMinor: 12078, product: "prod_lifetime", country: "IT", receiptEmail: "buyer@example.com" });
  assert.deepEqual(once.payment_method_types, ["paypal"]);
  assert.deepEqual(once.managed_payments, { enabled: false });
  assert.deepEqual(once.line_items, [{ price_data: { currency: "eur", unit_amount: 12078, product: "prod_lifetime" }, quantity: 1 }]);
  assert.equal(once.automatic_tax, undefined);
  assert.equal(once.customer_update, undefined);
  assert.equal(once.customer, "cus_fixture");
  assert.deepEqual(once.invoice_creation, { enabled: true });
  assert.equal(once.payment_intent_data.receipt_email, "buyer@example.com");
  assert.deepEqual(once.metadata, { userId: "7", plan: "lifetime", product: "pctweaker", pay_with: "paypal", price_country: "IT" });
  assert.equal(once.payment_intent_data.metadata.pay_with, "paypal");
  assert.notEqual(checkoutTerms("lifetime", false, card), checkoutTerms("lifetime", false, once), "a card reservation is never reused for PayPal");

  const monthly = checkoutSessionParams({
    priceId: "price_monthly_fixture", mode: "subscription", userId: "7", planKey: "monthly", product: "pctweaker",
    customerId: null, customerEmail: "buyer@example.com", successUrl: "https://example.com/s", cancelUrl: "https://example.com/c",
  });
  const renewing = paypalSessionParams(structuredClone(monthly), { unitMinor: 975, product: "prod_monthly", recurring: { interval: "month", interval_count: 1 }, country: "IT" });
  assert.deepEqual(renewing.line_items, [{ price_data: { currency: "eur", unit_amount: 975, product: "prod_monthly", recurring: { interval: "month", interval_count: 1 } }, quantity: 1 }]);
  assert.equal(renewing.subscription_data.metadata.pay_with, "paypal");
  assert.equal(renewing.subscription_data.metadata.userId, "7", "the subscription still names its account");
  assert.equal(renewing.invoice_creation, undefined, "subscriptions invoice by themselves");
  assert.equal(renewing.payment_intent_data, undefined);
  assert.equal(renewing.customer_email, "buyer@example.com");
  assert.throws(() => paypalSessionParams(structuredClone(monthly), { unitMinor: 1, product: "x" }), "a renewing sale needs an interval");
  assert.throws(() => paypalSessionParams(structuredClone(card), { unitMinor: 1, product: "x", recurring: { interval: "month" } }));
});

test("switch off: no PayPal anywhere, card checkout as before", async () => {
  const off = await checkout({ environment: base });
  assert.equal(off.res.statusCode, 404);
  assert.equal(off.calls.length, 0);
  assert.deepEqual(await publicPaypal(base, async () => { throw new Error("must not be asked"); }), { available: false });
  assert.deepEqual((await publicPrices(base, read, undefined, "IT")).paypal, { available: false });
  const card = await checkout({ environment: base, paypal: false });
  assert.equal(card.res.statusCode, 200);
  assert.equal("payment_method_types" in card.calls[0].params, false);
  assert.equal("managed_payments" in card.calls[0].params, false);
  assert.equal("invoice_creation" in card.calls[0].params, false);
  assert.deepEqual(card.calls[0].params.automatic_tax, { enabled: true });
  assert.deepEqual(card.calls[0].params.line_items, [{ price: "price_lifetime_fixture", quantity: 1 }]);
  assert.doesNotMatch(card.calls[0].key, /paypal/);
});

test("Lifetime and the pass with PayPal: the Italian card total, invoice and receipt to the account", async () => {
  const { res, calls, userId } = await checkout();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const [{ params, key }] = calls;
  assert.deepEqual(params.line_items, [{ price_data: { currency: "eur", unit_amount: 12078, product: "prod_lifetime" }, quantity: 1 }]); // €99 + 22%
  assert.deepEqual(params.payment_method_types, ["paypal"]);
  assert.equal(params.mode, "payment");
  assert.deepEqual(params.invoice_creation, { enabled: true });
  assert.equal(params.payment_intent_data.receipt_email, await emailOf(userId));
  assert.equal(params.metadata.price_country, "IT");
  assert.match(key, /:lifetime:now:paypal:\d+$/, "its own idempotency key");

  // The promotion's Lifetime Price keeps parity: it is a Price, not a coupon.
  const promo = await checkout({ now: DURING_PROMO });
  assert.equal(promo.calls[0].params.line_items[0].price_data.unit_amount, 4879);
  assert.equal(promo.calls[0].params.metadata.promo_id, PROMO.id);

  const pass = await checkout({ body: { plan: "pass_7d" } });
  assert.equal(pass.res.statusCode, 200, JSON.stringify(pass.res.body));
  assert.equal(pass.calls[0].params.line_items[0].price_data.unit_amount, 609); // €4.99 + 22%
  assert.equal(pass.calls[0].params.metadata.plan, "pass_7d");
  const noPass = await checkout({ environment: { ...on, PASS_7D_ENABLED: "0" }, body: { plan: "pass_7d" } });
  assert.equal(noPass.res.statusCode, 404, "the pass switch still decides");
  for (const country of ["US", null]) {
    const net = await checkout({ country });
    assert.equal(net.calls[0].params.line_items[0].price_data.unit_amount, 9900, String(country));
  }
});

test("plans with PayPal renew at the card total; no trial, no other products, no amount-off promotion", async () => {
  const annual = await checkout({ body: { plan: "annual" }, country: "DE" });
  assert.equal(annual.res.statusCode, 200, JSON.stringify(annual.res.body));
  const { params } = annual.calls[0];
  assert.equal(params.mode, "subscription");
  assert.deepEqual(params.line_items, [{ price_data: { currency: "eur", unit_amount: 7139, product: "prod_annual", recurring: { interval: "year", interval_count: 1 } }, quantity: 1 }]);
  assert.equal(params.subscription_data.metadata.pay_with, "paypal");
  assert.equal(params.subscription_data.metadata.plan, "annual");
  assert.equal(params.subscription_data.trial_period_days, undefined);

  const monthly = await checkout({ body: { plan: "monthly" } });
  assert.equal(monthly.calls[0].params.line_items[0].price_data.unit_amount, 975);
  assert.deepEqual(monthly.calls[0].params.line_items[0].price_data.recurring, { interval: "month", interval_count: 1 });

  const trial = await checkout({ body: { plan: "annual", start_trial: true } });
  assert.equal(trial.res.statusCode, 400, "the free trial stays a card offer");
  assert.equal((await checkout({ body: { plan: "annual", product: "uninstaller" } })).res.statusCode, 400);
  assert.equal((await checkout({ userId: await user({ verified: false }) })).res.statusCode, 403, "email verified first");
  assert.equal((await checkout({ userId: await user({ lifetime: true }) })).res.statusCode, 409, "already owns Lifetime");

  const couponed = await checkout({ body: { plan: "annual" }, now: DURING_PROMO });
  assert.equal(couponed.res.statusCode, 409);
  assert.equal(couponed.res.body.code, "paypal_unavailable");
  assert.equal(couponed.calls.length, 0);

  const unreadable = await checkout({ quote: async () => null });
  assert.equal(unreadable.res.statusCode, 503);
  assert.equal(unreadable.res.body.code, "paypal_unavailable");
  assert.equal(unreadable.calls.length, 0);
  const mismatch = await checkout({ quote: async () => ({ eurMinor: 1, cardTotalEurMinor: 1, country: null, product: "p", recurring: { interval: "month", interval_count: 1 } }) });
  assert.equal(mismatch.res.statusCode, 503, "a renewing Price is never sold as a one-off");
});

test("the guarded path skips the referral checkout for PayPal", async () => {
  const seen = [];
  const { res } = await checkout({ body: { plan: "monthly" }, async guardedCreate(input) { seen.push(input); return { url: "https://checkout.stripe.com/c/pay/cs_guarded" }; } });
  assert.equal(res.statusCode, 200);
  assert.equal(seen[0].paypal, true);
  assert.deepEqual(seen[0].params.payment_method_types, ["paypal"]);
});

test("the Terms box: PayPal needs the Terms that name it, and the app's link remembers PayPal", async () => {
  const required = { ...on, CHECKOUT_CONSENT_REQUIRED: "1" };
  const current = evidence.PURCHASE_TERMS_VERSION.pctweaker;
  const previous = evidence.PREVIOUS_TERMS_VERSION.pctweaker;
  const stale = await checkout({ environment: required, body: { plan: "lifetime", consent: { accepted: true, terms_version: previous } } });
  assert.equal(stale.res.statusCode, 409);
  assert.equal(stale.res.body.code, "terms_changed");
  assert.equal(stale.calls.length, 0);
  const card = await checkout({ environment: required, paypal: false, body: { plan: "lifetime", consent: { accepted: true, terms_version: previous } } });
  assert.equal(card.res.statusCode, 200, "a card sale still takes the box before");
  const ticked = await checkout({ environment: required, body: { plan: "lifetime", consent: { accepted: true, terms_version: current } } });
  assert.equal(ticked.res.statusCode, 200);
  assert.equal(ticked.calls[0].params.metadata.terms_version, current);
  assert.equal(ticked.calls[0].params.payment_intent_data.metadata.pay_with, "paypal");

  const app = await checkout({ environment: required, consentPage: true, body: { plan: "annual" } });
  assert.equal(app.res.statusCode, 200);
  assert.equal(app.calls.length, 0);
  const token = new URL(app.res.body.url).hash.replace(/^#/, "").split("=").pop();
  const intent = evidence.readConsentIntent(decodeURIComponent(token));
  assert.equal(intent.paypal, true);
  assert.equal(intent.plan, "annual");
  assert.equal(evidence.readConsentIntent(evidence.signConsentIntent({ uid: 1, tv: 0, product: "pctweaker", plan: "annual" })).paypal, undefined);
});

test("prices endpoint: per plan, the card total PayPal charges, or null where it cannot sell", async () => {
  assert.deepEqual(await publicPaypal(on, read, AFTER_PROMO, "IT"), {
    available: true, currency: "eur", country: "IT", plans: { monthly: 975, annual: 7319, lifetime: 12078, pass_7d: 609 },
  });
  assert.deepEqual((await publicPaypal(on, read, DURING_PROMO, null)).plans, { monthly: 799, annual: null, lifetime: 3999, pass_7d: 499 });
  assert.equal((await publicPaypal({ ...on, PASS_7D_ENABLED: "0" }, read, AFTER_PROMO)).plans.pass_7d, null);
  const unreadable = { ...on, STRIPE_PRICE_MONTHLY: "price_gone", STRIPE_PRICE_ANNUAL: "price_gone", STRIPE_PRICE_LIFETIME: "price_gone", STRIPE_PRICE_PASS_7D: "price_gone" };
  assert.deepEqual((await publicPaypal(unreadable, read, AFTER_PROMO)).plans, { monthly: null, annual: null, lifetime: null, pass_7d: null });
  // Today's date decides the promotion there; the monthly plan has no promotion in these fixtures.
  assert.equal((await publicPrices(on, read, undefined, "IT")).paypal.plans.monthly, 975);
});

test("a paid PayPal Lifetime or pass grants access like a card sale; a PayPal subscription is read from its metadata", async () => {
  const effects = (subscriptions = {}) => ({
    async loadCheckout() { throw new Error("Unexpected external call"); },
    async loadSubscription(id) { return subscriptions[id]; },
    async stopSubscriptions() {},
    async welcome() {},
  });
  const life = await checkout();
  await handleEvent({ id: "evt_pp_1", type: "checkout.session.completed", data: { object: {
    id: "cs_pp_life", created: Math.floor(AFTER_PROMO / 1000), client_reference_id: String(life.userId), mode: "payment",
    payment_status: "paid", customer: "cus_pp", currency: "eur", amount_total: 12078,
    line_items: { data: [{ price: { id: "price_inline_unknown" } }] }, metadata: life.calls[0].params.metadata,
  } } }, effects());
  assert.equal((await productEntitlement(life.userId, "pctweaker")).plan, "lifetime");

  const pass = await checkout({ body: { plan: "pass_7d" } });
  await handleEvent({ id: "evt_pp_2", type: "checkout.session.completed", data: { object: {
    id: "cs_pp_pass", created: Math.floor(Date.now() / 1000), client_reference_id: String(pass.userId), mode: "payment",
    payment_status: "paid", customer: "cus_pp2", currency: "eur", amount_total: 609, metadata: pass.calls[0].params.metadata,
  } } }, effects());
  assert.equal((await productEntitlement(pass.userId, "pctweaker")).active, true);

  const annual = await checkout({ body: { plan: "annual" } });
  const periodEnd = Math.floor(Date.now() / 1000) + 365 * 86_400;
  const subscription = {
    id: "sub_pp", created: Math.floor(Date.now() / 1000), customer: "cus_pp3", status: "active", cancel_at_period_end: false,
    metadata: annual.calls[0].params.subscription_data.metadata,
    items: { data: [{ current_period_end: periodEnd, price: { id: "price_inline_unknown", recurring: { interval: "year" } } }] },
  };
  await handleEvent({ id: "evt_pp_3", type: "checkout.session.completed", data: { object: {
    id: "cs_pp_annual", created: Math.floor(Date.now() / 1000), client_reference_id: String(annual.userId), mode: "subscription",
    payment_status: "paid", customer: "cus_pp3", subscription: "sub_pp", currency: "eur", amount_total: 7319, metadata: annual.calls[0].params.metadata,
  } } }, effects({ sub_pp: subscription }));
  const granted = await productEntitlement(annual.userId, "pctweaker");
  assert.equal(granted.active, true);
  assert.equal(granted.plan, "annual");
});

test("the owner's sale notices say it was paid with PayPal, outside Link", async () => {
  const one = await checkoutNotice({
    id: "cs_pp", mode: "payment", payment_status: "paid", amount_total: 12078, currency: "eur", created: 1_762_400_000,
    customer: "cus_pp", payment_intent: "pi_pp", metadata: { product: "pctweaker", plan: "lifetime", pay_with: "paypal", price_country: "IT" },
    line_items: { data: [{ description: "PC Tweaker Lifetime", quantity: 1 }] }, customer_details: { email: "b@example.com", address: { country: "IT" } },
  }, true, null);
  assert.match(one.subject, /^€120\.78 · PC Tweaker Lifetime — One-off purchase, paid with PayPal · ORD-/);
  assert.ok(one.text.includes("Payment method: PayPal via Stripe, outside Managed Payments: sold directly, not through Link"), one.text);

  const renewal = await invoiceNotice({
    id: "in_pp", amount_paid: 975, currency: "eur", billing_reason: "subscription_create", customer: "cus_pp", number: "PP-0001",
    lines: { data: [{ description: "PC Tweaker Pro (monthly)", period: { start: 1, end: 2 } }] },
    parent: { subscription_details: { subscription: "sub_pp", metadata: { product: "pctweaker", plan: "monthly", pay_with: "paypal" } } },
  }, true, null);
  assert.match(renewal.subject, /New subscription, paid with PayPal/);
  assert.ok(renewal.text.includes("Payment method: PayPal via Stripe"), renewal.text);
  const card = await invoiceNotice({
    id: "in_card", amount_paid: 799, currency: "eur", billing_reason: "subscription_create", customer: "cus_c",
    lines: { data: [{ description: "PC Tweaker Pro (monthly)" }] },
    parent: { subscription_details: { subscription: "sub_c", metadata: { product: "pctweaker", plan: "monthly" } } },
  }, true, null);
  assert.doesNotMatch(card.text, /Payment method/);
});

test("HTTP: the PayPal routes exist only with the switch on", async (t) => {
  async function serve(extra) {
    const port = await freePort();
    const env = { ...process.env, PORT: String(port), STRIPE_SECRET_KEY: "sk_test_never_called", ...extra };
    for (const key of ["DATABASE_URL", "RAILWAY_ENVIRONMENT_ID", "CLIENT_IP_HEADER", "CORS_ORIGINS", "CHECKOUT_GUARD_ENABLED", "STRIPE_PRICE_LIFETIME"]) delete env[key];
    if (!extra.PAYPAL_CHECKOUT_ENABLED) delete env.PAYPAL_CHECKOUT_ENABLED;
    const server = spawn(process.execPath, ["dist/index.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
    t.after(() => server.kill());
    await new Promise((resolve, reject) => {
      server.stdout.on("data", (chunk) => String(chunk).includes("listening") && resolve());
      server.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
    });
    return `http://127.0.0.1:${port}/api`;
  }
  const json = { "Content-Type": "application/json" };
  const offApi = await serve({});
  assert.equal((await fetch(`${offApi}/checkout/paypal`, { method: "POST", headers: json, body: "{}" })).status, 404);
  assert.equal((await fetch(`${offApi}/web-checkout/paypal`, { method: "POST", headers: json, body: "{}" })).status, 404);
  assert.deepEqual((await (await fetch(`${offApi}/billing/prices`)).json()).paypal, { available: false });

  const onApi = await serve({ PAYPAL_CHECKOUT_ENABLED: "1" });
  const guarded = await fetch(`${onApi}/checkout/paypal`, { method: "POST", headers: json, body: "{}" });
  assert.notEqual(guarded.status, 404);
  assert.notEqual(guarded.status, 200);
});
