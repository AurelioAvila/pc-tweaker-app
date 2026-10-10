import test from "node:test";
import assert from "node:assert/strict";

const { flagsHandler } = await import("../dist/routes/flags.js");

function response() {
  return {
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("the process hold is off unless the environment turns it on exactly", () => {
  for (const [env, expected] of [
    [{}, false],
    [{ PCT_PROCESS_GUARD_HOLD: "0" }, false],
    [{ PCT_PROCESS_GUARD_HOLD: "true" }, false],
    [{ PCT_PROCESS_GUARD_HOLD: "1" }, true],
  ]) {
    const res = response();
    flagsHandler(env)({}, res);
    assert.deepEqual(res.body, { processGuardHold: expected });
    assert.equal(res.headers["cache-control"], "no-store");
  }
});
