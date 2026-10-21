# PC Tweaker invitations and device-bound Pro bonuses

Status: implementation under test; disabled by default. This document does not announce a live programme.

## Commercial policy (policy version `2026-10-21-v2`)

An eligible invited account receives an extra 10% on its first supported positive Stripe payment, after any compatible first-payment offer. Integer EUR cents are calculated by the server. Normal renewal terms remain unchanged. Trials are not combined with the referral checkout: a trial request simply opens the ordinary trial checkout. The panel says so before the (irreversible) code confirmation, together with the 30-day invitation expiry.

A monthly purchase earns the inviter a separate six-month personal Pro bonus for one PC. An annual or Lifetime purchase earns twelve months, never Lifetime.

Owner decisions of 21 October 2026, implemented in this version:

- **Yearly cap.** At most 6 recognised bonuses per inviter in any rolling 12 months (`INVITER_CAP`, `CAP_WINDOW_MS`). Recognised means any bonus that is not revoked, including those still pending or under review; a refunded or otherwise revoked bonus frees its place. A purchase beyond the cap is recorded as `revoked` with the private reason `inviter_cap` and shown to the inviter as "not eligible". Awards for one inviter are serialised with a transaction-scoped advisory lock, so concurrent purchases cannot both pass the cap.
- **Maturity after the dispute window.** Digital purchases are not refundable, so the binding period is the card-network dispute window, commonly 120 days. A bonus becomes available only 120 days after the actual payment (`HOLD_DAYS`), and only after a fresh provider read at that point finds no refund or open dispute. Later refunds and disputes still revoke or hold it through the webhook.
- **Not transferable, no gifts.** Bonuses are personal to the inviting account and bound to one PC on activation. The earlier "Lifetime owners gift a bonus" flow and its `/gift` page have been removed (routes, table, UI and page). A gift of Pro would only exist as a separate future product, a Lifetime purchase paid by the giver with its own 256-bit private link; it is not part of this programme.
- **Lifetime inviters earn nothing resellable.** A Lifetime owner can still invite (the friend still saves 10%), but the purchase is recorded as `revoked` with the private reason `inviter_lifetime` and no bonus is issued. This is the simplest option with nothing that could be sold on; a non-transferable credit would add a balance and a redemption path without any use for an account that already owns Lifetime.
- **One invitation per person.** The enrolment hash ignores `+tags` everywhere and dots in Gmail/Googlemail addresses (`canonicalEmail`), so `name+1@gmail.com` cannot claim a second invitation after `name@gmail.com`.

Duration begins on explicit activation and is clamped to calendar month ends. There is no recurring charge for a bonus. Activating while paid Pro is already active makes the periods overlap; the panel warns the customer. There is no automatic device transfer or paid-plan extension.

## State and payment authority

The browser cannot provide a price, reward duration, payment identity, maturation date or entitlement flag. Checkout uses the server-selected plan/Price and a saved immutable quote. A combined once-only coupon preserves compatible existing offers. Concurrent requests reuse the same quote and provider idempotency keys; the referral adapter never retries by dropping an idempotency key.

The referral path never blocks an ordinary purchase for a reason that cannot double-charge. A trial request, a previous paid purchase, an unsupported price or coupon, a referral price below the provider minimum, an offer ending within 35 minutes (Stripe measures its 30-minute minimum on its own clock), an offer that Managed Payments cannot combine, or an account that is no longer eligible all return the ordinary checkout, with the reason kept in the private audit log (`ordinary_checkout:<reason>`). Only an unsettled or completed referral session, or an open quote for a different plan, still answers with an error.

If Stripe rejects the referral session as an invalid request, no session exists for that idempotency key (Stripe never stores validation failures under a key, and an earlier accepted attempt would have been replayed): the quote is released at once and the ordinary checkout opens. If the creation response was lost (timeout, 5xx), the quote stays reserved until its own expiry (at most 60 minutes) plus a 15-minute grace; after that, if the provider lists no session for the quote, the next checkout or the worker releases it. A session found expired or open is expired and released; a completed one still requires reconciliation. Verified in Stripe TEST on 21 October 2026: in direct mode an existing customer without an address plus `automatic_tax` is rejected (`customer_tax_location_invalid`) unless `customer_update[address]=auto` is sent, and `customer` together with `customer_creation` is rejected in both models. The referral parameters therefore always send `customer_update[address]=auto` in direct mode and never send `customer_creation` or `customer_email` once a customer is attached.

An expired invitation with no unresolved referral checkout does not block an ordinary purchase or trial under the existing checkout rules. The fallback locks the account and enrolment in the same order as reservation, so it cannot overlook a concurrently created referral checkout. An existing open, creating or paid quote is never discarded merely because the invitation expires. Provider-confirmed session expiry is required before returning to ordinary pricing; an uncertain or completed payment still requires reconciliation. The account panel displays invitation expiry from the server.

The adapter retrieves the current Stripe account, completed session, first positive subscription-create invoice or one-time payment, actual successful captured charge, refunds, disputes and payer evidence. Coupon, Price, quantity, customer, environment, currency, discount, amount and payment time must match the quote. Every financial effect must pass test-mode provider verification before launch; local adapter fixtures are not proof of a successful Stripe checkout.

The database enforces one enrolment per buyer, one live quote per enrolment, and unique quote/payment/invoice/buyer/payer reward identities. Repeated payer details suppress an additional bonus without turning a successfully paid purchase into a permanently retrying webhook error. A paid purchase whose facts do not match its quote (an asynchronous payment completing after the quote expiry, another currency, a different invoice shape) and permanent provider inconsistencies (unsupported invoice, changed checkout model, unverifiable identity, more than 1000 history items) are not retried forever either: the quote is marked paid so the buyer can buy again at the ordinary price, the bonus (when a payment can be identified) is recorded on `hold` with the reason `payment_mismatch_review`, the private audit log records `review:<code>`, and the webhook is acknowledged. Only network, database and configuration errors are rethrown for Stripe to retry. Signed-webhook receipts are persisted after successful processing; business uniqueness also protects concurrent deliveries of different event IDs. Revocation is terminal; a hold does not clear because an old success event reappears, but a dispute closed as `won` (or `warning_closed`) releases a dispute hold back to pending (or active), and the maturity check re-reads the charge before the bonus becomes available.

Refund and dispute events are processed only for payments that belong to a recorded referral bonus; refunds of other products and of non-referral purchases make no provider call and leave no tombstone. A reversal that arrives before its referral sale is still caught, because the sale is recorded from a fresh read of the charge (refunds, disputes) and the bonus is read again at maturity. Renewal invoices (`billing_reason` other than `subscription_create`) are ignored without a provider call.

An inviter without usable payer history remains under identity review. A payment method without usable payer evidence also creates a review hold, never an automatically available bonus; its placeholder is keyed to the payment, not treated as person-level deduplication. There is no public endpoint for clearing holds. Do not silently turn missing evidence into approval.

### Owner review procedure

The panel shows held bonuses as "being verified" and tells the inviter to write to support@pctweaker.app if a bonus is still pending after the 120 days. Review in the production database console (read the Stripe objects in the Dashboard; never change a payment from here):

```sql
-- Bonuses and quotes waiting for review, oldest first
SELECT r.id, r.state, r.reason, r.paid_at, r.payment_id, r.inviter_id, r.buyer_id
FROM referral_rewards r WHERE r.state = 'hold' ORDER BY r.paid_at;
SELECT subject_id, action, created_at FROM referral_audit
WHERE action LIKE 'review:%' ORDER BY created_at DESC LIMIT 50;
-- Approve after checking the payment in the Dashboard (no refund, no open dispute):
-- available at once if the 120 days have passed; payment blocks still apply on activation
UPDATE referral_rewards SET state = 'ready', reason = 'owner_review_approved', checked_at = now()
WHERE id = $1 AND state = 'hold' AND eligible_at <= now();
INSERT INTO referral_audit(id, subject_id, action, created_at)
VALUES (gen_random_uuid()::text, $1, 'owner_review_approved', now());
-- Reject: terminal
UPDATE referral_rewards SET state = 'revoked', reason = 'owner_review_rejected' WHERE id = $1;
-- Switch off a published or abused invitation code (existing enrolments keep their rules)
UPDATE referral_accounts SET enabled = false WHERE user_id = $1;
```

Record each decision in the audit table as shown. Target: a decision within 10 business days of a request. A payment block (`referral_payment_blocks`) from a refund or a lost dispute must not be removed by hand.

## Device and account enforcement

Bonus grants use a dedicated Ed25519 issuer key. The ordinary Pro signing key must never issue bonus grants: old clients ignore unknown JSON fields and could otherwise accept a device-bound grant as an ordinary licence. The regular licence path also rejects the bonus plan explicitly. Bonuses never set `users.is_pro`, alter purchased entitlements, or replace the ordinary local licence file.

Windows generates a random device signing seed. Private local state is wrapped with user-scoped DPAPI and machine-scoped DPAPI. Only the public key is sent to the server. Missing, unreadable or corrupt existing identity files fail closed; they are not silently replaced. Loss of the Windows profile/device identity requires support review rather than automatic reassignment.

Activation and refresh require a single-use five-minute challenge bound to the account, reward, purpose, nonce and device public-key hash. Native code signs only this protocol for its current session. Activation serialises on the reward row so two PCs cannot both win. The signed grant contains the account, product, schema, reward, device and current bearer-session hash. Native feature gates verify these bindings with the dedicated issuer.

Provider traffic: challenge and proof read only the stored reward state and payment blocks (kept current by the refund and dispute webhooks); a licence refresh never calls Stripe. The only provider reads are at checkout, at the purchase webhook, at maturity (worker) and when claiming an invitation, and a claim checks the programme switch before any provider call. The app refreshes only while a bonus is active on this PC (the status names the device-key hash each active bonus is bound to, so other PCs' bonuses are never tried): every five minutes inside the ten-minute lease while the app is running, including when it sits in the tray because Pro features keep working there, with backoff to 30 minutes after failures. With the programme off or no active bonus nothing is polled; the status is read on sign-in and account refresh only.

Clock handling: the lease is ten minutes measured from when this PC received the grant. A PC clock behind the server is accepted up to 24 hours, as for the purchased licence, without lengthening the lease; a clock ahead is checked against the signed issue time (this is what refuses a replayed old grant), and a clock set back after saving fails closed until the next refresh. The challenge returns the server time and the app refuses to send an activation proof when the PC clock is more than 5 minutes ahead or 23 hours behind, with a message to turn on automatic time, so a bonus is never started on a PC that would refuse it. Identity, session and grant are stored under `%LOCALAPPDATA%` (a roaming profile cannot carry the machine-bound DPAPI layer to another PC); logout also removes files earlier test builds left in `%APPDATA%`. Logout clears bonus state; a new login clears previous signed caches before storing its session.

Revocation cannot instantly remove a response already cached offline; the residual lease is at most ten minutes after the last refresh, longer only by how far a PC clock runs behind the server (at most a day). An administrator controlling the operating system, cryptographic master keys, application binary or clock across restarts is outside a claim of absolute client-side protection. No such claim is made.

## Invitation handoff and privacy

The static landing page is `/invite/?ref=<random-code>`, prerendered with `noindex,follow`, a code-free canonical, and excluded from the sitemap. It checks programme availability and code validity without exposing the inviter's identity. Downloads always use the existing official distribution endpoints.

New public invitation codes contain ten characters from a 32-symbol alphabet, always with both a letter and a digit. Cryptographic uniform sampling excludes I, O, 0 and 1; short codes ignore case. Database uniqueness handles collisions with bounded retries under the account lock. Existing 22-character links remain valid and case-sensitive. This shorter public attribution code is not a payment or licence credential. The app opens Account → Invite a friend, with separate tabs for sharing, bonuses and entering a code. The panel, the account menu entry and every referral error are translated into English, Italian, French, Spanish, German and European Portuguese (`src/components/referral-copy.ts`, checked by `npm run check:i18n`); the website invitation page is English, like the rest of the site.

The friend copies the code, installs, signs in, verifies email, and confirms the code in the account panel before opening a supported checkout. Microsoft Store `cid` is not treated as proof of individual referral installation. Downloads and registrations alone never create a reward. This flow does not cryptographically attest that a remote caller installed an official binary.

Email and payer deduplication values are HMACs under a dedicated server key, not public hashes. Payment IDs, ownership, timestamps, device public keys, session hashes and decisions remain private account/security data. The inviter's reward list shows only an aggregate state per bonus: `pending` (being verified, including owner review), `active` (available or in use) or `not_eligible` (refunded, disputed and lost, capped, Lifetime inviter, ineligible). It never contains the friend's plan, payment or eligibility dates, refund or dispute reasons, email, card, amount or account ID; duration, activation end and bound device-key hash appear only for an `active` bonus, which is the inviter's own entitlement.

Retention: the reconciliation worker deletes device challenges one day after they expire and webhook receipts after 90 days. Rewards, quotes, enrolments, payment blocks and the audit log are kept for audit and duplicate prevention; foreign keys to `users` have no cascading delete, so any future account-deletion feature must decide explicitly how to anonymise these rows. Define retention, account deletion, support access, review and privacy/terms disclosures before launch. Hashing is not a claim of anonymisation or legal compliance. Provider card fingerprints are an imperfect signal: wallets, multiple cards and multiple identities can evade a simplistic person-level rule. This version does not claim to eliminate all fraud or prevent all repeat discounts before the payment method is known.

## Configuration and release gates

Existing deployments remain off without explicit complete configuration:

- `REFERRALS_ENABLED=true` and `REFERRALS_POLICY_VERSION=2026-10-21-v2` (a deployment still configured for `2026-10-20-v1` stays off);
- `REFERRALS_CHECKOUT_MODEL=managed` for the currently verified live merchant-of-record model; `direct` is supported only for an explicitly validated direct Checkout integration;
- `REFERRALS_HASH_KEY`: dedicated random 32-byte secret, hex encoded;
- `REFERRALS_STRIPE_ACCOUNT`: the expected account ID;
- `REFERRALS_SIGNING_PRIVATE_KEY`: dedicated Ed25519 PKCS8 key, base64, stored only in the server secret store;
- `REFERRALS_NATIVE_PUBLIC_KEY`: the matching raw 32-byte public key in base64;
- `PCT_REFERRAL_PUBLIC_KEY`: the same public key embedded at native build time.

The signer must parse correctly, be Ed25519, differ from the ordinary Pro issuer, and match the configured native public key. A native build without an issuer cannot accept a bonus. Do not put private keys or production credentials in source, preview fixtures, logs or review attachments. Keep the HMAC key stable; rotation needs a deduplication migration. Issuer rotation needs a coordinated signed client/server release.

`NODE_ENV=test` together with `REFERRALS_TEST_MODE=true` allows test-mode payment evidence only in isolated tests. A production test-key checkout is not production readiness. Never run financial tests against live keys or real customers. No live coupon, discount, reward, server secret, database or release has been changed by this implementation.

The live Dashboard was read on 20 October 2026: Managed Payments is active and the default, including existing payments and subscriptions. No setting was changed. In managed mode the adapter explicitly sends `managed_payments.enabled=true`, delegates tax and dynamic payment methods to Stripe, and omits the incompatible direct automatic-tax, customer-address-update and card-method parameters. In direct mode it explicitly sends `managed_payments.enabled=false` and retains automatic tax, address collection and cards. This model is saved with the immutable quote; changing configuration cannot silently switch an already-open checkout. Provider readback must match the quote's model. Omit `allow_promotion_codes` entirely when supplying `discounts`; Stripe rejects the combination even when the former is `false`.

The initial synthetic provider run exercised direct Checkout with a TEST-session-only override. A separate Managed Payments run completed monthly, annual and Lifetime hosted TEST purchases with eligible synthetic products, calculated Italian tax and the verified purchase-to-reward/refund path. Their synthetic pre-tax subtotals were 359/2699/4410 cents, actual payments 438/3293/5380 cents, and bonuses 6/12/12 months. Every resulting TEST payment was refunded and every bonus revoked. Eligibility time was advanced only in the disposable local test database. These are separate evidence sets, not production purchases, live webhook delivery or proof of complete native application integration. Product tax classification and tax-inclusive/exclusive prices are not changed by the referral adapter. Supported digital-product tax codes and Managed Payments parameter rules are documented at https://docs.stripe.com/payments/managed-payments/update-checkout and https://docs.stripe.com/payments/managed-payments/eligibility.

Before enabling:

1. Publish programme terms and the privacy/retention notice that match this document (cap, 120-day maturity, no transfer, Lifetime inviters, aggregate status), and staff the owner review procedure above.
2. Provision the dedicated issuer securely and verify the public key in a test build. Keep the programme disabled.
3. Complete the actual provider test-mode sequence: monthly, annual and Lifetime after an existing offer; timeout/retry; two open tabs; repeated notifications; refunds before/after activation; partial refunds; dispute and revocation; ordinary renewals with no second reward; and unchanged ordinary subscription flows.
4. Exercise two Windows installations, account switching/logout, reinstall/lost identity, lease expiry, offline recovery, and Store/installer handoff in a controlled environment.
5. Complete review and CI. Build final packages, verify publisher code signature, identity and trusted timestamp, and verify the updater signature. Any later package change requires signing and verification again.
6. Release the signed client before enabling the backend. Verify the public page and original user accounts on the deployed version. Monitor payment/award counts and review holds without exposing customer data. Disabling new referrals is independent of honouring or revoking an already-issued valid bonus.

## Tests

`npm test --prefix backend` runs the regular regression and policy tests. The real PostgreSQL transaction test is deliberately skipped unless `REFERRAL_TEST_DATABASE_URL` points to a loopback-only database whose name starts with `referral_test`. It truncates that disposable database. It must never use the application `DATABASE_URL` or a remote database.

After building the backend, set that dedicated test variable and run `node --test backend/test/referral-policy.test.mjs backend/test/referrals-postgres.test.mjs` from the repository root. Cases cover concurrent claims/quotes/payments/device activation, account/mode mismatches, payer reuse, out-of-order refunds, challenge replay, incorrect owner/key, disabled activation, revocation and an accepted checkout followed by a simulated provider timeout, plus the 21 October 2026 review: deterministic provider rejection and lost creation responses (R1), ordinary-price fallbacks (R2), mismatching payments acknowledged once and held for review (R3), the yearly cap, Lifetime inviters, address aliases and the 120-day maturity (R5), the aggregate inviter status (R6), refreshes and claims without provider calls (R7), cancelled trials (R8), disputes won (R9), challenge cleanup (R12), unrelated refunds and renewals (R13) and the device-key hash in the status (R14).

`node scripts/test-referrals.mjs` (part of `npm run check`) covers the app side: the clock check before an activation proof, a session change after the server accepted a proof, device matching and error codes. `npm run check:native-policy` includes native licence, explicit IPC capability and referral binding/DPAPI tests, including the clock tolerance and the local (non-roaming) storage path. Use the controlled Windows/VM workflow for complete application integration. Desktop/mobile fixture previews demonstrate interface behaviour; they cannot activate a real bonus or payment and do not replace these tests.
