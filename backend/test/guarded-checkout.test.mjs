import test from "node:test";
import assert from "node:assert/strict";
const { guardedCheckout, cancelGuardedCheckout } = await import("../dist/guarded-checkout.js");
function setup() {
 let row = null, calls = 0, current = null;
 const repo = {
  async find(userId, product) { return row && row.user_id === userId && row.product === product ? {...row} : null; },
  async reserve(user_id, product, plan) { if (row) return { created:false, reservation:{...row} }; row = { user_id, product, plan, reservation_id:'fixture-id', state:'creating', session_id:null }; return {created:true,reservation:{...row}}; },
  async attach(id, session) { if (row.reservation_id !== id || row.state !== 'creating') return false; row.state='open';row.session_id=session;return true; },
  async complete(id, session) { if (row.reservation_id!==id || row.session_id!==session) return false;row.state='complete';return true; },
  async releaseVerifiedExpired(id, session) { if (row.reservation_id!==id || row.session_id!==session || row.state!=='open') return false;row=null;return true; },
 };
 const provider = {
  async create(id,key) { calls++; assert.equal(key,`guarded-checkout:${id}`);current={id:'cs_fixture',url:'https://checkout.stripe.com/c/pay/test',status:'open',payment_status:'unpaid',metadata:{reservation_id:id}};return {...current}; },
  async retrieve() { return {...current}; },
  async expire() { current={...current,status:'expired'};return {...current}; },
  async findByReservation() { return current ? [{...current}] : []; },
  async onExpired() {},
 };
 return { repo,provider,call: plan=>guardedCheckout(repo,provider,1,'pctweaker',plan), set: value=>{current={...current,...value}}, calls:()=>calls,row:()=>row };
}
test('same plan reuses one verified open session; another plan is blocked', async()=>{const x=setup();assert.deepEqual(await x.call('annual'),await x.call('annual'));await assert.rejects(x.call('monthly'),{code:'other_checkout_pending'});assert.equal(x.calls(),1)});
test('a lost provider response stays reserved and does not create a new payment',async()=>{const x=setup();x.provider.create=async()=>{throw new Error('timeout')};await assert.rejects(x.call('annual'),/timeout/);await assert.rejects(x.call('annual'),{code:'checkout_recovery_required'});assert.equal(x.row().state,'creating')});
test('complete but unpaid remains blocked while async payment settles',async()=>{const x=setup();await x.call('annual');x.set({status:'complete',payment_status:'unpaid'});await assert.rejects(x.call('annual'),{code:'payment_processing'});await assert.rejects(x.call('annual'),{code:'payment_processing'});assert.equal(x.calls(),1)});
test('only verified expired unpaid session can be released',async()=>{const x=setup();await x.call('annual');x.set({status:'expired',payment_status:'unpaid'});await assert.rejects(x.call('annual'),{code:'checkout_expired_retry'});await x.call('monthly');assert.equal(x.calls(),2)});
test('mismatched session metadata never releases a reservation',async()=>{const x=setup();await x.call('annual');x.set({status:'expired',metadata:{reservation_id:'other'}});await assert.rejects(x.call('annual'),{code:'provider_mismatch'});assert.equal(x.row().state,'open')});
test('a foreign checkout URL is never returned',async()=>{const x=setup();x.provider.create=async(id)=>({id:'fake',url:'https://checkout.stripe.com.attacker.test/',status:'open',payment_status:'unpaid',metadata:{reservation_id:id}});await assert.rejects(x.call('annual'),{code:'provider_mismatch'});assert.equal(x.row().state,'open')});

test('a lost response can recover one matching provider session without creating a second',async()=>{const x=setup();const create=x.provider.create; x.provider.create=async(id,key)=>{await create(id,key);throw new Error('response lost')};await assert.rejects(x.call('annual'),/response lost/);const result=await x.call('annual');assert.equal(result.url,'https://checkout.stripe.com/c/pay/test');assert.equal(x.calls(),1);});
test('ambiguous provider search does not unlock or create another checkout',async()=>{const x=setup();x.provider.create=async()=>{throw new Error('timeout')};await assert.rejects(x.call('annual'));x.provider.findByReservation=async()=>[{id:'a',metadata:{reservation_id:'fixture-id'}},{id:'b',metadata:{reservation_id:'fixture-id'}}];await assert.rejects(x.call('annual'),{code:'checkout_recovery_required'});assert.equal(x.row().state,'creating');});

test('cancel expires the owned open session before a different plan can be started',async()=>{const x=setup();await x.call('annual');await cancelGuardedCheckout(x.repo,x.provider,1,'pctweaker');assert.equal(x.row(),null);await x.call('monthly');assert.equal(x.calls(),2)});
test('a completed or pending payment cannot be canceled as an open checkout',async()=>{const x=setup();await x.call('annual');x.set({status:'complete',payment_status:'unpaid'});await assert.rejects(cancelGuardedCheckout(x.repo,x.provider,1,'pctweaker'),{code:'payment_processing'});assert.equal(x.row().state,'complete')});
test('an uncertain provider timeout during cancellation keeps the reservation',async()=>{const x=setup();await x.call('annual');x.provider.expire=async()=>{throw Error('timeout')};await assert.rejects(cancelGuardedCheckout(x.repo,x.provider,1,'pctweaker'),/timeout/);assert.equal(x.row().state,'open');await assert.rejects(x.call('monthly'),{code:'other_checkout_pending'});assert.equal(x.calls(),1)});
test('cancel never uses a session owned by another account',async()=>{const x=setup();await x.call('annual');await cancelGuardedCheckout(x.repo,x.provider,2,'pctweaker');assert.equal(x.row().state,'open');assert.equal(x.calls(),1)});

test('failed referral cleanup leaves the reservation locked',async()=>{const x=setup();await x.call('annual');x.set({status:'expired',metadata:{reservation_id:'fixture-id',referral_quote:'quote'}});x.provider.onExpired=async()=>{throw Error('cleanup failed')};await assert.rejects(x.call('annual'),/cleanup failed/);assert.equal(x.row().state,'open');assert.equal(x.calls(),1)});

test('desktop replaces different terms only after expiring the previous checkout',async()=>{
 const x=setup(); await x.call('annual'); const order=[];
 const expire=x.provider.expire, create=x.provider.create;
 x.provider.expire=async(...args)=>{order.push('expire');return expire(...args)};
 x.provider.create=async(...args)=>{order.push('create');return create(...args)};
 await guardedCheckout(x.repo,x.provider,1,'pctweaker','monthly',true);
 assert.deepEqual(order,['expire','create']); assert.equal(x.calls(),2); assert.equal(x.row().plan,'monthly');
});
test('desktop does not replace a checkout when expiry has an uncertain outcome',async()=>{
 const x=setup(); await x.call('annual'); x.provider.expire=async()=>{throw Error('timeout')};
 await assert.rejects(guardedCheckout(x.repo,x.provider,1,'pctweaker','monthly',true),/timeout/);
 assert.equal(x.calls(),1); assert.equal(x.row().plan,'annual');
});
test('desktop does not replace a checkout that completes during cancellation',async()=>{
 const x=setup(); await x.call('annual'); let reads=0; const retrieve=x.provider.retrieve;
 x.provider.retrieve=async(...args)=>{if(++reads===2)x.set({status:'complete',payment_status:'paid'});return retrieve(...args)};
 await assert.rejects(guardedCheckout(x.repo,x.provider,1,'pctweaker','monthly',true),{code:'payment_processing'});
 assert.equal(x.calls(),1); assert.equal(x.row().state,'complete');
});
test('desktop never expires a reservation that changed during a plan switch',async()=>{
 const x=setup(); await x.call('annual'); let expired=false;
 x.repo.find=async()=>({...x.row(),reservation_id:'different-reservation'});
 x.provider.expire=async()=>{expired=true;throw Error('must not expire')};
 await assert.rejects(guardedCheckout(x.repo,x.provider,1,'pctweaker','monthly',true),{code:'checkout_recovery_required'});
 assert.equal(expired,false); assert.equal(x.calls(),1);
});
