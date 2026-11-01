// In-app "Manage subscription": the caller's own subscription only, cancel at
// period end (never immediately), idempotent, resume, Lifetime, none, and the
// webhook keeping Pro until the paid period ends. Stripe is a fake: nothing
// here can reach a real subscription.
import test, { after } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "synthetic-subscription-test-secret";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
process.env.STRIPE_PRICE_MONTHLY = "price_pc_monthly_fixture";

const { default: express } = await import("express");
const { getPool, initSchema } = await import("../dist/db.js");
const { signToken } = await import("../dist/auth.js");
const { subscriptionRouter, manageSubscription } = await import("../dist/subscription-manage.js");
const { handleEvent } = await import("../dist/routes/stripe.js");
const { productEntitlement } = await import("../dist/products.js");
await initSchema();

const now = Math.floor(Date.now() / 1000);
const periodEnd = now + 30 * 86_400;
const subs = new Map();
const updates = [];
const fake = {
  async retrieve(id) {
    if (!subs.has(id)) throw Object.assign(new Error("No such subscription"), { statusCode: 404 });
    return structuredClone(subs.get(id));
  },
  async update(id, params) {
    updates.push({ id, params });
    const sub = subs.get(id);
    if ("cancel_at_period_end" in params) {
      sub.cancel_at_period_end = params.cancel_at_period_end;
      sub.cancel_at = params.cancel_at_period_end ? periodEnd : null;
      // Like Stripe: canceled_at is the time of the latest cancel request.
      if (params.cancel_at_period_end) sub.canceled_at = now + updates.length;
    }
    if (params.cancel_at === "") sub.cancel_at = null;
    if (params.cancellation_details) sub.cancellation_details = params.cancellation_details;
    const out = structuredClone(sub);
    if (params.expand?.includes("customer")) out.customer = { id: sub.customer, object: "customer", email: "stripe@example.com", address: { country: "PT" } };
    return out;
  },
  async list({ customer }) {
    return { data: [...subs.values()].filter((sub) => sub.customer === customer).map((sub) => structuredClone(sub)), has_more: false };
  },
};
function sub(id, customer, metadata, overrides = {}) {
  const value = {
    id, customer, created: now, status: "active", cancel_at_period_end: false, cancel_at: null, trial_end: null, metadata,
    default_payment_method: { id: "pm_fixture", card: { brand: "visa", last4: "4242" } },
    items: { data: [{ current_period_end: periodEnd, price: { id: "price_pc_monthly_fixture", unit_amount: 799, currency: "eur", recurring: { interval: "month" } } }] },
    ...overrides,
  };
  subs.set(id, value);
  return value;
}
let n = 0;
async function user(fields = {}) {
  const { rows } = await getPool().query("INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id", [`sub-${++n}@example.com`]);
  const id = String(rows[0].id);
  for (const [column, value] of Object.entries(fields)) await getPool().query(`UPDATE users SET ${column} = $2 WHERE id = $1`, [id, value]);
  return id;
}

const app = express();
app.use(express.json());
app.use("/api/billing/subscription", subscriptionRouter(() => fake));
const server = app.listen(0);
after(() => server.close());
const call = (id, path = "", body) => fetch(`http://127.0.0.1:${server.address().port}/api/billing/subscription${path}`, {
  method: body ? "POST" : "GET",
  headers: { "Content-Type": "application/json", ...(id ? { Authorization: `Bearer ${signToken(Number(id), 0)}` } : {}) },
  body: body && JSON.stringify(body),
});

test("own PC Tweaker subscription: read, cancel at period end twice, resume twice", async () => {
  const a = await user({ stripe_customer_id: "cus_a", is_pro: true, plan: "monthly", pro_expires_at: new Date(periodEnd * 1000) });
  sub("sub_a", "cus_a", { userId: a, product: "pctweaker", plan: "monthly" });
  await getPool().query("UPDATE users SET stripe_subscription_id = 'sub_a' WHERE id = $1", [a]);

  const read = await (await call(a, "?product=pctweaker")).json();
  assert.deepEqual(read, {
    product: "pctweaker", plan: "monthly", interval: "month", amount: 799, currency: "eur", status: "active",
    trial_end: null, current_period_end: new Date(periodEnd * 1000).toISOString(), cancel_at_period_end: false, cancel_at: null,
    payment_method: { brand: "visa", last4: "4242" }, lifetime: false, can_cancel: true, can_resume: false,
  });

  updates.length = 0;
  const first = await call(a, "/cancel", { product: "pctweaker" });
  assert.equal(first.status, 200);
  const cancelled = await first.json();
  assert.equal(cancelled.cancel_at_period_end, true);
  assert.equal(cancelled.status, "active", "never an immediate cancellation");
  assert.equal(cancelled.current_period_end, read.current_period_end);
  assert.equal(cancelled.can_resume, true);
  assert.deepEqual((await call(a, "/cancel", { product: "pctweaker" }).then((r) => r.json())).cancel_at_period_end, true);
  assert.equal(updates.length, 1, "cancelling twice changes Stripe once");
  assert.equal(updates[0].params.cancel_at_period_end, true);
  assert.equal((await getPool().query("SELECT cancel_at_period_end FROM users WHERE id = $1", [a])).rows[0].cancel_at_period_end, true);

  const resumed = await (await call(a, "/resume", { product: "pctweaker" })).json();
  assert.equal(resumed.cancel_at_period_end, false);
  assert.equal(resumed.can_cancel, true);
  await call(a, "/resume", { product: "pctweaker" });
  assert.equal(updates.length, 2, "resuming twice changes Stripe once");
  assert.equal((await getPool().query("SELECT cancel_at_period_end FROM users WHERE id = $1", [a])).rows[0].cancel_at_period_end, false);
});

test("another account's subscription is unreachable: 404, nothing changed", async () => {
  const owner = await user({ stripe_customer_id: "cus_owner" });
  sub("sub_owner", "cus_owner", { userId: owner, product: "pctweaker" });
  // Even a stored id pointing at someone else's subscription is refused.
  const intruder = await user({ stripe_subscription_id: "sub_owner" });
  updates.length = 0;
  const res = await call(intruder, "/cancel", { product: "pctweaker" });
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "no_subscription" });
  assert.equal((await (await call(intruder, "?product=pctweaker")).json()).status, "none");
  assert.equal(updates.length, 0);
  assert.equal(subs.get("sub_owner").cancel_at_period_end, false);
});

test("no subscription, Lifetime, bad input", async () => {
  const none = await user();
  assert.equal((await (await call(none, "?product=uninstaller")).json()).status, "none");
  assert.equal((await call(none, "/resume", { product: "uninstaller" })).status, 404);

  const lifetime = await user({ is_pro: true, plan: "lifetime", stripe_customer_id: "cus_life" });
  sub("sub_leftover", "cus_life", { userId: lifetime, product: "pctweaker" }, { cancel_at_period_end: true });
  const view = await (await call(lifetime, "?product=pctweaker")).json();
  assert.equal(view.lifetime, true);
  assert.equal(view.status, "lifetime");
  assert.equal(view.can_cancel, false);
  const refused = await call(lifetime, "/cancel", { product: "pctweaker" });
  assert.equal(refused.status, 409);
  assert.deepEqual(await refused.json(), { error: "lifetime" });

  assert.equal((await call(none, "?product=redaxa")).status, 400);
  assert.equal((await call(none, "/cancel", {})).status, 400);
  assert.equal((await call(null, "?product=pctweaker")).status, 401);
});

test("Uninstaller: stored subscription, resume clears a cancel_at date too", async () => {
  const u = await user();
  sub("sub_unin", "cus_unin", { userId: u, product: "uninstaller" }, { cancel_at: periodEnd });
  await getPool().query("INSERT INTO entitlements (user_id, product, plan, expires_at, stripe_subscription_id) VALUES ($1, 'uninstaller', 'annual', $2, 'sub_unin')", [u, new Date(periodEnd * 1000)]);
  const view = await (await call(u, "?product=uninstaller")).json();
  assert.equal(view.can_resume, true);
  updates.length = 0;
  const resumed = await (await call(u, "/resume", { product: "uninstaller" })).json();
  assert.deepEqual(updates[0].params.cancel_at, "");
  assert.equal(resumed.cancel_at, null);
});

test("Tweaky Driver: its own billing row, only this account's tweaky-driver subscription", async () => {
  const t = await user();
  const other = await user();
  await getPool().query(`CREATE TABLE IF NOT EXISTS dc_billing_accounts (billing_mode TEXT, store_scope TEXT, user_id BIGINT, customer_id TEXT,
    lifetime_granted_at TIMESTAMPTZ, lifetime_revoked_at TIMESTAMPTZ)`);
  await getPool().query("INSERT INTO dc_billing_accounts VALUES ('test', 'pc-tweaker-shared', $1, 'cus_td', NULL, NULL)", [t]);
  const tweakyMeta = (id) => ({ product: "tweaky-driver", accountScope: "pc-tweaker-shared", accountUserId: id });
  sub("sub_td_other", "cus_td", tweakyMeta(other), { created: now + 5 });
  sub("sub_pc_same_customer", "cus_td", { userId: t, product: "pctweaker" }, { created: now + 9 });
  sub("sub_td", "cus_td", tweakyMeta(t), { items: { data: [{ current_period_end: periodEnd, price: { unit_amount: 1599, currency: "eur", recurring: { interval: "year" } } }] } });
  const db = { query: (sql, params) => (sql.includes("to_regclass") ? { rows: [{ name: "dc_billing_accounts" }] } : getPool().query(sql, params)) };

  const view = await manageSubscription(db, fake, t, "tweaky", "get", "test");
  assert.equal(view.plan, "annual");
  assert.equal(view.amount, 1599);
  const cancelled = await manageSubscription(db, fake, t, "tweaky", "cancel", "test");
  assert.equal(cancelled.cancel_at_period_end, true);
  assert.equal(subs.get("sub_td").cancel_at_period_end, true);
  assert.equal(subs.get("sub_td_other").cancel_at_period_end, false);
  assert.equal(subs.get("sub_pc_same_customer").cancel_at_period_end, false);

  assert.equal((await manageSubscription(db, fake, t, "tweaky", "get", "live")).status, "none", "the live row is a different row");
  await getPool().query("INSERT INTO dc_billing_accounts VALUES ('test', 'pc-tweaker-shared', $1, NULL, now(), NULL)", [other]);
  assert.equal((await manageSubscription(db, fake, other, "tweaky", "get", "test")).lifetime, true);
  const absent = { query: (sql, params) => (sql.includes("to_regclass") ? { rows: [{ name: null }] } : getPool().query(sql, params)) };
  assert.equal((await manageSubscription(absent, fake, t, "tweaky", "get", "test")).status, "none");
});

test("a subscription set to cancel keeps Pro until the paid period ends", async () => {
  const id = await user({ stripe_customer_id: "cus_hook" });
  const value = sub("sub_hook", "cus_hook", { userId: id, product: "pctweaker", plan: "monthly" }, { cancel_at_period_end: true, cancel_at: periodEnd });
  const fx = {
    async loadSubscription() { return value; }, async stopSubscriptions() {}, async welcome() {},
    async loadCheckout() { throw new Error("unexpected"); }, async loadCheckoutForPayment() { return null; },
    async loadSubscriptionForPayment() { return null; }, alertReversal() {}, async queueRefundNotice() {},
  };
  await handleEvent({ id: "evt_cancel_flag", type: "customer.subscription.updated", data: { object: value } }, fx);
  const entitlement = await productEntitlement(id, "pctweaker");
  assert.equal(entitlement.active, true);
  assert.equal(entitlement.cancelAtPeriodEnd, true);
  assert.equal(entitlement.expiresAt, new Date(periodEnd * 1000).toISOString());
});

const notices = async (subId) => (await getPool().query("SELECT notice_key, payload FROM owner_notices WHERE notice_key LIKE $1 ORDER BY notice_key", [`cancel:${subId}:%`])).rows;
async function subscriber(id) {
  const u = await user({ stripe_customer_id: `cus_${id}` });
  sub(`sub_${id}`, `cus_${id}`, { userId: u, product: "pctweaker", plan: "monthly" });
  await getPool().query("UPDATE users SET stripe_subscription_id = $2 WHERE id = $1", [u, `sub_${id}`]);
  return u;
}

test("cancellation reasons: each of Stripe's codes is stored and named in the owner's notice", async () => {
  const labels = {
    too_expensive: "Too expensive", unused: "I don't use it enough", missing_features: "Missing a feature I need",
    switched_service: "Switching to another tool", low_quality: "Technical problems / bugs", too_complex: "Too complicated to use",
    customer_service: "Problems with support", other: "Other",
  };
  for (const [reason, label] of Object.entries(labels)) {
    const u = await subscriber(`reason_${reason}`);
    const res = await call(u, "/cancel", { product: "pctweaker", reason });
    assert.equal(res.status, 200, reason);
    assert.equal((await res.json()).cancel_at_period_end, true);
    assert.deepEqual(subs.get(`sub_reason_${reason}`).cancellation_details, { feedback: reason });
    const [notice] = await notices(`sub_reason_${reason}`);
    assert.ok(notice.payload.text.includes(`Reason: ${label}`), notice.payload.text);
  }
});

test("Other with a comment: trimmed, control characters out, subject and facts for the owner", async () => {
  const u = await subscriber("other_comment");
  const email = (await getPool().query("SELECT email FROM users WHERE id = $1", [u])).rows[0].email;
  await call(u, "/cancel", { product: "pctweaker", reason: "other", comment: "  I only needed it\u0007 once.\r\nThanks!\u0000  " });
  assert.deepEqual(subs.get("sub_other_comment").cancellation_details, { feedback: "other", comment: "I only needed it once.\nThanks!" });
  const [{ payload }] = await notices("sub_other_comment");
  const ends = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", dateStyle: "medium" }).format(new Date(periodEnd * 1000));
  const { orderId } = await import("../dist/owner-sales.js");
  assert.equal(payload.subject, `Cancellation scheduled · PC Tweaker Pro — Monthly · ends ${ends} · ${orderId("sub_other_comment")}`);
  for (const fact of ["Product: PC Tweaker Pro", "Plan: Monthly · €7.99 / month", `Customer: ${email}`, "Country: PT",
    `Access until: ${ends}`, "Reason: Other", "Comment: I only needed it once.\nThanks!", "https://dashboard.stripe.com/test/subscriptions/sub_other_comment"]) {
    assert.ok(payload.text.includes(fact), `missing "${fact}" in\n${payload.text}`);
  }
  // A 500-character comment is accepted.
  const v = await subscriber("comment_500");
  assert.equal((await call(v, "/cancel", { product: "pctweaker", reason: "unused", comment: "é".repeat(500) })).status, 200);
});

test("refused before Stripe: comment over 500 characters, unknown reason, a non-text comment", async () => {
  const u = await subscriber("refused");
  updates.length = 0;
  for (const [body, error] of [
    [{ reason: "other", comment: "x".repeat(501) }, "comment_too_long"],
    [{ reason: "fraud" }, "invalid_reason"],
    [{ reason: "__proto__" }, "invalid_reason"],
    [{ reason: 3 }, "invalid_reason"],
    [{ reason: "unused", comment: { text: "hi" } }, "invalid_comment"],
  ]) {
    const res = await call(u, "/cancel", { product: "pctweaker", ...body });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.deepEqual(await res.json(), { error });
  }
  assert.equal(updates.length, 0);
  assert.equal(subs.get("sub_refused").cancel_at_period_end, false);
  assert.equal((await notices("sub_refused")).length, 0);
});

test("no reason: cancels as before, nothing sent as cancellation_details, notice says Not given", async () => {
  const u = await subscriber("no_reason");
  updates.length = 0;
  assert.equal((await call(u, "/cancel", { product: "pctweaker", reason: null, comment: "   " })).status, 200);
  assert.equal("cancellation_details" in updates[0].params, false);
  const [{ payload }] = await notices("sub_no_reason");
  assert.ok(payload.text.includes("Reason: Not given") && !payload.text.includes("Comment:"));
});

test("one owner notice per cancellation: twice is one, resume sends none, cancel again is a new one", async () => {
  const u = await subscriber("idem");
  await call(u, "/cancel", { product: "pctweaker", reason: "too_expensive" });
  await call(u, "/cancel", { product: "pctweaker", reason: "unused" });
  assert.equal((await notices("sub_idem")).length, 1);
  assert.deepEqual(subs.get("sub_idem").cancellation_details, { feedback: "too_expensive" }, "an already-ending subscription is not rewritten");
  await call(u, "/resume", { product: "pctweaker" });
  assert.equal((await notices("sub_idem")).length, 1, "resuming sends nothing");
  await call(u, "/cancel", { product: "pctweaker" });
  assert.equal((await notices("sub_idem")).length, 2);
});
