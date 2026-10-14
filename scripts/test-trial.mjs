import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../src/trial.ts", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { parseBillingStatus, parsePriceList, trialOffer, trialUsed, trialLeft, nextTrialEnd, planSnapshot, billingChanges } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);

const row = (over = {}) => ({
  product: "pctweaker",
  state: "none",
  status: null,
  plan: null,
  trial_ends_at: null,
  current_period_end: null,
  cancel_at_period_end: false,
  can_start_trial: true,
  blocked_reason: "none",
  ...over,
});
const status = (rows, over = {}) =>
  parseBillingStatus({ trial_enabled: true, trial_days: 3, portal_available: false, products: rows, ...over });
const prices = parsePriceList({
  trial_enabled: true,
  trial_days: 3,
  currency: "eur",
  prices: [
    { product: "pctweaker", plan: "monthly", amount: 799, interval: "month" },
    { product: "pctweaker", plan: "annual", amount: 5999, interval: "year" },
    { product: "uninstaller", plan: "annual", amount: 999, interval: "year" },
  ],
});

// Contract §1: unknown states read as none, unknown reasons as canceled.
const odd = status([row({ state: "paused" }), row({ product: "uninstaller", state: "blocked", blocked_reason: "chargeback" })]);
assert.equal(odd.products[0].state, "none");
assert.equal(odd.products[1].blockedReason, "canceled");
// Unknown products and malformed payloads never reach the UI.
assert.equal(status([row({ product: "tweaky" })]).products.length, 0);
for (const bad of [null, {}, { products: "x" }]) assert.equal(parseBillingStatus(bad), null);
// A trial with no end date cannot be counted down: shown as Pro.
assert.equal(status([row({ state: "trialing" })]).products[0].state, "active");

// The trial button needs the switch, the account's eligibility and a server price.
assert.deepEqual(trialOffer("pctweaker", "monthly", prices, null), { days: 3, amount: 799 });
assert.deepEqual(trialOffer("pctweaker", "annual", prices, status([row()])), { days: 3, amount: 5999 });
assert.equal(trialOffer("pctweaker", "lifetime", prices, null), null, "Lifetime never has a trial");
assert.equal(trialOffer("pctweaker", "monthly", null, null), null, "no price, no trial line");
assert.equal(trialOffer("pctweaker", "monthly", { ...prices, trialEnabled: false }, null), null, "switch off");
assert.equal(trialOffer("pctweaker", "monthly", prices, status([row()], { trial_enabled: false })), null);
assert.equal(trialOffer("pctweaker", "monthly", prices, status([row({ can_start_trial: false })])), null);
// An account-specific renewal price (loyalty) wins over the public list.
assert.deepEqual(trialOffer("uninstaller", "annual", prices, status([row({ product: "uninstaller", renew_amount: 499 })])), { days: 3, amount: 499 });
assert.equal(status([row({ renew_amount: 4.5 })]).products[0].renewAmount, null);
// With the price list missing, a live promotion's regular price is still the server's.
assert.deepEqual(trialOffer("pctweaker", "monthly", null, status([row()]), 799), { days: 3, amount: 799 });
// A malformed price is dropped rather than printed.
assert.equal(parsePriceList({ prices: [{ product: "pctweaker", plan: "monthly", amount: 7.99 }] }).prices.length, 0);
assert.equal(parsePriceList({ currency: "usd", prices: [] }), null);

// "Already used" only when the server is offering trials and this account cannot have one.
assert.equal(trialUsed("pctweaker", status([row({ can_start_trial: false })])), true);
assert.equal(trialUsed("pctweaker", status([row({ can_start_trial: false })], { trial_enabled: false })), false);
assert.equal(trialUsed("pctweaker", status([row({ state: "blocked", blocked_reason: "trial_already_used", can_start_trial: false })])), true);
assert.equal(trialUsed("pctweaker", status([row({ state: "active", can_start_trial: false })])), false);

// Countdown and progress.
const end = Date.parse("2026-10-17T10:00:00Z");
const left = trialLeft(end, 3, end - (2 * 86_400_000 + 5 * 3_600_000 + 7 * 60_000));
assert.deepEqual([left.days, left.hours, left.minutes, left.over], [2, 5, 7, false]);
assert.ok(left.used > 0.26 && left.used < 0.27);
assert.equal(trialLeft(end, 3, end + 1000).over, true);
assert.equal(trialLeft(end, 3, end + 1000).used, 1);

// The app looks again at the nearest trial end still ahead.
const trialing = status([
  row({ state: "trialing", trial_ends_at: "2026-10-17T10:00:00.000Z", can_start_trial: false }),
  row({ product: "uninstaller", state: "trialing", trial_ends_at: "2026-10-16T10:00:00.000Z" }),
]);
assert.equal(nextTrialEnd(trialing, Date.parse("2026-10-15T00:00:00Z")), Date.parse("2026-10-16T10:00:00Z"));
assert.equal(nextTrialEnd(trialing, Date.parse("2026-10-18T00:00:00Z")), null);

// One notice on return: paused after a failed payment, ended after a trial
// or plan that stopped, a toast when a trial became a subscription.
const seen = planSnapshot(trialing);
const after = (state, blocked_reason = "none") => status([row({ state, blocked_reason, can_start_trial: false })]);
assert.deepEqual(billingChanges(seen, after("blocked", "payment_failed")), [{ product: "pctweaker", kind: "paused" }]);
assert.deepEqual(billingChanges(seen, after("blocked", "canceled")), [{ product: "pctweaker", kind: "trialEnded" }]);
assert.deepEqual(billingChanges(seen, after("active")), [{ product: "pctweaker", kind: "converted" }]);
assert.deepEqual(billingChanges({ pctweaker: "active" }, after("blocked", "canceled")), [{ product: "pctweaker", kind: "ended" }]);
assert.deepEqual(billingChanges(null, after("blocked", "payment_failed")), [], "first look: nothing to compare");
assert.deepEqual(billingChanges({ pctweaker: "none" }, after("blocked", "trial_already_used")), []);
assert.deepEqual(billingChanges(planSnapshot(after("blocked", "payment_failed")), after("blocked", "payment_failed")), [], "shown once");

console.log("trial: ok");
