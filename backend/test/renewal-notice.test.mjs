import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_URL = "pgmem";
process.env.EMAIL_SINK = "1";
process.env.EMAIL_SINK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ca-renewal-sink-"));
process.env.JWT_SECRET = "renewal-test-secret";
process.env.MAIL_FROM = "PC Tweaker <noreply@pctweaker.app>";
delete process.env.STRIPE_SECRET_KEY;

const { getPool, initSchema } = await import("../dist/db.js");
const { deliverOwnerNotices } = await import("../dist/owner-sales.js");
const {
  caRenewalNoticeFor, queueCaRenewalNotice, cancelLink, verifyCancelLink, renewalCancelRoute, billingAddress, RENEWAL_PRODUCTS,
} = await import("../dist/renewal-notice.js");
await initSchema();

const RENEWS = 1824700845; // 28 Oct 2027 05:20 UTC, still 27 Oct (22:20) in California, where the reader is
const CA = { country: "US", state: "CA", city: "Oakland", line1: "1 Main St", postal_code: "94607" };
const NY = { country: "US", state: "NY" };

// The live California subscriber of 1/11/2026, shape as the API returns it (expanded).
function sub({ id = "sub_1UUYqSGdoWjZBiDjXQhVx5U6", interval = "year", count = 1, customerAddress = CA, pmAddress = CA, invoiceAddress = CA,
  status = "active", product = { id: "prod_V6WRHnVZHolqHN", name: "PC Tweaker Uninstaller" }, metadata = { plan: "annual", product: "uninstaller" },
  email = "buyer@example.test", extra = {} } = {}) {
  return {
    id, object: "subscription", status, cancel_at_period_end: false, cancel_at: null, metadata, currency: "eur",
    managed_payments: { enabled: true }, presentment_details: { presentment_currency: "usd" },
    customer: { id: "cus_V84RQKMAhdHSRf", object: "customer", email, address: customerAddress, invoice_settings: { default_payment_method: null } },
    default_payment_method: { id: "pm_1", type: "card", card: { brand: "visa", last4: "4242" }, billing_details: { address: pmAddress } },
    latest_invoice: { id: "in_prev", customer_address: invoiceAddress },
    items: { data: [{ id: "si_1", quantity: 1, current_period_end: RENEWS, price: { id: "price_1", unit_amount: 499, currency: "eur", recurring: { interval, interval_count: count }, product } }] },
    ...extra,
  };
}
const upcoming = (subscription = "sub_1UUYqSGdoWjZBiDjXQhVx5U6", id = "evt_upcoming_1") => ({
  id, type: "invoice.upcoming", livemode: true,
  data: { object: { object: "invoice", amount_due: 499, currency: "eur", customer_email: "buyer@example.test", customer_address: CA,
    lines: { data: [{ period: { start: RENEWS, end: RENEWS + 31_536_000 } }] },
    parent: { subscription_details: { subscription } } } },
});
function stripeOf(subscription, portal = async (params) => ({ url: `https://billing.stripe.com/p/session/test_${params.flow_data ? "cancel" : "home"}` })) {
  const calls = { retrieve: [], portal: [] };
  return {
    calls,
    subscriptions: { retrieve: async (id, opts) => { calls.retrieve.push([id, opts]); return subscription; } },
    billingPortal: { sessions: { create: async (params) => { calls.portal.push(params); return portal(params); } } },
  };
}
const caRows = async () => (await getPool().query("SELECT notice_key, payload FROM owner_notices WHERE notice_key LIKE 'ca-renewal%' ORDER BY notice_key")).rows;
const reset = () => getPool().query("DELETE FROM owner_notices");

test("a California annual subscriber gets one notice with date, term, charge, cancellation link and contact", async () => {
  await reset();
  const stripe = stripeOf(sub());
  await queueCaRenewalNotice(upcoming(), stripe);
  const rows = await caRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].notice_key, `ca-renewal:sub_1UUYqSGdoWjZBiDjXQhVx5U6:${RENEWS}`);
  const mail = rows[0].payload;
  assert.equal(mail.to, "buyer@example.test");
  assert.equal(mail.from, "PC Tweaker Uninstaller <noreply@pctweaker.app>");
  assert.equal(mail.replyTo, "support@pctweaker.app");
  assert.equal(mail.idempotencyKey, rows[0].notice_key);
  // 05:20 UTC on the 28th is still the 27th in California, where the reader is.
  assert.equal(mail.subject, "Your PC Tweaker Uninstaller plan renews on October 27, 2027");
  for (const fact of [
    "renews automatically for another year on October 27, 2027", // (A) it renews unless cancelled
    "Renewal term: 1 year, then every year until you cancel", // (B)
    "Charge: €4.99 per year, charged in USD at the exchange rate on the renewal date", // (C)
    "Plan: PC Tweaker Uninstaller, Annual", "Payment method: Visa ending 4242",
    "Open the cancellation link above", "link.com", "reply to this email before October 27, 2027", // (D)
    "Cancel the renewal: https://api.pctweaker.app/api/billing/renewal/cancel?s=sub_1UUYqSGdoWjZBiDjXQhVx5U6&e=", // (E)
    "support@pctweaker.app", // (F)
    "your billing address is in California",
  ]) assert.ok(mail.text.includes(fact), `missing "${fact}" in\n${mail.text}`);
  assert.match(mail.html, /Cancel the renewal/);
  assert.match(mail.html, /One account for PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver/);
  assert.doesNotMatch(mail.html + mail.text, /illustrat|refund/i);
  assert.doesNotMatch(mail.text, /!/);
  assert.deepEqual(stripe.calls.retrieve[0][1].expand.includes("items.data.price.product"), true);

  // The outbox delivers it to the customer, once, through the real mailer (EMAIL_SINK).
  assert.equal(await deliverOwnerNotices(undefined, new Date(Date.now() + 1000)), 1);
  assert.equal(await deliverOwnerNotices(undefined, new Date(Date.now() + 86_400_000)), 0);
  const written = fs.readdirSync(process.env.EMAIL_SINK_DIR).filter((f) => f.includes("pc-tweaker-uninstaller-plan-renews"));
  assert.equal(written.filter((f) => f.endsWith(".html")).length, 1);
});

test("a replayed event, or a second upcoming event for the same renewal, sends nothing more", async () => {
  await reset();
  const stripe = stripeOf(sub());
  await queueCaRenewalNotice(upcoming(), stripe);
  await queueCaRenewalNotice(upcoming(), stripe);
  await queueCaRenewalNotice(upcoming(undefined, "evt_upcoming_2"), stripe);
  assert.equal((await caRows()).length, 1);
});

test("monthly plans, other states, Canada, trials and plans already ending get nothing", async () => {
  await reset();
  const none = [
    sub({ interval: "month" }), // California, but monthly
    sub({ interval: "month", count: 6 }),
    sub({ customerAddress: NY, pmAddress: NY, invoiceAddress: NY }),
    sub({ customerAddress: { country: "CA", state: "ON" }, pmAddress: { country: "CA", state: "ON" } }), // Canada, not California
    sub({ customerAddress: { country: "GB", state: null }, pmAddress: CA }), // the customer's own address decides
    sub({ status: "trialing" }), // the trial's first charge is not a renewal
    sub({ status: "canceled" }),
    sub({ extra: { cancel_at_period_end: true } }),
    sub({ extra: { cancel_at: RENEWS } }),
  ];
  for (const s of none) assert.equal(await caRenewalNoticeFor(upcoming(), stripeOf(s)), null, JSON.stringify(s.items.data[0].price.recurring) + s.status);
  for (const s of none) await queueCaRenewalNotice(upcoming(), stripeOf(s));
  assert.equal((await caRows()).length, 0);
  // Not an upcoming invoice, or no subscription behind it: Stripe is not even asked.
  const stripe = stripeOf(sub());
  assert.equal(await caRenewalNoticeFor({ ...upcoming(), type: "invoice.paid" }, stripe), null);
  const noSub = upcoming(); noSub.data.object.parent = null;
  assert.equal(await caRenewalNoticeFor(noSub, stripe), null);
  assert.equal(stripe.calls.retrieve.length, 0);
});

test("two-year terms and twelve-month intervals count as a year or longer", async () => {
  const two = await caRenewalNoticeFor(upcoming(), stripeOf(sub({ count: 2 })));
  assert.ok(two.mail.text.includes("Renewal term: 2 years, then every 2 years until you cancel"));
  assert.ok(two.mail.text.includes("€4.99 per 2 years"));
  const twelve = await caRenewalNoticeFor(upcoming(), stripeOf(sub({ interval: "month", count: 12 })));
  assert.ok(twelve.mail.text.includes("Renewal term: 1 year"));
});

test("the address falls back from the customer to the card to the latest invoice", async () => {
  assert.ok(await caRenewalNoticeFor(upcoming(), stripeOf(sub({ customerAddress: null, pmAddress: CA, invoiceAddress: NY }))), "card");
  assert.ok(await caRenewalNoticeFor(upcoming(), stripeOf(sub({ customerAddress: null, pmAddress: null, invoiceAddress: CA }))), "latest invoice");
  assert.ok(await caRenewalNoticeFor(upcoming(), stripeOf(sub({ customerAddress: { country: "US" }, pmAddress: CA }))), "US without a state borrows the card's");
  assert.ok(await caRenewalNoticeFor(upcoming(), stripeOf(sub({ customerAddress: { country: "US", state: "California" }, pmAddress: null }))), "state written out");
  assert.equal(await caRenewalNoticeFor(upcoming(), stripeOf(sub({ customerAddress: NY, pmAddress: CA }))), null, "the customer's address wins");
  assert.deepEqual(billingAddress([null, undefined, { country: "us", state: " ca " }]), { country: "US", state: "CA" });
  // Nothing on the subscription at all: the upcoming invoice's own snapshot.
  const bare = sub({ customerAddress: null, pmAddress: null, invoiceAddress: null });
  assert.ok(await caRenewalNoticeFor(upcoming(), stripeOf(bare)), "upcoming invoice");
  const nowhere = upcoming(); nowhere.data.object.customer_address = null;
  assert.equal(await caRenewalNoticeFor(nowhere, stripeOf(bare)), null);
});

test("every product with yearly prices has its own brand, sender, support address and portal", async () => {
  const cases = [
    ["pctweaker", { name: "PC Tweaker Pro — Annual" }, "PC Tweaker", "Plan: PC Tweaker Pro, Annual"],
    ["tweaky-driver", { name: "Tweaky Driver Premium" }, "Tweaky Driver", "Plan: Tweaky Driver Premium, Annual"],
    [{}, { name: "Redaxa Business" }, "Redaxa", "Plan: Redaxa Business, Annual"],
    [{}, { name: "Glarion Studio annuale" }, "Glarion", "Plan: Glarion Studio, Annual"],
  ];
  for (const [tag, product, name, plan] of cases) {
    const metadata = typeof tag === "string" ? { product: tag } : tag;
    const { mail } = await caRenewalNoticeFor(upcoming(), stripeOf(sub({ product, metadata })));
    assert.equal(mail.from, `${name} <noreply@pctweaker.app>`);
    assert.ok(mail.text.includes(plan), `${name}: ${plan}`);
    const brand = Object.values(RENEWAL_PRODUCTS).find((p) => p.brand.name === name).brand;
    assert.equal(mail.replyTo, brand.supportEmail);
    assert.ok(mail.html.includes(brand.logoUrl) && mail.html.includes(brand.privacyUrl));
    const standalone = name === "Redaxa" || name === "Glarion";
    assert.equal(/One account for PC Tweaker/.test(mail.html + mail.text), !standalone, `${name} family line`);
    if (standalone) assert.ok(mail.html.includes(`href="${brand.supportUrl}"`) && !mail.html.includes("pctweaker.app/support"));
  }
});

test("every renewal brand keeps text and buttons readable on its own pinned surfaces", () => {
  const lum = (hex) => hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  for (const { brand: b } of Object.values(RENEWAL_PRODUCTS)) {
    for (const surface of [b.card, b.panel]) {
      assert.ok(ratio(b.ink, surface) >= 4.5, `${b.name} ink`);
      assert.ok(ratio(b.muted, surface) >= 4.5, `${b.name} muted on ${surface}`);
    }
    assert.ok(ratio(b.accentText, b.card) >= 4.5, `${b.name} links`);
    assert.ok(ratio(b.buttonText, b.accent) >= 4.5, `${b.name} button`);
    assert.ok(ratio(b.muted, b.bg) >= 4.5, `${b.name} footer`);
  }
});

test("a California renewal the code cannot brand or address is flagged to the owner instead", async () => {
  await reset();
  await queueCaRenewalNotice(upcoming(), stripeOf(sub({ product: { name: "Something New" }, metadata: {} })));
  const noEmail = upcoming("sub_noemail000");
  noEmail.data.object.customer_email = null;
  await queueCaRenewalNotice(noEmail, stripeOf(sub({ id: "sub_noemail000", email: null })));
  const rows = await caRows();
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.match(row.notice_key, /^ca-renewal-missing:/);
    assert.equal(row.payload.to, "support@pctweaker.app");
    assert.match(row.payload.subject, /^Action needed: California renewal notice not sent · ORD-/);
  }
  // The customer record lost its email but the invoice has one: the customer still gets it.
  const fromInvoice = await caRenewalNoticeFor(upcoming(), stripeOf(sub({ email: null })));
  assert.equal(fromInvoice.mail.to, "buyer@example.test");
});

test("a Stripe outage fails the webhook so Stripe sends the event again", async () => {
  const down = { subscriptions: { retrieve: async () => { throw new Error("Stripe down"); } } };
  await assert.rejects(() => queueCaRenewalNotice(upcoming(), down), /Stripe down/);
  await assert.rejects(() => queueCaRenewalNotice(upcoming(), null), /not configured/);
});

function fakeRes() {
  const res = { statusCode: 200, body: null, location: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.type = () => res;
  res.send = (b) => { res.body = b; return res; };
  res.redirect = (c, url) => { res.statusCode = c; res.location = url; return res; };
  return res;
}
const query = (link) => Object.fromEntries(new URL(link).searchParams);

test("the cancellation link is signed, expires a month after the renewal and opens the cancel step", async () => {
  const link = cancelLink("sub_1UUYqSGdoWjZBiDjXQhVx5U6", RENEWS);
  const { s, e, t } = query(link);
  assert.equal(Number(e), RENEWS + 30 * 86_400);
  assert.equal(verifyCancelLink(s, e, t, RENEWS * 1000), "ok");
  assert.equal(verifyCancelLink(s, e, t, (RENEWS + 31 * 86_400) * 1000), "expired");
  assert.equal(verifyCancelLink("sub_1UUYqSGdoWjZBiDjXQhVx5U7", e, t), "invalid", "another subscription");
  assert.equal(verifyCancelLink(s, String(Number(e) + 1), t), "invalid", "a longer life");
  assert.equal(verifyCancelLink(s, e, t.slice(1)), "invalid");
  assert.equal(verifyCancelLink(undefined, e, t), "invalid");

  const stripe = stripeOf(sub({ product: { name: "Redaxa Pro" }, metadata: {} }));
  const res = fakeRes();
  await renewalCancelRoute(() => stripe)({ query: { s, e, t } }, res);
  assert.equal(res.statusCode, 303);
  assert.equal(res.location, "https://billing.stripe.com/p/session/test_cancel");
  assert.deepEqual(stripe.calls.portal[0], {
    customer: "cus_V84RQKMAhdHSRf", return_url: "https://redaxa.getcertsprint.com", configuration: "bpc_1UQoPkGdoWjZBiDjZnPZVOAI",
    flow_data: { type: "subscription_cancel", subscription_cancel: { subscription: "sub_1UUYqSGdoWjZBiDjXQhVx5U6" } },
  });

  // Already ending: Stripe refuses the cancel step, the portal's home opens instead.
  const ending = stripeOf(sub(), async (p) => { if (p.flow_data) throw new Error("already set to cancel"); return { url: "https://billing.stripe.com/p/session/test_home" }; });
  const res2 = fakeRes();
  await renewalCancelRoute(() => ending)({ query: { s, e, t } }, res2);
  assert.equal(res2.location, "https://billing.stripe.com/p/session/test_home");

  const bad = fakeRes();
  await renewalCancelRoute(() => stripe)({ query: { s, e, t: "0".repeat(64) } }, bad);
  assert.equal(bad.statusCode, 404);
  assert.equal(stripe.calls.portal.length, 1, "a forged link never reaches Stripe");
  const down = fakeRes();
  await renewalCancelRoute(() => stripeOf(sub(), async () => { throw new Error("Stripe down"); }))({ query: { s, e, t } }, down);
  assert.equal(down.statusCode, 502);
  assert.match(down.body, /reply to the renewal email/);
});
