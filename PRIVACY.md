# Privacy Policy

Last updated: 2026-10-06

PC Tweaker is a desktop application. Windows tweaks, snapshots, rollback data,
hardware readings and file scans are processed locally on your device. They are
not uploaded to PC Tweaker.

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

## Information you choose to submit

- A support request includes your name, email address, subject, message and any
  optional system details you enter. It is delivered to our support mailbox.
- A rating may include your name, email address and written feedback. Only the
  aggregate star rating and count are shown publicly; the submitted name, email
  and message are not returned by the public reviews endpoint. To spot repeated
  ratings from the same connection, we also store a keyed one-way hash of the
  IP address the rating came from, never the address itself; it is used only
  to moderate ratings.
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
and request access, correction or deletion of your personal data. Use the
private support form at https://pctweaker.app/support. Do not publish personal
information in a public GitHub issue.

Some payment or security records may need to be retained where required by law
or to resolve an active dispute. Identity verification may be required before a
data request is completed.

## Changes

This policy may be updated as the product evolves. The date above identifies the
latest revision.
