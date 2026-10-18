import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source=readFileSync(new URL('../public/suite-downloads.js',import.meta.url),'utf8');
function visit(hostname='pctweaker.app',pathname='/uninstaller/',search='',fails=false){
 const calls=[];let listener;
 runInNewContext(source,{window:{location:{hostname,pathname,search}},URLSearchParams,Map,document:{addEventListener(event,fn){assert.equal(event,'click');listener=fn;}},navigator:{sendBeacon(url){if(fails)throw Error('unavailable');calls.push(new URL(url));}}});
 return {calls,click(href){listener?.({target:{closest(){return {href};}}});}};
}
test('companion clicks remain separate from PC Tweaker and external downloads',()=>{
 const session=visit();
 session.click('https://dl.pctweaker.app/pc-tweaker/PCTweaker-Setup.exe');
 session.click('https://example.com/uninstaller/PCTweakerUninstaller-Setup.exe');
 assert.equal(session.calls.length,0);
 session.click('https://dl.pctweaker.app/uninstaller/PCTweakerUninstaller-Setup.exe');
 session.click('https://dl.pctweaker.app/tweaky-driver/TweakyDriver-Setup.exe');
 assert.deepEqual(session.calls.map(url=>url.searchParams.get('utm_content')),['uninstaller-installer-link','tweaky-driver-installer-link']);
 assert.equal(session.calls[0].searchParams.get('utm_campaign'),'pct-uninstaller');
});
test('preview traffic is excluded and unrelated or unsafe URL data is never sent',()=>{
 const local=visit('127.0.0.1');local.click('https://dl.pctweaker.app/uninstaller/PCTweakerUninstaller-Setup.exe');assert.equal(local.calls.length,0);
 const session=visit('pctweaker.app','/account/private-person','?utm_source=private%40example.com&email=private%40example.com&token=secret');
 session.click('https://dl.pctweaker.app/uninstaller/PCTweakerUninstaller-Setup.exe');
 assert.equal(session.calls[0].searchParams.get('utm_campaign'),'pct-suite');
 assert.doesNotMatch(session.calls[0].href,/private|email|token|secret/);
});
test('valid campaign labels survive and blocked beacons do not block the link',()=>{
 const session=visit('pctweaker.app','/tweaky-driver/','?utm_source=github&utm_campaign=driver-readme&utm_content=private-note');
 session.click('https://dl.pctweaker.app/tweaky-driver/TweakyDriver-Setup.exe');
 assert.equal(session.calls[0].searchParams.get('utm_source'),'github');
 assert.equal(session.calls[0].searchParams.get('utm_content'),'tweaky-driver-installer-link');
 assert.doesNotThrow(()=>visit('pctweaker.app','/','',true).click('https://dl.pctweaker.app/uninstaller/PCTweakerUninstaller-Setup.exe'));
});
