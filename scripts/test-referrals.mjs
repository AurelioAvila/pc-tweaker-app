// Client side of the invitation bonus: clock check before activation, device matching and
// error codes. Tauri and the session store are replaced by in-memory stand-ins.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const stub = {
  name: "stub",
  setup(b) {
    b.onResolve({ filter: /^@tauri-apps\/api\/core$|^\.\/lib$/ }, (a) => ({
      path: a.path,
      namespace: "stub",
    }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
      contents: a.path.includes("tauri")
        ? "export const invoke = (...args) => globalThis.__invoke(...args);"
        : "export const API_BASE_URL = 'https://api.test'; export const readToken = () => globalThis.__token;",
      loader: "js",
    }));
  },
};
const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../src/referrals.ts", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [stub],
});
const { clockProblem, activateOrRefreshBonus, bonusForThisPc, referralRequest } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);

const token = "a-session-token-that-is-long-enough";
let calls = [];
let serverTime = Math.floor(Date.now() / 1000);
globalThis.__token = token;
globalThis.__invoke = async (name) => {
  calls.push(name);
  if (name === "referral_device") return { publicKey: "pk", keyHash: "hash-b" };
  if (name === "referral_proof") return "signature";
  if (name === "referral_license_status") return true;
  return null;
};
globalThis.fetch = async (url) => {
  calls.push(new URL(url).pathname);
  const body = url.endsWith("/device/challenge")
    ? { id: "c1", payload: "p", serverTime }
    : { payloadJson: "{}", signature: "s" };
  return new Response(JSON.stringify(body), { status: 200 });
};
const status = { accountId: "7", rewards: [] };

// R4: a PC clock behind the server is tolerated; one that would fail the native check is
// reported before the proof, so activation never starts.
const server = 1_800_000_000;
assert.equal(clockProblem(server, (server - 61) * 1000), null);
assert.equal(clockProblem(server, (server - 22 * 3600) * 1000), null);
assert.equal(clockProblem(server, (server + 299) * 1000), null);
assert.equal(clockProblem(server, (server + 301) * 1000).code, "clock_ahead");
assert.equal(clockProblem(server, (server + 301) * 1000).minutes, 6);
assert.equal(clockProblem(server, (server - 24 * 3600) * 1000).code, "clock_behind");

serverTime = Math.floor(Date.now() / 1000) - 3600; // this PC reads one hour ahead
await assert.rejects(activateOrRefreshBonus(status, "r1", "activate", token), {
  code: "clock_ahead",
});
assert.equal(calls.includes("/api/referrals/device/proof"), false, "no activation proof sent");

// R10: once the server accepted the proof, a session change is not reported as "not verified".
serverTime = Math.floor(Date.now() / 1000);
calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const response = await realFetch(url, init);
  if (url.endsWith("/device/proof")) globalThis.__token = token;
  return response;
};
globalThis.__invoke = async (name) => {
  calls.push(name);
  if (name === "save_referral_license") globalThis.__token = "another-account-session-token";
  if (name === "referral_device") return { publicKey: "pk", keyHash: "hash-b" };
  if (name === "referral_proof") return "signature";
  return null;
};
await assert.rejects(activateOrRefreshBonus(status, "r1", "activate", token), {
  code: "session_changed",
});
assert.ok(calls.includes("clear_referral_license"));
globalThis.__token = token;
globalThis.fetch = realFetch;

// R14: a refresh tries only the bonus bound to this PC's device key.
calls = [];
const until = new Date(Date.now() + 86400000).toISOString();
const rewards = [
  { id: "a", status: "active", months: 6, activatedUntil: until, deviceKeyHash: "hash-a" },
  { id: "b", status: "active", months: 12, activatedUntil: until, deviceKeyHash: "hash-b" },
  { id: "c", status: "pending" },
];
assert.equal((await bonusForThisPc(rewards)).id, "b");
assert.equal(await bonusForThisPc([rewards[0]]), null);
calls = [];
assert.equal(await bonusForThisPc([rewards[2]]), null);
assert.deepEqual(calls, [], "no device identity is created without an active bonus");

// Error codes reach the panel untranslated, so it can word them in the user's language.
globalThis.fetch = async () => new Response("{}", { status: 429 });
await assert.rejects(referralRequest("/status", token), { code: "rate_limited" });
globalThis.fetch = async () =>
  new Response(JSON.stringify({ code: "invitation_not_eligible" }), { status: 409 });
await assert.rejects(referralRequest("/claim", token, {}), { code: "invitation_not_eligible" });

console.log("referral client OK");
