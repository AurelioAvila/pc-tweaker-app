import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// The tip launcher is a public link: it must refuse anything outside the
// product allow-list, never mint a session for a HEAD, and its CORS widening
// must stay on /api/tip alone.
test("tip routes: product allow-list, HEAD, and CORS scoped to /api/tip", async (t) => {
  const port = 30_000 + Math.floor(Math.random() * 20_000);
  const env = { ...process.env, PORT: String(port), STRIPE_SECRET_KEY: "sk_test_never_called", STRIPE_PRICE_COFFEE: "price_test" };
  for (const key of ["DATABASE_URL", "RAILWAY_ENVIRONMENT_ID", "CLIENT_IP_HEADER", "CORS_ORIGINS"]) delete env[key];
  const server = spawn(process.execPath, ["dist/index.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => server.kill());
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => String(chunk).includes("listening") && resolve());
    server.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
  });
  const api = `http://127.0.0.1:${port}/api`;

  const unknown = await fetch(`${api}/tip/start?product=evil&quantity=2`, { redirect: "manual" });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.headers.get("x-robots-tag"), "noindex, nofollow");
  const twice = await fetch(`${api}/tip/start?product=redaxa&product=glarion`, { redirect: "manual" });
  assert.equal(twice.status, 400);
  const posted = await fetch(`${api}/tip`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://redaxa.getcertsprint.com" }, body: JSON.stringify({ product: "nope" }) });
  assert.equal(posted.status, 400);
  assert.equal(posted.headers.get("access-control-allow-origin"), "https://redaxa.getcertsprint.com", "the error is readable by the site");

  const head = await fetch(`${api}/tip/start?product=redaxa`, { method: "HEAD", redirect: "manual" });
  assert.equal(head.status, 204, "a link checker gets no Checkout session");

  const preflight = (path, origin) => fetch(`${api}${path}`, {
    method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
  });
  for (const origin of ["https://redaxa.getcertsprint.com", "https://glarion.app", "https://pctweaker.app", "http://tauri.localhost"]) {
    assert.equal((await preflight("/tip", origin)).headers.get("access-control-allow-origin"), origin);
  }
  assert.equal((await preflight("/tip", "https://evil.example")).headers.get("access-control-allow-origin"), null);
  assert.equal((await preflight("/checkout", "https://glarion.app")).headers.get("access-control-allow-origin"), null);
  assert.equal((await preflight("/checkout", "https://pctweaker.app")).headers.get("access-control-allow-origin"), "https://pctweaker.app");
});
