# PC Tweaker 1.2.0 — The Understanding Update

A score is a photograph. This release gives it an album, a memory, and a
reason.

1.1.0 could tell you your PC scored 84. It could not tell you it was 89 last
week, or that two new startup apps are what took the five points. 1.2.0 can —
and it shows the receipts.

---

## Health Score history

Every measurement is now recorded locally, in `health-history.jsonl` inside
the app's own data folder. Nothing is uploaded, and nothing is computed in the
background: the score is still calculated only when you press the button.

Under the dial you now get the previous score, when it was taken, the
difference, and a trend line of your recent measurements.

## "Why did my score change?"

The headline number is a door, not a verdict. When something moves, the panel
names the categories responsible, largest first, and quotes the evidence from
both measurements:

```
Startup            100 → 70     −30
  Startup app load · 4 apps start with Windows → 7 apps start with Windows
  Contribution to the overall score: −3.3
```

Three rules govern this panel, and all three are enforced by tests:

- **A category is only blamed if its score actually moved.** No filler.
- **Evidence that drifts without moving points is not a cause.** Memory usage
  reading 61% instead of 58% explains nothing, so it is never listed as an
  explanation. Inventing that kind of precision is exactly what this product
  refuses to do.
- **The arithmetic is disclosed.** The overall score is the mean of nine
  categories, so a 30-point category swing moves the headline by 3.3. That
  contribution is printed rather than left to look like a bug.

When nothing changed, the app says nothing changed. There is no empty panel to
fill, and no improvement is ever claimed that was not measured.

## Technical details: exactly what every tweak does

Every tweak now carries a `(i)` disclosure listing the precise system changes
behind its description — the full registry path, the value name, the type as
regedit names it, and the value written:

```
REGISTRY   REG_DWORD
Key      HKLM\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling
Value    PowerThrottlingOff
Sets to  1 (0x1)
```

Commands and service changes are disclosed the same way, so the tweaks that
are *not* a single registry write — the power plan, turbo boost, private DNS,
network latency, the Windows 10 context menu — are no longer silent. Those
were precisely the ones worth being suspicious about.

This is derived from the code that performs the write, not from a separate
data file. A manifest that can drift from the code would eventually show you a
key the app does not touch, and a confident lie is worse than no disclosure at
all.

## Fixed

- **Navigating with an active search did nothing.** With text in the search
  box every section panel was suppressed while the list showed matches from
  everywhere, so clicking a sidebar entry appeared to do nothing at all — the
  app looked frozen rather than filtered. Selecting a section now clears the
  search.
- Saving a configuration profile now requires an account, in line with the
  rest of the suite.

## Under the hood

- 105 tests pass, including 9 new ones covering score comparison, snapshot
  persistence and disclosure formatting.
- Health history is capped at the most recent 200 measurements; unreadable
  rows written by a future build are skipped rather than failing the read.
- A measurement that cannot be written to history still returns a valid
  score — you lose next time's comparison, never today's answer.
