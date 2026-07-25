# PC Tweaker

A desktop app for Windows (macOS planned) that applies system tweaks —
performance, privacy, gaming, maintenance — with **automatic rollback**:
every change saves the original value before it's applied, so you can always
revert it with one click.

> Status: working prototype, actively developed — see [Download](#download)
> below.

## What it does

Every tweak is real (no fake placeholders): it reads/writes the Windows
registry, the power plan, network DNS, or cleans up files — always with a
snapshot of the previous state saved for rollback.

- **Performance** — CPU priority, "High performance" power plan, disabling
  Xbox Game Bar/Game DVR
- **Gaming** — Hardware-accelerated GPU Scheduling (HAGS), reduced input lag
  (disables pointer acceleration), CPU Turbo Boost, a "Turbo Gaming" preset
  that bundles all of the above
- **Privacy** — disabling the advertising ID, location tracking, Bing search
  in the Start menu, reduced telemetry, private DNS (Cloudflare)
- **Maintenance** — cleaning temp files and the Windows Update cache (moved
  to the Recycle Bin, never permanently deleted), duplicate file finder by
  content hash with manual review before deletion
- **UI** — dark mode, show hidden files

Any tweak that needs administrator rights asks for an explicit UAC prompt
**only for that action** — the app itself always runs unprivileged.

## Multi-language and themes

The interface is available in **English, Italian, French, Spanish, and
German**, with 10+ color themes selectable from the account menu.

## Free / Pro model

Single tweaks are free; advanced tweaks and batch presets are Pro — a
one-time payment, no subscription (via Stripe Checkout). Email/password
accounts sync Pro status across installs.

## Download

**via winget** (recommended — no SmartScreen prompt to click through):

```bash
winget install AurelioAvila.PCTweaker
```

*(Package submitted to the community [winget-pkgs](https://github.com/microsoft/winget-pkgs)
repo — [PR #407687](https://github.com/microsoft/winget-pkgs/pull/407687).
Until it's merged, install directly from the release below.)*

**[⬇ Or download the latest release (v0.1.0)](../../releases/latest)** —
`.msi` or `.exe` installer for Windows x64.

The installer isn't code-signed yet (Authenticode) — Windows SmartScreen
will show a warning ("Windows protected your PC") on first run when
installed this way: that's expected for an unsigned executable, click
"More info" → "Run anyway".

Next step for wider distribution: sign the package with an Authenticode
certificate to remove the SmartScreen warning entirely.

## Development

```bash
npm install
npm run tauri dev     # run the app in development mode
npm run tauri build   # produce the .msi/.exe installer in src-tauri/target/release/bundle/
```

Requires Rust (via [rustup](https://rustup.rs)) and, on Windows, the
[Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
with the "Desktop development with C++" workload.

## Backend

The Node.js/Express backend for accounts and Stripe payments lives in
[`backend/`](backend/) — see [`backend/README.md`](backend/README.md) for
Railway deployment and Stripe setup instructions.

## Tech stack

[Tauri 2](https://tauri.app) (Rust) · React + TypeScript · Tailwind CSS 4 ·
Express + PostgreSQL + Stripe (backend)

## License

[MIT](LICENSE)
