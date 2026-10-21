// Installation counting on licence refresh: a well-formed random id is stored
// only as a hash, malformed ones are ignored, and nothing ever fails a request.
import { test } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_URL = "pgmem";
const { initSchema, getPool } = await import("../dist/db.js");
const { recordInstall, INSTALL_RETENTION_DAYS } = await import("../dist/install-count.js");
await initSchema();

test("installations are counted per account as hashes, junk is ignored", async () => {
  const { rows } = await getPool().query(
    "INSERT INTO users(email,password_hash) VALUES('installs@example.com','x') RETURNING id",
  );
  const id = rows[0].id;
  const a = "3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f";
  const b = "7c9d0e1f-2a3b-4c5d-9e6f-7a8b9c0d1e2f";
  assert.equal(await recordInstall(id, "pctweaker", a), true);
  assert.equal(await recordInstall(id, "pctweaker", a.toUpperCase()), true);
  assert.equal(await recordInstall(id, "pctweaker", b), true);
  for (const junk of [undefined, "", "not-a-uuid", "3f2b8c1e-9d4a-1f6b-8e2c-1a2b3c4d5e6f", `${a}x`]) {
    assert.equal(await recordInstall(id, "pctweaker", junk), false);
  }
  const stored = await getPool().query("SELECT * FROM license_installs WHERE user_id = $1", [id]);
  assert.equal(stored.rows.length, 2);
  for (const row of stored.rows) {
    assert.match(row.install_hash, /^[0-9a-f]{64}$/);
    assert.ok(![a, b].includes(row.install_hash));
  }
  // A row not refreshed within the retention window is dropped.
  await getPool().query("UPDATE license_installs SET last_seen = $2 WHERE user_id = $1 AND install_hash = $3", [
    id,
    new Date(Date.now() - (INSTALL_RETENTION_DAYS + 1) * 86_400_000),
    stored.rows[0].install_hash,
  ]);
  await recordInstall(id, "pctweaker", b);
  const kept = await getPool().query("SELECT * FROM license_installs WHERE user_id = $1", [id]);
  assert.equal(kept.rows.length, 1);
});

test("a database failure is swallowed rather than failing the licence", async () => {
  assert.equal(await recordInstall(999999, "pctweaker", "3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f"), false);
});
