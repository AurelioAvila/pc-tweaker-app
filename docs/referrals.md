# PC Tweaker invitations and device-bound Pro bonuses

Status: implementation under test; disabled by default. This document does not announce a live programme.

## Commercial policy

An eligible invited account receives an extra 10% on its first supported positive Stripe payment, after any compatible first-payment offer. Integer EUR cents are calculated by the server. Normal renewal terms remain unchanged. Trials are not combined with the referral checkout in this version.

A monthly purchase earns the inviter a separate six-month personal Pro bonus for one PC. An annual purchase earns twelve months. A Lifetime purchase currently maps to twelve months, not Lifetime. The first-payment discount scope and Lifetime treatment are implementation defaults that must be ratified before launch; monthly and annual rewards follow the requested policy.

Rewards normally remain pending for at least thirty days after the actual payment. This is an operational verification hold, not a refund or dispute deadline. Duration begins on explicit activation and is clamped to calendar month ends. There is no recurring charge for a bonus. Activating while paid Pro is already active makes the periods overlap; the panel warns the customer. There is no automatic device transfer or paid-plan extension.

Existing Lifetime owners may gift a ready, unused bonus to another account, as requested. The sender specifies and confirms an email, then shares a private link themselves; no email is sent automatically. Redemption requires the recipient's current verified email to match. The originating buyer and sender cannot redeem that gift. A recipient who already has Lifetime cannot claim it. The sender can cancel before redemption and reserve it for a different email; the old code stops working. Redemption sets a separate beneficiary once, does not start the duration, and cannot be cancelled or transferred again. Only that beneficiary can activate the original six- or twelve-month bonus on one PC. The original payment and inviter remain unchanged for audit and refund enforcement.

Gift links use a 256-bit HMAC-derived code in the URL fragment, not the server-visible query. Only its keyed hash and the recipient email HMAC are stored. Owner status can reconstruct the unclaimed code with the server secret; the recipient email is not disclosed in reward lists. Keep the hashing key stable or plan an explicit rotation and gift recovery process. Gift/claim/cancel/activation all serialise on the reward row; activation proofs issued before reservation cannot bypass the reservation. Refunding the originating purchase also blocks the recipient's next licence refresh, subject to the existing bounded cached lease.

## State and payment authority

The browser cannot provide a price, reward duration, payment identity, maturation date or entitlement flag. Checkout uses the server-selected plan/Price and a saved immutable quote. A combined once-only coupon preserves compatible existing offers. Concurrent requests reuse the same quote and provider idempotency keys; the referral adapter never retries by dropping an idempotency key.

An expired invitation with no unresolved referral checkout does not block an ordinary purchase or trial under the existing checkout rules. The fallback locks the account and enrolment in the same order as reservation, so it cannot overlook a concurrently created referral checkout. An existing open, creating or paid quote is never discarded merely because the invitation expires. Provider-confirmed session expiry is required before returning to ordinary pricing; an uncertain or completed payment still requires reconciliation. The account panel displays invitation expiry from the server.

The adapter retrieves the current Stripe account, completed session, first positive subscription-create invoice or one-time payment, actual successful captured charge, refunds, disputes and payer evidence. Coupon, Price, quantity, customer, environment, currency, discount, amount and payment time must match the quote. Every financial effect must pass test-mode provider verification before launch; local adapter fixtures are not proof of a successful Stripe checkout.

The database enforces one enrolment per buyer, one live quote per enrolment, and unique quote/payment/invoice/buyer/payer reward identities. Repeated payer details suppress an additional bonus without turning a successfully paid purchase into a permanently retrying webhook error. Signed-webhook receipts are persisted after successful processing; business uniqueness also protects concurrent deliveries of different event IDs. Failed deliveries remain retryable. Refund/dispute tombstones survive sale events delivered later. Revocation is terminal; a hold does not clear because an old success event reappears.

An inviter without usable payer history remains under identity review. A payment method without usable payer evidence also creates a review hold, never an automatically available bonus; its placeholder is keyed to the payment, not treated as person-level deduplication. There is no public endpoint for clearing holds. Establish a documented owner review process before enabling the programme. Do not silently turn missing evidence into approval.

## Device and account enforcement

Bonus grants use a dedicated Ed25519 issuer key. The ordinary Pro signing key must never issue bonus grants: old clients ignore unknown JSON fields and could otherwise accept a device-bound grant as an ordinary licence. The regular licence path also rejects the bonus plan explicitly. Bonuses never set `users.is_pro`, alter purchased entitlements, or replace the ordinary local licence file.

Windows generates a random device signing seed. Private local state is wrapped with user-scoped DPAPI and machine-scoped DPAPI. Only the public key is sent to the server. Missing, unreadable or corrupt existing identity files fail closed; they are not silently replaced. Loss of the Windows profile/device identity requires support review rather than automatic reassignment.

Activation and refresh require a single-use five-minute challenge bound to the account, reward, purpose, nonce and device public-key hash. Native code signs only this protocol for its current session. Activation serialises on the reward row so two PCs cannot both win. The signed grant contains the account, product, schema, reward, device and current bearer-session hash. Native feature gates verify these bindings with the dedicated issuer, and accept at most a ten-minute signed lease. Online refresh is attempted every five minutes and on account refresh; brief failures retain only the remaining lease. Logout clears bonus state; a new login clears previous signed caches before storing its session.

Revocation cannot instantly remove a response already cached offline; the residual lease is at most ten minutes plus the bounded clock allowance. An administrator controlling the operating system, cryptographic master keys, application binary or clock across restarts is outside a claim of absolute client-side protection. No such claim is made.

## Invitation handoff and privacy

The static landing page is `/invite/?ref=<random-code>`. The private gift handoff is `/gift/#claim=<private-code>`. Both are prerendered with `noindex,follow`, a code-free canonical, and excluded from the sitemap. The invitation page checks programme availability and code validity without exposing the inviter's identity. The gift page checks only code format and clearly defers validity and email eligibility to authenticated redemption in the app. Downloads always use the existing official distribution endpoints.

New public invitation codes contain ten characters from a 32-symbol alphabet, always with both a letter and a digit. Cryptographic uniform sampling excludes I, O, 0 and 1; short codes ignore case. Database uniqueness handles collisions with bounded retries under the account lock. Existing 22-character links remain valid and case-sensitive. This shorter public attribution code is not a payment or licence credential; private gift links retain their separate 256-bit code and verified-recipient checks. The app opens Account → Invite a friend, with separate tabs for sharing, bonuses and entering a code.

The friend copies the code, installs, signs in, verifies email, and confirms the code in the account panel before opening a supported checkout. Microsoft Store `cid` is not treated as proof of individual referral installation. Downloads and registrations alone never create a reward. This flow does not cryptographically attest that a remote caller installed an official binary.

Email and payer deduplication values are HMACs under a dedicated server key, not public hashes. Payment IDs, ownership, timestamps, device public keys, session hashes and decisions remain private account/security data. The reward list does not disclose the friend's email, card, amount or account ID. Define retention, account deletion, support access, review and privacy/terms disclosures before launch. Hashing is not a claim of anonymisation or legal compliance. Provider card fingerprints are an imperfect signal: wallets, multiple cards and multiple identities can evade a simplistic person-level rule. This version does not claim to eliminate all fraud or prevent all repeat discounts before the payment method is known.

## Configuration and release gates

Existing deployments remain off without explicit complete configuration:

- `REFERRALS_ENABLED=true` and `REFERRALS_POLICY_VERSION=2026-10-20-v1`;
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

1. Ratify the remaining commercial defaults and existing-Pro overlap treatment, support review, recovery rules, programme terms and privacy retention. Giftable Lifetime rewards follow the confirmed policy. Complete the customer-facing language coverage before launch.
2. Provision the dedicated issuer securely and verify the public key in a test build. Keep the programme disabled.
3. Complete the actual provider test-mode sequence: monthly, annual and Lifetime after an existing offer; timeout/retry; two open tabs; repeated notifications; refunds before/after activation; partial refunds; dispute and revocation; ordinary renewals with no second reward; and unchanged ordinary subscription flows.
4. Exercise two Windows installations, account switching/logout, reinstall/lost identity, lease expiry, offline recovery, and Store/installer handoff in a controlled environment.
5. Complete review and CI. Build final packages, verify publisher code signature, identity and trusted timestamp, and verify the updater signature. Any later package change requires signing and verification again.
6. Release the signed client before enabling the backend. Verify the public page and original user accounts on the deployed version. Monitor payment/award counts and review holds without exposing customer data. Disabling new referrals is independent of honouring or revoking an already-issued valid bonus.

## Tests

`npm test --prefix backend` runs the regular regression and policy tests. The real PostgreSQL transaction test is deliberately skipped unless `REFERRAL_TEST_DATABASE_URL` points to a loopback-only database whose name starts with `referral_test`. It truncates that disposable database. It must never use the application `DATABASE_URL` or a remote database.

After building the backend, set that dedicated test variable and run `node --test backend/test/referral-policy.test.mjs backend/test/referrals-postgres.test.mjs` from the repository root. Cases cover concurrent claims/quotes/payments/device activation, amount/plan/account/mode mismatches, payer reuse, out-of-order refunds, stale facts, challenge replay, incorrect owner/key, disabled activation, revocation and an accepted checkout followed by a simulated provider timeout. Gift cases cover verified recipient matching, pending/active/held/revoked exclusion, repeated redemption, cancellation racing with redemption, stale sender proofs, no onward transfer, delayed recipient activation and revocation after a refund.

`npm run check:native-policy` includes native licence, explicit IPC capability and referral binding/DPAPI tests. Use the controlled Windows/VM workflow for complete application integration. Desktop/mobile fixture previews demonstrate interface behaviour; they cannot activate a real bonus or payment and do not replace these tests.
