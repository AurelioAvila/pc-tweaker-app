import test from "node:test";
import assert from "node:assert/strict";

const { proWelcomeHtml } = await import("../dist/emails/pro-welcome.js");

// A one-off purchase has no renewal date. The email used to be handed
// `expiresAt ?? new Date()`, which turned "never renews" into "renews today"
// — wrong, and alarming to someone who just paid to never pay again.
test("a purchase that never renews is not given a renewal date", () => {
  const html = proWelcomeHtml({
    firstName: "Sam",
    email: "sam@example.com",
    plan: "lifetime",
    priceLabel: "EUR 74.99 once",
    renewsOn: null,
  });

  assert.match(html, /Never expires/, "the row must state that access does not lapse");
  assert.doesNotMatch(html, /Renews on/, "nothing renews, so nothing should say it does");
  assert.match(html, /Pro — Lifetime/, "the plan name must not fall back to Monthly");
});

test("a subscription still quotes its renewal date", () => {
  const html = proWelcomeHtml({
    firstName: "Sam",
    email: "sam@example.com",
    plan: "annual",
    priceLabel: "EUR 59 / year",
    renewsOn: "September 24, 2027",
  });

  assert.match(html, /Renews on/);
  assert.match(html, /September 24, 2027/);
  assert.match(html, /Pro — Annual/);
  assert.doesNotMatch(html, /Never expires/);
});

// The account address is chosen by the user and interpolated into HTML.
test("the recipient address is escaped, not injected", () => {
  const html = proWelcomeHtml({
    firstName: "Sam",
    email: 'a"><script>alert(1)</script>@example.com',
    plan: "monthly",
    priceLabel: "EUR 9.99 / month",
    renewsOn: "September 24, 2027",
  });

  assert.doesNotMatch(
    html,
    /<\s*script\b[^>]*>/i,
    "no executable script element may survive into the message",
  );
  assert.match(
    html,
    /a&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;@example\.com/,
    "the complete recipient address must be rendered as escaped text",
  );
});

const { refundHtml, refundText, refundSubject } = await import("../dist/emails/pro-welcome.js");

test("the refund notice states the amount, the access change and, for subscriptions, renewal", () => {
  const lifetime = { firstName: "Sam", plan: "lifetime", refundedLabel: "€99.00" };
  assert.equal(refundSubject(), "Your PC Tweaker Pro refund is confirmed");
  assert.equal(refundSubject("uninstaller"), "Your PC Tweaker Uninstaller Pro refund is confirmed");
  for (const body of [refundHtml(lifetime), refundText(lifetime)]) {
    assert.match(body, /€99\.00/);
    assert.match(body, /has ended/);
    assert.doesNotMatch(body, /renew/);
  }
  assert.match(refundHtml({ ...lifetime, plan: "monthly" }), /does not renew/);
  assert.match(refundText({ ...lifetime, refundedLabel: null }), /refunded your payment/);
  assert.match(refundHtml({ ...lifetime, firstName: "" }), /Your refund is on its way./);
  assert.doesNotMatch(refundHtml({ ...lifetime, firstName: "<b>x</b>" }), /<b>x<\/b>/);
});

test("every shell carries a hidden preheader and declares its colour scheme", () => {
  const html = refundHtml({ firstName: "Sam", plan: "lifetime", refundedLabel: "€99.00" });
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
  assert.match(html, /<div style="display:none;[^"]*">We've refunded €99\.00/);
});
