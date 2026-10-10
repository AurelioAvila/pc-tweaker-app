import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { format, type Lang, type Strings } from "../i18n";
import { textFor } from "../lib";
import type { ScanProgress, Section, Toast } from "../types";
import {
  applyScanSelection,
  LAST_SCAN_KEY,
  readLastScan,
  newScanSession,
  recommendedTweaks,
  optionalScanTweaks,
  runScanSession,
  scanProgress,
  scanReport,
  SCAN_PROBES,
  scanObservations,
  unknownSecuritySignals,
  type ProbeStatus,
  type ScanProbe,
  type ScanReport,
  type ScanSession,
} from "../scan-runner";
import { CheckIcon } from "./icons";
import { Badge } from "./ui";
import { SCAN_COPY } from "./scan-copy";
import "./scan-workspace.css";
import { TechnicalDetails } from "./technical";

/** A paused scan outlives the page, like a running repair does: leaving Scan
 *  and coming back finds it where it was. Memory only, so closing the app
 *  discards it. */
let heldScan: { session: ScanSession; driver: ScanProgress | null; elapsed: number } | null = null;

function probesOf(session: ScanSession): Partial<Record<ScanProbe, ProbeStatus>> {
  return Object.fromEntries(
    SCAN_PROBES.flatMap((p) => (session.steps[p] ? [[p, session.steps[p].state]] : [])),
  );
}

function stepTimesOf(session: ScanSession): Partial<Record<ScanProbe, number>> {
  return Object.fromEntries(
    SCAN_PROBES.flatMap((p) => (session.steps[p] ? [[p, session.steps[p].at]] : [])),
  );
}

export function ScanPanel({
  s,
  lang,
  isPro,
  onFixed,
  pushToast,
  onNavigate,
  onBusyChange,
}: {
  s: Strings;
  lang: Lang;
  isPro: boolean;
  onFixed: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
  onNavigate: (section: Section) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const c = SCAN_COPY[lang];
  const [report, setReport] = useState<ScanReport | null>(() =>
    heldScan ? scanReport(heldScan.session) : null,
  );
  const [lastScan, setLastScan] = useState(() => readLastScan(localStorage.getItem(LAST_SCAN_KEY)));
  const [reading, setReading] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [progress, setProgress] = useState(() =>
    heldScan ? Math.floor(scanProgress(heldScan.session.steps, heldScan.driver)) : 0,
  );
  const [driverProgress, setDriverProgress] = useState<ScanProgress | null>(
    () => heldScan?.driver ?? null,
  );
  const [elapsed, setElapsed] = useState(() => heldScan?.elapsed ?? 0);
  const [probes, setProbes] = useState<Partial<Record<ScanProbe, ProbeStatus>>>(() =>
    heldScan ? probesOf(heldScan.session) : {},
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [outcome, setOutcome] = useState<Awaited<ReturnType<typeof applyScanSelection>> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(() => heldScan !== null);
  const [halting, setHalting] = useState(false);
  const [stepTimes, setStepTimes] = useState<Partial<Record<ScanProbe, number>>>(() =>
    heldScan ? stepTimesOf(heldScan.session) : {},
  );
  const operation = useRef(false);
  const abort = useRef<AbortController | null>(null);
  /** Why the running scan was aborted: kept for a resume, or ended. */
  const intent = useRef<"pause" | "stop" | null>(null);
  const alive = useRef(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const results = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Leaving the page pauses a running scan: it is still there on return.
      if (abort.current && !abort.current.signal.aborted) {
        intent.current = "pause";
        abort.current.abort();
        void invoke("cancel_scan").catch(() => undefined);
      }
    };
  }, []);
  useEffect(() => {
    if (reviewIds !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [reviewIds]);
  useEffect(() => {
    if (report && !paused) {
      results.current?.focus({ preventScroll: true });
      results.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [report, paused]);

  const fixes = report ? recommendedTweaks(report, isPro) : [];
  const lockedFixes =
    report && !isPro ? recommendedTweaks(report, true).filter((t) => t.requires_pro) : [];
  const optional = report ? optionalScanTweaks(report) : [];
  const observations = report ? scanObservations(report) : [];
  const unknownSecurity = report ? unknownSecuritySignals(report) : [];
  const selectedFixes = fixes.filter((t) => selected.includes(t.id));
  const reviewFixes = fixes.filter((t) => reviewIds?.includes(t.id));
  const complete = Object.values(probes).filter((p) => p === "complete").length;

  /** Stops the reads in flight. `pause` keeps everything finished for a
   *  resume; `stop` ends the scan and shows what it had. Read-only either way. */
  function halt(why: "pause" | "stop") {
    const controller = abort.current;
    if (!controller || controller.signal.aborted) return;
    intent.current = why;
    setHalting(true);
    controller.abort();
    void invoke("cancel_scan").catch(() => undefined);
  }

  /** Ends a scan where it is and shows what it found, labelled partial. */
  function end(session: ScanSession) {
    heldScan = null;
    void invoke("discard_scan_session", { session: session.id }).catch(() => undefined);
    const partial = scanReport(session);
    setPaused(false);
    setReport(partial);
    setSelected(recommendedTweaks(partial, isPro).map((t) => t.id));
    remember(partial);
  }

  function remember(next: ScanReport) {
    // An attempt that read nothing must not replace the last completed scan.
    if (next.unavailable.length + next.skipped.length >= SCAN_PROBES.length) return;
    const stamp = {
      at: next.at,
      partial: next.partial || unknownSecuritySignals(next).length > 0,
    };
    setLastScan(stamp);
    try {
      localStorage.setItem(LAST_SCAN_KEY, JSON.stringify(stamp));
    } catch {
      /* Storage is optional. */
    }
  }

  async function scan(resume = false) {
    if (operation.current) return;
    operation.current = true;
    const controller = new AbortController();
    abort.current = controller;
    intent.current = null;
    const held = resume ? heldScan : null;
    heldScan = null;
    const session = held?.session ?? newScanSession();
    let driver: ScanProgress | null = held?.driver ?? null;
    const elapsedBefore = held?.elapsed ?? 0;
    const startedAt = performance.now();
    setPaused(false);
    setPresenting(false);
    setReading(true);
    setReport(null);
    setOutcome(null);
    setError("");
    if (!held) {
      setProgress(0);
      setDriverProgress(null);
      setElapsed(0);
      setProbes({});
      setStepTimes({});
    }
    let target = scanProgress(session.steps, driver);
    let displayed = target;
    let lastFrame = startedAt;
    let seconds = elapsedBefore;
    const states: Partial<Record<ScanProbe, ProbeStatus>> = probesOf(session);
    let off: UnlistenFn | undefined;
    let finishAnimation!: () => void;
    const animationFinished = new Promise<void>((resolve) => {
      finishAnimation = resolve;
    });
    const updateTarget = () => {
      // Keep 100% reserved for the complete report, not the final progress event.
      target = Math.max(target, scanProgress(session.steps, driver));
    };
    const animation = window.setInterval(() => {
      if (!alive.current) {
        window.clearInterval(animation);
        finishAnimation();
        return;
      }
      const now = performance.now();
      // Ease towards completed work; no minimum duration or scripted stage pauses.
      displayed += (target - displayed) * (1 - Math.exp(-(now - lastFrame) / 180));
      if (target - displayed < 0.1) displayed = target;
      lastFrame = now;
      seconds = elapsedBefore + Math.floor((now - startedAt) / 1000);
      setProgress(Math.floor(displayed));
      setElapsed(seconds);
      if (displayed >= 100) finishAnimation();
    }, 32);
    try {
      // Register before invoking the audit so the first device-class event is retained.
      off = await listen<ScanProgress>("driver-scan-progress", ({ payload }) => {
        if (!alive.current || states.driver_audit !== "reading") return;
        if (
          !Number.isInteger(payload.done) ||
          !Number.isInteger(payload.total) ||
          payload.total <= 0 ||
          payload.done < 0 ||
          payload.done > payload.total ||
          typeof payload.class !== "string"
        )
          return;
        driver = payload;
        setDriverProgress(payload);
        updateTarget();
      }).catch(() => undefined);
      const done = await runScanSession(
        invoke,
        session,
        (probe, state) => {
          states[probe] = state;
          if (!alive.current) return;
          updateTarget();
          setProbes((current) => ({ ...current, [probe]: state }));
          const at = session.steps[probe]?.at;
          if (at) setStepTimes((current) => ({ ...current, [probe]: at }));
        },
        controller.signal,
      );
      if (!done) {
        if (intent.current === "stop") {
          if (alive.current) end(session);
          else heldScan = null;
        } else {
          // Paused, by the button or by leaving the page.
          heldScan = { session, driver, elapsed: seconds };
          if (alive.current) {
            setPaused(true);
            setProgress(Math.floor(scanProgress(session.steps, driver)));
            setProbes(probesOf(session));
            setReport(scanReport(session));
            setSelected([]);
          }
        }
        return;
      }
      if (!alive.current) return;
      setPresenting(true);
      target = 100;
      await animationFinished;
      if (!alive.current) return;
      window.clearInterval(animation);
      setProgress(100);
      const next = scanReport(session);
      setReport(next);
      setSelected(recommendedTweaks(next, isPro).map((t) => t.id));
      remember(next);
    } catch (e) {
      if (alive.current) setError(String(e));
    } finally {
      off?.();
      window.clearInterval(animation);
      finishAnimation();
      if (abort.current === controller) abort.current = null;
      operation.current = false;
      if (alive.current) {
        setReading(false);
        setPresenting(false);
        setHalting(false);
      }
    }
  }

  async function apply() {
    if (operation.current || !report || !reviewFixes.length) return;
    const ids = reviewFixes.map((t) => t.id);
    operation.current = true;
    onBusyChange?.(true);
    setApplying(true);
    setReviewIds(null);
    setError("");
    try {
      const result = await applyScanSelection(invoke, report, isPro, ids);
      setOutcome(result);
      // Unknown final states cannot be offered for a second blind application.
      setReport({ ...report, tweaks: result.tweaks, advice: result.advice, ids: result.ids });
      setSelected([]);
      if (result.fixed.length)
        pushToast("success", format(s.scan.fixedToast, { count: result.fixed.length }));
      try {
        await onFixed();
      } catch (e) {
        setError(String(e));
      }
      results.current?.focus();
    } catch (e) {
      setError(String(e));
    } finally {
      operation.current = false;
      setApplying(false);
      onBusyChange?.(false);
    }
  }

  return (
    <section className="scan-workspace" aria-busy={reading || applying}>
      <div
        className="scan-hero"
        data-scanning={reading || paused}
        data-presenting={presenting}
        data-complete={!!report && !paused}
      >
        <div className="scan-hero-copy">
          <p className="scan-eyebrow">{c.eyebrow}</p>
          <h2>{c.title}</h2>
          <p className="scan-intro">{c.intro}</p>
          <div className="scan-hero-actions">
            <button
              className="scan-primary scan-launch"
              onClick={() => void scan()}
              disabled={reading || applying || paused}
              aria-label={
                reading
                  ? presenting
                    ? c.presenting
                    : c.running
                  : report
                    ? s.scan.scanAgain
                    : c.start
              }
            >
              <svg className="scan-launch-ring" viewBox="0 0 180 180" aria-hidden="true">
                <circle cx="90" cy="90" r="88" />
                <circle
                  className="scan-launch-progress"
                  cx="90"
                  cy="90"
                  r="88"
                  pathLength="100"
                  strokeDasharray="100"
                  strokeDashoffset={reading || paused ? 100 - progress : 0}
                />
              </svg>
              {reading || paused ? (
                <span className="scan-launch-percent" aria-hidden="true">
                  {progress}
                  <small>%</small>
                </span>
              ) : (
                <span className="scan-launch-symbol" aria-hidden="true">
                  <svg viewBox="0 0 32 32" fill="none">
                    <circle cx="13.5" cy="13.5" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="m20 20 7 7"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              )}
              <span className="scan-launch-label">
                {paused
                  ? c.paused
                  : reading
                    ? presenting
                      ? c.finishing
                      : c.scanning
                    : report
                      ? s.scan.scanAgain
                      : c.start}
              </span>
            </button>
            {reading && !presenting && (
              <div className="scan-run-controls">
                <button
                  type="button"
                  className="scan-secondary"
                  onClick={() => halt("pause")}
                  disabled={halting}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="4" y="3.5" width="2.6" height="9" rx="1" fill="currentColor" />
                    <rect x="9.4" y="3.5" width="2.6" height="9" rx="1" fill="currentColor" />
                  </svg>
                  {c.pause}
                </button>
                <button
                  type="button"
                  className="scan-secondary"
                  onClick={() => halt("stop")}
                  disabled={halting}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
                  </svg>
                  {c.stop}
                </button>
              </div>
            )}
            {paused && (
              <div className="scan-run-controls">
                <button type="button" className="scan-primary" onClick={() => void scan(true)}>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M5 3.5v9l7.5-4.5Z" fill="currentColor" />
                  </svg>
                  {c.resume}
                </button>
                <button
                  type="button"
                  className="scan-secondary"
                  onClick={() => heldScan && end(heldScan.session)}
                >
                  {c.finish}
                </button>
              </div>
            )}
            <span className="scan-last" hidden={reading || paused}>
              {lastScan
                ? format(s.scan.lastScan, { time: new Date(lastScan.at).toLocaleString(lang) })
                : s.scan.neverScanned}
              {lastScan?.partial && <small className="block">{c.partial}</small>}
            </span>
          </div>
          {reading && (
            <div className="scan-progress-block" role="status">
              <div className="scan-live-stage">
                <span className="scan-spinner" aria-hidden="true" />
                {presenting
                  ? c.presenting
                  : (c.probes[SCAN_PROBES.findIndex((probe) => probes[probe] === "reading")] ??
                    c.running)}
              </div>
              {!presenting && probes.driver_audit === "reading" && (
                <div className="scan-driver-detail">
                  <span>{driverProgress?.class || c.discovering}</span>
                  <span>
                    {driverProgress
                      ? `${driverProgress.done} / ${driverProgress.total} ${c.deviceClasses}`
                      : c.waitingWindows}
                  </span>
                </div>
              )}
              <div className="scan-progress-caption">
                <span>
                  {complete} / {SCAN_PROBES.length} {c.sources}
                </span>
                <span>
                  {c.elapsed} {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                </span>
              </div>
              <progress className="sr-only" max="100" value={progress} aria-label={c.running} />
            </div>
          )}
          {paused && (
            <div className="scan-progress-block" role="status">
              <div className="scan-live-stage">
                {format(c.pausedLine, { done: complete, total: SCAN_PROBES.length })}
              </div>
              <p className="scan-paused-hint">{c.pausedHint}</p>
              <div className="scan-progress-caption">
                <span>
                  {complete} / {SCAN_PROBES.length} {c.sources}
                </span>
                <span>
                  {c.elapsed} {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                </span>
              </div>
            </div>
          )}
          {report && !paused && (
            <div className="scan-result-counts" aria-live="polite">
              <div>
                <strong>{fixes.length + lockedFixes.length}</strong>
                <span>{c.recommendations}</span>
              </div>
              <div>
                <strong>{observations.length + optional.length}</strong>
                <span>{c.review}</span>
              </div>
              <div>
                <strong>
                  {complete}
                  <small> / {SCAN_PROBES.length}</small>
                </strong>
                <span>{c.sources}</span>
              </div>
            </div>
          )}
        </div>
        <aside className="scan-scope">
          <details open={paused || undefined}>
            <summary>
              <span>{c.scope}</span>
              <span className="scan-scope-count">
                {SCAN_PROBES.length}
                <small>{c.newChecks}</small>
              </span>
            </summary>
            <ol>
              {SCAN_PROBES.map((probe, i) => (
                <li key={probe} data-state={probes[probe] || "idle"}>
                  <span className="scan-probe-mark" aria-hidden="true">
                    {probes[probe] === "complete" ? (
                      <CheckIcon className="h-3 w-3" />
                    ) : probes[probe] === "unavailable" ? (
                      "!"
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <span className="scan-probe-copy">
                    {c.probes[i]}
                    {i >= 10 && <small>{c.newDetails[i - 10]}</small>}
                  </span>
                  {probes[probe] === "unavailable" && (
                    <span className="scan-probe-note">{s.scan.unavailable}</span>
                  )}
                  {(paused || !!report?.skipped.length) && stepTimes[probe] && (
                    <time className="scan-probe-time">{clock(stepTimes[probe])}</time>
                  )}
                </li>
              ))}
            </ol>
          </details>
        </aside>
      </div>

      {report && report.skipped.length > 0 && (
        <div className="scan-stopped" role="status">
          <strong>{paused ? c.paused : c.partialTitle}.</strong>{" "}
          {format(c.partialBody, {
            done: SCAN_PROBES.length - report.skipped.length - report.unavailable.length,
            total: SCAN_PROBES.length,
            missing: report.skipped.map((p) => c.probes[SCAN_PROBES.indexOf(p)]).join(", "),
          })}
          {report.at - report.oldestAt > STALE_AFTER_MS &&
            ` ${format(c.olderNote, { time: clock(report.oldestAt) })}`}
        </div>
      )}
      {error && (
        <p className="scan-warning" role="alert">
          {s.scan.scanFailed} {error}
        </p>
      )}
      {!!report?.unavailable.length && (
        <div className="scan-warning" role="status">
          <strong>{c.partial}.</strong> {c.unavailable}
        </div>
      )}
      {unknownSecurity.length > 0 && (
        <div className="scan-warning" role="status">
          <strong>
            {c.probes[8]}: {s.scan.unavailable}.
          </strong>{" "}
          {c.unavailable}
          <ul>
            {unknownSecurity.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </div>
      )}
      {applying && (
        <p className="scan-working" role="status">
          <span className="scan-spinner" aria-hidden="true" />
          {c.verifying}
        </p>
      )}
      {outcome && (
        <div className="scan-outcome" role="status">
          <strong>
            {c.verified}: {outcome.fixed.length}
          </strong>
          <span>
            {c.failed}: {outcome.failed.length} · {c.skipped}: {outcome.skipped.length}
          </span>
          {(outcome.failed.length > 0 || outcome.errors.length > 0) && (
            <>
              <p>{c.retry}</p>
              <ul>
                {outcome.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {!report && !reading && (
        <div className="scan-idle">
          <h3>{c.ready}</h3>
          <p>{c.readyBody}</p>
        </div>
      )}
      {reading && (
        <div className="scan-skeleton" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <span />
              <span />
            </div>
          ))}
        </div>
      )}
      {report && (
        <details className="scan-report" ref={results} tabIndex={-1} open>
          <summary className="scan-report-summary">
            <span>{c.results}</span>
            <span className="scan-report-toggle">
              <span className="scan-report-hide">{c.hideResults}</span>
              <span className="scan-report-show">{c.showResults}</span>
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
          </summary>
          <div className="scan-results" data-has-fixes={fixes.length > 0}>
            <div className="scan-auto-results">
              <div className="scan-section-heading">
                <div>
                  <p className="scan-eyebrow">
                    {report.partial || unknownSecurity.length ? c.partial : c.complete}
                  </p>
                  <h3>{c.recommendations}</h3>
                </div>
                {fixes.length > 0 && (
                  <div className="scan-result-actions">
                    <button
                      className="scan-secondary"
                      disabled={applying || paused || !selectedFixes.length}
                      onClick={() => setReviewIds(selectedFixes.map((t) => t.id))}
                    >
                      {c.apply} ({selectedFixes.length})
                    </button>
                    <button
                      className="scan-primary"
                      disabled={applying || paused || !fixes.length}
                      onClick={() => setReviewIds(fixes.map((t) => t.id))}
                    >
                      {s.scan.fixAll} ({fixes.length})
                    </button>
                  </div>
                )}
              </div>
              {fixes.length ? (
                <ul className="scan-findings">
                  {fixes.map((t) => {
                    const text = textFor(s.tweaks, t.id, t.name, t.description);
                    const reason = report.advice?.find((a) => a.id === t.id)?.reason_key;
                    return (
                      <li key={t.id} className="scan-finding">
                        <input
                          type="checkbox"
                          aria-label={text.name}
                          checked={selected.includes(t.id)}
                          disabled={applying}
                          onChange={(e) =>
                            setSelected((previous) =>
                              e.target.checked
                                ? [...previous, t.id]
                                : previous.filter((id) => id !== t.id),
                            )
                          }
                        />
                        <div>
                          <div className="scan-finding-title">
                            <h4>{text.name}</h4>
                            {t.requires_admin && <Badge kind="admin">{s.badges.admin}</Badge>}
                          </div>
                          <p>{text.description}</p>
                          {reason && (
                            <p className="scan-reason">
                              {(s.scan.reasons as Record<string, string>)[reason]}
                            </p>
                          )}
                          {t.changes.length > 0 && (
                            <details className="scan-technical">
                              <summary>{s.transparency.title}</summary>
                              <TechnicalDetails changes={t.changes} s={s} />
                            </details>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="scan-empty">
                  <CheckIcon className="h-5 w-5" />
                  <div>
                    <h4>{report.tweaks && report.advice && report.ids ? c.empty : c.partial}</h4>
                    <p>
                      {report.tweaks && report.advice && report.ids ? c.emptyBody : c.unavailable}
                    </p>
                  </div>
                </div>
              )}
              {lockedFixes.length > 0 && (
                <div className="scan-locked-results">
                  <h4>{c.proRecommendations}</h4>
                  <p>{c.proRecommendationsBody}</p>
                  {lockedFixes.map((t) => (
                    <div key={t.id} className="scan-locked-row">
                      <span>{textFor(s.tweaks, t.id, t.name, t.description).name}</span>
                      <button
                        className="scan-secondary"
                        onClick={() => onNavigate(t.category)}
                        disabled={applying}
                      >
                        {c.manual} · Pro ↗
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="scan-review-results">
              <div className="scan-section-heading">
                <h3>{c.review}</h3>
                <Badge>{observations.length}</Badge>
              </div>
              {observations.length ? (
                <ul className="scan-findings">
                  {observations.map((o) => (
                    <li key={o.id} className="scan-finding scan-manual">
                      <span
                        className={`scan-observation-mark ${o.warning ? "is-warning" : ""}`}
                        aria-hidden="true"
                      >
                        {o.warning ? "!" : "i"}
                      </span>
                      <div>
                        <h4>{c.observations[o.kind][0]}</h4>
                        <p>{c.observations[o.kind][1]}</p>
                        {o.evidence && <p className="scan-evidence">{o.evidence}</p>}
                      </div>
                      <button
                        className="scan-secondary"
                        disabled={applying}
                        onClick={() => onNavigate(o.section)}
                      >
                        {c.manual} <span aria-hidden="true">↗</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="scan-empty-note">{c.noReview}</p>
              )}
            </div>
            {optional.length > 0 && (
              <div className="scan-optional-results">
                <div className="scan-section-heading">
                  <h3>{c.optional}</h3>
                  <Badge>{optional.length}</Badge>
                </div>
                <p className="scan-optional-intro">{c.optionalBody}</p>
                <ul className="scan-findings">
                  {optional.map((t) => {
                    const text = textFor(s.tweaks, t.id, t.name, t.description);
                    return (
                      <li key={t.id} className="scan-finding scan-manual">
                        <div>
                          <h4>
                            {text.name}
                            {t.requires_pro && <Badge kind="pro">{s.badges.pro}</Badge>}
                          </h4>
                          <p>{text.description}</p>
                        </div>
                        <button
                          className="scan-secondary"
                          disabled={applying}
                          onClick={() => onNavigate(t.category)}
                        >
                          {c.manual} ↗
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <dialog
        ref={dialog}
        className="scan-review-dialog"
        onCancel={() => setReviewIds(null)}
        onClose={() => setReviewIds(null)}
        aria-labelledby="scan-review-title"
      >
        <h2 id="scan-review-title">{c.confirm}</h2>
        <p>{c.confirmBody}</p>
        <ul>
          {reviewFixes.map((t) => (
            <li key={t.id}>
              <CheckIcon className="h-4 w-4" />
              <span>
                {textFor(s.tweaks, t.id, t.name, t.description).name}
                {t.requires_admin && <small>{c.admin}</small>}
              </span>
            </li>
          ))}
        </ul>
        <div className="scan-dialog-actions">
          <button className="scan-secondary" onClick={() => setReviewIds(null)} autoFocus>
            {c.cancel}
          </button>
          <button
            className="scan-primary"
            disabled={!reviewFixes.length}
            onClick={() => void apply()}
          >
            {c.apply} ({reviewFixes.length})
          </button>
        </div>
      </dialog>
    </section>
  );
}

/** Results older than this, from before a pause, say when they were read. */
const STALE_AFTER_MS = 5 * 60_000;

function clock(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
