# Releasing PC Tweaker

Official releases are built locally and published by Aurelio Avila. CI verification artifacts are unsigned and must not be distributed as official releases.

1. Save a source checkpoint. Update package.json, its lockfile, src-tauri/Cargo.toml, its lockfile and src-tauri/tauri.conf.json to the same new version. Update catalog counts, translated copy and release notes when behavior changes.
2. Run TypeScript, translation coverage and quality, lint, formatting, frontend tests, backend tests and the site build. Run the complete Rust suite on the disposable Windows CI runner. Run the explicitly ignored native power test there as well: it creates and deletes an inactive plan and verifies AC restoration, unchanged DC policy and unchanged active plan.
3. Test paid-event handling against an isolated PostgreSQL schema, with synthetic events and a fake email provider. Verify live Stripe prices and endpoint configuration separately. Never send synthetic paid events to the production webhook or create a real charge for an automated test.
4. Build the exact tested commit locally. Supply the Tauri updater private key through the process environment, never through source or logs. Load the Windows code-signing certificate through its configured provider. Apply the signing configuration during Tauri bundling so executable metadata changes happen before the final Authenticode signature.
5. Verify Authenticode signatures and trusted timestamps on the application, shipped DLLs and both installers. Inspect the bundled application and uninstaller, not just the outer setup file. Confirm the publisher is Aurelio Avila. Verify updater signatures against the public key compiled into the app; the .sig file's presence alone is insufficient.
6. Produce latest.json using scripts/make-latest-json.mjs with the release notes file. Check its exact versioned URL and signature. Record SHA-256 hashes of every public artifact. Never replace an already published version with different installer bytes.
7. Deploy the tested backend and website. For a Lifetime campaign, set LIFETIME_CAMPAIGN_ID, LIFETIME_CAMPAIGN_STARTS_AT and LIFETIME_CAMPAIGN_ENDS_AT together. Use a single absolute UTC interval of exactly 48 hours. Keep expired campaign values in place; removing all three restores ordinary Lifetime availability. Confirm the offer endpoint and real checkout before announcing the campaign.
8. Publish the new Git tag and GitHub release with signed EXE, MSI, updater signatures, latest.json and checksums. Existing release workflows publish stable download aliases and submit the Winget update. Do not open a duplicate Winget PR.
9. Download the public artifacts and compare hashes with the verified local files. Verify stable aliases, updater manifest, website and backend. Check the Winget workflow and upstream PR; submission is not the same as catalog availability. State the actual PR status.

## Recovery and commerce checks

- Failed setting writes retain recovery records. Unsupported targets and overlapping or ambiguous legacy records must fail before mutation.
- New DNS snapshots preserve automatic versus static configuration. Old records without that information require manual review.
- New power controls preserve the original plan and effective AC value. They leave battery policy unchanged and must not recreate a deleted plan.
- Duplicate and out-of-order subscription events must not overwrite Lifetime. License delivery depends on a verified paid event and the account's signed entitlement.
- Purchase emails enter a durable queue before webhook acknowledgment. Provider outages are retried. Delivery is at-least-once: a crash after provider acceptance can duplicate a receipt, but cannot duplicate a charge.
- Retain prior source and signed artifacts for rollback. Do not restore an old database dump over new purchases.

## Trust wording

Authenticode establishes publisher identity and file integrity. Tauri signatures protect updater packages. Neither is Microsoft endorsement, a performance guarantee or a promise that SmartScreen will never warn. Older releases may be unsigned; identify the version whenever making a signing claim.
