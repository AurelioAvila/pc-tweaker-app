// The public form can never undo an opt-out: anyone can type any address.
// A previously unsubscribed address gets a confirmation link instead, and the
// form answers the same way whatever the address's history.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sinkDir = fs.mkdtempSync(path.join(os.tmpdir(), "resubscribe-sink-"));
process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "test-secret";
process.env.RESEND_API_KEY = "test-only";
process.env.MAIL_FROM = "PC Tweaker <test@example.com>";
process.env.EMAIL_SINK = "1";
process.env.EMAIL_SINK_DIR = sinkDir;
after(() => fs.rmSync(sinkDir, { recursive: true, force: true }));

const { default: express } = await import("express");
const { initSchema, getPool } = await import("../dist/db.js");
const newsletterModule = await import("../dist/routes/newsletter.js");
const routes = newsletterModule.default.default ?? newsletterModule.default;
await initSchema();

const app = express();
app.use(express.json());
app.use("/api/newsletter", routes);
const server = app.listen(0);
after(() => server.close());
const base = () => `http://127.0.0.1:${server.address().port}/api/newsletter`;

const email = "left@example.com";
const sign = (prefix) => crypto.createHmac("sha256", "test-secret").update(`${prefix}${email}`).digest("hex");
const signup = async (address) => {
  const res = await fetch(base(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: address }) });
  return { status: res.status, body: await res.text() };
};
const optedOut = async () =>
  Boolean((await getPool().query("SELECT unsubscribed_at FROM newsletter_subscribers WHERE lower(email) = $1", [email])).rows[0]?.unsubscribed_at);
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
const sent = (word) => fs.readdirSync(sinkDir).filter((f) => f.endsWith(".html") && f.includes(word)).length;

test("re-subscribing needs the emailed confirmation, and the form looks the same", async () => {
  const fresh = await signup("brand-new@example.com");
  await fetch(`${base()}/unsubscribe?email=${encodeURIComponent(email)}&sig=${sign("")}`, { method: "POST" });
  assert.equal(await optedOut(), true);

  const again = await signup(email);
  assert.deepEqual(again, fresh, "same answer for a new and an opted-out address");
  await settle();
  assert.equal(await optedOut(), true, "the form alone never clears the opt-out");
  assert.equal(sent("rejoin"), 1, "a confirmation was mailed");

  await signup(email);
  await settle();
  assert.equal(sent("rejoin"), 1, "at most one confirmation a day per address");

  const unsubscribeSig = sign("");
  assert.equal((await fetch(`${base()}/resubscribe?email=${encodeURIComponent(email)}&sig=${unsubscribeSig}`, { method: "POST" })).status, 400, "an unsubscribe link cannot re-subscribe");
  const confirm = `${base()}/resubscribe?email=${encodeURIComponent(email)}&sig=${sign("resubscribe:")}`;
  assert.equal((await fetch(confirm)).status, 200);
  assert.equal(await optedOut(), true, "opening the link only asks");
  assert.equal((await fetch(confirm, { method: "POST" })).status, 200);
  assert.equal(await optedOut(), false);
});
