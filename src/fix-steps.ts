// The steps of a running fix (Scan's Fix all, Safe optimize, a profile) and
// how far along the progress ring is. Pure functions: the ring component
// (components/fix-progress.tsx) animates between the milestones these give,
// and every milestone is a real step finishing, reported by the backend
// (scanfix.rs `Step`, event "fix-progress") or by the window itself.
import type { RestoreStatus } from "./types";

export const FIX_STEP_IDS = [
  "measure_before",
  "restore_point",
  "system_settings",
  "system_junk",
  "system_registry",
  "memory",
  "settings",
  "junk",
  "caches",
  "registry",
  "booster",
  "measure_after",
] as const;
export type FixStepId = (typeof FIX_STEP_IDS)[number];

export type FixStep = {
  id: FixStepId;
  state: "todo" | "active" | "done";
  failed?: boolean;
  /** Bytes freed (junk, caches) or memory released (memory). */
  bytes?: number;
  /** Settings applied or registry entries removed. */
  count?: number;
  restore?: RestoreStatus | null;
};

/** Mirrors `scanfix::Step`: a plan, or one step starting or finishing. */
export type StepEvent = {
  plan?: string[];
  step?: string;
  done?: boolean;
  failed?: boolean;
  bytes?: number;
  count?: number;
  restore_point?: RestoreStatus | null;
};

const isStep = (id: string | undefined): id is FixStepId =>
  !!id && (FIX_STEP_IDS as readonly string[]).includes(id);

/** The steps before anything is known about the work: measure, one generic
 *  "applying settings" step, measure again. */
export function initialSteps(): FixStep[] {
  return [
    { id: "measure_before", state: "active" },
    { id: "settings", state: "todo" },
    { id: "measure_after", state: "todo" },
  ];
}

/** Applies one event. A plan replaces the work between the two measurements
 *  (steps already finished stay); a step the plan did not list is inserted
 *  before "measure_after". Unknown ids are ignored. */
export function applyStepEvent(steps: FixStep[], ev: StepEvent): FixStep[] {
  if (ev.plan) {
    const planned = ev.plan.filter(isStep);
    const head = steps.filter((s) => s.id === "measure_before");
    const tail = steps.filter((s) => s.id === "measure_after");
    const kept = steps.filter((s) => s.state === "done" && !head.includes(s) && !tail.includes(s));
    const fresh = planned
      .filter((id) => !kept.some((s) => s.id === id))
      .map((id): FixStep => ({ id, state: "todo" }));
    return [...head, ...kept, ...fresh, ...tail];
  }
  if (!isStep(ev.step)) return steps;
  const id = ev.step;
  let next = steps.some((s) => s.id === id)
    ? steps
    : (() => {
        const at = steps.findIndex((s) => s.id === "measure_after");
        const step: FixStep = { id, state: "todo" };
        return at < 0 ? [...steps, step] : [...steps.slice(0, at), step, ...steps.slice(at)];
      })();
  next = next.map((s) => {
    if (s.id !== id) return s;
    if (!ev.done) return s.state === "done" ? s : { ...s, state: "active" };
    return {
      ...s,
      state: "done",
      failed: s.failed || !!ev.failed,
      bytes: ev.bytes ?? s.bytes,
      count: ev.count ?? s.count,
      restore: ev.restore_point ?? s.restore,
    };
  });
  return next;
}

/** When the work returns: every work step still open is closed (the window
 *  knows nothing more about it), "measure_after" excepted. */
export function closeWork(steps: FixStep[]): FixStep[] {
  return steps.map((s) =>
    s.id === "measure_after" || s.state === "done" ? s : { ...s, state: "done" },
  );
}

const WEIGHT: Partial<Record<FixStepId, number>> = {
  restore_point: 3,
  system_junk: 2,
  junk: 2,
  caches: 2,
};
export const weightOf = (id: FixStepId) => WEIGHT[id] ?? 1;

/** Where each step starts and ends on the ring, in percent. The two
 *  measurements take fixed slices (0-15 and 85-100) so a plan that arrives
 *  later only re-divides the middle, which the ring has not entered yet. */
export function bands(steps: FixStep[]): [number, number][] {
  const before = steps.some((s) => s.id === "measure_before");
  const after = steps.some((s) => s.id === "measure_after");
  const lo = before ? 15 : 0;
  const hi = after ? 85 : 100;
  const work = steps.filter((s) => s.id !== "measure_before" && s.id !== "measure_after");
  const total = work.reduce((sum, s) => sum + weightOf(s.id), 0);
  let at = lo;
  return steps.map((s) => {
    if (s.id === "measure_before") return [0, lo];
    if (s.id === "measure_after") return [hi, 100];
    const span = total ? ((hi - lo) * weightOf(s.id)) / total : 0;
    const band: [number, number] = [at, at + span];
    at += span;
    return band;
  });
}

/** Where the ring heads while a step runs: towards the end of its band but
 *  never reaching it (at most 82 %) until the step really finishes. */
export function creep(band: [number, number], elapsedMs: number, id: FixStepId): number {
  const [a, b] = band;
  const tau = 3500 * weightOf(id) * (id.startsWith("measure") ? 2 : 1);
  return a + (b - a) * 0.82 * (1 - Math.exp(-elapsedMs / tau));
}
