// The account's PC list: each account sees only its own installations, the
// asking installation is marked, labels are sanitised, and no identifier or
// hash ever leaves the server.
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import express from "express";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "synthetic-local-devices-test-not-a-production-secret";
process.env.LICENSE_SIGNING_PRIVATE_KEY_V2 = generateKeyPairSync("ed25519").privateKey
  .export({ format: "der", type: "pkcs8" }).toString("base64");
delete process.env.STRIPE_SECRET_KEY;
const { initSchema, getPool } = await import("../dist/db.js");
const { signToken } = await import("../dist/auth.js");
const { deviceLabel, recordInstall, INSTALL_RETENTION_DAYS } = await import("../dist/install-count.js");
// Compiled CommonJS: the router is the module's `default` export.
const accountRoutes = (await import("../dist/routes/account.js")).default.default;
const licenseRoutes = (await import("../dist/routes/license.js")).default.default;
await initSchema();

const app = express();
app.use("/api/account", accountRoutes);
app.use("/api/license", licenseRoutes);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const INSTALL_A1 = "3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f";
const INSTALL_A2 = "7c9d0e1f-2a3b-4c5d-9e6f-7a8b9c0d1e2f";
const INSTALL_B = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

async function user(email) {
  const { rows } = await getPool().query("INSERT INTO users (email, password_hash) VALUES ($1, 'fixture') RETURNING id", [email]);
  return { id: rows[0].id, token: signToken(rows[0].id, 0) };
}
const devices = (token, install) =>
  fetch(`${base}/api/account/devices`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(install ? { "X-Install-Id": install } : {}) },
  });

test("an account lists only its own PCs, marks the asking one and leaks no hash", async () => {
  const a = await user("devices-a@example.com");
  const b = await user("devices-b@example.com");
  // A licence refresh records the installation with its label and plan.
  const refresh = await fetch(`${base}/api/license?sig=2`, {
    headers: {
      Authorization: `Bearer ${a.token}`,
      "X-Install-Id": INSTALL_A1,
      "X-Device-Label": encodeURIComponent("Windows 11 Pro · AMD Ryzen 7 5800X3D"),
    },
  });
  assert.equal(refresh.status, 200);
  assert.equal(await recordInstall(a.id, "uninstaller", INSTALL_A2, { label: "Windows 10 Home · Intel Core i5", pro: true }), true);
  assert.equal(await recordInstall(b.id, "pctweaker", INSTALL_B, { label: "Somebody else's PC", pro: true }), true);

  const response = await devices(a.token, INSTALL_A1);
  assert.equal(response.status, 200);
  const text = await response.text();
  const { devices: list } = JSON.parse(text);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((d) => [d.product, d.label, d.pro, d.current]), [
    ["pctweaker", "Windows 11 Pro · AMD Ryzen 7 5800X3D", false, true],
    ["uninstaller", "Windows 10 Home · Intel Core i5", true, false],
  ]);
  for (const d of list) assert.deepEqual(Object.keys(d).sort(), ["current", "firstSeen", "label", "lastSeen", "pro", "product"]);
  assert.doesNotMatch(text, /[0-9a-f]{32}/i, "no hash or id in the reply");
  assert.ok(!text.includes(INSTALL_A1) && !text.includes("Somebody else"));

  // The other account sees its own PC only; without its install id nothing is "current".
  const other = await (await devices(b.token)).json();
  assert.deepEqual(other.devices.map((d) => [d.label, d.current]), [["Somebody else's PC", false]]);
  // A's install id sent with B's token marks nothing of A's.
  const crossed = await (await devices(b.token, INSTALL_A1)).json();
  assert.equal(crossed.devices.length, 1);
  assert.equal(crossed.devices[0].current, false);
});

test("the list needs a valid session", async () => {
  assert.equal((await devices(null)).status, 401);
  assert.equal((await devices("not-a-token")).status, 401);
  const c = await user("devices-revoked@example.com");
  await getPool().query("UPDATE users SET token_version = 1 WHERE id = $1", [c.id]);
  assert.equal((await devices(c.token)).status, 401);
});

test("a refresh without a label keeps the known one, old installations drop out", async () => {
  const d = await user("devices-keep@example.com");
  await recordInstall(d.id, "pctweaker", INSTALL_A1, { label: "Windows 11 Home · Intel Core Ultra 7", pro: true });
  await recordInstall(d.id, "pctweaker", INSTALL_A1, { pro: false });
  let list = (await (await devices(d.token)).json()).devices;
  assert.deepEqual(list.map((x) => [x.label, x.pro]), [["Windows 11 Home · Intel Core Ultra 7", false]]);
  await getPool().query("UPDATE license_installs SET last_seen = $2 WHERE user_id = $1", [
    d.id, new Date(Date.now() - (INSTALL_RETENTION_DAYS + 1) * 86_400_000),
  ]);
  list = (await (await devices(d.token)).json()).devices;
  assert.deepEqual(list, []);
});

test("labels are decoded, trimmed and refused when unsafe", () => {
  assert.equal(deviceLabel(encodeURIComponent("  Windows 11   Pro · Ryzen  ")), "Windows 11 Pro · Ryzen");
  assert.equal(deviceLabel("Windows%2011"), "Windows 11");
  assert.equal(deviceLabel(encodeURIComponent("x".repeat(120))), "x".repeat(80));
  // A byte-order mark counts as white space and is trimmed away.
  assert.equal(deviceLabel(encodeURIComponent("﻿Windows")), "Windows");
  // Cut by code point: an emoji at the limit stays whole.
  assert.equal(deviceLabel(encodeURIComponent(`${"w".repeat(79)}😀😀`)), `${"w".repeat(79)}😀`);
  for (const bad of [
    undefined, "", "   ", 42, "%E0%A4%A", encodeURIComponent("<img src=x>"), encodeURIComponent("a\u0000b"),
    encodeURIComponent("Windows ‮orP 11"), encodeURIComponent("a​b"), "y".repeat(401),
  ]) {
    assert.equal(deviceLabel(bad), null, String(bad));
  }
});
