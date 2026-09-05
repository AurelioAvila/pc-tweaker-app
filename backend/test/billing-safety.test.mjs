import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
process.env.STRIPE_PRICE_MONTHLY = "price_pc_monthly_fixture";
process.env.STRIPE_PRICE_ANNUAL = "price_pc_annual_fixture";
process.env.STRIPE_PRICE_LIFETIME = "price_pc_lifetime_fixture";
process.env.STRIPE_PRICE_ID = "price_pc_legacy_fixture";
process.env.STRIPE_PRICE_UNINSTALLER_ANNUAL = "price_uninstaller_fixture";
process.env.STRIPE_PRICE_UNINSTALLER_LOYALTY = "price_uninstaller_loyalty_fixture";

const { getPool, initSchema } = await import("../dist/db.js");
const { grantPro, revokePro, handleEvent, stopSubscriptionsAfterLifetime } = await import("../dist/routes/stripe.js");
const { productEntitlement } = await import("../dist/products.js");
const { billingProductFromEvidence } = await import("../dist/stripe-policy.js");
await initSchema();

const created = Math.floor(Date.now() / 1000);
const periodEnd = created + 30 * 86_400;
let sequence = 0;
const currentSubscriptions = new Map();
async function user() {
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash) VALUES ($1, 'fixture') RETURNING id",
    [`billing-${++sequence}@example.com`],
  );
  return String(rows[0].id);
}
async function row(id) {
  const { rows } = await getPool().query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0];
}
function checkout(userId, plan = "monthly", overrides = {}) {
  return {
    id: `cs_fixture_${sequence}`,
    created,
    client_reference_id: userId,
    customer: `cus_fixture_${userId}`,
    mode: plan === "lifetime" ? "payment" : "subscription",
    subscription: plan === "lifetime" ? null : subscription(userId).id,
    payment_status: "paid",
    metadata: { userId, product: "pctweaker", plan },
    ...overrides,
  };
}
function subscription(userId, overrides = {}) {
  const value = {
    id: `sub_fixture_${sequence}`,
    created,
    customer: `cus_fixture_${userId}`,
    status: "active",
    cancel_at_period_end: false,
    metadata: { userId, product: "pctweaker", plan: "monthly" },
    items: { data: [{ current_period_end: periodEnd, price: { id: process.env.STRIPE_PRICE_MONTHLY, recurring: { interval: "month" } } }] },
    ...overrides,
  };
  currentSubscriptions.set(value.id, value);
  return value;
}
function effects(overrides = {}) {
  return {
    async loadCheckout() { throw new Error("Unexpected Stripe read in fixture"); },
    async loadSubscription(id) {
      assert.ok(currentSubscriptions.has(id), `Missing current subscription fixture: ${id}`);
      return currentSubscriptions.get(id);
    },
    async stopSubscriptions() {},
    async welcome() {},
    notifySale() {},
    ...overrides,
  };
}
function event(type, object) {
  return { id: `evt_fixture_${sequence}`, type, data: { object } };
}

test("an old recurring checkout cannot downgrade a lifetime purchase", async () => {
  const id = await user();
  const sideEffects = effects();
  await handleEvent(event("checkout.session.completed", checkout(id, "lifetime")), sideEffects);
  await handleEvent(event("checkout.session.completed", checkout(id)), sideEffects);
  const result = await row(id);
  assert.equal(result.is_pro, true);
  assert.equal(result.plan, "lifetime");
  assert.equal(result.pro_expires_at, null);
});

test("subscription updates and deletion preserve lifetime independently of event order", async () => {
  const id = await user();
  await grantPro(id, { customerId: `cus_fixture_${id}`, plan: "lifetime", expiresAt: null });
  for (const type of ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]) {
    await handleEvent(event(type, subscription(id)), effects());
    assert.equal((await row(id)).plan, "lifetime");
    assert.equal((await productEntitlement(id, "pctweaker")).active, true);
  }
});

test("SQL guards protect lifetime even if the handler's earlier read was stale", async () => {
  const id = await user();
  await grantPro(id, { customerId: null, plan: "lifetime", expiresAt: null });
  await grantPro(id, { customerId: null, plan: "annual", expiresAt: new Date(periodEnd * 1000) });
  await revokePro(id);
  assert.equal((await row(id)).plan, "lifetime");
  assert.equal((await productEntitlement(id, "pctweaker")).active, true);
});

test("lifetime conversion cancels only this user's PC Tweaker subscriptions across pages", async () => {
  const id = await user();
  const pc = (name, extra = {}) => subscription(id, { id: name, ...extra });
  const otherPrice = { data: [{ price: { id: process.env.STRIPE_PRICE_UNINSTALLER_ANNUAL } }] };
  const pages = [
    { data: [
      pc("sub_active"),
      pc("sub_uninstaller", { metadata: { userId: id, product: "uninstaller", plan: "annual" }, items: otherPrice }),
      pc("sub_unknown_legacy", { metadata: {}, items: { data: [{ price: { id: "price_unrelated" } }] } }),
      pc("sub_conflict", { items: otherPrice }),
      pc("sub_other_user", { metadata: { product: "pctweaker", userId: "another-user" } }),
      pc("sub_already_cancelled", { cancel_at_period_end: true }),
      pc("sub_ended", { status: "canceled" }),
    ], has_more: true },
    { data: [
      pc("sub_trial", { status: "trialing" }),
      pc("sub_past_due", { status: "past_due" }),
      pc("sub_unpaid", { status: "unpaid" }),
      pc("sub_recognized_legacy", { metadata: {} }),
    ], has_more: false },
  ];
  const updated = [];
  const calls = [];
  await stopSubscriptionsAfterLifetime(id, `cus_fixture_${id}`, {
    async list(params) { calls.push(params); return pages[calls.length - 1]; },
    async update(subscriptionId, params) { updated.push(subscriptionId); assert.deepEqual(params, { cancel_at_period_end: true }); },
  });
  assert.deepEqual(updated, ["sub_active", "sub_trial", "sub_past_due", "sub_unpaid", "sub_recognized_legacy"]);
  assert.equal(calls[0].status, "all");
  assert.equal(calls[0].limit, 100);
  assert.equal(calls[1].starting_after, "sub_ended");
});

test("failed lifetime cancellation is retryable and cannot remove the committed grant", async () => {
  const id = await user();
  await assert.rejects(
    handleEvent(event("checkout.session.completed", checkout(id, "lifetime")), effects({
      async stopSubscriptions() { throw new Error("Fixture Stripe outage"); },
    })),
    /Fixture Stripe outage/,
  );
  assert.equal((await productEntitlement(id, "pctweaker")).active, true);
  await handleEvent(event("checkout.session.completed", checkout(id, "lifetime")), effects());
  assert.equal((await row(id)).plan, "lifetime");
});

test("cancellation helper propagates update errors instead of acknowledging success", async () => {
  const id = await user();
  await assert.rejects(stopSubscriptionsAfterLifetime(id, `cus_fixture_${id}`, {
    async list() { return { data: [subscription(id)], has_more: false }; },
    async update() { throw new Error("Fixture cancellation failure"); },
  }), /Fixture cancellation failure/);
});

test("uninstaller and unknown legacy events never grant or revoke PC Tweaker", async () => {
  const id = await user();
  const uninstaller = subscription(id, {
    metadata: { userId: id, plan: "annual" },
    items: { data: [{ current_period_end: periodEnd, price: { id: process.env.STRIPE_PRICE_UNINSTALLER_ANNUAL, recurring: { interval: "year" } } }] },
  });
  await handleEvent(event("customer.subscription.created", uninstaller), effects());
  assert.equal((await productEntitlement(id, "uninstaller")).active, true);
  assert.equal((await productEntitlement(id, "pctweaker")).active, false);
  await grantPro(id, { customerId: `cus_fixture_${id}`, plan: "annual", expiresAt: new Date(periodEnd * 1000) });
  await handleEvent(event("customer.subscription.deleted", uninstaller), effects());
  assert.equal((await productEntitlement(id, "pctweaker")).active, true);
  const unknown = subscription(id, { metadata: { userId: id }, items: { data: [{ price: { id: "price_other" } }] } });
  await handleEvent(event("customer.subscription.deleted", unknown), effects());
  assert.equal((await productEntitlement(id, "pctweaker")).active, true);
});

test("product evidence rejects conflicting or ambiguous subscriptions", () => {
  const catalogue = { price_pc: "pctweaker", price_other: "uninstaller" };
  assert.equal(billingProductFromEvidence({}, ["price_pc"], catalogue), "pctweaker");
  assert.equal(billingProductFromEvidence({}, ["price_unknown"], catalogue), null);
  assert.equal(billingProductFromEvidence({ product: "pctweaker" }, ["price_other"], catalogue), null);
  assert.equal(billingProductFromEvidence({ product: "unknown" }, ["price_pc"], catalogue), null);
  assert.equal(billingProductFromEvidence({}, ["price_pc", "price_other"], catalogue), null);
  assert.equal(billingProductFromEvidence({ product: "pctweaker" }, ["price_pc", "price_unknown"], catalogue), null);
});

test("new recurring events without a valid period fail without granting unlimited access", async () => {
  for (const seconds of [undefined, 0, NaN, Infinity, Number.MAX_VALUE]) {
    const id = await user();
    const malformed = subscription(id, { items: { data: [{ current_period_end: seconds, price: { id: process.env.STRIPE_PRICE_MONTHLY } }] } });
    await assert.rejects(handleEvent(event("customer.subscription.created", malformed), effects()), /invalid period end/);
    assert.equal((await productEntitlement(id, "pctweaker")).active, false);
  }
  const id = await user();
  await assert.rejects(grantPro(id, { customerId: null, plan: "monthly", expiresAt: null }), /valid expiry/);
});

test("a valid period replaces the explicit legacy compatibility grant", async () => {
  const id = await user();
  await getPool().query("UPDATE users SET is_pro = TRUE, plan = 'monthly', legacy_pro_grant = TRUE WHERE id = $1", [id]);
  assert.equal((await productEntitlement(id, "pctweaker")).active, true);
  await handleEvent(event("customer.subscription.updated", subscription(id)), effects());
  const result = await row(id);
  assert.equal(result.legacy_pro_grant, false);
  assert.equal(new Date(result.pro_expires_at).getTime(), periodEnd * 1000);
});

test("recurring metadata cannot manufacture a lifetime grant", async () => {
  const id = await user();
  await handleEvent(event("customer.subscription.created", subscription(id, {
    metadata: { userId: id, product: "pctweaker", plan: "lifetime" },
  })), effects());
  assert.equal((await row(id)).plan, "monthly");
  assert.notEqual((await row(id)).pro_expires_at, null);
});

test("a legacy payment requires recognized price evidence before it becomes lifetime", async () => {
  const id = await user();
  const legacy = checkout(id, "lifetime", { metadata: { userId: id } });
  await handleEvent(event("checkout.session.completed", legacy), effects({
    async loadCheckout() { return { line_items: { data: [{ price: { id: "price_unrelated" } }] } }; },
  }));
  assert.equal((await productEntitlement(id, "pctweaker")).active, false);
  await handleEvent(event("checkout.session.completed", legacy), effects({
    async loadCheckout() { return { line_items: { data: [{ price: { id: process.env.STRIPE_PRICE_ID } }] } }; },
  }));
  assert.equal((await row(id)).plan, "lifetime");
});

test("unpaid async checkout remains locked and a paid replay uses the current subscription period", async () => {
  const id = await user();
  await handleEvent(event("checkout.session.completed", checkout(id, "monthly", { payment_status: "unpaid" })), effects());
  assert.equal((await productEntitlement(id, "pctweaker")).active, false);
  const paid = checkout(id, "monthly", { created: created - 60 });
  await handleEvent(event("checkout.session.async_payment_succeeded", paid), effects());
  const expiry = new Date((await row(id)).pro_expires_at).getTime();
  await handleEvent(event("checkout.session.completed", paid), effects());
  assert.equal(new Date((await row(id)).pro_expires_at).getTime(), expiry);
  assert.equal(expiry, periodEnd * 1000);
});

test("an old subscription deletion cannot revoke a newer paid checkout's grant", async () => {
  const id = await user();
  const old = subscription(id, { id: "sub_old_deleted", created: created - 86_400 });
  await handleEvent(event("customer.subscription.created", old), effects());
  const current = subscription(id, { id: "sub_new_paid", created });
  await handleEvent(event("checkout.session.completed", checkout(id, "monthly", { subscription: current.id })), effects());
  assert.equal((await row(id)).stripe_subscription_id, current.id);
  await handleEvent(event("customer.subscription.deleted", { ...old, status: "canceled" }), effects());
  assert.equal((await productEntitlement(id, "pctweaker")).active, true);
  assert.equal((await row(id)).stripe_subscription_id, current.id);
  await handleEvent(event("customer.subscription.deleted", { ...current, status: "canceled" }), effects());
  assert.equal((await productEntitlement(id, "pctweaker")).active, false);
});

test("old active events and checkout replays cannot steal a newer subscription binding", async () => {
  const id = await user();
  const old = subscription(id, { id: "sub_old_active", created: created - 86_400 });
  const current = subscription(id, { id: "sub_current_active", created });
  await handleEvent(event("customer.subscription.created", current), effects());
  await handleEvent(event("customer.subscription.updated", old), effects());
  await handleEvent(event("checkout.session.completed", checkout(id, "monthly", { subscription: old.id })), effects());
  assert.equal((await row(id)).stripe_subscription_id, current.id);
  await handleEvent(event("customer.subscription.deleted", { ...old, status: "canceled" }), effects());
  assert.equal((await productEntitlement(id, "pctweaker")).active, true);
});

test("a newer subscription event still replaces an older binding", async () => {
  const id = await user();
  const old = subscription(id, { id: "sub_previous", created: created - 86_400 });
  const current = subscription(id, { id: "sub_replacement", created });
  await handleEvent(event("customer.subscription.created", old), effects());
  await handleEvent(event("customer.subscription.created", current), effects());
  assert.equal((await row(id)).stripe_subscription_id, current.id);
  assert.equal(new Date((await row(id)).stripe_subscription_created_at).getTime(), created * 1000);
});

test("a replayed active snapshot cannot re-enable a subscription now canceled in Stripe", async () => {
  const id = await user();
  const original = subscription(id);
  await handleEvent(event("customer.subscription.created", original), effects());
  currentSubscriptions.set(original.id, { ...original, status: "canceled" });
  await handleEvent(event("customer.subscription.updated", original), effects());
  assert.equal((await productEntitlement(id, "pctweaker")).active, false);
  const paid = checkout(id, "monthly", { subscription: original.id });
  currentSubscriptions.set(original.id, { ...original, status: "canceled" });
  await handleEvent(event("checkout.session.completed", paid), effects());
  assert.equal((await productEntitlement(id, "pctweaker")).active, false);
});

test("canonical lookup failure does not trust a stale subscription snapshot", async () => {
  const id = await user();
  await assert.rejects(handleEvent(event("customer.subscription.created", subscription(id)), effects({
    async loadSubscription() { throw new Error("Fixture canonical lookup unavailable"); },
  })), /canonical lookup unavailable/);
  assert.equal((await productEntitlement(id, "pctweaker")).active, false);
});

test("recurring checkout requires a matching subscription identity and valid provenance", async () => {
  const id = await user();
  await assert.rejects(handleEvent(event("checkout.session.completed", checkout(id, "monthly", { subscription: null })), effects()), /no subscription ID/);
  const paid = checkout(id);
  await assert.rejects(handleEvent(event("checkout.session.completed", paid), effects({
    async loadSubscription(subscriptionId) { return subscription(id, { id: subscriptionId, customer: "cus_other_fixture" }); },
  })), /does not match/);
  await assert.rejects(handleEvent(event("customer.subscription.created", subscription(id, { created: NaN })), effects()), /creation time/);
  assert.equal((await productEntitlement(id, "pctweaker")).active, false);
});
