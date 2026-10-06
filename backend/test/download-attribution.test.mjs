// Download beacon from a tagged social post: allowlisted labels are counted,
// anything else is ignored, and the stats view is closed without the token.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.ADMIN_TOKEN = "t".repeat(32);

const express = (await import("express")).default;
const { initSchema, getPool } = await import("../dist/db.js");
const downloads = (await import("../dist/routes/downloads.js")).default.default;
await initSchema();

const app = express();
app.use("/api/download", downloads);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/download`;
test.after(() => server.close());

test("a tagged download is counted, untagged or junk labels are not", async () => {
  const ok = await fetch(`${base}?utm_source=youtube&utm_medium=social&utm_campaign=pctweaker_shorts&utm_content=pc-x-v1&email=a@b.c`, { method: "POST" });
  assert.equal(ok.status, 204);
  assert.equal((await fetch(base, { method: "POST" })).status, 204);
  assert.equal((await fetch(`${base}?utm_source=a%20b`, { method: "POST" })).status, 204);
  const { rows } = await getPool().query("SELECT * FROM download_attributions");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].utm_source, "youtube");
  assert.equal(rows[0].utm_content, "pc-x-v1");
  assert.deepEqual(Object.keys(rows[0]).sort(), ["created_at", "id", "utm_campaign", "utm_content", "utm_medium", "utm_source"]);
});

test("stats need the admin token and return grouped counts", async () => {
  assert.equal((await fetch(`${base}/stats`)).status, 404);
  const res = await fetch(`${base}/stats?days=30`, { headers: { "x-admin-token": process.env.ADMIN_TOKEN } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.rows.length, 1);
  assert.equal(body.rows[0].downloads, 1);
});
