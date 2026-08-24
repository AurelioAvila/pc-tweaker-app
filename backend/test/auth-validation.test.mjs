import assert from "node:assert/strict";
import test from "node:test";

import { isValidEmail } from "../dist/auth.js";

test("email validation accepts a normal address", () => {
  assert.equal(isValidEmail("person@example.com"), true);
});

test("email validation rejects malformed and oversized input", () => {
  for (const value of ["", "person", "@example.com", "a@@example.com", "a@b", "a@b.", "a b@example.com"]) {
    assert.equal(isValidEmail(value), false, String(value));
  }
  assert.equal(isValidEmail(`${"a".repeat(250)}@b.co`), false);
});
