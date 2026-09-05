import test from "node:test";
import assert from "node:assert/strict";

import { isEntitled, periodEndFromSubscription } from "../dist/entitlement.js";

const NOW = new Date("2026-08-08T12:00:00Z");
const YESTERDAY = new Date("2026-08-07T12:00:00Z");
const NEXT_MONTH = new Date("2026-09-08T12:00:00Z");

test("a free account is not entitled", () => {
  assert.equal(isEntitled({ is_pro: false }, NOW), false);
  assert.equal(isEntitled(null, NOW), false);
  assert.equal(isEntitled(undefined, NOW), false);
});

test("a subscriber inside the paid period is entitled", () => {
  assert.equal(isEntitled({ is_pro: true, plan: "monthly", pro_expires_at: NEXT_MONTH }, NOW), true);
});

// The whole point of the column: this is the case that used to grant Pro
// forever whenever a cancellation webhook went missing.
test("a lapsed period revokes access even while is_pro is still TRUE", () => {
  assert.equal(isEntitled({ is_pro: true, plan: "annual", pro_expires_at: YESTERDAY }, NOW), false);
});

test("a lifetime purchase never expires", () => {
  assert.equal(isEntitled({ is_pro: true, plan: "lifetime", pro_expires_at: null }, NOW), true);
  // Even if some event wrote a stale date onto it, the plan wins.
  assert.equal(isEntitled({ is_pro: true, plan: "lifetime", pro_expires_at: YESTERDAY }, NOW), true);
});

test("subscribers predating the column keep access until an event backfills it", () => {
  assert.equal(isEntitled({ is_pro: true, plan: "monthly", pro_expires_at: null, legacy_pro_grant: true }, NOW), true);
  assert.equal(isEntitled({ is_pro: true, plan: "monthly", pro_expires_at: null }, NOW), false);
  assert.equal(isEntitled({ is_pro: true, plan: "monthly", pro_expires_at: null, legacy_pro_grant: false }, NOW), false);
});

test("invalid recurring expiry never creates perpetual access", () => {
  for (const expiry of ["not-a-date", new Date(NaN), new Date(Infinity)]) {
    assert.equal(isEntitled({ is_pro: true, plan: "annual", pro_expires_at: expiry, legacy_pro_grant: true }, NOW), false);
  }
});

test("timestamps are accepted as strings, the way pg may return them", () => {
  assert.equal(isEntitled({ is_pro: true, plan: "monthly", pro_expires_at: NEXT_MONTH.toISOString() }, NOW), true);
  assert.equal(isEntitled({ is_pro: true, plan: "monthly", pro_expires_at: YESTERDAY.toISOString() }, NOW), false);
});

test("period end is read from the subscription item, where the basil API puts it", () => {
  const subscription = { items: { data: [{ current_period_end: 1788000000 }] } };
  assert.deepEqual(periodEndFromSubscription(subscription), new Date(1788000000 * 1000));
});

test("period end falls back to the legacy top-level field", () => {
  assert.deepEqual(periodEndFromSubscription({ current_period_end: 1788000000 }), new Date(1788000000 * 1000));
});

test("a subscription carrying no period end resolves to null, not a bogus date", () => {
  assert.equal(periodEndFromSubscription({}), null);
  assert.equal(periodEndFromSubscription({ items: { data: [] } }), null);
  assert.equal(periodEndFromSubscription(null), null);
  for (const seconds of [0, -1, NaN, Infinity, Number.MAX_VALUE]) {
    assert.equal(periodEndFromSubscription({ items: { data: [{ current_period_end: seconds }] } }), null);
  }
});
