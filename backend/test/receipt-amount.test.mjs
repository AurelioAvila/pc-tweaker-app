import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sinkDir = mkdtempSync(join(tmpdir(), "receipt-amount-"));
process.env.DATABASE_URL = "pgmem";
process.env.EMAIL_SINK = "1";
process.env.EMAIL_SINK_DIR = sinkDir;
process.env.MAIL_FROM = "PC Tweaker <noreply@pctweaker.app>";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.TRIAL_ENABLED;
process.env.STRIPE_PRICE_MONTHLY = "price_pc_monthly_fixture";
process.env.STRIPE_PRICE_ANNUAL = "price_pc_annual_fixture";
process.env.STRIPE_PRICE_LIFETIME = "price_pc_lifetime_fixture";

const { getPool, initSchema } = await import("../dist/db.js");
const { deliverProReceipt, handleEvent, createCheckoutHandler } = await import("../dist/routes/stripe.js");
const { withQuery } = await import("../dist/stripe-policy.js");
await initSchema();

const now = () => Math.floor(Date.now() / 1000);
let n = 0;
async function user(locale = "en") {
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash, email_verified, first_name, locale) VALUES ($1, 'x', TRUE, 'Lena', $2) RETURNING id",
    [`receipt-${++n}@example.com`, locale],
  );
  return String(rows[0].id);
}
const mails = () => readdirSync(sinkDir).filter((f) => f.endsWith(".txt")).map((f) => readFileSync(join(sinkDir, f), "utf8"));

test("purchase receipts quote the amount taken in the reader's language, with no English leftovers", async () => {
  const before = mails().length;
  await deliverProReceipt({ userId: await user("de"), product: "pctweaker", plan: "lifetime", expiresAt: null,
    chargedLabel: "€48.79 once", amountMinor: 4879, currency: "eur" });
  await deliverProReceipt({ userId: await user("it"), product: "uninstaller", plan: "annual", expiresAt: "2027-10-15T08:00:00.000Z",
    chargedLabel: "€9.99 / year (first payment discounted)", amountMinor: 609, currency: "eur" });
  await deliverProReceipt({ kind: "refund", userId: await user("fr"), product: "pctweaker", plan: "lifetime", expiresAt: null,
    chargedLabel: "€48.79", amountMinor: 4879, currency: "eur" });
  const fresh = mails().slice(before);
  assert.equal(fresh.length, 3);
  const de = fresh.find((t) => /Abgebucht/.test(t));
  assert.match(de, /Abgebucht: 48,79\s€/);
  const it = fresh.find((t) => /Addebitato/.test(t));
  assert.match(it, /Addebitato: 6,09\s€/);
  const fr = fresh.find((t) => /48,79\s€/.test(t) && !/Abgebucht/.test(t));
  assert.ok(fr, fresh.join("\n---\n"));
  for (const text of fresh) assert.doesNotMatch(text, /\bonce\b|\/ year|\/ month|first payment discounted/);
});

test("a queued receipt without an amount keeps its old label (rows written before this change)", async () => {
  const before = mails().length;
  await deliverProReceipt({ userId: await user("en"), product: "pctweaker", plan: "monthly", expiresAt: "2026-11-15T08:00:00.000Z", chargedLabel: "€7.99 / month" });
  assert.match(mails().slice(before)[0], /Charged: €7\.99 \/ month/);
});

// ------------------------------------------------------------------ events
const subscriptions = new Map();
function effects(log) {
  log.welcomes ??= [];
  return {
    async loadSubscription(id) { return subscriptions.get(id); },
    async loadCheckout() { throw new Error("unexpected"); },
    async loadCheckoutForPayment() { return null; },
    async loadSubscriptionForPayment() { return null; },
    async stopSubscriptions() {},
    async welcome(...args) { log.welcomes.push(args); },
    alertReversal() {},
    async queueRefundNotice() {},
    async cardFingerprint() { return null; },
    async cancelSubscription() {},
  };
}
function direct(userId, status) {
  const end = now() + 30 * 86_400;
  const sub = {
    id: `sub_direct_${++n}`, created: now(), customer: `cus_${userId}`, status, trial_end: null, cancel_at_period_end: false,
    metadata: { userId, product: "pctweaker", plan: "monthly" },
    items: { data: [{ current_period_end: end, price: { id: "price_pc_monthly_fixture", unit_amount: 799, currency: "eur", recurring: { interval: "month" } } }] },
  };
  subscriptions.set(sub.id, sub);
  return sub;
}
const event = (type, object) => ({ id: `evt_${++n}`, type, data: { object } });

test("Subscribe now paid after 3D Secure: incomplete at creation, receipt from the first paid invoice", async () => {
  const id = await user("it");
  const log = {};
  const sub = direct(id, "incomplete");
  await handleEvent(event("customer.subscription.created", sub), effects(log));
  assert.equal(log.welcomes.length, 0, "nothing while incomplete");
  subscriptions.set(sub.id, { ...sub, status: "active" });
  await handleEvent(event("invoice.paid", { id: "in_1", billing_reason: "subscription_create", amount_paid: 487, currency: "eur",
    parent: { subscription_details: { subscription: sub.id } } }), effects(log));
  assert.equal(log.welcomes.length, 1);
  assert.equal(log.welcomes[0][5], `subscription:${sub.id}`);
  assert.deepEqual(log.welcomes[0][6], { subscriptionId: sub.id, amountMinor: 487, currency: "eur" });
  // A renewal is not a purchase.
  await handleEvent(event("invoice.paid", { id: "in_2", billing_reason: "subscription_cycle", amount_paid: 975, currency: "eur",
    parent: { subscription_details: { subscription: sub.id } } }), effects(log));
  assert.equal(log.welcomes.length, 1);
});

test("Subscribe now active at creation: the receipt names its subscription, so delivery can read the amount", async () => {
  const id = await user("en");
  const log = {};
  const sub = direct(id, "active");
  await handleEvent(event("customer.subscription.created", sub), effects(log));
  assert.equal(log.welcomes.length, 1);
  assert.deepEqual(log.welcomes[0][6], { subscriptionId: sub.id });
});

// ------------------------------------------------------------------ checkout
test("return URLs keep Stripe's placeholder and carry product, trial and language", () => {
  assert.equal(withQuery("https://api.pctweaker.app/checkout-success?session_id={CHECKOUT_SESSION_ID}", { product: "uninstaller", trial: "1" }),
    "https://api.pctweaker.app/checkout-success?session_id={CHECKOUT_SESSION_ID}&product=uninstaller&trial=1");
  assert.equal(withQuery("https://x.test/done", { lang: "pt" }), "https://x.test/done?lang=pt");
  assert.equal(withQuery("https://x.test/done#top", { a: "b c" }), "https://x.test/done?a=b%20c#top");
});

test("checkout: language and product reach the thanks page; a double click reuses one idempotency key", async () => {
  const id = await user("es");
  const calls = [];
  const handler = createCheckoutHandler({
    environment: { STRIPE_PRICE_MONTHLY: "price_pc_monthly_fixture", CHECKOUT_SUCCESS_URL: "https://api.test/checkout-success?session_id={CHECKOUT_SESSION_ID}", CHECKOUT_CANCEL_URL: "https://api.test/checkout-cancel" },
    now: () => Date.parse("2026-12-01T10:00:30Z"),
    async createSession(params, key) { calls.push({ params, key }); return { url: "https://checkout.stripe.com/c/pay/cs_test_x" }; },
  });
  const res = () => ({ status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });
  await handler({ userId: Number(id), body: { plan: "monthly" } }, res());
  await handler({ userId: Number(id), body: { plan: "monthly" } }, res());
  assert.equal(calls.length, 2);
  assert.equal(calls[0].params.success_url, "https://api.test/checkout-success?session_id={CHECKOUT_SESSION_ID}&product=pctweaker&lang=es");
  assert.equal(calls[0].params.cancel_url, "https://api.test/checkout-cancel?lang=es");
  assert.ok(calls[0].key);
  assert.equal(calls[0].key, calls[1].key, "same minute, same choice: same Checkout page");
});
