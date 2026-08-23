<p align="center">
  <img src="src-tauri/icons/icon.png" width="112" alt="PC Tweaker logo">
</p>

<h1 align="center">PC Tweaker</h1>

<p align="center">
  <strong>A safer way to tune your Windows PC.</strong><br>
  Performance, gaming, privacy and maintenance — with automatic rollback for every change.
</p>

<p align="center">
  <a href="#safe-download-recommended"><img src="https://img.shields.io/badge/SAFE_DOWNLOAD-No_SmartScreen_warning-1793D1?style=for-the-badge&logo=windowsterminal&logoColor=white" alt="Safe download via winget, no SmartScreen warning"></a>
</p>

<a id="safe-download-recommended"></a>

## 🛡️ Safe download (recommended)

One command, installs straight from the official [winget-pkgs](https://github.com/microsoft/winget-pkgs)
repository — Microsoft's own package index, so **no SmartScreen popup**:

```powershell
winget install AurelioAvila.PCTweaker
```

Click the copy icon on the block above, paste into a terminal (PowerShell,
Windows Terminal, or `Win+R` → `cmd`), hit enter. That's it — this is the
same command GitHub's copy button hands you, no separate download page
needed.

*(New installs of winget or a brand-new release can take a few hours for
Microsoft's package index to refresh — if the command says the package
isn't found yet, try again shortly or use the [.exe/.msi installer](../../releases/latest) below in the meantime.)*

<p align="center">
  <a href="../../releases/latest"><img src="https://img.shields.io/badge/Download-Windows%2010%2F11-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Download for Windows"></a>
  <a href="https://github.com/AurelioAvila/pc-tweaker-app/blob/master/LICENSE"><img src="https://img.shields.io/badge/License-Proprietary-6B7280?style=for-the-badge" alt="Proprietary License"></a>
  <a href="https://github.com/AurelioAvila/pc-tweaker-app/releases"><img src="https://img.shields.io/github/v/release/AurelioAvila/pc-tweaker-app?display_name=tag&style=for-the-badge&color=7C3AED" alt="Latest release"></a>
  <a href="https://winstall.app/apps/AurelioAvila.PCTweaker"><img src="https://img.shields.io/winget/v/AurelioAvila.PCTweaker?style=for-the-badge&label=winget&color=1793D1" alt="winget"></a>
  <a href="https://www.majorgeeks.com/files/details/pc_tweaker.html"><img src="https://img.shields.io/badge/MajorGeeks-4.0%2F5.0-2E7D32?style=for-the-badge" alt="4 out of 5 stars on MajorGeeks"></a>
  <a href="https://www.softpedia.com/get/Tweak/System-Tweak/Avila-PC-Tweaker.shtml"><img src="https://img.shields.io/badge/Softpedia-Listed-00A99D?style=for-the-badge" alt="Listed on Softpedia"></a>
</p>

**[⬇ Download for Windows](../../releases/latest)** · [Changelog](CHANGELOG.md) ·
[Privacy Policy](PRIVACY.md) · [Terms](TERMS.md)

## Demo

<p align="center">
  <img src="Screenshot/scan_screenshot.png" alt="PC Tweaker Scan screen" width="82%">
</p>

> **Built to be reversible.** Every setting is backed up before it changes, so you can experiment with confidence and restore it whenever you want.

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
| **Gaming** | Hardware-accelerated GPU Scheduling (HAGS), reduced mouse and keyboard input lag, disable mouse acceleration, silence the Sticky Keys popup, CPU Turbo Boost, higher GPU priority for games, disable multimedia network throttling, disable Memory Integrity/VBS for the biggest frame-rate gain (with the security trade-off spelled out), "Turbo Gaming" preset, and Game Sessions — apply the preset automatically when a game launches, revert when it closes |
| **Privacy** | Disable Recall (the AI screen-snapshot history) and Windows Copilot, stop Windows silently installing "suggested" apps, stop it learning how you type; disable the advertising ID, location tracking, Bing search in Start, activity history, tailored experiences, app-launch tracking, feedback prompts, Cortana; reduced telemetry; private DNS (Cloudflare); password breach check via [Have I Been Pwned](https://haveibeenpwned.com) |
| **Maintenance** | Clean temp files and the Windows Update cache (moved to the Recycle Bin, never permanently deleted), duplicate file finder by content hash with manual review before deletion, disable the search indexing service |
| **Interface** | Bring back the full Windows 10 right-click menu, dark mode, show hidden files, always show file extensions, left-aligned taskbar, hide Chat/Widgets/search box, disable transparency effects |

Plus, on the Scan screen:

- **Live system monitor** — CPU, memory and disk usage, updated continuously
- **Free up RAM** — asks Windows to release memory programs are holding but
  not using; can be scheduled every 10 min / 30 min / 1 h / 3 h / 6 h
- **Startup manager** — see and disable the programs that launch at boot

**50 tweaks** in total. Anything needing administrator rights asks for an
explicit UAC prompt **only for that action** — the app itself always runs
unprivileged.

## Safety

- Every change is snapshotted before it is applied, and revertible
  individually or all at once via **Restore all**
- Cleanup moves files to the Recycle Bin — nothing is permanently deleted
- The tweaks themselves never send data anywhere; the optional account exists
  only to sync Pro status across installs

## Languages and themes

English (default), Italian, French, Spanish and German, with 14 color themes.
The app always starts in English; the language is only ever changed by an
explicit choice in the account menu, and remembered from then on.

## Free / Pro

33 tweaks are **free, forever**. Pro unlocks the advanced tweaks and presets:

| Plan | Price |
| --- | --- |
| Monthly | €9.99 / month |
| **Annual** | **€59 / year** — €4.92/month, 51% off |

Payments are handled by Stripe Checkout; the app never sees card details.
An email/password account syncs Pro status across installs.

## Download

Also independently reviewed and listed on [MajorGeeks](https://www.majorgeeks.com/files/details/pc_tweaker.html)
(4/5, "a usable, easy-to-use tool") and [Softpedia](https://www.softpedia.com/get/Tweak/System-Tweak/Avila-PC-Tweaker.shtml).

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
| `check:rust` | 78 Rust unit tests — rollback-store concurrency, locale-independent parsing of Windows CLI output, elevation batching, registry-value collisions, translation coverage |

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

Source-available for review. All rights reserved — see [LICENSE](LICENSE).
