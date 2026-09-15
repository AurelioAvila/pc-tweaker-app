import "./tool-surfaces.css";
import { useCallback, useId, useRef, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { format, Strings } from "../i18n";
import {
  RepairJob,
  RepairOutcome,
  RepairProgress,
  RepairStatus,
  RepairStep,
  Toast,
} from "../types";
import { CheckIcon, HeartPulseIcon } from "./icons";
import {
  recordDuration,
  Sample,
  smoothTowards,
  stepRemaining,
  typicalDuration,
} from "./repair-eta";
import { ToolDetails, ToolHeader } from "./tool-section";
import { ProBadge, ShieldBadge } from "./ui";

/* ------------------------------------------------------------------ *
 * A repair outlives the screen it was started from.
 *
 * DISM RestoreHealth runs for twenty minutes or more, and this card is
 * unmounted the moment the user looks at any other section. Holding the run
 * in component state meant that leaving and coming back produced a card that
 * believed nothing was happening, in front of a backend that refused the next
 * click with "a system repair is already running" — with no progress on
 * screen and no way to get it back.
 *
 * So the run lives in a module-scope store, subscribed to with
 * `useSyncExternalStore`. The Tauri listener is registered once at import,
 * not per mount, and the store owns the clock, so events and estimates keep
 * advancing while no card is rendered at all.
 * ------------------------------------------------------------------ */

type RepairState = {
  running: RepairJob | null;
  progress: RepairProgress | null;
  outcome: RepairOutcome | null;
  /** `Date.now()` when the current run started, for the elapsed clock. */
  startedAt: number | null;
  /** `Date.now()` when the percentage last moved a full point. See `STALL_MS`. */
  movedAt: number | null;
  /** The percentage at `movedAt`. */
  movedFrom: number;
  /** When the current step reported first — after the UAC prompt, not before. */
  stepStartedAt: number | null;
  /** How long each finished step of this run took. */
  finished: Partial<Record<RepairStep, number>>;
  /** Percentage over time for the current step: the trace and the rate. */
  samples: Sample[];
  /** What each step of this job has typically taken on this PC. */
  typical: Partial<Record<RepairStep, number>>;
  /** The store's clock, ticked once a second while a job runs. */
  now: number;
  /** Smoothed absolute finish times; null while there is nothing honest to say. */
  stepFinishAt: number | null;
  jobFinishAt: number | null;
};

/**
 * How long the same percentage has to stand before the UI says so.
 *
 * DISM parks on one number — 62-65% is the classic one — while it hands the
 * real work to TrustedInstaller and pulls replacement payloads from Windows
 * Update. Ten minutes there is ordinary, and a bar that says nothing about it
 * is indistinguishable from a hung process. Two minutes is long enough that
 * the note never fires during normal ticking.
 */
const STALL_MS = 120_000;

/** Mirrors the step lists in `sysrepair.rs`, so steps not yet started can be
 *  shown waiting instead of appearing out of nowhere. A check that finds
 *  damage on record stops after `quick`; the run simply ends early. */
const JOB_STEPS: Record<RepairJob, RepairStep[]> = {
  check: ["quick", "scan"],
  repair: ["restore", "sfc"],
  system_files: ["sfc"],
  component_cleanup: ["cleanup"],
};

let state: RepairState = {
  running: null,
  progress: null,
  outcome: null,
  startedAt: null,
  movedAt: null,
  movedFrom: 0,
  stepStartedAt: null,
  finished: {},
  samples: [],
  typical: {},
  now: Date.now(),
  stepFinishAt: null,
  jobFinishAt: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<RepairState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

void listen<RepairProgress>("system-repair-progress", (e) => {
  const next = e.payload;
  const now = Date.now();
  const prev = state.progress;
  const stepChanged = prev !== null && prev.step !== next.step;
  const changed = prev === null || stepChanged || prev.percent !== next.percent;
  // DISM creeps through its park 0.1% a minute. That is not movement anyone
  // can see, so it does not reset the stall clock; a full point does.
  const moved = prev === null || stepChanged || Math.abs(next.percent - state.movedFrom) >= 1;
  const patch: Partial<RepairState> = { progress: next };
  if (moved) {
    patch.movedAt = now;
    patch.movedFrom = next.percent;
  }

  if (stepChanged || state.stepStartedAt === null) {
    if (prev !== null && stepChanged && state.stepStartedAt !== null) {
      const took = now - state.stepStartedAt;
      patch.finished = { ...state.finished, [prev.step]: took };
      recordDuration(prev.step, took);
    }
    patch.stepStartedAt = now;
    patch.samples = [{ t: now, p: next.percent }];
    patch.stepFinishAt = null;
  } else if (changed) {
    patch.samples = [...state.samples, { t: now, p: next.percent }];
  }
  setState(patch);
});

/** One second of the store's clock: re-estimate, then ease the readouts. */
function tick() {
  const now = Date.now();
  const { running, progress, stepStartedAt, samples, typical } = state;
  if (!running) return;
  const steps = JOB_STEPS[running];
  const active = progress?.step ?? steps[0];
  const after = steps.slice(Math.max(0, steps.indexOf(active)) + 1);
  const pending = after.every((step) => typical[step] !== undefined)
    ? after.reduce((sum, step) => sum + (typical[step] ?? 0), 0)
    : null;
  const stepLeft =
    stepStartedAt === null
      ? (typical[active] ?? null)
      : stepRemaining({ samples, stepStartedAt, now, typicalMs: typical[active] ?? null });
  const jobLeft = stepLeft !== null && pending !== null ? stepLeft + pending : null;
  setState({
    now,
    stepFinishAt:
      stepLeft === null ? null : smoothTowards(state.stepFinishAt, now + stepLeft, 1000),
    jobFinishAt: jobLeft === null ? null : smoothTowards(state.jobFinishAt, now + jobLeft, 1000),
  });
}

/** Starts a job. Safe to call from a card that is later unmounted: everything
 *  it touches is the store, which no longer belongs to any component. */
async function startRepair(job: RepairJob, onError: (message: string) => void) {
  if (state.running) return;
  const now = Date.now();
  const typical: Partial<Record<RepairStep, number>> = {};
  for (const step of JOB_STEPS[job]) {
    const ms = typicalDuration(step);
    if (ms !== null) typical[step] = ms;
  }
  setState({
    running: job,
    progress: null,
    outcome: null,
    startedAt: now,
    movedAt: now,
    movedFrom: 0,
    stepStartedAt: null,
    finished: {},
    samples: [],
    typical,
    now,
    stepFinishAt: null,
    jobFinishAt: null,
  });
  const timer = window.setInterval(tick, 1000);
  try {
    const outcome = await invoke<RepairOutcome>("run_system_repair", { job });
    // The last step has no successor event to close it, so it is timed here.
    if (state.progress && state.stepStartedAt !== null) {
      recordDuration(state.progress.step, Date.now() - state.stepStartedAt);
    }
    setState({ outcome });
  } catch (e) {
    onError(String(e));
  } finally {
    window.clearInterval(timer);
    setState({
      running: null,
      progress: null,
      startedAt: null,
      movedAt: null,
      stepStartedAt: null,
      samples: [],
    });
  }
}

/** The verdict's colour. Four states rather than pass/fail: the difference
 *  between "repairable" and "could not be repaired" is the whole point of
 *  running the check, and one shared red would throw away the only actionable
 *  thing the tool says. */
const STATUS_TONE: Record<RepairStatus, string> = {
  healthy: "bg-ok/12 text-ok ring-ok/30",
  repaired: "bg-ok/12 text-ok ring-ok/30",
  repairable: "bg-warn/12 text-warn ring-warn/30",
  unrepairable: "bg-danger/12 text-danger ring-danger/30",
  completed: "bg-surface-1 text-ink-2 ring-line",
};

function VerdictIcon({ status }: { status: RepairStatus }) {
  if (status === "healthy" || status === "repaired") return <CheckIcon className="h-4 w-4" />;
  const d =
    status === "repairable"
      ? "M12 6.5v7M12 17.5v.01"
      : status === "unrepairable"
        ? "m7.5 7.5 9 9M16.5 7.5l-9 9"
        : "M12 11v6M12 7v.01";
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d={d} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

const timeOfDay = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function left(s: Strings, finishAt: number | null, now: number): string | null {
  if (finishAt === null) return null;
  const ms = finishAt - now;
  return ms < 60_000
    ? s.systemRepair.underMinute
    : format(s.systemRepair.remaining, { minutes: Math.round(ms / 60_000) });
}

/**
 * The current step's percentage over time, with the estimate drawn as what it
 * is: a dashed line from where the step is now to 100% at the expected
 * finish. A stall shows up as a flat line growing to the right, which is the
 * one picture that makes "it is still working, just not moving" believable.
 *
 * Drawn in real pixels, measured with a ResizeObserver. A stretched viewBox
 * (`preserveAspectRatio="none"`) was simpler, but Chromium smeared a
 * compressed trace across the whole card once a long estimate squeezed it
 * into the first few percent of the width.
 */
function ProgressTrace({
  samples,
  startedAt,
  now,
  finishAt,
  stalled,
}: {
  samples: Sample[];
  startedAt: number | null;
  now: number;
  finishAt: number | null;
  stalled: boolean;
}) {
  const gradient = useId();
  const [width, setWidth] = useState(0);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const measure = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(node);
    observer.current = ro;
  }, []);

  const last = samples[samples.length - 1];
  const H = 112;
  const TOP = 20;
  const BOTTOM = H - 24;
  const PAD = 12;

  if (startedAt === null || !last) {
    return (
      <div className="relative h-[112px] overflow-hidden rounded-lg border border-line bg-surface-1">
        <div className="absolute inset-x-3 h-px bg-line" style={{ top: BOTTOM }} />
        <div
          className="absolute h-px w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent motion-safe:animate-[defrag-sweep_1.8s_ease-in-out_infinite]"
          style={{ top: BOTTOM }}
        />
      </div>
    );
  }

  const end = Math.max(now, finishAt ?? now);
  const span = Math.max(1, end - startedAt);
  const plotW = Math.max(1, width - PAD * 2);
  const x = (t: number) => PAD + ((t - startedAt) / span) * plotW;
  const y = (p: number) => TOP + (1 - p / 100) * (BOTTOM - TOP);
  // One point per pixel column is all the eye can see.
  const stride = Math.max(1, Math.ceil(samples.length / Math.max(1, plotW / 2)));
  const drawn = samples.filter((_, i) => i % stride === 0 || i === samples.length - 1);
  const points = [...drawn.map((s) => [x(s.t), y(s.p)]), [x(now), y(last.p)]];
  const line = points
    .map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(now).toFixed(1)},${BOTTOM} L${PAD},${BOTTOM} Z`;
  const dotTone = stalled ? "var(--warning)" : "var(--app-accent)";

  const hovered = (() => {
    if (hoverX === null || hoverX < PAD) return null;
    const t = startedAt + ((hoverX - PAD) / plotW) * span;
    if (t > now) return null;
    const at = samples.filter((sample) => sample.t <= t).pop() ?? samples[0];
    return { px: hoverX, t, p: at.p };
  })();

  return (
    <div
      ref={measure}
      className="relative h-[112px] rounded-lg border border-line bg-surface-1"
      onPointerMove={(e) => setHoverX(e.clientX - e.currentTarget.getBoundingClientRect().left)}
      onPointerLeave={() => setHoverX(null)}
    >
      {width > 0 && (
        <svg width={width} height={H} className="absolute inset-0" aria-hidden="true">
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--app-accent)", stopOpacity: 0.22 }} />
              <stop offset="100%" style={{ stopColor: "var(--app-accent)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {[0, 50, 100].map((p) => (
            <line
              key={p}
              x1={PAD}
              x2={width - PAD}
              y1={y(p)}
              y2={y(p)}
              strokeWidth="1"
              style={{ stroke: "var(--border-subtle)" }}
            />
          ))}
          <path d={area} fill={`url(#${gradient})`} />
          <path
            d={line}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ stroke: "var(--app-accent)" }}
          />
          {finishAt !== null && (
            <>
              <line
                x1={x(now)}
                y1={y(last.p)}
                x2={x(finishAt)}
                y2={y(100)}
                strokeWidth="1.5"
                strokeDasharray="3 5"
                strokeLinecap="round"
                style={{ stroke: "var(--text-muted)" }}
              />
              <circle
                cx={x(finishAt)}
                cy={y(100)}
                r="3.5"
                strokeWidth="1.5"
                style={{ stroke: "var(--text-muted)", fill: "var(--surface-1)" }}
              />
            </>
          )}
          <circle
            cx={x(now)}
            cy={y(last.p)}
            r="9"
            className="motion-safe:animate-ping"
            style={{
              fill: dotTone,
              opacity: 0.3,
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          />
          <circle
            cx={x(now)}
            cy={y(last.p)}
            r="4.5"
            strokeWidth="2"
            style={{ fill: dotTone, stroke: "var(--surface-1)" }}
          />
          {hovered && (
            <line
              x1={hovered.px}
              x2={hovered.px}
              y1={TOP}
              y2={BOTTOM}
              strokeWidth="1"
              style={{ stroke: "var(--border-strong)" }}
            />
          )}
        </svg>
      )}

      <span className="absolute left-3 top-1 text-[10px] tabular-nums text-ink-3">100%</span>
      <span className="absolute bottom-1 left-3 text-[10.5px] tabular-nums text-ink-3">
        {timeOfDay.format(startedAt)}
      </span>
      {hovered && (
        <span
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line-2 bg-raised px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink shadow-lg"
          style={{ left: Math.min(width - 48, Math.max(48, hovered.px)) }}
        >
          {clock(hovered.t - startedAt)} · {Math.floor(hovered.p)}%
        </span>
      )}
    </div>
  );
}

/**
 * DISM and SFC, with a live trace and a direct question at the end.
 *
 * The result deliberately asks rather than advises: a check that finds
 * repairable damage and then says "run the repair to fix it" has left the
 * user to go and find the button, when the only thing they want to answer is
 * yes or no.
 */
export function SystemRepairCard({
  s,
  isPro,
  onRequirePro,
  pushToast,
}: {
  s: Strings;
  isPro: boolean;
  onRequirePro: () => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const {
    running,
    progress,
    outcome,
    startedAt,
    movedAt,
    stepStartedAt,
    finished,
    samples,
    typical,
    now,
    stepFinishAt,
    jobFinishAt,
  } = useSyncExternalStore(subscribe, getSnapshot);

  const stepLabel: Record<RepairStep, string> = {
    quick: s.systemRepair.stepQuick,
    scan: s.systemRepair.stepScan,
    restore: s.systemRepair.stepRestore,
    sfc: s.systemRepair.stepSfc,
    cleanup: s.systemRepair.stepCleanup,
  };

  const statusLabel: Record<RepairStatus, string> = {
    healthy: s.systemRepair.statusHealthy,
    repairable: s.systemRepair.statusRepairable,
    repaired: s.systemRepair.statusRepaired,
    unrepairable: s.systemRepair.statusUnrepairable,
    completed: s.systemRepair.statusCompleted,
  };

  function run(job: RepairJob) {
    // The read-only check is free; the jobs that change the machine are not.
    if (job !== "check" && !isPro) {
      onRequirePro();
      return;
    }
    void startRepair(job, (message) => pushToast("error", message));
  }

  const log = outcome?.steps
    .map(
      (step) => `--- ${stepLabel[step.step] ?? step.step} (exit ${step.exit_code})\n${step.tail}`,
    )
    .join("\n\n");

  // Damage the user can act on. Anything else gets the quieter offer below,
  // because a repair is still available to someone with symptoms the
  // component-store check cannot see.
  const needsRepair = outcome?.status === "repairable" || outcome?.status === "unrepairable";

  const stalled = movedAt !== null && progress !== null && now - movedAt > STALL_MS;
  // Below 1% nothing has been reported yet: DISM starts silent, and a number
  // pinned at zero for half a minute reads as a hang.
  const percent = progress !== null && progress.percent >= 1 ? progress.percent : null;
  const steps = running ? JOB_STEPS[running] : [];
  const activeIndex = progress ? Math.max(0, steps.indexOf(progress.step)) : 0;
  const activeStep = steps[activeIndex];
  // Segments sized by what each step takes on this PC, once that is known for
  // all of them; equal until then, rather than a guess dressed as a proportion.
  const weighted = steps.every((step) => typical[step] !== undefined);

  return (
    <section className="tool-panel tool-system-repair-card" aria-busy={running !== null}>
      <ToolHeader
        icon={<HeartPulseIcon className="h-5 w-5" />}
        title={
          <>
            {s.systemRepair.title}
            <ShieldBadge label={s.badges.admin} />
          </>
        }
        description={s.systemRepair.description}
      />

      {/* One stage, three states: ready, running, verdict. The repair is
          offered only by the verdict, where the answer to "is anything wrong"
          already is — running a twenty-minute repair before checking is the
          one order that reliably wastes the user's afternoon. */}
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        {!running && !outcome && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <p className="min-w-[200px] flex-1 text-xs leading-relaxed text-ink-3">
              {s.systemRepair.adminNote}
            </p>
            <button type="button" onClick={() => run("check")} className="tool-primary-action">
              {s.systemRepair.checkButton}
            </button>
          </div>
        )}

        {running && activeStep && (
          <div>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                {steps.length > 1 && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                    {format(s.systemRepair.stepOf, {
                      index: activeIndex + 1,
                      total: steps.length,
                    })}
                  </p>
                )}
                <p className="mt-1 text-base font-semibold leading-snug text-ink">
                  {stepLabel[activeStep]}
                </p>
              </div>
              <p className="type-data shrink-0 text-[40px] font-bold leading-none tracking-[-0.04em] tabular-nums text-ink">
                {percent === null ? "—" : Math.floor(percent)}
                {percent !== null && <span className="ml-0.5 text-lg text-ink-3">%</span>}
              </p>
            </div>

            <div className="mt-4">
              <ProgressTrace
                samples={samples}
                startedAt={stepStartedAt}
                now={now}
                finishAt={stepFinishAt}
                stalled={stalled}
              />
            </div>

            {/* The whole job as a pipeline: what is done and how long it took,
                what is running, what is still to come. */}
            <div
              className="mt-4 flex gap-2"
              role="progressbar"
              aria-label={stepLabel[activeStep]}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(percent ?? 0)}
            >
              {steps.map((step, i) => {
                const took = finished[step];
                const phase =
                  took !== undefined || i < activeIndex
                    ? "done"
                    : i === activeIndex
                      ? "active"
                      : "pending";
                const typicalMs = typical[step];
                return (
                  <div
                    key={step}
                    className="min-w-0 basis-0"
                    style={{ flexGrow: weighted ? Math.max(1, (typicalMs ?? 0) / 1000) : 1 }}
                  >
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-1">
                      {phase === "done" && <div className="h-full bg-ok" />}
                      {phase === "active" && (
                        <div
                          className={`relative h-full overflow-hidden rounded-full transition-[width] duration-700 ease-out ${
                            stalled ? "bg-warn" : "bg-accent"
                          }`}
                          style={{ width: `${Math.max(2, percent ?? 0)}%` }}
                        >
                          <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent motion-safe:animate-[pulse-sweep_2.2s_ease-in-out_infinite]" />
                        </div>
                      )}
                    </div>
                    <p
                      className={`mt-2 flex min-w-0 items-center gap-1.5 text-xs font-semibold ${
                        phase === "pending" ? "text-ink-3" : "text-ink-2"
                      }`}
                    >
                      {phase === "done" && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-ok" />}
                      {phase === "active" && (
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-pulse ${
                            stalled ? "bg-warn" : "bg-accent"
                          }`}
                        />
                      )}
                      <span className="truncate" title={stepLabel[step]}>
                        {stepLabel[step]}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] tabular-nums text-ink-3">
                      {phase === "done"
                        ? clock(took ?? 0)
                        : phase === "active"
                          ? (left(s, stepFinishAt, now) ?? s.systemRepair.estimating)
                          : typicalMs !== undefined
                            ? format(s.systemRepair.remaining, {
                                minutes: Math.max(1, Math.round(typicalMs / 60_000)),
                              })
                            : s.systemRepair.waiting}
                    </p>
                  </div>
                );
              })}
            </div>

            <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface-1">
              {[
                [s.systemRepair.statElapsed, clock(now - (startedAt ?? now))],
                [s.systemRepair.statRemaining, left(s, jobFinishAt, now)],
                [
                  s.systemRepair.statFinish,
                  jobFinishAt === null ? null : timeOfDay.format(jobFinishAt),
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 px-3 py-2.5">
                  <dt className="truncate text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                    {label}
                  </dt>
                  <dd
                    className={`mt-1 truncate tabular-nums ${
                      value === null
                        ? "text-xs text-ink-3"
                        : "type-data text-[17px] font-semibold text-ink"
                    }`}
                  >
                    {value ?? s.systemRepair.estimating}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Replaces nothing and hides nothing: once the percentage has
                genuinely stood still, the user is no longer asking how long it
                takes — they are asking whether it is still alive. */}
            {stalled && movedAt !== null && percent !== null && (
              <p className="mt-3 flex gap-2.5 rounded-lg border border-warn/30 bg-warn/8 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
                <svg viewBox="0 0 24 24" fill="none" className="mt-px h-4 w-4 shrink-0 text-warn">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 7.5V12l3 2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {format(s.systemRepair.holdingAt, {
                  percent: Math.floor(percent),
                  time: clock(now - movedAt),
                })}
              </p>
            )}

            <p className="mt-3 text-xs leading-relaxed text-ink-3">
              {s.systemRepair.timeNote}{" "}
              <span className="font-medium text-warn">{s.systemRepair.runningNote}</span>
            </p>
          </div>
        )}

        {outcome && !running && (
          <div role="status">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ${STATUS_TONE[outcome.status]}`}
              >
                <VerdictIcon status={outcome.status} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{statusLabel[outcome.status]}</p>
                {needsRepair ? (
                  /* The direct ask. A check that finds damage and then describes
                     what the user could do next has stopped one step short of the
                     only thing they wanted from it. */
                  <p className="mt-1 text-xs leading-relaxed text-ink-3">
                    <span className="font-semibold text-ink-2">{s.systemRepair.askRepair}</span>{" "}
                    {outcome.status === "unrepairable"
                      ? s.systemRepair.hintUnrepairable
                      : s.systemRepair.timeNote}
                  </p>
                ) : (
                  outcome.status === "completed" && (
                    <p className="mt-1 text-xs leading-relaxed text-ink-3">
                      {s.systemRepair.hintCompleted}
                    </p>
                  )
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 pl-12">
              {needsRepair ? (
                <>
                  <button
                    type="button"
                    onClick={() => run("repair")}
                    className="tool-primary-action"
                  >
                    {s.systemRepair.askRepairYes}
                    {!isPro && <ProBadge label={s.badges.pro} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setState({ outcome: null })}
                    className="tool-secondary-action"
                  >
                    {s.systemRepair.askRepairNo}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => run("check")}
                    className="tool-secondary-action"
                  >
                    {s.systemRepair.checkButton}
                  </button>
                  {/* Still offered when the store checks out clean: SFC repairs
                      system files the component-store check never looks at, so
                      "healthy" is not the same as "nothing to fix". With the
                      store just verified, SFC alone is enough — no twenty-minute
                      RestoreHealth first. An unreadable verdict gets both. */}
                  <button
                    type="button"
                    onClick={() => run(outcome.status === "completed" ? "repair" : "system_files")}
                    className="tool-secondary-action"
                  >
                    {s.systemRepair.repairAnyway}
                    {!isPro && <ProBadge label={s.badges.pro} />}
                  </button>
                </>
              )}
            </div>

            {log && (
              <ToolDetails label={s.systemRepair.logTitle} className="mt-3 pl-12">
                <pre className="tool-command max-h-64 overflow-auto font-mono">{log}</pre>
              </ToolDetails>
            )}
          </div>
        )}
      </div>

      {/* Housekeeping, not repair: shrinking WinSxS answers a different
          question (disk space), so it sits apart instead of next to the
          check where it read as a second way of fixing Windows. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
        <p className="min-w-[200px] flex-1 text-xs leading-relaxed text-ink-3">
          {s.systemRepair.cleanupNote}
        </p>
        <button
          type="button"
          onClick={() => run("component_cleanup")}
          disabled={running !== null}
          className="tool-secondary-action"
        >
          {s.systemRepair.cleanupButton}
          {!isPro && <ProBadge label={s.badges.pro} />}
        </button>
      </div>
    </section>
  );
}
