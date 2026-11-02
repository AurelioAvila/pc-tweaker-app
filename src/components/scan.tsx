import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import { format, type Lang, type Strings, localeOf } from "../i18n";
import { cachedAppVersion, formatBytes, formatNumber, textFor } from "../lib";
import { diagnosisText } from "../diagnosis";
import type {
  AuditEntry,
  CacheGroup,
  JunkTarget,
  RamBoostStatus,
  RegistryRestoreResult,
  RegistryScan,
  ScanProgress,
  Section,
  Toast,
  TweakInfo,
} from "../types";
import {
  applyScanSelection,
  FIRST_NEW_PROBE,
  LAST_SCAN_KEY,
  readLastScan,
  newScanSession,
  runScanSession,
  scanProgress,
  scanReport,
  settled,
  SCAN_PROBES,
  unknownSecuritySignals,
  type ProbeStatus,
  type ScanProbe,
  type ScanReport,
  type ScanSession,
} from "../scan-runner";
import { fixAllKeys, fixPlan, locked, scanItems, type ScanItem } from "../scan-items";
import { emitFixDone, runBeforeFix } from "../fix-events";
import { CheckIcon } from "./icons";
import { Badge } from "./ui";
import { SCAN_COPY } from "./scan-copy";
import { SCAN2_COPY } from "./scan2-copy";
import { ScanCategoryList, ScanSummary } from "./scan-results";
import "./scan-workspace.css";

/** Waits for the backend driver audit to stop, re-sending the cancel every
 *  half second (an audit can start after the first cancel arrived, while it
 *  was still queued) and giving up after 15 seconds so the panel never stays
 *  stuck. */
async function stopAudit(session: ScanSession): Promise<void> {
  let done = false;
  const retry = window.setInterval(() => {
    if (!done) void invoke("cancel_scan").catch(() => undefined);
  }, 500);
  await Promise.race([
    settled(session).then(() => {
      done = true;
    }),
    new Promise((resolve) => window.setTimeout(resolve, 15_000)),
  ]);
  window.clearInterval(retry);
}

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
  trialDays = null,
  extraActions,
}: {
  s: Strings;
  lang: Lang;
  isPro: boolean;
  onFixed: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
  onNavigate: (section: Section) => void;
  onBusyChange?: (busy: boolean) => void;
  /** Set while this person may start the free trial: the Pro
   *  recommendations then lead with it (it opens Plans & pricing). */
  trialDays?: number | null;
  /** Rendered beside Fix all and Custom (e.g. a "Safe optimize" button). */
  extraActions?: ReactNode;
}) {
  const c = SCAN_COPY[lang];
  const c2 = SCAN2_COPY[lang];
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [custom, setCustom] = useState(false);
  const [reviewKeys, setReviewKeys] = useState<string[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [outcome, setOutcome] = useState<FixOutcome | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState<number | null>(null);
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
  const results = useRef<HTMLDivElement>(null);
  const outcomePanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // The panel stays mounted while the user visits other pages, so this
      // only runs when the app itself goes away; a running scan is paused.
      if (abort.current && !abort.current.signal.aborted) {
        intent.current = "pause";
        abort.current.abort();
        void invoke("cancel_scan").catch(() => undefined);
      }
    };
  }, []);
  useEffect(() => {
    if (reviewKeys !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [reviewKeys]);
  useEffect(() => {
    if (report && !paused) {
      results.current?.focus({ preventScroll: true });
      results.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [report, paused]);

  const items = report ? scanItems(report) : [];
  const fixAll = fixAllKeys(items, isPro);
  const ticked = items.filter((i) => selected.has(i.key) && i.fixable && !locked(i, isPro));
  const reviewItems = items.filter((i) => reviewKeys?.includes(i.key));
  const unknownSecurity = report ? unknownSecuritySignals(report, lang) : [];
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
    void stopAudit(session).then(() =>
      invoke("discard_scan_session", { session: session.id }).catch(() => undefined),
    );
    const partial = scanReport(session);
    setPaused(false);
    setReport(partial);
    setSelected(new Set(fixAllKeys(scanItems(partial), isPro)));
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
    setRestored(null);
    setCustom(false);
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
          // Paused. The backend audit is given time to save where it was
          // before Resume can be pressed.
          heldScan = { session, driver, elapsed: seconds };
          await stopAudit(session);
          if (alive.current) {
            setPaused(true);
            setProgress(Math.floor(scanProgress(session.steps, driver)));
            setProbes(probesOf(session));
            setReport(scanReport(session));
            setSelected(new Set());
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
      setSelected(new Set(fixAllKeys(scanItems(next), isPro)));
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

  /** The report and recent changes as plain text for a support email; the
   *  person decides where it goes. */
  async function copyDiagnosis() {
    if (!report) return;
    const [history, home] = await Promise.all([
      invoke<AuditEntry[]>("list_audit_log").catch(() => []),
      // The user name to take out of any error text.
      homeDir().catch(() => null),
    ]);
    const text = diagnosisText({
      home,
      appVersion: cachedAppVersion,
      lang,
      isPro,
      report,
      outcome,
      history,
    });
    try {
      await navigator.clipboard.writeText(text);
      pushToast("success", c.diagnosisCopied);
    } catch {
      pushToast("error", c.diagnosisCopyFailed);
    }
  }

  /** Re-reads what a fix changes, so the categories show the PC as it is now. */
  async function reread(base: ScanReport, tweaks: TweakInfo[] | null): Promise<ScanReport> {
    const [junk, caches, registry, memory] = await Promise.allSettled([
      invoke<JunkTarget[]>("junk_summary"),
      invoke<CacheGroup[]>("scan_app_caches"),
      invoke<RegistryScan>("registry_scan"),
      invoke<RamBoostStatus>("ram_boost_status"),
    ]);
    const kept = <T,>(r: PromiseSettledResult<T>, old: T) =>
      r.status === "fulfilled" ? r.value : old;
    return {
      ...base,
      tweaks: tweaks ?? base.tweaks,
      junk: kept(junk, base.junk),
      caches: kept(caches, base.caches),
      registry: kept(registry, base.registry),
      memory: kept(memory, base.memory),
    };
  }

  async function apply() {
    if (operation.current || !report || !reviewItems.length) return;
    const plan = fixPlan(
      items,
      reviewItems.map((i) => i.key),
      isPro,
    );
    operation.current = true;
    onBusyChange?.(true);
    setApplying(true);
    setReviewKeys(null);
    setRestored(null);
    setError("");
    try {
      await runBeforeFix({ tweaks: plan.tweaks, ...plan.extras }, "scan");
      const result = await applyScanSelection(invoke, report, isPro, plan.tweaks, plan.extras);
      let booster = false;
      if (plan.booster) {
        try {
          await invoke("apply_tweak", { id: "smart_ram_booster" });
          booster = true;
        } catch (e) {
          result.errors.push(String(e));
        }
      }
      const tweaks = booster
        ? await invoke<TweakInfo[]>("list_tweaks").catch(() => result.tweaks)
        : result.tweaks;
      setOutcome({ ...result, booster });
      // Unknown final states cannot be offered for a second blind application.
      const next = await reread(
        { ...report, advice: result.advice, ids: result.ids },
        tweaks ?? null,
      );
      setReport(next);
      setSelected(new Set(fixAllKeys(scanItems(next), isPro)));
      setCustom(false);
      if (result.fixed.length)
        pushToast("success", format(s.scan.fixedToast, { count: result.fixed.length }));
      emitFixDone({
        source: "scan",
        fixed: result.fixed,
        failed: result.failed,
        measured: result.measured,
        errors: result.errors,
      });
      try {
        await onFixed();
      } catch (e) {
        setError(String(e));
      }
      window.requestAnimationFrame(() => {
        outcomePanel.current?.focus({ preventScroll: true });
        outcomePanel.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
      });
    } catch (e) {
      setError(String(e));
    } finally {
      operation.current = false;
      setApplying(false);
      onBusyChange?.(false);
    }
  }

  /** The Smart RAM booster's own switch, from its row. */
  async function turnOn(id: string) {
    if (operation.current || !report) return;
    operation.current = true;
    setApplying(true);
    try {
      await invoke("apply_tweak", { id });
      const tweaks = await invoke<TweakInfo[]>("list_tweaks").catch(() => report.tweaks);
      setReport(await reread(report, tweaks));
      await onFixed().catch(() => undefined);
    } catch (e) {
      setError(String(e));
    } finally {
      operation.current = false;
      setApplying(false);
    }
  }

  async function restoreRegistry(stamp: string) {
    if (operation.current || !report) return;
    operation.current = true;
    setRestoring(true);
    try {
      const result = await invoke<RegistryRestoreResult>("registry_restore", { stamp });
      setRestored(result.restored);
      setReport(await reread(report, null));
    } catch (e) {
      setError(String(e));
    } finally {
      operation.current = false;
      setRestoring(false);
    }
  }

  function toggle(key: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
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
            {report && !reading && !paused && (
              <button
                type="button"
                className="scan-secondary scan-copy-diagnosis"
                onClick={() => void copyDiagnosis()}
                disabled={applying}
              >
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="5" y="5" width="8" height="9" rx="1.5" stroke="currentColor" />
                  <path d="M3.5 10.5V3.5A1.5 1.5 0 0 1 5 2h5.5" stroke="currentColor" />
                </svg>
                {c.copyDiagnosis}
              </button>
            )}
            <span className="scan-last" hidden={reading || paused}>
              {lastScan
                ? format(s.scan.lastScan, {
                    time: new Date(lastScan.at).toLocaleString(localeOf(lang)),
                  })
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
            <div ref={results} tabIndex={-1} className="scan2-focus">
              <ScanSummary
                lang={lang}
                report={report}
                items={items}
                isPro={isPro}
                custom={custom}
                fixCount={custom ? ticked.length : fixAll.length}
                busy={applying || reading}
                trialDays={trialDays}
                extraActions={extraActions}
                onFix={() => setReviewKeys(custom ? ticked.map((i) => i.key) : fixAll)}
                onCustom={(on) => {
                  setCustom(on);
                  if (!on) setSelected(new Set(fixAll));
                }}
                onUnlock={() => onNavigate("pricing")}
              />
            </div>
          )}
        </div>
        <aside className="scan-scope">
          <details open={paused || undefined}>
            <summary>
              <span className="scan-scope-title">
                <span>{c.scope}</span>
                <small>{c.scopeHint}</small>
              </span>
              <span className="scan-scope-count">
                {(reading || paused) && (
                  <span className="scan-scope-meter" aria-hidden="true">
                    <span style={{ width: `${(complete / SCAN_PROBES.length) * 100}%` }} />
                  </span>
                )}
                <Badge>
                  {reading || paused
                    ? format(c.scopeProgress, { done: complete, total: SCAN_PROBES.length })
                    : format(c.scopeCount, { count: SCAN_PROBES.length })}
                </Badge>
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
                    <span className="scan-probe-name">
                      {c.probes[i]}
                      {i >= FIRST_NEW_PROBE && <Badge kind="accent">{c.newBadge}</Badge>}
                    </span>
                    {i >= FIRST_NEW_PROBE && <small>{c.newDetails[i - FIRST_NEW_PROBE]}</small>}
                  </span>
                  {probes[probe] === "unavailable" && (
                    <Badge kind="warn">{s.scan.unavailable}</Badge>
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
          {c2.working}
        </p>
      )}
      {outcome && (
        <FixOutcomePanel
          panel={outcomePanel}
          lang={lang}
          outcome={outcome}
          restoring={restoring}
          restored={restored}
          onRestore={(stamp) => void restoreRegistry(stamp)}
        />
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
        <div className="scan2-results" aria-label={c.results}>
          <ScanCategoryList
            s={s}
            lang={lang}
            report={report}
            items={items}
            isPro={isPro}
            custom={custom}
            selected={selected}
            busy={applying || paused}
            onToggle={toggle}
            onNavigate={onNavigate}
            onUnlock={() => onNavigate("pricing")}
            onTurnOn={(id) => void turnOn(id)}
          />
        </div>
      )}

      <dialog
        ref={dialog}
        className="scan-review-dialog"
        onCancel={() => setReviewKeys(null)}
        onClose={() => setReviewKeys(null)}
        aria-labelledby="scan-review-title"
      >
        <h2 id="scan-review-title">
          {format(c2.confirmTitle, { count: formatNumber(reviewItems.length) })}
        </h2>
        <p>{c2.confirmBody}</p>
        <ul>
          {reviewItems.map((item) => (
            <li key={item.key}>
              <CheckIcon className="h-4 w-4" />
              <span>{itemName(s, lang, item)}</span>
            </li>
          ))}
        </ul>
        {reviewItems.some((i) => i.admin) && <p className="scan2-dialog-note">{c2.confirmAdmin}</p>}
        <div className="scan-dialog-actions">
          <button className="scan-secondary" onClick={() => setReviewKeys(null)} autoFocus>
            {c.cancel}
          </button>
          <button
            className="scan-primary"
            disabled={!reviewItems.length}
            onClick={() => void apply()}
          >
            {c2.confirm}
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

type FixOutcome = Awaited<ReturnType<typeof applyScanSelection>> & { booster: boolean };

/** A short name for an item, for the confirmation list. */
function itemName(s: Strings, lang: Lang, item: ScanItem): string {
  const c2 = SCAN2_COPY[lang];
  switch (item.type) {
    case "tweak":
      return textFor(s.tweaks, item.tweak.id, item.tweak.name, item.tweak.description).name;
    case "booster":
      return c2.boosterTitle;
    case "junk":
      return `${c2.junk[item.target.id]?.[0] ?? item.target.id} · ${formatBytes(item.target.bytes)}`;
    case "caches":
      return `${c2.cachesTitle} · ${formatBytes(item.bytes)}`;
    case "registry":
      return `${c2.registry[item.cls][0]} · ${formatNumber(item.entries.length)}`;
    case "purge":
      return c2.purgeTitle;
    default:
      return "";
  }
}

/** What the fix measured, part by part. */
function FixOutcomePanel({
  panel,
  lang,
  outcome,
  restoring,
  restored,
  onRestore,
}: {
  panel: RefObject<HTMLDivElement | null>;
  lang: Lang;
  outcome: FixOutcome;
  restoring: boolean;
  restored: number | null;
  onRestore: (stamp: string) => void;
}) {
  const c = SCAN_COPY[lang];
  const c2 = SCAN2_COPY[lang];
  const m = outcome.measured;
  const recycled = (m?.cleanups ?? []).reduce((sum, f) => sum + f.freed_bytes, 0);
  const freedMb = m?.purge ? Math.max(0, m.purge.free_after_mb - m.purge.free_before_mb) : null;
  const lines = [
    outcome.fixed.length > 0 &&
      format(c2.doneSettings, { count: formatNumber(outcome.fixed.length) }),
    m?.cleanups.length && format(c2.doneFreed, { size: formatBytes(recycled) }),
    m?.app_caches && format(c2.doneCaches, { size: formatBytes(m.app_caches.freed_bytes) }),
    m?.registry?.removed && format(c2.doneRegistry, { count: formatNumber(m.registry.removed) }),
    freedMb !== null && format(c2.doneMemory, { size: formatBytes(freedMb * 1024 * 1024) }),
    outcome.booster && c2.doneBooster,
  ].filter(Boolean) as string[];
  const problems = outcome.failed.length + outcome.errors.length;
  const stamp = m?.registry?.removed ? m.registry.stamp : "";
  return (
    <div className="scan-outcome scan2-outcome" role="status" ref={panel} tabIndex={-1}>
      <strong>{lines.length ? c2.doneTitle : c2.doneNothing}</strong>
      {lines.length > 0 && (
        <ul className="selectable">
          {lines.map((line) => (
            <li key={line}>
              <CheckIcon className="h-3.5 w-3.5" />
              {line}
            </li>
          ))}
        </ul>
      )}
      {problems > 0 && (
        <>
          <p>
            {format(c2.doneProblems, { count: formatNumber(problems) })} · {c.retry}
          </p>
          <ul className="scan2-errors selectable">
            {outcome.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </>
      )}
      {stamp && (
        <div className="scan2-outcome-actions">
          <button
            type="button"
            className="scan-secondary"
            onClick={() => onRestore(stamp)}
            disabled={restoring}
          >
            {restoring ? c2.restoringRegistry : c2.restoreRegistry}
          </button>
          {restored !== null && (
            <span>{format(c2.restoredRegistry, { count: formatNumber(restored) })}</span>
          )}
        </div>
      )}
    </div>
  );
}
