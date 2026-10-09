import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "reminder-test-secret";
const { initSchema, getPool } = await import("../dist/db.js");
const { remindAbandonedLifetime, lifetimeReminderEmail } = await import("../dist/checkout-recovery.js");
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
  assert.match(mail.html, /Still want Lifetime, &lt;b&gt;Eve&lt;\/b&gt;\?/);
  assert.equal(mail.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(mail.html, /nothing was charged/);
  assert.match(mail.html, /email=a%40example\.com&amp;sig=ab/);
  assert.match(mail.text, /Unsubscribe: https:\/\/api\.pctweaker\.app/);
  assert.doesNotMatch(mail.html + mail.text, /discount|limited time|hurry/i);
});
