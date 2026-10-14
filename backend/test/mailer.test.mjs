/**
 * Unit tests for how mail-provider failures are classified.
 *
 * This exists because getting it wrong is invisible in normal operation and
 * expensive when it matters: misclassifying our own outage as a bad address
 * tells a paying customer to "check your email address" while their signup is
 * blocked by something only we can fix.
 *
 * Run with: npm test — the `pretest` script compiles TypeScript first, so
 * this always exercises the same dist/ output that ships to production.
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
  process.env.MAIL_FROM = "PC Tweaker <mail@example.com>";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(status === 200 ? JSON.stringify({ id: "fixture-id" }) : body, { status, headers: { "content-type": "application/json" } });
  try {
    // Fresh module each time: mailer reads RESEND_API_KEY at import.
    delete require.cache[require.resolve("../dist/mailer.js")];
    const { sendMail } = require("../dist/mailer.js");
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

test("customer replies use the branded alias without replacing support-form replies", async () => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.MAIL_FROM = "PC Tweaker <mail@example.com>";
  const originalFetch = globalThis.fetch;
  const payloads = [];
  globalThis.fetch = async (_url, init) => {
    payloads.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: `fixture-${payloads.length}` }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    delete require.cache[require.resolve("../dist/mailer.js")];
    const { sendMail } = require("../dist/mailer.js");
    const message = { to: "someone@example.com", subject: "test", html: "<p>test</p>" };
    await sendMail(message);
    await sendMail({ ...message, replyTo: "customer@example.com", headers: { "List-Unsubscribe": "<https://x.test/u>" } });
    assert.equal(payloads[0].reply_to, "support@pctweaker.app");
    assert.equal(payloads[1].reply_to, "customer@example.com");
    assert.equal(payloads[0].headers, undefined);
    assert.deepEqual(payloads[1].headers, { "List-Unsubscribe": "<https://x.test/u>" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production never falls back to an unverified sender", async () => {
  process.env.RESEND_API_KEY = "test-key";
  delete process.env.MAIL_FROM;
  process.env.NODE_ENV = "production";
  delete require.cache[require.resolve("../dist/mailer.js")];
  const { sendMail, isConfigured } = require("../dist/mailer.js");
  assert.equal(isConfigured, false);
  await assert.rejects(
    () => sendMail({ to: "someone@example.com", subject: "s", html: "<p>h</p>" }),
    /No email provider is configured/,
  );
});

/** The fallback chain, end to end through the shipped mailer: fetch is a stub, nothing leaves the process. */
async function sendThroughChain(script, extraEnv = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, { RESEND_API_KEY: "test-key", MAIL_FROM: "PC Tweaker <mail@example.com>", NODE_ENV: "test" }, extraEnv);
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const name = url.includes("resend") ? "resend" : url.includes("smtp2go") ? "smtp2go" : "mailjet";
    calls.push({ name, init });
    return script[name]();
  };
  try {
    delete require.cache[require.resolve("../dist/mailer.js")];
    const { sendMail } = require("../dist/mailer.js");
    const result = await sendMail({ to: "someone@example.com", subject: "s", html: "<p>h</p>", text: "h" }).catch((err) => err);
    return { result, calls };
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}
const reply = (status, body) => () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("Resend out of quota hands the message to SMTP2GO once its key is set", async () => {
  const { result, calls } = await sendThroughChain(
    { resend: reply(429, { name: "daily_quota_exceeded" }), smtp2go: reply(200, { data: { succeeded: 1, failed: 0, email_id: "s2g" } }) },
    { SMTP2GO_API_KEY: "api-test" },
  );
  assert.equal(result.delivered, true);
  assert.deepEqual(calls.map((c) => c.name), ["resend", "smtp2go"]);
  assert.equal(calls[1].init.headers["X-Smtp2go-Api-Key"], "api-test");
});

test("without the fallback keys a Resend refusal fails exactly as before, after one call", async () => {
  const { result, calls } = await sendThroughChain({ resend: reply(429, { name: "daily_quota_exceeded" }) });
  assert.equal(result.name, "MailError");
  assert.equal(result.rejectedAddress, false);
  assert.deepEqual(calls.map((c) => c.name), ["resend"]);
  assert.ok(!result.message.includes("someone@example.com"));
});

test("EMAIL_SINK sends nothing", async () => {
  const dir = (await import("node:fs")).mkdtempSync((await import("node:path")).join((await import("node:os")).tmpdir(), "pct-sink-"));
  try {
    const { result, calls } = await sendThroughChain({}, { EMAIL_SINK: "1", EMAIL_SINK_DIR: dir });
    assert.equal(result.delivered, true);
    assert.equal(calls.length, 0);
  } finally {
    (await import("node:fs")).rmSync(dir, { recursive: true, force: true });
  }
});