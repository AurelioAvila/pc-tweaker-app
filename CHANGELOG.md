# Changelog

## v1.2.4 - 2026-08-24

- Fixed: sign-in, account status, and subscription management could fail
  with a network error due to a stale build configuration pointing the
  app at the wrong API address. All local functionality is unaffected;
  purchases made through the browser checkout were never impacted.

## v1.2.3 - 2026-08-24

- Fixed: a failed account-status check silently showed "Free" with no
  indication anything had gone wrong, even for active Pro subscribers.
  Now shows a clear message when your account status can't be verified.

## v1.2.2 - 2026-08-24

- Fixed an authentication issue affecting account sign-in.
- Pro subscribers can now manage their subscription (cancel, change plan,
  update payment method, view invoices) directly from the Pricing screen.

## v1.2.1 - 2026-08-23

- Sibling-product promo card on the Privacy screen now shows Redaxa
  (formerly PromptShield), matching the standalone product's rebrand.
- Restored the Reel content pool, added KB5121003 to known updates.
- Added a prominent Safe Download button (winget install, no SmartScreen
  prompt) next to the direct download.

## v1.2.0 - 2026-08-22

The Understanding Update.

- **Health Score history**: every measurement is recorded locally, with
  the previous score, its date, the delta and a trend line under the dial.
  Still on demand only, still never uploaded.
- **"Why did my score change?"**: names the categories that moved, largest
  first, quoting the evidence from both measurements. A category is only
  blamed when its score actually moved, evidence that drifts without moving
  points is never listed as a cause, and each category's contribution to the
  mean is printed so the arithmetic is disclosed rather than guessed at.
- **Technical details on every tweak**: an `(i)` disclosure showing the exact
  registry key, value name, type and written value - plus the commands and
  service changes behind the tweaks that are not a single registry write.
  Derived from the apply path, so it cannot drift from what the code does.
- Fixed: with text in the search box, selecting a section did nothing
  (every section panel was suppressed while searching), which made the app
  look frozen. Navigating now clears the search.
- Saving a configuration profile now requires an account.

## v1.1.0 — 2026-08-21

The Health Update.

- **PC Health Score**: nine explainable categories on a segmented
  speedometer; every point traces to a shown fact, computed only on
  demand, fully local. "Show more" reveals the factor-level calculation.
- **Baseline Engine**: repeatable CPU/memory/system-disk measurements
  with local history and last-vs-previous deltas.
- Precision fixes: exact canonical power-plan matching (Ultimate
  performance was mis-cased), laptop-aware Balanced rating, no raw GUIDs
  as evidence.

All notable changes to PC Tweaker are logged here, newest first. Every
update from here on (features, fixes, infra changes) gets an entry —
this is the single source of truth for "what changed and why," not just
the git log.

## Unreleased

### Added

- **Instagram pinned-CTA comment.** `marketing/instagram-upload/lib.js` now
  posts a "Try PC Tweaker for free" comment with the GitHub Releases link
  right after every Reel publish (mirrors the same pattern already used by
  the YouTube Ghostcut bot). The Graph API still has no way to actually pin
  a comment via the API, so it stays a manual step from the Instagram app.
  Non-blocking — a comment failure never affects the publish itself.
  Verified live against a real published Reel (media_id
  18086675720213950): comments_count went 0 → 1.

## v1.0.0 "Control Room" — 2026-08-21

One-point-zero. The release where PC Tweaker stops being a tweak list and
becomes a control room: a live instrument panel, an advisor that argues
from your hardware, and a ledger that remembers every change it ever made
— all wrapped in a design language built for this app alone.

### Added

- **PC Tweaker Intelligence.** Two new surfaces built on the audit and
  advice engines:
  - **Recommended for your PC** — one concrete, hardware-motivated
    recommendation on the home screen, with the reason it applies to this
    machine, a confidence level, and the guarantee that made this app:
    the original value is saved before any change. Never automatic, and
    structurally unable to suggest anything security-related — the
    allowlist that feeds it excludes those by construction (unit-tested).
  - **Change Ledger (History)** — every change this app made to this PC,
    newest first, stored locally and never uploaded, with one-click
    revert for anything still applied.
- **Control Room design language.** A three-layer token system drives the
  entire interface: 14 themes from three raw values each, live signal
  hairlines, Inter Variable, a consistent type scale, and motion that
  respects reduced-motion settings. Over 320 hardcoded colors retired.
- **Free RAM, front and center.** The home screen leads with the card
  people use daily: live tabular memory figures, a session usage trace
  where a trim shows up as a visible dip, and the auto-clean scheduler.
- **An instrument-grade Turbo Boost gauge** — bezel, dial numerals,
  tapered needle with counterweight, and a glow channel — replacing the
  flat arc.
- **A theme-aware diagnostic Scan** — the scan orb, progress arc, and
  results now take each theme's accent instead of a fixed gradient.
- **Device-local profile photo.** Pick a picture from your device; it is
  cover-cropped to 128 px and stored only on this machine. There is no
  avatar upload endpoint, on purpose.
- **Report an issue** in the account menu, opening pctweaker.app/support.
- **Suite cross-promotion done honestly.** The Maintenance screen links
  to PC Tweaker Uninstaller (with its real icon), and the Privacy screen
  closes with PromptShield — because the biggest modern privacy leak is
  what gets pasted into AI chats.

### Fixed

- **UI micro-freezes are gone.** Every command was synchronous, and Tauri
  runs synchronous commands on the main thread — so the stats poll, the
  startup listing, disk health, cleanup previews, and elevated waits all
  stalled the window for their full duration. Forty-four commands now run
  on the async runtime; the interface never blocks.
- Opt-in anonymous error reporting (off by default, one switch in the
  account menu) so crashes can be fixed without collecting anything else.

### Changed

- Version 1.0.0: the public contract this app has been building toward —
  honest descriptions, a backup before every change, one-click rollback,
  and now a written record you can audit.

## v0.5.0 — 2026-08-18

Fifty tweaks, a server-verified Pro tier, and a licence change. The minor
version bump is for the licensing work, not the tweak count.

### Added

- **Eight new tweaks, reaching 50** (33 free / 17 Pro). Every registry key
  was verified against a real Windows 11 install before being shipped —
  the same check that previously caught a recommendation rule pointing at
  a key that never existed.
  - **Disable Recall** (Pro) — Windows' AI screen-snapshot history, which
    captures whatever is on screen every few seconds, passwords included.
  - **Disable Memory Integrity / VBS** (Pro) — the largest real frame-rate
    gain available on most gaming machines. Its description states the
    trade-off outright: it removes a genuine protection against malicious
    drivers, suits a dedicated gaming PC rather than a work machine, and
    needs a restart.
  - **Bring back the full right-click menu** (Pro) — the complete Windows 10
    context menu, instead of "Show more options".
  - **Stop Windows learning how you type** (Pro) — turns off both the text
    and handwriting collection feeding Windows' personal dictionary.
  - **Disable Windows Copilot** (free).
  - **Stop Windows installing apps by itself** (free) — Windows silently
    installs "suggested" apps into the Start menu; this was confirmed active
    on a stock install.
  - **Disable mouse acceleration** (free) — the same flick always covers the
    same distance on screen.
  - **Stop the Sticky Keys popup** (free) — no more Shift×5 dialog dropping
    a game out of fullscreen mid-fight.
- **Server-signed Pro entitlement.** `apply_tweak` previously trusted a flag
  compiled into the app, with nothing checking it against the account
  actually running it. The backend now signs a short-lived licence with a
  dedicated Ed25519 key and the app verifies it before running any Pro
  tweak, tolerating three days offline. The check sits at the one point
  every apply path funnels through — including the elevated headless
  re-entry, which is reachable from a terminal with no UI involved.

### Changed

- **Two tweaks moved from free to Pro**: hardware-accelerated GPU scheduling
  and foreground responsiveness (MMCSS), the two most expert-facing of the
  free set. Anything already applied stays applied — rollback is
  deliberately never gated — but re-enabling it now needs Pro.
- **The source licence is no longer MIT.** The repository stays publicly
  viewable, but all rights are reserved: the `requires_pro` flags gating
  every Pro tweak sit in plain text in a public repo, and MIT explicitly
  permitted anyone to fork, flip them and redistribute an unlocked build.
  This does not retroactively revoke the grant for copies already taken.

### Fixed

- **The i18n audit reported correct French as broken.** Its accent check
  matched trap words with `\b`, and JavaScript's `\b` is defined against
  `[A-Za-z0-9_]`, so every accented letter manufactures a word boundary
  beside itself: `\btres\b` matched the "tres" inside "fenêtres" and
  "Paramètres". Now anchored on `\p{L}`, with a self-test that fails if a
  future edit silently disables the check.
- **Published tweak counts had been wrong since 0.4.3.** The site, README
  and both TERMS files still advertised "28 free / 36 total" while 42
  shipped. Now 33/50 everywhere, and re-checking them is a fixed step in
  `RELEASING.md` rather than something to remember. Two other stale numbers
  were found alongside: the README claimed 24 Rust tests and 12 themes; it
  is 78 and 14.

## v0.4.4 — 2026-08-17

- **Fixed: Italian, French and Spanish were missing their accents.** Twenty
  strings shipped with ASCII stand-ins — "piu' veloce" for "più veloce",
  "E' un buon compromesso" for "È un buon compromesso", "Gia' al massimo"
  for "Già al massimo", "systeme" for "système", "Deja" for "Déjà",
  "Configuracion" for "Configuración", "sesion" for "sesión". They were
  introduced by the ASCII-only scripts used to add the new keys, and they
  reached users in 0.4.3.

  The i18n audit had been catching this the whole time. It was missed
  because the check output was read through a pipe, so the exit code
  inspected was the pipe's and not the suite's — the suite was reporting
  failure and being read as success. Releases are cut from CI, which reads
  the exit code correctly and blocked the tagged build; the 0.4.3 installer
  had been built locally beforehand.
- The audit's reviewed-as-correct list now covers the storage acronyms
  (HDD/SSD/NVMe) and the handful of words that are genuinely identical to
  English in their target language, so the check is at zero and a real
  regression stands out instead of hiding among known noise.

## v0.4.3 — 2026-08-17

The Scan now reads the machine it is actually running on, Turbo Boost
measures what it bought instead of asserting it, and configurations can be
saved and shared. Plus a backend crash and a Turbo display bug found in the
pre-release audit.

### Added

- **Adaptive Scan.** New `SystemProfile` (`src-tauri/src/systemprofile.rs`)
  detects Windows build, CPU and core counts, GPU, RAM, disk kind, form
  factor and power plan, and `recommend.rs` turns that into a per-machine
  verdict — Recommended / Not recommended / Neutral / Unsupported — instead
  of the same checklist for everyone. A test asserts the profile carries no
  serial number, user name, computer name, MAC, IP, email or licence field;
  anything that cannot be read reliably is reported as `unknown` rather
  than guessed.
- **Scan is performance-only.** Cosmetic and privacy items (dark mode, Xbox
  Game Bar, Cortana) no longer appear there — `is_scan_relevant` is an
  explicit allowlist. The Scan also offers "fix everything" and "fix only
  what's recommended", each with its count.
- **Turbo Boost now measures.** A fixed integer workload
  (`src-tauri/src/cpubench.rs`) runs before and after the change and reports
  the real ratio. The score is never shown on its own — only the
  before/after comparison on the same machine, which is the only comparison
  that means anything. A test asserts two runs on unchanged hardware agree
  within 25% (measured: 0.4%), because a noisier workload would make the
  feature a random number generator with a confident label on it.
- **Configurations** (`src-tauri/src/profiles.rs`): save what you have
  applied, restore it in one click, export it to a file and hand it to
  someone else. An exported profile is a list of tweak *ids*, never a script
  or a registry path; every id from an imported file is checked against the
  tweaks this build ships, unrecognised entries are dropped and counted for
  the user, and an import is **never** applied on its own — you review it
  first. Tested against hostile input, including ids like `../../etc/passwd`
  and profile names that try to escape the profiles directory.
- **42 tweaks**, with real network, mouse and display latency additions —
  including Nagle/delayed-ACK disabling on the active adapter
  (`netlatency.rs`).
- **Keep me signed in** on the login form.

### Fixed

- **Backend (High): a failed database query killed the entire API.** Express
  4 does not catch rejections from `async` handlers, and the four handlers in
  `routes/reviews.ts` had no `try`/`catch` — so a rejected query became an
  `unhandledRejection`, which Node has terminated the process on since v15.
  One database hiccup on an anonymous public endpoint took logins, password
  resets and Stripe webhooks down with it until Railway restarted the
  service: a remote denial of service reachable without an account.
  Reproduced against real Express 4 (the process died without even
  answering the request) and confirmed fixed (HTTP 500, server still up).
  Handlers now go through `asyncRoute`, and a process-level backstop keeps a
  failed fire-and-forget notification from taking the service with it.
- **A failed Turbo Boost activation pinned the gauge at the redline.** The
  result of the awaited work was bound to `const applied`, shadowing the
  outer applied state; the failure fallback then read that object, which is
  always truthy, so the needle swung to maximum at the same moment the error
  toast appeared — showing full boost precisely when it had not been applied.
- **The avatar drew two overlapping circles.** The header rendered a 44px
  avatar inside a 36px button using `scale-[0.82]`, which is a transform:
  the layout box stayed 44px and spilled. The button also drew its own ring
  on top of the one the avatar already has. The avatar now takes a real size
  rather than being scaled.
- **"No measurable gain" understated real results.** A measured 1.02× was
  reported as nothing, which read as the app admitting it had done nothing.
  Three bands now: a clear gain, a small but measured gain, and — only when
  the result is inside measurement noise — a statement that the processor
  was already at full speed, which is a fact about the silicon rather than a
  failure of the tweak.
- **Password reset had never worked in production.** The page's inline
  script was blocked by `script-src 'self'`, and its inputs carried `id` but
  no `name`, so the native form submit sent nothing and the server answered
  "Missing token". Rewritten without JavaScript.
- **`CORS_ORIGINS` replaced the default list instead of extending it**,
  which silently locked pctweaker.app out of its own API.
- **Turbo Boost falsely reported "not supported"** on machines where
  PERFBOOSTMODE is hidden, and on non-English Windows where `powercfg`
  output is localised. Support is now read from the registry definition and
  written by GUID, neither of which depends on the display language.
- **GPU detection picked the integrated chip** over the discrete card
  (a 512MB AMD reported instead of a 6GB GTX 1660). It now picks by VRAM.
- **A recommendation rule had never fired**, keyed on a tweak id that does
  not exist (`disable_indexing_service` rather than
  `disable_windows_search_service`) — the only HDD-vs-NVMe advice in the
  Scan.
- **Theme dots collided**; the picker now shows 14 solid swatches matching
  the site.
- **Release builds could ship unsigned without anything failing.** `tauri
  build` reports a missing signing key and still exits 0, and the build
  workflow uploaded only the `.exe`/`.msi` — never the `.sig` files the
  updater needs. Either alone was enough to publish a release that every
  existing install would refuse to update to, silently. Hit for real while
  cutting this release. The workflow now uploads the signatures and fails
  the build when they are missing.

### Changed

- Optimize CPU priority moved to Pro; Disable Cortana is now free.
- `src-tauri/Cargo.toml` had drifted to 0.4.1 while the app shipped as
  0.4.2. All three version fields are now 0.4.3.
- `netlatency` was reachable from the UI but missing from the test list that
  checks tweak ids are unique and elevation is requested once — so it was
  covered by neither. Added.

## 2026-08-15

- **Changed (marketing/reel-generator)**: added a third trusted background
  source, `pc-tweaker-valorant-gameplay.mp4` (~5:43, real Valorant footage
  recorded 8/14), alongside the two existing product-demo clips —
  `main.py`'s `TRUSTED_DEMO_VIDEOS` list.
- **Added (marketing/youtube-upload)**: `check-performance.js` now persists
  a per-video snapshot (views/likes/comments/vph + timestamp) to
  `yt_performance_log.json` on every run, same key-per-video shape as
  `marketing/instagram-upload/check-performance.js`'s
  `ig_performance_log.json` — previously it only printed the current
  numbers with no way to see the trend across runs.
- **Added (marketing/instagram-upload)**: `check-performance.js` — PC
  Tweaker had no Instagram performance visibility at all before this;
  checks Reel insights (views/likes/comments/shares/saved/watch time),
  persists them to `ig_performance_log.json`, and flags regressions
  against the previous check.

## v0.4.1 — 2026-08-08

Findings from a self-directed penetration test, fixed same day.

- **Security (High): DevTools were reachable in the shipped installer.**
  `src-tauri/Cargo.toml` explicitly enabled the `devtools` Cargo feature,
  which specifically exists to turn DevTools on in *release* builds —
  debug builds already get them for free. Confirmed live: F12 and
  right-click > Inspect both worked on the built exe. With no XSS sink in
  the app (verified: no `dangerouslySetInnerHTML`, no `eval`, no
  `document.write`), the practical risk was local: anyone with access to
  the machine could open a full JS console and call
  `window.__TAURI__.core.invoke(...)` directly with arbitrary arguments,
  bypassing every UI-side guard - which drive, which folder, which tweak
  id. Fixed by moving `devtools` behind a crate feature that `tauri dev`
  enables automatically and `tauri build` never does (the standard Tauri
  pattern - a `cfg(debug_assertions)` dependency target does not exist,
  Cargo target selectors only understand platform/arch).
- **Security (Medium): rate limiter bypass via X-Forwarded-For spoofing.**
  Railway sits in front as a single proxy hop but does not strip an
  inbound `X-Forwarded-For` before appending its own, so with
  `trust proxy: 1` an attacker-supplied value survived as `req.ip`.
  Confirmed live against production: a fixed spoofed IP correctly got
  rate-limited around request 13; rotating the header on every request
  produced zero blocks across 25 failed logins. The auth rate limiter
  (`backend/src/routes/auth.ts`) now keys on the submitted email instead
  of the request IP, so brute-forcing one account can't be sped up by
  claiming a new IP for every attempt.
- **Security (Low, documented, not changed): `/register` reveals whether
  an email is already registered** (409 vs. other statuses), unlike
  `/forgot-password`, which deliberately returns the same response either
  way. This is standard, expected behavior for registration flows
  industry-wide (GitHub, Google, etc. all do the same) - going silent
  here would materially hurt legitimate users who mistype "sign up" for
  "log in." Noting it for the record rather than changing it.
- **Fixed**: `Cargo.toml`'s `description` was still the Tauri template's
  "A Tauri App," visible in the installed exe's file Properties. Bundle
  now also sets `publisher` and `copyright`, previously unset.
- Also verified during this pass and found clean: every SQL query is
  parameterized (tested directly with classic and UNION-based injection
  payloads against `/login`), JWTs reject an `alg: none` forgery attempt,
  the Stripe checkout price/plan is resolved server-side only (the client
  cannot influence the amount charged), no webhook, deploy key, or branch
  protection gap on the GitHub repo, and no debug/admin endpoint exposed
  on the live backend.

## v0.4.0 — 2026-08-07

- **Added: in-app auto-update.** The app checks GitHub once at startup for
  a newer build and, when one exists, offers it in a small card: download,
  install, and restart in one click, with live progress. Updates are
  cryptographically signed (minisign via Tauri's updater) and the app
  verifies the signature before installing — a tampered or unsigned
  binary is rejected. A failed background check stays silent on purpose:
  offline starts and dev builds are not actionable. Fully localized in
  all five languages. Requires this release's installer once; every
  version after this one arrives by itself.
- Ships everything in the 2026-08-06 entry below (honest scan, corrected
  CPU-priority description, security hardening, English-only sweep,
  window minimum size, real favicon).

## 2026-08-06

- **Changed**: the Quick Scan no longer counts UI tweaks (dark mode,
  taskbar alignment, hidden files...) as issues. Cosmetic preferences are
  not "problems" a PC health scan can honestly claim to have found —
  counting them inflates the issue count exactly the way the snake-oil
  cleaners this app defines itself against do. They remain fully available
  under their own UI section; the scan now only reports performance,
  privacy, gaming, and maintenance items.
- **Fixed (wrong description in all five languages)**: "Optimize CPU
  priority" claimed it tunes Win32PrioritySeparation "to favor background
  services" — the value it actually writes (0x26) does the opposite: short,
  variable CPU time slices with a 3x boost for the foreground app, the
  classic desktop/gaming responsiveness setting. The description now says
  what the tweak does.
- **Security**: drive letters are validated at every entry point (both the
  `invoke` commands and the elevated `--elevated-diskopt` CLI flag) before
  reaching a PowerShell command line or defrag's argv, with unit tests
  covering the injection payloads; an explicit CSP replaces the null
  default (self-only assets, network restricted to the backend and
  api.pwnedpasswords.com); backend CORS now defaults to the Tauri webview
  origins instead of any origin.
- **Changed**: window gets a sensible minimum size (760x560) so the
  sidebar layout can't collapse; the template favicon and page title
  (vite.svg / "Tauri + React + Typescript") are replaced with the real
  app icon and name.
- **Changed**: the remaining Italian text anywhere user-visible was
  translated: six Rust rollback error messages, one backend comment
  block, the to-publish README, and the Italian entries in this changelog.

## Marketing — 2026-08-06

- **Added**: every Short published to YouTube now gets its own thumbnail,
  generated with ffmpeg from its FIRST frame (which already carries the
  hook card, with no subtitles overlaid). Previously YouTube picked one
  from a random frame: verified by downloading the actual thumbnails, they
  came out as mid-video freeze frames with subtitle fragments cut off
  mid-word on top. The thumbnail is invisible in the Shorts feed, but it
  shows in the channel grid and in search — exactly where a visitor
  decides whether to subscribe. Format chosen after testing directly on
  YouTube: 1280x720 with the sharp frame in the central 9:16 column (the
  only zone that survives both the 16:9 view and the grid's vertical
  crop) and the same frame blurred to fill the sides — uploading the
  1080x1920 vertical directly, YouTube wedges it into a 16:9 with two
  large black bars. The same change was applied in parallel to the other
  7 YouTube channels. `marketing/youtube-upload/lib.js`.

## v0.3.0 — 2026-08-04

- **Changed**: toggle switches are now a compact 20×36px pill with an
  "On"/"Off" caption — matching Windows 11's own Settings app — instead of
  the oversized 32×56px iOS-style switch used before.
- **Added — Optimize drive**: runs Windows' own built-in optimizer (TRIM on
  an SSD, defragmentation on an HDD, never a full defrag pass on an SSD,
  which would only wear it out for no benefit).
- **Added — Flush DNS cache**: free, no elevation needed.
- **Added — Find large files**: same scan/select/move-to-Recycle-Bin flow as
  the existing duplicate finder, but by a 100 MB size threshold — a single
  large forgotten file has no duplicate to find, but is easy to spot once
  sorted by size.
- **Added — Drive health**: reads Windows' own S.M.A.R.T./reliability
  HealthStatus for the selected drive.
- **Added**: a real drive picker for Drive health and Optimize drive, backed
  by the actual disks on the machine — previously both were silently
  hardcoded to the system drive with no way to check or optimize a second
  HDD/SSD.
- **Fixed**: a real bug caught during live testing — "Optimize drive"
  initially called `defrag` directly without going through the app's
  elevation flow, so it only ever worked when the whole app process happened
  to already be running elevated. A normal user's click, from an unelevated
  install, would have failed outright with no UAC prompt ever shown. Now
  wired through the same proven single-UAC-prompt pattern used everywhere
  else in the app (`is_elevated()` check → elevated relaunch → result handed
  back through a temp file).
- **Fixed**: roughly 30 leftover Italian error strings scattered across
  `dns.rs`, `elevation.rs`, `gaming.rs`, `power.rs`, `services.rs`,
  `tweaks.rs` and others — mostly on failure branches ("unexpected snapshot
  type", "not supported on this platform") that earlier passes over the
  Rust-side fallback text had missed.

## v0.2.0 — 2026-08-04

Released. `v0.1.1` stays published and downloadable so existing download
links keep working until they are pointed here.

- **Fixed**: the account menu's **Themes** heading was English in all five
  languages, and `Scan` / `Performance` / `UI` were untranslated in
  it/fr/es/de. `check-i18n.mjs` could never catch this — it proves keys
  *exist* with matching placeholders, and a string copy-pasted from English
  passes that happily. New `scripts/audit-i18n.mjs` flags anything
  byte-identical to English, ASCII stand-ins where a language needs an accent,
  and Spanish text missing its opening `¿`/`¡`. Words that genuinely are the
  same (Admin, PRO, START, Turbo Boost, Account, Plan, Email, Password) sit on
  an explicit reviewed list, so adding one is a deliberate statement that a
  human looked at it. Wired into `npm run check` and CI.
- **Fixed**: automatic RAM cleanup silently stopped the moment the user left
  the Scan tab, because the timer lived in a component that only renders
  there. The scheduler now lives at app level, and the manual button and the
  timer share one in-flight guard so two passes can never race.
- **Fixed**: `POST /api/auth/resend-verification` answered a bare **500**
  whenever the mail provider refused, telling the user nothing actionable. It
  now separates a rejected recipient (**400** — "check the address is
  correct") from a provider outage or our own quota/credential problem
  (**502** — "try again shortly"). Registration reports
  `verificationEmailSent` instead of swallowing the failure, so nobody is left
  waiting for a message that was never going to arrive. Writing the tests for
  this caught a second defect before it shipped: HTTP 429 — *our* sending
  quota — was being blamed on the recipient's address.
- **Added**: `backend/scripts/smoke-test.mjs`, a committed **36-check
  end-to-end test** of the real customer path (register → verify → log in →
  reset → revoke → checkout) plus the failure modes that matter, including
  email enumeration and reset-form XSS. `npm run smoke`. Backend unit tests
  (`npm test`) now run in CI too.
- **UI**: the account dropdown covered most of a small window — it is now
  narrower with tighter sections, and the ten themes are swatches instead of a
  labelled two-column grid. The signed-in row is an avatar, the address and a
  verification badge rather than a line of status text, and **Plan** gets the
  same gold treatment as the sidebar when the account is Pro.

## 2026-08-04

- **Fixed (translations, the real cause)**: the Scan screen listed every
  optimization using the raw English name baked into the Rust structs
  instead of the translated one, so an Italian user scanning their PC got an
  English checklist. `textFor` — the helper the rest of the UI already used —
  is now module-level and the Scan list goes through it. Three related leaks
  fixed at the same time: the Rust-side fallback texts (tweak names, cleanup
  names, and ~30 error messages) were written in Italian, which meant a
  missing translation surfaced as an *Italian* row in an English UI; and the
  `Scan` / `Performance` / `UI` sidebar labels were never translated in
  it/fr/es/de. All of it is now English at the source, translated in the
  five locales.
- **Guarded**: a new Rust test, `every_id_is_translated_in_every_language`,
  reads `src/i18n.ts` and fails the build if any tweak or cleanup id is
  missing from any of the five locales. Proven to work before trusting it:
  deleting one Italian entry made it fail with
  `dark_mode (translated in 4/5 languages)`. It immediately caught all 11
  new tweaks below, which is exactly the class of bug that shipped before.
- **Changed**: the app now always **opens in English**, whatever the Windows
  locale says; language is only ever changed by an explicit choice in the
  menu (and remembered from then on). Auto-detecting meant an Italian
  Windows silently got the Italian build, which made an international
  product feel region-specific.
- **Added — Free up RAM**, with an optional schedule (every 10 min / 30 min /
  1 h / 3 h / 6 h). It asks Windows to page out the unused part of every
  process's working set — the same thing Windows does under memory pressure,
  requested early — so it is safe to run as often as you like. Verified on a
  real machine: **2.80 GB freed**, memory use dropped 51% → 42%. Two bugs
  were designed out rather than shipped: `freed_bytes` is a saturating
  subtraction (memory use can legitimately *grow* between the two samples,
  and an unchecked `u64` would have reported ~18 exabytes freed), and the
  scheduler reads its callback through a ref — depending on it directly
  would have rebuilt the interval on every parent render, so a 10-minute
  timer would have restarted forever and never actually fired.
- **Added — Restore all**: one button, next to the tweak tally, that reverts
  every applied optimization at once. It goes through a new batched
  `rollback_tweaks` command, so undoing a dozen admin-level tweaks costs
  **one** UAC prompt rather than a dozen — the same batching `apply_tweaks`
  already did for the Scan's "fix all".
- **Added — 11 new tweaks (25 → 36 total)**: remove the ~10s startup-app
  delay, instant menu response, disable CPU power throttling, raise GPU
  priority for games, disable tailored experiences, stop app-launch
  tracking, stop feedback prompts, disable Cortana, always show file
  extensions (worth it for safety alone — it exposes `invoice.pdf.exe`),
  hide taskbar Widgets, and disable transparency effects. A new test,
  `no_two_tweaks_write_the_same_registry_value`, prevents the nastiest
  version of getting this wrong: two tweaks pointing at one registry value
  would snapshot each other's *new* value as the original, so rolling back
  would restore the wrong thing — and the ids being different means the
  existing uniqueness test would never notice. Also proven by deliberately
  introducing a collision and watching it fail.
- **Fixed**: the pricing page advertised "20 real tweaks" on the Free plan —
  hardcoded copy that had quietly become false. The number is now derived
  from the actual tweak list (currently 28 free), in all five languages, so
  it cannot go stale again.
- **UI**: "Fix all" moved to the *top* of the scan results (after a scan you
  want to act, not scroll a checklist to find the button), followed by a
  short progress fill and an explicit **Done!** screen. The Pro plan card in
  the sidebar now gets a gold gradient frame, glow and crown instead of the
  same flat chip a Free account sees — paying should look like it bought
  something. Free deliberately stays plain.

## 2026-08-03

- **Fixed (marketing/youtube-upload)**: a title with an apostrophe baked
  into the long-form card (via `bakeThumbnailCard`, added the same day to
  work around the thumbnail block on accounts without a verified phone)
  came out as "HERES WHAT HAPPENED" instead of "Here's What Happened" -
  the apostrophe was being stripped from the text before it reached the
  `drawtext` filter. A first escaping attempt (`'\''`, the standard syntax
  for a literal quote inside a single-quoted value in ffmpeg filters) was
  discarded after verifying it on a real render: it broke the parsing of
  the entire filterchain, making the next `drawtext`'s parameters show up
  as literal text on screen - worse than the original defect. Robust fix:
  the text now goes into a temporary file and the filter uses `textfile=`
  instead of `text=`, which reads the content as-is without any escape
  parsing - an apostrophe in the file is just a character, not syntax.
  Re-verified on a real render: "HERE'S WHAT HAPPENED" correct, no filter
  corruption.
- **Added**: a **Plans & pricing** screen, and with it Pro moves from a
  one-time purchase to a subscription: **€9.99/month** or **€59/year**. The
  yearly plan is the promotion — it works out to €4.92/month, a real 51% off,
  and the badge is computed from the two prices rather than hardcoded, so it
  can't drift away from what's actually charged.
- **Backend**: checkout now takes a `plan` and opens a Stripe *subscription*
  (the legacy one-time price still works for anyone who already bought it).
  Needs two new recurring prices: `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`.
  - The webhook now also handles `customer.subscription.deleted` and
    `.updated`. **Without this a user who cancels keeps Pro forever** — the
    single most expensive bug a subscription can have. Users are matched back
    from Stripe events via metadata stamped at checkout, with the stored
    `stripe_customer_id` as a fallback (new column, uniquely indexed).
  - Webhook handler failures are logged and acknowledged rather than
    returning an error, so a bug on our side can't make Stripe replay the
    same event forever.
- **Fixed (false pricing claim)**: the paywall still promised "one-time
  payment, no subscription" in all five languages — untrue the moment Pro
  became a subscription. Rewritten, and its button now opens the pricing
  screen so people choose a plan instead of being sent straight into a
  checkout for one they never picked.
- **Fixed**: picking **Monthly** displayed "one charge of €59 per year" under
  the €9.99 price — not what that customer is charged. Each option now
  carries its own truthful line: yearly shows the per-month equivalent plus
  the real annual charge, monthly shows what the yearly plan would cost.
- **Fixed**: the Free card told Pro subscribers "you're on the Free plan",
  which reads like a failed payment.
- **Added**: **search across every tweak** in the header. With 25 tweaks,
  finding one meant knowing its category first; search ignores the selected
  section and looks everywhere (Esc clears it).
- **Fixed**: Italian typo in the pricing subtitle ("in piu'" → "in più").

## 2026-08-02

- **Changed (marketing/reel-generator)**: hook pools widened from 4-5 to
  10 per category (13 -> 30 total). An audit over 300 generations had
  counted only 5 distinct hooks per category: now that the hook is also
  the hook-card text in the first frame, it is the most visible element of
  the video, so repeating every 5 videos costs far more than before. The
  archetypes are deliberately different (first person / consequence / POV /
  concrete number / myth to debunk), not variations of the same sentence.
  Re-verified downstream: 30 distinct hooks, zero defects on length,
  double spaces, or duplicated CTAs.
- **Fixed (marketing/reel-generator)**: Reels showed a meaningless
  fragment in the first frame. Captions are synced 2 words at a time, so
  frame 0 literally read "This is" over a near-black background — in
  precisely the 3 seconds where the viewer decides whether to stay. The
  2026 research is clear-cut: below 80% retention in the first 3 seconds
  the video dies in the cold start and never gets distributed, which
  matches the numbers observed (10-180 views, reach ~= views). Added a
  **hook card** that shows the COMPLETE promise line already readable in
  the first frame, with no entrance animation (a fade costs exactly the
  milliseconds that matter). Captions and the lower band start after the
  card, otherwise two overlapping boxes say the same thing and the video
  looks amateurish. Verified by extracting frame 0 of an actually
  produced Reel.
- **Fixed (marketing/reel-generator)**: `footage.py` always asked Pexels
  for page 1 only, so every video for a given query drew from the same 20
  most popular clips — exactly the ones used by thousands of other
  creators (downranked as "Low Value Content") and the cause of the
  repetition between one video and the next. Now a random page 1-5: the
  pool grows from 20 to 100 clips. Verified against the real API that
  different pages return completely disjoint ids.
- **Added (marketing/youtube-upload)**: custom thumbnail for the
  long-form compilations. Previously none was set, so YouTube picked one
  from a random frame (typically half of a subtitle word): on a long
  video the thumbnail is THE click lever. Generated with ffmpeg (no npm
  dependency added): blurred and darkened frame + large title + accent
  bar. `uploadVideo` now accepts a `thumbnailPath` and never fails if the
  API rejects it (the channel needs a verified phone).
  - Technical note: the font path must be escaped (`C\:/...`) because in
    ffmpeg filters the colon separates options — without it, the whole
    filterchain fails with "Error parsing filterchain" even inside quotes.
- **Changed (marketing/youtube-upload)**: compilation titles now draw
  from a pool of 5 variants instead of being a fixed string —
  near-duplicate titles cannibalize each other in YouTube search. API
  tags go from 5 to 12: they are a separate channel from the visible
  hashtags and the field holds ~500 characters, it was largely
  underused.
- **Changed (marketing/reel-generator)**: added save/share-oriented CTAs
  to the existing pool (which was only "link in bio") — in the 2026
  ranking a DM share is worth 3-10x a like and saves ~5x.

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
  - "Hide the search box from the taskbar" (Free, UI).
  - "Disable fullscreen optimizations globally" (Free, Gaming) —
    DXGI honor-FSE registry fix for reduced stutter/input lag in older games.
  - "Disable the indexing service (Windows Search)" (Pro,
    Maintenance) — the app's first service-level tweak (stop + disable via
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
  - *Gaming*: "Disable multimedia network throttling" (MMCSS
    NetworkThrottlingIndex, Free), "Maximize responsiveness for foreground
    apps" (SystemResponsiveness, Free), "Maximum priority for games" —
    bundles GPU/CPU/scheduling priority for the Games task profile (Pro).
  - *UI*: "Align the taskbar to the left" (Free), "Hide Chat/Teams from
    the taskbar" (Free).
  - *Privacy*: "Disable Start menu suggestions and recommended apps"
    (Free), "Disable activity history (Windows Timeline)" — 3 bundled
    policy values (Pro).
  - Pro/Free calls were made per tweak: single simple values stayed Free
    (consistent with the existing free tweaks), multi-value bundled presets
    went Pro (consistent with Turbo Gaming).
  - Caught a real, reproducible bug during verification: "Hide Widgets
    from the taskbar" (`TaskbarDa`) returns Access Denied even
    from a fully elevated Administrator process — a genuine Windows 11
    restriction on that specific value, not a bug in our code (confirmed by
    testing a direct `Set-ItemProperty` from the same elevated shell, and a
    Group-Policy-backed alternative path, both denied). Dropped that tweak
    and shipped "Align the taskbar to the left" instead,
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
