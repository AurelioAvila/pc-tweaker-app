import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// Crypto (Stripe "Stablecoins and Crypto", USDC) for Lifetime and tips, behind
// CRYPTO_CHECKOUT_ENABLED. Nothing here reaches Stripe: every price, rate and
// session is a fixture.
process.env.DATABASE_URL = "pgmem";
process.env.EMAIL_SINK = "1";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.CRYPTO_CHECKOUT_ENABLED;

const { cryptoEnabled, cryptoSessionParams, usableRate, usdFromEur, checkoutSessionParams, tipSessionParams } = await import("../dist/stripe-policy.js");
const { createCheckoutHandler, cryptoRate, cryptoQuote, publicCrypto, publicPrices, tipCheckout, handleEvent } = await import("../dist/routes/stripe.js");
const { ownerNoticeFor } = await import("../dist/owner-sales.js");
const { checkoutTerms } = await import("../dist/checkout-terms.js");
const { PROMO } = await import("../dist/promo.js");
const { getPool, initSchema } = await import("../dist/db.js");
const { productEntitlement } = await import("../dist/products.js");
await initSchema();

const AFTER_PROMO = Date.parse(PROMO.endsAt) + 86_400_000;
const DURING_PROMO = Date.parse("2026-10-31T20:00:00Z");
const base = {
  STRIPE_SECRET_KEY: "sk_test_synthetic_fixture_only",
  STRIPE_PRICE_LIFETIME: "price_lifetime_fixture",
  STRIPE_PRICE_LIFETIME_PROMO: "price_lifetime_promo_fixture",
  STRIPE_PRICE_MONTHLY: "price_monthly_fixture",
  STRIPE_PRICE_ANNUAL: "price_annual_fixture",
  STRIPE_PRICE_COFFEE: "price_coffee_fixture",
  CHECKOUT_SUCCESS_URL: "https://example.com/success",
  CHECKOUT_CANCEL_URL: "https://example.com/cancel",
};
const on = { ...base, CRYPTO_CHECKOUT_ENABLED: "1" };
const catalogue = {
  price_lifetime_fixture: { active: true, unit_amount: 9900, currency: "eur", product: "prod_lifetime", recurring: null },
  price_lifetime_promo_fixture: { active: true, unit_amount: 3999, currency: "eur", product: "prod_lifetime", recurring: null },
  price_coffee_fixture: { active: true, unit_amount: 100, currency: "eur", product: { id: "prod_coffee" }, recurring: null },
  price_monthly_fixture: { active: true, unit_amount: 799, currency: "eur", product: "prod_pro", recurring: { interval: "month" } },
  price_usd_fixture: { active: true, unit_amount: 100, currency: "usd", product: "prod_x", recurring: null },
};
const read = async (id) => catalogue[id];
const fx = (rate) => async () => rate;

let sequence = 0;
async function user({ verified = true, lifetime = false } = {}) {
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash, email_verified, is_pro, plan) VALUES ($1, 'fixture', $2, $3, $4) RETURNING id",
    [`crypto-${++sequence}@example.com`, verified, lifetime, lifetime ? "lifetime" : null],
  );
  return rows[0].id;
}
const response = () => ({ statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });

async function checkout({ environment = on, now = AFTER_PROMO, body = { plan: "lifetime" }, crypto = true, userId, quote } = {}) {
  const calls = [];
  const handler = createCheckoutHandler({
    environment,
    now: () => now,
    async createSession(params, key) { calls.push({ params, key }); return { url: "https://checkout.stripe.com/c/pay/cs_fixture", id: "cs_fixture" }; },
    cryptoQuote: quote ?? ((id) => cryptoQuote(id, environment, read, fx(1.1))),
  }, { replaceDifferentTerms: true, crypto });
  const res = response();
  await handler({ userId: userId ?? await user(), body }, res);
  return { res, calls };
}

test("the switch is on only for exactly CRYPTO_CHECKOUT_ENABLED=1", () => {
  assert.equal(cryptoEnabled({}), false);
  for (const value of ["", "0", "true", "yes", " 1"]) assert.equal(cryptoEnabled({ CRYPTO_CHECKOUT_ENABLED: value }), false, value);
  assert.equal(cryptoEnabled({ CRYPTO_CHECKOUT_ENABLED: "1" }), true);
});

test("rates: sane bounds, nearest cent, Stripe's quote first, the configured rate second", async () => {
  for (const bad of [undefined, null, "", "abc", 0, -1.1, 0.04, 50, Infinity, NaN]) assert.equal(usableRate(bad), null, String(bad));
  assert.equal(usableRate("1.0850"), 1.085);
  assert.equal(usdFromEur(9900, 1.1), 10890);
  assert.equal(usdFromEur(3999, 1.16), 4639);
  assert.equal(usdFromEur(100, 1.16), 116);

  assert.deepEqual(await cryptoRate({ CRYPTO_USD_PER_EUR: "1.05" }, fx(1.1)), { usdPerEur: 1.1, source: "stripe_fx" });
  assert.deepEqual(await cryptoRate({ CRYPTO_USD_PER_EUR: "1.05" }, async () => { throw new Error("preview not enabled"); }), { usdPerEur: 1.05, source: "config" });
  assert.deepEqual(await cryptoRate({ CRYPTO_USD_PER_EUR: "1.05" }, fx(80)), { usdPerEur: 1.05, source: "config" }, "a garbled quote is ignored");
  assert.equal(await cryptoRate({}, fx(null)), null, "no rate, no crypto");
});

test("a quote is only for a live euro one-off Price", async () => {
  const q = await cryptoQuote("price_lifetime_fixture", {}, read, fx(1.1));
  assert.deepEqual(q, { usdMinor: 10890, eurMinor: 9900, product: "prod_lifetime", rate: { usdPerEur: 1.1, source: "stripe_fx" } });
  assert.equal((await cryptoQuote("price_coffee_fixture", {}, read, fx(1.1))).product, "prod_coffee", "expanded product");
  assert.equal(await cryptoQuote("price_monthly_fixture", {}, read, fx(1.1)), null, "subscriptions are not sold in crypto");
  assert.equal(await cryptoQuote("price_usd_fixture", {}, read, fx(1.1)), null, "only euro Prices are converted");
  assert.equal(await cryptoQuote(undefined, {}, read, fx(1.1)), null);
  assert.equal(await cryptoQuote("price_lifetime_fixture", {}, read, fx(null)), null);
});

test("crypto params: USDC only, outside Managed Payments, same product, card params untouched", () => {
  const card = checkoutSessionParams({
    priceId: "price_lifetime_fixture", mode: "payment", userId: "7", planKey: "lifetime", product: "pctweaker",
    customerId: "cus_fixture", customerEmail: undefined, successUrl: "https://example.com/s", cancelUrl: "https://example.com/c",
  });
  // The card sale keeps the account's Managed Payments default: it never names either field.
  assert.equal("managed_payments" in card, false);
  assert.equal("payment_method_types" in card, false);
  const crypto = cryptoSessionParams(structuredClone(card), { usdMinor: 10890, product: "prod_lifetime" });
  assert.deepEqual(crypto.payment_method_types, ["crypto"]);
  assert.deepEqual(crypto.managed_payments, { enabled: false });
  assert.deepEqual(crypto.line_items, [{ price_data: { currency: "usd", unit_amount: 10890, product: "prod_lifetime" }, quantity: 1 }]);
  assert.equal(crypto.automatic_tax, undefined);
  assert.equal(crypto.customer_update, undefined);
  assert.equal(crypto.customer, "cus_fixture");
  assert.equal(crypto.client_reference_id, "7");
  assert.deepEqual(crypto.metadata, { userId: "7", plan: "lifetime", product: "pctweaker", pay_with: "crypto" });
  assert.equal(crypto.payment_intent_data.metadata.pay_with, "crypto");
  assert.notEqual(checkoutTerms("lifetime", false, card), checkoutTerms("lifetime", false, crypto), "a card reservation is never reused for crypto");
  assert.throws(() => cryptoSessionParams({ mode: "subscription", line_items: [{ price: "p", quantity: 1 }] }, { usdMinor: 1, product: "x" }));
});

test("switch off: no crypto anywhere", async () => {
  const off = await checkout({ environment: base });
  assert.equal(off.res.statusCode, 404);
  assert.equal(off.calls.length, 0);
  assert.deepEqual(await publicCrypto(base, read, async () => { throw new Error("must not be asked"); }), { available: false });
  const prices = await publicPrices(base, read, async () => { throw new Error("must not be asked"); });
  assert.deepEqual(prices.crypto, { available: false });
  const tip = await tipCheckout({ method: "crypto" }, base, async () => { throw new Error("must not be asked"); });
  assert.equal(tip.status, 503);
  // The card paths are what they were.
  const card = await checkout({ environment: base, crypto: false });
  assert.equal(card.res.statusCode, 200);
  assert.equal("payment_method_types" in card.calls[0].params, false);
  assert.equal("managed_payments" in card.calls[0].params, false);
  assert.deepEqual(card.calls[0].params.automatic_tax, { enabled: true });
  assert.deepEqual((await tipCheckout({ quantity: 2, product: "redaxa" }, base)).params,
    tipSessionParams("price_coffee_fixture", "https://pctweaker.app", 2, undefined, "redaxa"));
});

test("Lifetime in crypto: same Price as the card sale, in USD, one Lifetime per account", async () => {
  const { res, calls } = await checkout();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.url, "https://checkout.stripe.com/c/pay/cs_fixture");
  const [{ params, key }] = calls;
  assert.deepEqual(params.line_items, [{ price_data: { currency: "usd", unit_amount: 10890, product: "prod_lifetime" }, quantity: 1 }]);
  assert.deepEqual(params.payment_method_types, ["crypto"]);
  assert.deepEqual(params.managed_payments, { enabled: false });
  assert.equal(params.mode, "payment");
  assert.equal(params.metadata.plan, "lifetime");
  assert.equal(params.metadata.pay_with, "crypto");
  assert.match(key, /:lifetime:now:crypto:\d+$/, "its own idempotency key: a card click a second earlier is a different page");

  // During the promotion the card buyer pays the promo Price: so does the crypto buyer.
  const promo = await checkout({ now: DURING_PROMO });
  assert.equal(promo.calls[0].params.line_items[0].price_data.unit_amount, 4399);
  assert.equal(promo.calls[0].params.metadata.promo_id, PROMO.id);

  assert.equal((await checkout({ userId: await user({ lifetime: true }) })).res.statusCode, 409, "already owns Lifetime");
  assert.equal((await checkout({ userId: await user({ verified: false }) })).res.statusCode, 403, "email verified first");
  assert.equal((await checkout({ body: { plan: "annual" } })).res.statusCode, 400, "Lifetime only");
  assert.equal((await checkout({ body: { plan: "lifetime", start_trial: true } })).res.statusCode, 400);
  assert.equal((await checkout({ body: { plan: "lifetime", product: "uninstaller" } })).res.statusCode, 400);
  const noRate = await checkout({ quote: async () => null });
  assert.equal(noRate.res.statusCode, 503);
  assert.equal(noRate.res.body.code, "crypto_unavailable");
  assert.equal(noRate.calls.length, 0);
});

test("the guarded path skips the referral checkout for crypto", async () => {
  let referralAsked = false;
  const seen = [];
  const handler = createCheckoutHandler({
    environment: on, now: () => AFTER_PROMO,
    async createSession() { throw new Error("guarded path expected"); },
    cryptoQuote: (id) => cryptoQuote(id, on, read, fx(1.1)),
    async guardedCreate(input) { seen.push(input); if (!input.crypto) referralAsked = true; return { url: "https://checkout.stripe.com/c/pay/cs_guarded" }; },
  }, { crypto: true });
  const res = response();
  await handler({ userId: await user(), body: { plan: "lifetime" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(seen[0].crypto, true);
  assert.equal(referralAsked, false);
  assert.deepEqual(seen[0].params.payment_method_types, ["crypto"]);
});

test("prices endpoint: USD amounts for Lifetime (promo included) and one coffee", async () => {
  const crypto = await publicCrypto(on, read, fx(1.16), DURING_PROMO);
  assert.deepEqual(crypto, {
    available: true, currency: "usd", token: "USDC", usd_per_eur: 1.16, rate_source: "stripe_fx",
    lifetime: { usd: 4639, eur: 3999 }, coffee: { usd: 116, eur: 100 },
  });
  assert.equal((await publicCrypto(on, read, fx(1.16), AFTER_PROMO)).lifetime.usd, 11484);
  assert.deepEqual(await publicCrypto(on, read, fx(null)), { available: false }, "no rate configured");
});

test("tips: method=crypto is the same coffees in USD; unknown methods are refused", async () => {
  const quote = (id) => cryptoQuote(id, on, read, fx(1.16));
  const { params } = await tipCheckout({ method: "crypto", quantity: 3, product: "glarion" }, on, quote);
  assert.deepEqual(params.line_items, [{
    price_data: { currency: "usd", unit_amount: 116, product: "prod_coffee" }, quantity: 3,
    adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
  }]);
  assert.deepEqual(params.payment_method_types, ["crypto"]);
  assert.deepEqual(params.managed_payments, { enabled: false });
  assert.deepEqual(params.metadata, { tip_product: "glarion", pay_with: "crypto" });
  assert.equal(params.client_reference_id, undefined, "a tip never names an account");
  assert.equal(params.success_url, "https://glarion.app/?tip=thanks");
  for (const method of ["bitcoin", "CRYPTO", 1, ["crypto"]]) assert.equal((await tipCheckout({ method }, on, quote)).status, 400, String(method));
  assert.equal((await tipCheckout({ method: "card" }, on, quote)).params.line_items[0].price, "price_coffee_fixture");
  assert.equal((await tipCheckout({ method: "crypto" }, on, async () => null)).status, 503);
});

test("a paid crypto session grants Lifetime through the card path, once", async () => {
  const userId = await user();
  const { calls } = await checkout({ userId });
  const session = {
    id: "cs_crypto_fixture", created: Math.floor(AFTER_PROMO / 1000), client_reference_id: String(userId),
    mode: "payment", payment_status: "paid", customer: "cus_crypto_fixture", currency: "usd", amount_total: 10890,
    metadata: calls[0].params.metadata,
  };
  const welcomes = [];
  const effects = {
    async loadCheckout() { throw new Error("Unexpected external call"); },
    async loadSubscription() { throw new Error("Unexpected external call"); },
    async stopSubscriptions() {},
    async welcome(...args) { welcomes.push(args); },
  };
  await handleEvent({ id: "evt_crypto_1", type: "checkout.session.completed", data: { object: session } }, effects);
  await handleEvent({ id: "evt_crypto_2", type: "checkout.session.completed", data: { object: session } }, effects);
  const entitlement = await productEntitlement(userId, "pctweaker");
  assert.equal(entitlement.active, true);
  assert.equal(entitlement.plan, "lifetime");
  // The receipt outbox dedupes on this key, exactly as for a card Lifetime.
  assert.deepEqual(welcomes.map((w) => w[5]), ["checkout:cs_crypto_fixture", "checkout:cs_crypto_fixture"]);
  assert.equal(welcomes[0][4], "$108.90 once");
  const { rows } = await getPool().query("SELECT count(*)::int AS n FROM billing_lifetime_purchases WHERE checkout_id = $1", [session.id]);
  assert.equal(rows[0].n, 1);

  const { notice } = await ownerNoticeFor({ id: "evt_crypto_1", type: "checkout.session.completed", livemode: true, data: { object: {
    ...session, line_items: { data: [{ description: "PC Tweaker Lifetime", quantity: 1 }] }, payment_intent: "pi_crypto_fixture",
  } } }, null);
  assert.match(notice.subject, /^US\$108\.90 · PC Tweaker Lifetime — One-off purchase, paid in crypto · ORD-/);
  assert.ok(notice.text.includes("Payment method: Crypto (USDC)"), notice.text);
});

test("HTTP: the crypto routes exist only with the switch on", async (t) => {
  async function serve(extra) {
    const port = 30_000 + Math.floor(Math.random() * 20_000);
    const env = { ...process.env, PORT: String(port), STRIPE_SECRET_KEY: "sk_test_never_called", ...extra };
    for (const key of ["DATABASE_URL", "RAILWAY_ENVIRONMENT_ID", "CLIENT_IP_HEADER", "CORS_ORIGINS", "CHECKOUT_GUARD_ENABLED", "STRIPE_PRICE_LIFETIME"]) delete env[key];
    if (!extra.CRYPTO_CHECKOUT_ENABLED) delete env.CRYPTO_CHECKOUT_ENABLED;
    const server = spawn(process.execPath, ["dist/index.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
    t.after(() => server.kill());
    await new Promise((resolve, reject) => {
      server.stdout.on("data", (chunk) => String(chunk).includes("listening") && resolve());
      server.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
    });
    return `http://127.0.0.1:${port}/api`;
  }
  const json = { "Content-Type": "application/json" };

  const offApi = await serve({ STRIPE_PRICE_COFFEE: "price_test" });
  assert.equal((await fetch(`${offApi}/checkout/crypto`, { method: "POST", headers: json, body: "{}" })).status, 404);
  assert.equal((await fetch(`${offApi}/web-checkout/crypto`, { method: "POST", headers: json, body: "{}" })).status, 404);
  assert.equal((await fetch(`${offApi}/tip/start?method=crypto`, { redirect: "manual" })).status, 503);
  assert.equal((await fetch(`${offApi}/tip`, { method: "POST", headers: json, body: JSON.stringify({ method: "paypal" }) })).status, 400);
  assert.deepEqual((await (await fetch(`${offApi}/billing/prices`)).json()).crypto, { available: false });

  // With the switch on the route is there and guarded like the card one (no token, no checkout).
  const onApi = await serve({ CRYPTO_CHECKOUT_ENABLED: "1" });
  const guarded = await fetch(`${onApi}/checkout/crypto`, { method: "POST", headers: json, body: "{}" });
  assert.notEqual(guarded.status, 404);
  assert.notEqual(guarded.status, 200);
});
