import assert from "node:assert/strict";
import test from "node:test";

import { isValidEmail, isValidPassword, hashPassword, verifyPassword } from "../dist/auth.js";

test("new passwords cannot exceed bcrypt's 72-byte input limit", async () => {
  for (const value of ["a".repeat(73), "é".repeat(37), "🔒".repeat(19)]) {
    assert.equal(isValidPassword(value), false);
    await assert.rejects(async () => hashPassword(value));
  }
  for (const value of ["a".repeat(72), "é".repeat(36), "🔒".repeat(18)]) {
    assert.equal(isValidPassword(value), true);
  }
  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword(null), false);
  const password = "a".repeat(72);
  assert.equal(await verifyPassword(password, await hashPassword(password)), true);
});

test("email validation accepts a normal address", () => {
  assert.equal(isValidEmail("person@example.com"), true);
});

test("registration and reset reject oversized passwords before database work", async () => {
  const module = await import("../dist/routes/auth.js");
  const router = module.default.default;
  for (const path of ["/register", "/reset-password"]) {
    const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods.post);
    let status;
    let body;
    const response = {
      status(value) { status = value; return this; },
      json(value) { body = value; return this; },
    };
    await layer.route.stack[0].handle({
      body: { email: "person@example.com", password: "é".repeat(37), newPassword: "é".repeat(37), token: "test-only" },
      get() { return "application/json"; },
    }, response);
    assert.equal(status, 400, path);
    assert.match(body.error, /72 UTF-8 bytes/);
  }
});

test("email validation rejects malformed and oversized input", () => {
  for (const value of ["", "person", "@example.com", "a@@example.com", "a@b", "a@b.", "a b@example.com"]) {
    assert.equal(isValidEmail(value), false, String(value));
  }
  assert.equal(isValidEmail(`${"a".repeat(250)}@b.co`), false);
});
