import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../src/web-purchase-client.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createPurchaseClient } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
function reply(payload, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } }); }
test("checkout sends an allowed plan only; it does not submit price or trial", async () => {
  let call;
  const client = createPurchaseClient("https://api.example.test", async (url, init) => { call = { url, ...init }; return reply({ url: "https://checkout.stripe.com/c/pay/cs_test_fixture" }); });
  assert.equal(await client.checkout("fixture-token", "lifetime"), "https://checkout.stripe.com/c/pay/cs_test_fixture");
  assert.deepEqual(JSON.parse(call.body), { product: "pctweaker", plan: "lifetime", start_trial: false });
  assert.equal(call.headers.Authorization, "Bearer fixture-token");
  assert.equal(call.credentials, "omit");
});
test("rejects redirect URLs outside the expected HTTPS Stripe host", async () => {
  for (const url of ["https://checkout.stripe.com.attacker.test/", "http://checkout.stripe.com/", "https://checkout.stripe.com:444/", "https://user@checkout.stripe.com/", "javascript:alert(1)", null]) {
    const client = createPurchaseClient("https://api.example.test", async () => reply({ url }));
    await assert.rejects(client.checkout("token", "annual"), /checkout link was invalid/);
  }
});
test("propagates the verification error and handles transport failure", async () => {
  const client = createPurchaseClient("https://api.example.test", async () => reply({ error: "Verify your email", code: "email_unverified" }, 403));
  await assert.rejects(client.checkout("token", "annual"), e => e.code === "email_unverified");
  const offline = createPurchaseClient("https://api.example.test", async () => { throw new Error("offline"); });
  await assert.rejects(offline.signIn("test@example.test", "not-real"), /Could not reach/);
});
test("preserves an expired-session status so the user can sign in again",async()=>{
 const client=createPurchaseClient('https://api.example.test',async()=>reply({error:'Session expired'},401));
 await assert.rejects(client.account('old-token'),error=>error.status===401);
});
test("requires an actual token in a successful sign-in response", async () => {
  const client = createPurchaseClient("https://api.example.test", async () => reply({ token: null }));
  await assert.rejects(client.signIn("test@example.test", "not-real"), /Sign-in did not complete/);
});

test("rejects incomplete account responses instead of assuming the customer is free", async () => {
  const client = createPurchaseClient("https://api.example.test", async () => reply({ email: "a@example.test" }));
  await assert.rejects(client.account("token"), /could not verify your account status/);
});
test("rejects an unrecognized plan before making any request", async () => {
  const client = createPurchaseClient("https://api.example.test", async () => { throw new Error("must not be called"); });
  await assert.rejects(client.checkout("token", "invalid"), /valid plan/);
});

test("closing a pending checkout never accepts a session id from the browser", async () => {
 let call; const client=createPurchaseClient("https://api.example.test",async(url,init)=>{call={url,...init};return reply({ok:true})});
 await client.cancelCheckout("token"); assert.equal(call.url,"https://api.example.test/api/web-checkout/cancel");assert.deepEqual(JSON.parse(call.body),{});assert.equal(call.headers.Authorization,"Bearer token");
});
