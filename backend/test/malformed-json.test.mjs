import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// A malformed or oversized JSON body is the client's mistake: 400/413 with the usual JSON error, never a 500.
test("malformed and oversized JSON bodies get client errors, not 500", async (t) => {
  const port = 30_000 + Math.floor(Math.random() * 20_000);
  const env = { ...process.env, PORT: String(port) };
  for (const key of ["DATABASE_URL", "RAILWAY_ENVIRONMENT_ID", "CLIENT_IP_HEADER", "CORS_ORIGINS", "STRIPE_SECRET_KEY"]) delete env[key];
  const server = spawn(process.execPath, ["dist/index.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => server.kill());
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => String(chunk).includes("listening") && resolve());
    server.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
  });
  const post = (body) => fetch(`http://127.0.0.1:${port}/api/newsletter`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body,
  });

  const bad = await post("{bad");
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: "invalid JSON body" });

  const huge = await post(JSON.stringify({ email: "x".repeat(200_000) }));
  assert.equal(huge.status, 413);
  assert.equal(typeof (await huge.json()).error, "string");
});
