import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const helperSource = readFileSync(new URL('../src/entry-attribution.ts', import.meta.url), 'utf8');
const helperScope = { exports: {} };
runInNewContext(ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, helperScope);
const { pageEntryLabels } = helperScope.exports;

function campaignSession() {
  const source = readFileSync(new URL('../src/campaign-store.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const scope = { exports: {}, URLSearchParams, require(name) {
    if (name === './entry-attribution') return { pageEntryLabels };
    if (name === './constants') return { MICROSOFT_STORE: 'https://apps.microsoft.com/detail/9nh3c6dt1g87?cid=pct-website' };
    if (name === 'react') return {};
    throw new Error(name);
  } };
  runInNewContext(output, scope);
  return scope.exports;
}

test('a guide entry without UTM labels reaches the existing click attribution path', () => {
  const session = campaignSession();
  session.captureEntry('', '/guides/fix-dpc-isr-latency-windows-11/');
  assert.equal(session.campaignLabels().utm_campaign, 'pct-guide-fix-dpc-isr-latency-windows-11');
  assert.equal(session.campaignLabels().utm_source, 'website');
  session.captureEntry('?utm_source=another', '/');
  assert.equal(session.campaignLabels().utm_campaign, 'pct-guide-fix-dpc-isr-latency-windows-11');
});

test('external campaign labels survive navigation and cannot be mutated by a caller', () => {
  const session = campaignSession();
  session.captureEntry('?utm_source=github&utm_medium=repository&utm_campaign=pct-readme&utm_content=primary&email=private@example.test', '/');
  const labels = session.campaignLabels();
  assert.equal(Object.keys(labels).length, 4);
  labels.utm_source = 'changed';
  assert.equal(session.campaignLabels().utm_source, 'github');
});

test('unknown paths and unsafe labels never become attribution payloads', () => {
  assert.equal(Object.keys(pageEntryLabels('/private-person/account')).length, 0);
  assert.equal(Object.keys(pageEntryLabels('/support/?email=private@example.test')).length, 0);
  const session = campaignSession();
  session.captureEntry('?utm_source=private%40example.test&utm_campaign=arbitrary', '/privacy/');
  assert.equal(Object.keys(session.campaignLabels()).length, 0);
});

test('published nontechnical guide labels use the same hyphenated convention', () => {
  assert.equal(pageEntryLabels('/uninstall-programs-completely/').utm_campaign, 'pct-uninstall-programs-completely');
  assert.equal(pageEntryLabels('/').utm_campaign, 'pct-home');
});
