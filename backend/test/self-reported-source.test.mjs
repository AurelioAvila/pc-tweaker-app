// Thanks-page answer: only a completed session of ours gets the one field,
// once, and nothing reaches Stripe for junk input.
import { test } from "node:test";
import assert from "node:assert/strict";

const { recordSelfReportedSource } = await import("../dist/routes/stripe.js");
const ID = "cs_test_a1B2c3D4e5F6g7";

function fakeApi(session) {
  const calls = [];
  return {
    calls,
    retrieve: async (id) => { calls.push(["retrieve", id]); if (!session) throw new Error("No such checkout.session"); return session; },
    update: async (id, params) => { calls.push(["update", id, params]); return session; },
  };
}

test("a completed session of ours records the answer, and only that field", async () => {
  const api = fakeApi({ status: "complete", metadata: { product: "pctweaker", plan: "lifetime", userId: "7" } });
  assert.equal(await recordSelfReportedSource(ID, "tiktok", api), true);
  assert.deepEqual(api.calls.at(-1), ["update", ID, { metadata: { self_reported_source: "tiktok" } }]);
});

test("open, foreign, already-answered or missing sessions are left alone", async () => {
  for (const session of [
    { status: "open", metadata: { product: "pctweaker" } },
    { status: "complete", metadata: {} },
    { status: "complete", metadata: { product: "pctweaker", self_reported_source: "youtube" } },
    null,
  ]) {
    const api = fakeApi(session);
    assert.equal(await recordSelfReportedSource(ID, "youtube", api), false);
    assert.equal(api.calls.some(([kind]) => kind === "update"), false);
  }
});

test("junk ids and answers never reach Stripe", async () => {
  for (const [id, source] of [["cs_test_x", "youtube"], ["pi_123456789012", "youtube"], [ID, "reddit"], [ID, "toString"], [ID, ["youtube"]], [undefined, "youtube"]]) {
    const api = fakeApi({ status: "complete", metadata: { product: "pctweaker" } });
    assert.equal(await recordSelfReportedSource(id, source, api), false);
    assert.equal(api.calls.length, 0);
  }
});
