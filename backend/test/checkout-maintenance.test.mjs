import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
process.env.DATABASE_URL='pgmem';process.env.CHECKOUT_GUARD_ENABLED='1';delete process.env.STRIPE_SECRET_KEY;
const {router}=await import('../dist/routes/stripe.js');
const app=express();app.use(express.json());app.use('/api',router);
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
const base=`http://127.0.0.1:${server.address().port}`;
test('maintenance closes both checkout entrypoints without blocking cancellation or tips',async()=>{
 process.env.CHECKOUT_MAINTENANCE='1';
 for(const path of ['/api/checkout','/api/web-checkout']){
  const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(response.status,503);assert.equal((await response.json()).code,'checkout_temporarily_unavailable');
 }
 const cancel=await fetch(base+'/api/web-checkout/cancel',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.notEqual(cancel.status,503);
 const tip=await fetch(base+'/api/tip',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.notEqual((await tip.json()).code,'checkout_temporarily_unavailable');
 delete process.env.CHECKOUT_MAINTENANCE;
 const resumed=await fetch(base+'/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.notEqual(resumed.status,503);
});
test.after(()=>new Promise(resolve=>server.close(resolve)));
