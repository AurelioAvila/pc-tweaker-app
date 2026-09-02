// A paid period must never be cut short by the order Stripe happens to
// deliver its events in. DATABASE_URL=pgmem, so this runs the real SQL.
//
// `checkout.session.completed` writes a 3-day holding window because it does
// not know the real billing period; `customer.subscription.created` writes the
// truth. Stripe orders neither against the other. When the subscription event
// arrived first, the checkout write replaced October with the guess, and a
// customer who had paid for a month lost Pro on day three. It happened on
// 2026-09-02 to the account that had subscribed that morning.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";

const { initSchema, getPool } = await import("../dist/db.js");
const { grantPro } = await import("../dist/routes/stripe.js");
const { upsertEntitlement, productEntitlement } = await import("../dist/products.js");

await initSchema();

const REAL_PERIOD_END = new Date("2026-10-02T12:00:00Z");
const PROVISIONAL = new Date("2026-09-05T12:00:00Z");

async function createUser(email) {
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
    [email],
  );
  return rows[0].id;
}

async function expiryOf(userId) {
  const { rows } = await getPool().query("SELECT pro_expires_at, is_pro FROM users WHERE id = $1", [userId]);
  return rows[0];
}

test("the subscription event landing first is not undone by checkout", async () => {
  const userId = await createUser("race-subscription-first@example.com");

  // customer.subscription.created — the authoritative period end.
  await grantPro(userId, { customerId: "cus_x", plan: "monthly", expiresAt: REAL_PERIOD_END });
  // checkout.session.completed arrives after, knowing only its guess.
  await grantPro(userId, { customerId: "cus_x", plan: "monthly", expiresAt: PROVISIONAL, provisional: true });

  const row = await expiryOf(userId);
  assert.equal(row.is_pro, true);
  assert.equal(
    new Date(row.pro_expires_at).toISOString(),
    REAL_PERIOD_END.toISOString(),
    "a provisional window must not shorten a period the customer has paid for",
  );
});

test("checkout first still gets the real date once the subscription event lands", async () => {
  const userId = await createUser("race-checkout-first@example.com");

  await grantPro(userId, { customerId: "cus_y", plan: "monthly", expiresAt: PROVISIONAL, provisional: true });
  assert.equal(new Date((await expiryOf(userId)).pro_expires_at).toISOString(), PROVISIONAL.toISOString());

  await grantPro(userId, { customerId: "cus_y", plan: "monthly", expiresAt: REAL_PERIOD_END });

  assert.equal(new Date((await expiryOf(userId)).pro_expires_at).toISOString(), REAL_PERIOD_END.toISOString());
});

test("a real subscription event may still shorten an expiry", async () => {
  // Only the provisional write is one-way. A genuine event — a downgrade, a
  // corrected period — stays authoritative, or the app would drift away from
  // Stripe in the customer's favour and never come back.
  const userId = await createUser("real-event-wins@example.com");

  await grantPro(userId, { customerId: "cus_z", plan: "annual", expiresAt: REAL_PERIOD_END });
  await grantPro(userId, { customerId: "cus_z", plan: "monthly", expiresAt: PROVISIONAL });

  assert.equal(new Date((await expiryOf(userId)).pro_expires_at).toISOString(), PROVISIONAL.toISOString());
});

test("a lifetime purchase still stores a null expiry", async () => {
  const userId = await createUser("lifetime@example.com");

  await grantPro(userId, { customerId: "cus_l", plan: "lifetime", expiresAt: null });

  assert.equal((await expiryOf(userId)).pro_expires_at, null);
});

test("the entitlements table has the same guard", async () => {
  const userId = await createUser("uninstaller-race@example.com");

  await upsertEntitlement(userId, "uninstaller", { plan: "annual", expiresAt: REAL_PERIOD_END });
  await upsertEntitlement(userId, "uninstaller", { plan: "annual", expiresAt: PROVISIONAL, provisional: true });

  const { rows } = await getPool().query(
    "SELECT expires_at FROM entitlements WHERE user_id = $1 AND product = 'uninstaller'",
    [userId],
  );
  assert.equal(new Date(rows[0].expires_at).toISOString(), REAL_PERIOD_END.toISOString());

  const entitlement = await productEntitlement(userId, "uninstaller");
  assert.equal(entitlement.active, true);
});
