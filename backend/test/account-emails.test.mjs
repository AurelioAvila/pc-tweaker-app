import test from "node:test";
import assert from "node:assert/strict";

const {
  accountWelcomeHtml,
  accountWelcomeSubject,
  passwordResetHtml,
  passwordResetSubject,
  verificationHtml,
  verificationSubject,
} = await import("../dist/emails/account.js");

const LINK = "https://api.pctweaker.app/api/auth/verify-email?token=abc&x=1";

test("the confirmation shows the destination as text, after the button", () => {
  // These two messages are the ones phishing imitates, so a reader has to be
  // able to see where the link goes without clicking it. After the button,
  // because that is where someone looks once the button did not work.
  const html = verificationHtml("Marco Rossi", LINK);
  assert.ok(html.includes("Or paste this into your browser"));
  assert.ok(html.indexOf("Confirm my email") < html.indexOf("Or paste this"));
  assert.match(html, /token=abc&amp;x=1/, "the ampersand must be escaped, not dropped");
});

test("only the first name is used, and its absence is not an error", () => {
  assert.match(verificationHtml("Marco Rossi", LINK), /One step left, Marco\./);
  assert.match(verificationHtml("", LINK), /One step left\./);
  assert.match(accountWelcomeHtml("", 35), /You're in\./);
});

test("a name cannot carry markup into the message", () => {
  const html = accountWelcomeHtml("<script>alert(1)</script>", 35);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("the reset email states the two limits that matter", () => {
  // Single use and one hour are both true of the token, and both are the
  // kind of thing someone checks before worrying that a link was intercepted.
  const html = passwordResetHtml(LINK);
  assert.match(html, /one hour, and only once/);
  assert.match(html, /your password stays exactly as it is/);
});

test("the welcome quotes the free tweak count it was given", () => {
  // Passed in rather than written into the template, so the email cannot go
  // on promising a number that stopped being true.
  assert.match(accountWelcomeHtml("Marco", 35), /35 tweaks/);
  assert.match(accountWelcomeHtml("Marco", 40), /40 tweaks/);
});

test("every subject names the product", () => {
  for (const subject of [verificationSubject(), passwordResetSubject(), accountWelcomeSubject()]) {
    assert.match(subject, /PC Tweaker/);
  }
});

test("all three are complete documents in the same shell", () => {
  for (const html of [verificationHtml("A", LINK), passwordResetHtml(LINK), accountWelcomeHtml("A", 35)]) {
    assert.ok(html.startsWith("<!doctype html>"));
    assert.ok(html.includes("pctweaker.app"));
    assert.ok(html.includes("#ff5500"), "the shared accent, not a second visual language");
  }
});
