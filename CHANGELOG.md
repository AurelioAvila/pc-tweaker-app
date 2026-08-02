# Changelog

All notable changes to PC Tweaker are logged here, newest first. Every
update from here on (features, fixes, infra changes) gets an entry —
this is the single source of truth for "what changed and why," not just
the git log.

## 2026-08-02

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
