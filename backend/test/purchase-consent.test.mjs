import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";

// The Terms box before Stripe and the dispute evidence (owner decision 3 Nov 2026).
// Nothing here reaches Stripe: every session is a fixture.
process.env.DATABASE_URL = "pgmem";
process.env.EMAIL_SINK = "1";
process.env.JWT_SECRET = "synthetic-consent-test-not-a-production-secret";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.CHECKOUT_CONSENT_REQUIRED;

const { initSchema, getPool } = await import("../dist/db.js");
const { hashPassword, requireAuth, signToken } = await import("../dist/auth.js");
const authRoutes = (await import("../dist/routes/auth.js")).default.default;
const { createCheckoutHandler, consentIntentAuth } = await import("../dist/routes/stripe.js");
const { asyncRoute } = await import("../dist/async-route.js");
const evidence = await import("../dist/purchase-evidence.js");
const { proWelcomeText, proWelcomeHtml } = await import("../dist/emails/pro-welcome.js");
const { copyFor, LOCALES } = await import("../dist/emails/copy/index.js");
const { PROMO } = await import("../dist/promo.js");
await initSchema();

const SECRET = process.env.JWT_SECRET;
const DURING_PROMO = Date.parse("2026-10-31T20:00:00Z");
const AFTER_PROMO = Date.parse("2026-11-08T12:00:00Z");
const DEVICE = "a".repeat(64);
const base = {
  JWT_SECRET: SECRET,
  STRIPE_SECRET_KEY: "sk_test_synthetic_fixture_only",
  STRIPE_PRICE_LIFETIME: "price_lifetime_fixture",
  STRIPE_PRICE_LIFETIME_PROMO: "price_lifetime_promo_fixture",
  STRIPE_PRICE_MONTHLY: "price_monthly_fixture",
  STRIPE_PRICE_ANNUAL: "price_annual_fixture",
  STRIPE_PRICE_UNINSTALLER_ANNUAL: "price_un_annual_fixture",
  STRIPE_COUPON_HALLOWEEN_ANNUAL: "coupon_annual_fixture",
  CHECKOUT_SUCCESS_URL: "https://example.com/success",
  CHECKOUT_CANCEL_URL: "https://example.com/cancel",
};
const required = { ...base, CHECKOUT_CONSENT_REQUIRED: "1" };
const PCT = evidence.PURCHASE_TERMS_VERSION.pctweaker;

let sequence = 0;
async function user({ password = null } = {}) {
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash, email_verified, locale) VALUES ($1, $2, TRUE, 'de') RETURNING id",
    [`consent-${++sequence}@example.com`, password ? await hashPassword(password) : "fixture"],
  );
  return rows[0].id;
}
const response = () => ({ statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });
const request = (userId, body, headers = {}, ip = "203.0.113.9") => ({
  userId, body, ip, headers, get: (name) => headers[name.toLowerCase()],
});
const consents = async (userId) => (await getPool().query("SELECT * FROM checkout_consents WHERE user_id = $1 ORDER BY accepted_at", [userId])).rows;

async function checkout({ environment = required, now = AFTER_PROMO, body, consentPage = false, crypto = false, userId, headers, ip, sessionId = "cs_test_fixture1" } = {}) {
  const calls = [];
  const handler = createCheckoutHandler({
    environment, now: () => now,
    async createSession(params, key) { calls.push({ params, key }); return { url: `https://checkout.stripe.com/c/pay/${sessionId}#fid`, id: sessionId }; },
    async cryptoQuote() { return { usdMinor: 4400, eurMinor: 3999, cardTotalEurMinor: 3999, country: null, product: "prod_fixture", rate: { usdPerEur: 1.1, source: "config" } }; },
    async buyerCountry() { return null; },
  }, { replaceDifferentTerms: consentPage, consentPage, crypto });
  const res = response();
  const id = userId ?? await user();
  await handler(request(id, body, headers, ip), res);
  return { res, calls, userId: id };
}

test("switch off: the apps and the site check out exactly as before, and a sent consent is still recorded", async () => {
  const app = await checkout({ environment: base, consentPage: true, body: { plan: "annual" } });
  assert.equal(app.res.statusCode, 200);
  assert.match(app.res.body.url, /^https:\/\/checkout\.stripe\.com\//);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].params.metadata.consent_id, undefined);
  assert.deepEqual(await consents(app.userId), []);

  const site = await checkout({ environment: base, body: { plan: "annual", consent: { accepted: true, terms_version: PCT } } });
  assert.equal(site.res.statusCode, 200);
  assert.equal((await consents(site.userId)).length, 1);
});

test("switch on: no Stripe session without the box, on any route", async () => {
  for (const body of [{ plan: "annual" }, { plan: "annual", consent: { accepted: false, terms_version: PCT } }, { plan: "annual", consent: null }, { plan: "annual", consent: { accepted: "yes", terms_version: PCT } }]) {
    const { res, calls, userId } = await checkout({ body });
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(res.body.code, "consent_required");
    assert.equal(calls.length, 0);
    assert.deepEqual(await consents(userId), []);
  }
  const stale = await checkout({ body: { plan: "annual", consent: { accepted: true, terms_version: "2020-01-01" } } });
  assert.equal(stale.res.statusCode, 409);
  assert.equal(stale.res.body.code, "terms_changed");
  assert.equal(stale.calls.length, 0);
});

test("switch on: PC Tweaker's app gets our page, carrying exactly what it asked for", async () => {
  const trialOn = { ...required, TRIAL_ENABLED: "true", TRIAL_HASH_KEY: "11".repeat(32) };
  const { res, calls, userId } = await checkout({ environment: trialOn, consentPage: true, body: { plan: "monthly", start_trial: true }, headers: { "x-device-hash": DEVICE } });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 0, "nothing reaches Stripe before the box");
  assert.ok(res.body.url.startsWith("https://pctweaker.app/checkout/confirm/#t="), res.body.url);
  const intent = evidence.readConsentIntent(decodeURIComponent(res.body.url.split("#t=")[1]));
  assert.deepEqual({ ...intent }, { uid: userId, tv: 0, product: "pctweaker", plan: "monthly", trial: true, device: DEVICE, lang: "de" });
  // Never usable as a session token, and never minted from the session key.
  assert.throws(() => jwt.verify(decodeURIComponent(res.body.url.split("#t=")[1]), SECRET));
  assert.equal(evidence.readConsentIntent(signToken(userId, 0)), null);
  assert.equal(evidence.readConsentIntent("garbage"), null);

  const crypto = await checkout({ consentPage: true, crypto: true, environment: { ...required, CRYPTO_CHECKOUT_ENABLED: "1" }, body: { plan: "lifetime" } });
  assert.equal(evidence.readConsentIntent(decodeURIComponent(crypto.res.body.url.split("#t=")[1])).crypto, true);
});

test("switch on: an Uninstaller released before the box keeps working; one that asks for the page gets it", async () => {
  const legacy = await checkout({ consentPage: true, body: { product: "uninstaller", plan: "annual" } });
  assert.equal(legacy.res.statusCode, 200);
  assert.equal(legacy.calls.length, 1);
  const updated = await checkout({ consentPage: true, body: { product: "uninstaller", plan: "annual", consent_page: true } });
  assert.equal(updated.calls.length, 0);
  assert.equal(evidence.readConsentIntent(decodeURIComponent(updated.res.body.url.split("#t=")[1])).product, "uninstaller");
  const ticked = await checkout({ consentPage: true, body: { product: "uninstaller", plan: "annual", consent: { accepted: true, terms_version: evidence.PURCHASE_TERMS_VERSION.uninstaller } } });
  assert.equal(ticked.calls.length, 1);
  assert.equal(ticked.calls[0].params.subscription_data.metadata.terms_version, evidence.PURCHASE_TERMS_VERSION.uninstaller);
});

test("a ticked box is recorded first, then named on the session and linked to it; the Halloween price is untouched", async () => {
  const headers = { "cf-connecting-ip": "198.51.100.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0" };
  const annual = await checkout({ now: DURING_PROMO, body: { plan: "annual", consent: { accepted: true, terms_version: PCT } }, headers, ip: "173.245.48.10", sessionId: "cs_test_annual" });
  assert.equal(annual.res.statusCode, 200);
  const { params } = annual.calls[0];
  assert.deepEqual(params.discounts, [{ coupon: "coupon_annual_fixture" }]);
  const [row] = await consents(annual.userId);
  assert.equal(params.metadata.consent_id, row.id);
  assert.equal(params.metadata.terms_version, PCT);
  assert.equal(params.subscription_data.metadata.consent_id, row.id);
  assert.equal(params.metadata.promo_id, PROMO.id);
  assert.deepEqual([row.product, row.plan, row.terms_version, row.ip, row.user_agent_family, row.checkout_session_id],
    ["pctweaker", "annual", PCT, "198.51.100.7", "Edge", "cs_test_annual"]);

  const lifetime = await checkout({ now: DURING_PROMO, body: { plan: "lifetime", consent: { accepted: true, terms_version: PCT } }, sessionId: "cs_test_lifetime" });
  const life = lifetime.calls[0].params;
  assert.deepEqual(life.line_items, [{ price: "price_lifetime_promo_fixture", quantity: 1 }]);
  assert.equal(life.payment_intent_data.metadata.consent_id, life.metadata.consent_id);
  // Not from Cloudflare: the forged header is ignored and the peer is kept.
  const [lifeRow] = await consents(lifetime.userId);
  assert.equal(lifeRow.ip, "203.0.113.9");
});

test("app -> our page -> confirm over HTTP: refused unticked, Stripe with the tick, dead after sign-out everywhere", async () => {
  const id = await user({ password: "fixture-password" });
  const calls = [];
  const effects = {
    environment: required, now: () => AFTER_PROMO,
    async createSession(params) { calls.push(params); return { url: "https://checkout.stripe.com/c/pay/cs_test_http#x", id: "cs_test_http" }; },
  };
  const app = express();
  app.use(rateLimit({ windowMs: 60_000, limit: 100 }));
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.post("/api/checkout", requireAuth, createCheckoutHandler(effects, { replaceDifferentTerms: true, consentPage: true }));
  app.post("/api/checkout/confirm", asyncRoute(consentIntentAuth), createCheckoutHandler(effects, { replaceDifferentTerms: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) => fetch(url + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  try {
    const login = await post("/api/auth/login", { email: `consent-${sequence}@example.com`, password: "fixture-password" });
    const { token } = await login.json();
    const { rows: [seen] } = await getPool().query("SELECT last_login_at FROM users WHERE id = $1", [id]);
    assert.ok(seen.last_login_at, "sign-in time recorded");

    const started = await (await post("/api/checkout", { plan: "annual" }, { authorization: `Bearer ${token}`, "x-device-hash": DEVICE })).json();
    const link = decodeURIComponent(started.url.split("#t=")[1]);
    assert.equal(calls.length, 0);

    const unticked = await post("/api/checkout/confirm", { token: link, accepted: false, terms_version: PCT });
    assert.equal(unticked.status, 400);
    assert.equal((await unticked.json()).code, "consent_required");
    assert.equal((await post("/api/checkout/confirm", { token: "forged", accepted: true, terms_version: PCT })).status, 401);
    assert.equal((await post("/api/checkout/confirm", { token, accepted: true, terms_version: PCT })).status, 401, "a session token is not a consent link");
    assert.equal(calls.length, 0);

    const ticked = await post("/api/checkout/confirm", { token: link, accepted: true, terms_version: PCT, plan: "lifetime", product: "uninstaller" });
    assert.equal(ticked.status, 200);
    assert.match((await ticked.json()).url, /^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_http/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].metadata.plan, "annual", "the plan comes from the signed link, never the page");
    assert.equal(calls[0].metadata.product, "pctweaker");
    assert.equal((await consents(id))[0].checkout_session_id, "cs_test_http");

    await getPool().query("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [id]);
    assert.equal((await post("/api/checkout/confirm", { token: link, accepted: true, terms_version: PCT })).status, 401);
    assert.equal(calls.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("licence events: one per installation and day, country only, purged after 13 months with the consents", async () => {
  const id = await user();
  const day = new Date("2026-11-03T08:00:00Z");
  assert.equal(await evidence.recordLicenseEvent(id, "pctweaker", "h1", "IT", day), true);
  assert.equal(await evidence.recordLicenseEvent(id, "pctweaker", "h1", "IT", new Date("2026-11-03T22:00:00Z")), false);
  assert.equal(await evidence.recordLicenseEvent(id, "pctweaker", "h2", null, day), true);
  assert.equal(await evidence.recordLicenseEvent(id, "pctweaker", null, null, day), true);
  assert.equal(await evidence.recordLicenseEvent(id, "pctweaker", null, null, day), false);
  assert.equal(await evidence.recordLicenseEvent(id, "pctweaker", "h1", "IT", new Date("2026-11-04T00:30:00Z")), true);
  const { rows } = await getPool().query("SELECT * FROM license_events WHERE user_id = $1", [id]);
  assert.equal(rows.length, 4);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["at", "country", "install_hash", "product", "user_id"], "no IP column");

  await getPool().query("INSERT INTO license_events (user_id, product, at) VALUES ($1, 'pctweaker', $2)", [id, new Date("2025-10-01T00:00:00Z")]);
  await getPool().query("INSERT INTO checkout_consents (id, user_id, product, plan, terms_version, accepted_at) VALUES ('old', $1, 'pctweaker', 'annual', 'x', $2)", [id, new Date("2025-10-01T00:00:00Z")]);
  await getPool().query("INSERT INTO checkout_consents (id, user_id, product, plan, terms_version, accepted_at) VALUES ('kept', $1, 'pctweaker', 'annual', 'x', $2)", [id, new Date("2025-12-10T00:00:00Z")]);
  await evidence.purgeOldEvidence(new Date("2026-11-03T12:00:00Z"));
  assert.equal((await getPool().query("SELECT 1 FROM license_events WHERE user_id = $1", [id])).rowCount, 4);
  assert.deepEqual((await getPool().query("SELECT id FROM checkout_consents WHERE user_id = $1", [id])).rows.map((r) => r.id), ["kept"]);
});

test("buyer address and browser family", () => {
  const req = (ip, headers = {}) => ({ ip, get: (n) => headers[n.toLowerCase()] });
  assert.equal(evidence.buyerIp(req("173.245.48.10", { "cf-connecting-ip": "2001:db8::1" })), "2001:db8::1");
  assert.equal(evidence.buyerIp(req("203.0.113.5", { "cf-connecting-ip": "198.51.100.1" })), "203.0.113.5");
  assert.equal(evidence.buyerIp(req("173.245.48.10", { "cf-connecting-ip": "not-an-ip" })), "173.245.48.10");
  assert.equal(evidence.buyerIp(req("::ffff:203.0.113.5")), "203.0.113.5");
  assert.equal(evidence.buyerIp(req(undefined)), null);
  const ua = {
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0": "Firefox",
    "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36": "Chrome",
    "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 OPR/120.0": "Opera",
    "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15": "Safari",
    "curl/8.0": "Other",
  };
  for (const [agent, family] of Object.entries(ua)) assert.equal(evidence.userAgentFamily(agent), family, agent);
  assert.equal(evidence.userAgentFamily(undefined), null);
  assert.equal(evidence.sessionIdFromUrl("https://checkout.stripe.com/c/pay/cs_live_a1B2c3#fidkdWx"), "cs_live_a1B2c3");
  assert.equal(evidence.sessionIdFromUrl("https://pctweaker.app/"), null);
});

test("the receipt confirms the box in every language, only when it was ticked", () => {
  const input = { product: "pctweaker", firstName: "Ada", email: "ada@example.com", plan: "annual", priceLabel: "€24.99", renewsOn: "1 Nov 2027" };
  for (const locale of LOCALES) {
    const c = copyFor(locale);
    assert.ok(c.receipt.consented.length > 60, locale);
    assert.ok(proWelcomeText({ ...input, consented: true }, c).includes(c.receipt.consented), locale);
    assert.ok(!proWelcomeText(input, c).includes(c.receipt.consented), locale);
    for (const product of ["uninstaller", "pctweaker"]) {
      assert.ok(proWelcomeText({ ...input, product, renewsOn: null, consented: true }, c).includes(c.receipt.consented), `${locale} ${product} lifetime`);
    }
  }
  assert.ok(proWelcomeHtml({ ...input, consented: true }).includes("14-day right of withdrawal"));
});

test("the box's Terms version is the published Terms' date, and the site shows the same", () => {
  const terms = fs.readFileSync(new URL("../../TERMS.md", import.meta.url), "utf8");
  assert.equal(/Last updated: (\d{4}-\d{2}-\d{2})/.exec(terms)?.[1], evidence.PURCHASE_TERMS_VERSION.pctweaker, "TERMS.md changed: bump PURCHASE_TERMS_VERSION here and in the site");
  const site = fs.readFileSync(new URL("../../site/src/purchase-terms.ts", import.meta.url), "utf8");
  for (const [product, version] of Object.entries(evidence.PURCHASE_TERMS_VERSION)) {
    assert.match(site, new RegExp(`${product}: "${version}"`), product);
  }
});
