// The progress ring of a running fix (the Scan's Fix all, Safe optimize, a
// profile): a large ring with the percentage inside, the step running now and
// every step ticking off with what it measured.
//
// The ring only moves between real milestones (fix-steps.ts): each step's
// slice fills when the step has really finished. While a step runs the ring
// eases towards the end of its slice without reaching it, and every finished
// step stays on screen for a short moment so the list reads in order. The
// last step done, it fills to 100 %, turns into a check, and tells the proof
// card it may open (`proofRevealed`).
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { format, type Lang } from "../i18n";
import { formatBytes, formatNumber, uiLocale } from "../lib";
import { bands, creep, type FixStep } from "../fix-steps";
import { FIX_PROGRESS_COPY } from "./fix-progress-copy";
import { PROOF_COPY } from "./proof-copy";
import { proofRevealed, registerInlineProgress, useProofRun } from "./proof-card";
import "./fix-progress.css";

/** How long a finished step stays the current one, so it can be read. */
const HOLD_MS = 600;
const HOLD_REDUCED_MS = 200;
/** The check after 100 %, before the card opens. */
const SUCCESS_MS = 900;
const SUCCESS_REDUCED_MS = 250;

function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduced;
}

type Copy = (typeof FIX_PROGRESS_COPY)[Lang];

function clock(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString(uiLocale(), { timeStyle: "short" });
}

/** The measured result of a finished step, or "" when it has none. */
function resultOf(step: FixStep, c: Copy): string {
  if (step.id === "restore_point") {
    const r = step.restore;
    if (!r) return step.failed ? c.restoreNone : "";
    if (r.kind === "created" && r.at) return format(c.restoreCreated, { time: clock(r.at) });
    if (r.kind === "reused" && r.at) return format(c.restoreReused, { time: clock(r.at) });
    if (r.kind === "unverified") return c.restoreRequested;
    return c.restoreNone;
  }
  if (step.id === "measure_before" || step.id === "measure_after")
    return step.failed ? c.notMeasured : "";
  if (step.id === "booster") return step.failed ? c.incomplete : c.on;
  if (step.bytes !== undefined)
    return format(step.id === "memory" ? c.released : c.freed, { size: formatBytes(step.bytes) });
  if (step.count !== undefined)
    return format(step.id === "registry" || step.id === "system_registry" ? c.removed : c.applied, {
      count: formatNumber(step.count),
    });
  return step.failed ? c.incomplete : "";
}

function CheckMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" pathLength={1} />
    </svg>
  );
}

/**
 * Renders while a proof runs (null otherwise). `inline`: shown in place on a
 * screen (the Scan, the Safe optimize card), which keeps the proof dialog
 * from showing a second ring.
 */
export function FixProgress({
  lang,
  inline = false,
  titleId,
}: {
  lang: Lang;
  inline?: boolean;
  titleId?: string;
}) {
  const run = useProofRun();
  const c = FIX_PROGRESS_COPY[lang];
  const reduced = useReducedMotion();
  const ownId = useId();
  const headingId = titleId ?? ownId;
  const gradientId = `${ownId}-arc`;
  const box = useRef<HTMLElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const latest = useRef(run);
  useLayoutEffect(() => {
    latest.current = run;
  });
  /** `shown`: the step on screen as the current one; `coarse`: the
   *  percentage in tens, for assistive technology. */
  const [view, setView] = useState({ shown: 0, coarse: 0, success: false });

  useEffect(() => {
    if (!inline) return;
    // The button that started the fix is gone: keep the keyboard here.
    box.current?.focus({ preventScroll: true });
    return registerInlineProgress();
  }, [inline]);

  useEffect(() => {
    const hold = reduced ? HOLD_REDUCED_MS : HOLD_MS;
    const successMs = reduced ? SUCCESS_REDUCED_MS : SUCCESS_MS;
    let frame = 0;
    let last = performance.now();
    let since = last;
    let shown = 0;
    let percent = 0;
    let successAt: number | null = null;
    let told = false;
    let reported = { shown: -1, coarse: -1, success: false };

    const tick = (now: number) => {
      const r = latest.current;
      if (!r) return;
      const steps = r.steps;
      const band = bands(steps);
      // A finished step stays current for `hold`, then the next one shows.
      while (shown < steps.length && steps[shown].state === "done" && now - since >= hold) {
        shown++;
        since = now;
      }
      let target: number;
      if (shown >= steps.length)
        target = r.phase === "finishing" ? 100 : (band[band.length - 1]?.[1] ?? 100);
      else if (steps[shown].state === "done") target = band[shown][1];
      else target = creep(band[shown], now - since, steps[shown].id);
      // Smooth, never backwards.
      const ease = reduced ? 1 : 1 - Math.exp(-(now - last) / 240);
      percent = Math.max(percent, percent + (target - percent) * ease);
      if (target === 100 && percent > 99.5) percent = 100;
      last = now;

      if (percent === 100 && successAt === null) successAt = now;
      if (successAt !== null && !told && now - successAt >= successMs) {
        told = true;
        proofRevealed();
      }
      if (arc.current) arc.current.style.strokeDashoffset = String(100 - percent);
      if (number.current) number.current.textContent = String(Math.floor(percent));
      const next = {
        shown,
        coarse: Math.floor(percent / 10) * 10,
        success: successAt !== null,
      };
      if (
        next.shown !== reported.shown ||
        next.coarse !== reported.coarse ||
        next.success !== reported.success
      ) {
        reported = next;
        setView(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  if (!run) return null;
  const steps = run.steps;
  const current = view.shown < steps.length ? steps[view.shown] : null;
  const label = view.success || !current ? c.complete : c.steps[current.id][1];
  const title =
    run.source === "scan" ? c.titleScan : run.source === "safe" ? c.titleSafe : c.titleProfile;
  const proof = PROOF_COPY[lang];
  const hint =
    current && current.state !== "done"
      ? current.id.startsWith("measure")
        ? proof.idle
        : run.admin && (current.id === "restore_point" || current.id.startsWith("system_"))
          ? proof.adminHint
          : ""
      : "";

  return (
    <section
      ref={box}
      tabIndex={-1}
      className="fixp"
      data-inline={inline || undefined}
      data-state={view.success ? "success" : "running"}
      aria-labelledby={headingId}
      aria-busy={!view.success}
    >
      <div className="fixp-body">
        <div
          className="fixp-dial"
          role="progressbar"
          aria-label={c.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.success ? 100 : view.coarse}
          aria-valuetext={format(c.live, {
            percent: view.success ? 100 : view.coarse,
            step: label,
          })}
        >
          <svg className="fixp-ring" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" className="fixp-stop-a" />
                <stop offset="100%" className="fixp-stop-b" />
              </linearGradient>
            </defs>
            <circle className="fixp-track" cx="100" cy="100" r="88" />
            <circle
              ref={arc}
              className="fixp-arc"
              cx="100"
              cy="100"
              r="88"
              pathLength={100}
              strokeDasharray="100"
              strokeDashoffset="100"
              stroke={`url(#${gradientId})`}
            />
          </svg>
          <span className="fixp-percent" aria-hidden="true">
            <span ref={number} className="fixp-number">
              0
            </span>
            <small>%</small>
          </span>
          <CheckMark className="fixp-check" />
        </div>
        <div className="fixp-side">
          <h2 className="fixp-title" id={headingId}>
            {title}
          </h2>
          <p className="fixp-current">{label}</p>
          <ol className="fixp-steps" role="list">
            {steps.map((step, i) => {
              const state =
                i < view.shown || view.success
                  ? step.failed
                    ? "failed"
                    : "done"
                  : i === view.shown
                    ? "active"
                    : "todo";
              const result = state === "done" || state === "failed" ? resultOf(step, c) : "";
              return (
                <li key={step.id} data-state={state}>
                  <span className="fixp-mark" aria-hidden="true">
                    {state === "done" ? <CheckMark /> : state === "failed" ? "!" : null}
                  </span>
                  <span className="fixp-step">{c.steps[step.id][0]}</span>
                  {result && <span className="fixp-result">{result}</span>}
                </li>
              );
            })}
          </ol>
          {hint && <p className="fixp-hint">{hint}</p>}
        </div>
      </div>
      {/* Read out when the step changes and at every quarter. */}
      <span className="sr-only" role="status" aria-live="polite">
        {format(c.live, {
          percent: view.success ? 100 : Math.floor(view.coarse / 25) * 25,
          step: label,
        })}
      </span>
    </section>
  );
}
