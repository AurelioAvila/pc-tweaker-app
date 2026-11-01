import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "reminder-test-secret";
const { initSchema, getPool } = await import("../dist/db.js");
const { remindAbandonedLifetime, lifetimeReminderEmail, noticeFailedCheckouts, paymentFailedEmail, checkoutOfFailedPayment, failedCheckout, resumeCheckoutUrl } = await import("../dist/checkout-recovery.js");
await initSchema();
const db = getPool();

async function user(email, { verified = true, pro = false, plan = null, firstName = null } = {}) {
  const { rows } = await db.query(
    "INSERT INTO users (email, password_hash, email_verified, is_pro, plan, first_name) VALUES ($1, 'x', $2, $3, $4, $5) RETURNING id",
    [email, verified, pro, plan, firstName],
  );
  return String(rows[0].id);
}
const lifetime = (id, userId) => ({ id, mode: "payment", userId, plan: "lifetime", product: "pctweaker" });

test("one reminder per verified non-Pro account, then a 30-day pause", async () => {
  const id = await user("buyer@example.com", { firstName: "Ana" });
  const sent = [];
  const now = new Date("2026-10-05T10:00:00Z");
  assert.equal(await remindAbandonedLifetime([lifetime("cs_1", id), lifetime("cs_2", id)], async (to) => { sent.push(to); }, now), 1);
  assert.equal(sent[0].email, "buyer@example.com");
  assert.match(sent[0].unsubscribeUrl, /\/api\/newsletter\/unsubscribe\?email=buyer%40example\.com&sig=[0-9a-f]{64}$/);
  assert.equal(await remindAbandonedLifetime([lifetime("cs_3", id)], async () => { sent.push(1); }, new Date("2026-10-20T10:00:00Z")), 0);
  assert.equal(await remindAbandonedLifetime([lifetime("cs_4", id)], async () => { sent.push(1); }, new Date("2026-11-06T10:00:00Z")), 1);
});

test("no reminder for unverified, Pro, opted-out, anonymous or non-Lifetime sessions", async () => {
  const unverified = await user("new@example.com", { verified: false });
  const pro = await user("pro@example.com", { pro: true, plan: "lifetime" });
  const optedOut = await user("quiet@example.com");
  await db.query("INSERT INTO newsletter_subscribers (email, source, unsubscribed_at) VALUES ('Quiet@example.com', 'unsubscribe', now())");
  const other = await user("monthly@example.com");
  let count = 0;
  const sessions = [
    lifetime("cs_a", unverified), lifetime("cs_b", pro), lifetime("cs_c", optedOut), lifetime("cs_d", null),
    { ...lifetime("cs_e", other), plan: "monthly", mode: "subscription" },
    { ...lifetime("cs_f", other), product: "uninstaller" },
  ];
  assert.equal(await remindAbandonedLifetime(sessions, async () => { count++; }), 0);
  assert.equal(count, 0);
});

test("a failed send is not retried", async () => {
  const id = await user("bounce@example.com");
  await remindAbandonedLifetime([lifetime("cs_x", id)], async () => { throw new Error("provider down"); });
  let count = 0;
  assert.equal(await remindAbandonedLifetime([lifetime("cs_y", id)], async () => { count++; }), 0);
  assert.equal(count, 0);
});

test("the email escapes the name, promises nothing new and carries the unsubscribe link", () => {
  const mail = lifetimeReminderEmail({ email: "a@example.com", firstName: "<b>Eve</b>", unsubscribeUrl: "https://api.pctweaker.app/api/newsletter/unsubscribe?email=a%40example.com&sig=ab" });
  assert.equal(mail.to, "a@example.com");
  assert.match(mail.html, /Nothing was charged, &lt;b&gt;Eve&lt;\/b&gt;\./);
  assert.equal(mail.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(mail.html, /nothing was charged/);
  assert.match(mail.html, /email=a%40example\.com&amp;sig=ab/);
  assert.match(mail.text, /Unsubscribe: https:\/\/api\.pctweaker\.app/);
  assert.doesNotMatch(mail.html + mail.text, /discount|limited time|hurry/i);
});

// A refused payment: an hour ago, in an open Checkout for PC Tweaker annual.
const NOW = new Date("2026-11-01T12:00:00Z");
const refused = (sessionId, userId, over = {}) => ({
  sessionId, status: "open", userId, plan: "annual", product: "pctweaker", tip: false, crypto: false,
  failedAt: new Date(NOW.getTime() - 60 * 60 * 1000), ...over,
});

test("one failed-payment email per account and plan, then 24 hours of quiet", async () => {
  const id = await user("declined@example.com", { firstName: "Bea" });
  const sent = [];
  const send = async (to) => { sent.push(to); };
  assert.equal(await noticeFailedCheckouts([refused("cs_f1", id), refused("cs_f2", id)], send, NOW), 1);
  assert.deepEqual(sent[0], { email: "declined@example.com", firstName: "Bea", locale: null, product: "pctweaker", plan: "annual" });
  // Another plan is another purchase: its own email.
  assert.equal(await noticeFailedCheckouts([refused("cs_f3", id, { plan: "lifetime" })], send, NOW), 1);
  const later = new Date(NOW.getTime() + 23 * 60 * 60 * 1000);
  assert.equal(await noticeFailedCheckouts([refused("cs_f4", id, { failedAt: new Date(later.getTime() - 3600e3) })], send, later), 0);
  const nextDay = new Date(NOW.getTime() + 25 * 60 * 60 * 1000);
  assert.equal(await noticeFailedCheckouts([refused("cs_f5", id, { failedAt: new Date(nextDay.getTime() - 3600e3) })], send, nextDay), 1);
  assert.equal(sent.length, 3);
});

test("no failed-payment email for tips, crypto, completed or anonymous sessions, unknown plans, fresh or stale refusals, unverified accounts or customers who paid since", async () => {
  const id = await user("quiet-decline@example.com");
  const unverified = await user("unverified-decline@example.com", { verified: false });
  const paid = await user("paid-since@example.com", { pro: true, plan: "lifetime" });
  let count = 0;
  const failures = [
    refused("cs_t", null, { tip: true }), refused("cs_t2", id, { tip: true }),
    refused("cs_c", id, { crypto: true, plan: "lifetime" }),
    refused("cs_done", id, { status: "complete" }),
    refused("cs_anon", null), refused("cs_bad", "12abc"),
    refused("cs_plan", id, { plan: "weekly" }), refused("cs_prod", id, { product: "glarion" }),
    refused("cs_fresh", id, { failedAt: new Date(NOW.getTime() - 10 * 60 * 1000) }),
    refused("cs_stale", id, { failedAt: new Date(NOW.getTime() - 7 * 60 * 60 * 1000) }),
    refused("cs_unv", unverified), refused("cs_paid", paid),
  ];
  assert.equal(await noticeFailedCheckouts(failures, async () => { count++; }, NOW), 0);
  assert.equal(count, 0);
});

test("a refused payment is traced to its Checkout session; renewals are not", async () => {
  const lifetime = { id: "cs_life", mode: "payment", status: "open", created: 100, client_reference_id: "7", metadata: { plan: "lifetime", product: "pctweaker" } };
  const subs = [
    { id: "cs_old", mode: "subscription", status: "expired", created: 50, client_reference_id: "7", metadata: { plan: "monthly", product: "pctweaker" } },
    { id: "cs_new", mode: "subscription", status: "open", created: 90, client_reference_id: "7", metadata: { plan: "annual", product: "pctweaker" } },
    { id: "cs_after", mode: "subscription", status: "open", created: 500, client_reference_id: "7", metadata: { plan: "annual", product: "pctweaker" } },
  ];
  const calls = [];
  const list = async (params) => {
    calls.push(params);
    if (params.payment_intent === "pi_life") return { data: [lifetime] };
    if (params.payment_intent) return { data: [] };
    return { data: params.customer === "cus_1" ? subs : [] };
  };
  assert.equal((await checkoutOfFailedPayment(list, { id: "pi_life", created: 120, customer: null, description: null })).id, "cs_life");
  assert.equal((await checkoutOfFailedPayment(list, { id: "pi_sub", created: 120, customer: "cus_1", description: "Subscription creation" })).id, "cs_new");
  assert.equal(await checkoutOfFailedPayment(list, { id: "pi_renew", created: 120, customer: "cus_1", description: "Subscription update" }), null);
  assert.equal(calls.filter((p) => p.customer).length, 1, "renewals never look up sessions by customer");
  const f = failedCheckout({ ...lifetime, metadata: { tip_product: "redaxa" } }, 1_761_998_400);
  assert.equal(f.tip, true);
  assert.equal(f.failedAt.toISOString(), "2025-11-01T12:00:00.000Z");
});

test("the failed-payment email: what happened, the other ways to pay, and the same plan one click away", () => {
  const mail = paymentFailedEmail({ email: "a@example.com", firstName: "<b>Eve</b>", locale: null, product: "pctweaker", plan: "lifetime" });
  assert.equal(mail.subject, "Your PC Tweaker payment didn't go through");
  assert.match(mail.html, /Your payment didn(&#39;|')t go through, &lt;b&gt;Eve&lt;\/b&gt;\./);
  assert.match(mail.html, /nothing was charged/i);
  assert.match(mail.text, /another card, Apple Pay, Google Pay or Link/);
  assert.match(mail.html, /href="https:\/\/pctweaker\.app\/#buy-lifetime"/);
  assert.match(mail.text, /Resume checkout: https:\/\/pctweaker\.app\/#buy-lifetime/);
  assert.doesNotMatch(mail.html + mail.text, /discount|limited time|hurry|PayPal/i);
  const un = paymentFailedEmail({ email: "a@example.com", firstName: null, locale: "pt", product: "uninstaller", plan: "annual" });
  assert.equal(un.subject, "O pagamento do PC Tweaker Uninstaller não foi concluído");
  assert.match(un.html, /pctweaker\.app\/uninstaller\/#uninstaller-pro/);
  assert.equal(resumeCheckoutUrl("pctweaker", "../x"), "https://pctweaker.app/#access");
});
