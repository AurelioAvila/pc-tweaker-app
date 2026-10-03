# AGENTS.md — PC Tweaker (per Claude Code, Codex e altri agenti)

App desktop Windows: Tauri 2 (backend Rust in `src-tauri/`) + React 19 +
Tailwind 4 + Vite (`src/`). 14 temi colore (`src/theme.ts`).

## Prima di toccare l'interfaccia
Leggi la skill `control-room-design` (`.agents/skills/`, copia in
`.claude/skills/` via `npm run sync:skills`). Il design system vive in
`src/App.css`: i componenti usano solo i token semantici, mai la palette
grezza di Tailwind. Ogni modifica visiva si chiude con screenshot prima/dopo
(`preview.cjs` nella skill) su almeno due temi.

## Controlli
- Completo: `npm run check` (tsc, eslint, prettier, design tokens, i18n, Rust, test).
- Veloce, solo frontend: `npx tsc --noEmit && npx eslint src && npm run format:check && npm run check:design-tokens && npm run check:i18n`.
- `check:design-tokens` e' un cricchetto: fallisce se un file ha piu' classi
  di palette grezza della baseline (`scripts/design-token-baseline.json`).
  Dopo una migrazione: `node scripts/check-design-tokens.mjs --update`.

## Stato della migrazione ai token (2026-10-03)
Migrati: `health.tsx` (0), `maintenance.tsx` (69 -> 19, restano solo le card
promozionali con colore di marca), icone tool di `cleaners.tsx`. Restano 169
classi in 14 file; le piu' pesanti: `categories.tsx` (37, decisione aperta:
vedi skill), `pro.tsx`, `ui.tsx`, `technical.tsx`, `hardware.tsx`,
`account.tsx`. Valori esatti nella baseline.
