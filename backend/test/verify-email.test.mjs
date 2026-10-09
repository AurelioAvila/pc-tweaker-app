// A verification link opened twice (a mail scanner, then the person) must not
// tell an already confirmed person that their link is invalid.
import { test, after } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "test-secret";
delete process.env.RESEND_API_KEY;

const { default: express } = await import("express");
const { initSchema, getPool } = await import("../dist/db.js");
const { createActionToken } = await import("../dist/tokens.js");
const authModule = await import("../dist/routes/auth.js");
await initSchema();

const app = express();
app.use("/api/auth", authModule.default.default);
const server = app.listen(0);
after(() => server.close());
const verify = (token) => fetch(`http://127.0.0.1:${server.address().port}/api/auth/verify-email?token=${token}`);

test("the second open of a used link confirms instead of failing", async () => {
  const { rows } = await getPool().query("INSERT INTO users (email, password_hash) VALUES ('scan@example.com', 'x') RETURNING id");
  const token = await createActionToken(rows[0].id, "email_verify", 86_400_000);

  const first = await verify(token);
  assert.equal(first.status, 200);
  assert.match(await first.text(), /Your email is verified/);
  const second = await verify(token);
  assert.equal(second.status, 200);
  assert.match(await second.text(), /already verified/);

  const unknown = await verify("f".repeat(64));
  assert.equal(unknown.status, 400);
});

test("a used link for an address that is still unconfirmed stays an error", async () => {
  const { rows } = await getPool().query("INSERT INTO users (email, password_hash) VALUES ('other@example.com', 'x') RETURNING id");
  const token = await createActionToken(rows[0].id, "email_verify", 86_400_000);
  await getPool().query("UPDATE action_tokens SET used_at = now()");
  const res = await verify(token);
  assert.equal(res.status, 400);
});
