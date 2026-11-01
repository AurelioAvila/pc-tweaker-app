import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// Redaxa's site may read GET /api/billing/prices (the crypto coffee price), and nothing else.
test("billing prices: Redaxa's site may GET them, other routes and methods stay closed to it", async (t) => {
  const port = 30_000 + Math.floor(Math.random() * 20_000);
  const env = { ...process.env, PORT: String(port) };
  for (const key of ["DATABASE_URL", "RAILWAY_ENVIRONMENT_ID", "CLIENT_IP_HEADER", "CORS_ORIGINS", "STRIPE_SECRET_KEY"]) delete env[key];
  const server = spawn(process.execPath, ["dist/index.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => server.kill());
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => String(chunk).includes("listening") && resolve());
    server.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
  });
  const api = `http://127.0.0.1:${port}/api`;
  const redaxa = "https://redaxa.getcertsprint.com";

  const prices = await fetch(`${api}/billing/prices`, { headers: { Origin: redaxa } });
  assert.equal(prices.status, 200);
  assert.equal(prices.headers.get("access-control-allow-origin"), redaxa);
  const evil = await fetch(`${api}/billing/prices`, { headers: { Origin: "https://evil.example" } });
  assert.equal(evil.headers.get("access-control-allow-origin"), null);

  const preflight = (path, method) => fetch(`${api}${path}`, {
    method: "OPTIONS", headers: { Origin: redaxa, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": "authorization" },
  });
  const get = await preflight("/billing/prices", "GET");
  assert.equal(get.headers.get("access-control-allow-origin"), redaxa);
  assert.doesNotMatch(get.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.equal((await preflight("/billing/status", "GET")).headers.get("access-control-allow-origin"), null);
  assert.equal((await preflight("/billing/subscription/cancel", "POST")).headers.get("access-control-allow-origin"), null);
});
