import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "synthetic-local-boundary-test-not-a-production-secret";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
const { initSchema, getPool } = await import("../dist/db.js");
const { signToken, requireAuth } = await import("../dist/auth.js");
const { createCheckoutHandler } = await import("../dist/routes/stripe.js");
const { productEntitlement } = await import("../dist/products.js");
await initSchema();

test("checkout ignores another account and client-supplied price or premium claims", async () => {
  const { rows } = await getPool().query("INSERT INTO users (email, password_hash) VALUES ('boundary-a@example.com', 'fixture'), ('boundary-b@example.com', 'fixture') RETURNING id");
  const [a, b] = rows.map(row => row.id);
  const req = {
    headers: { authorization: `Bearer ${signToken(a, 0)}` },
    body: { plan: "annual", product: "pctweaker", userId: b, customer: "cus_other", price: "price_free", isPro: true },
  };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let authenticated = false;
  await requireAuth(req, res, () => { authenticated = true; });
  assert.equal(authenticated, true);
  assert.equal(req.userId, a);
  let checkout;
  await createCheckoutHandler({
    environment: { STRIPE_PRICE_ANNUAL: "price_server_annual" },
    now: Date.now,
    async createSession(params) { checkout = params; return { url: "https://example.com/test-checkout" }; },
  })(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(checkout.client_reference_id, String(a));
  assert.equal(checkout.customer_email, "boundary-a@example.com");
  assert.equal(checkout.line_items[0].price, "price_server_annual");
  assert.equal((await productEntitlement(a, "pctweaker")).active, false);
  assert.equal((await productEntitlement(b, "pctweaker")).active, false);

  await getPool().query("UPDATE users SET token_version = 1 WHERE id = $1", [a]);
  authenticated = false;
  await requireAuth(req, res, () => { authenticated = true; });
  assert.equal(authenticated, false);
  assert.equal(res.statusCode, 401);
});
