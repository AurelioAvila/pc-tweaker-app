/* ------------------------------------------------------------------ *
 * Time-left estimates for DISM and SFC.
 *
 * Neither tool reports a linear percentage. ScanHealth races to 20% and
 * crawls after it; RestoreHealth parks at 62-65% for ten minutes while it
 * downloads payloads. Extrapolating from the step's start, which the first
 * version did, promised four minutes during the sprint and then stood still.
 *
 * Two signals, blended by how far the step has got:
 *  - how long this very step took on this PC before (the median of the last
 *    few runs) — the best guess early, when the percentage says little;
 *  - the step's average pace, from its start up to *now*. Not a recent
 *    window: during the park at 62% DISM creeps 0.1% a minute, and a window
 *    over that crawl predicted five hours for a step that had four minutes
 *    left. Measured up to now, a stall still makes the estimate grow.
 * ------------------------------------------------------------------ */

export type Sample = { t: number; p: number };

const HISTORY_KEY = "pctweaker.repair.stepDurations";
const HISTORY_RUNS = 5;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Milliseconds left at the step's average pace, or null while there is too
 *  little progress to measure. */
export function rateRemaining(
  samples: Sample[],
  stepStartedAt: number,
  now: number,
): number | null {
  const p = samples.length ? samples[samples.length - 1].p : 0;
  const elapsed = now - stepStartedAt;
  if (p < 3 || elapsed < 20_000) return null;
  return (elapsed * (100 - p)) / p;
}

/** The blended estimate for the running step, in milliseconds. */
export function stepRemaining(opts: {
  samples: Sample[];
  stepStartedAt: number;
  now: number;
  typicalMs: number | null;
}): number | null {
  const { samples, stepStartedAt, now, typicalMs } = opts;
  const p = samples.length ? samples[samples.length - 1].p : 0;
  if (p >= 100) return 0;
  const elapsed = now - stepStartedAt;
  const byRate = rateRemaining(samples, stepStartedAt, now);
  // History only counts while the step is inside what it took before; past
  // that, it has nothing left to say.
  const byHistory = typicalMs !== null && typicalMs > elapsed ? typicalMs - elapsed : null;
  if (byRate === null) return byHistory;
  if (byHistory === null) return byRate;
  // Squared: DISM front-loads its percentage, so the rate flatters early on
  // and earns trust only as the step nears the end.
  const w = Math.min(0.85, Math.max(0.1, (p / 100) ** 2));
  return (1 - w) * byHistory + w * byRate;
}

/** Eases a displayed finish time towards a new estimate, so the readout
 *  drifts instead of jumping at every redraw. Time constant: 15 s. */
export function smoothTowards(previous: number | null, target: number, dtMs: number): number {
  if (previous === null) return target;
  const alpha = 1 - Math.exp(-dtMs / 15_000);
  return previous + (target - previous) * alpha;
}

export function loadHistory(): Record<string, number[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * A first run has no history, and without one the estimate believed DISM's
 * opening sprint: four minutes left on a fourteen-minute step. These are
 * middle-of-the-road durations on an SSD, used only until this PC has timed
 * the step itself.
 * ponytail: fixed guesses; a slow HDD runs well past them until one real run replaces them.
 */
const FIRST_RUN_MS: Record<string, number> = {
  quick: 15_000,
  scan: 6 * 60_000,
  restore: 15 * 60_000,
  sfc: 8 * 60_000,
  cleanup: 10 * 60_000,
};

export function typicalDuration(step: string): number | null {
  const runs = loadHistory()[step];
  const measured = Array.isArray(runs)
    ? median(runs.filter((v) => typeof v === "number" && v > 0))
    : null;
  return measured ?? FIRST_RUN_MS[step] ?? null;
}

export function recordDuration(step: string, ms: number) {
  try {
    const history = loadHistory();
    history[step] = [...(history[step] ?? []), Math.round(ms)].slice(-HISTORY_RUNS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage full or blocked: the estimate falls back to the rate alone.
  }
}
