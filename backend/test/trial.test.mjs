import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.TRIAL_ENABLED;
process.env.STRIPE_PRICE_MONTHLY = "price_pc_monthly_fixture";
process.env.STRIPE_PRICE_ANNUAL = "price_pc_annual_fixture";
process.env.STRIPE_PRICE_LIFETIME = "price_pc_lifetime_fixture";
process.env.STRIPE_PRICE_UNINSTALLER_ANNUAL = "price_uninstaller_fixture";
process.env.STRIPE_PRICE_UNINSTALLER_LOYALTY = "price_uninstaller_loyalty_fixture";

const { getPool, initSchema } = await import("../dist/db.js");
const { handleEvent, createCheckoutHandler, billingStatus } = await import("../dist/routes/stripe.js");
const { normalizeEmail, grantsAccess, emailHash } = await import("../dist/trial.js");
const { productEntitlement } = await import("../dist/products.js");
const { PROMO } = await import("../dist/promo.js");
await initSchema();

const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);
let sequence = 0;
const subscriptions = new Map();

async function user(email = `trial-${++sequence}@example.com`) {
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash, email_verified) VALUES ($1, 'fixture', TRUE) RETURNING id",
    [email],
  );
  return String(rows[0].id);
}
function trialSubscription(userId, overrides = {}) {
  const trialEnd = now() + 3 * DAY;
  const value = {
    id: `sub_trial_${++sequence}`,
    created: now(),
    customer: `cus_trial_${userId}`,
    status: "trialing",
    trial_end: trialEnd,
    cancel_at_period_end: false,
    default_payment_method: `pm_${userId}`,
    metadata: { userId, product: "pctweaker", plan: "monthly", trial: "3d" },
    items: { data: [{ current_period_end: trialEnd, price: { id: process.env.STRIPE_PRICE_MONTHLY, unit_amount: 799, currency: "eur", recurring: { interval: "month" } } }] },
    ...overrides,
  };
  subscriptions.set(value.id, value);
  return value;
}
function update(subscription, changes) {
  const next = { ...subscription, ...changes };
  subscriptions.set(next.id, next);
  return next;
}
function effects(log = {}, cards = {}) {
  log.cancelled ??= [];
  log.welcomes ??= [];
  return {
    async loadSubscription(id) { assert.ok(subscriptions.has(id), id); return subscriptions.get(id); },
    async loadCheckout() { throw new Error("unexpected"); },
    async loadCheckoutForPayment() { return null; },
    async loadSubscriptionForPayment() { return null; },
    async stopSubscriptions() {},
    async welcome(...args) { log.welcomes.push(args); },
    notifySale(...args) { log.sale = args; },
    alertReversal() {},
    async queueRefundNotice() {},
    async cardFingerprint(subscription) { return cards[subscription.id] ?? null; },
    async cancelSubscription(id) {
      log.cancelled.push(id);
      update(subscriptions.get(id), { status: "canceled", cancellation_details: { comment: "trial_rejected" } });
    },
  };
}
const event = (type, object) => ({ id: `evt_${++sequence}`, type, data: { object } });
async function receipts(userId) {
  const { rows } = await getPool().query("SELECT receipt_key, payload, next_attempt_at FROM billing_receipts WHERE user_id = $1", [userId]);
  return rows;
}
async function status(userId, product = "pctweaker", environment = { TRIAL_ENABLED: "true" }) {
  return (await billingStatus(userId, [product], environment)).products[0];
}

test("emails normalise the way abuse would vary them", () => {
  assert.equal(normalizeEmail("  Mario.Rossi+promo@GoogleMail.com "), "mariorossi@gmail.com");
  assert.equal(normalizeEmail("mario.rossi+x@outlook.com"), "mario.rossi@outlook.com");
  assert.equal(emailHash("M.a.r.i.o@gmail.com"), emailHash("mario+1@googlemail.com"));
});

test("only active and trialing keep Pro; past_due keeps its old grace only off-trial with the switch off", () => {
  assert.equal(grantsAccess({ status: "trialing" }, {}), true);
  assert.equal(grantsAccess({ status: "active" }, {}), true);
  assert.equal(grantsAccess({ status: "past_due", trial_end: null, metadata: {} }, {}), true);
  assert.equal(grantsAccess({ status: "past_due", trial_end: null, metadata: {} }, { TRIAL_ENABLED: "true" }), false);
  assert.equal(grantsAccess({ status: "past_due", trial_end: 123, metadata: {} }, {}), false);
  for (const status of ["unpaid", "incomplete", "incomplete_expired", "canceled", "paused"]) {
    assert.equal(grantsAccess({ status }, {}), false, status);
  }
});

const environment = {
  TRIAL_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_synthetic_fixture_only",
  STRIPE_PRICE_MONTHLY: "price_pc_monthly_fixture",
  STRIPE_PRICE_ANNUAL: "price_pc_annual_fixture",
  STRIPE_PRICE_LIFETIME: "price_pc_lifetime_fixture",
  STRIPE_PRICE_UNINSTALLER_ANNUAL: "price_uninstaller_fixture",
  STRIPE_PRICE_UNINSTALLER_LOYALTY: "price_uninstaller_loyalty_fixture",
  STRIPE_COUPON_HALLOWEEN_MONTHLY: "coupon_monthly",
};
async function checkout(userId, body, env = environment, at = Date.parse("2026-11-20T10:00:00Z")) {
  const calls = [];
  const handler = createCheckoutHandler({ environment: env, now: () => at,
    async createSession(params) { calls.push(params); return { url: "https://checkout.stripe.com/c/pay/cs_test_fixture" }; } });
  const res = { statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } };
  await handler({ userId: Number(userId), body }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  return { params: calls[0], body: res.body };
}

test("checkout adds the trial to subscription plans only, and only with the switch on", async () => {
  const id = await user();
  const monthly = await checkout(id, { plan: "monthly" });
  assert.equal(monthly.body.trial, true);
  assert.equal(monthly.body.trial_days, 3);
  assert.equal(monthly.params.subscription_data.trial_period_days, 3);
  assert.deepEqual(monthly.params.subscription_data.trial_settings, { end_behavior: { missing_payment_method: "cancel" } });
  assert.equal(monthly.params.payment_method_collection, "always");
  assert.equal(monthly.params.subscription_data.metadata.trial, "3d");
  assert.equal(monthly.params.metadata.trial, "3d");
  assert.equal(monthly.params.subscription_data.metadata.userId, id, "existing metadata is kept");

  const lifetime = await checkout(id, { plan: "lifetime" });
  assert.equal(lifetime.body.trial, false);
  assert.equal(lifetime.params.payment_method_collection, undefined);
  assert.equal(lifetime.params.subscription_data, undefined);

  const uninstaller = await checkout(id, { product: "uninstaller", plan: "annual" });
  assert.equal(uninstaller.body.trial, true);
  assert.equal(uninstaller.params.subscription_data.trial_period_days, 3);

  const off = await checkout(id, { plan: "annual" }, { ...environment, TRIAL_ENABLED: "false" });
  assert.equal(off.body.trial, false);
  assert.equal(off.params.subscription_data.trial_period_days, undefined);
  assert.equal(off.params.payment_method_collection, undefined);
});

test("the Halloween coupon stays on a trial checkout, so the first charge after the trial is the promo price", async () => {
  const id = await user();
  const during = await checkout(id, { plan: "monthly" }, environment, Date.parse("2026-10-31T20:00:00Z"));
  assert.deepEqual(during.params.discounts, [{ coupon: "coupon_monthly" }]);
  assert.equal(during.params.subscription_data.trial_period_days, 3);
  assert.equal(during.params.subscription_data.metadata.promo_id, PROMO.id);
  assert.equal(during.params.subscription_data.metadata.trial, "3d");
});

test("a trial grants Pro until its end, queues the start notice and the reminder a day before, and no receipt yet", async () => {
  const id = await user();
  const log = {};
  const sub = trialSubscription(id);
  await handleEvent(event("customer.subscription.created", sub), effects(log));
  const entitlement = await productEntitlement(id, "pctweaker");
  assert.equal(entitlement.active, true);
  assert.equal(entitlement.status, "trialing");
  assert.equal(Date.parse(entitlement.expiresAt), sub.trial_end * 1000);
  const state = await status(id);
  assert.equal(state.state, "trialing");
  assert.equal(Date.parse(state.trial_ends_at), sub.trial_end * 1000);
  assert.equal(state.can_start_trial, false);
  assert.equal(state.blocked_reason, "none");
  assert.equal(log.welcomes.length, 0, "a trial is not a purchase");
  const queued = await receipts(id);
  const reminder = queued.find((r) => r.receipt_key === `trial_ending:${sub.id}:${sub.trial_end}`);
  assert.ok(reminder);
  assert.equal(new Date(reminder.next_attempt_at).getTime(), (sub.trial_end - DAY) * 1000);
  assert.ok(queued.some((r) => r.receipt_key === `trial_started:${sub.id}`));

  // Replays change nothing and never cancel.
  await handleEvent(event("customer.subscription.updated", sub), effects(log));
  await handleEvent(event("customer.subscription.created", sub), effects(log));
  assert.equal(log.cancelled.length, 0);
  assert.equal((await receipts(id)).length, queued.length);
});

test("a failed first charge blocks at once, a successful retry restores Pro, and the first paid invoice sends the receipt", async () => {
  const id = await user();
  const log = {};
  let sub = trialSubscription(id);
  await handleEvent(event("customer.subscription.created", sub), effects(log));

  const periodEnd = now() + 33 * DAY;
  sub = update(sub, { status: "past_due", items: { data: [{ ...sub.items.data[0], current_period_end: periodEnd }] } });
  const invoice = { id: "in_fail", amount_paid: 0, parent: { subscription_details: { subscription: sub.id } } };
  await handleEvent(event("invoice.payment_failed", invoice), effects(log));
  assert.equal((await productEntitlement(id, "pctweaker")).active, false, "no grace period");
  let state = await status(id);
  assert.equal(state.state, "blocked");
  assert.equal(state.blocked_reason, "payment_failed");
  assert.equal(state.can_start_trial, false);
  const notice = (await receipts(id)).find((r) => r.receipt_key === `ending:payment_failed:${sub.id}:${periodEnd * 1000}`);
  assert.equal(notice?.payload.blocked, true);

  sub = update(sub, { status: "active" });
  await handleEvent(event("invoice.paid", { id: "in_ok", amount_paid: 399, parent: { subscription_details: { subscription: sub.id } } }), effects(log));
  state = await status(id);
  assert.equal(state.state, "active");
  assert.equal(Date.parse(state.current_period_end), periodEnd * 1000);
  assert.equal(log.welcomes.length, 1);
  assert.equal(log.welcomes[0][5], `subscription:${sub.id}`);
});

test("the trial is refused, before any charge, to a second account with the same email or card", async () => {
  const first = await user("Anna.Bianchi@gmail.com");
  await handleEvent(event("customer.subscription.created", trialSubscription(first)), effects({}, {}));
  assert.equal((await status(first)).can_start_trial, false);

  // Same mailbox written differently: the checkout no longer offers the trial...
  const second = await user("annabianchi+2@googlemail.com");
  assert.equal((await status(second)).can_start_trial, false);
  assert.equal((await checkout(second, { plan: "monthly" })).body.trial, false);
  // ...and a trial subscription that slipped through is cancelled.
  const log = {};
  const sneaky = trialSubscription(second);
  await handleEvent(event("customer.subscription.created", sneaky), effects(log));
  assert.deepEqual(log.cancelled, [sneaky.id]);
  assert.equal((await productEntitlement(second, "pctweaker")).active, false);
  const state = await status(second);
  assert.equal(state.state, "blocked");
  assert.equal(state.blocked_reason, "trial_already_used");
  assert.ok((await receipts(second)).some((r) => r.receipt_key === `trial_rejected:${sneaky.id}`));
  // Stripe's own cancellation events, in any order, keep the reason.
  await handleEvent(event("customer.subscription.updated", sneaky), effects());
  await handleEvent(event("customer.subscription.deleted", subscriptions.get(sneaky.id)), effects());
  assert.equal((await status(second)).blocked_reason, "trial_already_used");

  // Same card, unrelated email.
  const cardOwner = await user();
  const original = trialSubscription(cardOwner);
  await handleEvent(event("customer.subscription.created", original), effects({}, { [original.id]: "fp_same_card" }));
  const other = await user();
  const copy = trialSubscription(other);
  const cardLog = {};
  await handleEvent(event("customer.subscription.created", copy), effects(cardLog, { [copy.id]: "fp_same_card" }));
  assert.deepEqual(cardLog.cancelled, [copy.id]);
  assert.equal((await productEntitlement(other, "pctweaker")).active, false);
});

test("two trial checkouts by one account yield one trial", async () => {
  const id = await user();
  const a = trialSubscription(id);
  const b = trialSubscription(id);
  const log = {};
  await Promise.all([
    handleEvent(event("customer.subscription.created", a), effects(log)),
    handleEvent(event("customer.subscription.created", b), effects(log)),
  ]);
  assert.equal(log.cancelled.length, 1);
  const { rows } = await getPool().query("SELECT subscription_id FROM trial_claims WHERE product = 'pctweaker' AND user_id = $1", [id]);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].subscription_id, log.cancelled[0]);
  assert.equal((await receipts(id)).some((r) => r.receipt_key.startsWith("trial_rejected:")), false, "their own trial goes on");
  assert.equal((await status(id)).state, "trialing");
});

test("the trial is per product: the Uninstaller trial is separate and granted only by subscription events", async () => {
  const id = await user();
  await handleEvent(event("customer.subscription.created", trialSubscription(id)), effects());
  assert.equal((await status(id, "uninstaller")).can_start_trial, true);

  const sub = trialSubscription(id, {
    metadata: { userId: id, product: "uninstaller", plan: "annual", trial: "3d" },
    items: { data: [{ current_period_end: now() + 3 * DAY, price: { id: process.env.STRIPE_PRICE_UNINSTALLER_ANNUAL, unit_amount: 999, currency: "eur", recurring: { interval: "year" } } }] },
  });
  const log = {};
  await handleEvent(event("checkout.session.completed", {
    id: "cs_trial_uninstaller", created: now(), client_reference_id: id, customer: sub.customer, mode: "subscription",
    subscription: sub.id, payment_status: "no_payment_required", metadata: { userId: id, product: "uninstaller", plan: "annual", trial: "3d" },
  }), effects(log));
  assert.equal((await productEntitlement(id, "uninstaller")).active, false, "no provisional grant for a trial");
  assert.match(log.sale[1], /3-day free trial/);
  await handleEvent(event("customer.subscription.created", sub), effects());
  const state = await status(id, "uninstaller");
  assert.equal(state.state, "trialing");
  assert.equal(state.can_start_trial, false);
});

test("cancellation reads as blocked/canceled, and existing subscribers keep today's grace while the switch is off", async () => {
  const id = await user();
  const sub = trialSubscription(id);
  await handleEvent(event("customer.subscription.created", sub), effects());
  await handleEvent(event("customer.subscription.deleted", update(sub, { status: "canceled" })), effects());
  const state = await status(id);
  assert.equal(state.state, "blocked");
  assert.equal(state.blocked_reason, "canceled");

  const legacy = await user();
  const old = trialSubscription(legacy, { status: "past_due", trial_end: null, metadata: { userId: legacy, product: "pctweaker", plan: "monthly" } });
  await handleEvent(event("customer.subscription.updated", old), effects());
  assert.equal((await productEntitlement(legacy, "pctweaker")).active, true, "flag off: unchanged behaviour");
  process.env.TRIAL_ENABLED = "true";
  try {
    await handleEvent(event("customer.subscription.updated", old), effects());
    assert.equal((await productEntitlement(legacy, "pctweaker")).active, false, "flag on: no grace for anyone");
  } finally {
    delete process.env.TRIAL_ENABLED;
  }
});

test("Lifetime never gets a trial and reads as active", async () => {
  const id = await user();
  await getPool().query("UPDATE users SET is_pro = TRUE, plan = 'lifetime' WHERE id = $1", [id]);
  const state = await status(id);
  assert.equal(state.state, "active");
  assert.equal(state.status, "lifetime");
  assert.equal(state.can_start_trial, false);
  assert.equal(state.current_period_end, null);
});
