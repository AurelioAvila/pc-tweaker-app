import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createPublicKey, sign, verify, randomUUID } from "node:crypto";
import policy from "../dist/referral-policy.js";
import referralLicense from "../dist/referral-license.js";

test("referrals require an explicit, complete versioned opt-in", () => {
  const signer = generateKeyPairSync("ed25519");
  const env = {
    REFERRALS_ENABLED: "true",
    REFERRALS_POLICY_VERSION: policy.REFERRAL_VERSION,
    REFERRALS_CHECKOUT_MODEL: "direct",
    REFERRALS_HASH_KEY: "ab".repeat(32),
    REFERRALS_STRIPE_ACCOUNT: "acct_test",
    REFERRALS_SIGNING_PRIVATE_KEY: signer.privateKey
      .export({ type: "pkcs8", format: "der" })
      .toString("base64"),
    REFERRALS_NATIVE_PUBLIC_KEY: signer.publicKey
      .export({ type: "spki", format: "der" })
      .subarray(-32)
      .toString("base64"),
  };
  assert.equal(policy.referralsEnabled({}), false);
  assert.equal(policy.referralsEnabled(env), true);
  for (const key of Object.keys(env))
    assert.equal(policy.referralsEnabled({ ...env, [key]: "" }), false);
  assert.equal(
    policy.referralsEnabled({ ...env, REFERRALS_SIGNING_PRIVATE_KEY: "not-a-key" }),
    false,
  );
  assert.equal(
    policy.referralsEnabled({
      ...env,
      REFERRALS_NATIVE_PUBLIC_KEY: "QisYr46g3mqEeiz1BDyEcPbRO1xO4z0lR3d5/ODppIU=",
    }),
    false,
  );
});
test("extra 10 percent uses integer cents after an existing offer", () => {
  assert.deepEqual(policy.referralQuote(5999, 2999, "eur"), {
    base: 5999,
    offer: 2999,
    referralSaving: 300,
    totalDiscount: 3300,
    subtotal: 2699,
    currency: "eur",
  });
  assert.equal(policy.referralQuote(799, 799, "eur").subtotal, 719);
  for (const args of [
    [0, 0, "eur"],
    [799, 800, "eur"],
    [799, 700.5, "eur"],
    [799, 700, "usd"],
    [50, 50, "eur"],
    [NaN, 500, "eur"],
  ]) {
    assert.throws(() => policy.referralQuote(...args));
  }
});
test("bonus durations clamp the end of calendar months and leap days", () => {
  assert.equal(
    policy.addCalendarMonths(new Date("2026-08-31T12:30:00Z"), 6).toISOString(),
    "2027-02-28T12:30:00.000Z",
  );
  assert.equal(
    policy.addCalendarMonths(new Date("2024-02-29T12:30:00Z"), 12).toISOString(),
    "2025-02-28T12:30:00.000Z",
  );
  assert.throws(() => policy.addCalendarMonths(new Date(), 120));
});
test("device proof is bound to exact account, purpose, reward and nonce", () => {
  const pair = generateKeyPairSync("ed25519");
  const pub = pair.publicKey
    .export({ type: "spki", format: "der" })
    .subarray(-32)
    .toString("base64");
  const hash = policy.deviceKey(pub).hash;
  const payload = policy.challengePayload(
    1,
    "activate",
    randomUUID(),
    randomUUID(),
    "a".repeat(43),
    hash,
  );
  const signature = sign(null, Buffer.from(payload), pair.privateKey).toString("base64");
  assert.equal(policy.verifyDeviceProof(pub, payload, signature), true);
  assert.equal(policy.verifyDeviceProof(pub, payload.replace("\n1\n", "\n2\n"), signature), false);
  assert.equal(
    policy.verifyDeviceProof(pub, payload.replace("activate", "license"), signature),
    false,
  );
  assert.equal(policy.verifyDeviceProof(pub, payload, signature.slice(1)), false);
  assert.throws(() => policy.deviceKey("not a key"));
});
test("a bonus signature cannot be accepted by the ordinary legacy Pro issuer", () => {
  const pair = generateKeyPairSync("ed25519");
  const environment = {
    REFERRALS_SIGNING_PRIVATE_KEY: pair.privateKey
      .export({ type: "pkcs8", format: "der" })
      .toString("base64"),
    REFERRALS_NATIVE_PUBLIC_KEY: pair.publicKey
      .export({ type: "spki", format: "der" })
      .subarray(-32)
      .toString("base64"),
  };
  const response = referralLicense.signReferralLicense(
    {
      userId: "42",
      isPro: true,
      plan: "referral_bonus",
      product: "pctweaker",
      schemaVersion: 2,
      grantId: randomUUID(),
      deviceKeyHash: "a".repeat(64),
      sessionHash: "b".repeat(64),
      issuedAt: 1000,
      expiresAt: 2000,
    },
    environment,
  );
  const signature = Buffer.from(response.signature, "base64");
  assert.equal(verify(null, Buffer.from(response.payloadJson), pair.publicKey, signature), true);
  const ordinary = createPublicKey({
    type: "spki",
    format: "der",
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from("QisYr46g3mqEeiz1BDyEcPbRO1xO4z0lR3d5/ODppIU=", "base64"),
    ]),
  });
  assert.equal(verify(null, Buffer.from(response.payloadJson), ordinary, signature), false);
});
