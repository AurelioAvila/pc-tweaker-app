import test from "node:test";
import assert from "node:assert/strict";

import { deviceHashFrom } from "../dist/license.js";

// The desktop apps refuse a licence that names another PC (license.rs
// bound_to); the backend only ever signs a well-formed hash into it.
test("only a lower-case SHA-256 from X-Device-Hash is signed into the licence", () => {
  const hash = "0123456789abcdef".repeat(4);
  assert.deepEqual(deviceHashFrom(hash), { deviceHash: hash });
  for (const bad of [undefined, "", hash.toUpperCase(), `${hash}0`, hash.slice(1), "g".repeat(64), ["x"], 42]) {
    assert.deepEqual(deviceHashFrom(bad), {}, String(bad));
  }
});
