// Unsubscribe link checks against the real router, backed by pg-mem.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "test-secret";

const { default: express } = await import("express");
const { initSchema } = await import("../dist/db.js");
const newsletterModule = await import("../dist/routes/newsletter.js");
const newsletterRoutes = newsletterModule.default.default ?? newsletterModule.default;

await initSchema();

const app = express();
app.use("/api/newsletter", newsletterRoutes);
app.use((_err, _req, res, _next) => res.status(500).send("error"));
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/newsletter/unsubscribe`;
after(() => server.close());

const email = "reader@example.com";
const sig = crypto.createHmac("sha256", "test-secret").update(email).digest("hex");
const url = (s) => `${base}?email=${encodeURIComponent(email)}&sig=${encodeURIComponent(s)}`;

test("a valid signature unsubscribes", async () => {
  const res = await fetch(url(sig));
  assert.equal(res.status, 200);
});

test("a non-ASCII signature of the right length is rejected, not a server error", async () => {
  const res = await fetch(url("é".repeat(sig.length)));
  assert.equal(res.status, 400);
});

test("a wrong ASCII signature is rejected", async () => {
  const res = await fetch(url("0".repeat(sig.length)));
  assert.equal(res.status, 400);
});
