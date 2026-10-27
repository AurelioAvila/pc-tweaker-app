import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('web checkout route exists only when shared guard is enabled at startup',()=>{
 const source="const {router}=require('./dist/routes/stripe.js'); process.stdout.write(JSON.stringify(router.stack.filter(x=>x.route).map(x=>x.route.path)))";
 for(const enabled of [false,true]) {
  const env={...process.env,DATABASE_URL:'pgmem'}; if(enabled)env.CHECKOUT_GUARD_ENABLED='1';else delete env.CHECKOUT_GUARD_ENABLED;delete env.STRIPE_SECRET_KEY;
  const run=spawnSync(process.execPath,['-e',source],{cwd:process.cwd(),env,encoding:'utf8'}); assert.equal(run.status,0,run.stderr);
  const routes=JSON.parse(run.stdout);assert.equal(routes.includes('/web-checkout'),enabled);assert.ok(routes.includes('/checkout'));
 }
});
