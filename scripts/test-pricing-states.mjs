// Plans & pricing rendered for every plan state (owner report 23 Oct 2026):
// tiers below the one held say "Included in your plan", the held one says
// "Your plan" (or "Trial — N days left") with its manage action, higher
// ones offer the upgrade, and the small print under the plans offers,
// reports or explains the trial, never to a paying account. Six languages.
// Run with: node scripts/test-pricing-states.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const bundle = await build({
  stdin: {
    contents: `
      export { PricingPanel } from './src/components/pricing';
      export { PLAN_STATE_COPY, PRICING_COPY } from './src/components/pricing-copy';
      export { TRIAL_COPY } from './src/components/trial-copy';
      export { STRINGS } from './src/i18n';
      export { parseBillingStatus, parsePriceList, trialEntry } from './src/trial';
      export { TitleTrialButton, titleTrial } from './src/components/titlebar';
      export { PaywallModal } from './src/components/ui';
      export { createElement } from 'react';
      export { renderToStaticMarkup } from 'react-dom/server';`,
    resolveDir: root,
    loader: "tsx",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  // React stays a real dependency, resolved from node_modules next to the bundle.
  external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime"],
  jsx: "automatic",
  loader: { ".css": "empty", ".svg": "dataurl", ".png": "dataurl" },
  define: { "import.meta.env": '{"DEV":false}' },
  logLevel: "error",
});
const out = new URL("../node_modules/.cache/test-pricing-states.mjs", import.meta.url);
fs.mkdirSync(new URL(".", out), { recursive: true });
fs.writeFileSync(out, bundle.outputFiles[0].text);
const m = await import(pathToFileURL(fileURLToPath(out)).href);
const { PricingPanel, PLAN_STATE_COPY, PRICING_COPY, TRIAL_COPY, STRINGS, parseBillingStatus, parsePriceList, trialEntry, TitleTrialButton, titleTrial, PaywallModal, createElement, renderToStaticMarkup } = m;

const now = Date.now();
const prices = parsePriceList({ trial_enabled: true, trial_days: 3, prices: [
  { product: "pctweaker", plan: "monthly", amount: 499 },
  { product: "pctweaker", plan: "annual", amount: 2999 },
] });
const status = (product) => parseBillingStatus({ trial_enabled: true, trial_days: 3, portal_available: true, products: [{ product: "pctweaker", ...product }] });
const render = (lang, props) =>
  renderToStaticMarkup(createElement(PricingPanel, {
    s: STRINGS[lang], lang, isPro: false, heldPlan: null, hasBilling: false, prices, billing: null,
    freeTweakCount: 30, onChoosePro() {}, onManageBilling() {}, onOpenLifetimeTools() {}, ...props,
  })).replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const cards = (html) => {
  const parts = html.split('<article class="pricing-plan').slice(1);
  assert.equal(parts.length, 3, "Free, Pro and Lifetime cards");
  return { free: parts[0], pro: parts[1], lifetime: parts[2] };
};
const band = (html) => html.match(/<div class="pricing-fine" data-trial="(\w+)"/)?.[1] ?? null;
const count = (text, part) => part.split(text).length - 1;

for (const lang of Object.keys(PLAN_STATE_COPY)) {
  const ps = PLAN_STATE_COPY[lang], c = PRICING_COPY[lang], t = TRIAL_COPY[lang], s = STRINGS[lang].pricing;
  const days = (n) => ps.trialBadge.replace("{left}", ps.daysLeft.replace("{days}", n));

  // Signed out: Free is current, the Pro card offers the trial and the small print explains it.
  let html = render(lang, {});
  let k = cards(html);
  assert.equal(band(html), "offer", `${lang} signed out`);
  assert.ok(k.pro.includes(t.start.replace("{days}", 3)), `${lang} trial button on Pro`);
  assert.ok(html.includes(ps.bannerTitle.replace("{days}", 3)), `${lang} trial terms under the plans`);
  assert.ok(k.free.includes(s.proCurrent) && !k.pro.includes(s.proCurrent), `${lang} free current`);
  assert.ok(!html.includes(ps.includedInPlan), `${lang} nothing below Free`);

  // Signed in, eligible.
  html = render(lang, { billing: status({ state: "none", can_start_trial: true }) });
  assert.equal(band(html), "offer", `${lang} eligible`);

  // Trial already used: explained, plain subscribe button.
  html = render(lang, { billing: status({ state: "none", can_start_trial: false }) });
  assert.equal(band(html), "used", `${lang} used`);
  assert.ok(html.includes(t.trialUsed) && html.includes(t.used), `${lang} used copy`);
  assert.ok(!html.includes(t.start.replace("{days}", 3)), `${lang} no trial button once used`);

  // Trial running (2 days 20 hours left): Pro is current with the countdown, Free included.
  const trialing = status({ state: "trialing", plan: "monthly", trial_ends_at: new Date(now + 68 * 3600_000).toISOString(), can_start_trial: false });
  html = render(lang, { isPro: true, heldPlan: "monthly", hasBilling: true, billing: trialing });
  k = cards(html);
  assert.equal(band(html), "running", `${lang} trialing`);
  assert.ok(k.pro.includes(days(3)), `${lang} Trial — 3 days left on Pro: ${k.pro.slice(0, 300)}`);
  assert.ok(k.free.includes(ps.includedInPlan), `${lang} Free included during trial`);
  assert.ok(k.pro.includes(s.manageBilling), `${lang} manage during trial`);

  // Monthly and annual: Pro current with Manage subscription whichever period is shown;
  // Free included; Lifetime offered as the upgrade. No trial band for a paying account.
  for (const plan of ["monthly", "annual"]) {
    html = render(lang, { isPro: true, heldPlan: plan, hasBilling: true, billing: status({ state: "active", plan, can_start_trial: true }) });
    k = cards(html);
    assert.equal(band(html), null, `${lang} ${plan}: no trial for a paying account`);
    assert.ok(k.free.includes(ps.includedInPlan), `${lang} ${plan} free included`);
    assert.equal(count(s.proCurrent, k.pro), 1, `${lang} ${plan} Pro current`);
    assert.ok(k.pro.includes(s.manageBilling), `${lang} ${plan} manage`);
    assert.ok(k.lifetime.includes(s.switchToLifetime) && !k.lifetime.includes(s.proCurrent), `${lang} ${plan} upgrade`);
    // Their own plan, not the new-customer offer: no struck price, no period switch,
    // the renewal line (the subscription itself is read later, in the browser).
    assert.ok(!k.pro.includes("pricing-price-before") && k.pro.includes(c.renewal), `${lang} ${plan} own price`);
    assert.ok(!html.includes('class="pricing-period"'), `${lang} ${plan}: no Monthly/Yearly switch`);
  }

  // Lifetime: both lower tiers included, Lifetime current with its tools.
  html = render(lang, { isPro: true, heldPlan: "lifetime", hasBilling: false });
  k = cards(html);
  assert.equal(band(html), null, `${lang} lifetime`);
  assert.ok(k.free.includes(ps.includedInPlan) && k.pro.includes(ps.includedInPlan), `${lang} lifetime includes Free and Pro`);
  assert.ok(!k.pro.includes(s.proCurrent) && k.lifetime.includes(s.proCurrent) && k.lifetime.includes(c.openTools), `${lang} lifetime current`);
  assert.ok(k.lifetime.includes(ps.paid) && !k.lifetime.includes("pricing-price-before"), `${lang} lifetime paid, no offer`);

  // Pro from a grant or a referral bonus, without a subscription: Pro current, Free included.
  html = render(lang, { isPro: true, heldPlan: "lifetime_bonus", hasBilling: false });
  k = cards(html);
  assert.ok(k.free.includes(ps.includedInPlan) && k.pro.includes(s.proCurrent) && k.pro.includes(s.proActiveNoBilling), `${lang} grant`);
  assert.equal(band(html), null, `${lang} grant: no trial`);

  // Payment failed: no trial offered, the card can be fixed.
  html = render(lang, { billing: status({ state: "blocked", blocked_reason: "payment_failed", can_start_trial: false }) });
  assert.ok(html.includes(t.updatePayment) && band(html) !== "offer", `${lang} paused`);
}
console.log(`Pricing states: signed out, eligible, used, trial, monthly, annual, Lifetime, grant, paused in ${Object.keys(PLAN_STATE_COPY).length} languages passed.`);

// The main window and the locked points (owner, 23 Oct 2026): the title bar offers the trial
// to signed-out and eligible free accounts and counts a running one down, on every screen; it
// shows nothing to everyone else. The Pro dialog at every locked feature leads with the same
// trial. One rule (trialEntry) for both; a paying account never sees the trial, not even
// while its account is still loading.
const html = (el) => renderToStaticMarkup(el).replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const states = {
  "signed out": { signedIn: false, isPro: false, billing: null, want: "offer" },
  "free, loading": { signedIn: true, isPro: false, billing: undefined, want: null },
  free: { signedIn: true, isPro: false, billing: status({ state: "none", can_start_trial: true }), want: "offer" },
  "trial used": { signedIn: true, isPro: false, billing: status({ state: "none", can_start_trial: false }), want: null },
  "trial refused": { signedIn: true, isPro: false, billing: status({ state: "blocked", blocked_reason: "trial_already_used" }), want: null },
  "trial active": { signedIn: true, isPro: true, billing: status({ state: "trialing", plan: "monthly", trial_ends_at: new Date(now + 68 * 3600_000).toISOString() }), want: "running" },
  "trial, last day": { signedIn: true, isPro: true, billing: status({ state: "trialing", plan: "annual", trial_ends_at: new Date(now + 5 * 3600_000).toISOString() }), want: "running" },
  monthly: { signedIn: true, isPro: true, billing: status({ state: "active", plan: "monthly", can_start_trial: true }), want: null },
  annual: { signedIn: true, isPro: true, billing: status({ state: "active", plan: "annual", can_start_trial: true }), want: null },
  lifetime: { signedIn: true, isPro: true, billing: status({ state: "none", can_start_trial: true }), want: null },
  // PC Tweaker sells no Business plan; Pro from a grant or a referral bonus is the other paid state.
  "grant or bonus": { signedIn: true, isPro: true, billing: status({ state: "none", can_start_trial: true }), want: null },
  paused: { signedIn: true, isPro: false, billing: status({ state: "blocked", blocked_reason: "payment_failed" }), want: null },
  "trials off": { signedIn: true, isPro: false, billing: parseBillingStatus({ trial_enabled: false, trial_days: 3, products: [{ product: "pctweaker", state: "none", can_start_trial: false }] }), want: null },
};
for (const lang of Object.keys(PLAN_STATE_COPY)) {
  const s = STRINGS[lang], ps = PLAN_STATE_COPY[lang], t = TRIAL_COPY[lang];
  const start = t.start.replace("{days}", 3);
  for (const [name, st] of Object.entries(states)) {
    const entry = trialEntry("pctweaker", st.signedIn, st.isPro, prices, st.billing);
    assert.equal(entry?.kind ?? null, st.want, `${lang} ${name}: entry`);
    const row = html(createElement(TitleTrialButton, { trial: titleTrial(lang, entry, now), onOpen() {} }));
    const modal = html(createElement(PaywallModal, { s, lang, featureName: "Zero-Trace", trialDays: entry?.kind === "offer" ? entry.days : null, onClose() {}, onNotify() {} }));
    if (st.want === "offer") {
      assert.ok(row.includes("titlebar-trial is-offer") && row.includes(`<span>${start}</span>`), `${lang} ${name}: title bar offers the trial`);
      assert.ok(modal.includes(start) && !modal.includes(s.paywall.unlock), `${lang} ${name}: locked point leads with the trial`);
    } else if (st.want === "running") {
      const left = name === "trial active" ? ps.daysLeft.replace("{days}", 3) : ps.oneDayLeft;
      assert.ok(row.includes("titlebar-trial is-running") && row.includes(ps.trialBadge.replace("{left}", left)), `${lang} ${name}: title bar counts the trial down: ${row}`);
      assert.ok(!row.includes(start) && !modal.includes(start), `${lang} ${name}: no second trial`);
    } else {
      assert.equal(row, "", `${lang} ${name}: no trial in the title bar`);
      assert.ok(!modal.includes(start) && modal.includes(s.paywall.unlock), `${lang} ${name}: locked point without a trial`);
    }
  }
  assert.equal(titleTrial(lang, { kind: "running", endsAt: now - 1 }, now).label, ps.trialBadge.replace("{left}", ps.endsToday), `${lang} ends today`);
}
console.log(`Main window and locked points: ${Object.keys(states).length} plan states in ${Object.keys(PLAN_STATE_COPY).length} languages passed.`);
