// Ratings store the submitting IP (purged after 90 days) and a keyed hash of it.
import { test, after } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "test-secret";

const { default: express } = await import("express");
const { initSchema, getPool } = await import("../dist/db.js");
const reviewsModule = await import("../dist/routes/reviews.js");
const reviewRoutes = reviewsModule.default.default ?? reviewsModule.default;

await initSchema();

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use("/api/reviews", reviewRoutes);
app.use((_err, _req, res, _next) => res.status(500).send("error"));
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/reviews`;
after(() => server.close());

const rate = (email, ip) =>
  fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ name: "x", email, rating: 1, body: "" }),
  });

const hashOf = async (email) =>
  (await getPool().query("SELECT ip_hash FROM reviews WHERE email = $1", [email])).rows[0].ip_hash;

test("same connection under different addresses gets the same hash", async () => {
  assert.equal((await rate("a@example.com", "203.0.113.7, 10.0.0.1")).status, 201);
  assert.equal((await rate("b@example.com", "203.0.113.7")).status, 201);
  const a = await hashOf("a@example.com");
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, await hashOf("b@example.com"));
  assert.ok(!a.includes("203.0.113.7"));
});

test("a different connection gets a different hash", async () => {
  assert.equal((await rate("c@example.com", "198.51.100.9")).status, 201);
  assert.notEqual(await hashOf("c@example.com"), await hashOf("a@example.com"));
});

test("the raw address is stored, and cleared once it is past retention", async () => {
  const ip = async (email) =>
    (await getPool().query("SELECT ip FROM reviews WHERE email = $1", [email])).rows[0].ip;
  assert.equal(await ip("c@example.com"), "198.51.100.9");
  await getPool().query("UPDATE reviews SET confirmed_at = now() - interval '91 days' WHERE email = 'c@example.com'");
  assert.equal((await rate("d@example.com", "192.0.2.1")).status, 201);
  assert.equal(await ip("c@example.com"), null);
  assert.equal(await ip("d@example.com"), "192.0.2.1");
  assert.match(await hashOf("c@example.com"), /^[0-9a-f]{16}$/);
});
