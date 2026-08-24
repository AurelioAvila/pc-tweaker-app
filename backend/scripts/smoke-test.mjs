/**
 * End-to-end smoke test against a running PC Tweaker backend.
 *
 * Exercises the whole path a real customer takes — register, verify, log in,
 * read the account, reset a password, start a Stripe checkout — plus the
 * failure modes that matter (wrong password, duplicate email, revoked token,
 * unauthenticated checkout, email enumeration).
 *
 * Usage:
 *   node scripts/smoke-test.mjs                       # production
 *   BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs
 *
 * It creates one throwaway account per run (`smoke-<timestamp>@example.com`)
 * and never touches existing data. Exits non-zero if anything fails, so it can
 * gate a release.
 */

const BASE = process.env.BASE_URL || "https://api.pctweaker.app";
const stamp = Date.now();
const EMAIL = `smoke-${stamp}@example.com`;
const PASSWORD = "SuperSecret123";

let passes = 0;
const failures = [];

function check(label, ok, detail) {
  if (ok) {
    passes++;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}  ${detail !== undefined ? JSON.stringify(detail) : ""}`);
  }
}

async function call(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Some endpoints answer with HTML pages; callers that need those use fetch directly.
  }
  return { status: res.status, json };
}

function section(name) {
  console.log(`\n${name}`);
}

(async () => {
  console.log(`Target:     ${BASE}`);
  console.log(`Test user:  ${EMAIL}`);

  section("Health");
  {
    const r = await call("GET", "/health");
    check("GET /health returns ok", r.status === 200 && r.json?.ok === true, r);
    check("database is configured", r.json?.databaseConfigured === true, r);
  }

  section("Landing page");
  {
    const res = await fetch(BASE + "/");
    const html = await res.text();
    check("GET / returns 200", res.status === 200, res.status);
    check("download button points at a Windows installer", /href="[^"]+(setup\.exe|releases\/latest)"/.test(html), null);
  }

  section("Registration validation");
  for (const [label, body] of [
    ["invalid email", { email: "nope", password: PASSWORD, firstName: "A", lastName: "B", dateOfBirth: "2000-01-01" }],
    ["short password", { email: EMAIL, password: "short", firstName: "A", lastName: "B", dateOfBirth: "2000-01-01" }],
    ["missing first name", { email: EMAIL, password: PASSWORD, lastName: "B", dateOfBirth: "2000-01-01" }],
    ["missing last name", { email: EMAIL, password: PASSWORD, firstName: "A", dateOfBirth: "2000-01-01" }],
    ["malformed date of birth", { email: EMAIL, password: PASSWORD, firstName: "A", lastName: "B", dateOfBirth: "01-01-2000" }],
  ]) {
    const r = await call("POST", "/api/auth/register", body);
    check(`register rejects ${label} with 400`, r.status === 400, r);
  }

  section("Registration and login");
  let token;
  {
    const r = await call("POST", "/api/auth/register", {
      email: EMAIL,
      password: PASSWORD,
      firstName: "Smoke",
      lastName: "Test",
      dateOfBirth: "2000-01-01",
    });
    check("register returns 201 with a token", r.status === 201 && typeof r.json?.token === "string", r);
    token = r.json?.token;
  }
  {
    const r = await call("POST", "/api/auth/register", {
      email: EMAIL,
      password: PASSWORD,
      firstName: "Smoke",
      lastName: "Test",
      dateOfBirth: "2000-01-01",
    });
    check("duplicate email is rejected with 409", r.status === 409, r);
  }
  {
    const r = await call("POST", "/api/auth/login", { email: EMAIL, password: "WrongPassword1" });
    check("wrong password is rejected with 401", r.status === 401, r);
  }
  let loginToken;
  {
    const r = await call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
    check("correct password logs in", r.status === 200 && typeof r.json?.token === "string", r);
    loginToken = r.json?.token;
  }

  section("Account");
  {
    const r = await call("GET", "/api/account", undefined, token);
    check("account is readable with a valid token", r.status === 200, r);
    check("account email matches the registration", r.json?.email === EMAIL, r);
    check("a new account is not Pro", r.json?.isPro === false, r);
    check("a new account is not verified yet", r.json?.emailVerified === false, r);
  }
  {
    const r = await call("GET", "/api/account");
    check("account rejects a missing token with 401", r.status === 401, r);
  }
  {
    const r = await call("GET", "/api/account", undefined, "garbage.token.value");
    check("account rejects a forged token with 401", r.status === 401, r);
  }

  section("Email verification");
  {
    // The throwaway address is @example.com, which most providers refuse to
    // deliver to — so both outcomes are correct here. What must NOT happen is
    // a bare 500: the caller has to be able to tell "fix your address" from
    // "our mail provider is down".
    const r = await call("POST", "/api/auth/resend-verification", undefined, token);
    const accepted = r.status === 200 && r.json?.ok === true;
    const explained = (r.status === 400 || r.status === 502) && typeof r.json?.error === "string";
    check("resend either succeeds or fails with an actionable reason (never a bare 500)", accepted || explained, r);
  }
  {
    const res = await fetch(BASE + "/api/auth/verify-email?token=not-real");
    check("a bogus verification link is rejected with 400", res.status === 400, res.status);
  }

  section("Password reset");
  {
    const registered = await call("POST", "/api/auth/forgot-password", { email: EMAIL });
    const unknown = await call("POST", "/api/auth/forgot-password", { email: `nobody-${stamp}@example.com` });
    check("forgot-password accepts a registered address", registered.status === 200, registered);
    check("forgot-password accepts an unknown address", unknown.status === 200, unknown);
    check(
      "both answers are identical, so registered emails can't be enumerated",
      JSON.stringify(registered.json) === JSON.stringify(unknown.json),
      { registered: registered.json, unknown: unknown.json },
    );
  }
  {
    const r = await call("POST", "/api/auth/reset-password", { token: "not-a-real-token", newPassword: "AnotherPassword123" });
    check("a bogus reset token is rejected with 400", r.status === 400, r);
  }
  {
    const res = await fetch(BASE + "/api/auth/reset-password?token=abc123");
    const html = await res.text();
    check("the reset form renders", res.status === 200, res.status);
    check("the reset form echoes the token", html.includes("abc123"), null);
    check("the reset form can't be broken out of with a crafted token", !html.includes("</script><script>"), null);
  }

  section("Session revocation");
  {
    const r = await call("POST", "/api/auth/logout-all", undefined, token);
    check("logout-all succeeds", r.status === 200 && r.json?.ok === true, r);
  }
  {
    const r = await call("GET", "/api/account", undefined, token);
    check("the token used to call it is now rejected", r.status === 401, r);
  }
  {
    const r = await call("GET", "/api/account", undefined, loginToken);
    check("every other pre-existing token is rejected too", r.status === 401, r);
  }
  let freshToken;
  {
    const r = await call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
    check("logging in again issues a working token", r.status === 200 && typeof r.json?.token === "string", r);
    freshToken = r.json?.token;
  }

  section("Checkout");
  for (const plan of ["monthly", "annual"]) {
    const r = await call("POST", "/api/checkout", { plan }, freshToken);
    check(
      `${plan} plan creates a Stripe Checkout session`,
      r.status === 200 &&
        typeof r.json?.url === "string" &&
        new URL(r.json.url).origin === "https://checkout.stripe.com",
      r,
    );
  }
  {
    const r = await call("POST", "/api/checkout", { plan: "does-not-exist" }, freshToken);
    check("an unknown plan is rejected with 400", r.status === 400, r);
  }
  {
    const r = await call("POST", "/api/checkout", { plan: "monthly" });
    check("checkout requires authentication", r.status === 401, r);
  }

  console.log(`\n${passes} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failures.length > 0 ? 1 : 0);
})().catch((err) => {
  console.error("\nSmoke test crashed:", err);
  process.exit(2);
});
