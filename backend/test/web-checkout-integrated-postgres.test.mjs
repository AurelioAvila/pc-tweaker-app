import test from 'node:test';
import assert from 'node:assert/strict';
const expected='postgresql://checkout_test@localhost:55439/checkout_web_isolated';
const url=process.env.CHECKOUT_INTEGRATION_DB;
if (!url) { test('isolated PostgreSQL guarded HTTP integration',{skip:'CHECKOUT_INTEGRATION_DB not set'},()=>{}); }
else {
 if(url!==expected)throw Error('Only the dedicated isolated checkout database is permitted');
 process.env.DATABASE_URL=url;delete process.env.STRIPE_SECRET_KEY;
 const {initSchema,getPool}=await import('../dist/db.js');
 const {initWebCheckoutReservations,WebCheckoutReservations}=await import('../dist/web-checkout-reservations.js');
 const {createCheckoutHandler,createGuardedCheckout,handleEvent}=await import('../dist/routes/stripe.js');
 await initSchema();await initWebCheckoutReservations(getPool());
 const {rows:[{id}]}=await getPool().query("INSERT INTO users (email,password_hash,email_verified) VALUES ($1,'x',TRUE) RETURNING id",[`checkout-${Date.now()}@example.test`]);
 let session,createCount=0;
 const sessions={async create(params){createCount++;await new Promise(resolve=>setTimeout(resolve,50));session={id:`cs_fixture_${id}`,url:'https://checkout.stripe.com/c/pay/fixture',status:'open',payment_status:'unpaid',metadata:params.metadata,line_items:params.line_items};return session},async retrieve(){return session},list(){return (async function*(){if(session)yield session})()}};
 const guard=createGuardedCheckout({reservations:new WebCheckoutReservations(getPool()),sessions,getEntitlement:async()=>({product:'pctweaker',active:false,plan:null}),referral:async()=>null});
 const handler=createCheckoutHandler({environment:{STRIPE_SECRET_KEY:'fixture',STRIPE_PRICE_LIFETIME:'regular_fixture',STRIPE_PRICE_LIFETIME_PROMO:'promo_fixture'},now:()=>Date.parse('2026-10-27T12:00:00Z'),async createSession(){throw Error('unguarded path')},guardedCreate:guard});
 const response=()=>({statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
 test('50 parallel requests use one guarded session and retain the server promotion',async()=>{
  const outcomes=await Promise.all(Array.from({length:50},async()=>{const r=response();await handler({userId:id,body:{plan:'lifetime',price:'forged'}},r);return r}));
  assert.equal(createCount,1);assert.ok(outcomes.some(r=>r.statusCode===200));assert.ok(outcomes.every(r=>r.statusCode===200 || (r.statusCode===409 && r.body.code==='checkout_recovery_required')));assert.equal(session.line_items[0].price,'promo_fixture');
  const retry=response();await handler({userId:id,body:{plan:'lifetime'}},retry);assert.equal(retry.statusCode,200);assert.equal(createCount,1);
 });
 test('concurrent Lifetime purchase and refund always end revoked, including replays',async()=>{
  for(let i=0;i<20;i++){
   const {rows:[u]}=await getPool().query("INSERT INTO users (email,password_hash,email_verified) VALUES ($1,'x',TRUE) RETURNING id",[`race-${Date.now()}-${i}@example.test`]);
   const userId=String(u.id); const session={id:`cs_refund_${u.id}`,created:Math.floor(Date.now()/1000),client_reference_id:userId,customer:`cus_${u.id}`,mode:'payment',payment_status:'paid',metadata:{userId,product:'pctweaker',plan:'lifetime'}};
   const paid={id:`evt_paid_${u.id}`,type:'checkout.session.completed',data:{object:session}};
   const refund={id:`evt_refund_${u.id}`,type:'charge.refunded',data:{object:{id:`ch_${u.id}`,refunded:true,amount:9900,amount_refunded:9900,currency:'eur',payment_intent:`pi_${u.id}`}}};
   const fx={async loadCheckoutForPayment(){return session},async stopSubscriptions(){},async welcome(){},notifySale(){},alertReversal(){},async queueRefundNotice(){}};
   await Promise.all([handleEvent(paid,fx),handleEvent(refund,fx)]);
   await handleEvent(paid,fx);
   const {rows:[account]}=await getPool().query('SELECT is_pro FROM users WHERE id=$1',[u.id]);
   assert.equal(account.is_pro,false);
  }
 });
 test('one refunded Lifetime purchase never revokes another paid Lifetime purchase',async()=>{
  const {rows:[u]}=await getPool().query("INSERT INTO users (email,password_hash,email_verified) VALUES ($1,'x',TRUE) RETURNING id",[`two-purchases-${Date.now()}@example.test`]);
  const userId=String(u.id); const session=id=>({id,created:Math.floor(Date.now()/1000),client_reference_id:userId,customer:`cus_${u.id}`,mode:'payment',payment_status:'paid',metadata:{userId,product:'pctweaker',plan:'lifetime'}});
  const first=session(`cs_first_${u.id}`),second=session(`cs_second_${u.id}`);
  const fx={async loadCheckoutForPayment(){return first},async stopSubscriptions(){},async welcome(){},notifySale(){},alertReversal(){},async queueRefundNotice(){}};
  const paid=s=>({type:'checkout.session.completed',data:{object:s}});
  const refund={type:'charge.refunded',data:{object:{id:`ch_first_${u.id}`,refunded:true,amount:9900,amount_refunded:9900,currency:'eur',payment_intent:`pi_first_${u.id}`}}};
  await handleEvent(paid(second),fx);await handleEvent(paid(first),fx);
  await Promise.all([handleEvent(refund,fx),handleEvent(paid(first),fx)]);
  await handleEvent(refund,fx);await handleEvent(paid(first),fx);
  const {rows:[account]}=await getPool().query('SELECT is_pro,lifetime_checkout_id FROM users WHERE id=$1',[u.id]);
  assert.equal(account.is_pro,true);assert.equal(account.lifetime_checkout_id,second.id);
 });
 test('account erasure can reconcile a settled Lifetime purchase while retaining dry-run safety',async()=>{
  const {eraseAccount}=await import('../dist/account-erasure.js');
  const email=`erasure-${Date.now()}@example.test`;
  const {rows:[u]}=await getPool().query("INSERT INTO users(email,password_hash,email_verified) VALUES($1,'x',true) RETURNING id",[email]);
  const repo=new WebCheckoutReservations(getPool());const {reservation}=await repo.reserve(u.id,'pctweaker','lifetime');
  const sessionId=`cs_erasure_${u.id}`;await repo.attach(reservation.reservation_id,sessionId);
  const session={id:sessionId,created:Math.floor(Date.now()/1000),client_reference_id:String(u.id),customer:`cus_erasure_${u.id}`,mode:'payment',payment_status:'paid',metadata:{userId:String(u.id),product:'pctweaker',plan:'lifetime'}};
  await handleEvent({type:'checkout.session.completed',data:{object:session}},{async stopSubscriptions(){},async welcome(){},notifySale(){}});
  const preview=await eraseAccount(getPool(),email);assert.equal(preview.erased,false);assert.ok(await repo.find(u.id,'pctweaker'));
  const result=await eraseAccount(getPool(),email,{erase:true});assert.equal(result.erased,true);assert.equal(await repo.find(u.id,'pctweaker'),null);
 });
 test.after(async()=>getPool().end());
}
