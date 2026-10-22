// The account menu names each product's plan like the pricing screen does:
// Free without a purchase, Pro with its billing period, Lifetime for a
// one-time purchase (owner decision, 22 Oct 2026), in all six languages.
// Run with: node scripts/test-plan-label.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const bundle = await build({
  stdin: {
    contents: "export { productPlanLabel } from './src/plan-label'; export { STRINGS, localeOf } from './src/i18n';",
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
});
const { productPlanLabel, STRINGS, localeOf } = await import(
  "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64")
);

const until = "2026-11-10T12:00:00.000Z";
for (const lang of ["en", "it", "fr", "es", "de", "pt"]) {
  const s = STRINGS[lang];
  const words = { ...s.auth, freeName: s.pricing.freeName, proName: s.pricing.proName };
  const label = (plan) => productPlanLabel(plan, words, lang);
  const date = new Date(until).toLocaleDateString(localeOf(lang), { dateStyle: "medium" });

  // No purchase, or a subscription that has ended: the Free plan, no date.
  for (const plan of [
    { product: "pctweaker", active: false, plan: null },
    { product: "uninstaller", active: false, plan: "monthly", expiresAt: "2026-09-01T00:00:00Z" },
  ]) {
    assert.deepEqual(label(plan), { label: s.pricing.freeName, until: null }, `${lang}: inactive is Free`);
  }

  // A subscription is Pro with its period, and the day it runs until.
  for (const [plan, period] of [
    ["monthly", s.auth.planMonthly],
    ["annual", s.auth.planAnnual],
  ]) {
    const got = label({ product: "pctweaker", active: true, plan, expiresAt: until });
    assert.equal(got.label, `${s.pricing.proName} · ${period}`, `${lang}: ${plan} is Pro`);
    assert.ok(got.until.includes(date), `${lang}: ${plan} shows ${date}, got ${got.until}`);
    assert.equal(got.until[0], got.until[0].toLocaleUpperCase(localeOf(lang)), `${lang}: date line starts upper-case`);
  }
  assert.deepEqual(label({ product: "pctweaker", active: true, plan: "trialing" }), { label: s.pricing.proName, until: null });

  // Lifetime never shows a date, and is named like the pricing screen's plan.
  assert.deepEqual(
    label({ product: "pctweaker", active: true, plan: "lifetime", expiresAt: until }),
    { label: s.pricing.lifetimeName, until: null },
    `${lang}: lifetime`,
  );
  assert.equal(s.auth.planLifetime, s.pricing.lifetimeName, `${lang}: one name for Lifetime`);
  assert.equal(label({ product: "uninstaller", active: true, plan: "lifetime_bonus", expiresAt: until }).label, s.auth.planBonus);
}

// Portuguese dates are European Portuguese, not the Brazilian default.
assert.ok(
  productPlanLabel(
    { product: "pctweaker", active: true, plan: "monthly", expiresAt: until },
    { ...STRINGS.pt.auth, freeName: STRINGS.pt.pricing.freeName, proName: "Pro" },
    "pt",
  ).until.includes(new Date(until).toLocaleDateString("pt-PT", { dateStyle: "medium" })),
);

// "Not active" is gone from the account menu.
const account = fs.readFileSync(new URL("../src/components/account.tsx", import.meta.url), "utf8");
assert.doesNotMatch(account, /planInactive/);
assert.match(account, /productPlanLabel\(\s*p,\s*\{ \.\.\.s\.auth, freeName: s\.pricing\.freeName, proName: s\.pricing\.proName \}/);

// One focus ring on every text field, Tailwind-styled ones included: the
// rule may not exclude `outline-none` fields again, and keeps a transparent
// outline for Windows contrast themes.
const css = fs.readFileSync(new URL("../src/desktop-refresh.css", import.meta.url), "utf8");
const ring = css.match(/:is\(\s*input:not\(\[type="checkbox"\][^{]*\{[^}]*\}/);
assert.ok(ring, "single-ring rule present");
assert.doesNotMatch(ring[0], /outline-none/, "Tailwind fields are not excluded");
assert.match(ring[0], /outline: 2px solid transparent !important/);
assert.match(ring[0], /box-shadow: 0 0 0 1px var\(--focus\) !important/);

console.log("plan label and focus ring checks passed: Free, Pro with period and date, Lifetime, six languages, pt-PT dates, one ring.");
