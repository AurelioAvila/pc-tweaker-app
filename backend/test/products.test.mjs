// Multi-product entitlement tests. DATABASE_URL=pgmem is set by the test
// script, so these exercise the real SQL against an in-memory Postgres.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";

const { initSchema, getPool } = await import("../dist/db.js");
const {
  isKnownProduct,
  isProductRowEntitled,
  productEntitlement,
  hasAnyActiveEntitlement,
  upsertEntitlement,
  revokeEntitlement,
} = await import("../dist/products.js");

await initSchema();

async function createUser(email, { isPro = false, plan = null, proExpiresAt = null } = {}) {
  const { rows } = await getPool().query(
    `INSERT INTO users (email, password_hash, is_pro, plan, pro_expires_at)
     VALUES ($1, 'x', $2, $3, $4) RETURNING id`,
    [email, isPro, plan, proExpiresAt],
  );
  return rows[0].id;
}

test("unknown products are rejected before touching the database", () => {
  assert.equal(isKnownProduct("pctweaker"), true);
  assert.equal(isKnownProduct("uninstaller"), true);
  assert.equal(isKnownProduct("__proto__"), false);
  assert.equal(isKnownProduct(""), false);
  assert.equal(isKnownProduct(undefined), false);
});

test("entitlements-table rows fail closed: NULL expiry grants nothing without a perpetual plan", () => {
  assert.equal(isProductRowEntitled(null), false);
  assert.equal(isProductRowEntitled({ plan: "annual", expires_at: null }), false);
  assert.equal(isProductRowEntitled({ plan: "lifetime", expires_at: null }), true);
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);
  assert.equal(isProductRowEntitled({ plan: "annual", expires_at: future }), true);
  assert.equal(isProductRowEntitled({ plan: "annual", expires_at: past }), false);
  // pg may hand timestamps back as strings; both must resolve identically.
  assert.equal(isProductRowEntitled({ plan: "annual", expires_at: future.toISOString() }), true);
  // A corrupt date must deny, not grant.
  assert.equal(isProductRowEntitled({ plan: "annual", expires_at: "not-a-date" }), false);
});

test("pctweaker entitlement still reads the legacy users columns", async () => {
  const activeId = await createUser("legacy-active@example.com", {
    isPro: true,
    plan: "monthly",
    proExpiresAt: new Date(Date.now() + 86_400_000),
  });
  const lapsedId = await createUser("legacy-lapsed@example.com", {
    isPro: true,
    plan: "monthly",
    proExpiresAt: new Date(Date.now() - 86_400_000),
  });
  assert.equal((await productEntitlement(activeId, "pctweaker")).active, true);
  assert.equal((await productEntitlement(lapsedId, "pctweaker")).active, false);
  // ...and PC Tweaker Pro alone does NOT unlock the Uninstaller.
  assert.equal((await productEntitlement(activeId, "uninstaller")).active, false);
});

test("upsert grants, refresh extends, revoke ends immediately", async () => {
  const userId = await createUser("uninstaller-buyer@example.com");
  await upsertEntitlement(userId, "uninstaller", {
    plan: "annual",
    expiresAt: new Date(Date.now() + 3 * 86_400_000),
  });
  assert.equal((await productEntitlement(userId, "uninstaller")).active, true);

  // The renewal webhook overwrites the provisional window with the real one.
  await upsertEntitlement(userId, "uninstaller", {
    plan: "annual",
    expiresAt: new Date(Date.now() + 365 * 86_400_000),
    stripeSubscriptionId: "sub_123",
  });
  const { rows } = await getPool().query(
    "SELECT stripe_subscription_id FROM entitlements WHERE user_id = $1 AND product = 'uninstaller'",
    [userId],
  );
  assert.equal(rows.length, 1, "renewal must update the row, not stack a second one");
  assert.equal(rows[0].stripe_subscription_id, "sub_123");

  await revokeEntitlement(userId, "uninstaller");
  assert.equal((await productEntitlement(userId, "uninstaller")).active, false);
});

test("hasAnyActiveEntitlement is the loyalty-price definition of existing customer", async () => {
  const nobody = await createUser("free-user@example.com");
  assert.equal(await hasAnyActiveEntitlement(nobody), false);

  const tweakOnly = await createUser("tweaker-only@example.com", {
    isPro: true,
    plan: "annual",
    proExpiresAt: new Date(Date.now() + 86_400_000),
  });
  assert.equal(await hasAnyActiveEntitlement(tweakOnly), true);

  const uninstallerOnly = await createUser("uninstaller-only@example.com");
  await upsertEntitlement(uninstallerOnly, "uninstaller", {
    plan: "annual",
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  assert.equal(await hasAnyActiveEntitlement(uninstallerOnly), true);
});
