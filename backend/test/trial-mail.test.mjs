import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sinkDir = mkdtempSync(join(tmpdir(), "trial-mail-"));
process.env.DATABASE_URL = "pgmem";
process.env.EMAIL_SINK = "1";
process.env.EMAIL_SINK_DIR = sinkDir;
process.env.MAIL_FROM = "PC Tweaker <noreply@pctweaker.app>";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;

const { trialMail, trialMoment, failureKey } = await import("../dist/emails/trial.js");
const { copyFor, LOCALES } = await import("../dist/emails/copy/index.js");
const { getPool, initSchema } = await import("../dist/db.js");
const { deliverProReceipt } = await import("../dist/routes/stripe.js");
await initSchema();

const KINDS = ["trial_started", "trial_ending", "trial_paid", "trial_payment_failed", "renewal_payment_failed", "trial_ended"];
const full = {
  firstName: "Marco", email: "marco@example.com", plan: "annual",
  trialEnd: new Date("2026-10-17T12:05:00Z"), amount: { minor: 399, currency: "eur" }, renewsOn: new Date("2026-11-17T12:05:00Z"),
  card: { brand: "visa", last4: "4242" }, failure: "insufficient_funds", portalUrl: "https://invoice.stripe.com/i/acct_x/test_y", reason: "cancelled",
};

test("every trial message renders whole in six languages for both products", () => {
  for (const product of ["pctweaker", "uninstaller"]) {
    for (const locale of LOCALES) {
      for (const kind of KINDS) {
        for (const reason of kind === "trial_ended" ? ["cancelled", "no_method"] : ["cancelled"]) {
          const mail = trialMail(kind, { ...full, product, reason }, copyFor(locale));
          const where = `${product}/${locale}/${kind}/${reason}`;
          for (const part of [mail.subject, mail.html, mail.text]) {
            assert.doesNotMatch(part, /\$\{|\{\{|\bundefined\b|\bnull\b|\bNaN\b/, where);
          }
          assert.match(mail.html, new RegExp(`<html lang="${locale}"`), where);
          assert.ok(mail.subject.length > 10 && mail.subject.length < 90, where);
        }
      }
    }
  }
});

test("values are escaped, the empty name drops cleanly, and the card, moment and amount are local", () => {
  const c = copyFor("it");
  const mail = trialMail("trial_started", { ...full, product: "pctweaker", firstName: "<b>Eve</b>", email: "e&v@example.com" }, c);
  assert.match(mail.html, /&lt;b&gt;Eve&lt;\/b&gt;/);
  assert.doesNotMatch(mail.html, /<b>Eve/);
  assert.match(mail.html, /e&amp;v@example\.com/);
  assert.match(mail.text, /Visa che termina con 4242/);
  assert.match(mail.text, /17 ottobre 2026, 14:05 \(CEST\)/);
  assert.match(mail.text, /3,99\s€/);
  assert.match(mail.text, /Pro, annuale/);

  const nameless = trialMail("trial_paid", { ...full, product: "pctweaker", firstName: "" }, copyFor("en"));
  assert.match(nameless.text, /^The trial is over and Pro stays on\.$/m);
  assert.equal(trialMoment("en-GB", new Date("2026-12-17T12:05:00Z")), "17 December 2026, 13:05 (CET)");

  const noCard = trialMail("trial_ending", { ...full, product: "uninstaller", card: null }, copyFor("de"));
  assert.match(noCard.text, /von der beim Kauf hinterlegten Zahlungsmethode abgebucht/, "dative after von");
  assert.match(trialMail("trial_started", { ...full, product: "pctweaker", card: null }, copyFor("it")).text, /addebitato sul metodo di pagamento/);
  assert.match(trialMail("trial_started", { ...full, product: "pctweaker", card: null }, copyFor("es")).text, /con cargo al método de pago/);
  assert.match(trialMail("trial_started", { ...full, product: "pctweaker", card: null }, copyFor("pt")).text, /cobrados no método de pagamento/);
  assert.match(noCard.subject, /Uninstaller/);

  const renewal = trialMail("renewal_payment_failed", { ...full, product: "pctweaker" }, copyFor("en"));
  assert.match(renewal.text, /^The renewal charge of €3\.99 for your PC Tweaker Pro subscription could not be taken: insufficient funds\./m);
  assert.doesNotMatch(renewal.text, /trial/i);
  assert.match(renewal.html, /href="https:\/\/invoice\.stripe\.com\/i\/acct_x\/test_y"/);
  const ended = trialMail("trial_ended", { ...full, product: "pctweaker", reason: "no_method" }, copyFor("en"));
  assert.match(ended.text, /with no payment method on the account/);
});

test("a missing value fails the delivery instead of mailing a hole", () => {
  assert.throws(() => trialMail("trial_started", { ...full, product: "pctweaker", amount: null }, copyFor("en")), /chargeAmount/);
  assert.throws(() => trialMail("trial_payment_failed", { ...full, product: "pctweaker", portalUrl: null }, copyFor("en")), /portalUrl/);
});

test("decline codes map to the copy's reasons", () => {
  assert.equal(failureKey({ code: "card_declined", decline_code: "insufficient_funds" }), "insufficient_funds");
  assert.equal(failureKey({ code: "card_declined", decline_code: "generic_decline" }), "card_declined");
  assert.equal(failureKey({ code: "expired_card" }), "expired_card");
  assert.equal(failureKey(null, true), "authentication_required");
  assert.equal(failureKey({ code: "processing_error" }), "processing_error");
  assert.equal(failureKey(null), "generic");
});

test("the outbox delivers the trial's end and first payment in the account's language; old refusals send nothing", async () => {
  const { rows } = await getPool().query(
    "INSERT INTO users (email, password_hash, email_verified, first_name, locale) VALUES ('anna@example.com', 'x', TRUE, 'Anna Maria', 'it') RETURNING id",
  );
  const userId = String(rows[0].id);
  await deliverProReceipt({ kind: "trial_ended", userId, product: "pctweaker", plan: "monthly", subscriptionId: "sub_x",
    expiresAt: "2026-10-17T12:05:00.000Z", chargedLabel: null, reason: "cancelled" });
  await deliverProReceipt({ kind: "trial_paid", userId, product: "uninstaller", plan: "annual",
    expiresAt: "2027-10-17T12:05:00.000Z", chargedLabel: "€9.99 / year", amountMinor: 999, currency: "eur" });
  await deliverProReceipt({ kind: "trial_rejected", userId, product: "pctweaker", plan: "monthly", expiresAt: null, chargedLabel: null });
  const files = readdirSync(sinkDir).filter((f) => f.endsWith(".txt")).map((f) => readFileSync(join(sinkDir, f), "utf8"));
  assert.equal(files.length, 2);
  const ended = files.find((f) => f.includes("annullata"));
  assert.ok(ended, files.join("\n---\n"));
  assert.match(ended, /Pro è disattivato e non è stato addebitato nulla, Anna\./);
  assert.match(ended, /17 ottobre 2026, 14:05 \(CEST\)/);
  const paid = files.find((f) => f.includes("Uninstaller"));
  assert.match(paid, /9,99\s€/);
  assert.match(paid, /17 ottobre 2027/);
});
