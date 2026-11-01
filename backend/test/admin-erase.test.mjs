// The operator erasure route is closed without the admin token and is a dry run unless asked.
// The erasure itself runs on PostgreSQL in referrals-postgres.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.ADMIN_TOKEN = "t".repeat(32);

const express = (await import("express")).default;
const { initSchema, getPool } = await import("../dist/db.js");
const admin = (await import("../dist/routes/admin.js")).default.default;
await initSchema();

const app = express();
app.use(express.json());
app.use("/api/admin", admin);
const server = app.listen(0);
const url = `http://127.0.0.1:${server.address().port}/api/admin/erase-account`;
test.after(() => server.close());
const post = (body, token) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
    body: JSON.stringify(body),
  });

test("without the admin token the route does not exist", async () => {
  await getPool().query("INSERT INTO newsletter_subscribers(email) VALUES('a@example.com')");
  await getPool().query("INSERT INTO newsletter_waitlists(email, waitlist) VALUES('a@example.com', 'linux-check')");
  assert.equal((await post({ email: "a@example.com", erase: true })).status, 404);
  assert.equal((await post({ email: "a@example.com", erase: true }, "x".repeat(32))).status, 404);
  assert.equal((await getPool().query("SELECT 1 FROM newsletter_subscribers")).rows.length, 1);
});

// pg-mem does not undo a rolled-back DELETE: that the dry run keeps every row is checked on
// PostgreSQL. Here: the request shape and that only `erase: true` reports an erasure.
test("with the token: a dry run unless erase is true", async () => {
  const token = process.env.ADMIN_TOKEN;
  assert.equal((await post({}, token)).status, 400);
  assert.equal((await post({ email: ["a@example.com"] }, token)).status, 400);
  const dry = await post({ email: "A@example.com", erase: "yes" }, token);
  assert.deepEqual(await dry.json(), {
    erased: false,
    accountFound: false,
    userId: null,
    counts: { newsletter: 1, waitlists: 1, ratings: 0 },
  });
  assert.equal((await (await post({ email: "a@example.com", erase: true }, token)).json()).erased, true);
});
