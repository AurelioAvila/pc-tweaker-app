const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

// The app boots even without a database configured, so `npm start` never
// crashes just because Railway hasn't provisioned Postgres yet — routes that
// need it check `isConfigured` themselves and fail with a clear 503 instead.
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    })
  : null;

async function initSchema() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_pro BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

module.exports = { pool, initSchema, isConfigured: Boolean(pool) };
