// Waitlists ride on the shared list: a waitlist form adds the address to the
// list (new addresses only) and always to the waitlist, so an address already
// subscribed from the footer still counts and can still be told at launch.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sinkDir = fs.mkdtempSync(path.join(os.tmpdir(), "waitlist-sink-"));
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

const signup = (email, source) =>
  fetch(`http://127.0.0.1:${server.address().port}/api/newsletter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, source }),
  });
const query = async (sql, params) => (await getPool().query(sql, params)).rows;
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
const mails = () => fs.readdirSync(sinkDir).filter((f) => f.endsWith(".html"));

test("a new address joins the list and the waitlist, with the waitlist's welcome", async () => {
  assert.equal((await signup("new@example.com", "linux-check")).status, 200);
  await settle();
  assert.deepEqual(await query("SELECT source FROM newsletter_subscribers WHERE email = $1", ["new@example.com"]), [{ source: "linux-check" }]);
  assert.deepEqual(await query("SELECT waitlist FROM newsletter_waitlists WHERE email = $1", ["new@example.com"]), [{ waitlist: "linux-check" }]);
  assert.deepEqual(mails().map((f) => f.replace(/^.*?Z-/, "")), ["you-re-on-the-ready-for-linux-waitlist.html"]);
  const text = fs.readFileSync(path.join(sinkDir, mails()[0].replace(/\.html$/, ".txt")), "utf8");
  assert.match(text, /https:\/\/pctweaker\.app\/will-my-games-work-on-linux\//);
  assert.match(text, /Unsubscribe with one click/);
});

test("an address already on the list keeps its source, joins the waitlist once and gets no second email", async () => {
  await signup("footer@example.com", "site-footer");
  await settle();
  const before = mails().length;
  for (let i = 0; i < 2; i++) assert.equal((await signup("Footer@example.com", "redaxa-linux")).status, 200);
  await settle();
  assert.deepEqual(await query("SELECT source FROM newsletter_subscribers WHERE lower(email) = $1", ["footer@example.com"]), [{ source: "site-footer" }]);
  assert.deepEqual(await query("SELECT waitlist FROM newsletter_waitlists WHERE lower(email) = $1", ["footer@example.com"]), [{ waitlist: "redaxa-linux" }]);
  assert.equal(mails().length, before, "no email for an address that was already subscribed");
});

test("the Redaxa waitlist welcome names Redaxa and the shared list", async () => {
  await signup("redaxa@example.com", "redaxa-linux");
  await settle();
  const file = mails().find((f) => f.includes("redaxa-for-linux-waitlist"));
  assert.ok(file, "Redaxa waitlist welcome sent");
  const text = fs.readFileSync(path.join(sinkDir, file.replace(/\.html$/, ".txt")), "utf8");
  assert.match(text, /Redaxa for Linux is ready to download/);
  assert.match(text, /share one mailing list/);
});

test("an unknown source is recorded as the footer and joins no waitlist", async () => {
  await signup("other@example.com", "something-else");
  assert.deepEqual(await query("SELECT source FROM newsletter_subscribers WHERE email = $1", ["other@example.com"]), [{ source: "site-footer" }]);
  assert.deepEqual(await query("SELECT waitlist FROM newsletter_waitlists WHERE email = $1", ["other@example.com"]), []);
});

// Redaxa's site may post to the list, and only to the list.
test("Redaxa's origin is allowed on /api/newsletter only", async (t) => {
  const port = 30_000 + Math.floor(Math.random() * 20_000);
  const env = { ...process.env, PORT: String(port) };
  for (const key of ["DATABASE_URL", "STRIPE_SECRET_KEY", "RAILWAY_ENVIRONMENT_ID", "CLIENT_IP_HEADER", "CORS_ORIGINS"]) delete env[key];
  const child = spawn(process.execPath, ["dist/index.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => String(chunk).includes("listening") && resolve());
    child.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
  });
  const preflight = (route) =>
    fetch(`http://127.0.0.1:${port}${route}`, {
      method: "OPTIONS",
      headers: { Origin: "https://redaxa.getcertsprint.com", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
    });
  const list = await preflight("/api/newsletter");
  assert.equal(list.headers.get("access-control-allow-origin"), "https://redaxa.getcertsprint.com");
  const support = await preflight("/api/support");
  assert.equal(support.headers.get("access-control-allow-origin"), null);
});
