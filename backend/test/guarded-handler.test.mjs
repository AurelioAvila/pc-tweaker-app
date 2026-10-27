import test from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_URL='pgmem';
delete process.env.STRIPE_SECRET_KEY;
const { initSchema,getPool }=await import('../dist/db.js');
const { createCheckoutHandler }=await import('../dist/routes/stripe.js');
await initSchema();
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
test('desktop opts into safe plan replacement while web stays explicit',async()=>{
 const {rows:[{id}]}=await getPool().query("INSERT INTO users (email,password_hash,email_verified) VALUES ('guard-entrypoints@example.test','x',TRUE) RETURNING id");
 const observed=[];
 const effects={environment:{STRIPE_PRICE_MONTHLY:'fixture'},now:Date.now,async createSession(){throw Error('unguarded checkout')},async guardedCreate(input){observed.push(input.replaceDifferentTerms);return {url:'https://checkout.stripe.com/c/pay/fixture'}}};
 const web=createCheckoutHandler(effects);const desktop=createCheckoutHandler(effects,{replaceDifferentTerms:true});
 for(const handler of [web,desktop]){const res=response();await handler({userId:id,body:{plan:'monthly'}},res);assert.equal(res.statusCode,200)}
 assert.deepEqual(observed,[false,true]);
});
test('existing checkout resolves the promotional price on the server before the injected guard',async()=>{
 const {rows:[{id}]}=await getPool().query("INSERT INTO users (email,password_hash,email_verified) VALUES ('guard-int@example.test','x',TRUE) RETURNING id");
 let captured;let ordinaryCalls=0;
 const handler=createCheckoutHandler({environment:{STRIPE_SECRET_KEY:'fixture-only',STRIPE_PRICE_LIFETIME:'regular_fixture',STRIPE_PRICE_LIFETIME_PROMO:'promotion_fixture'},now:()=>Date.parse('2026-10-27T12:00:00Z'),async createSession(){ordinaryCalls++;return {url:null}},async guardedCreate(input){captured=input;return {url:'https://checkout.stripe.com/c/pay/fixture'}}});
 const res=response();await handler({userId:id,body:{plan:'lifetime',price:'forged',product:'pctweaker',start_trial:false}},res);
 assert.equal(res.statusCode,200);assert.equal(captured.userId,id);assert.equal(captured.params.line_items[0].price,'promotion_fixture');assert.equal(captured.params.metadata.product,'pctweaker');assert.equal(captured.trial,false);assert.equal(ordinaryCalls,0);
});
test('unverified account is rejected before the guard or Stripe',async()=>{
 const {rows:[{id}]}=await getPool().query("INSERT INTO users (email,password_hash,email_verified) VALUES ('guard-unverified@example.test','x',FALSE) RETURNING id");
 let guard=0;
 const handler=createCheckoutHandler({environment:{STRIPE_PRICE_LIFETIME:'regular_fixture'},now:Date.now,async createSession(){throw Error('must not run')},async guardedCreate(){guard++;throw Error('must not run')}});
 const res=response();await handler({userId:id,body:{plan:'lifetime'}},res);assert.equal(res.statusCode,403);assert.equal(res.body.code,'email_unverified');assert.equal(guard,0);
});

test('pending payment returns a recoverable conflict without creating an ordinary checkout',async()=>{
 const { GuardedCheckoutError } = await import('../dist/guarded-checkout.js');
 const {rows:[{id}]}=await getPool().query("INSERT INTO users (email,password_hash,email_verified) VALUES ('guard-pending@example.test','x',TRUE) RETURNING id");
 let ordinary=0;
 const handler=createCheckoutHandler({environment:{STRIPE_PRICE_MONTHLY:'fixture'},now:Date.now,async createSession(){ordinary++;return {url:null}},async guardedCreate(){throw new GuardedCheckoutError('payment_processing')}});
 const res=response();await handler({userId:id,body:{plan:'monthly'}},res);
 assert.equal(res.statusCode,409);assert.equal(res.body.code,'payment_processing');assert.match(res.body.error,/do not pay again/);assert.equal(ordinary,0);
});

test('integrated guarded handler reuses the same session and preserves the promotion',async()=>{
 const { createGuardedCheckout } = await import('../dist/routes/stripe.js');
 const {rows:[{id}]}=await getPool().query("INSERT INTO users (email,password_hash,email_verified) VALUES ('guard-full@example.test','x',TRUE) RETURNING id");
 let created=0;let session;
 const sessions={async create(params){created++;session={id:'cs_integrated_fixture',url:'https://checkout.stripe.com/c/pay/integration',status:'open',payment_status:'unpaid',metadata:params.metadata,line_items:params.line_items};return session},async retrieve(){return session},list(){return (async function*(){if(session)yield session})()}};
 let reservation; const reservations={async reserve(user_id,product,plan){if(reservation)return {created:false,reservation:{...reservation}};reservation={user_id,product,plan,reservation_id:'fixture-id',state:'creating',session_id:null};return {created:true,reservation:{...reservation}}},async attach(_id,sessionId){reservation.state='open';reservation.session_id=sessionId;return true},async complete(){return true},async releaseVerifiedExpired(){return true}};
 const guardedCreate=createGuardedCheckout({reservations,sessions,getEntitlement:async()=>({product:'pctweaker',active:false,plan:null}),referral:async()=>null});
 const handler=createCheckoutHandler({environment:{STRIPE_SECRET_KEY:'fixture-only',STRIPE_PRICE_LIFETIME:'regular_fixture',STRIPE_PRICE_LIFETIME_PROMO:'promotion_fixture'},now:()=>Date.parse('2026-10-27T12:00:00Z'),async createSession(){throw Error('unguarded checkout')},guardedCreate});
 const a=response();const b=response();
 await handler({userId:id,body:{plan:'lifetime'}},a);await handler({userId:id,body:{plan:'lifetime'}},b);
 assert.equal(a.statusCode,200,'first '+JSON.stringify(a.body));assert.equal(b.statusCode,200,'second '+JSON.stringify(b.body));assert.equal(created,1);assert.equal(a.body.url,b.body.url);assert.equal(session.line_items[0].price,'promotion_fixture');
});

test('a past-due provider subscription blocks checkout even if local access expired',async()=>{
 const {createGuardedCheckout}=await import('../dist/routes/stripe.js');
 const {assertNoUnsettledSubscription}=await import('../dist/subscription-checkout-guard.js');
 const {rows:[{id}]}=await getPool().query("INSERT INTO users (email,password_hash,email_verified,stripe_customer_id) VALUES ('guard-pastdue@example.test','x',TRUE,'cus_fixture') RETURNING id");
 let created=0;
 const guard=createGuardedCheckout({reservations:{async reserve(){created++;throw Error('must not reserve')}},sessions:{},getEntitlement:async()=>({product:'pctweaker',active:false,plan:'monthly'}),referral:async()=>null,closeReferral:async()=>{},checkSubscriptions:async(_customer,product)=>assertNoUnsettledSubscription((async function*(){yield {status:'past_due',metadata:{product:'pctweaker'},items:{data:[]}}})(),product,metadata=>metadata.product)});
 const handler=createCheckoutHandler({environment:{STRIPE_PRICE_MONTHLY:'fixture'},now:Date.now,async createSession(){throw Error('must not run')},guardedCreate:guard});
 const res=response();await handler({userId:id,body:{plan:'monthly'}},res);assert.equal(res.statusCode,409);assert.equal(res.body.code,'existing_subscription');assert.equal(created,0);
});

test('trial and immediate-payment checkout never reuse each other', async () => {
 const { createGuardedCheckout } = await import('../dist/routes/stripe.js');
 for (const firstTrial of [true, false]) {
  let reservation; let session; let created = 0;
  const reservations = {
   async reserve(user_id, product, plan) { if (reservation) return {created:false,reservation:{...reservation}}; reservation={user_id,product,plan,reservation_id:'trial-fixture',state:'creating',session_id:null}; return {created:true,reservation:{...reservation}} },
   async attach(_id, sessionId) { reservation.state='open'; reservation.session_id=sessionId; return true },
   async complete(){return true}, async releaseVerifiedExpired(){return true}
  };
  const sessions = {async create(params){created++; session={id:'cs_trial_fixture',url:'https://checkout.stripe.com/c/pay/fixture',status:'open',payment_status:'unpaid',metadata:params.metadata}; return session},async retrieve(){return session}};
  const guard = createGuardedCheckout({reservations,sessions,getEntitlement:async()=>({active:false}),referral:async()=>null,closeReferral:async()=>{},checkSubscriptions:async()=>{}});
  const request={userId:1,product:'pctweaker',plan:'monthly',params:{metadata:{}}};
  await guard({...request,trial:firstTrial});
  await assert.rejects(guard({...request,trial:!firstTrial}), error=>error.code==='other_checkout_pending');
  assert.equal(created,1);
 }
});

test('same plan with a changed price or coupon does not reuse the old checkout',async()=>{
 const {createGuardedCheckout}=await import('../dist/routes/stripe.js');let reservation,session,creates=0;
 const reservations={async reserve(user_id,product,plan){if(reservation)return {created:false,reservation:{...reservation}};reservation={user_id,product,plan,reservation_id:'terms-fixture',state:'creating',session_id:null};return {created:true,reservation:{...reservation}}},async attach(_id,id){reservation.state='open';reservation.session_id=id;return true}};
 const sessions={async create(params){creates++;return session={id:'cs_terms',url:'https://checkout.stripe.com/c/pay/terms',status:'open',payment_status:'unpaid',metadata:params.metadata}},async retrieve(){return session}};
 const guard=createGuardedCheckout({reservations,sessions,getEntitlement:async()=>({active:false}),referral:async()=>null,closeReferral:async()=>{},checkSubscriptions:async()=>{}});
 const base={userId:7,product:'pctweaker',plan:'annual',trial:false,params:{mode:'subscription',line_items:[{price:'regular',quantity:1}],metadata:{}}};
 await guard(base);
 for(const params of [{...base.params,line_items:[{price:'promotion',quantity:1}]},{...base.params,discounts:[{coupon:'offer'}]}]) await assert.rejects(guard({...base,params}),e=>e.code==='other_checkout_pending');
 assert.equal(creates,1);
});

test('reconciliation is attempted only after entitlement and subscriptions are checked', async () => {
 const {createGuardedCheckout}=await import('../dist/routes/stripe.js');
 const calls=[];
 const guard=createGuardedCheckout({reservations:{async reserve(){calls.push('reserve'); throw Error('stop')}},sessions:{},getEntitlement:async()=>{calls.push('entitlement');return {active:false}},referral:async()=>null,closeReferral:async()=>{},checkSubscriptions:async()=>{calls.push('subscriptions')},retireCompleted:async()=>{calls.push('reconcile')}});
 await assert.rejects(guard({userId:1,product:'pctweaker',plan:'annual',trial:false,params:{customer:'cus_fixture',metadata:{}}}),/stop/);
 assert.deepEqual(calls,['entitlement','subscriptions','reconcile','reserve']);
});
test('first-time checkout can reconcile an old session without a saved customer ID',async()=>{
 const {createGuardedCheckout}=await import('../dist/routes/stripe.js');let observed='unset';
 const guard=createGuardedCheckout({reservations:{async reserve(){throw Error('stop')}},sessions:{},getEntitlement:async()=>({active:false}),referral:async()=>null,closeReferral:async()=>{},checkSubscriptions:async()=>{throw Error('not expected before recovery')},retireCompleted:async(_u,_p,customer)=>{observed=customer}});
 await assert.rejects(guard({userId:1,product:'pctweaker',plan:'lifetime',trial:false,params:{metadata:{}}}),/stop/);
 assert.equal(observed,null);
});

test('Lifetime upgrade requires a verified matching subscription before creating a payment', async () => {
 const {createGuardedCheckout}=await import('../dist/routes/stripe.js');
 const {assertNoUnsettledSubscription}=await import('../dist/subscription-checkout-guard.js');
 const checks=[]; let creates=0; let row;
 const reservations={async reserve(user_id,product,plan){row={user_id,product,plan,reservation_id:'upgrade',state:'creating',session_id:null};return {created:true,reservation:{...row}}},async attach(_id,session){row.state='open';row.session_id=session;return true}};
 const sessions={async create(params){creates++;return {id:'cs_upgrade',url:'https://checkout.stripe.com/c/pay/upgrade',status:'open',payment_status:'unpaid',metadata:params.metadata}}};
 const guard=createGuardedCheckout({reservations,sessions,getEntitlement:async()=>({active:true,plan:'annual'}),referral:async()=>null,closeReferral:async()=>{},checkSubscriptions:async(_customer,product,userId)=>{checks.push(userId);await assertNoUnsettledSubscription((async function*(){yield {status:'active',metadata:{product:'pctweaker',userId:'7'},items:{data:[]}}})(),product,metadata=>metadata.product,1000,userId)}});
 const params={customer:'cus_7',metadata:{}};
 await guard({userId:7,product:'pctweaker',plan:'lifetime',trial:false,params});
 assert.deepEqual(checks,['7']); assert.equal(creates,1);
 await assert.rejects(guard({userId:8,product:'pctweaker',plan:'lifetime',trial:false,params}),error=>error.code==='existing_subscription');
 await assert.rejects(guard({userId:7,product:'pctweaker',plan:'monthly',trial:false,params}),error=>error.code==='already_has_access');
 assert.equal(creates,1);
});

test('opening a Lifetime checkout leaves the current Pro plan and expiry unchanged',async()=>{
 const {createGuardedCheckout}=await import('../dist/routes/stripe.js');
 const {productEntitlement}=await import('../dist/products.js');
 const expiration=new Date(Date.now()+90*86400000);
 const {rows:[{id}]}=await getPool().query("INSERT INTO users(email,password_hash,email_verified,is_pro,plan,pro_expires_at,stripe_customer_id) VALUES($1,'x',true,true,'annual',$2,$3) RETURNING id",['expiry-unchanged@example.test',expiration,'cus_expiry']);
 const before=(await getPool().query('SELECT is_pro,plan,pro_expires_at FROM users WHERE id=$1',[id])).rows[0];
 let reservation;const reservations={async reserve(user_id,product,plan){reservation={user_id,product,plan,reservation_id:'expiry-fixture',state:'creating',session_id:null};return {created:true,reservation:{...reservation}}},async attach(_id,sessionId){reservation.state='open';reservation.session_id=sessionId;return true}};
 const sessions={async create(params){return {id:'cs_expiry',url:'https://checkout.stripe.com/c/pay/expiry',status:'open',payment_status:'unpaid',metadata:params.metadata}}};
 const guard=createGuardedCheckout({reservations,sessions,getEntitlement:productEntitlement,referral:async()=>null,closeReferral:async()=>{},checkSubscriptions:async(_customer,_product,owner)=>assert.equal(owner,String(id))});
 await guard({userId:id,product:'pctweaker',plan:'lifetime',trial:false,params:{customer:'cus_expiry',metadata:{}}});
 const after=(await getPool().query('SELECT is_pro,plan,pro_expires_at FROM users WHERE id=$1',[id])).rows[0];
 assert.equal(after.is_pro,before.is_pro);assert.equal(after.plan,before.plan);assert.equal(new Date(after.pro_expires_at).getTime(),new Date(before.pro_expires_at).getTime());
});
