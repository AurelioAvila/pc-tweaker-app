import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const url = process.env.CHECKOUT_TEST_DB;
if (url && url !== "postgresql://checkout_test@127.0.0.1:55439/postgres") throw new Error("Only the dedicated local test database is permitted.");
if (!url) { test("isolated PostgreSQL checkout reservation tests", { skip: "CHECKOUT_TEST_DB not set" }, () => {}); } else {
const pool = new pg.Pool({ connectionString: url, ssl: false, max: 20 });
const { initWebCheckoutReservations, WebCheckoutReservations } = await import("../dist/web-checkout-reservations.js");
await pool.query("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY)");
await initWebCheckoutReservations(pool);
const repo = new WebCheckoutReservations(pool);
const { rows: [{ id: userId }] } = await pool.query("INSERT INTO users DEFAULT VALUES RETURNING id");
test("concurrent plans create exactly one reservation", async () => {
 const values = await Promise.all(Array.from({ length: 50 }, (_, i) => repo.reserve(userId, "pctweaker", i % 2 ? "annual" : "lifetime")));
 assert.equal(values.filter(v => v.created).length, 1);
 assert.equal(new Set(values.map(v => v.reservation.reservation_id)).size, 1);
});
test("creation cannot be released; wrong ids cannot attach, complete or release", async () => {
 const { reservation: r } = await repo.reserve(userId, "pctweaker", "annual");
 assert.equal(await repo.releaseVerifiedExpired(r.reservation_id, "cs_fake"), false);
 assert.equal(await repo.attach("00000000-0000-4000-8000-000000000001", "cs_fake"), false);
 assert.equal(await repo.attach(r.reservation_id, `cs_fixture_${userId}`), true);
 assert.equal(await repo.attach(r.reservation_id, "cs_test_other"), false);
 assert.equal(await repo.complete(r.reservation_id, "cs_wrong"), false);
 assert.equal(await repo.releaseVerifiedExpired(r.reservation_id, "cs_wrong"), false);
 assert.equal(await repo.complete(r.reservation_id, `cs_fixture_${userId}`), true);
 assert.equal(await repo.releaseVerifiedExpired(r.reservation_id, `cs_fixture_${userId}`), false);
});
test("verified expiration is required before a new reservation can be created", async () => {
 const { rows: [{ id }] } = await pool.query("INSERT INTO users DEFAULT VALUES RETURNING id");
 const { reservation: r } = await repo.reserve(id, "pctweaker", "annual");
 assert.equal(await repo.attach(r.reservation_id, `cs_expired_${id}`), true);
 assert.equal(await repo.releaseVerifiedExpired(r.reservation_id, `cs_expired_${id}`), true);
 const next = await repo.reserve(id, "pctweaker", "lifetime");
 assert.equal(next.created, true);
 assert.notEqual(next.reservation.reservation_id, r.reservation_id);
});
test("fifty simultaneous coordinator calls create at most one provider session", async () => {
 const { guardedCheckout } = await import("../dist/guarded-checkout.js");
 const { rows: [{ id }] } = await pool.query("INSERT INTO users DEFAULT VALUES RETURNING id");
 let creations = 0;
 const provider = {
  async create(reservationId) { creations++; await new Promise(resolve => setTimeout(resolve, 40)); return { id: `cs_concurrent_${id}`, url: "https://checkout.stripe.com/c/pay/fixture", status: "open", payment_status: "unpaid", metadata: { reservation_id: reservationId } }; },
  async findByReservation() { return []; },
  async onExpired() {},
  async retrieve(sessionId) { const { rows: [row] } = await pool.query("SELECT reservation_id FROM web_checkout_reservations WHERE session_id = $1", [sessionId]); return { id: sessionId, url: "https://checkout.stripe.com/c/pay/fixture", status: "open", payment_status: "unpaid", metadata: { reservation_id: row.reservation_id } }; },
 };
 const outcomes = await Promise.allSettled(Array.from({ length: 50 }, () => guardedCheckout(repo, provider, id, "pctweaker", "annual")));
 assert.equal(creations, 1);
 assert.ok(outcomes.some(item => item.status === "fulfilled"));
 for (const item of outcomes) if (item.status === "rejected") assert.equal(item.reason.code, "checkout_recovery_required");
 const retry = await guardedCheckout(repo, provider, id, "pctweaker", "annual");
 assert.equal(retry.url, "https://checkout.stripe.com/c/pay/fixture");
 assert.equal(creations, 1);
});
test("retiring a reconciled completed checkout is exact and atomic", async () => {
 const { rows: [{ id }] } = await pool.query("INSERT INTO users DEFAULT VALUES RETURNING id");
 const { reservation: r } = await repo.reserve(id, "pctweaker", "annual");
 const session = `cs_finished_${id}`;
 await repo.attach(r.reservation_id, session);
 assert.equal(await repo.releaseReconciledCompleted(r.reservation_id, session), false, "open sessions cannot be retired");
 await repo.complete(r.reservation_id, session);
 assert.equal(await repo.releaseReconciledCompleted(r.reservation_id, "cs_wrong"), false);
 const results = await Promise.all(Array.from({length: 30}, () => repo.releaseReconciledCompleted(r.reservation_id, session)));
 assert.equal(results.filter(Boolean).length, 1);
 const next = await Promise.all(Array.from({length: 30}, () => repo.reserve(id, "pctweaker", "annual")));
 assert.equal(next.filter(item => item.created).length, 1);
});
test("only an old creating reservation can be released as stale, never a recent, open or complete one", async () => {
 const { rows: [{ id: staleUser }] } = await pool.query("INSERT INTO users DEFAULT VALUES RETURNING id");
 const { reservation: r } = await repo.reserve(staleUser, "pctweaker", "annual");
 assert.equal(await repo.releaseStaleCreating(r.reservation_id), false, "fresh: a creation may still be in flight");
 await pool.query("UPDATE web_checkout_reservations SET created_at = now() - interval '16 minutes' WHERE reservation_id = $1", [r.reservation_id]);
 assert.equal(await repo.releaseStaleCreating(r.reservation_id), true);
 assert.equal(await repo.find(staleUser, "pctweaker"), null);
 const { reservation: o } = await repo.reserve(staleUser, "pctweaker", "annual");
 assert.equal(await repo.attach(o.reservation_id, `cs_stale_open_${staleUser}`), true);
 await pool.query("UPDATE web_checkout_reservations SET created_at = now() - interval '2 days' WHERE reservation_id = $1", [o.reservation_id]);
 assert.equal(await repo.releaseStaleCreating(o.reservation_id), false, "an attached session is never released by age");
});
test.after(async () => pool.end());

}
