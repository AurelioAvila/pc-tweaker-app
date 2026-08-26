import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, Strings } from "../i18n";
import { formatBytes, gbPair, loadColor, RAM_AUTO_INTERVALS, ramIntervalLabel } from "../lib";
import { RamCleanResult, SystemStats, Toast } from "../types";
import { PulseSample, tracePoints } from "./command";
import { ChipIcon } from "./icons";

/**
 * Module-level so the manual button and the background scheduler share one
 * guard. Two `EmptyWorkingSet` passes racing over the same process list would
 * make the "freed" figure meaningless and double the work for nothing.
 */
let ramCleanInFlight = false;
export async function runRamClean(): Promise<RamCleanResult | null> {
  if (ramCleanInFlight) return null;
  ramCleanInFlight = true;
  try {
    return await invoke<RamCleanResult>("clean_ram");
  } finally {
    ramCleanInFlight = false;
  }
}

/** Hour and minute, the way the user's own system writes them. */
function clockTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function StatRing({
  label,
  sublabel,
  pct,
}: {
  label: string;
  sublabel: string;
  pct: number;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-line" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            stroke={loadColor(clamped)}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * clamped) / 100}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums text-ink">
          {Math.round(clamped)}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-2">{label}</p>
        <p className="truncate text-xs text-ink-3" title={sublabel}>
          {sublabel}
        </p>
      </div>
    </div>
  );
}

/**
 * Live snapshot of the machine, polled from the Rust side. Every number here
 * is read from the real system (sysinfo) — no synthetic "health score".
 */
export function SystemMonitor({ s }: { s: Strings }) {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      invoke<SystemStats>("system_stats")
        .then((v) => {
          // The backend call takes ~200ms (it needs two CPU samples), so the
          // component can unmount mid-flight — don't set state after that.
          if (alive) setStats(v);
        })
        .catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!stats) {
    return (
      <div className="mb-6 h-[104px] animate-pulse rounded-2xl border border-line bg-surface-1" />
    );
  }

  const ramPct = stats.ram_total > 0 ? (stats.ram_used / stats.ram_total) * 100 : 0;
  const diskPct = stats.disk_total > 0 ? (stats.disk_used / stats.disk_total) * 100 : 0;
  const hours = Math.floor(stats.uptime_secs / 3600);
  const minutes = Math.floor((stats.uptime_secs % 3600) / 60);

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface-1 p-5 backdrop-blur">
      <div className="grid gap-5 sm:grid-cols-3">
        <StatRing
          label={s.systemMonitor.cpu}
          sublabel={format(s.systemMonitor.cores, { count: stats.cpu_cores })}
          pct={stats.cpu_usage}
        />
        <StatRing
          label={s.systemMonitor.ram}
          sublabel={gbPair(stats.ram_used, stats.ram_total)}
          pct={ramPct}
        />
        <StatRing
          label={s.systemMonitor.disk}
          sublabel={gbPair(stats.disk_used, stats.disk_total)}
          pct={diskPct}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-3">
        <span className="truncate" title={stats.cpu_name}>
          {stats.cpu_name}
        </span>
        <span className="text-ink-3">•</span>
        <span>{stats.os_name}</span>
        <span className="text-ink-3">•</span>
        <span>
          {s.systemMonitor.uptime} {format(s.systemMonitor.uptimeValue, { hours, minutes })}
        </span>
      </div>
    </div>
  );
}

/** What the last automatic pass did, so the card can show that the schedule
 *  is real work and not just a setting that was clicked once. */
export type AutoCleanState = {
  next: Date;
  last: { at: Date; freedBytes: number } | null;
  /** The last failure, kept so a schedule that cannot run stops being silent. */
  lastError: string | null;
};

/** How often the scheduler wakes to check whether a pass is due. */
const HEARTBEAT_MS = 15_000;

/**
 * Runs the scheduled RAM cleanup for as long as the app is open.
 *
 * This deliberately lives in `App`, not in `RamCleaner`: the card only renders
 * on the Scan screen, so hosting the timer there meant switching to any other
 * tab unmounted it and silently stopped the automatic cleanup the user had
 * just switched on.
 *
 * It is a short heartbeat against a deadline rather than one long interval.
 * A `setInterval(…, 3_600_000)` in a webview is not a promise: the window
 * being minimised, the machine sleeping, or the browser engine throttling
 * background timers all stretch it, and when the app wakes the old timer
 * simply starts its full hour again — so "every hour" quietly became "maybe,
 * eventually". Checking a deadline every fifteen seconds means a pass that
 * came due while the app was idle runs as soon as it is awake, and the drift
 * never accumulates.
 */
export function useScheduledRamClean(autoMinutes: number): AutoCleanState | null {
  // The deadline lives in state because it is rendered, and is mirrored into a
  // ref because the heartbeat has to read the current value without being
  // re-created every time it changes.
  const [schedule, setSchedule] = useState(() => armFor(autoMinutes));
  const [last, setLast] = useState<{ at: Date; freedBytes: number } | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Adjusting state during render, not in an effect: React's own answer for
  // "a prop changed and some state derived from it is now stale". Doing it in
  // an effect would commit the stale schedule first and then immediately
  // re-render with the right one.
  if (schedule.minutes !== autoMinutes) {
    setSchedule(armFor(autoMinutes));
    setLast(null);
    setLastError(null);
  }

  const dueRef = useRef<number | null>(schedule.dueAt);
  useEffect(() => {
    dueRef.current = schedule.dueAt;
  }, [schedule.dueAt]);

  useEffect(() => {
    if (autoMinutes === 0) return;
    const periodMs = autoMinutes * 60_000;
    const id = window.setInterval(() => {
      const due = dueRef.current;
      if (due === null || Date.now() < due) return;
      // Re-arm before the run, not after: a slow pass must not push the next
      // one out by however long it took.
      const nextDue = Date.now() + periodMs;
      dueRef.current = nextDue;
      setSchedule({ minutes: autoMinutes, dueAt: nextDue });
      runRamClean()
        .then((result) => {
          // `null` means a pass was already in flight; nothing happened, so
          // the previous result stays on screen rather than being blanked.
          if (result) setLast({ at: new Date(), freedBytes: result.freed_bytes });
          setLastError(null);
        })
        .catch((e: unknown) => setLastError(String(e)));
    }, HEARTBEAT_MS);
    // Clearing on change/unmount is what guarantees exactly one timer is ever
    // alive, no matter how often the user changes the interval.
    return () => window.clearInterval(id);
  }, [autoMinutes]);

  if (schedule.dueAt === null) return null;
  return { next: new Date(schedule.dueAt), last, lastError };
}

/** The first pass is one full interval away: switching the schedule on should
 *  not sweep memory that instant, which would look like the button did
 *  something it was not asked to do. */
function armFor(minutes: number): { minutes: number; dueAt: number | null } {
  return { minutes, dueAt: minutes === 0 ? null : Date.now() + minutes * 60_000 };
}

/**
 * Asks Windows to page out the unused part of every process's working set —
 * the same thing Windows does on its own under memory pressure, just requested
 * early. Safe to run repeatedly, which is why it can also be scheduled.
 */
export function RamCleaner({
  s,
  samples,
  autoMinutes,
  onChangeAuto,
  auto,
  pushToast,
}: {
  s: Strings;
  samples: PulseSample[];
  autoMinutes: number;
  onChangeAuto: (minutes: number) => void;
  /** Live state of the background schedule, from `useScheduledRamClean`. */
  auto: AutoCleanState | null;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<RamCleanResult | null>(null);

  // Live figures come from the shared sampling loop rather than a second
  // poll of our own: one IPC feed, every home card in step.
  const latest = samples.length > 0 ? samples[samples.length - 1] : null;
  const usedPct = latest && latest.ramTotal > 0 ? (latest.ramUsed / latest.ramTotal) * 100 : 0;
  const TRACE_W = 560;
  const TRACE_H = 48;
  const trace = tracePoints(
    samples.map((x) => (x.ramTotal > 0 ? (x.ramUsed / x.ramTotal) * 100 : 0)),
    TRACE_W,
    TRACE_H,
    100,
  );

  async function cleanNow() {
    setBusy(true);
    try {
      const result = await runRamClean();
      // `null` means a scheduled pass was already running; the button simply
      // does nothing rather than queueing a second, pointless sweep.
      if (!result) return;
      setLast(result);
      pushToast(
        "success",
        result.freed_bytes > 0
          ? format(s.ram.freed, { amount: formatBytes(result.freed_bytes) })
          : s.ram.freedNothing,
      );
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusy(false);
    }
  }

  const chooseInterval = onChangeAuto;

  return (
    <div className="signal border-line bg-surface-1 relative mb-6 overflow-hidden rounded-2xl border p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="bg-accent-soft text-accent grid h-11 w-11 shrink-0 place-items-center rounded-xl">
          <ChipIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-ink font-semibold">{s.ram.title}</h2>
          <p className="text-ink-3 mt-0.5 text-sm">{s.ram.subtitle}</p>
        </div>
        <button
          onClick={() => void cleanNow()}
          disabled={busy}
          className="bg-accent text-on-accent shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold transition-transform hover:scale-[1.03] disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? s.ram.cleaning : s.ram.button}
        </button>
      </div>

      {/* Live memory line: the current figure in tabular digits plus the
          session's usage trace, so a trim's effect is visible as a dip in
          the very line the user just watched. */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="type-data text-ink text-[22px] font-bold leading-none">
            {latest ? formatBytes(latest.ramUsed) : "—"}
            <span className="text-ink-3 text-[13px] font-semibold">
              {" "}
              / {latest ? formatBytes(latest.ramTotal) : "—"}
            </span>
          </p>
        </div>
        <p className="type-data text-ink-3 shrink-0 text-[12.5px]">{Math.round(usedPct)}%</p>
      </div>
      <div className="mt-2">
        <svg
          viewBox={`0 0 ${TRACE_W} ${TRACE_H}`}
          preserveAspectRatio="none"
          className="h-12 w-full"
          aria-hidden="true"
        >
          {trace && (
            <>
              <polygon
                points={`${trace} ${TRACE_W},${TRACE_H} ${trace.split(" ")[0].split(",")[0]},${TRACE_H}`}
                fill="var(--app-accent)"
                opacity="0.08"
              />
              <polyline
                points={trace}
                fill="none"
                stroke="var(--app-accent)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
      </div>

      {last && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-sm ring-1 ring-[color-mix(in_oklab,var(--color-ok)_35%,transparent)]">
          <span className="text-ok font-semibold">
            {last.freed_bytes > 0
              ? format(s.ram.freed, { amount: formatBytes(last.freed_bytes) })
              : s.ram.freedNothing}
          </span>
          <span className="text-ink-3 text-xs">
            {format(s.ram.inUse, {
              used: formatBytes(last.ram_used_after),
              total: formatBytes(last.ram_total),
            })}
          </span>
        </div>
      )}

      <div className="border-line mt-4 border-t pt-3">
        <p className="text-ink-3 mb-2 text-xs font-semibold uppercase tracking-wide">
          {s.ram.autoLabel}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RAM_AUTO_INTERVALS.map((m) => (
            <button
              key={m}
              onClick={() => chooseInterval(m)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                autoMinutes === m
                  ? "bg-accent-soft text-accent ring-1 ring-[color-mix(in_oklab,var(--app-accent)_45%,transparent)]"
                  : "bg-surface-2 text-ink-3 hover:bg-surface-hover hover:text-ink-2"
              }`}
            >
              {ramIntervalLabel(m, s)}
            </button>
          ))}
        </div>
        {autoMinutes > 0 && (
          <p className="text-ink-3 mt-2 text-xs leading-relaxed">{s.ram.autoHint}</p>
        )}

        {/* A schedule you cannot see is a schedule you cannot trust. This is
            the timer's actual state: when the next pass is due, and what the
            last one did. */}
        {auto !== null && (
          <div className="well mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
            <span className="type-data text-[11.5px] text-ink-2">
              {format(s.ram.autoNext, { time: clockTime(auto.next) })}
            </span>
            {auto.last !== null && (
              <span className="type-data text-[11.5px] text-ink-3">
                {format(s.ram.autoLast, {
                  time: clockTime(auto.last.at),
                  amount: formatBytes(auto.last.freedBytes),
                })}
              </span>
            )}
            {auto.last === null && auto.lastError === null && (
              <span className="text-[11.5px] text-ink-3">{s.ram.autoNoneYet}</span>
            )}
            {auto.lastError !== null && (
              <span className="text-warn text-[11.5px]">
                {format(s.ram.autoFailed, { detail: auto.lastError })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
