import { useEffect, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { format, Strings } from "../i18n";
import { RepairJob, RepairOutcome, RepairProgress, RepairStatus, Toast } from "../types";
import { HeartPulseIcon } from "./icons";
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
 * not per mount, so events keep arriving while no card is rendered at all.
 * ------------------------------------------------------------------ */

type RepairState = {
  running: RepairJob | null;
  progress: RepairProgress | null;
  outcome: RepairOutcome | null;
  /** `Date.now()` when the current run started, for the elapsed clock. */
  startedAt: number | null;
  /** `Date.now()` when the percentage last actually moved. See `STALL_MS`. */
  movedAt: number | null;
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

let state: RepairState = {
  running: null,
  progress: null,
  outcome: null,
  startedAt: null,
  movedAt: null,
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
  const moved =
    state.progress === null ||
    state.progress.percent !== next.percent ||
    state.progress.step !== next.step;
  setState({ progress: next, movedAt: moved ? Date.now() : state.movedAt });
});

/** Starts a job. Safe to call from a card that is later unmounted: everything
 *  it touches is the store, which no longer belongs to any component. */
async function startRepair(job: RepairJob, onError: (message: string) => void) {
  if (state.running) return;
  const now = Date.now();
  setState({ running: job, progress: null, outcome: null, startedAt: now, movedAt: now });
  try {
    setState({ outcome: await invoke<RepairOutcome>("run_system_repair", { job }) });
  } catch (e) {
    onError(String(e));
  } finally {
    setState({ running: null, progress: null, startedAt: null, movedAt: null });
  }
}

/** The verdict's colour. Four states rather than pass/fail: the difference
 *  between "repairable" and "could not be repaired" is the whole point of
 *  running the check, and one shared red would throw away the only actionable
 *  thing the tool says. */
const STATUS_TONE: Record<RepairStatus, string> = {
  healthy: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
  repaired: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
  repairable: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  unrepairable: "bg-rose-400/15 text-rose-300 ring-rose-400/30",
  completed: "bg-surface-2 text-ink-2 ring-line",
};

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * DISM and SFC, with a progress bar and a direct question at the end.
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
  const { running, progress, outcome, startedAt, movedAt } = useSyncExternalStore(
    subscribe,
    getSnapshot,
  );
  const [showLog, setShowLog] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // One second is the resolution of both clocks below; anything faster would
  // repaint the card for no visible change.
  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const elapsed = startedAt === null ? 0 : now - startedAt;
  const stalled = movedAt !== null && progress !== null && now - movedAt > STALL_MS;

  const stepLabel: Record<string, string> = {
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
    // The read-only check is free; the two that change the machine are not.
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
  // Below 1% nothing has been reported yet: DISM starts silent, and a bar
  // pinned at zero for half a minute reads as a hang.
  const determinate = progress !== null && progress.percent >= 1;

  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
          <HeartPulseIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-ink">{s.systemRepair.title}</h2>
            <ShieldBadge label={s.badges.admin} />
          </div>
          <p className="mt-1 text-sm text-ink-3">{s.systemRepair.description}</p>
          <p className="mt-2 text-xs text-ink-3">{s.systemRepair.adminNote}</p>
        </div>
      </div>

      {/* Two actions, not three. The repair is offered by the result panel
          instead, where the answer to "is anything wrong" already is —
          running a twenty-minute repair before checking is the one order
          that reliably wastes the user's afternoon. Both are painted: an
          outline that only colours on hover reads as disabled until touched. */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => run("check")}
          disabled={running !== null}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-[0_8px_24px_-12px_theme(colors.emerald.400)] transition hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {running === "check" ? s.systemRepair.checking : s.systemRepair.checkButton}
        </button>
        <button
          onClick={() => run("component_cleanup")}
          disabled={running !== null}
          className="flex items-center gap-1.5 rounded-xl bg-sky-400/15 px-4 py-2 text-sm font-semibold text-sky-200 ring-1 ring-sky-400/30 transition hover:-translate-y-px hover:bg-sky-400/25 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {running === "component_cleanup"
            ? s.systemRepair.cleaningUp
            : s.systemRepair.cleanupButton}
          {!isPro && <ProBadge label={s.badges.pro} />}
        </button>
      </div>

      <p className="mt-2 text-xs text-ink-3">{s.systemRepair.cleanupNote}</p>

      {running && (
        <div className="mt-4 overflow-hidden rounded-xl bg-surface-2 p-4 ring-1 ring-line">
          <div className="flex items-center gap-3">
            {/* A turning ring rather than a spinner glyph: it reads as "still
                working" even at the long silences DISM leaves between updates. */}
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 shrink-0 animate-[ring-turn_1.1s_linear_infinite] rounded-full border-2 border-emerald-400/30 border-t-emerald-300"
            />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {progress ? (stepLabel[progress.step] ?? progress.step) : s.systemRepair.checking}
            </p>
            <span className="type-data shrink-0 text-[26px] font-black leading-none tracking-[-0.03em] tabular-nums text-emerald-300">
              {determinate ? `${Math.round(progress.percent)}%` : "—"}
            </span>
          </div>

          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-surface-1">
            {determinate ? (
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(2, progress.percent)}%` }}
              >
                {/* A slow sheen travelling the filled part. Without it a bar
                    that holds the same percentage for two minutes — which
                    RestoreHealth routinely does — looks frozen. */}
                <div
                  aria-hidden="true"
                  className="h-full w-1/3 animate-[pulse-sweep_2.2s_ease-in-out_infinite] bg-white/25"
                />
              </div>
            ) : (
              <div className="h-full w-1/3 animate-[defrag-sweep_1.6s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-emerald-400/40 via-emerald-300 to-emerald-400/40" />
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs tabular-nums text-ink-3">
              {format(s.systemRepair.elapsed, { time: clock(elapsed) })}
            </span>
            {progress && progress.step_total > 1 && (
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                {/* Pips rather than "step 1 of 2" alone: a two-step repair
                    that restarts its bar at the halfway mark otherwise looks
                    like it lost its progress. */}
                {Array.from({ length: progress.step_total }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${
                      i < progress.step_index ? "bg-emerald-300" : "bg-line"
                    }`}
                  />
                ))}
                {format(s.systemRepair.stepOf, {
                  index: progress.step_index,
                  total: progress.step_total,
                })}
              </span>
            )}
          </div>

          {/* Replaces the generic "this takes a while" note once the bar has
              genuinely stopped moving, because at that point the user is no
              longer asking how long it takes — they are asking whether it is
              still alive. */}
          {stalled && movedAt !== null ? (
            <p className="mt-2.5 text-xs leading-relaxed text-ink-2">
              {format(s.systemRepair.holdingAt, {
                percent: Math.round(progress.percent),
                time: clock(now - movedAt),
              })}
            </p>
          ) : (
            <p className="mt-2.5 text-xs text-ink-3">{s.systemRepair.timeNote}</p>
          )}
          <p className="mt-1 text-xs font-medium text-amber-300/85">{s.systemRepair.runningNote}</p>
        </div>
      )}

      {outcome && !running && (
        <div className="mt-4">
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ring-1 ${STATUS_TONE[outcome.status]}`}
          >
            {statusLabel[outcome.status]}
          </span>

          {needsRepair ? (
            /* The direct ask. A check that finds damage and then describes
               what the user could do next has stopped one step short of the
               only thing they wanted from it. */
            <div className="mt-3 rounded-xl bg-surface-2 p-4 ring-1 ring-line">
              <p className="text-sm font-semibold text-ink">{s.systemRepair.askRepair}</p>
              <p className="mt-1 text-xs text-ink-3">
                {outcome.status === "unrepairable"
                  ? s.systemRepair.hintUnrepairable
                  : s.systemRepair.timeNote}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => run("repair")}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-[0_8px_24px_-12px_theme(colors.emerald.400)] transition hover:-translate-y-px hover:brightness-110"
                >
                  {s.systemRepair.askRepairYes}
                  {!isPro && <ProBadge label={s.badges.pro} />}
                </button>
                <button
                  onClick={() => setState({ outcome: null })}
                  className="rounded-xl bg-surface-1 px-4 py-2 text-sm font-semibold text-ink-2 ring-1 ring-line transition-colors hover:text-ink"
                >
                  {s.systemRepair.askRepairNo}
                </button>
              </div>
            </div>
          ) : (
            <>
              {outcome.status === "completed" && (
                <p className="mt-2 text-sm text-ink-3">{s.systemRepair.hintCompleted}</p>
              )}
              {/* Still offered when the store checks out clean: SFC repairs
                  system files the component-store check never looks at, so
                  "healthy" is not the same as "nothing to fix". */}
              <button
                onClick={() => run("repair")}
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-ink-2 underline-offset-2 hover:underline"
              >
                {s.systemRepair.repairAnyway}
                {!isPro && <ProBadge label={s.badges.pro} />}
              </button>
            </>
          )}

          {log && (
            <>
              <button
                onClick={() => setShowLog((v) => !v)}
                className="mt-3 block text-xs font-semibold text-ink-3 underline-offset-2 hover:underline"
              >
                {s.systemRepair.logTitle}
              </button>
              {showLog && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-ink-3">
                  {log}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
