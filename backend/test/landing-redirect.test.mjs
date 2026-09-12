import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

test("only the retired landing redirects; service routes remain available", { timeout: 20000 }, async (t) => {
  const env = { PORT: "0", DATABASE_URL: "", NODE_ENV: "test" };
  for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP", "PATH"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  const child = spawn(process.execPath, ["-e", `
    const http = require("node:http");
    const listen = http.Server.prototype.listen;
    http.Server.prototype.listen = function (...args) {
      this.once("listening", () => process.send({ port: this.address().port }));
      return listen.apply(this, args);
    };
    global.fetch = async () => { throw new Error("Outbound requests are disabled in this test"); };
    require("./dist/index.js");
  `], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env,
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exit = once(child, "exit");
      child.kill();
      await exit;
    }
  });
  const [message] = await once(child, "message", { signal: AbortSignal.timeout(10000) });
  const base = `http://127.0.0.1:${message.port}`;
  for (const method of ["GET", "HEAD"]) {
    for (const suffix of ["/", "/?code=do-not-forward&redirect=https://example.com"]) {
      const response = await fetch(base + suffix, { method, redirect: "manual" });
      assert.equal(response.status, 301);
      assert.equal(response.headers.get("location"), "https://pctweaker.app/");
      assert.ok(response.headers.get("content-security-policy"));
    }
  }
  for (const route of ["/health", "/privacy", "/terms", "/tiktok-callback", "/checkout-success", "/checkout-cancel"]) {
    const response = await fetch(base + route, { redirect: "manual" });
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get("location"), null, route);
  }
  assert.equal((await fetch(base + "/ready")).status, 503);
  assert.equal((await fetch(base + "/", { method: "POST", redirect: "manual" })).status, 404);
  assert.equal((await fetch(base + "/missing", { redirect: "manual" })).status, 404);
  const webhook = await fetch(base + "/api/stripe-webhook", { method: "POST", redirect: "manual" });
  assert.equal(webhook.status, 503, "Unconfigured billing must not acknowledge events or redirect");
  assert.equal(webhook.headers.get("location"), null);
  assert.equal(webhook.headers.get("cache-control"), "no-store");
});
