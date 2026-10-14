import test from 'node:test';
import assert from 'node:assert/strict';
import { EMAIL_MUTED_TEXT, EMAIL_LIGHT, EMAIL_DARK, EMAIL_BRANDS, emailShell, detailRow, note } from '../dist/emails/layout.js';
import { proWelcomeHtml } from '../dist/emails/pro-welcome.js';
import { verificationHtml, passwordResetHtml, accountWelcomeHtml } from '../dist/emails/account.js';

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('body and secondary text meet AA on the light and the dark card', () => {
  for (const surface of [EMAIL_LIGHT.card, EMAIL_LIGHT.box]) {
    assert.ok(contrast(EMAIL_LIGHT.muted, surface) >= 4.5);
    assert.ok(contrast(EMAIL_LIGHT.text, surface) >= 4.5);
  }
  for (const surface of [EMAIL_DARK.card, EMAIL_DARK.box]) {
    assert.ok(contrast(EMAIL_DARK.muted, surface) >= 4.5);
    assert.ok(contrast(EMAIL_DARK.text, surface) >= 4.5);
  }
});

test('every brand keeps its button label and accent text readable', () => {
  for (const brand of Object.values(EMAIL_BRANDS)) {
    assert.ok(contrast(brand.buttonText, brand.accent) >= 4.5, `${brand.name} button`);
    assert.ok(contrast(brand.accentText, EMAIL_LIGHT.card) >= 4.5, `${brand.name} accent on light`);
    assert.ok(contrast(brand.accentTextDark, EMAIL_DARK.card) >= 4.5, `${brand.name} accent on dark`);
  }
});

test('account notes, receipt labels and purchase headings use the shared muted colour', () => {
  const shell = emailShell({ preheader: 'Preview text.', eyebrow: 'Account', headline: 'Check your email', intro: 'Continue securely.', blocks: [note('This link expires.')], help: { title: 'Need help?', text: 'Contact support.' }, why: 'You asked for this email.' });
  const receipt = proWelcomeHtml({ firstName: 'Aurelio', email: 'test@example.com', plan: 'annual', priceLabel: 'EUR 24.00', renewsOn: 'September 7, 2027' });
  for (const html of [shell, receipt, detailRow('Plan', 'Annual')]) {
    assert.ok(html.includes(`color:${EMAIL_MUTED_TEXT}`));
  }
});

test('every message has a dark variant, a footer with support and privacy, and no stray palette', () => {
  for (const html of [verificationHtml('Aurelio', 'https://pctweaker.app/verify?t=1'), passwordResetHtml('https://pctweaker.app/reset?t=1'), accountWelcomeHtml('Aurelio', 12)]) {
    assert.match(html, /@media \(prefers-color-scheme: dark\)/);
    assert.match(html, /href="https:\/\/pctweaker\.app\/support\/?"/);
    assert.match(html, /href="https:\/\/pctweaker\.app\/privacy\/?"/);
    assert.match(html, /One account for PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver/);
    assert.ok(!html.includes('#5b5f66'));
    assert.doesNotMatch(html, /illustrat/i);
  }
});
