// Every message in every language the apps offer: complete, in the right
// language, in the house style, and with nothing left untranslated.
import test from "node:test";
import assert from "node:assert/strict";

const { LOCALES, copyFor, fromAcceptLanguage } = await import("../dist/emails/copy/index.js");
const account = await import("../dist/emails/account.js");
const pro = await import("../dist/emails/pro-welcome.js");
const { lifetimeReminderEmail } = await import("../dist/checkout-recovery.js");
const { supportAckEmail } = await import("../dist/emails/support-ack.js");
const { EMAIL_BRANDS } = await import("../dist/emails/layout.js");

const U = EMAIL_BRANDS.uninstaller;
const P = EMAIL_BRANDS.pctweaker;
const link = "https://api.pctweaker.app/api/auth/x?token=abc&lang=en";
const sale = { firstName: "<b>Ada</b>", email: "ada@example.com", priceLabel: "€59.99 / year", renewsOn: "14 October 2027" };

function all(c) {
  const mail = (subject, html, text) => ({ subject, html, text });
  return {
    verify: mail(account.verificationSubject(P, c), account.verificationHtml("<b>Ada</b>", link, P, c), account.verificationText(link, P, c)),
    verifyU: mail(account.verificationSubject(U, c), account.verificationHtml("Ada", link, U, c), account.verificationText(link, U, c)),
    welcome: mail(account.accountWelcomeSubject(P, c), account.accountWelcomeHtml("Ada", 46, P, c), account.accountWelcomeText(46, P, c)),
    welcomeU: mail(account.accountWelcomeSubject(U, c), account.accountWelcomeHtml("Ada", 46, U, c), account.accountWelcomeText(46, U, c)),
    reset: mail(account.passwordResetSubject(P, c), account.passwordResetHtml(link, P, c), account.passwordResetText(link, P, c)),
    changed: mail(account.passwordChangedSubject(U, c), account.passwordChangedHtml("Ada", "14 Oct 2026 08:30 UTC", U, c), account.passwordChangedText("14 Oct 2026 08:30 UTC", U, c)),
    emailChange: account.emailChangeMail("Ada", link, P, c),
    emailChanged: account.emailChangedNotice("Ada", "new@example.com", "14 Oct 2026 08:30 UTC", P, c),
    signIn: account.newSignInMail("ada@example.com", null, "14 Oct 2026 08:30 UTC", U, c),
    sub: mail(pro.proWelcomeSubject("pctweaker", "annual", c), pro.proWelcomeHtml({ ...sale, plan: "annual" }, c), pro.proWelcomeText({ ...sale, plan: "annual" }, c)),
    life: mail(pro.proWelcomeSubject("pctweaker", "lifetime", c), pro.proWelcomeHtml({ ...sale, plan: "lifetime", renewsOn: null }, c), pro.proWelcomeText({ ...sale, plan: "lifetime", renewsOn: null }, c)),
    un: mail(pro.proWelcomeSubject("uninstaller", "annual", c), pro.proWelcomeHtml({ ...sale, product: "uninstaller", plan: "annual" }, c), pro.proWelcomeText({ ...sale, product: "uninstaller", plan: "annual" }, c)),
    rev: mail(pro.refundSubject("pctweaker", c), pro.refundHtml({ firstName: "Ada", plan: "annual", refundedLabel: "€59.99" }, c), pro.refundText({ firstName: "Ada", plan: "annual", refundedLabel: "€59.99" }, c)),
    revU: mail(pro.refundSubject("uninstaller", c), pro.refundHtml({ product: "uninstaller", firstName: "Ada", plan: null, refundedLabel: null }, c), pro.refundText({ product: "uninstaller", firstName: "Ada", plan: null, refundedLabel: null }, c)),
    ending: pro.endingMail({ product: "pctweaker", firstName: "Ada", plan: "annual", endsOn: "14 October 2027", reason: "cancelled" }, c),
    endingU: pro.endingMail({ product: "uninstaller", firstName: "", plan: "monthly", endsOn: "14 October 2027", reason: "payment_failed" }, c),
    bonus: pro.bonusMail("Ada", "14 October 2026", "14 October 2027", c),
    reminder: { ...lifetimeReminderEmail({ email: "ada@example.com", firstName: "Ada", unsubscribeUrl: "https://u.example/x" }, c) },
    ack: supportAckEmail("Ada Lovelace", "ada@example.com", c),
  };
}
const visible = (html) => html.replace(/<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<!doctype html>|<[^>]+>/gi, " ");

test("every message renders completely in every language, in the house style", () => {
  for (const locale of LOCALES) {
    for (const [name, m] of Object.entries(all(copyFor(locale)))) {
      const where = `${locale} ${name}`;
      assert.match(m.html, new RegExp(`<html lang="${locale}"`), where);
      assert.doesNotMatch(m.subject + m.html + m.text, /\$\{|undefined|NaN|\[object/, where);
      assert.doesNotMatch(m.subject + m.html + m.text, /illustrat/i, where);
      assert.doesNotMatch(m.subject + m.text + visible(m.html), /[!—]/, `${where}: no exclamation marks or long dashes`);
      assert.doesNotMatch(m.html, /<b>Ada/, `${where}: names are escaped`);
    }
  }
});

test("every language is actually translated", () => {
  const en = all(copyFor("en"));
  for (const locale of LOCALES.filter((l) => l !== "en")) {
    const other = all(copyFor(locale));
    for (const name of Object.keys(en)) assert.notEqual(other[name].subject, en[name].subject, `${locale} ${name}`);
  }
});

test("Portuguese is European and formal, German keeps the apps' du", () => {
  for (const m of Object.values(all(copyFor("pt")))) {
    const text = m.subject + m.text;
    assert.doesNotMatch(text, /\b(você|vocês|assinatura|arquivos?|tela|usuári\w*|baixar|senhas?|cadastr\w*|contato|equipe|aplicativo|gerenciar)\b/i, text.slice(0, 80));
  }
  for (const m of Object.values(all(copyFor("de")))) {
    assert.doesNotMatch(m.subject + m.text, /\b(Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihnen)\b/, m.subject);
  }
});

test("Accept-Language picks the first language the apps offer", () => {
  assert.equal(fromAcceptLanguage("pt-PT,pt;q=0.9,en;q=0.8"), "pt");
  assert.equal(fromAcceptLanguage("ja-JP, de;q=0.5"), "de");
  assert.equal(fromAcceptLanguage("ja-JP"), null);
  assert.equal(fromAcceptLanguage(undefined), null);
  assert.equal(copyFor("xx").tag, "en");
});
