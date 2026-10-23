# Privacy Policy

Last updated: 2026-10-22

PC Tweaker is a desktop application. Windows tweaks, snapshots, rollback data,
hardware readings and file scans are processed locally on your device. They are
not uploaded to PC Tweaker.

## Who is responsible for your data

PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver are run by Aurelio Avila,
a private individual, who is the controller of the personal data described in
this policy. You can reach him at support@pctweaker.app. No data protection
officer has been appointed.

## Connection check

The two tweaks that change how Windows handles TCP connections
(acknowledgment timing and the congestion provider) can affect an unusual
line in ways the setting alone does not predict. When you apply one, the app
opens a TCP connection to 1.1.1.1 and, if that is unreachable, to github.com,
before and after the change, purely to confirm the line still works. If it
stopped working, the app puts the setting back. No data about you or your
device is sent in that check.

## Account data

Creating an account is optional and is only required for account-based features
such as a Pro subscription. When you register, our backend stores:

- Your **first name**, **last name**, **date of birth** and **email address**
- Your password as a **bcrypt hash**; the plain password is never stored
- Email-verification status and hashed, short-lived action tokens
- Subscription status, plan, expiry and the Stripe customer reference needed to
  maintain or cancel the entitlement
- A session-revocation version used to invalidate existing sign-ins

The same account signs you in to PC Tweaker, PC Tweaker Uninstaller and Tweaky
Driver. Each app keeps its own sign-in sessions and its own paid plan; a
subscription to one app does not unlock another. Changing or resetting your
password applies to all three and signs you out of each.

When a signed-in app refreshes its licence, it also sends a random
installation identifier that the app generated on first use. It is not derived
from your hardware or anything else about your PC. The backend stores only a
one-way hash of it with your account and product, to count on how many
installations an account is used. It does not decide whether your licence
works. An installation that has not refreshed its licence for 90 days is
deleted, and all of them are deleted with the account.

Current versions of PC Tweaker and PC Tweaker Uninstaller send, with a licence request,
a one-way SHA-256 hash of your Windows installation ID (the MachineGuid value
Windows creates at setup), combined with a fixed product label. The ID itself
never leaves your PC. The backend writes the hash into the signed licence it
returns and does not store it; the app then accepts that licence only on the
PC it was issued to, so a copied licence file unlocks nothing elsewhere. It
does not limit how many PCs you use with your account.

Tweaky Driver's Free plan is one complete scan every 10 days, counted by the
Tweaky Driver service, so it needs a free account with a verified email
address. Each free scan is recorded against your account and against a
one-way SHA-256 hash of your Windows installation ID, combined with a
different fixed label: the service stores that hash with your account id and
the time the scan started and completed, so that signing up again or
reinstalling on the same PC does not unlock the next scan early. These records
hold no readable ID and are kept after an account is deleted, for the same
reason.

## Information you choose to submit

- A support request includes your name, email address, subject, message and any
  optional system details you enter. It is delivered to our support mailbox.
- A rating may include your name, email address and written feedback. Only the
  aggregate star rating and count are shown publicly; the submitted name, email
  and message are not returned by the public reviews endpoint. To spot repeated
  ratings from the same connection, we also store the IP address the rating
  came from and a keyed one-way hash of it. Both are used only to moderate
  ratings; the address is deleted 90 days after the rating, the hash is kept.
- A newsletter subscription stores your email address, signup source and
  unsubscribe status. Every newsletter message must provide an unsubscribe path.
- Optional anonymous error reporting is **off by default**. If you enable it in
  the desktop app, a report can contain the product name, app version, a short
  context label and the error message already shown to you. It does not include
  your account id or email address.

PC Tweaker does not use advertising trackers or behavioral analytics on the
website or inside the desktop application.

## Payments

Payments are processed by **Stripe Checkout**. PC Tweaker never receives or
stores your full card number. Stripe sends our backend the customer,
subscription and payment status required to grant or revoke an entitlement.

If you reached the website from one of our social posts, the link's campaign
labels (utm_source, utm_medium, utm_campaign and utm_content, for example
"youtube" and a video name) are kept in memory for that page visit only and
are attached to a tip checkout you start there, so we can see which posts
lead to payments. If you click the installer download during that visit, the
same labels are sent once to our server, which stores them with the time and
nothing else (no IP address, device details or identifier), so we can count
downloads per post. They contain no personal identifier and are never stored
in your browser.

After a purchase, the confirmation page asks, optionally, how you found PC
Tweaker. If you pick an answer, only that answer (for example "youtube") is
added to your order's record at Stripe; nothing is stored in your browser and
skipping the question changes nothing.

## Invite a friend

If you take part in the Invite a friend programme described in the Terms of
Service, our backend also processes the following:

- **If you invite:** your invitation code and, for each friend who buys, a
  bonus record (its state and length and, once you activate it, the activation
  and end dates and the public key of the PC it is bound to). The app creates a
  key for the bonus on that PC and keeps it protected by Windows; only its
  public half is sent to us.
- **If you are invited:** the code you confirmed and when, the date the
  invitation expires, a keyed one-way hash of your email address with dots and
  `+tags` removed (so the same mailbox cannot be invited twice), and the details
  of your first payment that Stripe sends us: payment and invoice references,
  amount, currency, time, and any refund or dispute. Of your card we keep only a
  keyed one-way hash of the fingerprint Stripe calculates for it; we never see
  the card number.
- **Self-invitation checks:** when a code is confirmed and again when the
  payment is recorded, we compare the two accounts' email addresses and private
  email domains (large public providers such as Gmail or Outlook never count as
  shared), the hashed app installation identifiers recorded when each account
  signs in, and the card fingerprint hashes.

The person who invited you sees only that a bonus exists and whether it is
being checked, active or not eligible. They never see your email address,
plan, amount or date of payment, card, refunds or disputes; because a bonus
appears when you pay, its appearance does tell them that a purchase took
place. The invitation page and the app never show an invited friend who the
inviter is beyond the code itself.

We process this data to run the programme you joined, which is necessary to
perform our agreement with you (Article 6(1)(b) GDPR), and we run the
self-invitation checks on the basis of our legitimate interest in preventing
abuse of the discount and bonuses (Article 6(1)(f) GDPR). If an automatic check
refuses an invitation or withdraws a bonus, you can ask for a person to review
the decision at support@pctweaker.app.

Device challenges used to activate or refresh a bonus are deleted one day after
they expire, and records of processed payment notifications after 90 days.
Invitation, bonus, payment-check and review records are kept while your account
exists, because they stop the same purchase, person or card from earning a
second bonus and let us handle a refund or dispute. If you ask us to delete
your account, we delete these records or remove the link to you, except the
keyed hashes of your email address and card fingerprint, which we keep for up
to 24 months after your last purchase so that they keep blocking repeat
bonuses, and anything we must keep to resolve an open dispute.

## Email

Transactional email is delivered through our configured email provider. The
provider receives the recipient address, message and delivery metadata needed to
send verification, password-reset, support, receipt or newsletter email.

If you start a Lifetime checkout from your verified account and it closes
without payment, we may send one reminder about it, at most once every 30
days. Every reminder carries a one-click unsubscribe link, and unsubscribing
also stops newsletter email.

## Infrastructure and service providers

We use service providers only to operate the product:

- **Railway** hosts the API and PostgreSQL database
- **Cloudflare** provides DNS, TLS, proxying and security controls
- **GitHub Pages** hosts the public website and GitHub hosts release files
- **Stripe** processes payments
- **Resend or the configured SMTP provider** delivers email

These providers may process limited technical data such as IP addresses,
request metadata and service logs as necessary to operate and secure their
services. We do not sell personal data.

## Retention and security

Account and subscription records are retained while the account is active and
as required for payment, fraud-prevention, tax, dispute and legal obligations.
Newsletter records are retained until deletion is requested; an unsubscribe
record may be retained to ensure no further email is sent. Support, review,
security and diagnostic records are retained only for as long as they are needed
to handle the request, protect the service or improve reliability.

Passwords are hashed, sensitive action tokens are stored as hashes, transport is
encrypted with HTTPS/TLS, and access to operational systems is restricted. No
online service can guarantee absolute security, but PC Tweaker minimizes the
data it collects and treats failures as closed rather than granting access.

## Your choices and rights

You can leave optional error reporting disabled, unsubscribe from newsletters,
and request access, correction or deletion of your personal data. Email
support@pctweaker.app or use the private support form at
https://pctweaker.app/support. Do not publish personal information in a public
GitHub issue.

Some payment or security records may need to be retained where required by law
or to resolve an active dispute. Identity verification may be required before a
data request is completed.

If you believe your data has been handled unlawfully, you can lodge a complaint
with the Italian data protection authority, the Garante per la protezione dei
dati personali (https://www.garanteprivacy.it), or with the supervisory
authority of the EU country where you live or work.

## Changes

This policy may be updated as the product evolves. The date above identifies the
latest revision.
