import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

// The app boots even without a database configured, so `npm start` never
// crashes just because Railway hasn't provisioned Postgres yet — routes that
// need it check `isConfigured` themselves and fail with a clear 503 instead.
//
// `DATABASE_URL=pgmem` runs against an in-memory pg-mem instance instead of
// a real Postgres server — used by the local test scripts (see package.json
// `test` script) so the SQL itself gets exercised without needing a real
// database installed. Never use this value outside of tests.
let pool: Pool | null = null;
if (connectionString === "pgmem") {
  // Lazily required: pg-mem is a devDependency, never bundled for a real
  // Postgres deployment, so this branch is the only place that touches it.
  const { newDb } = require("pg-mem");
  const mem = newDb();
  mem.public.registerFunction({ name: "now", implementation: () => new Date() });
  const { Pool: MemPool } = mem.adapters.createPg();
  pool = new MemPool();
} else if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });
}

async function initSchema(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_pro BOOLEAN NOT NULL DEFAULT FALSE,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // ALTER ... ADD COLUMN IF NOT EXISTS makes this safe to re-run against a
  // database created by an older version of this schema.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;`);
  // Subscription bookkeeping. The customer id is what Stripe sends us on
  // cancellation/payment-failure events — without it we could grant Pro but
  // never take it back, since those events don't carry our own user id.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT;`);
  // When the current billing period runs out. Subscription events refresh it
  // on every renewal, so Pro lapses on its own if we ever stop hearing from
  // Stripe — see entitlement.ts for why that matters. NULL means "no expiry":
  // either a lifetime purchase or a subscriber from before this column
  // existed, both of which entitlement.ts treats as still entitled.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;`);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS action_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS action_tokens_hash_idx ON action_tokens (token_hash);`);
}

const isConfigured = Boolean(pool);

/**
 * Every caller already checks `isConfigured` before touching the database
 * (returning a 503 otherwise) — this just gives TypeScript the same
 * guarantee, so route code can write `getPool().query(...)` instead of a
 * non-null assertion at every call site. Throwing here would only ever mean a
 * route forgot its own `isConfigured` check, which is a bug worth surfacing
 * loudly rather than silently proceeding with a null pool.
 */
function getPool(): Pool {
  if (!pool) {
    throw new Error("database is not configured (DATABASE_URL missing) — check isConfigured before calling getPool()");
  }
  return pool;
}

export { pool, getPool, initSchema, isConfigured };
