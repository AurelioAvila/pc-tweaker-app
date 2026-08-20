# PC Tweaker Intelligence — Tweak Audit, Decision Matrix & Roadmap

_Date: 2026-08-20 · Scope: the ~46 shipped tweaks, candidate new tweaks, and the
"PC Tweaker Intelligence" product direction. Sources are official Microsoft
documentation unless noted._

---

## 1. Audit of existing tweaks

Classification of every shipped tweak. "Scan" = allowed in Quick Scan findings
(`recommend::is_scan_relevant` allowlist — this list is the enforcement point,
not the UI).

### Safe & Recommended (hardware-gated where noted)

| Tweak | Scan | Gate |
|---|---|---|
| priority_separation (Win32PrioritySeparation) | yes | — |
| system_responsiveness (MMCSS SystemResponsiveness) | yes | — |
| disable_startup_delay | yes | SSD/NVMe recommended |
| disable_background_apps | yes | — |
| disable_delivery_optimization | yes | — |
| network_throttling_index (MMCSS) | yes | — |
| network_latency (TCP ack/nodelay) | yes | — |
| power_plan_performance | yes | desktop only; NotRecommended on laptop |
| disable_power_throttling | yes | desktop only |
| All privacy toggles (telemetry tasks, activity history, tailored experiences, advertising id, location, Bing/Cortana/Copilot/Recall, suggestions, feedback) | **no** (by design) | privacy is a decision, not a "problem" |
| Explorer/UI preferences (dark mode, file extensions, hidden files, taskbar align/search/widgets/chat, classic context menu, transparency, animations, menu delays) | **no** (by design) | taste, not speed |

### Context-dependent

| Tweak | Why |
|---|---|
| disable_windows_search_service | Recommended on HDD, NotRecommended on NVMe (advice engine already encodes this) |
| disable_transparency | Recommended only on weak/integrated GPU |
| disable_mouse_acceleration | esports preference — correct for aim, wrong for desktop comfort |
| disable_game_dvr | costs recording capability the user may want |
| disable_sticky_keys_prompt, disable_fullscreen_optimizations_global | preference; FSO evidence is mixed per-game |

### Advanced / trade-off (explicit warning required)

| Tweak | Trade-off | Status |
|---|---|---|
| disable_memory_integrity | **reduces security** (VBS/HVCI off) for a small FPS gain on some titles | correctly excluded from Scan; **gap: the row shows no explicit security warning beyond its description → fix scheduled (1.1)** |
| hardware_gpu_scheduling | driver-dependent, needs reboot, gains not universal (build-gated ≥19041 today) | keep, add "requires reboot" note (1.1) |

### Deprecated / to hide

None removed for 1.0. `disable_drag_full_windows` and the menu/hover delay
tweaks are legacy-cosmetic but harmless and honestly described; they stay in
UI category (never counted as findings).

**Audit verdict**: coverage is already broad and honestly curated. The leap is
NOT more toggles — it is intelligence around the toggles (motivation, history,
reversibility, context). That is what the matrix below reflects.

---

## 2. Decision matrix — candidate new tweaks

Scale 1–5 (5 = best). Risk/Complexity: 5 = lowest. Verdict decided at my
discretion per the owner's mandate ("identitari e importanti, non cose inutili").

| Candidate | Impact | Differentiation | Risk | Complexity | Compatibility | Evidence | Verdict |
|---|---|---|---|---|---|---|---|
| **End Task on taskbar** (HKCU …\Explorer\Advanced\TaskbarDeveloperSettings\TaskbarEndTask) | 4 | 3 | 5 | 5 | Win11 23H2+ | MS Learn documented setting | **ADD — Free, release 1.1** (visible daily value) |
| **Per-app GPU preference** (HKCU …\DirectX\UserGpuPreferences) | 5 | 5 | 4 | 3 | Win10 1803+ | MS Learn "GPU preference" | **ADD — Pro, release 1.2** (pillar of per-game preferences) |
| **Per-app fullscreen-optimization opt-out** | 4 | 4 | 4 | 3 | Win10+ | MS dev docs | **ADD — Pro, release 1.2** (replaces the global toggle as the recommended path) |
| Quiet mode via powercfg (boost off / Efficiency overlay) | 4 | 4 | 4 | 3 | powercfg documented | MS powercfg docs | **ADD as part of Intent Profiles (1.1)** — not a standalone toggle |
| Timer resolution "0.5 ms" hack | 2 | 1 | 2 | 3 | broken by design on Win10 2004+ (per-process resolution) | MS changes to timer coalescing | **REJECT** — snake oil on modern Windows; rejecting it IS differentiation |
| Disable Nagle (TcpNoDelay reg on interfaces) | 2 | 1 | 2 | 4 | mixed, per-app sockets decide | no official endorsement | **REJECT** — unprovable promise |
| Storage Sense toggle | 2 | 1 | 5 | 5 | Win10+ | MS Learn | **REJECT** — Settings does it fine; zero identity |
| SvcHostSplitThreshold | 2 | 2 | 2 | 4 | undocumented behavior changes | none official | **REJECT** — stability risk without evidence |

---

## 3. Five initiatives, ordered by value

1. **Personal Advisor + Change Ledger** — one motivated recommendation with
   confidence and reversibility; a local, elegant history of every change with
   per-item revert. → **implemented in this slice (feature-flagged)**.
2. **Intent Profiles** (Play / Focus / Quiet / Download) — temporary modes with
   a mandatory preview of exactly what applies and full restore on session end.
   Built only from Safe/Advanced-classified mechanisms (powercfg, DO mode,
   existing tweaks). → 1.1.
3. **Startup Impact Report** — beyond the on/off list: publisher
   (Authenticode), scope, honest impact classes (no fabricated milliseconds),
   reversible suggestions. → 1.1.
4. **Configuration Drift** — detect when Windows Update/drivers/other software
   changed a value this app manages (re-read managed keys, diff against the
   ledger baseline), explain what changed, offer re-apply or accept. → 1.2.
5. **Per-app / per-game preferences + Health & Readiness** — the two Pro
   matrix additions above, plus a readiness board (disk space, startup load,
   pending reboot, config integrity) with no invented benchmarks. → 1.2.

## 4. Roadmap in three releases

- **1.0.0 "Control Room"** (now): visual identity (tokens, 14 themes),
  Command-center-informed home with Free RAM leading, main-thread perf fix,
  Advisor + Change Ledger slice, uninstaller cross-promo icon, local profile
  photo, Report an issue, error reporting (opt-in).
- **1.1.0 "Intelligence"**: Intent Profiles with preview/restore; Startup
  Impact Report; End Task tweak (Free); explicit Advanced-warning UI for
  security-reducing tweaks; Ledger v2 (before/after values surfaced from the
  rollback store; per-session undo).
- **1.2.0 "Guardian"**: Configuration Drift; per-app GPU / FSO preferences
  (Pro); Health & Readiness board; driver-aware notes for HAGS.

## 5. UX specification (new surfaces)

**Advisor card** (home, under System monitor): eyebrow "Recommended for your
PC" → tweak name + Admin/Pro badges → one-sentence motivation (the hardware
argument, localized) → footer: confidence (High only when hardware-derived) +
"Reversible — the original value is saved before any change." → single accent
Apply button. Empty state: "Nothing to recommend right now…". Loading:
skeleton. Never auto-applies; never surfaces anything outside the scan
allowlist (structurally: it reads `scan_relevant_ids`).

**Change Ledger** (nav: Manage → History): title + "stored locally, never
uploaded" subtitle; rows newest-first: status dot (ok/danger + text, never
color alone), action label, localized tweak name, timestamp, admin marker,
failure marker, detail; Revert button on applied tweaks. Empty state included.

**Guardrails honored**: security tweaks stay out of Scan/Advisor/profiles;
green only for safe/positive states; amber attention; red risk only; Pro never
visually dominates value.

## 6. Files changed in this slice

- `src/components/intelligence.tsx` (new): AdvisorCard, LedgerPanel,
  `pickTopRecommendation` (pure, tested).
- `scripts/test-advisor.mjs` (new): 5 unit tests incl. the allowlist guardrail;
  wired into `npm run check`.
- `src/App.tsx`, `src/types.ts`, `src/lib.ts` (FEATURE_INTELLIGENCE flag),
  `src/components/icons.tsx` (HistoryIcon), `src/i18n.ts` (+26 keys × 5).
- Quick wins: `src/components/maintenance.tsx` + `src/assets/uninstaller-icon.png`
  (real product icon on the promo card); `src/components/account.tsx`,
  `src/components/ui.tsx`, `src/lib.ts` (device-local profile photo — 128px
  JPEG in localStorage, never uploaded); Support section with "Report an
  issue" → https://pctweaker.app/support; `scripts/audit-i18n.mjs` whitelist.

## 7. Tests executed

- `cargo test`: 88/88 green.
- `tsc`, `eslint` (0 errors), `prettier`, `check:i18n` (471 keys × 5),
  `check:i18n-quality` (0 problems), `vite build`: green.
- `test:advisor`: 5/5 green (incl. "security tweak outside allowlist can never
  be advised").
- Manual: dev app hot-reload on Windows 11 (owner's machine) — pending owner
  review before merge.

## 8. Open risks

- Ledger v1 shows the audit trail without before/after registry values (they
  exist in the rollback store; surfacing them is Ledger v2).
- Advisor confidence is a two-level heuristic (hardware-motivated vs
  machine-type); honest but coarse.
- `disable_memory_integrity` still lacks a dedicated red-warning UI (1.1).
- Binaries remain unsigned pending Trusted Signing geo-resolution; SmartScreen
  reputation builds slowly either way (2026 policy).
- This branch (`intelligence-slice`) is NOT merged: master is untouched and
  tagged `backup-pre-intelligence` for instant rollback.

## 9. Changelog draft (1.0.0 "Control Room")

- New: Control Room design language — one identity, 14 themes, live signal
  hairlines, calm premium surfaces.
- New: Recommended for your PC — one hardware-motivated suggestion with
  confidence and guaranteed reversibility.
- New: Change Ledger — every change this app makes, stored locally, with
  one-click revert.
- New: profile photo (kept on your device), Report an issue, PC Tweaker
  Uninstaller cross-promo with its real icon.
- Improved: Free RAM front and center with a live memory trace; instrument-
  grade Turbo Boost gauge; theme-aware diagnostic Scan.
- Fixed: UI micro-freezes — all I/O now runs off the main thread.
- Honesty, as always: no fake benchmarks, no security tweaks in Quick Scan,
  original values saved before every change.
