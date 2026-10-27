import test from 'node:test';
import assert from 'node:assert/strict';
import { canRetireCompletedCheckout, canRetireCanceledPayment } from '../dist/completed-checkout-reconciliation.js';

function fixture() {
 const session={id:'cs_1',status:'complete',payment_status:'paid',mode:'subscription',customer:'cus_1',subscription:'sub_1',client_reference_id:'7',metadata:{reservation_id:'r1',product:'pctweaker',userId:'7'}};
 const subscription={id:'sub_1',status:'canceled',customer:'cus_1',metadata:{userId:'7'}};
 return {userId:7,product:'pctweaker',customerId:'cus_1',reservationId:'r1',sessionId:'cs_1',session,subscription,identifyProduct:()=> 'pctweaker'};
}
test('settled checkout for the same terminated subscription can be retired',()=>{
 for(const state of ['canceled','incomplete_expired']) for(const payment of ['paid','no_payment_required']) {const f=fixture();f.subscription.status=state;f.session.payment_status=payment;assert.equal(canRetireCompletedCheckout(f),true)}
});
test('pending payment, live subscription, and any mismatched identity stay reserved',()=>{
 const variants=[f=>f.session.payment_status='unpaid',f=>f.session.status='open',f=>f.session.mode='payment',f=>f.subscription.status='active',f=>f.subscription.status='past_due',f=>f.subscription.id='sub_other',f=>f.subscription.customer='cus_other',f=>f.subscription.metadata.userId='8',f=>f.session.customer='cus_other',f=>f.session.client_reference_id='8',f=>f.session.metadata.reservation_id='other',f=>f.session.metadata.product='other',f=>f.identifyProduct=()=>null];
 for(const change of variants){const f=fixture();change(f);assert.equal(canRetireCompletedCheckout(f),false)}
});
test('active subscription may retire its settled checkout only for a verified upgrade',()=>{const f=fixture();f.subscription.status='active';assert.equal(canRetireCompletedCheckout(f),false);f.allowActiveUpgrade=true;assert.equal(canRetireCompletedCheckout(f),true);f.session.payment_status='unpaid';assert.equal(canRetireCompletedCheckout(f),false)});
test('only a canceled, uncharged and identity-matched one-time payment may be retired',()=>{
 const fresh=()=>({userId:7,product:'pctweaker',customerId:'cus_1',reservationId:'r1',sessionId:'cs_1',session:{id:'cs_1',status:'complete',payment_status:'unpaid',mode:'payment',customer:'cus_1',payment_intent:'pi_1',client_reference_id:'7',metadata:{reservation_id:'r1',product:'pctweaker',userId:'7'}},payment:{id:'pi_1',status:'canceled',customer:'cus_1',amount_received:0}});
 assert.equal(canRetireCanceledPayment(fresh()),true);
 const variants=[f=>f.payment.status='processing',f=>f.payment.status='requires_payment_method',f=>f.payment.status='succeeded',f=>f.payment.amount_received=1,f=>f.payment.id='pi_other',f=>f.payment.customer='cus_other',f=>f.session.status='open',f=>f.session.payment_status='paid',f=>f.session.mode='subscription',f=>f.session.metadata.referral_quote='q1',f=>f.session.metadata.reservation_id='other',f=>f.session.client_reference_id='8'];
 for(const change of variants){const f=fresh();change(f);assert.equal(canRetireCanceledPayment(f),false)}
});
