# YouTube upload — copy-paste kit

Video file: `pc-tweaker-youtube.mp4` (1920x1080, 1:26, 27.6 MB)

---

## Title (pick one)

- PC Tweaker — 36 real Windows tweaks, all undoable in one click
- I built a Windows tweaker where every change can be undone

## Description

```
PC Tweaker applies real Windows tweaks — registry, power plan, network DNS,
services and files — across Performance, Gaming, Privacy, Maintenance and
Interface. Nothing here is simulated.

The rule I held myself to: every single tweak snapshots the original value
before it touches anything, so any of it can be reverted with one click, or
all of it at once with "Restore all". Tweaks that need administrator rights
batch behind a single UAC prompt instead of asking once per toggle.

In this video:
- One-click Scan and a live CPU / memory / disk monitor
- Free up RAM, with an optional automatic schedule
- Performance: CPU priority, power plan, the ~10s startup app delay
- Gaming: Turbo Boost, HAGS, input lag, and Game Sessions that apply the
  preset automatically when a game launches and revert when it closes
- Privacy: telemetry, tracking, Cortana, private DNS, and a password breach
  check that never sends your password in full (k-anonymity, same standard
  as Have I Been Pwned)
- Maintenance: drive health, SSD-safe optimize (TRIM on SSD, defrag on HDD),
  duplicate and large file finders, temp and Windows Update cache cleanup
- 5 languages and 10 color themes

DOWNLOAD (free tier included)
winget install AurelioAvila.PCTweaker
https://sourceforge.net/projects/pc-tweaker/
https://github.com/AurelioAvila/pc-tweaker-app

Windows 10 and 11, x64. Built solo with Tauri (Rust) and React.

Chapters
0:00 Intro, languages and live monitor
0:20 Performance and gaming
0:44 Privacy and password breach check
0:57 Windows UI and maintenance
1:11 Rollback, pricing and download

Music: "Inspired" by Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0
https://creativecommons.org/licenses/by/4.0/
```

## Notes

- The chapters above are the real cut points, and each one is longer than the
  10 seconds YouTube requires — paste them as-is and YouTube will turn them
  into a chapter bar. Shorter chapters would be silently ignored.
- The CC BY licence on the track makes the attribution mandatory, not
  optional. It is already burned into the outro card, and the line in the
  description covers you a second time.
- Thumbnail: `01-scan.png` or `05-maintenance.png` in this folder both work.
  Add large text over it — YouTube thumbnails are read at postage-stamp size.

---

## Dev Hunt (devhunt.org)

Same material as `SUBMISSION.md` works there. Dev Hunt is developer-tool
focused, so lead with the technical angle rather than the consumer one:

**Tagline:** Windows tweaker in Rust where every change is revertible

**Description:** reuse the Product Hunt one from `SUBMISSION.md`, and mention
the stack (Tauri 2 + Rust backend, React/TypeScript frontend, Node/Express
API) — that audience cares about it.
