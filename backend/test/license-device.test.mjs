import test from "node:test";
import assert from "node:assert/strict";

import { deviceHashFrom, keyConfigured, signLicense, signingKeyVersionFrom } from "../dist/license.js";

// The desktop apps refuse a licence that names another PC (license.rs
// bound_to); the backend only ever signs a well-formed hash into it.
test("only a lower-case SHA-256 from X-Device-Hash is signed into the licence", () => {
  const hash = "0123456789abcdef".repeat(4);
  assert.deepEqual(deviceHashFrom(hash), { deviceHash: hash });
  for (const bad of [undefined, "", hash.toUpperCase(), `${hash}0`, hash.slice(1), "g".repeat(64), ["x"], 42]) {
    assert.deepEqual(deviceHashFrom(bad), {}, String(bad));
  }
});

// 23 Oct 2026 rotation: only an app that asks for key 2 gets it; every
// deployed app (no ?sig) keeps key 1, and key 2 is never a silent fallback.
test("key 2 signs only when asked for and configured", async () => {
  const { generateKeyPairSync, verify } = await import("node:crypto");
  const pair = () => generateKeyPairSync("ed25519");
  const k1 = pair(), k2 = pair();
  process.env.LICENSE_SIGNING_PRIVATE_KEY = k1.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  process.env.LICENSE_SIGNING_PRIVATE_KEY_V2 = k2.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  for (const [query, version] of [[undefined, 1], ["1", 1], ["2", 2], [["2"], 1], ["02", 1]]) {
    assert.equal(signingKeyVersionFrom(query), version, String(query));
  }
  const payload = { userId: "42", isPro: true, plan: "monthly", product: "pctweaker", issuedAt: 1 };
  const check = (signed, key) => verify(null, Buffer.from(signed.payloadJson), key, Buffer.from(signed.signature, "base64"));
  assert.ok(check(signLicense(payload), k1.publicKey));
  assert.ok(check(signLicense(payload, 2), k2.publicKey));
  assert.ok(!check(signLicense(payload, 2), k1.publicKey));

  delete process.env.LICENSE_SIGNING_PRIVATE_KEY_V2;
  assert.equal(keyConfigured(2), false);
  assert.throws(() => signLicense(payload, 2), /key 2 is not configured/);
});
