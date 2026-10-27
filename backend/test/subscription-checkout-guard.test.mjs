import test from 'node:test';import assert from 'node:assert/strict';
const {assertNoUnsettledSubscription}=await import('../dist/subscription-checkout-guard.js');
const stream = (items) => (async function*(){yield* items})();
const sub = (status,product='pctweaker')=>({status,metadata:{product},items:{data:[{price:{id:'fixture'}}]}});
const identify = metadata => metadata?.product ?? null;
test('every nonterminal or unknown provider status blocks the same product',async()=>{for(const status of ['active','trialing','past_due','unpaid','paused','incomplete','unexpected']) await assert.rejects(assertNoUnsettledSubscription(stream([sub(status)]),'pctweaker',identify),{code:'existing_subscription'})});
test('terminal subscriptions and known separate products do not block',async()=>{await assertNoUnsettledSubscription(stream([sub('canceled'),sub('incomplete_expired'),sub('active','uninstaller')]),'pctweaker',identify)});
test('unknown ownership, incomplete item pages, and capped scans fail closed',async()=>{await assert.rejects(assertNoUnsettledSubscription(stream([{...sub('active'),metadata:null}]),'pctweaker',identify),{code:'subscription_review_required'});await assert.rejects(assertNoUnsettledSubscription(stream([{...sub('active'),items:{data:[],has_more:true}}]),'pctweaker',identify),{code:'subscription_review_required'});await assert.rejects(assertNoUnsettledSubscription(stream([sub('canceled'),sub('canceled')]),'pctweaker',identify,1),{code:'subscription_review_required'})});
test('Lifetime upgrade requires exactly one identified active or trial subscription',async()=>{
 const owned=status=>({...sub(status),metadata:{product:'pctweaker',userId:'7'}});
 for(const status of ['active','trialing']) await assertNoUnsettledSubscription(stream([owned(status)]),'pctweaker',identify,1000,'7');
 for(const status of ['past_due','unpaid','paused','incomplete']) await assert.rejects(assertNoUnsettledSubscription(stream([owned(status)]),'pctweaker',identify,1000,'7'),{code:'existing_subscription'});
 await assert.rejects(assertNoUnsettledSubscription(stream([owned('active'),owned('active')]),'pctweaker',identify,1000,'7'),{code:'existing_subscription'});
 await assert.rejects(assertNoUnsettledSubscription(stream([owned('active')]),'pctweaker',identify,1000,'8'),{code:'existing_subscription'});
 await assert.rejects(assertNoUnsettledSubscription(stream([]),'pctweaker',identify,1000,'7'),{code:'subscription_review_required'});
});
