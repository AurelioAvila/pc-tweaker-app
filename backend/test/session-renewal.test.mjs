import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "synthetic-session-renewal-test-not-a-production-secret";
const { renewedToken } = await import("../dist/auth.js");

test("sessions older than a day are renewed, fresh ones are not", () => {
  const now = 1_800_000_000;
  assert.equal(renewedToken({ sub: 7, tv: 2, iat: now - 3600 }, now), null);
  assert.equal(renewedToken({ sub: 7, tv: 2 }, now), null);
  const fresh = renewedToken({ sub: 7, tv: 2, iat: now - 2 * 86400 }, now);
  const decoded = jwt.verify(fresh, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  assert.equal(decoded.sub, 7);
  assert.equal(decoded.tv, 2);
});
