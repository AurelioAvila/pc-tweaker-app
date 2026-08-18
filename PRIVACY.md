# Privacy Policy

Last updated: 2026-07-25

PC Tweaker is a desktop app. The tweaks it applies (registry, power plan,
DNS, file cleanup) run entirely on your own machine and are never sent
anywhere. This policy only covers the **optional** account system used for
the Pro upgrade.

## What we collect

If you create an account (only needed to unlock Pro features across
installs), our backend stores:

- Your **email address**
- Your **password**, hashed with bcrypt — we never store or see the plain
  password
- Whether your account is **Pro** (a single true/false flag)
- Whether your email is **verified**
- Short-lived, single-use tokens (stored as a hash, not the raw value) for
  email verification and password reset

We do not collect telemetry, usage analytics, or any data from the tweaks
themselves.

## Payments

Payments are handled entirely by **Stripe Checkout**. We never see or store
your card number — Stripe processes the payment and notifies our backend
only that the payment succeeded, so we can mark your account as Pro.

## Emails

If you register or request a password reset, we send you an email via our
SMTP provider containing a verification/reset link. That provider only
sees the email address and message needed to deliver it.

## Sharing

We don't sell or share your data with anyone, except the two processors
above (Stripe for payment, and our SMTP provider for email delivery) —
both only receive what's strictly needed to do their job.

## Your data

To request access to or deletion of your data, open an issue at
[github.com/AurelioAvila/pc-tweaker-app/issues](https://github.com/AurelioAvila/pc-tweaker-app/issues)
and we'll handle it directly.

## Changes

This policy may be updated as the app evolves; the "Last updated" date
above will reflect the latest revision.
