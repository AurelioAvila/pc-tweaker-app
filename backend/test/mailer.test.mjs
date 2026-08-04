/**
 * Unit tests for how mail-provider failures are classified.
 *
 * This exists because getting it wrong is invisible in normal operation and
 * expensive when it matters: misclassifying our own outage as a bad address
 * tells a paying customer to "check your email address" while their signup is
 * blocked by something only we can fix.
 *
 * Run with: npm test  (node --test, no dependencies)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Drives the real `sendViaResend` path by stubbing `fetch` and
 * `RESEND_API_KEY`, so these assertions cover the shipped classification
 * rather than a copy of it.
 */
async function sendWithProviderStatus(status, body = "") {
  process.env.RESEND_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  });
  try {
    // Fresh module each time: mailer reads RESEND_API_KEY at import.
    delete require.cache[require.resolve("../src/mailer.js")];
    const { sendMail } = require("../src/mailer.js");
    return await sendMail({ to: "someone@example.com", subject: "s", html: "<p>h</p>" });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("a rejected recipient is reported as the address's fault", async () => {
  for (const status of [400, 422]) {
    await assert.rejects(
      () => sendWithProviderStatus(status),
      (err) => {
        assert.equal(err.name, "MailError");
        assert.equal(err.rejectedAddress, true, `status ${status} should blame the address`);
        return true;
      },
    );
  }
});

test("our own credential and quota problems are not blamed on the address", async () => {
  // Telling a user to "check your email address" because *our* API key expired
  // or *our* sending quota ran out sends them chasing a problem they cannot fix.
  for (const status of [401, 403, 429]) {
    await assert.rejects(
      () => sendWithProviderStatus(status),
      (err) => {
        assert.equal(err.rejectedAddress, false, `status ${status} is our fault, not the recipient's`);
        return true;
      },
    );
  }
});

test("a provider outage is not blamed on the address", async () => {
  for (const status of [500, 502, 503]) {
    await assert.rejects(
      () => sendWithProviderStatus(status),
      (err) => {
        assert.equal(err.rejectedAddress, false, `status ${status} is a provider outage`);
        return true;
      },
    );
  }
});

test("a successful send reports delivery", async () => {
  const result = await sendWithProviderStatus(200);
  assert.equal(result.delivered, true);
});
