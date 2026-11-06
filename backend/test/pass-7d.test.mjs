// The 7-day Pro pass (owner decision 4 Nov 2026): €4.99 once, no renewal.
// Nothing here reaches Stripe: every session, charge and Price is a fixture.
import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.EMAIL_SINK = "1";
process.env.JWT_SECRET = "synthetic-pass-test-not-a-production-secret";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.CHECKOUT_CONSENT_REQUIRED;
delete process.env.PASS_7D_ENABLED;
process.env.STRIPE_PRICE_MONTHLY = "price_pc_monthly_fixture";
process.env.STRIPE_PRICE_ANNUAL = "price_pc_annual_fixture";
process.env.STRIPE_PRICE_LIFETIME = "price_pc_lifetime_fixture";
process.env.STRIPE_PRICE_PASS_7D = "price_pc_pass_fixture";

const { getPool, initSchema } = await import("../dist/db.js");
const { grantPro, revokePro, handleEvent, createCheckoutHandler, publicPass, publicPrices } = await import("../dist/routes/stripe.js");
const { productEntitlement, hasAnyActiveEntitlement } = await import("../dist/products.js");
const { passEnd, grantPass, PASS_PLAN } = await import("../dist/pass.js");
const evidence = await import("../dist/purchase-evidence.js");
await initSchema();

const DAY = 86_400_000;
const WEEK = 7 * DAY;
let sequence = 0;
async function user() {
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash, email_verified) VALUES ($1, 'fixture', TRUE) RETURNING id",
    [`pass-${++sequence}@example.com`],
  );
  return String(rows[0].id);
}
const passEnds = async (id) => {
  const { rows } = await getPool().query("SELECT pass_expires_at FROM users WHERE id = $1", [id]);
  return rows[0].pass_expires_at ? new Date(rows[0].pass_expires_at).getTime() : null;
};
const userRow = async (id) => (await getPool().query("SELECT is_pro, plan, pro_expires_at FROM users WHERE id = $1", [id])).rows[0];
const passSession = (userId, id = `cs_pass_${++sequence}`) => ({
  id, created: Math.floor(Date.now() / 1000), client_reference_id: userId, customer: `cus_${userId}`,
  mode: "payment", payment_status: "paid", amount_total: 499, currency: "eur",
  metadata: { userId, product: "pctweaker", plan: "pass_7d" },
  line_items: { data: [{ price: { id: process.env.STRIPE_PRICE_PASS_7D } }] },
});
function effects(session = null, overrides = {}) {
  const welcomes = [];
  const notices = [];
  return {
    welcomes, notices,
    async loadCheckout() { throw new Error("Unexpected Stripe read in fixture"); },
    async loadSubscription() { throw new Error("Unexpected subscription read in fixture"); },
    async stopSubscriptions() { throw new Error("A pass must never stop a subscription"); },
    async welcome(...args) { welcomes.push(args); },
    async loadCheckoutForPayment() { return session; },
    async loadSubscriptionForPayment() { return null; },
    alertReversal() {},
    async queueRefundNotice(key, receipt) { notices.push([key, receipt]); },
    ...overrides,
  };
}
const event = (type, object, id = `evt_${++sequence}`) => ({ id, type, data: { object } });
const charge = (id, overrides = {}) => ({ object: "charge", id, payment_intent: `pi_${id}`, amount: 499, amount_refunded: 499, currency: "eur", refunded: true, ...overrides });
const dispute = (id, status) => ({ object: "dispute", id, charge: `ch_${id}`, payment_intent: `pi_${id}`, status });

test("passes replay in grant order: a pass bought while another runs starts where it ends", () => {
  const t = Date.parse("2026-11-04T10:00:00Z");
  assert.equal(passEnd([]), null);
  assert.equal(passEnd([{ days: 7, granted_at: new Date(t) }]).getTime(), t + WEEK);
  assert.equal(passEnd([{ days: 7, granted_at: new Date(t) }, { days: 7, granted_at: new Date(t + DAY) }]).getTime(), t + 2 * WEEK);
  // The first had ended: the second starts at its own payment, not in the past.
  assert.equal(passEnd([{ days: 7, granted_at: new Date(t) }, { days: 7, granted_at: new Date(t + 10 * DAY) }]).getTime(), t + 17 * DAY);
});

test("a paid pass grants Pro for 7 days from server time, once per Checkout whatever Stripe replays", async () => {
  const id = await user();
  const session = passSession(id);
  const fx = effects();
  const before = Date.now();
  await handleEvent(event("checkout.session.completed", session), fx);
  const end = await passEnds(id);
  assert.ok(end >= before + WEEK && end <= Date.now() + WEEK, "7 days from the grant");
  const entitlement = await productEntitlement(id, "pctweaker");
  assert.equal(entitlement.active, true);
  assert.equal(entitlement.plan, PASS_PLAN);
  assert.equal(entitlement.expiresAt, new Date(end).toISOString());
  assert.deepEqual((await userRow(id)), { is_pro: false, plan: null, pro_expires_at: null }, "the subscription columns are untouched");

  await handleEvent(event("checkout.session.completed", session), fx); // retried delivery, new event id
  await handleEvent(event("checkout.session.async_payment_succeeded", session), fx);
  await handleEvent(event("checkout.session.completed", session, "evt_same"), fx);
  await handleEvent(event("checkout.session.completed", session, "evt_same"), fx);
  assert.equal(await passEnds(id), end, "replays add nothing");
  assert.equal(fx.welcomes.length, 1, "one receipt");
  const [userId, plan, until, product, , key] = fx.welcomes[0];
  assert.deepEqual([userId, plan, until.getTime(), product, key], [id, "pass_7d", end, "pctweaker", `checkout:${session.id}`]);

  // An unpaid (delayed) payment grants nothing until it succeeds.
  const later = passSession(id);
  await handleEvent(event("checkout.session.completed", { ...later, payment_status: "unpaid" }), fx);
  assert.equal(await passEnds(id), end);
});

test("a second pass extends from the current expiry, and a lapsed one is not stacked on", async () => {
  const id = await user();
  const fx = effects();
  await handleEvent(event("checkout.session.completed", passSession(id)), fx);
  const first = await passEnds(id);
  await handleEvent(event("checkout.session.completed", passSession(id)), fx);
  assert.equal(await passEnds(id), first + WEEK);
  assert.equal(fx.welcomes[1][2].getTime(), first + WEEK, "the receipt quotes the new end");

  const lapsed = await user();
  await grantPass(lapsed, "cs_lapsed_old", new Date(Date.now() - 10 * DAY));
  assert.equal((await productEntitlement(lapsed, "pctweaker")).active, false, "an ended pass grants nothing");
  const before = Date.now();
  await handleEvent(event("checkout.session.completed", passSession(lapsed)), fx);
  assert.ok(await passEnds(lapsed) >= before + WEEK);
});

test("a pass never changes a subscription or Lifetime, and takes over only when they stop granting", async () => {
  const fx = effects();
  const lifetime = await user();
  await grantPro(lifetime, { customerId: `cus_${lifetime}`, plan: "lifetime", expiresAt: null });
  await handleEvent(event("checkout.session.completed", passSession(lifetime)), fx);
  assert.deepEqual(await userRow(lifetime), { is_pro: true, plan: "lifetime", pro_expires_at: null });
  const owned = await productEntitlement(lifetime, "pctweaker");
  assert.deepEqual([owned.active, owned.plan, owned.expiresAt], [true, "lifetime", null]);

  const subscriber = await user();
  const renews = new Date(Date.now() + 30 * DAY);
  await grantPro(subscriber, { customerId: `cus_${subscriber}`, plan: "monthly", expiresAt: renews, subscriptionId: "sub_pass_fixture", subscriptionCreatedAt: new Date() });
  const passSessionForSubscriber = passSession(subscriber);
  await handleEvent(event("checkout.session.completed", passSessionForSubscriber), fx);
  const row = await userRow(subscriber);
  assert.deepEqual([row.is_pro, row.plan, new Date(row.pro_expires_at).getTime()], [true, "monthly", renews.getTime()]);
  assert.equal((await productEntitlement(subscriber, "pctweaker")).plan, "monthly");
  // The subscription ends: the pass days still run, underneath until now.
  await revokePro(subscriber, "sub_pass_fixture");
  const after = await productEntitlement(subscriber, "pctweaker");
  assert.deepEqual([after.active, after.plan], [true, "pass_7d"]);
  // And refunding the pass leaves the subscription columns alone.
  await handleEvent(event("charge.refunded", charge("ch_sub_pass")), effects(passSessionForSubscriber));
  assert.equal((await productEntitlement(subscriber, "pctweaker")).active, false);
  assert.equal((await userRow(lifetime)).plan, "lifetime");

  // No loyalty price from a pass.
  const holder = await user();
  await handleEvent(event("checkout.session.completed", passSession(holder)), fx);
  assert.equal(await hasAnyActiveEntitlement(holder), false);
  assert.equal(await hasAnyActiveEntitlement(lifetime), true);
});

test("refunds and disputes treat a pass like Lifetime: a full refund or a lost dispute removes only its days", async () => {
  const id = await user();
  const first = passSession(id);
  const second = passSession(id);
  const fx = effects();
  await handleEvent(event("checkout.session.completed", first), fx);
  const firstEnd = await passEnds(id);
  await handleEvent(event("checkout.session.completed", second), fx);
  assert.equal(await passEnds(id), firstEnd + WEEK);

  await handleEvent(event("charge.refunded", charge("ch_partial_pass", { refunded: false, amount_refunded: 100 })), effects(first));
  await handleEvent(event("charge.dispute.created", dispute("dp_open_pass", "needs_response")), effects(first));
  await handleEvent(event("charge.dispute.closed", dispute("dp_won_pass", "won")), effects(first));
  assert.equal(await passEnds(id), firstEnd + WEEK, "partial refund, open or won dispute: unchanged");

  const reversal = effects(first);
  await handleEvent(event("charge.refunded", charge("ch_full_pass")), reversal);
  const remaining = await passEnds(id);
  assert.ok(remaining <= Date.now() + WEEK && remaining > Date.now() + WEEK - 60_000, "the other pass moves up to now");
  assert.deepEqual(reversal.notices.map(([key, r]) => [key, r.kind, r.plan, r.product]), [["refund:ch_full_pass", "refund", "pass_7d", "pctweaker"]]);
  await handleEvent(event("charge.refunded", charge("ch_full_pass")), effects(first));
  assert.equal(await passEnds(id), remaining, "a replayed refund changes nothing");

  await handleEvent(event("charge.dispute.closed", dispute("dp_lost_pass", "lost")), effects(second));
  assert.equal(await passEnds(id), null);
  assert.equal((await productEntitlement(id, "pctweaker")).active, false);
  await handleEvent(event("checkout.session.completed", second), fx);
  assert.equal(await passEnds(id), null, "a reversed pass is never granted again");
});

test("a refund that arrives before its checkout event blocks the late grant", async () => {
  const id = await user();
  const session = passSession(id);
  await handleEvent(event("charge.refunded", charge("ch_early_pass")), effects(session));
  const fx = effects();
  await handleEvent(event("checkout.session.completed", session), fx);
  assert.equal(await passEnds(id), null);
  assert.equal(fx.welcomes.length, 0);
});

// ---------------------------------------------------------------- checkout

const base = {
  JWT_SECRET: process.env.JWT_SECRET,
  STRIPE_SECRET_KEY: "sk_test_synthetic_fixture_only",
  STRIPE_PRICE_LIFETIME: "price_lifetime_fixture",
  STRIPE_PRICE_MONTHLY: "price_monthly_fixture",
  STRIPE_PRICE_ANNUAL: "price_annual_fixture",
  STRIPE_PRICE_PASS_7D: "price_pass_fixture",
  CHECKOUT_SUCCESS_URL: "https://example.com/success",
  CHECKOUT_CANCEL_URL: "https://example.com/cancel",
};
const on = { ...base, PASS_7D_ENABLED: "1" };
const response = () => ({ statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });
async function checkout(environment, body, userId) {
  const calls = [];
  const handler = createCheckoutHandler({
    environment, now: () => Date.parse("2026-11-10T12:00:00Z"),
    async createSession(params, key) { calls.push({ params, key }); return { url: "https://checkout.stripe.com/c/pay/cs_test_pass#fid", id: "cs_test_pass" }; },
    async cryptoQuote() { return null; },
    async buyerCountry() { return null; },
  });
  const res = response();
  const id = userId ?? await user();
  await handler({ userId: Number(id), body, ip: "203.0.113.9", headers: {}, get: () => undefined }, res);
  return { res, calls, userId: id };
}

test("switched off, or without its Price, the pass cannot be bought and is not shown", async () => {
  for (const environment of [base, { ...on, STRIPE_PRICE_PASS_7D: "" }, { ...base, PASS_7D_ENABLED: "true" }]) {
    const { res, calls } = await checkout(environment, { plan: "pass_7d" });
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.code, "pass_unavailable");
    assert.equal(calls.length, 0);
  }
  const read = async () => ({ active: true, unit_amount: 499, currency: "eur", recurring: null, tax_behavior: "unspecified" });
  assert.equal(await publicPass(base, read), null);
  assert.equal((await publicPrices(base, null)).pass, null);
  assert.deepEqual(await publicPass(on, read), { plan: "pass_7d", days: 7, amount: 499, currency: "eur", tax_behavior: "unspecified" });
  assert.equal(await publicPass({ ...on, STRIPE_PRICE_PASS_7D: "price_pass_recurring_fixture" }, async () => ({ active: true, unit_amount: 499, currency: "eur", recurring: { interval: "week" } })), null);
  // The other plans check out exactly as before with the switch off.
  const annual = await checkout(base, { plan: "annual" });
  assert.equal(annual.res.statusCode, 200);
  assert.equal(annual.calls[0].params.mode, "subscription");
});

test("switched on: a one-off payment for PC Tweaker, never on top of a plan or Lifetime, stackable on a pass", async () => {
  const bought = await checkout(on, { plan: "pass_7d" });
  assert.equal(bought.res.statusCode, 200);
  const params = bought.calls[0].params;
  assert.equal(params.mode, "payment");
  assert.deepEqual(params.line_items, [{ price: "price_pass_fixture", quantity: 1 }]);
  assert.equal(params.metadata.plan, "pass_7d");
  assert.equal(params.metadata.product, "pctweaker");
  assert.equal(params.payment_intent_data.metadata.plan, "pass_7d");
  assert.equal(params.subscription_data, undefined);

  for (const body of [{ plan: "pass_7d", start_trial: true }, { plan: "pass_7d", product: "uninstaller" }]) {
    const { res, calls } = await checkout(on, body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(calls.length, 0);
  }

  const lifetime = await user();
  await grantPro(lifetime, { customerId: `cus_${lifetime}`, plan: "lifetime", expiresAt: null });
  const subscriber = await user();
  await grantPro(subscriber, { customerId: `cus_${subscriber}`, plan: "annual", expiresAt: new Date(Date.now() + 300 * DAY) });
  for (const id of [lifetime, subscriber]) {
    const { res, calls } = await checkout(on, { plan: "pass_7d" }, id);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, "already_has_access");
    assert.equal(calls.length, 0);
  }

  const holder = await user();
  await grantPass(holder, "cs_holder_first");
  const again = await checkout(on, { plan: "pass_7d" }, holder);
  assert.equal(again.res.statusCode, 200, "a pass holder can add 7 days");
  const upgrade = await checkout(on, { plan: "annual" }, holder);
  assert.equal(upgrade.res.statusCode, 200, "or buy a plan");
});

test("the Terms box: the pass takes the current box, and the one before it (whose Terms already name the pass)", async () => {
  const required = { ...on, CHECKOUT_CONSENT_REQUIRED: "1" };
  const current = evidence.PURCHASE_TERMS_VERSION.pctweaker;
  const previous = evidence.PREVIOUS_TERMS_VERSION.pctweaker;
  assert.notEqual(current, previous);
  const stale = await checkout(required, { plan: "pass_7d", consent: { accepted: true, terms_version: previous } });
  assert.equal(stale.res.statusCode, 200);
  assert.equal(stale.calls[0].params.metadata.terms_version, previous);
  const outdated = await checkout(required, { plan: "pass_7d", consent: { accepted: true, terms_version: "2026-11-04" } });
  assert.equal(outdated.res.statusCode, 409, "the box before the pass Terms is no longer accepted");
  assert.equal(outdated.res.body.code, "terms_changed");
  assert.equal(outdated.calls.length, 0);
  const ticked = await checkout(required, { plan: "pass_7d", consent: { accepted: true, terms_version: current } });
  assert.equal(ticked.res.statusCode, 200);
  assert.equal(ticked.calls[0].params.metadata.terms_version, current);
  const older = await checkout(required, { plan: "annual", consent: { accepted: true, terms_version: previous } });
  assert.equal(older.res.statusCode, 200);
  assert.equal(older.calls[0].params.metadata.terms_version, previous, "the row records the box that was ticked");
});
