import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL='pgmem';
const {initSchema,getPool}=await import('../dist/db.js');
const {productEntitlement}=await import('../dist/products.js');
await initSchema();
test('PC Tweaker annual entitlement carries its paid expiry and lapses without a webhook',async()=>{
 const expires=new Date(Date.now()+365*86400000);
 const {rows}=await getPool().query("INSERT INTO users(email,password_hash,is_pro,plan,pro_expires_at) VALUES('annual-expiry@example.invalid','x',TRUE,'annual',$1) RETURNING id",[expires]);
 const id=rows[0].id;
 const active=await productEntitlement(id,'pctweaker');
 assert.equal(active.active,true);assert.equal(active.expiresAt,expires.toISOString());
 await getPool().query('UPDATE users SET pro_expires_at=$1 WHERE id=$2',[new Date(Date.now()-1000),id]);
 assert.equal((await productEntitlement(id,'pctweaker')).active,false);
 await getPool().query("UPDATE users SET plan='lifetime',pro_expires_at=NULL WHERE id=$1",[id]);
 const lifetime=await productEntitlement(id,'pctweaker');
 assert.equal(lifetime.active,true);assert.equal(lifetime.expiresAt,null);
});
