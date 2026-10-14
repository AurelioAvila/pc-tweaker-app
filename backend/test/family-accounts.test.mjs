// One account serves PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver.
// Mail and the pages behind its links are branded for the app that asked,
// and a finished reset leaves no other reset link usable.
import { test, after } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "test-secret";
delete process.env.RESEND_API_KEY;

const { default: express } = await import("express");
const { initSchema, getPool } = await import("../dist/db.js");
const { createActionToken } = await import("../dist/tokens.js");
const authModule = await import("../dist/routes/auth.js");
const { verificationHtml, verificationText, passwordResetHtml } = await import("../dist/emails/account.js");
const { EMAIL_BRANDS } = await import("../dist/emails/layout.js");
const { proWelcomeHtml } = await import("../dist/emails/pro-welcome.js");
await initSchema();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api/auth", authModule.default.default);
const server = app.listen(0);
after(() => server.close());
const base = () => `http://127.0.0.1:${server.address().port}/api/auth`;

test("a successful reset spends every other reset link of the account", async () => {
  const { rows } = await getPool().query("INSERT INTO users (email, password_hash) VALUES ('reset@example.com', 'x') RETURNING id");
  const first = await createActionToken(rows[0].id, "password_reset", 3_600_000);
  const second = await createActionToken(rows[0].id, "password_reset", 3_600_000);
  const reset = (token) => fetch(`${base()}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword: "a new long password" }),
  });
  assert.equal((await reset(first)).status, 200);
  const replay = await reset(second);
  assert.equal(replay.status, 400, "the older link must not change the password again");
});

test("pages behind an Uninstaller link name the Uninstaller", async () => {
  const { rows } = await getPool().query("INSERT INTO users (email, password_hash) VALUES ('unin@example.com', 'x') RETURNING id");
  const token = await createActionToken(rows[0].id, "email_verify", 86_400_000);
  const page = await (await fetch(`${base()}/verify-email?token=${token}&product=uninstaller`)).text();
  assert.match(page, /return to PC Tweaker Uninstaller/);
  const form = await (await fetch(`${base()}/reset-password?token=abc&product=uninstaller`)).text();
  assert.match(form, /name="product" value="uninstaller"/);
  const plain = await (await fetch(`${base()}/reset-password?token=abc&product=<b>`)).text();
  assert.doesNotMatch(plain, /name="product"/, "an unknown product falls back to PC Tweaker");
});

test("the auth limiter answers in JSON the apps can read", async () => {
  let last;
  for (let i = 0; i < 21; i++) {
    last = await fetch(`${base()}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "limit@example.com" }),
    });
  }
  assert.equal(last.status, 429);
  assert.match((await last.json()).error, /Too many attempts/);
});

test("mail is branded for the app that asked, in both parts", () => {
  const link = "https://api.pctweaker.app/api/auth/verify-email?token=t&product=uninstaller";
  const html = verificationHtml("Ada", link, EMAIL_BRANDS.uninstaller);
  assert.match(html, /You created a PC Tweaker Uninstaller account with this address/);
  assert.ok(html.includes(EMAIL_BRANDS.uninstaller.logoUrl));
  assert.ok(html.includes(EMAIL_BRANDS.uninstaller.accent));
  assert.match(verificationText(link, EMAIL_BRANDS.uninstaller), /Privacy: https:\/\/pctweaker\.app\/privacy/);
  assert.match(passwordResetHtml(link), /Applies to<\/td>[\s\S]*?>PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver</);
});

test("the purchase email quotes the Uninstaller's real Pro features and the catalogue counts", () => {
  const uninstaller = proWelcomeHtml({ product: "uninstaller", firstName: "Ada", email: "a@example.com", plan: "annual", priceLabel: "€9.99 / year", renewsOn: "1 October 2027" });
  assert.match(uninstaller, /Leftover cleanup/);
  assert.doesNotMatch(uninstaller, /Deep scan/, "the leftover scan is free, not a Pro feature");
  const tweaker = proWelcomeHtml({ firstName: "Ada", email: "a@example.com", plan: "annual", priceLabel: "€24.99 / year", renewsOn: "1 October 2027" });
  assert.match(tweaker, /All 81 controls are available now: the 46 you had on Free plus the 35 Pro ones/);
});

test("the Uninstaller receipt and reversal follow the kit and never mention a refund", async () => {
  const { refundHtml, refundText, proWelcomeSubject } = await import("../dist/emails/pro-welcome.js");
  const sub = { product: "uninstaller", firstName: "Ada", email: "a@example.com", plan: "annual", priceLabel: "€9.99 / year", renewsOn: "1 October 2027" };
  const html = proWelcomeHtml(sub);
  assert.match(html, /Pro is on, Ada\. Leftovers are now yours to remove\./);
  assert.match(html, /A cancelled plan stays Pro until 1 October 2027/);
  assert.equal(proWelcomeSubject("uninstaller", "annual"), "Your PC Tweaker Uninstaller Pro subscription is active");
  const once = proWelcomeHtml({ ...sub, plan: "lifetime", renewsOn: null });
  assert.doesNotMatch(once, /Renews on|cancelled plan/);
  const reversal = { product: "uninstaller", firstName: "Ada", plan: "annual", refundedLabel: "€9.99" };
  for (const body of [refundHtml(reversal), refundText(reversal)]) {
    assert.match(body, /this reversal touches Uninstaller only/);
    assert.match(body, /€9\.99/);
    assert.doesNotMatch(body, /refund/i);
  }
  assert.match(refundText({ ...reversal, plan: null, refundedLabel: null }), /reversed your payment for PC Tweaker Uninstaller Pro/);
});
