# Release Runbook — the "Control Room" launch (all apps except Social Dashboard)

Prepared 2026-08-21, executed on the owner's explicit "rilascia".
Everything below is already built, signed, and verified locally; the run
is push + publish only. Order matters: the Uninstaller goes first so the
PC Tweaker release notes' link to it lands on a live release.

## Pre-flight (already done)

- [x] pc-tweaker-app: `intelligence-slice` merged into local master, version
      1.0.0 everywhere (package.json / tauri.conf.json / Cargo.toml),
      CHANGELOG.md entry, full gate green, signed NSIS+MSI built locally
      with `~/.tauri/pctweaker.key` (empty password), `.sig` files present.
- [x] pc-tweaker-uninstaller: updater plugin integrated (endpoint →
      its own repo's latest.json, suite pubkey), version 0.2.0, CHANGELOG,
      signed NSIS+MSI built, `.sig` files present.
- [x] promptshield: landing redesign live on Vercel, CHANGELOG v0.1.8,
      package.json 0.1.8 (web only; desktop binaries remain 0.1.7).
- [x] `scripts/make-latest-json.mjs` in both Tauri repos (refuses to run
      on unsigned builds).
- [x] Release notes: `RELEASE-NOTES-1.0.0.md` (app),
      `RELEASE-NOTES-0.2.0.md` (uninstaller). Announcement copy in
      `docs/ANNOUNCEMENT-1.0.0.md`.

## Execution — PC Tweaker Uninstaller 0.2.0 (first)

```bash
cd ~/Desktop/pc-tweaker-uninstaller
git push origin master
git tag v0.2.0 && git push origin v0.2.0
node scripts/make-latest-json.mjs RELEASE-NOTES-0.2.0.md
gh release create v0.2.0 \
  --title "PC Tweaker Uninstaller 0.2.0 — Removal Intelligence" \
  --notes-file RELEASE-NOTES-0.2.0.md \
  "src-tauri/target/release/bundle/nsis/PC Tweaker Uninstaller_0.2.0_x64-setup.exe" \
  "src-tauri/target/release/bundle/nsis/PC Tweaker Uninstaller_0.2.0_x64-setup.exe.sig" \
  "src-tauri/target/release/bundle/msi/PC Tweaker Uninstaller_0.2.0_x64_en-US.msi" \
  "src-tauri/target/release/bundle/msi/PC Tweaker Uninstaller_0.2.0_x64_en-US.msi.sig" \
  "src-tauri/target/release/bundle/nsis/latest.json"
```

## Execution — PC Tweaker 1.0.0

```bash
cd ~/Desktop/pc-tweaker-app
git push origin master           # master carries the merged 1.0.0
git tag v1.0.0 && git push origin v1.0.0   # CI builds too, as a cross-check
node scripts/make-latest-json.mjs RELEASE-NOTES-1.0.0.md
cd src-tauri/target/release/bundle/nsis
cp pc-tweaker-app_1.0.0_x64-setup.exe PCTweaker-Setup.exe   # stable-URL alias, as in 0.5.0
cd ../msi && cp pc-tweaker-app_1.0.0_x64_en-US.msi PCTweaker-Setup.msi && cd ../../../..
gh release create v1.0.0 \
  --title "PC Tweaker 1.0.0 — Control Room" \
  --notes-file RELEASE-NOTES-1.0.0.md \
  src-tauri/target/release/bundle/nsis/pc-tweaker-app_1.0.0_x64-setup.exe \
  src-tauri/target/release/bundle/nsis/pc-tweaker-app_1.0.0_x64-setup.exe.sig \
  src-tauri/target/release/bundle/nsis/PCTweaker-Setup.exe \
  src-tauri/target/release/bundle/msi/pc-tweaker-app_1.0.0_x64_en-US.msi \
  src-tauri/target/release/bundle/msi/pc-tweaker-app_1.0.0_x64_en-US.msi.sig \
  src-tauri/target/release/bundle/msi/PCTweaker-Setup.msi \
  src-tauri/target/release/bundle/nsis/latest.json
```

## Execution — PromptShield v0.1.8 (web release)

```bash
cd ~/Desktop/promptshield-repo
git push origin main   # v0.1.8 commit is already local
git tag v0.1.8 && git push origin v0.1.8
gh release create v0.1.8 \
  --title "PromptShield 0.1.8 — the landing becomes the demo" \
  --notes "Web release: redesigned landing where an animated shield card replays a real scan (raw → detection → safe), honest four-category coverage, and a fixed PWA install control. Live at https://promptshield-beta.vercel.app. Desktop binaries unchanged (0.1.7)."
```

## Post-release verification (all three)

1. `gh release view v1.0.0 --json assets` — latest.json + setup.exe + .sig present.
2. Open the installed PC Tweaker 0.5.0 → the update banner must offer
   1.0.0; install through it end-to-end (this is the real updater test).
3. Install Uninstaller 0.2.0 from its setup.exe; confirm it runs and the
   suite pill opens PC Tweaker.
4. Check `https://github.com/.../releases/latest/download/latest.json`
   resolves for both repos.

## Rollback

- Bad release asset: `gh release delete-asset` / re-upload; latest.json is
  the switch — deleting it stops updater offers instantly.
- Bad build: delete the release + tag; existing installs stay on 0.5.0.
  Git rollback points: `backup-pre-intelligence` (app),
  `backup-pre-removal-intelligence` (uninstaller).
