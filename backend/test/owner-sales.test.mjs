import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.EMAIL_SINK = "1";
delete process.env.STRIPE_SECRET_KEY;

const { getPool, initSchema } = await import("../dist/db.js");
const { ownerNoticeFor, queueOwnerNotice, deliverOwnerNotices, orderId } = await import("../dist/owner-sales.js");
await initSchema();

const event = (type, object, id = `evt_${type}_${object.id}`) => ({ id, type, livemode: true, data: { object } });

// The invoice that arrived on 28/10/2026 with only "Subscription update" in Stripe's email.
const uninstallerInvoice = {
  id: "in_1UVeHiGdoWjZBiDjJC9dkUih", number: "JNMWNJEK-0043", amount_paid: 499, currency: "eur",
  billing_reason: "subscription_cycle", customer: "cus_V84RQKMAhdHSRf", customer_email: "buyer@example.test",
  customer_name: "Jason Lane", customer_address: { country: "US" }, hosted_invoice_url: "https://invoice.stripe.com/i/x",
  created: 1793222486, status_transitions: { paid_at: 1793226136 },
  lines: { data: [{ description: "1 × PC Tweaker Uninstaller (at €4.99 / year)", period: { start: 1793222400, end: 1824758400 } }] },
  parent: { subscription_details: { subscription: "sub_1UUYqSGdoWjZBiDjXQhVx5U6",
    metadata: { plan: "annual", product: "uninstaller", trial: "3d", trial_device: "67da60ac", userId: "20" } } },
};
const stripeWithTrialEnd = (trialEnd) => ({ subscriptions: { retrieve: async () => ({ trial_end: trialEnd }) } });

test("a trial's first charge names the product, plan, amount, reason and invoice", async () => {
  const { key, notice } = await ownerNoticeFor(event("invoice.paid", uninstallerInvoice), stripeWithTrialEnd(1793222400));
  assert.equal(key, "invoice:in_1UVeHiGdoWjZBiDjJC9dkUih");
  const order = orderId("sub_1UUYqSGdoWjZBiDjXQhVx5U6");
  assert.match(order, /^ORD-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(notice.subject, `€4.99 · PC Tweaker Uninstaller annual — First charge after the free trial · ${order}`);
  assert.ok(notice.text.startsWith("First charge after the free trial") && notice.text.includes(`Order ID: ${order}`));
  for (const fact of ["Product: PC Tweaker Uninstaller", "Amount paid: €4.99", "Invoice: JNMWNJEK-0043",
    "Customer: Jason Lane · buyer@example.test", "Country: US", "Metadata userId: 20",
    "https://dashboard.stripe.com/subscriptions/sub_1UUYqSGdoWjZBiDjXQhVx5U6"]) {
    assert.ok(notice.text.includes(fact), `missing "${fact}" in\n${notice.text}`);
  }
  assert.ok(!notice.text.includes("trial_device"), "device hashes are not mailed");
  assert.ok(!notice.html.includes("<script"), "html is escaped");
});

test("renewals, new subscriptions and plan changes say so; free invoices are silent", async () => {
  const renewal = await ownerNoticeFor(event("invoice.paid", uninstallerInvoice), stripeWithTrialEnd(1700000000));
  assert.match(renewal.notice.subject, /— Renewal · ORD-/);
  assert.equal(renewal.notice.subject.split(" · ").at(-1), orderId("sub_1UUYqSGdoWjZBiDjXQhVx5U6"), "one order, one code");
  const created = await ownerNoticeFor(event("invoice.paid", { ...uninstallerInvoice, billing_reason: "subscription_create" }), null);
  assert.match(created.notice.subject, /— New subscription · ORD-/);
  const update = await ownerNoticeFor(event("invoice.paid", { ...uninstallerInvoice, billing_reason: "subscription_update" }), null);
  assert.match(update.notice.subject, /Plan change/);
  assert.equal(await ownerNoticeFor(event("invoice.paid", { ...uninstallerInvoice, amount_paid: 0 }), null), null);
});

test("one-off checkouts of any product are told once, trials as trials, paid subscriptions by their invoice", async () => {
  const lifetime = { id: "cs_life", mode: "payment", payment_status: "paid", amount_total: 3999, currency: "eur", created: 1793220000,
    payment_intent: "pi_life", customer: "cus_x", customer_details: { email: "a@example.test", name: "A", address: { country: "DE" } },
    metadata: { product: "pctweaker", plan: "lifetime" }, line_items: { data: [{ description: "PC Tweaker Pro Lifetime", quantity: 1 }] } };
  const paid = await ownerNoticeFor(event("checkout.session.completed", lifetime), null);
  assert.equal(paid.key, "checkout:cs_life");
  assert.equal(paid.notice.subject, `€39.99 · PC Tweaker Pro Lifetime — One-off purchase · ${orderId("pi_life")}`);
  const again = await ownerNoticeFor(event("checkout.session.async_payment_succeeded", lifetime), null);
  assert.equal(again.key, paid.key, "a delayed payment shares the key");

  // Havenly, CertSprint, Frame Witness: other products' Checkouts on the same account.
  const shop = { ...lifetime, id: "cs_shop", metadata: { orderId: "HV-1042" }, line_items: undefined };
  const lister = { checkout: { sessions: { listLineItems: async () => ({ data: [{ description: "Pet grooming glove", quantity: 2 }] }) } } };
  const order = await ownerNoticeFor(event("checkout.session.completed", shop), lister);
  assert.match(order.notice.subject, /^€39\.99 · 2 × Pet grooming glove — One-off purchase/);
  assert.ok(order.notice.text.includes("Metadata orderId: HV-1042"));

  const trial = { ...lifetime, id: "cs_trial", mode: "subscription", amount_total: 0, payment_status: "no_payment_required",
    subscription: "sub_t", metadata: { product: "uninstaller", plan: "annual" } };
  const started = await ownerNoticeFor(event("checkout.session.completed", trial), { ...stripeWithTrialEnd(1793222400), checkout: lister.checkout });
  assert.equal(started.notice.subject, `Trial started · PC Tweaker Pro Lifetime annual (no charge yet) · ${orderId("sub_t")}`);
  assert.ok(started.notice.text.includes("First charge:"));

  assert.equal(await ownerNoticeFor(event("checkout.session.completed", { ...trial, amount_total: 799 }), null), null);
  assert.equal(await ownerNoticeFor(event("checkout.session.completed", { ...lifetime, payment_status: "unpaid" }), null), null);
});

test("refunds and disputes are told too", async () => {
  const refund = await ownerNoticeFor(event("charge.refunded", { id: "ch_1", amount: 799, amount_refunded: 799, refunded: true,
    currency: "eur", description: "Subscription creation", payment_intent: "pi_r", receipt_number: "2041-1234", billing_details: {} }), null);
  assert.equal(refund.key, "refund:ch_1:799");
  assert.equal(refund.notice.subject, `Refund €7.99 — Subscription creation · ${orderId("pi_r")}`);
  // A refund of a subscription payment carries the subscription's order code.
  const lookup = {
    paymentIntents: { retrieve: async () => ({ customer: "cus_r" }) },
    invoices: { list: async () => ({ data: [{ payments: { data: [{ payment: { payment_intent: "pi_r" } }] },
      parent: { subscription_details: { subscription: "sub_1UUYqSGdoWjZBiDjXQhVx5U6" } } }] }) },
  };
  const subRefund = await ownerNoticeFor(event("charge.refunded", { id: "ch_2", amount: 499, amount_refunded: 499, refunded: true,
    currency: "eur", description: "Subscription update", payment_intent: "pi_r", billing_details: {} }), lookup);
  assert.ok(subRefund.notice.subject.endsWith(orderId("sub_1UUYqSGdoWjZBiDjXQhVx5U6")));
  const dispute = await ownerNoticeFor(event("charge.dispute.created", { id: "du_1", amount: 499, currency: "eur", reason: "fraudulent",
    status: "needs_response", payment_intent: "pi_d", evidence_details: { due_by: 1794000000 } }), null);
  assert.match(dispute.notice.subject, /^Dispute €4\.99 — fraudulent/);
  assert.equal(await ownerNoticeFor(event("customer.subscription.updated", { id: "sub_1" }), null), null);
});

test("each notice is queued once, survives a failed send and is delivered once", async () => {
  const paidEvent = event("invoice.paid", uninstallerInvoice);
  // Stripe details unavailable: the notice still goes, from the event alone.
  const broken = { subscriptions: { retrieve: async () => { throw new Error("Stripe down"); } } };
  await queueOwnerNotice(paidEvent, broken);
  await queueOwnerNotice(paidEvent, null); // a webhook retry
  const { rows } = await getPool().query("SELECT count(*)::int AS n FROM owner_notices");
  assert.equal(rows[0].n, 1);

  const sent = [];
  const t0 = new Date();
  assert.equal(await deliverOwnerNotices(async () => { throw new Error("mail down"); }, t0), 0);
  assert.equal(await deliverOwnerNotices(async (n) => sent.push(n), t0), 0, "backoff: not retried immediately");
  const later = new Date(t0.getTime() + 60 * 60_000);
  assert.equal(await deliverOwnerNotices(async (n) => sent.push(n), later), 1);
  assert.equal(await deliverOwnerNotices(async (n) => sent.push(n), new Date(later.getTime() + 86_400_000)), 0);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /PC Tweaker Uninstaller annual/);
});
