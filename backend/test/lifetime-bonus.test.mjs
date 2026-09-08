import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL='pgmem';
const {initSchema,getPool}=await import('../dist/db.js');
const {productEntitlement,upsertEntitlement}=await import('../dist/products.js');
await initSchema();
test('Lifetime bonus activates once only from Uninstaller license request, expires and follows refunded parent',async()=>{
 const {rows}=await getPool().query("INSERT INTO users(email,password_hash,is_pro,plan) VALUES('bonus@example.com','x',TRUE,'lifetime') RETURNING id");
 const id=rows[0].id;
 assert.equal((await productEntitlement(id,'uninstaller')).active,false);
 const first=await productEntitlement(id,'uninstaller',true);
 assert.equal(first.active,true);assert.equal(first.plan,'lifetime_bonus');
 assert.ok(new Date(first.expiresAt)-Date.now()>364*86400000);
 assert.equal((await productEntitlement(id,'uninstaller',true)).expiresAt,first.expiresAt);
 await getPool().query('UPDATE users SET is_pro=FALSE WHERE id=$1',[id]);
 assert.equal((await productEntitlement(id,'uninstaller',true)).active,false);
 await getPool().query('UPDATE users SET is_pro=TRUE WHERE id=$1',[id]);
 await getPool().query('UPDATE lifetime_uninstaller_bonus SET expires_at=$2 WHERE user_id=$1',[id,new Date(Date.now()-1000)]);
 assert.equal((await productEntitlement(id,'uninstaller',true)).active,false);
 await upsertEntitlement(id,'uninstaller',{plan:'lifetime',expiresAt:null});
 assert.equal((await productEntitlement(id,'uninstaller',true)).plan,'lifetime');
});
test('Monthly PC Tweaker subscription cannot claim the bonus',async()=>{
 const {rows}=await getPool().query("INSERT INTO users(email,password_hash,is_pro,plan) VALUES('monthly-bonus@example.com','x',TRUE,'monthly') RETURNING id");
 assert.equal((await productEntitlement(rows[0].id,'uninstaller',true)).active,false);
});
