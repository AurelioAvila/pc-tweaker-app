import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
const { initSchema, getPool } = await import("../dist/db.js");
const { queueReceipt, deliverReceipts } = await import("../dist/receipt-outbox.js");
await initSchema();
const db = getPool();
const { rows } = await db.query("INSERT INTO users (email, password_hash) VALUES ('receipt@example.com', 'fixture') RETURNING id");
const receipt = { userId: String(rows[0].id), plan: "lifetime", expiresAt: null, product: "pctweaker", chargedLabel: "€74.99" };

test("a duplicate payment schedules one durable receipt", async () => {
  await queueReceipt("checkout:dedupe", receipt);
  await queueReceipt("checkout:dedupe", receipt);
  let count = 0;
  await deliverReceipts(async (value) => { assert.deepEqual(value, receipt); count++; });
  await deliverReceipts(async () => { count++; });
  assert.equal(count, 1);
});

test("provider failure survives until a later retry without changing access", async () => {
  await queueReceipt("checkout:retry", receipt);
  const now = new Date(Date.now() + 1000);
  await deliverReceipts(async () => { throw new Error("provider offline"); }, now);
  let count = 0;
  await deliverReceipts(async () => { count++; }, now);
  assert.equal(count, 0);
  await deliverReceipts(async () => { count++; }, new Date(now.getTime() + 120_000));
  assert.equal(count, 1);
  const { rows: users } = await db.query("SELECT is_pro FROM users WHERE id = $1", [receipt.userId]);
  assert.equal(users[0].is_pro, false);
});

test("two workers cannot deliver a leased receipt concurrently", async () => {
  await queueReceipt("checkout:concurrent", receipt);
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  let count = 0;
  const first = deliverReceipts(async () => { count++; started(); await blocked; });
  await entered;
  await deliverReceipts(async () => { count++; });
  release();
  await first;
  assert.equal(count, 1);
});

test("an expired lease recovers after an interrupted process", async () => {
  await queueReceipt("checkout:crash", receipt);
  await db.query("UPDATE billing_receipts SET lock_token = 'interrupted', locked_until = $1 WHERE receipt_key = 'checkout:crash'", [new Date(0)]);
  assert.equal(await deliverReceipts(async () => {}), 1);
});
