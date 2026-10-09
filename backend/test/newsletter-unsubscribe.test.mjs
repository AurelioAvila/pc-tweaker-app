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

const { getPool } = await import("../dist/db.js");
const { listUnsubscribeHeaders } = newsletterModule.default.default ? newsletterModule.default : newsletterModule;

test("list mail carries one-click unsubscribe headers", () => {
  assert.deepEqual(listUnsubscribeHeaders("https://api.pctweaker.app/u?x=1"), {
    "List-Unsubscribe": "<https://api.pctweaker.app/u?x=1>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
});

const app = express();
app.use(express.json());
app.use("/api/newsletter", newsletterRoutes);
app.use((_err, _req, res, _next) => res.status(500).send("error"));
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/newsletter/unsubscribe`;
after(() => server.close());

const email = "reader@example.com";
const sig = crypto.createHmac("sha256", "test-secret").update(email).digest("hex");
const url = (s) => `${base}?email=${encodeURIComponent(email)}&sig=${encodeURIComponent(s)}`;

const optedOut = async () => {
  const { rows } = await getPool().query(
    "SELECT unsubscribed_at FROM newsletter_subscribers WHERE lower(email) = $1", [email],
  );
  return Boolean(rows[0]?.unsubscribed_at);
};

test("opening the link only asks, so mail scanners cannot unsubscribe anyone", async () => {
  const res = await fetch(url(sig));
  assert.equal(res.status, 200);
  const page = await res.text();
  assert.match(page, /<form method="post" action="\/api\/newsletter\/unsubscribe\?email=reader%40example\.com&amp;sig=/);
  assert.equal(await optedOut(), false);
});

test("the confirm button and an RFC 8058 one-click POST both unsubscribe", async () => {
  const res = await fetch(url(sig), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /unsubscribed/);
  assert.equal(await optedOut(), true);
  assert.equal((await fetch(url("0".repeat(sig.length)), { method: "POST" })).status, 400);
});

test("a non-ASCII signature of the right length is rejected, not a server error", async () => {
  const res = await fetch(url("é".repeat(sig.length)));
  assert.equal(res.status, 400);
});

test("a wrong ASCII signature is rejected", async () => {
  const res = await fetch(url("0".repeat(sig.length)));
  assert.equal(res.status, 400);
});

test("a phone visitor asking for the download link is stored as site-mobile", async () => {
  const res = await fetch(base.replace("/unsubscribe", ""), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "phone@example.com", source: "site-mobile" }),
  });
  assert.equal(res.status, 200);
  const { rows } = await getPool().query(
    "SELECT source FROM newsletter_subscribers WHERE email = 'phone@example.com'",
  );
  assert.equal(rows[0].source, "site-mobile");
});
