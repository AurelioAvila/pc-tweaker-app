import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutTerms } from '../dist/checkout-terms.js';
test('checkout identity tracks price, discounts, plan, trial and campaign without embedding account data',()=>{
 const base={mode:'subscription',line_items:[{price:'price_regular',quantity:1}],metadata:{userId:'7'},expires_at:100};
 const original=checkoutTerms('annual',false,base);
 assert.equal(checkoutTerms('annual',false,{...base,metadata:{userId:'8'}}),original,'account identity must not affect commercial terms');
 assert.equal(checkoutTerms('annual',false,{...base,expires_at:101}),original,'moving an operational expiry must not break a retry');
 for(const params of [{...base,line_items:[{price:'price_promo',quantity:1}]},{...base,discounts:[{coupon:'promo'}]},{...base,metadata:{promo_id:'halloween'}},{...base,subscription_data:{trial_period_days:3}}]) assert.notEqual(checkoutTerms('annual',false,params),original);
 assert.notEqual(checkoutTerms('annual',true,base),original);
 assert.notEqual(checkoutTerms('monthly',false,base),original);
});
