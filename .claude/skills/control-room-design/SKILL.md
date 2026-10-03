---
name: control-room-design
description: Design system "The Control Room" di PC Tweaker (src/App.css). Usala PRIMA di creare, modificare o abbellire qualsiasi interfaccia di questa app - schermate, componenti, colori, tipografia, spaziature, stati, temi - e per verificare con screenshot che una modifica visiva non abbia rotto niente.
---

# The Control Room — design system di PC Tweaker

La fonte di verita' e' `src/App.css` (commento in testa). Questa skill la
riassume e dice come lavorarci senza degradarla.

## Tre livelli di token
1. **Fondazione** (`:root`): raggi `--radius-s/m/l` (6/10/14 px: controlli,
   card, overlay), durate `--dur-fast/base/slow` (120/180/240 ms) con
   `--ease-standard`, font `--font-app` (Inter Variable) e `--font-data`
   (Cascadia Code, per numeri e valori tecnici).
2. **Dati del tema**: ognuno dei 14 temi (`[data-theme=...]`, elenco in
   `src/theme.ts`) definisce SOLO `--app-bg-a`, `--app-bg-b`, `--app-accent`.
   Non aggiungere altro per tema. `--app-accent2` e' legacy: vietato nel
   codice nuovo.
3. **Semantici**: tutto il resto e' derivato con `color-mix`, quindi vale per
   tutti i temi. I componenti usano SOLO questi.

## Utility Tailwind ammesse per il colore
| Ruolo | Classe | Token |
|---|---|---|
| Testo primario / secondario / attenuato | `text-ink` / `text-ink-2` / `text-ink-3` | `--text-*` (AA su ogni tema) |
| Superfici | `bg-app`, `bg-raised`, `bg-surface-1`, `bg-surface-2`, `bg-surface-hover` | opache, mai stack traslucidi |
| Bordi (la profondita' si fa coi bordi, non con le ombre) | `border-line`, `border-line-2` | hairline 9% / 16% |
| Accento (uno solo) | `bg-accent`, `text-accent`, `bg-accent-soft`, `text-on-accent` | colore del tema |
| Stato (solo per significato, mai decorazione) | `ok`, `warn`, `caution`, `danger`, `info` | fissi, tarati AA |

Modificatori di opacita' ammessi: `bg-ok/10`, `ring-danger/30`, `text-ok/80`.
`caution` sta a meta' tra warn e danger, per scale a 4 livelli (es. "Fair").

## Tabella di migrazione (classi grezze -> token)
| Grezza | Diventa |
|---|---|
| `emerald-*`, `green-*` | `ok` |
| `amber-*`, `yellow-*` | `warn` |
| `orange-*` | `caution` |
| `rose-*`, `red-*` | `danger` |
| `sky-*`, `cyan-*`, `blue-*` (informativo) | `info` |
| `text-white` | `text-ink`; `text-white/75` -> `text-ink-2`; testo debole -> `text-ink-3` |
| separatori quasi invisibili (`text-white/20`) | `text-line-2` |
| `bg-white/5`, `bg-white/[0.03]` (hover o riga) | `bg-surface-hover` |
| `bg-white/10` (binari, tracce) | `bg-line` |
| `border-white/5|10` | `border-line` |
| `violet/fuchsia/indigo` decorativi | `accent` / `accent-soft` (segue il tema) |
| colori hex in SVG (`stroke="#34d399"`) | `stroke="var(--success)"` ecc. |

| icona di un tool (`tool-card-icon`) con tinta per tool | `bg-accent-soft text-accent ring-1 ring-accent/30` (modello di `monitor.tsx`) |
| overlay dialoghi `bg-black/60` | `bg-[var(--overlay)]` |
| pannello dialogo `bg-slate-900` | `bg-surface-2 border-line-2` |
| pozzetti interni piu' scuri della card (`bg-black/20`) | `bg-app` |
| `accent-sky-400` (checkbox) | `accent-accent` |
| `shadow-lg shadow-black/20` su `.tool-panel` | togliere: e' codice morto, vince l'ombra di `.tool-panel` (verificato con getComputedStyle) |

Eccezioni volute (restano nella baseline):
- quadrante arcobaleno del punteggio salute (`hsl()` per tacca): e' una
  visualizzazione di dati;
- card promozionali di altri prodotti (Uninstaller fucsia, Redaxa viola in
  `maintenance.tsx`): portano il colore di marca di quel prodotto.

Decisione aperta (chiedere all'utente prima di toccarla): `CATEGORY_STYLE`
in `src/categories.tsx` da' un colore fisso per categoria (performance
ambra, privacy verde, ui fucsia, manutenzione azzurro, gaming rosa) usato in
tutta l'app. Contraddice "un solo accento", ma e' anche un codice visivo
per categoria: cambiarlo tocca ogni schermata.

## Tipografia
Classi `.type-display` (24), `.type-page` (20), `.type-section` (15),
`.type-card` (13.5), `.type-body` (13), `.type-caption` (11.5),
`.type-label` (11, maiuscoletto), `.type-data`/`.type-mono` (cifre
tabellari). Gerarchia solo con dimensione/peso/spaziatura, una famiglia.

## Regole
- Niente nuove classi di palette grezza: `npm run check:design-tokens`
  (dentro `npm run check`) fallisce se un file ne ha piu' della baseline.
  Quando migri una schermata: `node scripts/check-design-tokens.mjs --update`
  e committa la baseline abbassata.
- Niente ombre grandi; profondita' = passi di luminanza + bordi hairline.
- Un solo accento; i colori di stato non decorano.
- Controlla sempre almeno 2 temi (uno scuro freddo, uno caldo).

## Verifica visiva obbligatoria (prima/dopo)
Il backend Tauri non gira nel browser: `preview.cjs` lo simula con dati
finti e fa screenshot. Serve Playwright (`npm i -g playwright` o MCP).
```bash
npm run dev                                   # terminale 1
git stash                                     # stato "prima"
node .agents/skills/control-room-design/preview.cjs before Health
git stash pop
node .agents/skills/control-room-design/preview.cjs after Health
PREVIEW_THEME=teal_depths node .agents/skills/control-room-design/preview.cjs teal Health
```
Gli screenshot vanno nella cartella temporanea del sistema, mai nel repo.
Guardali davvero e confronta: stessa gerarchia, nessun testo illeggibile,
nessun errore in "page errors". Se la schermata chiama un comando non
simulato, aggiungi i dati in `F` dentro `preview.cjs` (forma da `src/types.ts`).
