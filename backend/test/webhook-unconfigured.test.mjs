import test from "node:test";
import assert from "node:assert/strict";

delete process.env.DATABASE_URL;
delete process.env.STRIPE_SECRET_KEY;
const { webhookHandler, handleEvent } = await import("../dist/routes/stripe.js");

test("an unconfigured database cannot acknowledge a billing event", async () => {
  let status;
  let body;
  const response = {
    status(value) { status = value; return this; },
    send(value) { body = value; return this; },
    json() { assert.fail("event must not be acknowledged as received"); },
  };
  await webhookHandler({ headers: {} }, response);
  assert.equal(status, 503);
  assert.match(body, /event was not accepted/);
  await assert.rejects(handleEvent({ type: "checkout.session.completed" }), /Database is not configured/);
});
