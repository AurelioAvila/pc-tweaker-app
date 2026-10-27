import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../src/web-purchase-flow.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createPurchaseFlow } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const baseAccount = { email: "test@example.test", emailVerified: true, isPro: false, plan: null, hasBilling: false };
function fixture(override = {}) {
  const calls = [];
  const api = { signIn: async () => "token", register: async () => ({ token: "token", verificationEmailSent: true }), account: async () => baseAccount, resendVerification: async () => ({ ok: true }), cancelCheckout: async () => ({ ok: true }), checkout: async (...args) => { calls.push(args); return "https://checkout.stripe.com/c/pay/test"; }, ...override };
  return { flow: createPurchaseFlow(api), calls };
}
test("only a verified free account can create a checkout", async () => {
  for (const account of [{ ...baseAccount, emailVerified: false }, { ...baseAccount, isPro: true }]) {
    const { flow, calls } = fixture({ account: async () => account });
    await flow.signIn("test@example.test", "dummy");
    await assert.rejects(flow.checkout("annual"));
    assert.equal(calls.length, 0);
  }
  const { flow, calls } = fixture();
  assert.equal(await flow.signIn("test@example.test", "dummy"), "ready");
  await flow.checkout("lifetime");
  assert.deepEqual(calls, [["token", "lifetime"]]);
});
test("only recurring Pro accounts can choose Lifetime upgrade", async () => {
 const apiFor=plan=>({signIn:async()=>"token",account:async()=>({...baseAccount,isPro:true,plan}),checkout:async()=>"https://checkout.stripe.com/c/pay/test"});
 for (const currentPlan of ['monthly','annual']) {
  const upgrade=createPurchaseFlow(apiFor(currentPlan),'lifetime');
  assert.equal(await upgrade.signIn('test@example.test','dummy'),'upgrade');
  await assert.rejects(upgrade.checkout('monthly'));
  await upgrade.checkout('lifetime');
 }
 const owned=createPurchaseFlow(apiFor('lifetime'),'lifetime');
 assert.equal(await owned.signIn('test@example.test','dummy'),'already-pro');
 await assert.rejects(owned.checkout('lifetime'));
});
test("refreshes account immediately before checkout", async () => {
  let checks = 0;
  const { flow, calls } = fixture({ account: async () => ({ ...baseAccount, isPro: ++checks > 1 }) });
  await flow.signIn("test@example.test", "dummy");
  await assert.rejects(flow.checkout("monthly"), /already has Pro/);
  assert.equal(calls.length, 0);
});
test("reset invalidates a sign-in which finishes late", async () => {
  let complete;
  const { flow, calls } = fixture({ signIn: () => new Promise(resolve => { complete = resolve; }) });
  const pending = flow.signIn("test@example.test", "dummy");
  flow.reset(); complete("old-token");
  await assert.rejects(pending, /session has ended/);
  await assert.rejects(flow.checkout("annual"), /sign in/);
  assert.equal(calls.length, 0);
});
test("double clicks do not start simultaneous requests", async () => {
  let complete;
  const { flow, calls } = fixture({ signIn: () => new Promise(resolve => { complete = resolve; }) });
  const pending = flow.signIn("test@example.test", "dummy");
  await assert.rejects(flow.signIn("test@example.test", "dummy"), /already in progress/);
  complete("token"); await pending;
  assert.equal(calls.length, 0);
});

test("closing checkout requires a signed-in account and surfaces uncertain failures",async()=>{const {flow}=fixture({cancelCheckout:async()=>{throw Error("provider uncertain")}});await assert.rejects(flow.cancelCheckout(),/sign in/);await flow.signIn("test@example.test","dummy");await assert.rejects(flow.cancelCheckout(),/provider uncertain/)});
