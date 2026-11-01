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
    }
    if (params.cancel_at === "") sub.cancel_at = null;
    return structuredClone(sub);
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
