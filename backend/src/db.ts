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
  // Stripe. A NULL expiry grants access only for lifetime or an existing
  // account explicitly marked by the compatibility migration below.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;`);
  // Bind recurring access to its source. A late event for an older purchase
  // must not replace or revoke the subscription currently granting access.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_created_at TIMESTAMPTZ;`);
  await migrateLegacyProGrants(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_receipts (
      receipt_key TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payload JSONB NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      locked_until TIMESTAMPTZ,
      lock_token TEXT,
      delivered_at TIMESTAMPTZ
    );
  `);

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

  // Public product reviews left from the website. `email` is collected so a
  // reviewer can be contacted about a complaint but is never returned by the
  // read endpoint — see routes/reviews.ts, which selects columns explicitly
  // rather than SELECT *, so adding a private column here can't leak it.
  // `published` lets an abusive review be hidden without destroying the
  // record. The rating range is enforced in the route rather than as a CHECK
  // constraint: pg-mem (used by the test suite) doesn't implement CHECK.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      rating SMALLINT NOT NULL,
      body TEXT NOT NULL,
      published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS reviews_published_idx ON reviews (published, created_at DESC);`);

  // `confirmed_at` marks a rating as counted towards the public average. It
  // is set on submission: an email round-trip to confirm a star rating is
  // friction no product asks for, and it was removed. The column stays
  // because rows written while it existed were never confirmed, and setting
  // it now is what keeps those abandoned submissions out of the score.
  //
  // pending_rating / confirm_token_hash / confirm_expires_at belonged to that
  // removed step. They are left in place rather than dropped — dropping
  // columns is irreversible and these are inert — but nothing reads them.
  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS pending_rating SMALLINT;`);
  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS confirm_token_hash TEXT;`);
  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS confirm_expires_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;`);
  // Deliberately NOT a partial index. Postgres requires ON CONFLICT to repeat
  // a partial index's predicate for inference to match, and the upsert in
  // routes/reviews.ts infers on `lower(email)` alone — pg-mem accepts the
  // mismatch, real Postgres would not, so the partial form would have failed
  // only once deployed. NULL emails (rows predating confirmation) don't
  // conflict with each other in a unique index, so nothing is lost.
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS reviews_email_idx ON reviews (lower(email));`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS reviews_confirm_token_idx ON reviews (confirm_token_hash) WHERE confirm_token_hash IS NOT NULL;`,
  );

  // Newsletter signups from the website footer. `unsubscribed_at` keeps the
  // row (so a re-subscribe is an update, not a duplicate) while marking the
  // address as one that must never be mailed again. `source` records which
  // form/page captured the address — useful once more than one product feeds
  // this list. Same lower(email) unique-index pattern as reviews, and for the
  // same pg-mem reason: the upsert infers on `lower(email)`.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      source TEXT,
      unsubscribed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_idx ON newsletter_subscribers (lower(email));`,
  );

  // Anonymous, opt-in error reports from the desktop apps (see
  // routes/error-reports.ts). No user reference on purpose: the report pipe
  // is anonymous by design, and a foreign key would tempt someone to join it
  // back to a person later.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS error_reports (
      id SERIAL PRIMARY KEY,
      app TEXT NOT NULL,
      app_version TEXT NOT NULL,
      context TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Per-product entitlements for the ecosystem's newer products (Uninstaller,
  // and whatever comes after). Deliberately NOT a migration of PC Tweaker Pro:
  // the `users.is_pro`/`pro_expires_at` columns remain the single source of
  // truth for product "pctweaker", so the live billing path is untouched by
  // this table's existence. Rows here are written only by the Stripe webhook
  // for checkouts whose metadata names a non-pctweaker product.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entitlements (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product TEXT NOT NULL,
      plan TEXT,
      expires_at TIMESTAMPTZ,
      stripe_subscription_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, product)
    );
  `);
}

const isConfigured = Boolean(pool);

/** Preserve only grants that existed before this migration. This is also
 * independently executable so its legacy-data behavior can be verified
 * without replaying every unrelated CREATE TABLE statement. */
async function migrateLegacyProGrants(database: Pick<Pool, "query">): Promise<void> {
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_pro_grant BOOLEAN;`);
  await database.query(`
    UPDATE users SET legacy_pro_grant = (is_pro = TRUE AND pro_expires_at IS NULL)
    WHERE legacy_pro_grant IS NULL;
  `);
  await database.query(`ALTER TABLE users ALTER COLUMN legacy_pro_grant SET DEFAULT FALSE;`);
  await database.query(`ALTER TABLE users ALTER COLUMN legacy_pro_grant SET NOT NULL;`);
}

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

export { pool, getPool, initSchema, isConfigured, migrateLegacyProGrants };
