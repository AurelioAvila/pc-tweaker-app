import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash, randomBytes } from "node:crypto";
import pg from "pg";

// Deliberately opt-in: never point a destructive concurrency test at the application database.
const url = process.env.REFERRAL_TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !/^\/referral_test[a-z0-9_]*$/.test(target.pathname)
  ) {
    throw new Error("Referral tests require a loopback-only referral_test database");
  }
}
test("PostgreSQL referral transactions and adversarial races", { skip: !url }, async (t) => {
  const signer = generateKeyPairSync("ed25519");
  const { Referrals, initReferralSchema } = await import("../dist/referrals.js");
  const { ReferralStripe, runReferralReconciliation } = await import("../dist/referral-stripe.js");
  const pool = new pg.Pool({ connectionString: url, ssl: false, max: 20 });
  const env = {
    NODE_ENV: "test",
    REFERRALS_TEST_MODE: "true",
    REFERRALS_ENABLED: "true",
    REFERRALS_CHECKOUT_MODEL: "direct",
    REFERRALS_POLICY_VERSION: "2026-10-20-v1",
    REFERRALS_HASH_KEY: randomBytes(32).toString("hex"),
    REFERRALS_STRIPE_ACCOUNT: "acct_test",
    REFERRALS_SIGNING_PRIVATE_KEY: signer.privateKey
      .export({ type: "pkcs8", format: "der" })
      .toString("base64"),
    REFERRALS_NATIVE_PUBLIC_KEY: signer.publicKey
      .export({ type: "spki", format: "der" })
      .subarray(-32)
      .toString("base64"),
  };
  let now = new Date("2026-10-20T12:00:00Z");
  const core = new Referrals(pool, env, () => new Date(now));
  const reset = async () => {
    now = new Date("2026-10-20T12:00:00Z");
    env.REFERRALS_ENABLED = "true";
    await pool.query("TRUNCATE users CASCADE");
    await pool.query("TRUNCATE referral_audit,referral_payment_blocks,referral_webhook_receipts");
    await pool.query(`INSERT INTO users(id,email,email_verified) VALUES
      (1,'inviter@example.com',true),(2,'buyer@example.com',true),
      (3,'other@example.com',true),(4,'second@example.com',true),(5,'unverified@example.com',false)`);
  };
  const reserve = async (buyer = 2, inviter = 1, plan = "monthly") => {
    await core.claim(buyer, await core.ownCode(inviter), false);
    return core.reserve(buyer, plan, {
      priceId: "price_test",
      customerId: "cus_test" + buyer,
      base: 799,
      offer: 799,
      currency: "eur",
      params: { metadata: { product: "pctweaker" } },
      expiresAt: new Date(now.getTime() + 3600000),
    });
  };
  const payment = (q) => ({
    quoteId: q.id,
    paymentId: "pi_test" + q.id.replaceAll("-", ""),
    invoiceId: "in_" + q.id,
    buyerId: 2,
    customerId: "cus_test2",
    plan: q.plan,
    priceId: "price_test",
    currency: "eur",
    baseMinor: 799,
    discountMinor: 80,
    cashReceived: 719,
    paidAt: new Date(now),
    payerFingerprint: "card_buyer",
    inviterFingerprints: ["card_inviter"],
    hasPriorPurchase: false,
    livemode: false,
    accountId: "acct_test",
    state: "paid",
  });
  const ready = async () => {
    const q = await reserve();
    const p = payment(q);
    const id = await core.recordPayment(p);
    now = new Date(now.getTime() + 31 * 86400000);
    await core.mature(id, p);
    return { id, p, q };
  };
  const device = () => {
    const keys = generateKeyPairSync("ed25519");
    return {
      pub: keys.publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64"),
      sign: (payload) => sign(null, Buffer.from(payload), keys.privateKey).toString("base64"),
    };
  };
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT NOT NULL UNIQUE,
      email_verified BOOLEAN NOT NULL,is_pro BOOLEAN DEFAULT false,plan TEXT,stripe_customer_id TEXT,stripe_subscription_id TEXT)`);
    await initReferralSchema(pool);
    await t.test("schema is restart-safe", async () => {
      await initReferralSchema(pool);
    });
    await t.test("two inviters cannot bind the same customer concurrently", async () => {
      await reset();
      const codes = await Promise.all([core.ownCode(1), core.ownCode(3)]);
      const attempts = await Promise.allSettled(codes.map((code) => core.claim(2, code, false)));
      assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal((await pool.query("SELECT * FROM referral_enrolments")).rowCount, 1);
    });
    await t.test("self-referral, unverified email and past purchase are rejected", async () => {
      await reset();
      const code = await core.ownCode(1);
      await assert.rejects(core.claim(1, code, false), /not_eligible/);
      await assert.rejects(core.claim(5, code, false), /verify_email/);
      await assert.rejects(core.claim(2, code, true), /not_eligible/);
    });
    await t.test(
      "parallel checkouts share one immutable quote and plan changes cannot open another",
      async () => {
        await reset();
        await core.claim(2, await core.ownCode(1), false);
        const requests = await Promise.all(
          Array.from({ length: 12 }, () =>
            core.reserve(2, "monthly", {
              priceId: "price_test",
              customerId: "cus_test2",
              base: 799,
              offer: 799,
              currency: "eur",
              params: {},
              expiresAt: new Date(now.getTime() + 3600000),
            }),
          ),
        );
        assert.equal(new Set(requests.map((q) => q.id)).size, 1);
        await assert.rejects(
          core.reserve(2, "annual", {
            priceId: "price_other",
            customerId: "cus_test2",
            base: 5999,
            offer: 5999,
            currency: "eur",
            params: {},
            expiresAt: new Date(now.getTime() + 3600000),
          }),
          /close_existing/,
        );
      },
    );
    await t.test("replayed payment notifications award once under real row locks", async () => {
      await reset();
      const q = await reserve();
      const p = payment(q);
      const ids = await Promise.all(Array.from({ length: 12 }, () => core.recordPayment(p)));
      assert.equal(new Set(ids).size, 1);
      assert.equal((await pool.query("SELECT * FROM referral_rewards")).rowCount, 1);
      assert.equal((await pool.query("SELECT is_pro FROM users WHERE id=1")).rows[0].is_pro, false);
    });
    await t.test("payer reuse across accounts is rejected by a database constraint", async () => {
      await reset();
      const q = await reserve();
      await core.recordPayment(payment(q));
      const other = await reserve(4, 3);
      const p = { ...payment(other), buyerId: 4, customerId: "cus_test4" };
      assert.equal(await core.recordPayment(p), null);
      assert.equal((await core.quote(other.id)).state, "paid");
      assert.equal((await pool.query("SELECT * FROM referral_rewards")).rowCount, 1);
    });
    await t.test(
      "amount, currency, plan, account and test/live mismatches fail closed",
      async () => {
        await reset();
        const p = payment(await reserve());
        for (const changed of [
          { cashReceived: 718 },
          { currency: "usd" },
          { plan: "annual" },
          { accountId: "acct_wrong" },
          { livemode: true },
          { baseMinor: 800 },
          { discountMinor: 79 },
          { customerId: "cus_wrong" },
        ]) {
          await assert.rejects(core.recordPayment({ ...p, ...changed }));
        }
        assert.equal((await pool.query("SELECT * FROM referral_rewards")).rowCount, 0);
      },
    );
    await t.test("a refund received before payment survives a delayed success", async () => {
      await reset();
      const p = payment(await reserve());
      await core.blockPayment(p.paymentId, "revoked", "refunded");
      const id = await core.recordPayment(p);
      now = new Date(now.getTime() + 31 * 86400000);
      await core.mature(id, p);
      assert.equal((await core.summary(1)).rewards[0].state, "revoked");
    });
    await t.test("partial refunds and unknown inviter identity stay on hold", async () => {
      await reset();
      const p = payment(await reserve());
      p.inviterFingerprints = [];
      const id = await core.recordPayment(p);
      now = new Date(now.getTime() + 31 * 86400000);
      await core.mature(id, p);
      assert.equal((await core.summary(1)).rewards[0].state, "hold");
    });
    await t.test(
      "an unsupported payer identity creates a review hold, never an automatic reward",
      async () => {
        await reset();
        const p = { ...payment(await reserve()), payerFingerprint: null };
        const id = await core.recordPayment(p);
        assert.ok(id);
        now = new Date(now.getTime() + 31 * 86400000);
        await core.mature(id, p);
        const reward = (await core.summary(1)).rewards[0];
        assert.equal(reward.state, "hold");
        assert.equal(reward.reason, "payer_identity_review");
        await assert.rejects(core.challenge(1, id, "activate", device().pub), /unavailable/);
      },
    );
    await t.test("a 30-day hold cannot activate early or with stale provider facts", async () => {
      await reset();
      const p = payment(await reserve());
      const id = await core.recordPayment(p);
      const d = device();
      await assert.rejects(core.challenge(1, id, "activate", d.pub), /unavailable/);
      now = new Date(now.getTime() + 31 * 86400000);
      await core.mature(id, p);
      const c = await core.challenge(1, id, "activate", d.pub);
      now = new Date(now.getTime() + 61000);
      await assert.rejects(
        core.prove(1, c.id, d.sign(c.payload), "session-token"),
        /payment_check_required/,
      );
      assert.equal((await core.summary(1)).rewards[0].state, "ready");
    });
    await t.test("simultaneous activation on two PCs produces only one bound bonus", async () => {
      await reset();
      const { id } = await ready();
      const devices = [device(), device()];
      const challenges = await Promise.all(
        devices.map((d) => core.challenge(1, id, "activate", d.pub)),
      );
      const attempts = await Promise.allSettled(
        challenges.map((c, i) => core.prove(1, c.id, devices[i].sign(c.payload), "session-token")),
      );
      assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
      const signed = attempts.find((x) => x.status === "fulfilled").value;
      const payload = JSON.parse(signed.payloadJson);
      assert.equal(payload.plan, "referral_bonus");
      assert.equal(payload.schemaVersion, 2);
      assert.equal(payload.sessionHash, createHash("sha256").update("session-token").digest("hex"));
      assert.equal(
        payload.expiresAt,
        Math.floor(new Date("2027-05-20T12:00:00Z").getTime() / 1000),
      );
    });
    await t.test(
      "proof replay, another account, another key and disabled activation are denied",
      async () => {
        await reset();
        const { id } = await ready();
        const d = device();
        const c = await core.challenge(1, id, "activate", d.pub);
        await assert.rejects(
          core.prove(3, c.id, d.sign(c.payload), "other-session"),
          /invalid_proof/,
        );
        await assert.rejects(
          core.prove(1, c.id, device().sign(c.payload), "session-token"),
          /invalid_proof/,
        );
        env.REFERRALS_ENABLED = "false";
        await assert.rejects(
          core.prove(1, c.id, d.sign(c.payload), "session-token"),
          /unavailable/,
        );
        env.REFERRALS_ENABLED = "true";
        await core.prove(1, c.id, d.sign(c.payload), "session-token");
        await assert.rejects(
          core.prove(1, c.id, d.sign(c.payload), "session-token"),
          /invalid_proof/,
        );
        await assert.rejects(core.challenge(1, id, "license", device().pub), /unavailable/);
      },
    );
    await t.test(
      "revocation blocks fresh licence proofs and cannot be undone by old paid events",
      async () => {
        await reset();
        const { id, p } = await ready();
        const d = device();
        const c = await core.challenge(1, id, "activate", d.pub);
        await core.prove(1, c.id, d.sign(c.payload), "session-token");
        const refresh = await core.challenge(1, id, "license", d.pub);
        await core.blockPayment(p.paymentId, "revoked", "refunded");
        await core.mature(id, p);
        await assert.rejects(
          core.prove(1, refresh.id, d.sign(refresh.payload), "session-token"),
          /unavailable/,
        );
        assert.equal((await core.summary(1)).rewards[0].state, "revoked");
      },
    );
    const lifetime = () => pool.query("UPDATE users SET is_pro=true,plan='lifetime' WHERE id=1");
    await t.test("only a Lifetime owner can gift a ready, unused bonus", async () => {
      await reset();
      const { id, p } = await ready();
      await assert.rejects(core.createGift(1, id, "other@example.com"), /unavailable/);
      await lifetime();
      for (const state of ["pending", "hold", "revoked"]) {
        await pool.query("UPDATE referral_rewards SET state=$2 WHERE id=$1", [id, state]);
        await assert.rejects(core.createGift(1, id, "other@example.com"), /unavailable/);
      }
      await pool.query("UPDATE referral_rewards SET state='ready' WHERE id=$1", [id]);
      now = new Date(now.getTime() + 61000);
      await assert.rejects(core.createGift(1, id, "other@example.com"), /payment_check_required/);
      await core.mature(id, p);
      const d = device();
      const c = await core.challenge(1, id, "activate", d.pub);
      await core.prove(1, c.id, d.sign(c.payload), "sender-session");
      await assert.rejects(core.createGift(1, id, "other@example.com"), /unavailable/);
    });
    await t.test(
      "gift email is verified, private, and cannot be the sender or originating buyer",
      async () => {
        await reset();
        const { id } = await ready();
        await lifetime();
        for (const email of ["inviter@example.com", " BUYER@example.com ", "bad"])
          await assert.rejects(core.createGift(1, id, email));
        const gift = await core.createGift(1, id, " OTHER@example.com ");
        assert.match(gift.code, /^[A-Za-z0-9_-]{43}$/);
        assert.equal((await core.createGift(1, id, "other@example.com")).code, gift.code);
        await assert.rejects(core.createGift(1, id, "second@example.com"), /already_sent/);
        await assert.rejects(core.claimGift(4, gift.code), /unavailable/);
        await assert.rejects(core.claimGift(5, gift.code), /verify_email/);
        const row = (await pool.query("SELECT * FROM referral_gifts")).rows[0];
        assert.equal(JSON.stringify(row).includes("other@example.com"), false);
        assert.equal(JSON.stringify(row).includes(gift.code), false);
        assert.equal((await core.summary(4)).rewards.length, 0);
        assert.equal((await core.summary(1)).rewards[0].gift.code, gift.code);
      },
    );
    await t.test(
      "gift reservation invalidates a previously issued sender activation proof",
      async () => {
        await reset();
        const { id } = await ready();
        await lifetime();
        const d = device();
        const c = await core.challenge(1, id, "activate", d.pub);
        const gift = await core.createGift(1, id, "other@example.com");
        await assert.rejects(core.challenge(1, id, "activate", d.pub), /unavailable/);
        await assert.rejects(
          core.prove(1, c.id, d.sign(c.payload), "sender-session"),
          /unavailable/,
        );
        await core.cancelGift(1, id);
        await assert.rejects(core.claimGift(3, gift.code), /unavailable/);
        assert.notEqual((await core.createGift(1, id, "other@example.com")).code, gift.code);
      },
    );
    await t.test(
      "concurrent gift claims transfer once, with no onward gift or sender take-back",
      async () => {
        await reset();
        const { id } = await ready();
        await lifetime();
        const gift = await core.createGift(1, id, "other@example.com");
        const results = await Promise.all(
          Array.from({ length: 10 }, () => core.claimGift(3, gift.code)),
        );
        assert.equal(
          results.every((x) => x.claimed),
          true,
        );
        const row = (await pool.query("SELECT * FROM referral_rewards WHERE id=$1", [id])).rows[0];
        assert.equal(row.beneficiary_id, 3);
        assert.equal(row.activated_at, null);
        assert.equal(
          (await pool.query("SELECT * FROM referral_audit WHERE action='gift_claimed'")).rowCount,
          1,
        );
        await assert.rejects(core.cancelGift(1, id), /unavailable/);
        await pool.query("UPDATE users SET is_pro=true,plan='lifetime' WHERE id=3");
        await assert.rejects(core.createGift(3, id, "second@example.com"), /unavailable/);
        const original = (await core.summary(1)).rewards[0];
        assert.equal(original.gift.role, "sender");
        assert.equal(original.gift.state, "claimed");
        assert.equal(original.gift.code, undefined);
        assert.equal(original.canGift, false);
      },
    );
    await t.test(
      "cancel racing with claim has one winner and never restores a claimed gift",
      async () => {
        await reset();
        const { id } = await ready();
        await lifetime();
        const gift = await core.createGift(1, id, "other@example.com");
        const results = await Promise.allSettled([
          core.cancelGift(1, id),
          core.claimGift(3, gift.code),
        ]);
        assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
        const row = (await pool.query("SELECT * FROM referral_gifts")).rows[0];
        const reward = (await pool.query("SELECT * FROM referral_rewards")).rows[0];
        assert.equal(reward.beneficiary_id, row.state === "claimed" ? 3 : null);
      },
    );
    await t.test(
      "gift checks current email, feature flag, provider freshness and payment blocks",
      async () => {
        await reset();
        const { id, p } = await ready();
        await lifetime();
        const gift = await core.createGift(1, id, "other@example.com");
        await pool.query("UPDATE users SET email='changed@example.com' WHERE id=3");
        await assert.rejects(core.claimGift(3, gift.code), /unavailable/);
        await pool.query("UPDATE users SET email='other@example.com' WHERE id=3");
        env.REFERRALS_ENABLED = "false";
        await assert.rejects(core.claimGift(3, gift.code), /unavailable/);
        env.REFERRALS_ENABLED = "true";
        now = new Date(now.getTime() + 61000);
        await assert.rejects(core.claimGift(3, gift.code), /payment_check_required/);
        await core.mature(id, p);
        await core.blockPayment(p.paymentId, "revoked", "refunded");
        await assert.rejects(core.claimGift(3, gift.code), /unavailable/);
      },
    );
    await t.test(
      "recipient activation starts the original duration on one PC and refunds revoke its refresh",
      async () => {
        await reset();
        const { id, p } = await ready();
        await lifetime();
        const gift = await core.createGift(1, id, "other@example.com");
        await core.claimGift(3, gift.code);
        now = new Date(now.getTime() + 10 * 86400000);
        await core.mature(id, p);
        const d = device();
        const c = await core.challenge(3, id, "activate", d.pub);
        await assert.rejects(core.challenge(1, id, "activate", d.pub), /unavailable/);
        const result = JSON.parse(
          (await core.prove(3, c.id, d.sign(c.payload), "recipient-session")).payloadJson,
        );
        assert.equal(result.userId, "3");
        assert.equal(result.grantId, id);
        assert.equal(
          result.expiresAt,
          Math.floor(new Date("2027-05-30T12:00:00Z").getTime() / 1000),
        );
        assert.equal(
          result.sessionHash,
          createHash("sha256").update("recipient-session").digest("hex"),
        );
        await assert.rejects(core.challenge(3, id, "license", device().pub), /unavailable/);
        const refresh = await core.challenge(3, id, "license", d.pub);
        await core.blockPayment(p.paymentId, "revoked", "refunded");
        await assert.rejects(
          core.prove(3, refresh.id, d.sign(refresh.payload), "recipient-session"),
          /unavailable/,
        );
        assert.equal((await core.summary(3)).rewards[0].state, "revoked");
      },
    );
    await t.test(
      "provider timeouts retry the same coupon and checkout without a fresh financial occurrence",
      async () => {
        await reset();
        await core.claim(2, await core.ownCode(1), false);
        await pool.query("UPDATE users SET stripe_customer_id='cus_test2' WHERE id=2");
        const entries = new Map();
        const occurrences = new Map();
        let timeout = true;
        const pages = () => ({ async *[Symbol.asyncIterator]() {} });
        const provider = {
          accounts: { retrieve: async () => ({ id: "acct_test" }) },
          invoices: { list: pages },
          prices: {
            retrieve: async () => ({
              id: "price_test",
              active: true,
              currency: "eur",
              unit_amount: 799,
            }),
          },
          coupons: {
            create: async (params, options) => {
              assert.equal(params.duration, "once");
              assert.equal(params.max_redemptions, 1);
              assert.equal(params.amount_off, 80);
              entries.set(options.idempotencyKey, JSON.stringify(params));
              return { id: params.id };
            },
          },
          checkout: {
            sessions: {
              list: pages,
              create: async (params, options) => {
                assert.match(options.idempotencyKey, /^ref-checkout-/);
                assert.equal(params.customer, "cus_test2");
                assert.equal(Object.hasOwn(params, "allow_promotion_codes"), false);
                assert.deepEqual(params.payment_method_types, ["card"]);
                const before = occurrences.get(options.idempotencyKey);
                if (before) assert.equal(before.params, JSON.stringify(params));
                const result = before ?? {
                  params: JSON.stringify(params),
                  session: {
                    id: "cs_test_referraltest",
                    url: "https://checkout.stripe.com/c/pay/test",
                  },
                };
                occurrences.set(options.idempotencyKey, result);
                if (timeout) {
                  timeout = false;
                  throw new Error("Simulated timeout after provider accepted checkout");
                }
                return result.session;
              },
            },
          },
        };
        const gateway = new ReferralStripe(core, provider);
        const params = {
          mode: "subscription",
          client_reference_id: "2",
          metadata: { product: "pctweaker", userId: "2", plan: "monthly" },
          subscription_data: { metadata: { product: "pctweaker" } },
          line_items: [{ price: "price_test", quantity: 1 }],
          success_url: "https://pctweaker.app/",
          cancel_url: "https://pctweaker.app/",
        };
        await assert.rejects(gateway.checkout(2, "monthly", params), /Simulated timeout/);
        const links = await Promise.all(
          Array.from({ length: 8 }, () => gateway.checkout(2, "monthly", params)),
        );
        assert.equal(new Set(links.map((x) => x.url)).size, 1);
        assert.equal(entries.size, 1);
        assert.equal(occurrences.size, 1);
        assert.equal((await pool.query("SELECT * FROM referral_quotes")).rowCount, 1);
      },
    );
    await t.test(
      "reconciliation recovers a lost session write and backs off without starving another quote",
      async () => {
        await reset();
        const first = await reserve();
        const second = await reserve(4, 3);
        await pool.query("UPDATE referral_quotes SET expires_at=now()-INTERVAL '1 hour'");
        const visited = [];
        const adapter = {
          core,
          reconcileQuote: async (id) => {
            visited.push(id);
            if (id === first.id) throw new Error("Simulated provider outage");
          },
        };
        await runReferralReconciliation(adapter);
        assert.deepEqual(new Set(visited), new Set([first.id, second.id]));
        await runReferralReconciliation(adapter);
        assert.equal(visited.length, 2);
        assert.equal(
          (await pool.query("SELECT min(reconcile_attempts) AS attempts FROM referral_quotes"))
            .rows[0].attempts,
          1,
        );
      },
    );
  } finally {
    await pool.end();
  }
});
