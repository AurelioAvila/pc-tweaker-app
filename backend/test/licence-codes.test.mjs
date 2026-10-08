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
