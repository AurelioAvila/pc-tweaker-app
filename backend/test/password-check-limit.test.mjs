// change-password and change-email re-check the account password but carry no
// `email`, so the shared auth limiter keys them on the (spoofable) IP. They
// get their own budget per signed-in account. Own file: limiter state is
// per process, and the IP budget must stay clear of other tests.
import { test, after } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "test-secret";
delete process.env.RESEND_API_KEY;

const { default: express } = await import("express");
const { initSchema } = await import("../dist/db.js");
const authModule = await import("../dist/routes/auth.js");
await initSchema();

const app = express();
app.use(express.json());
app.use("/api/auth", authModule.default.default);
const server = app.listen(0);
after(() => server.close());
const post = (path, body, token) =>
  fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
const person = { password: "a long password", firstName: "Ada", lastName: "Lovelace", dateOfBirth: "1990-01-01" };
const register = async (email) => (await (await post("/register", { ...person, email })).json()).token;

test("password re-checks are limited per signed-in account", async () => {
  const log = console.log;
  console.log = () => {};
  after(() => (console.log = log));
  const guessed = await register("guess@example.com");
  const other = await register("other@example.com");
  for (let i = 0; i < 10; i++) {
    assert.equal((await post("/change-password", { currentPassword: `guess ${i}`, newPassword: "another long one" }, guessed)).status, 401);
  }
  assert.equal((await post("/change-email", { password: "guess", newEmail: "elsewhere@example.com" }, guessed)).status, 429);
  const changed = await post("/change-password", { currentPassword: person.password, newPassword: "another long one" }, other);
  assert.equal(changed.status, 200, "another account keeps its own budget");
});
