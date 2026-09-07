import test from 'node:test';
import assert from 'node:assert/strict';
import { proWelcomeText } from '../dist/emails/pro-welcome.js';

test('purchase text includes actual price, renewal and product destination', () => {
  const text = proWelcomeText({product:'pctweaker',firstName:'Aurelio',email:'test@example.com',plan:'annual',priceLabel:'EUR 24.00',renewsOn:'September 7, 2027'});
  for (const value of ['Aurelio','EUR 24.00','September 7, 2027','https://pctweaker.app','test@example.com']) assert.ok(text.includes(value));
  assert.ok(!text.includes('&amp;'));
});

test('lifetime purchase text does not promise a renewal', () => {
  const text = proWelcomeText({product:'uninstaller',firstName:'',email:'test@example.com',plan:'lifetime',priceLabel:'EUR 30.00',renewsOn:null});
  assert.equal(text.split('\n').find(line => line.startsWith('Open Uninstaller:')), 'Open Uninstaller: https://pctweaker.app/uninstaller');
  assert.ok(text.includes('This purchase does not renew.'));
  assert.ok(!text.includes('Renews on:'));
});
