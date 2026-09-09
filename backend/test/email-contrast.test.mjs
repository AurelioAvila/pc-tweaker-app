import test from 'node:test';
import assert from 'node:assert/strict';
import { EMAIL_MUTED_TEXT, emailShell, detailRow } from '../dist/emails/layout.js';
import { proWelcomeHtml } from '../dist/emails/pro-welcome.js';

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test('secondary email text meets AA contrast on both dark surfaces', () => {
  for (const background of ['#050506', '#0a0a0c']) {
    assert.ok((luminance(EMAIL_MUTED_TEXT) + 0.05) / (luminance(background) + 0.05) >= 4.5);
  }
});

test('account notes, receipt labels and purchase headings use readable text', () => {
  const shell = emailShell({ eyebrow: 'Account', headline: 'Check your email', intro: 'Continue securely.', note: 'This link expires.', footerNote: 'Contact support.' });
  const receipt = proWelcomeHtml({ firstName: 'Aurelio', email: 'test@example.com', plan: 'annual', priceLabel: 'EUR 24.00', renewsOn: 'September 7, 2027' });
  for (const html of [shell, receipt, detailRow('Plan', 'Annual')]) {
    assert.ok(html.includes(`color:${EMAIL_MUTED_TEXT}`));
    assert.ok(!html.includes('#5b5f66'));
  }
});
