# Changelog

All notable changes to PC Tweaker are logged here, newest first. Every
update from here on (features, fixes, infra changes) gets an entry —
this is the single source of truth for "what changed and why," not just
the git log.

## 2026-08-02

- **Added**: an automated check suite (`npm run check`), wired into CI so it
  runs on **every push**, not just on release tags — and as a gate before the
  release build itself.
  - **19 Rust unit tests** covering the parts where a silent failure is
    expensive: rollback-store integrity under concurrency, batch elevation
    grouping, tweak-id uniqueness, the startup-approval byte encoding, and
    both locale-dependent parsers.
  - **Translation validation** (181 keys x 5 languages): TypeScript already
    proves every key exists, but not that `{count}`/`{name}` placeholders
    survive translation — a string that loses one still compiles and ships a
    broken sentence to that language's users. Now checked, and verified to
    actually fail when a placeholder is removed.
  - The two concurrency tests were confirmed to be real regression tests by
    temporarily removing the lock: they fail with exactly the reported
    symptom (`lost keeper-0`) and pass again once it's restored.
- **Fixed**: the snapshot file was written through a fixed temp-file name, so
  two writers not covered by the in-process lock (the elevated helper is a
  separate process) could clobber each other's temp file and fail the commit.
  Temp names are now unique per process and per write, and a failed rename
  cleans up after itself. Found by the new concurrency test.
- **Added**: **Startup programs manager** (new "Avvio" section) — lists every
  program Windows launches at boot from both HKCU and HKLM, and toggles them
  through the same `StartupApproved` mechanism Task Manager itself uses, so
  the app agrees with what Windows reports and nothing is uninstalled or
  made hard to undo. HKLM (machine-wide) entries route through the existing
  one-shot UAC helper. Verified live against this PC's real 6 startup
  entries: enabling wrote `02 00…`, disabling wrote `03 00…` plus a correct
  FILETIME that decodes to the exact second it happened.
- **Added**: **live system monitor** on the Scan screen — real CPU load,
  memory and system-drive usage as animated gauges (green/amber/red by
  load), plus CPU model, OS build and uptime. All read from the real machine
  via `sysinfo`; there is no invented "health score".
- **Redesigned**: the whole shell moved from a row of pill tabs to a proper
  sidebar app layout — icon nav with an active accent rail, section title
  header, and a plan card pinned to the bottom of the sidebar.
- **Fixed (real usability bug)**: Scan's "fix all" fired a **separate UAC
  prompt for every admin-level tweak** — a dozen consecutive prompts for one
  click. Added a batched `apply_tweaks` command that groups every admin tweak
  into a single elevated run (one prompt), reports per-tweak failures instead
  of aborting the batch, and only claims success for what actually applied.
  Verified live, including the partial-failure path.
- **Fixed (real data-integrity bug)**: the rollback store did an unsynchronized
  load-modify-write, so two overlapping writers silently dropped one of the
  snapshots — which would leave a tweak applied with no way to undo it. This
  is reachable in normal use: the Game Sessions watcher thread applies and
  reverts Turbo Gaming in the background while the user can be toggling
  something else. Writes are now serialized through a process-wide lock and
  committed via temp-file + atomic rename, so an interrupted write can't
  leave an unparseable snapshot file either.
- **Fixed**: the system monitor's memory/disk figures were truncated
  mid-number ("16.27 GB / 31.10 …"); they now render as a single compact
  "17.0 / 31.1 GB" pair.
- **Fixed**: the sidebar plan card repeated the same tweak tally already
  shown in the header, and the header showed a tweak tally on the Startup
  screen, which isn't made of tweaks at all.
- **Fixed**: the startup counter read "1 attivi su 6" — wrong Italian for a
  count of one. Reworded to a form that stays grammatical at any number, in
  all five languages.
- **Added**: 3 more tweaks, bringing the total from 22 to 25 — all verified
  live against the real system:
  - "Nascondi la casella di ricerca dalla barra delle applicazioni" (Free, UI).
  - "Disattiva ottimizzazioni schermo intero globalmente" (Free, Gaming) —
    DXGI honor-FSE registry fix for reduced stutter/input lag in older games.
  - "Disattiva servizio di indicizzazione (Windows Search)" (Pro,
    Manutenzione) — the app's first service-level tweak (stop + disable via
    `sc.exe`, not just a registry value), with real rollback that restores
    the exact previous start type including delayed-auto-start, not just a
    generic "automatic".
  - Caught and fixed a real bug while testing the new service tweak:
    `sc qc`'s field label is localized ("TIPO_AVVIO" in Italian vs
    "START_TYPE" in English) — same root cause as the earlier `powercfg`
    locale bug. Now matches on the (always-English) enum value instead.
- **Fixed**: Scan incorrectly showed Pro tweaks as locked-behind-Pro
  suggestions even for accounts that already own Pro. It now checks the
  account's actual plan and treats every not-yet-applied tweak/cleanup —
  Pro included — as directly fixable when the account is Pro; the "also
  available with Pro" box only shows for non-Pro accounts.
- **Moved**: the password breach checker from the bottom of the Privacy tab
  to the top — it's one of the most useful features here, it shouldn't be
  buried under a dozen toggle rows.
- **Polished**: Scan's results list now has a "select/deselect all" link,
  a colored icon per issue (tweak vs. cleanup), and a fill-progress bar on
  the "Fix all" button while it's working through the list.
- **Tuned**: the Scan animation was too fast to read as "doing real work" —
  slowed it down (~4.2s) and added a live percentage counter tied to actual
  elapsed time, with a progress ring that fills in step.
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
