import test from 'node:test';import assert from 'node:assert/strict';
import {inspectUnreservedSessions} from '../scripts/check-guard-readiness.mjs';
function api(data){return {list:({status})=>(async function*(){for(const item of data[status]??[])yield item})()}}
test('empty session inventory passes readiness',async()=>{assert.equal((await inspectUnreservedSessions(api({}))).safeToActivate,true)});
test('relevant open and unsettled sessions block rollout',async()=>{const r=await inspectUnreservedSessions(api({open:[{metadata:{product:'pctweaker'}}],complete:[{payment_status:'unpaid',metadata:{product:'uninstaller'}}]}));assert.equal(r.safeToActivate,false);assert.equal(r.counts.relevantOpen,1);assert.equal(r.counts.relevantUnpaid,1)});
test('unknown or unclassified products block readiness',async()=>{const r=await inspectUnreservedSessions(api({open:[{metadata:{}},{metadata:{product:'other'}}]}));assert.equal(r.safeToActivate,false);assert.equal(r.counts.unknownProduct,2)});
test('capped or failed scans cannot return a passing result',async()=>{await assert.rejects(inspectUnreservedSessions(api({open:[{},{}]}),1),/scan_incomplete/)});
