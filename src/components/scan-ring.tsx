// The Scan's progress ring: the Fix all ring (fix-progress.tsx), driven by the
// scan's own checks. The checks run side by side and finish in any order, so
// the list ticks them off in the order they really finished. Each one stays
// the current check for its share of SCAN_MIN_MS (scanDwellMs) and is never
// ticked before it has really finished; the percentage fills its slice over
// that time (scanRingTarget). Once the scan has returned and the last check
// is ticked it reaches 100, turns into a check, then the results open.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { format, type Lang } from "../i18n";
import {
  SCAN_PROBES,
  scanDwellMs,
  scanRingTarget,
  type ProbeStatus,
  type ScanProbe,
} from "../scan-runner";
import type { ScanProgress } from "../types";
import { bringIntoView, CheckMark, ProgressDial, useReducedMotion } from "./fix-progress";
import { FIX_PROGRESS_COPY } from "./fix-progress-copy";
import { SCAN_COPY } from "./scan-copy";

/** The check after 100 %, before the results replace the ring. */
const SUCCESS_MS = 750;
const SUCCESS_REDUCED_MS = 250;
/** Rows of the list on screen; the rest slides through. */
const ROWS = 5;

/** Finished checks in the order they finished, then the ones still reading,
 *  then the ones not started. */
function rowsOf(
  order: readonly ScanProbe[],
  states: Partial<Record<ScanProbe, ProbeStatus>>,
): ScanProbe[] {
  const rest = SCAN_PROBES.filter((p) => !order.includes(p));
  return [
    ...order,
    ...rest.filter((p) => states[p] === "reading"),
    ...rest.filter((p) => states[p] !== "reading"),
  ];
}

export function ScanRing({
  lang,
  order,
  states,
  driver,
  finished,
  paused,
  elapsed,
  unavailable,
  controls,
  onTicked,
  onRevealed,
}: {
  lang: Lang;
  /** Finished checks, in the order they finished. */
  order: readonly ScanProbe[];
  states: Partial<Record<ScanProbe, ProbeStatus>>;
  driver: ScanProgress | null;
  /** The scan has returned with every check read. */
  finished: boolean;
  paused: boolean;
  /** Seconds. */
  elapsed: number;
  /** The word for a check that could not be read. */
  unavailable: string;
  /** Pause / Stop, or Resume / End scan. */
  controls: ReactNode;
  /** How many checks the list has ticked off, for the scope list beside it. */
  onTicked: (count: number) => void;
  /** 100 % and the check have been shown. */
  onRevealed: () => void;
}) {
  const c = SCAN_COPY[lang];
  const f = FIX_PROGRESS_COPY[lang];
  const reduced = useReducedMotion();
  const box = useRef<HTMLElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const latest = useRef({ order, states, driver, finished, paused, onTicked, onRevealed });
  useLayoutEffect(() => {
    latest.current = { order, states, driver, finished, paused, onTicked, onRevealed };
  });
  // Checks already finished when the ring appears (a resumed scan) are
  // ticked at once; the loop's position survives a change of motion setting.
  const loop = useRef({ shown: order.length, percent: -1 });
  const [view, setView] = useState({ shown: order.length, coarse: 0, success: false });

  useEffect(() => {
    // The Scan button that started it is gone.
    bringIntoView(box.current, "nearest");
  }, []);

  useEffect(() => {
    const successMs = reduced ? SUCCESS_REDUCED_MS : SUCCESS_MS;
    let frame = 0;
    let last = performance.now();
    /** When the current check became the current one. */
    let headStart = last;
    let successAt: number | null = null;
    let told = false;
    let reported = { shown: -1, coarse: -1, success: false };

    const tick = (now: number) => {
      const r = latest.current;
      const state = loop.current;
      // Paused, the walk through the checks stands still.
      if (r.paused) headStart += now - last;
      const rows = rowsOf(r.order, r.states);
      let head: ScanProbe | null = rows[state.shown] ?? null;
      if (head && state.shown < r.order.length && now - headStart >= scanDwellMs(head)) {
        const due = headStart + scanDwellMs(head);
        state.shown++;
        // On time, the next check starts where this one's time ended; late
        // (it was still reading, or the window was hidden), from now.
        headStart = now - due < 250 ? due : now;
        head = rows[state.shown] ?? null;
      }
      const target = scanRingTarget({
        ticked: r.order.slice(0, state.shown),
        head,
        headDone: state.shown < r.order.length,
        headMs: now - headStart,
        finished: r.finished,
      });
      // Smooth, never backwards, never past the target.
      const ease = reduced ? 1 : 1 - Math.exp(-(now - last) / (target === 100 ? 120 : 240));
      state.percent =
        state.percent < 0
          ? target
          : Math.max(state.percent, state.percent + (target - state.percent) * ease);
      if (target === 100 && state.percent > 99.5) state.percent = 100;
      last = now;

      if (state.percent === 100 && successAt === null) successAt = now;
      if (successAt !== null && !told && now - successAt >= successMs) {
        told = true;
        r.onRevealed();
      }
      if (arc.current) arc.current.style.strokeDashoffset = String(100 - state.percent);
      if (number.current) number.current.textContent = String(Math.floor(state.percent));
      const next = {
        shown: state.shown,
        coarse: Math.floor(state.percent / 10) * 10,
        success: successAt !== null,
      };
      if (
        next.shown !== reported.shown ||
        next.coarse !== reported.coarse ||
        next.success !== reported.success
      ) {
        if (next.shown !== reported.shown) r.onTicked(next.shown);
        reported = next;
        setView(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  const rows = rowsOf(order, states);
  const shown = Math.min(view.shown, rows.length);
  const active = view.success ? null : (rows[shown] ?? null);
  const name = (p: ScanProbe) => c.probes[SCAN_PROBES.indexOf(p)];
  const label = view.success
    ? c.presenting
    : paused
      ? c.paused
      : active && (states[active] === "reading" || order.includes(active))
        ? name(active)
        : shown >= SCAN_PROBES.length
          ? c.presenting
          : c.running;
  const offset = Math.max(0, Math.min(shown - 2, rows.length - ROWS));
  const percent = view.success ? 100 : view.coarse;
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const detail = paused
    ? format(c.pausedLine, { done: shown, total: SCAN_PROBES.length })
    : active === "driver_audit" && !order.includes(active)
      ? driver
        ? `${driver.class} · ${driver.done} / ${driver.total} ${c.deviceClasses}`
        : c.waitingWindows
      : `${shown} / ${SCAN_PROBES.length} ${c.sources}`;

  return (
    <section
      ref={box}
      tabIndex={-1}
      className="fixp scan-ring"
      data-state={view.success ? "success" : paused ? "paused" : "running"}
      aria-labelledby="scan-ring-title"
      aria-busy={!view.success}
    >
      <div className="fixp-body">
        <ProgressDial
          arc={arc}
          number={number}
          label={f.progress}
          valueNow={percent}
          valueText={format(f.live, { percent, step: label })}
        />
        <div className="fixp-side">
          <h2 className="fixp-title" id="scan-ring-title">
            {c.running}
          </h2>
          <p className="fixp-current">{label}</p>
          <p className="scan-ring-detail">
            <span>{detail}</span>
            <span>
              {c.elapsed} {clock}
            </span>
          </p>
          <div
            className="scan-ring-window"
            data-above={offset > 0 || undefined}
            data-below={offset < rows.length - ROWS || undefined}
          >
            <ol
              className="fixp-steps"
              role="list"
              style={{ transform: `translateY(calc(var(--scan-ring-row) * ${-offset}))` }}
            >
              {rows.map((probe, i) => {
                const failed = states[probe] === "unavailable";
                const state =
                  i < shown || view.success
                    ? failed
                      ? "failed"
                      : "done"
                    : i === shown && !paused
                      ? "active"
                      : "todo";
                return (
                  <li key={probe} data-state={state}>
                    <span className="fixp-mark" aria-hidden="true">
                      {state === "done" ? <CheckMark /> : state === "failed" ? "!" : null}
                    </span>
                    <span className="fixp-step">{name(probe)}</span>
                    {state === "failed" && <span className="fixp-result">{unavailable}</span>}
                  </li>
                );
              })}
            </ol>
          </div>
          {paused && <p className="fixp-hint">{c.pausedHint}</p>}
          {/* Usable until 100 %: the reads may be over while the ring still
              walks through them (Pause holds it, Stop opens the results).
              Kept in place after, so the card does not jump shorter. */}
          <div className="scan-ring-controls" data-done={view.success || undefined}>
            {controls}
          </div>
        </div>
      </div>
      {/* Read out at every quarter, on pause and at the end; not at each of
          the 19 checks. */}
      <span className="sr-only" role="status" aria-live="polite">
        {format(f.live, {
          percent: view.success ? 100 : Math.floor(view.coarse / 25) * 25,
          step: view.success ? c.presenting : paused ? c.paused : c.running,
        })}
      </span>
    </section>
  );
}
