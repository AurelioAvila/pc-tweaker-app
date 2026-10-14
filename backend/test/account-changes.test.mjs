// Account changes and the mail they send, against the real router on pg-mem:
// the language a message is written in, new sign-in alerts, changing the
// password and moving the account to another address.
import { test, after } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "test-secret";
delete process.env.RESEND_API_KEY;

const { default: express } = await import("express");
const { initSchema, getPool } = await import("../dist/db.js");
const authModule = await import("../dist/routes/auth.js");
await initSchema();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api/auth", authModule.default.default);
const server = app.listen(0);
after(() => server.close());
const base = () => `http://127.0.0.1:${server.address().port}/api/auth`;

// With no provider configured the mailer logs each message it would send;
// that line names the recipient and the subject, which is all these need.
const sent = [];
const log = console.log;
console.log = (...args) => {
  const line = String(args[0] ?? "");
  const marker = "skipped email to ";
  const at = line.indexOf(marker);
  if (at < 0) return log(...args);
  const [to, subject] = line.slice(at + marker.length).split("; subject: ");
  sent.push({ to, subject });
};
after(() => (console.log = log));
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const post = (path, body, token, headers = {}) =>
  fetch(`${base()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: JSON.stringify(body),
  });
const person = { password: "a long password", firstName: "Ada", lastName: "Lovelace", dateOfBirth: "1990-01-01" };

test("mail follows the app's language, saved on the account for later mail", async () => {
  sent.length = 0;
  const res = await post("/register", { ...person, email: "lingua@example.com", locale: "it" });
  assert.equal(res.status, 201);
  await settle();
  assert.equal(sent.at(-1).subject, "Conferma la tua email per PC Tweaker");
  const { rows } = await getPool().query("SELECT locale FROM users WHERE email = 'lingua@example.com'");
  assert.equal(rows[0].locale, "it");
  sent.length = 0;
  await post("/forgot-password", { email: "lingua@example.com" });
  await settle();
  assert.equal(sent.at(-1).subject, "Reimposta la password di PC Tweaker", "the saved language answers a request that sent none");
  sent.length = 0;
  await post("/forgot-password", { email: "lingua@example.com", locale: "pt" });
  await settle();
  assert.equal(sent.at(-1).subject, "Reponha a sua palavra-passe do PC Tweaker");
});

test("an unknown language falls back to the browser's, then to English", async () => {
  sent.length = 0;
  await post("/register", { ...person, email: "browser@example.com", locale: "xx" }, null, { "Accept-Language": "de-DE,de;q=0.9" });
  await settle();
  assert.equal(sent.at(-1).subject, "Bestätige deine E-Mail-Adresse für PC Tweaker");
  sent.length = 0;
  await post("/register", { ...person, email: "nolang@example.com" }, null, { "Accept-Language": "ja-JP" });
  await settle();
  assert.equal(sent.at(-1).subject, "Confirm your email for PC Tweaker");
});

test("a new PC is reported once, never the one that registered, and not twice within hours", async () => {
  await post("/register", { ...person, email: "alert@example.com", locale: "en" });
  sent.length = 0;
  assert.equal((await post("/login", { email: "alert@example.com", password: person.password })).status, 200);
  await settle();
  assert.equal(sent.length, 0, "the registering PC is already known");
  await post("/login", { email: "alert@example.com", password: person.password, deviceId: "0f1e2d3c4b5a69788796a5b4", deviceName: "DESKTOP-7KQ2RM" });
  await settle();
  assert.deepEqual(sent, [{ to: "alert@example.com", subject: "New sign-in to your PC Tweaker account" }]);
  await post("/login", { email: "alert@example.com", password: person.password, deviceId: "0f1e2d3c4b5a69788796a5b4" });
  await post("/login", { email: "alert@example.com", password: "wrong password" });
  await post("/login", { email: "alert@example.com", password: person.password, deviceId: "aaaaaaaaaaaaaaaaaaaaaaaa" });
  await settle();
  assert.equal(sent.length, 1, "known PC, wrong password and a second new PC within six hours send nothing");
  const { rows } = await getPool().query(
    "SELECT d.fingerprint FROM sign_in_devices d JOIN users u ON u.id = d.user_id WHERE u.email = 'alert@example.com'",
  );
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => /^[0-9a-f]{64}$/.test(row.fingerprint)), "only keyed hashes are stored");
});

test("changing the password needs the current one, ends other sessions and sends the notice", async () => {
  const token = (await (await post("/register", { ...person, email: "change@example.com", locale: "es" })).json()).token;
  assert.equal((await post("/change-password", { currentPassword: "not it at all", newPassword: "another long one" }, token)).status, 401);
  sent.length = 0;
  const changed = await post("/change-password", { currentPassword: person.password, newPassword: "another long one" }, token);
  assert.equal(changed.status, 200);
  const { token: fresh } = await changed.json();
  await settle();
  assert.deepEqual(sent, [{ to: "change@example.com", subject: "Tu contraseña de PC Tweaker ha cambiado" }]);
  assert.equal((await post("/logout-all", {}, token)).status, 401, "the old session ended");
  assert.equal((await post("/login", { email: "change@example.com", password: "another long one" })).status, 200);
  assert.equal((await post("/logout-all", {}, fresh)).status, 200, "the session that changed it continues");
});

test("moving the account to another address waits for the new inbox and tells the old one", async () => {
  const token = (await (await post("/register", { ...person, email: "old@example.com", locale: "fr" })).json()).token;
  await post("/register", { ...person, email: "taken@example.com" });
  assert.equal((await post("/change-email", { password: "wrong password", newEmail: "new@example.com" }, token)).status, 401);
  sent.length = 0;
  const taken = await post("/change-email", { password: person.password, newEmail: "taken@example.com" }, token);
  assert.equal(taken.status, 200, "a taken address gets the same answer");
  await settle();
  assert.equal(sent.length, 0, "and no mail");
  assert.equal((await post("/change-email", { password: person.password, newEmail: "New@Example.com" }, token)).status, 200);
  await settle();
  assert.deepEqual(sent, [{ to: "new@example.com", subject: "Confirmez votre nouvelle adresse e-mail pour PC Tweaker" }]);

  const { rows } = await getPool().query("SELECT id FROM users WHERE email = 'old@example.com'");
  const { createActionToken } = await import("../dist/tokens.js");
  const link = await createActionToken(rows[0].id, "email_change", 3_600_000, "new@example.com");
  for (let i = 0; i < 2; i++) {
    const page = await (await fetch(`${base()}/confirm-email-change?token=${link}&lang=fr`)).text();
    assert.match(page, /new@example\.com/);
    assert.match(page, /<form method="post"/, "opening the link only shows the button");
  }
  assert.equal((await getPool().query("SELECT email FROM users WHERE id = $1", [rows[0].id])).rows[0].email, "old@example.com");
  sent.length = 0;
  const confirm = () =>
    fetch(`${base()}/confirm-email-change`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `token=${link}&lang=fr`,
    });
  const done = await confirm();
  assert.equal(done.status, 200);
  assert.match(await done.text(), /new@example\.com/);
  await settle();
  assert.equal((await getPool().query("SELECT email, email_verified FROM users WHERE id = $1", [rows[0].id])).rows[0].email, "new@example.com");
  assert.deepEqual(sent, [{ to: "old@example.com", subject: "L’adresse e-mail de votre compte PC Tweaker a été modifiée" }]);
  assert.equal((await post("/logout-all", {}, token)).status, 401, "every session ended");
  assert.equal((await confirm()).status, 400, "the link works once");
  assert.equal((await post("/login", { email: "new@example.com", password: person.password })).status, 200);
});
