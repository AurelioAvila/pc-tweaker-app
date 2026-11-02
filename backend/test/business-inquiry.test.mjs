import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sinkDir = fs.mkdtempSync(path.join(os.tmpdir(), "business-sink-"));
process.env.JWT_SECRET = "test-secret";
process.env.RESEND_API_KEY = "test-only";
process.env.MAIL_FROM = "PC Tweaker <test@example.com>";
process.env.EMAIL_SINK = "1";
process.env.EMAIL_SINK_DIR = sinkDir;
after(() => fs.rmSync(sinkDir, { recursive: true, force: true }));

const { default: express } = await import("express");
const mod = await import("../dist/routes/business-inquiry.js");
const routes = mod.default.default ?? mod.default;
const app = express();
app.use(express.json());
app.use("/api/business-inquiry", routes);
const server = app.listen(0);
after(() => server.close());

const valid = { company: "Acme Net Café", name: "Dana", email: "dana@acme.example", pcs: 40, message: "Esports venue <b>x</b>", consent: true };
const send = (body) =>
  fetch(`http://127.0.0.1:${server.address().port}/api/business-inquiry`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
const mails = () => fs.readdirSync(sinkDir).filter((f) => f.endsWith(".html"));

test("rejects invalid input without sending mail", async () => {
  for (const bad of [
    { ...valid, company: "" }, { ...valid, name: "" }, { ...valid, email: "nope" },
    { ...valid, pcs: 0 }, { ...valid, pcs: 2.5 }, { ...valid, pcs: "many" }, { ...valid, consent: false },
    { ...valid, message: "x".repeat(3001) },
  ]) assert.equal((await send(bad)).status, 400, JSON.stringify(bad).slice(0, 60));
  assert.equal(mails().length, 0);
});

test("honeypot answers 200 and sends nothing", async () => {
  assert.equal((await send({ ...valid, website: "http://spam.example" })).status, 200);
  assert.equal(mails().length, 0);
});

test("a valid request is relayed, escaped, with the sender in Reply-To", async () => {
  const res = await send(valid);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const files = mails();
  assert.equal(files.length, 1);
  const html = fs.readFileSync(path.join(sinkDir, files[0]), "utf8");
  assert.match(html, /Acme Net Café/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
});

test("one address is limited to 5 requests an hour", async () => {
  let last = 200;
  for (let i = 0; i < 6; i++) last = (await send(valid)).status;
  assert.equal(last, 429);
});
