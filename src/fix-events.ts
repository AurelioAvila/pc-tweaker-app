// Hooks around a Scan fix ("Fix all" / "Custom"), for whatever has to happen
// before and after one without the Scan knowing about it: the before/after
// proof card takes its "before" baseline in `onBeforeFix` and shows the card
// on `onFixDone`.
//
//   const off = onBeforeFix(async (plan) => { before = await invoke("..."); });
//   const done = onFixDone((summary) => showProofCard(before, summary));
//
// Both return an unsubscribe function. A failing or slow "before" hook never
// blocks the fix: each one gets `BEFORE_FIX_TIMEOUT_MS`.
import type { ScanFixPlan, ScanFixResult } from "./types";

export type FixSource = "scan";

export type FixSummary = {
  source: FixSource;
  /** Settings verified as applied. */
  fixed: string[];
  failed: string[];
  /** What the fix measured: bytes freed, registry entries removed, memory freed. */
  measured: ScanFixResult | null;
  errors: string[];
};

type BeforeHook = (plan: ScanFixPlan, source: FixSource) => Promise<unknown> | unknown;
type DoneHook = (summary: FixSummary) => void;

export const BEFORE_FIX_TIMEOUT_MS = 20_000;
const before = new Set<BeforeHook>();
const done = new Set<DoneHook>();

export function onBeforeFix(hook: BeforeHook): () => void {
  before.add(hook);
  return () => void before.delete(hook);
}

export function onFixDone(hook: DoneHook): () => void {
  done.add(hook);
  return () => void done.delete(hook);
}

/** Awaited by the Scan right before it writes anything. */
export async function runBeforeFix(plan: ScanFixPlan, source: FixSource): Promise<void> {
  await Promise.allSettled(
    [...before].map((hook) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      return Promise.race([
        Promise.resolve()
          .then(() => hook(plan, source))
          .finally(() => clearTimeout(timer)),
        new Promise((resolve) => (timer = setTimeout(resolve, BEFORE_FIX_TIMEOUT_MS))),
      ]);
    }),
  );
}

/** Called by the Scan once the fix is verified. */
export function emitFixDone(summary: FixSummary): void {
  for (const hook of done) {
    try {
      hook(summary);
    } catch {
      /* A listener's failure is its own. */
    }
  }
}
