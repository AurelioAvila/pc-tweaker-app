import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createPublicKey, sign, verify, randomUUID } from "node:crypto";
import policy from "../dist/referral-policy.js";
import referralLicense from "../dist/referral-license.js";
import { readFileSync } from "node:fs";
import ts from "typescript";

test("new invitations are ten random alphanumeric characters with both letters and numbers", () => {
  for (let i = 0; i < 1024; i++) {
    const code = policy.createInvitationCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{10}$/);
    assert.match(code, /[A-Z]/);
    assert.match(code, /[2-9]/);
    assert.equal(policy.normalizeInvitationCode(code.toLowerCase()), code);
  }
});

test("app, site and backend agree on short and existing invitation codes", async () => {
  const source = readFileSync(new URL("../../src/referral-code.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const frontend = await import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));
  const examples = new Map([
    ["K7M4P9R2X6", "K7M4P9R2X6"],
    [" k7m4p9r2x6 ", "K7M4P9R2X6"],
    ["AbCdEfGhIjKlMnOpQrStUv", "AbCdEfGhIjKlMnOpQrStUv"],
    ["ABCDEFGHIJ", null], ["2345678923", null], ["K7M4P9R2X0", null],
    ["K7M4P9R2XI", null], ["ſ7M4P9R2X6", null], ["K7M4-P9R2X6", null], ["", null],
  ]);
  for (const [input, expected] of examples) {
    assert.equal(policy.normalizeInvitationCode(input), expected);
    assert.equal(frontend.normalizeInvitationCode(input), expected);
  }
  assert.equal(policy.normalizeInvitationCode(null), null);
});

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
  assert.equal(policy.referralsEnabled({ ...env, REFERRALS_CHECKOUT_MODEL: "managed" }), true);
  assert.equal(policy.referralsEnabled({ ...env, REFERRALS_CHECKOUT_MODEL: "unknown" }), false);
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
test("managed referral checkout delegates tax and payment methods to the explicit merchant of record", async () => {
  const { referralCheckoutParams } = await import("../dist/referral-stripe.js");
  const original = {
    mode: "subscription",
    automatic_tax: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    payment_method_types: ["card"],
    allow_promotion_codes: false,
    metadata: { product: "pctweaker" },
  };
  const managed = referralCheckoutParams(original, "managed");
  assert.deepEqual(managed.managed_payments, { enabled: true });
  for (const key of [
    "automatic_tax",
    "customer_update",
    "payment_method_types",
    "allow_promotion_codes",
  ])
    assert.equal(Object.hasOwn(managed, key), false);
  assert.deepEqual(original.automatic_tax, { enabled: true });
  const direct = referralCheckoutParams(original, "direct");
  assert.deepEqual(direct.managed_payments, { enabled: false });
  assert.deepEqual(direct.automatic_tax, { enabled: true });
  assert.deepEqual(direct.customer_update, { address: "auto", name: "auto" });
  assert.throws(() => referralCheckoutParams(original, "unknown"), /unsupported_checkout_model/);
  assert.throws(
    () =>
      referralCheckoutParams(
        { ...original, shipping_address_collection: { allowed_countries: ["IT"] } },
        "managed",
      ),
    /unsupported_referral_offer/,
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
    // Not a server error: the caller falls back to the ordinary checkout price.
    assert.equal(policy.referralQuote(...args), null);
  }
});
test("R5: one invitation per person ignores +tags and Gmail dots", () => {
  for (const [input, expected] of [
    [" Buyer+1@Example.com ", "buyer@example.com"],
    ["j.doe+promo@googlemail.com", "jdoe@gmail.com"],
    ["J.Doe@gmail.com", "jdoe@gmail.com"],
    ["j.doe@example.com", "j.doe@example.com"],
  ])
    assert.equal(policy.canonicalEmail(input), expected);
  assert.equal(policy.INVITER_CAP, 6);
});
test("v3: no maturity delay, and a shared private email domain is a self-invitation", () => {
  // Owner decision of 22 October 2026: the bonus is available as soon as the payment succeeds.
  assert.equal(policy.REFERRAL_VERSION, "2026-10-22-v3");
  assert.equal(Object.hasOwn(policy, "HOLD_DAYS"), false);
  for (const [a, b, expected] of [
    ["me@mydomain.dev", "friend@mydomain.dev", true],
    ["Me+x@MyDomain.dev", "other@mydomain.dev", true],
    ["a@gmail.com", "b@googlemail.com", false],
    ["a@outlook.it", "b@outlook.it", false],
    ["a@libero.it", "b@libero.it", false],
    ["a@company.com", "b@other.com", false],
    ["no-at-sign", "no-at-sign", false],
  ])
    assert.equal(policy.sharesPrivateDomain(a, b), expected, `${a} / ${b}`);
});
test("codes: CSPRNG, unambiguous alphabet, no repeats or sequences in a large sample", () => {
  const seen = new Set();
  const counts = new Map();
  for (let i = 0; i < 50000; i++) {
    const code = policy.createInvitationCode();
    assert.doesNotMatch(code, /[IO01]/);
    seen.add(code);
    for (const ch of code) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  // 32^10 ≈ 1.1e15 codes: a repeat in 50 000 draws would mean a broken generator.
  assert.equal(seen.size, 50000);
  // Every one of the 32 symbols is used, none dominates (uniform within a wide margin).
  assert.equal(counts.size, 32);
  const expected = (50000 * 10) / 32;
  for (const n of counts.values()) assert.ok(Math.abs(n - expected) < expected * 0.1);
});
test("R1: a referral session on an existing customer is valid for Stripe in both models", async () => {
  const { referralCheckoutParams } = await import("../dist/referral-stripe.js");
  // What createCheckoutHandler sends for a Lifetime buyer without a Stripe customer yet.
  const ordinary = {
    mode: "payment",
    customer: "cus_created_for_referral",
    customer_email: "buyer@example.com",
    customer_creation: "always",
    automatic_tax: { enabled: true },
  };
  const direct = referralCheckoutParams(ordinary, "direct");
  assert.deepEqual(direct.customer_update, { address: "auto" });
  assert.equal(Object.hasOwn(direct, "customer_creation"), false);
  assert.equal(Object.hasOwn(direct, "customer_email"), false);
  const managed = referralCheckoutParams(ordinary, "managed");
  assert.equal(Object.hasOwn(managed, "customer_creation"), false);
  assert.equal(Object.hasOwn(managed, "customer_update"), false);
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
