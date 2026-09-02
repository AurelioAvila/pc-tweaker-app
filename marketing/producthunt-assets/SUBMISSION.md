# PC Tweaker — Product Hunt & AlternativeTo submission kit

Everything below is copy-paste ready. Screenshots for the gallery are in this
same folder (`01-scan.png` … `05-maintenance.png`), plus `app_icon_1024.png`
(also in `marketing/tiktok-upload/`) for the logo/thumbnail slot.

---

## Product Hunt

**Tagline** (max 60 characters):
> Real Windows tweaks with one-click rollback, not placebo cleaners

**Topics/categories to select:** Windows, Productivity, Developer Tools, Tech

**Links**
- Website: https://github.com/AurelioAvila/pc-tweaker-app
- Download (winget): `winget install AurelioAvila.PCTweaker`

**Description** (main body):

> PC Tweaker applies real Windows tweaks — registry, power plan, network DNS,
> services, files — across five categories: Performance, Gaming, Privacy,
> Maintenance, and Interface. Nothing is simulated.
>
> The one thing that's different from the usual "PC cleaner" apps: every
> single tweak snapshots the original value before it touches anything, so
> it can be reverted with one click — or all 36 at once with "Restore all".
> Admin-required tweaks batch behind a single UAC prompt instead of asking
> once per toggle.
>
> Highlights:
> - One-click **Scan** that tells you what's not optimized yet
> - **Turbo Gaming** preset + Game Sessions (auto-applies when a game
>   launches, auto-reverts when it closes)
> - Password breach check via Have I Been Pwned (k-anonymity, your password
>   never leaves your machine in full)
> - Real disk tools: SSD-safe TRIM/defrag, drive health (S.M.A.R.T.), large
>   file finder, duplicate file finder
> - Free tier covers the basics; Pro (€9.99/mo or €59/yr) unlocks the rest
>
> Built solo, Tauri (Rust) + React. Also on winget:
> `winget install AurelioAvila.PCTweaker`

**First comment (post as the maker right after launch):**

> Hey Product Hunt 👋
>
> I built PC Tweaker because every "PC optimizer" I'd used either did
> nothing measurable or changed things I couldn't easily undo. So the one
> rule I held myself to: every tweak snapshots the previous value first,
> full stop — that's the whole premise of the app.
>
> It's a small Windows app (~2MB installer), free tier included, no account
> required to try it. Would love feedback, especially on which tweaks you'd
> want to see next — I'm actively building this.

**Gallery image order:**
1. `01-scan.png` — Scan / live system monitor (best first impression)
2. `02-performance.png` — Performance tweaks, shows the toggle style
3. `05-maintenance.png` — Disk tools (Drive health, Optimize drive)
4. `03-gaming.png` — Gaming presets + Turbo Boost
5. `04-privacy.png` — Privacy tweaks

---

## AlternativeTo

**App name:** PC Tweaker

**Short description** (1-2 sentences, shown in search results):
> Windows performance, privacy, gaming and maintenance tweaks with automatic
> one-click rollback — every change snapshots the original value first.

**Long description:** reuse the Product Hunt description above.

**Categories/tags:** System Tools, Privacy, Windows, Optimization,
Registry Editors, Gaming

**"Alternative to" — link it against these existing listings:**
- CCleaner
- O&O ShutUp10++
- Advanced SystemCare
- Glary Utilities
- WiseCare 365

For each, when AlternativeTo asks "why is this an alternative", use:
> Unlike most PC cleaners, every tweak here snapshots the original value
> before changing it, so anything can be reverted individually or all at
> once — not just a one-way "optimize" button.

**Platform:** Windows

**License:** Proprietary (Freemium — free tier + paid Pro tier,
€9.99/mo or €59/yr)

**Official website:** https://github.com/AurelioAvila/pc-tweaker-app

**Download link:** https://github.com/AurelioAvila/pc-tweaker-app/releases/latest

**Icon to upload:** `app_icon_1024.png`

**Screenshots to upload:** same 5 files, same order as Product Hunt above.
