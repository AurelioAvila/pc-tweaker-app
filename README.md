# PC Tweaker

A Windows desktop app that applies real system tweaks — performance, gaming,
privacy, maintenance — with **automatic rollback**: every change saves the
original value before it is applied, so any of it can be undone with one
click, or all of it at once.

[![winget](https://img.shields.io/winget/v/AurelioAvila.PCTweaker?label=winget&color=blue)](https://winstall.app/apps/AurelioAvila.PCTweaker)

**[⬇ Download for Windows](../../releases/latest)** · [Changelog](CHANGELOG.md) ·
[Privacy Policy](PRIVACY.md) · [Terms](TERMS.md)

## Demo

[Watch the PC Tweaker demo on YouTube](https://www.youtube.com/watch?v=d1_DD49HhAU)

---

## What it does

Nothing here is a placeholder. Every tweak reads and writes the real Windows
registry, power plan, network DNS, services or files — and always snapshots
the previous state first.

**One-click Scan** checks the machine and lists what is not optimized yet.
"Fix all" applies everything selected behind a **single UAC prompt**, not one
per tweak.

| Section | What's in it |
| --- | --- |
| **Performance** | CPU priority, High-performance power plan, disable Xbox Game Bar/Game DVR, remove the ~10s startup-app delay, instant menu response, disable CPU power throttling |
| **Gaming** | Hardware-accelerated GPU Scheduling (HAGS), reduced mouse and keyboard input lag, CPU Turbo Boost, higher GPU priority for games, disable multimedia network throttling, "Turbo Gaming" preset, and Game Sessions — apply the preset automatically when a game launches, revert when it closes |
| **Privacy** | Disable the advertising ID, location tracking, Bing search in Start, activity history, tailored experiences, app-launch tracking, feedback prompts, Cortana; reduced telemetry; private DNS (Cloudflare); password breach check via [Have I Been Pwned](https://haveibeenpwned.com) |
| **Maintenance** | Clean temp files and the Windows Update cache (moved to the Recycle Bin, never permanently deleted), duplicate file finder by content hash with manual review before deletion, disable the search indexing service |
| **Interface** | Dark mode, show hidden files, always show file extensions, left-aligned taskbar, hide Chat/Widgets/search box, disable transparency effects |

Plus, on the Scan screen:

- **Live system monitor** — CPU, memory and disk usage, updated continuously
- **Free up RAM** — asks Windows to release memory programs are holding but
  not using; can be scheduled every 10 min / 30 min / 1 h / 3 h / 6 h
- **Startup manager** — see and disable the programs that launch at boot

**36 tweaks** in total. Anything needing administrator rights asks for an
explicit UAC prompt **only for that action** — the app itself always runs
unprivileged.

## Safety

- Every change is snapshotted before it is applied, and revertible
  individually or all at once via **Restore all**
- Cleanup moves files to the Recycle Bin — nothing is permanently deleted
- The tweaks themselves never send data anywhere; the optional account exists
  only to sync Pro status across installs

## Languages and themes

English (default), Italian, French, Spanish and German, with 10 color themes.
The app always starts in English; the language is only ever changed by an
explicit choice in the account menu, and remembered from then on.

## Free / Pro

28 tweaks are **free, forever**. Pro unlocks the advanced tweaks and presets:

| Plan | Price |
| --- | --- |
| Monthly | €9.99 / month |
| **Annual** | **€59 / year** — €4.92/month, 51% off |

Payments are handled by Stripe Checkout; the app never sees card details.
An email/password account syncs Pro status across installs.

## Download

**via winget** (recommended — no SmartScreen prompt to click through):

```bash
winget install AurelioAvila.PCTweaker
```

*(Published in the community [winget-pkgs](https://github.com/microsoft/winget-pkgs)
repo — [PR #407687](https://github.com/microsoft/winget-pkgs/pull/407687).
Package indexes refresh every few hours, so it may take a little while to
show up after a fresh install of winget.)*

**[⬇ Latest release](../../releases/latest)** — `.exe` or `.msi` installer for
Windows 10/11 x64.

The installer is not code-signed yet (Authenticode), so Windows SmartScreen
shows a "Windows protected your PC" warning on first run: click **More
info** → **Run anyway**. Signing the package is the next step for wider
distribution.

## Development

```bash
npm install
npm run tauri dev     # run the app in development mode
npm run tauri build   # build the .msi/.exe installers into src-tauri/target/release/bundle/
```

Requires Rust (via [rustup](https://rustup.rs)) and, on Windows, the
[Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
with the "Desktop development with C++" workload.

### Checks

```bash
npm run check
```

Runs, and CI runs on every push:

| Check | What it guarantees |
| --- | --- |
| `tsc --noEmit` | The frontend type-checks |
| `check:i18n` | Every string exists in all 5 languages with matching `{placeholders}` |
| `check:i18n-quality` | Nothing was silently left in English, no missing accents, correct Spanish punctuation |
| `check:rust` | 24 Rust unit tests — rollback-store concurrency, locale-independent parsing of Windows CLI output, elevation batching, registry-value collisions, translation coverage |

The backend has its own suites:

```bash
cd backend
npm test    # unit tests
npm run smoke   # 36-check end-to-end test against the live API
```

## Backend

The Node.js/Express backend for accounts and Stripe subscriptions lives in
[`backend/`](backend/) — see [`backend/README.md`](backend/README.md) for
Railway deployment and Stripe setup.

## Tech stack

[Tauri 2](https://tauri.app) (Rust) · React + TypeScript · Tailwind CSS 4 ·
Express + PostgreSQL + Stripe

## License

[MIT](LICENSE)
