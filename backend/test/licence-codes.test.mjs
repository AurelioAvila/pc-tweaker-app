import { test } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_URL = "pgmem";
const { initSchema, getPool } = await import("../dist/db.js");
const { redeemLicenceCode, normalizeCode, addMonths } = await import("../dist/licence-codes.js");
const { isEntitled } = await import("../dist/entitlement.js");
await initSchema();
const db = getPool();

const NOW = new Date("2026-10-22T10:00:00Z");
await db.query(
  "INSERT INTO licence_codes (code, label, months, starts_at, ends_at) VALUES ('PCTGOTD2026AB', 'test', 6, $1, $2)",
  [new Date("2026-10-22T00:00:00Z"), new Date("2026-10-23T12:00:00Z")],
);

async function user(email, fields = {}) {
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, email_verified, is_pro, plan, pro_expires_at)
     VALUES ($1, 'x', $2, $3, $4, $5) RETURNING id`,
    [email, fields.verified ?? true, fields.pro ?? false, fields.plan ?? null, fields.expires ?? null],
  );
  return rows[0].id;
}
const row = async (id) => (await db.query("SELECT is_pro, plan, pro_expires_at, legacy_pro_grant FROM users WHERE id = $1", [id])).rows[0];

test("codes are read the way people type them", () => {
  assert.equal(normalizeCode(" pct-gotd-2026-ab "), "PCTGOTD2026AB");
  assert.equal(normalizeCode("x"), null);
  assert.equal(normalizeCode(42), null);
  assert.equal(addMonths(new Date("2026-08-31T09:00:00Z"), 6).toISOString(), "2027-02-28T09:00:00.000Z");
});

test("a verified free account gets six months of Pro, once", async () => {
  const id = await user("free@example.com");
  const result = await redeemLicenceCode(id, "pct-gotd-2026-ab", NOW);
  assert.equal(result.ok, true);
  assert.equal(result.expiresAt.toISOString(), "2027-04-22T10:00:00.000Z");
  const after = await row(id);
  assert.equal(after.plan, "promo");
  assert.equal(isEntitled(after, NOW), true);
  assert.equal(isEntitled(after, new Date("2027-04-22T10:00:01Z")), false);
  assert.deepEqual(await redeemLicenceCode(id, "PCTGOTD2026AB", NOW), { ok: false, reason: "already_redeemed" });
});

test("the window, the address and existing purchases are respected", async () => {
  const id = await user("window@example.com");
  assert.equal((await redeemLicenceCode(id, "PCTGOTD2026AB", new Date("2026-10-21T23:59:00Z"))).reason, "not_started");
  assert.equal((await redeemLicenceCode(id, "PCTGOTD2026AB", new Date("2026-10-23T12:00:00Z"))).reason, "ended");
  assert.equal((await redeemLicenceCode(id, "NOSUCHCODE", NOW)).reason, "invalid");

  const unverified = await user("unverified@example.com", { verified: false });
  assert.equal((await redeemLicenceCode(unverified, "PCTGOTD2026AB", NOW)).reason, "verify_email");

  const lifetime = await user("lifetime@example.com", { pro: true, plan: "lifetime" });
  assert.equal((await redeemLicenceCode(lifetime, "PCTGOTD2026AB", NOW)).reason, "already_pro");
  assert.equal((await row(lifetime)).plan, "lifetime");

  const paidUntil = new Date("2026-12-01T00:00:00Z");
  const subscriber = await user("annual@example.com", { pro: true, plan: "annual", expires: paidUntil });
  assert.equal((await redeemLicenceCode(subscriber, "PCTGOTD2026AB", NOW)).reason, "already_pro");
  assert.equal(new Date((await row(subscriber)).pro_expires_at).toISOString(), paidUntil.toISOString());

  // A lapsed subscriber is a free account again and may redeem.
  const lapsed = await user("lapsed@example.com", { pro: true, plan: "monthly", expires: new Date("2026-09-01T00:00:00Z") });
  assert.equal((await redeemLicenceCode(lapsed, "PCTGOTD2026AB", NOW)).ok, true);
  assert.equal((await row(lapsed)).plan, "promo");
});

test("one activation per person: aliases and one connection's accounts are refused", async () => {
  const { emailKey } = await import("../dist/licence-codes.js");
  assert.equal(emailKey("A.N.N.A+gotd@GoogleMail.com"), "anna@gmail.com");
  assert.equal(emailKey("anna+x@outlook.com"), "anna@outlook.com");
  assert.equal(emailKey("a.nna@outlook.com"), "a.nna@outlook.com");

  const first = await user("anna+1@gmail.com");
  assert.equal((await redeemLicenceCode(first, "PCTGOTD2026AB", NOW)).ok, true);
  const alias = await user("a.n.n.a@gmail.com");
  assert.equal((await redeemLicenceCode(alias, "PCTGOTD2026AB", NOW)).reason, "duplicate");
  assert.equal((await row(alias)).is_pro, false);

  process.env.JWT_SECRET ||= "licence-test-secret";
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(await user(`household${i}@example.com`));
  for (const id of ids.slice(0, 3)) assert.equal((await redeemLicenceCode(id, "PCTGOTD2026AB", NOW, "203.0.113.7")).ok, true);
  assert.equal((await redeemLicenceCode(ids[3], "PCTGOTD2026AB", NOW, "203.0.113.7")).reason, "duplicate");
  assert.equal((await redeemLicenceCode(ids[3], "PCTGOTD2026AB", NOW, "198.51.100.9")).ok, true);
  const { rows } = await db.query("SELECT ip_hash FROM licence_code_redemptions WHERE ip_hash IS NOT NULL LIMIT 1");
  assert.match(rows[0].ip_hash, /^[0-9a-f]{16}$/, "only a keyed hash is stored, never the address");
});

test("Pro from a code can still be upgraded to Lifetime", async () => {
  const { grantPro } = await import("../dist/routes/stripe.js");
  const id = await user("upgrade@example.com");
  assert.equal((await redeemLicenceCode(id, "PCTGOTD2026AB", NOW)).ok, true);
  assert.equal(await grantPro(String(id), { customerId: "cus_fixture_upgrade", plan: "lifetime", expiresAt: null }), true);
  const after = await row(id);
  assert.equal(after.plan, "lifetime");
  assert.equal(after.pro_expires_at, null);
  assert.equal(isEntitled(after, new Date("2030-01-01T00:00:00Z")), true);
});
