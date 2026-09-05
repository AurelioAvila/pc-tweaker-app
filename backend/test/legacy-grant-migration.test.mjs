import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
const { migrateLegacyProGrants, getPool } = await import("../dist/db.js");
const { productEntitlement } = await import("../dist/products.js");

test("migration preserves existing undated grants but never blesses later missing expiries", async () => {
  const pool = getPool();
  await pool.query(`CREATE TABLE users (
    id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    is_pro BOOLEAN NOT NULL DEFAULT FALSE, plan TEXT, pro_expires_at TIMESTAMPTZ
  )`);
  const { rows: old } = await pool.query(
    "INSERT INTO users (email, password_hash, is_pro, plan) VALUES ('legacy@example.com', 'fixture', TRUE, 'monthly') RETURNING id",
  );
  await migrateLegacyProGrants(pool);
  assert.equal((await productEntitlement(old[0].id, "pctweaker")).active, true);
  const { rows: recent } = await pool.query(
    "INSERT INTO users (email, password_hash, is_pro, plan) VALUES ('new@example.com', 'fixture', TRUE, 'monthly') RETURNING id",
  );
  assert.equal((await productEntitlement(recent[0].id, "pctweaker")).active, false);
  await migrateLegacyProGrants(pool);
  assert.equal((await productEntitlement(old[0].id, "pctweaker")).active, true);
  assert.equal((await productEntitlement(recent[0].id, "pctweaker")).active, false);
});
