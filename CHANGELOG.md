# Changelog

All notable changes to PC Tweaker are logged here, newest first. Every
update from here on (features, fixes, infra changes) gets an entry —
this is the single source of truth for "what changed and why," not just
the git log.

## 2026-08-02

- **Redesigned**: Turbo Boost is now a standalone card with a big centered
  circular button (START/STOP), pulsing glow rings while the apply/rollback
  call is in flight — Advanced-SystemCare-style, instead of a title + toggle
  switch row.
- **Replaced**: the "Tutti" (All) tab with a new **Scan** tab — the app's
  new landing screen. Big circular "SCAN" button leads into a staged check
  (Performance/Privacy/Gaming/junk files) that surfaces this PC's real
  not-yet-applied free tweaks and pending temp cleanup as a checklist, with
  a "Correggi tutto" button that applies everything checked in one go and
  a separate "also available with Pro" upsell list for the Pro-only ones.
  Nothing here is fabricated — it reads the same `list_tweaks`/
  `list_cleanup_targets` data already used elsewhere; the scan animation is
  just paced reveal of real, already-loaded state, not a fake progress bar.
  Verified live: scan correctly found 20 real unapplied free tweaks plus 4
  Pro ones on this machine.
- **Changed**: Game Sessions now only shows on the Gaming tab (it used to
  render on every tab regardless of the selected filter).
- **Added**: dedicated Turbo Boost panel on the Gaming tab (replaces its
  plain toggle row) with a custom spinning-glow/pulsing-icon animation while
  the apply/rollback call is in flight — same underlying tweak, verified
  live earlier, just a much more "gamer" presentation for a Free feature
  that's meant to sell the app's polish.
- **Added**: "Riduci ritardo di input (tastiera)" (Free, Gaming) — zeroes
  the key-repeat delay and maximizes repeat rate (HKCU), verified live
  against the real registry (apply: Delay 1→0; rollback: back to 1).
  Complements the existing mouse input-lag tweak.
- **Added**: password breach checker (Free, Privacy) — checks a password
  against Have I Been Pwned's Pwned Passwords range API using k-anonymity
  (only the first 5 hex chars of its SHA-1 hash ever leave the device, never
  the password or full hash). Verified live against the real API: "password"
  correctly reports 52,372,427 known breaches, a strong random password
  correctly reports none.
- **Fixed**: 7 tweaks added earlier today (network throttling, system
  responsiveness, games task priority, taskbar align, hide chat, Start
  suggestions, activity history) had no EN/FR/ES/DE translations — the
  existing per-tweak i18n map (`s.tweaks`) just didn't have entries for
  them yet, so non-Italian users saw Italian text. Added all 4 translations
  for all 7, plus the new keyboard-delay tweak.
- **Not shipped (needs a decision)**: "Maschera IP (VPN)" stays an honest
  placeholder — real IP masking needs an actual VPN backend (paid server
  infrastructure in multiple regions, WireGuard/OpenVPN), which can't be
  spun up as a code change. Flagged to the user for a call on how to fund/
  build it.
- **Added**: 7 new tweaks, verified live one by one against the real registry
  (apply + rollback, not just compiled):
  - *Gaming*: "Disattiva limitazione di rete multimediale" (MMCSS
    NetworkThrottlingIndex, Free), "Massimizza reattività per app in primo
    piano" (SystemResponsiveness, Free), "Priorità massima ai giochi" —
    bundles GPU/CPU/scheduling priority for the Games task profile (Pro).
  - *UI*: "Allinea la barra delle applicazioni a sinistra" (Free), "Nascondi
    Chat/Teams dalla barra delle applicazioni" (Free).
  - *Privacy*: "Disattiva suggerimenti e app consigliate nel menu Start"
    (Free), "Disattiva cronologia attività (Windows Timeline)" — 3 bundled
    policy values (Pro).
  - Pro/Free calls were made per tweak: single simple values stayed Free
    (consistent with the existing free tweaks), multi-value bundled presets
    went Pro (consistent with Turbo Gaming).
  - Caught a real, reproducible bug during verification: "Nascondi Widget
    dalla barra delle applicazioni" (`TaskbarDa`) returns Access Denied even
    from a fully elevated Administrator process — a genuine Windows 11
    restriction on that specific value, not a bug in our code (confirmed by
    testing a direct `Set-ItemProperty` from the same elevated shell, and a
    Group-Policy-backed alternative path, both denied). Dropped that tweak
    and shipped "Allinea la barra delle applicazioni a sinistra" instead,
    which was verified to actually write and roll back correctly.
- **Fixed**: Game Sessions could accept the same game twice (or fail to
  remove it) if picked via a differently-cased path — Windows paths are
  case-insensitive but the duplicate/remove checks weren't. Now compares
  paths case-insensitively.
- **Fixed**: app showed the Free plan for a real Pro account (`is_pro` was
  still `true` in the database the whole time — verified directly). Root
  cause: `VITE_API_BASE_URL` was never persisted anywhere, so any
  `npm run tauri build` run without passing it inline on the command line
  silently baked in an empty backend URL, making the app unable to fetch
  `/api/account` at all and get stuck on its Free-by-default initial state.
  Added a committed `.env` (not a secret — it's just the public Railway URL)
  so every future build picks it up automatically.
- **Fixed**: the "Game Sessions" toggle switch rendered crooked/misshapen —
  its `<button>` was missing the reset styles (`appearance-none`, `border-0`,
  `p-0`, `inline-flex items-center`) that the shared `Toggle` component
  applies everywhere else, so the browser's default button box model
  distorted the pill. Now uses the same reset + sizing as every other
  toggle in the app.
- **Added**: "Game Sessions" (Pro) — auto-detects when a registered game
  launches and automatically applies the Turbo Gaming preset, then reverts
  it the moment the game closes, using the app's existing rollback system.
  Background watcher (`sysinfo`-based process polling, `src-tauri/src/game_sessions.rs`),
  new "Add game" picker in the UI. Verified live end-to-end (registry values
  and active power scheme actually changed and reverted, not just the
  on-disk snapshot).
- **Fixed**: found while testing the above — the "High performance power
  plan" tweak (and Turbo Gaming, which bundles it) silently failed to read
  the active power scheme on any non-English Windows install, because it
  parsed `powercfg`'s output looking for the literal English label `"GUID:"`.
  Now matches on the GUID's own shape (8-4-4-4-12 hex groups) instead of the
  localized label text.
- **Fixed**: registration now works from the packaged Windows app — CORS was
  rejecting the WebView2 origin (`http://tauri.localhost`, not
  `tauri://localhost`/`https://tauri.localhost` as first assumed).
- **Fixed**: verification/reset emails never actually sent — Railway blocks
  outbound SMTP ports, so requests hung for 2 minutes then failed. Switched
  to Resend's HTTP API (`RESEND_API_KEY`), with a verified sending domain
  (`pctweaker.getcertsprint.com`) so mail reaches any recipient, not just the
  account owner's sandboxed address.
- **Added**: first name, last name, and date of birth are now collected at
  registration.
- **Added**: automated Reel-generation pipeline (`marketing/reel-generator/`)
  feeding the existing YouTube/TikTok/Instagram publishers, running on a
  daily schedule.

## 2026-07-26 — 2026-07-29

- **Added**: fully automated YouTube upload pipeline (`marketing/youtube-upload/`) —
  drop a video in `marketing/to-publish/`, it publishes automatically (public,
  no manual review step, by explicit choice).
- **Added**: TikTok automation via the Content Posting API
  (`marketing/tiktok-upload/`).
- **Added**: Instagram publisher code (`marketing/instagram-upload/`) —
  built and ready, Meta/Page linking still pending a device-trust hold to clear.
- **Added**: MIT license, privacy policy, GitHub Actions CI build.

## 2026-07-25

- **Fixed**: white background flash behind short tabs / the open account menu
  (`html`/`body` had no background color set).
- **Fixed**: Stripe checkout failing on Managed Payments accounts — pinned
  the API version and added a required product tax code.
- **Live**: Stripe payments went live (real card charges, real payouts).
- **Released**: v0.1.1, backend deployed to Railway with Postgres.

## Earlier

See `git log` for the full history predating this changelog (initial app
scaffold, rollback engine, tweak categories, i18n, themes, Pro tier).
