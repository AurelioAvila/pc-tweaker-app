import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
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
  const { createInvitationCode } = await import("../dist/referral-policy.js");
  const { ReferralStripe, runReferralReconciliation, referralWebhook } = await import("../dist/referral-stripe.js");
  const { eraseAccount } = await import("../dist/account-erasure.js");
  const pool = new pg.Pool({ connectionString: url, ssl: false, max: 20 });
  const env = {
    NODE_ENV: "test",
    REFERRALS_TEST_MODE: "true",
    REFERRALS_ENABLED: "true",
    REFERRALS_CHECKOUT_MODEL: "direct",
    REFERRALS_POLICY_VERSION: "2026-10-22-v3",
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
  // v3 has no maturity delay; tests that let time pass check that waiting changes nothing.
  const LATER = 121 * 86400000;
  const core = new Referrals(pool, env, () => new Date(now));
  const reset = async () => {
    now = new Date("2026-10-20T12:00:00Z");
    env.REFERRALS_ENABLED = "true";
    await pool.query("TRUNCATE users CASCADE");
    await pool.query(`TRUNCATE referral_audit,referral_payment_blocks,referral_webhook_receipts,
      checkout_reminders,trial_claims,newsletter_subscribers,reviews,dc_sessions,dc_actions,dc_billing_accounts`);
    await pool.query(`INSERT INTO users(id,email,email_verified) VALUES
      (1,'inviter@example.com',true),(2,'buyer@example.net',true),
      (3,'other@example.org',true),(4,'second@second.example',true),(5,'unverified@unverified.example',false)`);
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
  // v3: a verified payment is ready at once (the immediate mature() call changes nothing).
  const ready = async () => {
    const q = await reserve();
    const p = payment(q);
    const id = await core.recordPayment(p);
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
    await pool.query(`CREATE TABLE IF NOT EXISTS sign_in_devices(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fingerprint TEXT NOT NULL,alerted BOOLEAN NOT NULL DEFAULT FALSE,first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),kind TEXT,PRIMARY KEY(user_id,fingerprint))`);
    // The other tables an account erasure touches, as in db.ts.
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT;
      CREATE TABLE IF NOT EXISTS entitlements(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product TEXT NOT NULL,expires_at TIMESTAMPTZ,stripe_subscription_id TEXT,subscription_status TEXT,PRIMARY KEY(user_id,product));
      CREATE TABLE IF NOT EXISTS checkout_reminders(user_id INTEGER PRIMARY KEY,session_id TEXT NOT NULL,sent_at TIMESTAMPTZ NOT NULL);
      CREATE TABLE IF NOT EXISTS trial_claims(product TEXT NOT NULL,user_id INTEGER NOT NULL,email_hash TEXT NOT NULL,
        card_hash TEXT,device_hash TEXT,subscription_id TEXT NOT NULL UNIQUE,PRIMARY KEY(product,user_id));
      CREATE TABLE IF NOT EXISTS newsletter_subscribers(id SERIAL PRIMARY KEY,email TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reviews(id SERIAL PRIMARY KEY,email TEXT,rating SMALLINT NOT NULL);
      CREATE TABLE IF NOT EXISTS dc_sessions(token_hash TEXT PRIMARY KEY,store_scope TEXT NOT NULL,user_id BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS dc_actions(token_hash TEXT PRIMARY KEY,store_scope TEXT NOT NULL,user_id BIGINT NOT NULL,
        email_at_issue TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS dc_billing_accounts(billing_mode TEXT NOT NULL,store_scope TEXT NOT NULL,user_id BIGINT NOT NULL,
        customer_id TEXT,subscription JSONB NOT NULL DEFAULT '{"status":"none","access":false}',
        PRIMARY KEY(billing_mode,store_scope,user_id))`);
    await initReferralSchema(pool);
    await t.test("schema is restart-safe", async () => {
      await initReferralSchema(pool);
    });
    await t.test("short codes are stable under concurrency, ignore case and preserve existing links", async () => {
      await reset();
      const codes = await Promise.all(Array.from({length:8}, () => core.ownCode(1)));
      assert.equal(new Set(codes).size, 1);
      assert.match(codes[0], /^[A-HJ-NP-Z2-9]{10}$/);
      assert.match(codes[0], /[A-Z]/);
      assert.match(codes[0], /[2-9]/);
      assert.equal(await core.codeExists(codes[0].toLowerCase()), true);
      await core.claim(2, codes[0].toLowerCase(), false);
      assert.equal((await core.enrolment(2)).inviter_id, 1);
      const existing = "AbCdEfGhIjKlMnOpQrStUv";
      await pool.query("INSERT INTO referral_accounts(user_id,code) VALUES(3,$1)", [existing]);
      assert.equal(await core.ownCode(3), existing);
      assert.equal(await core.codeExists(existing), true);
      assert.equal(await core.codeExists(existing.toLowerCase()), false);
      await core.claim(4, existing, false);
      assert.equal((await core.enrolment(4)).inviter_id, 3);
    });
    await t.test("codes: a collision retries with a new code; the database refuses duplicates", async () => {
      await reset();
      await pool.query("INSERT INTO referral_accounts(user_id,code) VALUES(3,'TAKEN2345A')");
      const drawn = ["TAKEN2345A", "TAKEN2345A", "FRESH6789B"];
      core.newCode = () => drawn.shift();
      try {
        assert.equal(await core.ownCode(1), "FRESH6789B");
        assert.equal(drawn.length, 0);
        // Every draw colliding: no duplicate is ever stored, the request fails cleanly.
        core.newCode = () => "TAKEN2345A";
        await assert.rejects(core.ownCode(4), /referral_unavailable/);
        assert.equal(
          (await pool.query("SELECT count(*)::int AS n FROM referral_accounts WHERE user_id=4")).rows[0].n,
          0,
        );
      } finally {
        core.newCode = createInvitationCode;
      }
      await assert.rejects(
        pool.query("INSERT INTO referral_accounts(user_id,code) VALUES(4,'FRESH6789B')"),
        (error) => error.code === "23505",
      );
      // Codes are stored upper-case, so case-insensitive matching cannot alias two accounts.
      assert.equal(await core.codeExists("fresh6789b"), true);
      const { rows } = await pool.query(
        "SELECT count(*)::int AS n FROM referral_accounts GROUP BY upper(code) HAVING count(*) > 1",
      );
      assert.equal(rows.length, 0);
    });
    await t.test("v3: the same app installation or private domain cannot invite itself", async () => {
      await reset();
      const code = await core.ownCode(1);
      const seen = (user, fingerprint, kind) =>
        pool.query("INSERT INTO sign_in_devices(user_id,fingerprint,kind) VALUES($1,$2,$3)", [
          user,
          fingerprint,
          kind,
        ]);
      // A shared coarse network (household, mobile carrier) is not evidence of the same PC.
      await seen(1, "net-a", "network");
      await seen(2, "net-a", "network");
      await seen(1, "pc-1", "device");
      await seen(3, "pc-1", "device");
      await assert.rejects(core.claim(3, code, false), /not_eligible/);
      await core.claim(2, code, false);
      await pool.query("UPDATE users SET email='friend@inviter-domain.example' WHERE id=4");
      await pool.query("UPDATE users SET email='me@inviter-domain.example' WHERE id=1");
      await assert.rejects(core.claim(4, code, false), /not_eligible/);
      // The friend later signs in on the inviter's PC before paying: no bonus.
      await pool.query("UPDATE users SET email='inviter@example.com' WHERE id=1");
      const q = await core.reserve(2, "monthly", {
        priceId: "price_test",
        customerId: "cus_test2",
        base: 799,
        offer: 799,
        currency: "eur",
        params: {},
        expiresAt: new Date(now.getTime() + 3600000),
      });
      await seen(2, "pc-1", "device");
      const id = await core.recordPayment(payment(q));
      assert.deepEqual((await pool.query("SELECT state,reason FROM referral_rewards")).rows[0], {
        state: "revoked",
        reason: "shared_device",
      });
      assert.deepEqual((await core.summary(1)).rewards, [{ id, status: "not_eligible" }]);
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
    await t.test("a wrong provider account or test/live mode fails closed", async () => {
      await reset();
      const p = payment(await reserve());
      for (const changed of [{ accountId: "acct_wrong" }, { livemode: true }])
        await assert.rejects(core.recordPayment({ ...p, ...changed }), /environment_mismatch/);
      assert.equal((await pool.query("SELECT * FROM referral_rewards")).rowCount, 0);
    });
    await t.test(
      "R3: a paid purchase that does not match its quote is held for review, never awarded or retried",
      async () => {
        for (const changed of [
          { cashReceived: 718 },
          { currency: "usd" },
          { plan: "annual" },
          { baseMinor: 800 },
          { discountMinor: 79 },
          { customerId: "cus_wrong" },
          // More than Stripe's few seconds of clock difference ahead of this server.
          { paidAt: new Date("2026-10-20T12:10:00Z") },
        ]) {
          await reset();
          const q = await reserve();
          assert.equal(await core.recordPayment({ ...payment(q), ...changed }), null);
          assert.equal((await core.quote(q.id)).state, "paid");
          const rows = (await pool.query("SELECT id,state,reason FROM referral_rewards")).rows;
          assert.equal(rows.length, 1);
          assert.equal(rows[0].state, "hold");
          assert.equal(rows[0].reason, "payment_mismatch_review");
          now = new Date(now.getTime() + LATER);
          await core.mature(rows[0].id, payment(q));
          assert.equal((await pool.query("SELECT state FROM referral_rewards")).rows[0].state, "hold");
        }
      },
    );
    await t.test("a refund received before payment survives a delayed success", async () => {
      await reset();
      const p = payment(await reserve());
      await core.blockPayment(p.paymentId, "revoked", "refunded");
      const id = await core.recordPayment(p);
      now = new Date(now.getTime() + LATER);
      await core.mature(id, p);
      assert.equal((await core.summary(1)).rewards[0].status, "not_eligible");
    });
    await t.test("v3: an inviter without card history still earns at once", async () => {
      // Nothing to compare the friend's card with; the friend's card itself stays unique.
      await reset();
      const p = payment(await reserve());
      p.inviterFingerprints = [];
      const id = await core.recordPayment(p);
      assert.equal((await core.summary(1)).rewards[0].status, "active");
      assert.deepEqual((await pool.query("SELECT state,reason FROM referral_rewards")).rows[0], {
        state: "ready",
        reason: null,
      });
      assert.ok(await core.challenge(1, id, "activate", device().pub));
    });
    await t.test(
      "an unsupported payer identity creates a review hold, never an automatic reward",
      async () => {
        await reset();
        const p = { ...payment(await reserve()), payerFingerprint: null };
        const id = await core.recordPayment(p);
        assert.ok(id);
        now = new Date(now.getTime() + LATER);
        await core.mature(id, p);
        assert.deepEqual((await core.summary(1)).rewards[0], { id, status: "pending" });
        const row = (await pool.query("SELECT state,reason FROM referral_rewards")).rows[0];
        assert.deepEqual(row, { state: "hold", reason: "payer_identity_review" });
        await assert.rejects(core.challenge(1, id, "activate", device().pub), /unavailable/);
      },
    );
    await t.test("v3: the bonus is available as soon as the first payment succeeds", async () => {
      await reset();
      const p = payment(await reserve());
      const id = await core.recordPayment(p);
      const row = (await pool.query("SELECT state,paid_at,eligible_at FROM referral_rewards")).rows[0];
      assert.equal(row.state, "ready");
      assert.equal(row.eligible_at.toISOString(), row.paid_at.toISOString());
      assert.deepEqual((await core.summary(1)).rewards[0], {
        id,
        status: "active",
        months: 6,
        activatedUntil: null,
        deviceKeyHash: null,
      });
      // Activation works the same minute; the refund safety net is covered by the R7 case.
      const d = device();
      const c = await core.challenge(1, id, "activate", d.pub);
      const signed = await core.prove(1, c.id, d.sign(c.payload), "session-token");
      assert.equal(
        JSON.parse(signed.payloadJson).expiresAt,
        Math.floor(new Date("2027-04-20T12:00:00Z").getTime() / 1000),
      );
    });
    await t.test(
      "R7: activation and refreshes use stored webhook state, not a fresh provider check",
      async () => {
        await reset();
        const { id, p } = await ready();
        const d = device();
        now = new Date(now.getTime() + 3 * 3600000); // hours after the last provider read
        const c = await core.challenge(1, id, "activate", d.pub);
        assert.equal(c.serverTime, Math.floor(now.getTime() / 1000));
        await core.prove(1, c.id, d.sign(c.payload), "session-token");
        now = new Date(now.getTime() + 2 * 86400000);
        const refresh = await core.challenge(1, id, "license", d.pub);
        await core.prove(1, refresh.id, d.sign(refresh.payload), "session-token");
        // A refund webhook stored afterwards is enough to stop the next refresh.
        const next = await core.challenge(1, id, "license", d.pub);
        await core.blockPayment(p.paymentId, "revoked", "charge.refunded");
        await assert.rejects(
          core.prove(1, next.id, d.sign(next.payload), "session-token"),
          /unavailable/,
        );
      },
    );
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
        Math.floor(new Date("2027-04-20T12:00:00Z").getTime() / 1000),
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
        assert.equal((await core.summary(1)).rewards[0].status, "not_eligible");
      },
    );
    await t.test("an expired invitation without an open checkout permits ordinary pricing", async () => {
      await reset();
      await core.claim(2, await core.ownCode(1), false);
      await pool.query("UPDATE users SET stripe_customer_id='cus_test2' WHERE id=2");
      now = new Date(now.getTime() + 31 * 86400000);
      const pages = () => ({ async *[Symbol.asyncIterator]() {} });
      const gateway = new ReferralStripe(core, {
        accounts: { retrieve: async () => ({ id: "acct_test" }) },
        invoices: { list: pages },
        prices: {
          retrieve: async () => ({ id: "price_test", active: true, currency: "eur", unit_amount: 799 }),
        },
        checkout: { sessions: { list: pages } },
      });
      const params = {
        mode: "subscription",
        metadata: { product: "pctweaker" },
        line_items: [{ price: "price_test", quantity: 1 }],
      };
      const snapshot = structuredClone(params);
      assert.equal(await gateway.checkout(2, "monthly", params), null);
      assert.equal(
        await gateway.checkout(2, "monthly", {
          ...params,
          subscription_data: { trial_period_days: 7 },
        }),
        null,
      );
      assert.deepEqual(params, snapshot);
      assert.equal((await pool.query("SELECT * FROM referral_quotes")).rowCount, 0);
      assert.equal((await pool.query("SELECT * FROM referral_rewards")).rowCount, 0);
    });
    await t.test("expiry does not bypass an open or uncertain referral checkout", async () => {
      await reset();
      await core.claim(2, await core.ownCode(1), false);
      await pool.query("UPDATE users SET stripe_customer_id='cus_test2' WHERE id=2");
      now = new Date(now.getTime() + 30 * 86400000 - 60000);
      const quote = await reserve();
      await core.saveSession(quote.id, "cs_test_expiry", "https://checkout.stripe.com/c/pay/expiry");
      now = new Date(now.getTime() + 120000);
      const pages = () => ({ async *[Symbol.asyncIterator]() {} });
      let remoteState = "complete";
      const gateway = new ReferralStripe(core, {
        accounts: { retrieve: async () => ({ id: "acct_test" }) },
        invoices: { list: pages },
        prices: {
          retrieve: async () => ({ id: "price_test", active: true, currency: "eur", unit_amount: 799 }),
        },
        checkout: {
          sessions: {
            list: pages,
            retrieve: async () => ({ id: "cs_test_expiry", status: remoteState }),
          },
        },
      });
      const params = {
        mode: "subscription",
        metadata: { product: "pctweaker" },
        line_items: [{ price: "price_test", quantity: 1 }],
      };
      assert.deepEqual(await gateway.checkout(2, "monthly", params), {
        url: "https://checkout.stripe.com/c/pay/expiry",
        sessionId: "cs_test_expiry",
      });
      // A paid session cannot be swapped for another plan.
      await assert.rejects(gateway.checkout(2, "annual", params), /reconciliation_required/);
      now = new Date(now.getTime() + 3600000);
      await assert.rejects(gateway.checkout(2, "monthly", params), /reconciliation_required/);
      assert.equal((await core.quote(quote.id)).state, "open");
      remoteState = "expired";
      assert.equal(await gateway.checkout(2, "monthly", params), null);
      assert.equal((await core.quote(quote.id)).state, "expired");
    });
    await t.test("expiry waits for an in-flight referral reservation before ordinary checkout", async () => {
      await reset();
      await core.claim(2, await core.ownCode(1), false);
      await pool.query("UPDATE users SET stripe_customer_id='cus_test2' WHERE id=2");
      now = new Date(now.getTime() + 30 * 86400000 - 60000);
      const quote = await reserve();
      await core.saveSession(quote.id, "cs_test_race", "https://checkout.stripe.com/c/pay/race");
      const saved = (await pool.query("SELECT * FROM referral_quotes WHERE id=$1", [quote.id])).rows[0];
      await pool.query("DELETE FROM referral_quotes WHERE id=$1", [quote.id]);
      const reservation = await pool.connect();
      let attempt;
      try {
        await reservation.query("BEGIN");
        await reservation.query("SELECT id FROM users WHERE id=2 FOR UPDATE");
        await reservation.query("SELECT id FROM referral_enrolments WHERE buyer_id=2 FOR UPDATE");
        // Represent a reservation validated before expiry but not yet committed.
        await reservation.query(
          "INSERT INTO referral_quotes SELECT * FROM jsonb_populate_record(NULL::referral_quotes,$1::jsonb)",
          [JSON.stringify(saved)],
        );
        now = new Date(now.getTime() + 120000);
        const pages = () => ({ async *[Symbol.asyncIterator]() {} });
        const gateway = new ReferralStripe(core, {
          accounts: { retrieve: async () => ({ id: "acct_test" }) },
          invoices: { list: pages },
          checkout: { sessions: { list: pages } },
        });
        attempt = gateway.checkout(2, "monthly", {
          mode: "subscription",
          metadata: { product: "pctweaker" },
          line_items: [{ price: "price_test", quantity: 1 }],
        }).then((result) => ({ result }), (error) => ({ error }));
        const deadline = Date.now() + 2000;
        let waiting = false;
        while (!waiting && Date.now() < deadline) {
          waiting = (await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
          )).rowCount > 0;
          if (!waiting) await delay(10);
        }
        assert.equal(waiting, true, "checkout must wait for the existing reservation lock");
        await reservation.query("COMMIT");
        const outcome = await attempt;
        assert.equal(outcome.error, undefined);
        assert.deepEqual(outcome.result, { url: "https://checkout.stripe.com/c/pay/race", sessionId: "cs_test_race" });
        assert.equal((await pool.query("SELECT * FROM referral_quotes")).rowCount, 1);
      } finally {
        await reservation.query("ROLLBACK");
        reservation.release();
        if (attempt) await attempt;
      }
    });
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
    // ---- Regression cases for the 21 October 2026 review (R1-R14) ----
    const POLICY = "2026-10-22-v3";
    const pagesOf =
      (items = []) =>
      () => ({
        async *[Symbol.asyncIterator]() {
          yield* items;
        },
      });
    // Records every provider method reached, by path, to measure provider traffic.
    const counted = (tree, calls, path = "") =>
      new Proxy(tree, {
        get(target, key) {
          const value = target[key];
          const name = path ? `${path}.${String(key)}` : String(key);
          if (typeof value === "function")
            return (...args) => {
              calls.push(name);
              return value.apply(target, args);
            };
          if (value && typeof value === "object") return counted(value, calls, name);
          return value;
        },
      });
    const paidProvider = (q, change = {}) => {
      const paidAt = Math.floor(now.getTime() / 1000);
      return {
        accounts: { retrieve: async () => ({ id: "acct_test" }) },
        checkout: {
          sessions: {
            list: pagesOf([]),
            retrieve: async (id) => ({
              id,
              status: "complete",
              payment_status: "paid",
              client_reference_id: "2",
              customer: "cus_test2",
              subscription: "sub_1",
              metadata: { referral_quote: q.id, referral_policy: POLICY, product: "pctweaker" },
              managed_payments: { enabled: false },
              line_items: { data: [{ price: { id: "price_test" }, quantity: 1 }] },
            }),
          },
        },
        invoices: {
          list: (args) =>
            pagesOf(
              args.subscription
                ? [{ id: "in_1", billing_reason: "subscription_create", amount_paid: 719, created: 1 }]
                : [],
            )(),
          retrieve: async () => ({
            id: "in_1",
            payments: { data: [{ payment: { payment_intent: "pi_paid1" } }] },
            lines: {
              data: Array.from({ length: change.lines ?? 1 }, () => ({
                price: { id: "price_test" },
                quantity: 1,
              })),
            },
            subtotal: 799,
            total_discount_amounts: [{ amount: 80 }],
            status_transitions: { paid_at: paidAt },
          }),
        },
        paymentIntents: {
          retrieve: async () => ({
            status: "succeeded",
            customer: "cus_test2",
            currency: change.currency ?? "eur",
            amount_received: 719,
            livemode: false,
            latest_charge: {
              id: "ch_1",
              paid: true,
              captured: true,
              amount_refunded: 0,
              refunded: false,
              disputed: false,
              created: paidAt,
              payment_method_details: { card: { fingerprint: "card_buyer" } },
              // Current provider facts, changeable by a test between events.
              ...change.charge,
            },
          }),
        },
        charges: {
          list: () =>
            pagesOf(
              change.inviterCharges ?? [
                { paid: true, payment_method_details: { card: { fingerprint: "card_inviter" } } },
              ],
            )(),
        },
        paymentMethods: { list: () => pagesOf(change.inviterMethods ?? [])() },
        disputes: { list: () => pagesOf(change.disputes ?? [])() },
        subscriptions: { retrieve: async () => ({ metadata: { referral_quote: q.id } }) },
      };
    };
    const paidQuote = async () => {
      const q = await reserve();
      await pool.query("UPDATE users SET stripe_customer_id='cus_test'||id WHERE id IN (1,2)");
      await core.saveSession(q.id, "cs_test_paid", "https://checkout.stripe.com/c/pay/paid");
      return q;
    };
    const checkoutParams = (extra = {}) => ({
      mode: "subscription",
      client_reference_id: "2",
      metadata: { product: "pctweaker", userId: "2", plan: "monthly" },
      subscription_data: { metadata: { product: "pctweaker" } },
      line_items: [{ price: "price_test", quantity: 1 }],
      success_url: "https://pctweaker.app/",
      cancel_url: "https://pctweaker.app/",
      automatic_tax: { enabled: true },
      customer_email: "buyer@example.com",
      ...extra,
    });
    const checkoutProvider = (create) => ({
      accounts: { retrieve: async () => ({ id: "acct_test" }) },
      invoices: { list: pagesOf([]) },
      prices: {
        retrieve: async () => ({ id: "price_test", active: true, currency: "eur", unit_amount: 799 }),
      },
      coupons: { create: async (params) => ({ id: params.id }), retrieve: async () => null },
      customers: { create: async () => ({ id: "cus_new2" }) },
      checkout: { sessions: { list: pagesOf([]), create } },
    });
    const rewardState = async () =>
      (await pool.query("SELECT state FROM referral_rewards")).rows[0]?.state;

    await t.test(
      "R1: a deterministic provider rejection releases the quote and falls back to the ordinary price",
      async () => {
        await reset();
        await core.claim(2, await core.ownCode(1), false);
        let reject = true;
        const sent = [];
        const gateway = new ReferralStripe(
          core,
          checkoutProvider(async (params) => {
            sent.push(params);
            if (reject)
              throw Object.assign(new Error("Automatic tax requires a customer address"), {
                type: "StripeInvalidRequestError",
                statusCode: 400,
              });
            return { id: "cs_test_second", url: "https://checkout.stripe.com/c/pay/second" };
          }),
        );
        assert.equal(await gateway.checkout(2, "monthly", checkoutParams()), null);
        assert.equal((await pool.query("SELECT state FROM referral_quotes")).rows[0].state, "expired");
        reject = false;
        assert.deepEqual(await gateway.checkout(2, "monthly", checkoutParams()), {
          url: "https://checkout.stripe.com/c/pay/second",
          sessionId: "cs_test_second",
        });
        assert.equal(
          (await pool.query("SELECT * FROM referral_quotes WHERE state='open'")).rowCount,
          1,
        );
        // Direct tax with a customer created on the fly needs Checkout to save the address.
        assert.equal(sent[0].customer, "cus_new2");
        assert.deepEqual(sent[0].customer_update, { address: "auto" });
        assert.equal(Object.hasOwn(sent[0], "customer_email"), false);
        assert.equal(Object.hasOwn(sent[0], "customer_creation"), false);
      },
    );
    await t.test(
      "R1: a lost creation response with no provider session is released after its expiry",
      async () => {
        await reset();
        await core.claim(2, await core.ownCode(1), false);
        await pool.query("UPDATE users SET stripe_customer_id='cus_test2' WHERE id=2");
        const gateway = new ReferralStripe(
          core,
          checkoutProvider(async () => {
            throw new Error("Simulated timeout");
          }),
        );
        await assert.rejects(gateway.checkout(2, "monthly", checkoutParams()), /Simulated timeout/);
        now = new Date(now.getTime() + 61 * 60000);
        await assert.rejects(
          gateway.checkout(2, "monthly", checkoutParams()),
          /checkout_recovery_required/,
        );
        now = new Date(now.getTime() + 15 * 60000);
        const [{ id }] = (await pool.query("SELECT id FROM referral_quotes")).rows;
        await gateway.reconcileQuote(id);
        assert.equal((await core.quote(id)).state, "expired");
        now = new Date(now.getTime() + 31 * 86400000);
        assert.equal(await gateway.checkout(2, "annual", checkoutParams()), null);
      },
    );
    await t.test(
      "R2: reasons the referral cannot apply use the ordinary checkout, without a quote",
      async () => {
        await reset();
        await core.claim(2, await core.ownCode(1), false);
        await pool.query("UPDATE users SET stripe_customer_id='cus_test2' WHERE id=2");
        let prior = [];
        let unit = 799;
        const provider = checkoutProvider(async () => assert.fail("no referral session"));
        provider.invoices.list = () => pagesOf(prior)();
        provider.coupons.retrieve = async () => ({ valid: true, duration: "forever" });
        provider.prices.retrieve = async () => ({
          id: "price_test",
          active: true,
          currency: "eur",
          unit_amount: unit,
        });
        const gateway = new ReferralStripe(core, provider);
        const trial = checkoutParams({ subscription_data: { trial_period_days: 3 } });
        assert.equal(await gateway.checkout(2, "monthly", trial), null);
        const forever = checkoutParams({ discounts: [{ coupon: "forever" }] });
        assert.equal(await gateway.checkout(2, "monthly", forever), null);
        const soon = checkoutParams({ expires_at: Math.floor(now.getTime() / 1000) + 31 * 60 });
        assert.equal(await gateway.checkout(2, "monthly", soon), null);
        unit = 50;
        assert.equal(await gateway.checkout(2, "monthly", checkoutParams()), null);
        unit = 799;
        prior = [
          {
            id: "in_old",
            amount_paid: 799,
            subscription_details: { metadata: { product: "pctweaker" } },
            lines: { data: [] },
          },
        ];
        assert.equal(await gateway.checkout(2, "annual", checkoutParams()), null);
        assert.equal((await pool.query("SELECT * FROM referral_quotes")).rowCount, 0);
        assert.equal(
          (await pool.query("SELECT 1 FROM referral_audit WHERE action LIKE 'ordinary_checkout:%'"))
            .rowCount,
          5,
        );
      },
    );
    await t.test(
      "R3: a mismatching paid checkout is acknowledged once, held for review and frees the buyer",
      async () => {
        await reset();
        const q = await paidQuote();
        const calls = [];
        const gateway = new ReferralStripe(core, counted(paidProvider(q, { currency: "usd" }), calls));
        const event = {
          id: "evt_mismatch",
          type: "checkout.session.completed",
          livemode: false,
          data: { object: { metadata: { referral_quote: q.id } } },
        };
        await referralWebhook(event, gateway);
        assert.equal((await core.quote(q.id)).state, "paid");
        assert.equal(await rewardState(), "hold");
        assert.equal((await pool.query("SELECT * FROM referral_webhook_receipts")).rowCount, 1);
        const before = calls.length;
        await referralWebhook(event, gateway);
        assert.equal(calls.length, before);
        assert.equal(await gateway.checkout(2, "lifetime", checkoutParams()), null);
      },
    );
    await t.test(
      "R3: a permanent provider inconsistency goes to review instead of a retry loop",
      async () => {
        await reset();
        const q = await paidQuote();
        await new ReferralStripe(core, paidProvider(q, { lines: 2 })).reconcileQuote(q.id);
        assert.equal((await core.quote(q.id)).state, "paid");
        assert.equal(
          (
            await pool.query(
              "SELECT 1 FROM referral_audit WHERE action='review:unsupported_referral_invoice'",
            )
          ).rowCount,
          1,
        );
      },
    );
    await t.test("R5: at most six recognised bonuses per inviter in twelve months", async () => {
      await reset();
      await pool.query(`INSERT INTO users(id,email,email_verified)
        SELECT g,'friend'||g||'@f'||g||'.example',true FROM generate_series(10,17) g`);
      const award = async (buyer) => {
        const q = await reserve(buyer, 1);
        return core.recordPayment({
          ...payment(q),
          buyerId: buyer,
          customerId: "cus_test" + buyer,
          paymentId: "pi_cap" + buyer,
          payerFingerprint: "card_" + buyer,
        });
      };
      for (let buyer = 10; buyer < 16; buyer++) await award(buyer);
      const capped = await award(16);
      const row = (await pool.query("SELECT state,reason FROM referral_rewards WHERE id=$1", [capped]))
        .rows[0];
      assert.deepEqual(row, { state: "revoked", reason: "inviter_cap" });
      assert.deepEqual((await core.summary(1)).rewards.find((r) => r.id === capped), {
        id: capped,
        status: "not_eligible",
      });
      // A refunded bonus no longer counts towards the cap.
      await core.blockPayment("pi_cap10", "revoked", "charge.refunded");
      const freed = await award(17);
      assert.equal(
        (await pool.query("SELECT state FROM referral_rewards WHERE id=$1", [freed])).rows[0].state,
        "ready",
      );
    });
    await t.test(
      "R5: a Lifetime inviter's friend saves 10%, but the inviter receives nothing resellable",
      async () => {
        await reset();
        await pool.query("UPDATE users SET is_pro=true,plan='lifetime' WHERE id=1");
        const q = await reserve();
        assert.equal(q.subtotal_minor, 719);
        const id = await core.recordPayment(payment(q));
        const row = (await pool.query("SELECT state,reason FROM referral_rewards")).rows[0];
        assert.deepEqual(row, { state: "revoked", reason: "inviter_lifetime" });
        assert.deepEqual((await core.summary(1)).rewards, [{ id, status: "not_eligible" }]);
        assert.equal(typeof core.createGift, "undefined");
        assert.equal(typeof core.claimGift, "undefined");
      },
    );
    await t.test("R5: address aliases cannot claim a second invitation", async () => {
      await reset();
      await pool.query(`INSERT INTO users(id,email,email_verified) VALUES
        (6,'Buyer+1@example.net',true),(7,'j.doe@gmail.com',true),(8,'JDoe+x@googlemail.com',true)`);
      const code = await core.ownCode(1);
      await core.claim(2, code, false);
      await assert.rejects(core.claim(6, code, false), /not_eligible/);
      await core.claim(7, code, false);
      await assert.rejects(core.claim(8, code, false), /not_eligible/);
    });
    await t.test(
      "R6: the inviter sees only an aggregate state, never the friend's plan, dates, refunds or disputes",
      async () => {
        await reset();
        const p = payment(await reserve());
        const id = await core.recordPayment(p);
        // Available at once; duration is the inviter's own entitlement, dates are not shown.
        assert.deepEqual((await core.summary(1)).rewards, [
          { id, status: "active", months: 6, activatedUntil: null, deviceKeyHash: null },
        ]);
        await core.blockPayment(p.paymentId, "hold", "charge.dispute.created");
        assert.deepEqual((await core.summary(1)).rewards, [{ id, status: "pending" }]);
        await core.blockPayment(p.paymentId, "revoked", "charge.refunded");
        const text = JSON.stringify(await core.summary(1));
        assert.deepEqual((await core.summary(1)).rewards, [{ id, status: "not_eligible" }]);
        for (const leak of ["paid_at", "eligible_at", "reason", "refund", "dispute", "months"])
          assert.equal(text.includes(leak), false, leak);
      },
    );
    await t.test("R14: an active bonus tells the app which device key it is bound to", async () => {
      await reset();
      const { id } = await ready();
      assert.deepEqual((await core.summary(1)).rewards, [
        { id, status: "active", months: 6, activatedUntil: null, deviceKeyHash: null },
      ]);
      const d = device();
      const c = await core.challenge(1, id, "activate", d.pub);
      await core.prove(1, c.id, d.sign(c.payload), "session-token");
      const [reward] = (await core.summary(1)).rewards;
      assert.equal(
        reward.deviceKeyHash,
        createHash("sha256").update(Buffer.from(d.pub, "base64")).digest("hex"),
      );
      assert.equal(new Date(reward.activatedUntil).toISOString(), "2027-04-20T12:00:00.000Z");
    });
    await t.test("R7: claiming with the programme switched off makes no provider call", async () => {
      await reset();
      const code = await core.ownCode(1);
      const calls = [];
      const gateway = new ReferralStripe(core, counted(checkoutProvider(async () => {}), calls));
      env.REFERRALS_ENABLED = "false";
      await assert.rejects(gateway.claim(2, code), /referral_unavailable/);
      assert.deepEqual(calls, []);
      env.REFERRALS_ENABLED = "true";
      await gateway.claim(2, code);
      assert.equal((await core.enrolment(2)).inviter_id, 1);
    });
    await t.test("R8: a cancelled unpaid trial does not exclude an account from invitations", async () => {
      await reset();
      await pool.query("UPDATE users SET stripe_subscription_id='sub_trial',is_pro=false WHERE id=2");
      await core.claim(2, await core.ownCode(1), false);
      assert.equal((await core.enrolment(2)).inviter_id, 1);
    });
    await t.test("R9: a dispute closed in the merchant's favour releases its hold", async () => {
      await reset();
      const q = await paidQuote();
      const gateway = new ReferralStripe(core, paidProvider(q));
      await gateway.reconcileQuote(q.id);
      assert.equal(await rewardState(), "ready");
      const dispute = (type, status) => ({
        id: `evt_${type}_${status}`,
        type,
        livemode: false,
        data: { object: { payment_intent: "pi_paid1", status } },
      });
      await referralWebhook(dispute("charge.dispute.created", "needs_response"), gateway);
      assert.equal(await rewardState(), "hold");
      await referralWebhook(dispute("charge.dispute.closed", "won"), gateway);
      assert.equal(await rewardState(), "ready");
    });
    await t.test(
      "v3: a refund the webhook could not match yet is caught by one re-read 15 minutes later",
      async () => {
        await reset();
        const q = await paidQuote();
        const change = { charge: {}, disputes: [] };
        const gateway = new ReferralStripe(core, paidProvider(q, change));
        await gateway.reconcileQuote(q.id);
        assert.equal(await rewardState(), "ready");
        // Refunded at once, and its webhook never reached us.
        change.charge = { refunded: true, amount_refunded: 719 };
        // a sale recorded two hours after the payment (webhook retries, reconciliation)
        // used to be skipped, since its record was already past paid_at + 15 minutes.
        await pool.query(
          "UPDATE referral_rewards SET paid_at=now()-INTERVAL '2 hours',checked_at=now()-INTERVAL '5 minutes'",
        );
        await runReferralReconciliation(gateway);
        assert.equal(await rewardState(), "ready", "no re-read before 15 minutes");
        await pool.query("UPDATE referral_rewards SET checked_at=now()-INTERVAL '19 minutes'");
        await runReferralReconciliation(gateway);
        assert.equal(await rewardState(), "revoked");
        // One re-read only: a bonus already re-read is not polled again.
        await pool.query("UPDATE referral_quotes SET reconcile_after=NULL");
        await pool.query("UPDATE referral_rewards SET state='ready',checked_at=now()-INTERVAL '1 hour'");
        const calls = [];
        await runReferralReconciliation(new ReferralStripe(core, counted(paidProvider(q), calls)));
        assert.deepEqual(calls, []);
      },
    );
    await t.test(
      "an inviter's own address alias cannot claim their invitation",
      async () => {
        await reset();
        await pool.query("UPDATE users SET email='j.doe+invite@gmail.com' WHERE id=1");
        await pool.query("UPDATE users SET email='JDoe@googlemail.com' WHERE id=2");
        await pool.query("UPDATE users SET email='Inviter+2@Example.com' WHERE id=3");
        const code = await core.ownCode(1);
        await assert.rejects(core.claim(2, code, false), /not_eligible/);
        await pool.query("UPDATE users SET email='inviter@example.com' WHERE id=1");
        await assert.rejects(core.claim(3, code, false), /not_eligible/);
        await core.claim(4, code, false);
        assert.equal((await core.enrolment(4)).inviter_id, 1);
      },
    );
    await t.test(
      "a won dispute does not release a bonus while a partial refund or another dispute remains",
      async () => {
        for (const remaining of ["partial_refund", "other_dispute"]) {
          await reset();
          const q = await paidQuote();
          const change = { charge: {}, disputes: [] };
          const gateway = new ReferralStripe(core, paidProvider(q, change));
          await gateway.reconcileQuote(q.id);
          assert.equal(await rewardState(), "ready");
          const [{ id }] = (await pool.query("SELECT id FROM referral_rewards")).rows;
          const d = device();
          const c = await core.challenge(1, id, "activate", d.pub);
          await core.prove(1, c.id, d.sign(c.payload), "session-token");
          const event = (type, object) => ({
            id: `evt_${type}_${Object.values(object).join("_")}`,
            type,
            livemode: false,
            data: { object: { payment_intent: "pi_paid1", ...object } },
          });
          if (remaining === "partial_refund") {
            // Refund first, dispute second: the dispute event overwrites the stored reason.
            change.charge = { amount_refunded: 100, refunded: false };
            await referralWebhook(event("charge.refunded", { refunded: false }), gateway);
            change.charge = { amount_refunded: 100, refunded: false, disputed: true };
            change.disputes = [{ status: "needs_response" }];
            await referralWebhook(
              event("charge.dispute.created", { status: "needs_response" }),
              gateway,
            );
            change.disputes = [{ status: "won" }];
          } else {
            change.charge = { disputed: true };
            change.disputes = [{ status: "needs_response" }, { status: "needs_response" }];
            await referralWebhook(event("charge.dispute.created", { id: "dp_a" }), gateway);
            await referralWebhook(event("charge.dispute.created", { id: "dp_b" }), gateway);
            change.disputes = [{ status: "won" }, { status: "needs_response" }];
          }
          await referralWebhook(event("charge.dispute.closed", { status: "won" }), gateway);
          assert.equal(await rewardState(), "hold", remaining);
          const refresh = await core.challenge(1, id, "license", d.pub).catch((error) => error);
          if (!(refresh instanceof Error))
            await assert.rejects(
              core.prove(1, refresh.id, d.sign(refresh.payload), "session-token"),
              /unavailable/,
            );
          // Once the provider shows nothing outstanding, the active bonus is restored.
          change.charge = { disputed: true };
          change.disputes = [{ status: "won" }, { status: "won" }];
          await referralWebhook(event("charge.dispute.closed", { status: "won", n: 2 }), gateway);
          assert.equal(await rewardState(), "active", remaining);
          const ok = await core.challenge(1, id, "license", d.pub);
          await core.prove(1, ok.id, d.sign(ok.payload), "session-token");
        }
      },
    );
    await t.test(
      "a deterministic coupon rejection releases the quote and uses the ordinary price",
      async () => {
        await reset();
        await core.claim(2, await core.ownCode(1), false);
        await pool.query("UPDATE users SET stripe_customer_id='cus_test2' WHERE id=2");
        const provider = checkoutProvider(async () => assert.fail("no session without a coupon"));
        let reject = "invalid";
        provider.coupons.create = async (params) => {
          if (reject === "invalid")
            throw Object.assign(new Error("Invalid coupon"), {
              type: "StripeInvalidRequestError",
              statusCode: 400,
            });
          if (reject === "network") throw new Error("Simulated connection reset");
          return { id: params.id };
        };
        const gateway = new ReferralStripe(core, provider);
        assert.equal(await gateway.checkout(2, "monthly", checkoutParams()), null);
        assert.equal(
          (await pool.query("SELECT state FROM referral_quotes")).rows[0].state,
          "expired",
        );
        // An uncertain failure still keeps the reservation for a retry with the same keys.
        reject = "network";
        await assert.rejects(gateway.checkout(2, "monthly", checkoutParams()), /connection reset/);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int AS n FROM referral_quotes WHERE state='creating'",
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test("R12: expired device challenges are removed by the reconciliation worker", async () => {
      await reset();
      const { id } = await ready();
      await core.challenge(1, id, "activate", device().pub);
      now = new Date(now.getTime() + 2 * 86400000);
      await runReferralReconciliation({ core, reconcileQuote: async () => {} });
      assert.equal((await pool.query("SELECT * FROM referral_challenges")).rowCount, 0);
    });
    await t.test(
      "R13: refunds, disputes and renewals outside the programme need no provider call",
      async () => {
        await reset();
        const calls = [];
        const gateway = new ReferralStripe(
          core,
          counted({ accounts: { retrieve: async () => ({ id: "acct_test" }) } }, calls),
        );
        await referralWebhook(
          {
            id: "evt_other_refund",
            type: "charge.refunded",
            livemode: false,
            data: { object: { payment_intent: "pi_uninstaller", refunded: true } },
          },
          gateway,
        );
        await referralWebhook(
          {
            id: "evt_renewal",
            type: "invoice.paid",
            livemode: false,
            data: { object: { billing_reason: "subscription_cycle", subscription: "sub_1" } },
          },
          gateway,
        );
        assert.deepEqual(calls, []);
        // kept as a block in case it is a referral sale still being recorded; pruned
        // after 90 days when no sale ever matches it.
        assert.deepEqual(
          (await pool.query("SELECT payment_id,state FROM referral_payment_blocks")).rows,
          [{ payment_id: "pi_uninstaller", state: "revoked" }],
        );
        now = new Date(now.getTime() + 91 * 86400000);
        await core.cleanup();
        assert.equal((await pool.query("SELECT * FROM referral_payment_blocks")).rowCount, 0);
        now = new Date("2026-10-20T12:00:00Z");
        // A refund of a referral purchase is still recorded and revokes its bonus.
        const { p } = await ready();
        await referralWebhook(
          {
            id: "evt_referral_refund",
            type: "charge.refunded",
            livemode: false,
            data: { object: { payment_intent: p.paymentId, refunded: true } },
          },
          gateway,
        );
        assert.deepEqual(calls, ["accounts.retrieve"]);
        assert.equal(await rewardState(), "revoked");
      },
    );
    await t.test(
      "a refund that arrives while the sale is being recorded withdraws the bonus at once",
      async () => {
        await reset();
        const q = await paidQuote();
        const change = { charge: {}, disputes: [] };
        const provider = paidProvider(q, change);
        // The payment is read as paid; before the reward row exists, the refund webhook lands.
        const read = provider.paymentIntents.retrieve;
        provider.paymentIntents.retrieve = async (...args) => {
          const intent = await read(...args);
          await referralWebhook(
            {
              id: "evt_refund_race",
              type: "charge.refunded",
              livemode: false,
              data: { object: { payment_intent: "pi_paid1", refunded: true } },
            },
            new ReferralStripe(core, paidProvider(q)),
          );
          return intent;
        };
        await new ReferralStripe(core, provider).reconcileQuote(q.id);
        assert.equal(await rewardState(), "revoked", "never ready, not even for 15 minutes");
        const [{ id }] = (await pool.query("SELECT id FROM referral_rewards")).rows;
        await assert.rejects(core.challenge(1, id, "activate", device().pub), /unavailable/);
        // A dispute opened in the same window holds it for review instead.
        await reset();
        const q2 = await paidQuote();
        await referralWebhook(
          {
            id: "evt_dispute_early",
            type: "charge.dispute.created",
            livemode: false,
            data: { object: { payment_intent: "pi_paid1", status: "needs_response" } },
          },
          new ReferralStripe(core, paidProvider(q2)),
        );
        await new ReferralStripe(core, paidProvider(q2)).reconcileQuote(q2.id);
        assert.equal(await rewardState(), "hold");
      },
    );
    await t.test(
      "Stripe's clock a moment ahead, or an asynchronous payment after the quote expired, is a normal sale",
      async () => {
        for (const paidAt of [
          new Date("2026-10-20T12:00:03Z"),
          new Date("2026-10-23T09:00:00Z"),
        ]) {
          await reset();
          const q = await reserve();
          if (paidAt.getDate() === 23) now = new Date("2026-10-23T09:00:05Z");
          const id = await core.recordPayment({ ...payment(q), paidAt });
          assert.ok(id);
          assert.equal(await rewardState(), "ready", paidAt.toISOString());
        }
      },
    );
    await t.test(
      "an inviter's own card pays for the friend even if it never paid for anything itself",
      async () => {
        for (const change of [
          // In a trial: the card is saved on the customer, no paid charge.
          { inviterCharges: [], inviterMethods: [{ card: { fingerprint: "card_buyer" } }] },
          // A failed charge with that card.
          {
            inviterCharges: [{ paid: false, payment_method_details: { card: { fingerprint: "card_buyer" } } }],
          },
        ]) {
          await reset();
          const q = await paidQuote();
          await new ReferralStripe(core, paidProvider(q, change)).reconcileQuote(q.id);
          assert.equal((await pool.query("SELECT * FROM referral_rewards")).rowCount, 0);
          assert.equal(
            (await pool.query("SELECT 1 FROM referral_audit WHERE action='purchase_ineligible'")).rowCount,
            1,
          );
        }
      },
    );
    await t.test(
      "two accounts on one PC (licence PC id) are held for review; other PCs are not",
      async () => {
        await reset();
        const pc = (n) => n.toString(16).padStart(64, "0");
        await core.ownCode(1);
        // Only programme participants are recorded: 3 has neither a code nor an invitation.
        assert.equal(await core.recordMachine(1, pc(1)), true);
        assert.equal(await core.recordMachine(3, pc(1)), false);
        assert.equal(await core.recordMachine(1, "not-a-hash"), false);
        const stored = (await pool.query("SELECT machine_hash FROM referral_machines")).rows;
        assert.equal(stored.length, 1);
        assert.notEqual(stored[0].machine_hash, pc(1), "kept only as a keyed hash");
        // The friend claims elsewhere (a new install id), then uses the inviter's PC before paying.
        const q = await reserve();
        assert.equal(await core.recordMachine(2, pc(1)), true);
        const id = await core.recordPayment(payment(q));
        assert.deepEqual((await pool.query("SELECT state,reason FROM referral_rewards")).rows[0], {
          state: "hold",
          reason: "shared_pc_review",
        });
        assert.deepEqual((await core.summary(1)).rewards, [{ id, status: "pending" }]);
        // a dispute won later does not release that hold.
        await core.blockPayment(payment(q).paymentId, "hold", "charge.dispute.created");
        await core.releaseDisputeHold(payment(q));
        assert.deepEqual((await pool.query("SELECT state,reason FROM referral_rewards")).rows[0], {
          state: "hold",
          reason: "shared_pc_review",
        });
        // A friend on another PC gets the bonus at once.
        await reset();
        await core.ownCode(1);
        await core.recordMachine(1, pc(1));
        const q2 = await reserve();
        await core.recordMachine(2, pc(2));
        await core.recordPayment(payment(q2));
        assert.equal(await rewardState(), "ready");
        // Twelve months without a licence refresh: the PC record is gone.
        now = new Date(now.getTime() + 366 * 86400000);
        await core.cleanup();
        assert.equal((await pool.query("SELECT * FROM referral_machines")).rowCount, 0);
      },
    );
    await t.test("a won dispute re-checks the reward rules it was held under", async () => {
      await reset();
      const p = payment(await reserve());
      await core.blockPayment(p.paymentId, "hold", "charge.dispute.created");
      await core.recordPayment(p);
      assert.equal(await rewardState(), "hold");
      // While held, the inviter bought Lifetime: the dispute is won, the bonus is not released.
      await pool.query("UPDATE users SET is_pro=true,plan='lifetime' WHERE id=1");
      await core.releaseDisputeHold(p);
      assert.deepEqual((await pool.query("SELECT state,reason FROM referral_rewards")).rows[0], {
        state: "revoked",
        reason: "inviter_lifetime",
      });
    });
    await t.test(
      "switching plan closes the open referral checkout and opens one for the new plan",
      async () => {
        await reset();
        await core.claim(2, await core.ownCode(1), false);
        await pool.query("UPDATE users SET stripe_customer_id='cus_test2' WHERE id=2");
        const sessions = new Map();
        const expired = [];
        const provider = checkoutProvider(async (params) => {
          const id = "cs_test_" + params.metadata.referral_quote.replaceAll("-", "");
          sessions.set(id, { id, status: "open" });
          return { id, url: "https://checkout.stripe.com/c/pay/" + id };
        });
        provider.checkout.sessions.retrieve = async (id) => sessions.get(id);
        provider.checkout.sessions.expire = async (id) => {
          expired.push(id);
          sessions.get(id).status = "expired";
          return sessions.get(id);
        };
        const gateway = new ReferralStripe(core, provider);
        const monthly = await gateway.checkout(2, "monthly", checkoutParams());
        const annual = await gateway.checkout(2, "annual", checkoutParams({ metadata: { product: "pctweaker", userId: "2", plan: "annual" } }));
        assert.ok(annual?.url);
        assert.notEqual(annual.url, monthly.url);
        assert.deepEqual(expired, [monthly.url.split("/").pop()], "the monthly page can no longer be paid");
        const quotes = (await pool.query("SELECT plan,state FROM referral_quotes ORDER BY created_at,plan")).rows;
        assert.deepEqual(quotes.map((x) => `${x.plan}:${x.state}`).sort(), ["annual:open", "monthly:expired"]);
      },
    );
    const erase = (email) => eraseAccount(pool, email, { erase: true, now: new Date(now) });
    const rows = async (sql) => (await pool.query(sql)).rows;
    await t.test("referral claim waits until the existing ordinary checkout is closed",async()=>{
      await reset();const {initWebCheckoutReservations,WebCheckoutReservations}=await import('../dist/web-checkout-reservations.js');await initWebCheckoutReservations(pool);
      const repo=new WebCheckoutReservations(pool);const code=await core.ownCode(1);
      const {reservation}=await repo.reserve(2,'pctweaker','annual');await repo.attach(reservation.reservation_id,'cs_referral_claim');
      await assert.rejects(core.claim(2,code,false),e=>e.code==='close_existing_checkout_first');
      assert.equal(await core.enrolment(2),null);
      await repo.releaseVerifiedExpired(reservation.reservation_id,'cs_referral_claim');
      await core.claim(2,code,false);assert.ok(await core.enrolment(2));
    });
    await t.test("concurrent referral claim cannot attach after checkout reservation",async()=>{
      const {initWebCheckoutReservations,WebCheckoutReservations}=await import('../dist/web-checkout-reservations.js');await initWebCheckoutReservations(pool);
      const repo=new WebCheckoutReservations(pool);
      for(let i=0;i<12;i++){
        await reset();const code=await core.ownCode(1);
        const [claim,reservation]=await Promise.allSettled([core.claim(2,code,false),repo.reserve(2,'pctweaker','annual')]);
        assert.equal(reservation.status,'fulfilled');
        if(claim.status==='rejected'){assert.equal(claim.reason.code,'close_existing_checkout_first');assert.equal(await core.enrolment(2),null)}
        else assert.ok(await core.enrolment(2));
      }
    });
    await t.test("account erasure refuses an unresolved ordinary checkout", async () => {
      await reset();
      const { initWebCheckoutReservations, WebCheckoutReservations } = await import("../dist/web-checkout-reservations.js");
      await initWebCheckoutReservations(pool);
      const reservations = new WebCheckoutReservations(pool);
      const { reservation } = await reservations.reserve(2, "pctweaker", "annual");
      await reservations.attach(reservation.reservation_id, "cs_test_erasure_open");
      await assert.rejects(erase("buyer@example.net"), (error) => error.code === "checkout_reconciliation_required");
      assert.equal((await pool.query("SELECT 1 FROM users WHERE id=2")).rowCount, 1);
      assert.equal((await reservations.find(2, "pctweaker"))?.state, "open");
      await reservations.releaseVerifiedExpired(reservation.reservation_id, "cs_test_erasure_open");
      assert.equal((await erase("buyer@example.net")).erased, true);
    });
    await t.test("concurrent account erasure and checkout reservation do not orphan a checkout", async () => {
      const { initWebCheckoutReservations, WebCheckoutReservations } = await import("../dist/web-checkout-reservations.js");
      await initWebCheckoutReservations(pool);
      const reservations = new WebCheckoutReservations(pool);
      for (let i = 0; i < 20; i++) {
        await reset();
        const [deleted, reserved] = await Promise.allSettled([erase("buyer@example.net"), reservations.reserve(2, "pctweaker", "annual")]);
        const user = await pool.query("SELECT 1 FROM users WHERE id=2");
        const checkout = await reservations.find(2, "pctweaker");
        if (deleted.status === "fulfilled") {
          assert.equal(reserved.status, "rejected");
          assert.equal(user.rowCount, 0);
          assert.equal(checkout, null);
        } else {
          assert.equal(deleted.reason.code, "checkout_reconciliation_required");
          assert.equal(reserved.status, "fulfilled");
          assert.equal(user.rowCount, 1);
          assert.ok(checkout);
        }
      }
    });
    await t.test(
      "erasure migration: keys made before 24 Oct without ON DELETE are converted once; deleting a user then works",
      async () => {
        await reset();
        const userKeys = `SELECT c.conname,c.conrelid::regclass::text||'.'||a.attname AS key,c.confdeltype::text AS rule,
          a.attnotnull FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
          WHERE c.contype='f' AND c.confrelid='users'::regclass AND c.conrelid::regclass::text LIKE 'referral%' ORDER BY 2`;
        // The definitions live databases still have: no ON DELETE, NOT NULL, and one key under another name.
        for (const { conname, key } of await rows(userKeys)) {
          const [table, column] = key.split(".");
          if (table === "referral_machines") continue;
          const name = key === "referral_rewards.inviter_id" ? "legacy_inviter_fk" : conname;
          await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT ${conname},
            ADD CONSTRAINT ${name} FOREIGN KEY (${column}) REFERENCES users(id)`);
          await pool.query(`ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL`);
        }
        assert.equal((await rows(userKeys)).filter((k) => k.rule === "a").length, 6);
        const client = await pool.connect();
        const converted = [];
        client.on("notice", (n) => n.message.startsWith("referral schema:") && converted.push(n.message));
        try {
          await initReferralSchema(client);
          assert.equal(converted.length, 6);
          await initReferralSchema(client);
          assert.equal(converted.length, 6, "a restart finds nothing left to convert");
        } finally {
          client.release();
        }
        assert.deepEqual(
          (await rows(userKeys)).map((k) => `${k.key} ${k.rule} ${k.attnotnull ? "not null" : "null"}`),
          [
            "referral_accounts.user_id c not null",
            "referral_challenges.user_id c not null",
            "referral_enrolments.buyer_id n null",
            "referral_enrolments.inviter_id n null",
            "referral_machines.user_id c not null",
            "referral_rewards.buyer_id n null",
            "referral_rewards.inviter_id n null",
          ],
        );
        assert.ok((await rows(userKeys)).some((k) => k.conname === "legacy_inviter_fk"), "kept its own name");
        // An inviter with a code, a bonus, a device challenge and a PC hash; a friend who paid.
        const { id } = await ready();
        await core.challenge(1, id, "activate", device().pub);
        await core.recordMachine(1, "1".repeat(64));
        await pool.query("DELETE FROM users WHERE id IN (1,2)");
        assert.deepEqual(await rows("SELECT buyer_id,inviter_id FROM referral_rewards"), [
          { buyer_id: null, inviter_id: null },
        ]);
        for (const table of ["referral_accounts", "referral_challenges", "referral_machines"])
          assert.equal((await rows(`SELECT 1 FROM ${table}`)).length, 0, table);
      },
    );
    await t.test(
      "erasing a friend who claimed and paid keeps the inviter's bonus valid and every reuse blocked",
      async () => {
        await reset();
        const { id, p } = await ready();
        const d = device();
        const c = await core.challenge(1, id, "activate", d.pub);
        await core.prove(1, c.id, d.sign(c.payload), "session-token");
        await core.recordMachine(2, "2".repeat(64));
        await pool.query(`INSERT INTO sign_in_devices(user_id,fingerprint,kind) VALUES(2,'pc-2','device');
          INSERT INTO checkout_reminders VALUES(2,'cs_test_reminder',now());
          INSERT INTO entitlements(user_id,product) VALUES(2,'uninstaller');
          INSERT INTO trial_claims VALUES('pctweaker',2,'email-hash','card-hash','pc-hash','sub_trial_2');
          INSERT INTO newsletter_subscribers(email) VALUES('Buyer@Example.net');
          INSERT INTO reviews(email,rating) VALUES('buyer@example.net',5);
          INSERT INTO dc_sessions VALUES('s1','pc-tweaker-shared',2),('s2','separate',2);
          INSERT INTO dc_actions VALUES('a1','pc-tweaker-shared',2,'buyer@example.net');
          INSERT INTO dc_billing_accounts(billing_mode,store_scope,user_id,customer_id) VALUES('live','pc-tweaker-shared',2,'cus_tweaky')`);
        assert.deepEqual(await erase("  BUYER@example.net "), {
          erased: true,
          accountFound: true,
          userId: 2,
          counts: {
            tweakySessions: 1,
            tweakyActions: 1,
            tweakyPlans: 1,
            referralCheckoutsDeleted: 0,
            referralInvitationsDeleted: 0,
            referralBonusesWithdrawn: 0,
            checkoutReminders: 1,
            accounts: 1,
            newsletter: 1,
            ratings: 1,
          },
        });
        for (const table of ["users WHERE id=2", "sign_in_devices", "referral_machines", "entitlements"])
          assert.equal((await rows(`SELECT 1 FROM ${table}`)).length, 0, table);
        // Another store's user 2 (Tweaky Driver's own account table) is not this account.
        assert.deepEqual(await rows("SELECT token_hash FROM dc_sessions"), [{ token_hash: "s2" }]);
        // Kept without the link: the trial claim, the email and card hashes, the payment reference.
        assert.equal((await rows("SELECT 1 FROM trial_claims")).length, 1);
        const [enrolment] = await rows("SELECT buyer_id,inviter_id,buyer_email_hash FROM referral_enrolments");
        assert.deepEqual([enrolment.buyer_id, enrolment.inviter_id], [null, 1]);
        assert.match(enrolment.buyer_email_hash, /^[0-9a-f]{64}$/);
        assert.deepEqual(await rows("SELECT customer_id,session_id,checkout_url,params FROM referral_quotes"), [
          { customer_id: "erased", session_id: null, checkout_url: null, params: {} },
        ]);
        assert.deepEqual(await rows("SELECT buyer_id,inviter_id,state,payment_id,invoice_id FROM referral_rewards"), [
          { buyer_id: null, inviter_id: 1, state: "active", payment_id: p.paymentId, invoice_id: null },
        ]);
        // The inviter's bonus keeps refreshing on its PC.
        const refresh = await core.challenge(1, id, "license", d.pub);
        assert.ok(await core.prove(1, refresh.id, d.sign(refresh.payload), "session-token"));
        // The same mailbox on a new account cannot be invited again...
        await pool.query("INSERT INTO users(id,email,email_verified) VALUES(6,'buyer@example.net',true)");
        await assert.rejects(core.claim(6, await core.ownCode(3), false), /not_eligible/);
        // ...and the same card earns no second bonus through another friend.
        const q4 = await reserve(4, 3);
        const second = { ...payment(q4), buyerId: 4, customerId: "cus_test4", paymentId: "pi_second", invoiceId: "in_second" };
        assert.equal(await core.recordPayment(second), null);
        assert.equal((await rows("SELECT 1 FROM referral_rewards")).length, 1);
        // Nothing is re-read from Stripe for an erased buyer (no customer or session is left).
        const calls = [];
        const gateway = new ReferralStripe(
          core,
          counted({ accounts: { retrieve: async () => ({ id: "acct_test" }) } }, calls),
        );
        await gateway.disputeClosed(p.paymentId);
        await gateway.reconcileQuote((await rows("SELECT id FROM referral_quotes WHERE customer_id='erased'"))[0].id);
        assert.deepEqual(calls, ["accounts.retrieve", "accounts.retrieve"]);
        assert.equal(await rewardState(), "active");
        // A refund after the erasure still withdraws the inviter's bonus.
        await core.blockPayment(p.paymentId, "revoked", "charge.refunded");
        assert.equal(await rewardState(), "revoked");
      },
    );
    await t.test(
      "erasing an inviter withdraws only their bonuses; friends keep their purchase and their binding",
      async () => {
        await reset();
        const code = await core.ownCode(1);
        const { id } = await ready();
        const d = device();
        const c = await core.challenge(1, id, "activate", d.pub);
        await core.prove(1, c.id, d.sign(c.payload), "session-token");
        await core.challenge(1, id, "license", d.pub);
        const open = await reserve(4, 1); // another friend is at the checkout
        assert.equal((await erase("inviter@example.com")).counts.referralBonusesWithdrawn, 1);
        assert.equal(await core.codeExists(code), false);
        assert.equal((await rows("SELECT 1 FROM referral_challenges")).length, 0);
        assert.deepEqual(
          await rows(`SELECT inviter_id,buyer_id,state,reason,device_public_key,device_key_hash,activated_at,
            expires_at FROM referral_rewards`),
          [{ inviter_id: null, buyer_id: 2, state: "revoked", reason: "account_erased", device_public_key: null,
            device_key_hash: null, activated_at: null, expires_at: null }],
        );
        // Friend 2 stays bound to that purchase and cannot be invited again.
        await assert.rejects(core.claim(2, await core.ownCode(3), false), /already_bound/);
        // Friend 4's invitation has ended; the checkout already open keeps its price but earns
        // nobody a bonus.
        const [ended] = await rows("SELECT inviter_id,expires_at FROM referral_enrolments WHERE buyer_id=4");
        assert.equal(ended.inviter_id, null);
        assert.ok(new Date(ended.expires_at) <= now);
        await core.recordPayment({ ...payment(open), buyerId: 4, customerId: "cus_test4",
          payerFingerprint: "card_four", paymentId: "pi_four", invoiceId: "in_four" });
        assert.deepEqual(await rows("SELECT state,reason FROM referral_rewards WHERE buyer_id=4"), [
          { state: "revoked", reason: "inviter_erased" },
        ]);
      },
    );
    await t.test(
      "erasure waits for an open referral checkout and a live subscription; a dry run changes nothing",
      async () => {
        await reset();
        const q = await reserve();
        await assert.rejects(erase("buyer@example.net"), /open_referral_checkout/);
        // Past its expiry but not settled yet: still waits.
        now = new Date(new Date(q.expires_at).getTime() + 60000);
        await assert.rejects(erase("buyer@example.net"), /open_referral_checkout/);
        await core.expireQuote(q.id, null, "no_provider_session");
        const dry = await eraseAccount(pool, "buyer@example.net", { now: new Date(now) });
        assert.deepEqual(
          [dry.erased, dry.counts.referralCheckoutsDeleted, dry.counts.referralInvitationsDeleted, dry.counts.accounts],
          [false, 1, 1, 1],
        );
        assert.equal((await rows("SELECT 1 FROM users WHERE id=2")).length, 1);
        assert.equal((await rows("SELECT 1 FROM referral_quotes")).length, 1);
        await pool.query("UPDATE users SET subscription_status='past_due' WHERE id=3");
        await assert.rejects(erase("other@example.org"), /active_subscription/);
        await pool.query(`UPDATE users SET subscription_status='canceled' WHERE id=3;
          INSERT INTO entitlements VALUES(3,'uninstaller',NULL,'sub_u','trialing')`);
        await assert.rejects(erase("other@example.org"), /active_subscription/);
        await pool.query(`UPDATE entitlements SET subscription_status='canceled';
          INSERT INTO dc_billing_accounts(billing_mode,store_scope,user_id,subscription)
            VALUES('live','pc-tweaker-shared',3,'{"status":"trialing","access":true}')`);
        await assert.rejects(erase("other@example.org"), /active_subscription/, "a Tweaky Driver subscription too");
        await pool.query(`UPDATE dc_billing_accounts SET subscription='{"status":"canceled","access":false}'`);
        assert.deepEqual(
          [(await erase("other@example.org")).counts.accounts, (await rows("SELECT 1 FROM dc_billing_accounts")).length],
          [1, 0],
        );
        // No account: the address's newsletter subscription and ratings still go.
        await pool.query("INSERT INTO newsletter_subscribers(email) VALUES('nobody@example.com')");
        assert.deepEqual(await erase("nobody@example.com"), {
          erased: true,
          accountFound: false,
          userId: null,
          counts: { newsletter: 1, ratings: 0 },
        });
      },
    );
    await t.test(
      "retention: unpaid checkouts after 30 days, unused invitations after 90, erased hashes and the audit log after 24 months",
      async () => {
        await reset();
        const start = now.getTime();
        const at = async (days) => {
          now = new Date(start + days * 86400000);
          await core.cleanup();
        };
        const unpaid = await reserve(4, 3);
        await core.expireQuote(unpaid.id, null, "no_provider_session");
        const { id } = await ready();
        await erase("buyer@example.net");
        const left = async (sql) => (await rows(sql)).length;
        await at(29);
        assert.equal(await left(`SELECT 1 FROM referral_quotes WHERE id='${unpaid.id}'`), 1);
        await at(31);
        assert.equal(await left(`SELECT 1 FROM referral_quotes WHERE id='${unpaid.id}'`), 0);
        assert.equal(await left(`SELECT 1 FROM referral_audit WHERE subject_id='${unpaid.id}'`), 0);
        assert.equal(await left("SELECT 1 FROM referral_enrolments WHERE buyer_id=4"), 1);
        await at(30 + 91); // the invitation expired on day 30
        assert.equal(await left("SELECT 1 FROM referral_enrolments WHERE buyer_id=4"), 0);
        // The erased friend's purchase keeps its hashes until 24 months after it.
        assert.equal(await left("SELECT 1 FROM referral_rewards WHERE payer_hash LIKE 'erased:%'"), 0);
        assert.ok(await left("SELECT 1 FROM referral_audit"));
        await at(740);
        assert.deepEqual(await rows("SELECT id,state,payer_hash,payment_id FROM referral_rewards"), [
          { id, state: "ready", payer_hash: "erased:" + id, payment_id: "erased:" + id },
        ]);
        assert.deepEqual(await rows("SELECT buyer_email_hash FROM referral_enrolments"), [
          { buyer_email_hash: "erased:" + (await rows("SELECT id FROM referral_enrolments"))[0].id },
        ]);
        assert.equal(await left("SELECT 1 FROM referral_audit"), 0);
      },
    );
    await t.test("shared checkout guard preserves the referral discount and reuses its session", async () => {
      const { initWebCheckoutReservations, WebCheckoutReservations } = await import("../dist/web-checkout-reservations.js");
      const { stripeGuardedProvider } = await import("../dist/stripe-guarded-provider.js");
      const { guardedCheckout, cancelGuardedCheckout } = await import("../dist/guarded-checkout.js");
      const { closeExpiredReferralUsing } = await import("../dist/referral-stripe.js");
      await initWebCheckoutReservations(pool);
      await reset();
      await core.claim(2, await core.ownCode(1), false);
      await pool.query("UPDATE users SET stripe_customer_id='cus_test2' WHERE id=2");
      let created=0, saved; const all=[];
      const pages=()=>({async *[Symbol.asyncIterator]() {}});
      const sessions={
        async create(params) { created++; saved={id:`cs_test_guardedreferral${created}`,url:`https://checkout.stripe.com/c/pay/referral${created}`,status:"open",payment_status:"unpaid",metadata:params.metadata,discounts:params.discounts};all.push(saved);return saved; },
        async retrieve(id) { return all.find(item=>item.id===id); },
        async expire(id) { const item=all.find(value=>value.id===id);item.status="expired";return item; },
        list() { return {async *[Symbol.asyncIterator]() {yield* all;}}; },
      };
      const raw={accounts:{retrieve:async()=>({id:"acct_test"})},invoices:{list:pages},prices:{retrieve:async()=>({id:"price_test",active:true,currency:"eur",unit_amount:799})},coupons:{create:async(params)=>({id:params.id})},checkout:{sessions}};
      const gateway=new ReferralStripe(core,raw);
      const params={mode:"subscription",client_reference_id:"2",metadata:{product:"pctweaker",userId:"2",plan:"monthly"},subscription_data:{metadata:{product:"pctweaker"}},line_items:[{price:"price_test",quantity:1}],success_url:"https://pctweaker.app/",cancel_url:"https://pctweaker.app/"};
      const provider=stripeGuardedProvider(sessions,params,5000,tagged=>gateway.checkout(2,"monthly",tagged),(userId,session)=>closeExpiredReferralUsing(gateway,userId,session));
      const repo=new WebCheckoutReservations(pool);
      const first=await guardedCheckout(repo,provider,2,"pctweaker","monthly");
      const second=await guardedCheckout(repo,provider,2,"pctweaker","monthly");
      assert.deepEqual(first,second);assert.equal(created,1);assert.equal(saved.discounts.length,1);assert.ok(saved.metadata.referral_quote);assert.ok(saved.metadata.reservation_id);
      assert.equal((await pool.query("SELECT * FROM referral_quotes")).rowCount,1);
      const previousQuote=saved.metadata.referral_quote;
      await cancelGuardedCheckout(repo,provider,2,"pctweaker");
      assert.equal((await pool.query("SELECT state FROM referral_quotes WHERE id=$1",[previousQuote])).rows[0].state,"expired");
      const annualParams={...params,metadata:{...params.metadata,plan:"annual"}};
      const annualProvider=stripeGuardedProvider(sessions,annualParams,5000,tagged=>gateway.checkout(2,"annual",tagged),(userId,session)=>closeExpiredReferralUsing(gateway,userId,session));
      await guardedCheckout(repo,annualProvider,2,"pctweaker","annual");
      assert.equal(created,2);assert.notEqual(saved.metadata.referral_quote,previousQuote);assert.equal(saved.discounts.length,1);
    });
  } finally {
    await pool.end();
  }
});

