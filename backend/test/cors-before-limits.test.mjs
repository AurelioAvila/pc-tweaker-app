import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// A 429 without Access-Control-Allow-Origin reaches the app as "Failed to
// fetch", which it can only report as "check your internet connection".
test("the service-wide limiter answers the app with CORS headers", async (t) => {
  const port = 30_000 + Math.floor(Math.random() * 20_000);
  const env = { ...process.env, PORT: String(port) };
  for (const key of ["DATABASE_URL", "STRIPE_SECRET_KEY", "RAILWAY_ENVIRONMENT_ID", "CLIENT_IP_HEADER"]) delete env[key];
  const server = spawn(process.execPath, ["dist/index.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => server.kill());
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => String(chunk).includes("listening") && resolve());
    server.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
  });

  const origin = "http://tauri.localhost";
  let last;
  for (let i = 0; i < 1_201; i++) {
    last = await fetch(`http://127.0.0.1:${port}/health`, { headers: { Origin: origin } });
    await last.arrayBuffer();
  }
  assert.equal(last.status, 429);
  assert.equal(last.headers.get("access-control-allow-origin"), origin);
  // How long to wait, in whole seconds within the 15-minute window, and
  // readable by the app's script (not a CORS-safelisted header).
  const wait = Number(last.headers.get("retry-after"));
  assert.ok(Number.isInteger(wait) && wait > 0 && wait <= 900, `Retry-After: ${last.headers.get("retry-after")}`);
  assert.match(last.headers.get("access-control-expose-headers") ?? "", /(^|,\s*)Retry-After(\s*,|$)/i);
});
