// Per-IP limits key on the address the edge proxy overwrites (X-Real-IP on
// Railway), not on X-Forwarded-For, which Railway passes through from the
// caller. Rotating XFF must not buy a fresh budget.
import { test, after } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "pgmem";
process.env.JWT_SECRET = "test-secret";
process.env.CLIENT_IP_HEADER = "x-real-ip";
delete process.env.RESEND_API_KEY;

const { default: express } = await import("express");
const { initSchema } = await import("../dist/db.js");
const clientIp = await import("../dist/client-ip.js");
const authModule = await import("../dist/routes/auth.js");
await initSchema();
const { clientIpMiddleware, clientIpHeader, trustProxyHops } = clientIp.default ?? clientIp;

test("the trusted header follows CLIENT_IP_HEADER, and defaults to X-Real-IP only on Railway", () => {
  assert.equal(clientIpHeader({ CLIENT_IP_HEADER: "CF-Connecting-IP" }), "cf-connecting-ip");
  assert.equal(clientIpHeader({ CLIENT_IP_HEADER: "none", RAILWAY_ENVIRONMENT_ID: "x" }), null);
  assert.equal(clientIpHeader({ RAILWAY_ENVIRONMENT_ID: "x" }), "x-real-ip");
  assert.equal(clientIpHeader({}), null);
  assert.equal(trustProxyHops({}), 1);
  assert.equal(trustProxyHops({ TRUST_PROXY_HOPS: "2" }), 2);
  assert.equal(trustProxyHops({ TRUST_PROXY_HOPS: "-1" }), 1);
});

const app = express();
app.set("trust proxy", 1);
app.use(clientIpMiddleware);
app.use(express.json());
app.get("/ip", (req, res) => res.json({ ip: req.ip }));
app.use("/api/auth", authModule.default.default);
const server = app.listen(0);
after(() => server.close());
const base = () => `http://127.0.0.1:${server.address().port}`;

test("req.ip is the trusted header, a malformed one falls back to Express's own", async () => {
  const ip = async (headers) => (await (await fetch(`${base()}/ip`, { headers })).json()).ip;
  assert.equal(await ip({ "X-Real-IP": "203.0.113.7", "X-Forwarded-For": "198.51.100.1" }), "203.0.113.7");
  assert.equal(await ip({ "X-Real-IP": "not an ip", "X-Forwarded-For": "198.51.100.1" }), "198.51.100.1");
});

test("one connection cannot use up the sign-up budget by rotating X-Forwarded-For", async () => {
  const log = console.log;
  console.log = () => {};
  after(() => (console.log = log));
  const register = (n, realIp) =>
    fetch(`${base()}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Real-IP": realIp, "X-Forwarded-For": `198.51.100.${n}` },
      body: JSON.stringify({ email: `signup${n}@example.com`, password: "a long password", firstName: "A", lastName: "B", dateOfBirth: "1990-01-01" }),
    });
  for (let n = 0; n < 10; n++) assert.equal((await register(n, "203.0.113.20")).status, 201);
  assert.equal((await register(10, "203.0.113.20")).status, 429, "a fresh XFF value does not reset the connection's share");
  assert.equal((await register(11, "203.0.113.21")).status, 201, "other visitors can still sign up");
});
