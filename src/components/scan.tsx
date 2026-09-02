import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, Strings } from "../i18n";
import { textFor } from "../lib";
import { CleanupInfo, ScanIssue, SystemProfile, Toast, TweakAdvice, TweakInfo } from "../types";
import { BaselineRun, delta } from "./health";
import { BoltIcon, MagnifierIcon, TrashIcon } from "./icons";

/**
 * The machine the Scan is about to judge, as a row of facts.
 *
 * This is the difference between "we ran a scan" and "we looked at *your*
 * PC": the advice below is derived from exactly these values, so showing them
 * lets the user check the reasoning instead of taking the verdicts on faith.
 * Anything the probe couldn't establish is simply left out rather than shown
 * as a blank or a guess.
 */
export function MachineStrip({ s, profile }: { s: Strings; profile: SystemProfile | null }) {
  if (!profile) return null;

  const diskLabel =
    profile.system_disk === "hdd"
      ? s.scan.diskHdd
      : profile.system_disk === "ssd"
        ? s.scan.diskSsd
        : profile.system_disk === "nvme"
          ? s.scan.diskNvme
          : null;

  const formLabel =
    profile.form_factor === "desktop"
      ? s.scan.formDesktop
      : profile.form_factor === "laptop"
        ? s.scan.formLaptop
        : null;

  const ram = profile.ram_total_bytes
    ? `${Math.round(profile.ram_total_bytes / 1024 ** 3)} GB`
    : null;

  const facts = [
    profile.windows_version,
    profile.cpu,
    profile.gpu,
    ram,
    diskLabel,
    formLabel,
  ].filter((f): f is string => Boolean(f));

  if (facts.length === 0) return null;

  return (
    <div className="mt-5 w-full">
      <p className="mb-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {s.scan.thisPc}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {facts.map((fact) => (
          <span
            key={fact}
            className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-ink-2 ring-1 ring-line"
          >
            {fact}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The one-line explanation under a scanned item, when the hardware has an
 * opinion about it.
 *
 * Renders nothing for a `neutral` verdict: most tweaks have no
 * hardware-derived argument either way, and printing "no opinion" under each
 * of them would be noise. A missing translation falls back to no note at all
 * rather than to a raw key.
 */
export function AdviceNote({ s, advice }: { s: Strings; advice?: TweakAdvice }) {
  if (!advice || advice.verdict === "neutral") return null;

  const reason = advice.reason_key
    ? (s.scan.reasons as Record<string, string | undefined>)[advice.reason_key]
    : undefined;

  const tone =
    advice.verdict === "recommended"
      ? "text-emerald-300"
      : advice.verdict === "unsupported"
        ? "text-ink-3"
        : "text-amber-300";

  const label =
    advice.verdict === "recommended"
      ? s.scan.verdictRecommended
      : advice.verdict === "unsupported"
        ? s.scan.verdictUnsupported
        : s.scan.verdictNotRecommended;

  return (
    <p className={`mt-1 text-[11px] font-medium ${tone}`}>
      {label}
      {reason ? ` — ${reason}` : ""}
    </p>
  );
}

/**
 * "Scan for problems, fix them with one click" landing screen — same idea as
 * the scan/fix flow in tools like Advanced SystemCare, but grounded in this
 * app's own real data: the "problems" it finds are simply this PC's
 * not-yet-applied free tweaks and pending temp-file cleanup, nothing
 * fabricated. The staged reveal during "scanning" is cosmetic pacing over
 * data that's already loaded, not a fake progress bar over fake work.
 */
/** Tweaks whose effect the Baseline Engine can actually see.
 *
 * Taken from what `baseline.rs` documents about each measurement rather than
 * from optimism: anything not in here would produce two benchmark runs and
 * four "=" rows, which is a worse answer than not measuring at all.
 */
const BASELINE_REFLECTS = new Set([
  "power_plan_performance",
  "turbo_boost",
  "disable_power_throttling",
  "disable_background_apps",
  "keep_kernel_in_ram",
  "disable_delivery_optimization",
  "disable_core_parking",
]);

export function ScanPanel({
  s,
  tweaks,
  cleanupTargets,
  isPro,
  onRequirePro,
  onFixed,
  pushToast,
  externalScanSignal = 0,
  onPhaseChange,
}: {
  s: Strings;
  tweaks: TweakInfo[];
  cleanupTargets: CleanupInfo[];
  isPro: boolean;
  onRequirePro: () => void;
  onFixed: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
  /** Bumped by the Command Center's System Pulse to start a scan remotely. */
  externalScanSignal?: number;
  /** Lets the System Pulse mirror this panel's state and findings count. */
  onPhaseChange?: (phase: "idle" | "scanning" | "results" | "done", findings: number) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "results" | "done">("idle");
  const [scanPct, setScanPct] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // Hardware-derived verdicts, keyed by tweak id. Empty until a scan runs, and
  // empty again if the backend can't profile the machine — in which case the
  // Scan simply behaves as it always did rather than showing made-up advice.
  const [advice, setAdvice] = useState<Record<string, TweakAdvice>>({});
  const [profile, setProfile] = useState<SystemProfile | null>(null);

  // Read the machine once when the screen mounts, so the hardware strip is
  // already there before the user commits to a scan — that is the part that
  // says "this is about your PC" rather than about PCs in general. A failure
  // just leaves the strip out.
  useEffect(() => {
    invoke<SystemProfile>("system_profile")
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);
  const [fixing, setFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);
  const [fixTotal, setFixTotal] = useState(0);
  const [fixedCount, setFixedCount] = useState(0);
  /* Before/after of the Baseline Engine around a Fix all.
   *
   * The engine was built for exactly this comparison and nothing ever asked
   * it for one: a user had to find the PC Health tab, compute a score, run a
   * baseline, apply something, come back and repeat. Four clicks away on a
   * tab with no reason to open it, which is why nobody ever saw the app
   * prove itself.
   *
   * Both runs are kept even when nothing moved. A tweak that changes the
   * taskbar has no business moving a CPU score, and saying so is the point:
   * this is the app that refuses to inflate a number. */
  const [beforeRun, setBeforeRun] = useState<BaselineRun | null>(null);
  const [afterRun, setAfterRun] = useState<BaselineRun | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const scanTimer = useRef<number | null>(null);

  const SCAN_DURATION_MS = 4200;
  const scanStep = Math.min(4, Math.floor((scanPct / 100) * 4));

  const steps = [s.scan.stepPerformance, s.scan.stepPrivacy, s.scan.stepGaming, s.scan.stepJunk];

  // Fixable now = anything the user can actually apply today: every free
  // tweak/cleanup, plus Pro ones too once they're unlocked. Locked = Pro
  // items only shown as an upsell when the account isn't Pro yet.
  // Names/descriptions go through `textFor` so this list is translated like
  // the rest of the UI instead of showing the raw English text from Rust.
  //
  // The UI category is excluded on purpose: dark mode or a left-aligned
  // taskbar are personal preferences, not "problems" a PC health scan can
  // honestly claim to have found — counting them would inflate the issue
  // count exactly the way the snake-oil cleaners this app defines itself
  // against do. They stay fully available under their own section.
  // Which tweaks a performance scan may report is decided in Rust
  // (`recommend::is_scan_relevant`), so the curation and the reasoning behind
  // it live together. Until that list arrives the Scan reports nothing rather
  // than falling back to "everything", which is what used to pad the count
  // with taskbar and Cortana toggles.
  const [scanIds, setScanIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    invoke<string[]>("scan_relevant_ids")
      .then((ids) => setScanIds(new Set(ids)))
      .catch(() => setScanIds(new Set()));
  }, []);
  const scanRelevant = (t: TweakInfo) => scanIds?.has(t.id) ?? false;
  const fixableIssues: ScanIssue[] = useMemo(() => {
    const fromTweaks = tweaks
      .filter(
        (t) =>
          scanRelevant(t) && !t.applied && (isPro || !t.requires_pro) && t.id !== "turbo_boost",
      )
      .map((t) => ({
        kind: "tweak" as const,
        id: t.id,
        ...textFor(s.tweaks, t.id, t.name, t.description),
      }));
    const fromCleanup = cleanupTargets
      .filter((c) => isPro || !c.requires_pro)
      .map((c) => ({
        kind: "cleanup" as const,
        id: c.id,
        ...textFor(s.cleanup, c.id, c.name, c.description),
      }));
    return [...fromTweaks, ...fromCleanup];
  }, [tweaks, cleanupTargets, isPro, s, scanIds]);

  const lockedIssues = useMemo(
    () =>
      isPro
        ? []
        : tweaks
            .filter((t) => scanRelevant(t) && !t.applied && t.requires_pro)
            .map((t) => ({ id: t.id, ...textFor(s.tweaks, t.id, t.name, t.description) })),
    [tweaks, isPro, s],
  );

  useEffect(() => {
    return () => {
      if (scanTimer.current) window.clearInterval(scanTimer.current);
    };
  }, []);

  // The Command Center hero drives this panel without owning its logic: a
  // bumped signal starts a scan, and every phase/result change is mirrored
  // back so the Pulse can tell the same story.
  useEffect(() => {
    onPhaseChange?.(phase, fixableIssues.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fixableIssues.length]);

  useEffect(() => {
    if (externalScanSignal > 0 && phase !== "scanning") startScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalScanSignal]);

  function startScan() {
    setPhase("scanning");
    setScanPct(0);

    // Profile the machine while the progress ring runs, so the verdicts are
    // ready by the time the results appear. A failure here is not fatal: the
    // advice map stays empty and every issue is offered exactly as before.
    const adviceReady = invoke<TweakAdvice[]>("advise_tweaks", {
      ids: fixableIssues.map((i) => i.id),
    })
      .then((list) => Object.fromEntries(list.map((a) => [a.id, a])) as Record<string, TweakAdvice>)
      .catch(() => ({}) as Record<string, TweakAdvice>);

    const start = performance.now();
    scanTimer.current = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / SCAN_DURATION_MS) * 100));
      setScanPct(pct);
      if (pct >= 100) {
        if (scanTimer.current) window.clearInterval(scanTimer.current);
        void adviceReady.then((map) => {
          setAdvice(map);
          // Pre-tick only what this PC actually benefits from. Anything the
          // hardware argues against stays listed but unticked, so "Fix all"
          // can never quietly apply something that costs the user battery
          // life or Start-menu search on their particular machine.
          const initialChecked: Record<string, boolean> = {};
          fixableIssues.forEach((issue) => {
            const verdict = map[issue.id]?.verdict;
            initialChecked[issue.id] = verdict !== "notrecommended" && verdict !== "unsupported";
          });
          setChecked(initialChecked);
          setPhase("results");
        });
      }
    }, 60);
  }

  /** Ids the hardware actually argues for, in list order. */
  const recommendedIds = useMemo(
    () => fixableIssues.filter((i) => advice[i.id]?.verdict === "recommended").map((i) => i.id),
    [fixableIssues, advice],
  );

  /**
   * Applies exactly the ids handed in.
   *
   * Takes its work as an argument rather than reading the checkbox state, so
   * "apply the recommended ones" means precisely that no matter what the user
   * has ticked — the button's label and what it does can never drift apart.
   */
  async function fixAll(ids: string[]) {
    const toFix = fixableIssues.filter((issue) => ids.includes(issue.id));
    if (toFix.length === 0) return;
    // Reflect the batch in the checkboxes, so after "apply the recommended
    // ones" the list shows exactly what was applied rather than the selection
    // the user happened to be looking at.
    setChecked(Object.fromEntries(fixableIssues.map((i) => [i.id, ids.includes(i.id)])));
    setFixing(true);
    setFixTotal(toFix.length);
    setFixProgress(0);
    setBeforeRun(null);
    setAfterRun(null);

    // Only when the batch contains something the engine can actually
    // reflect. baseline.rs is explicit about what moves each number: the
    // power plan, boost mode and power throttling for CPU; RAM cleaning and
    // background apps for memory; background disk activity for disk. A
    // taskbar alignment moves none of them, and running two full benchmarks
    // to print "=" four times spends seconds of the user's time to tell them
    // nothing. Cleanup is excluded for the same reason: it already reports
    // the space it freed.
    const measure = toFix.some((i) => i.kind === "tweak" && BASELINE_REFLECTS.has(i.id));
    let before: BaselineRun | null = null;
    if (measure) {
      setMeasuring(true);
      try {
        before = await invoke<BaselineRun>("run_baseline");
      } catch {
        // A failed measurement must not block the thing the user actually
        // pressed the button for.
        before = null;
      }
      setMeasuring(false);
    }

    const tweakIds = toFix.filter((i) => i.kind === "tweak").map((i) => i.id);
    const cleanupIds = toFix.filter((i) => i.kind === "cleanup").map((i) => i.id);
    let failed = 0;

    try {
      if (tweakIds.length > 0) {
        // Single call: the backend groups every admin-level tweak behind one
        // UAC prompt instead of one prompt per tweak.
        const failures = await invoke<string[]>("apply_tweaks", { ids: tweakIds });
        failed += failures.length;
        // Each entry is "{id}: {error}" — a PRO_REQUIRED one gets the same
        // reconnect-focused wording as the single-tweak toggle, rather than
        // Rust's raw "requires an active subscription" reaching a real
        // subscriber whose cached proof of that just went stale offline.
        failures.forEach((f) =>
          pushToast("error", f.includes("PRO_REQUIRED: ") ? s.toasts.licenseNeedsRefresh : f),
        );
        setFixProgress(tweakIds.length);
      }
    } catch (e) {
      failed += tweakIds.length;
      pushToast("error", String(e));
    }

    for (let i = 0; i < cleanupIds.length; i++) {
      try {
        await invoke("run_cleanup", { id: cleanupIds[i] });
      } catch (e) {
        failed += 1;
        pushToast("error", String(e));
      }
      setFixProgress(tweakIds.length + i + 1);
    }

    await onFixed();

    if (before) {
      setMeasuring(true);
      try {
        const after = await invoke<BaselineRun>("run_baseline");
        setBeforeRun(before);
        setAfterRun(after);
      } catch {
        /* same reasoning as above */
      }
      setMeasuring(false);
    }

    setFixing(false);
    const fixed = toFix.length - failed;
    setFixedCount(fixed);
    // Land on an explicit "Done!" screen rather than dropping the user back
    // into a half-empty checklist: the result of the click is then unmistakable.
    setPhase("done");
    if (fixed > 0) pushToast("success", format(s.scan.fixedToast, { count: fixed }));
  }

  const totalIssues = fixableIssues.length + lockedIssues.length;
  const checkedCount = fixableIssues.filter((i) => checked[i.id]).length;

  return (
    <div className="signal border-line bg-surface-1 relative mb-6 flex flex-col items-center overflow-hidden rounded-2xl border p-8">
      <h2 className="text-ink text-lg font-semibold">{s.scan.title}</h2>
      <p className="text-ink-3 mt-1 max-w-sm text-center text-sm">{s.scan.subtitle}</p>

      {phase === "idle" && (
        <>
          <button
            onClick={startScan}
            className="group relative mt-6 grid h-40 w-40 place-items-center rounded-full outline-none"
          >
            {/* Slow-turning tick ring: the instrument is armed, not asleep.
                The global reduced-motion kill-switch stops the rotation. */}
            <svg
              viewBox="0 0 160 160"
              className="absolute inset-0 h-full w-full animate-[spin_28s_linear_infinite]"
              aria-hidden="true"
            >
              <circle
                cx="80"
                cy="80"
                r="76"
                fill="none"
                stroke="var(--app-accent)"
                strokeOpacity="0.4"
                strokeWidth="2"
                strokeDasharray="2 9"
                strokeLinecap="round"
              />
            </svg>
            {/* The disc takes the theme's accent instead of a fixed gradient,
                so the scan is recognisably THIS theme's instrument. */}
            <span
              className="absolute inset-3 rounded-full transition-transform duration-300 group-hover:scale-105"
              style={{
                background:
                  "radial-gradient(circle at 32% 26%, color-mix(in oklab, var(--app-accent) 62%, white), var(--app-accent) 45%, color-mix(in oklab, var(--app-accent) 55%, black) 100%)",
                boxShadow: "0 0 45px color-mix(in oklab, var(--app-accent) 40%, transparent)",
              }}
            />
            <span className="text-on-accent relative flex flex-col items-center gap-1.5">
              <MagnifierIcon className="h-9 w-9" />
              <span className="text-base font-black tracking-wider">{s.scan.startLabel}</span>
            </span>
          </button>

          <MachineStrip s={s} profile={profile} />
          {profile && (
            <p className="mt-3 max-w-sm text-center text-[11.5px] leading-relaxed text-ink-3">
              {s.scan.tailoredNote}
            </p>
          )}
        </>
      )}

      {phase === "scanning" && (
        <>
          <div className="relative mt-6 grid h-40 w-40 place-items-center">
            {/* Radar sweep behind the ring: activity you can see at a glance,
                without pretending to be data. */}
            <span
              className="absolute inset-4 rounded-full animate-[spin_1.8s_linear_infinite]"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg 290deg, color-mix(in oklab, var(--app-accent) 22%, transparent) 360deg)",
              }}
            />
            {/* A real progress arc — stroke follows scanPct exactly, instead of
                a border trick that could only rotate. */}
            <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle
                cx="80"
                cy="80"
                r="72"
                fill="none"
                strokeWidth="5"
                stroke="var(--color-line)"
              />
              <circle
                cx="80"
                cy="80"
                r="72"
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                stroke="var(--app-accent)"
                strokeDasharray={2 * Math.PI * 72}
                strokeDashoffset={2 * Math.PI * 72 * (1 - scanPct / 100)}
                className="transition-[stroke-dashoffset] duration-100"
              />
            </svg>
            <div className="text-accent relative flex flex-col items-center gap-1">
              <MagnifierIcon className="h-7 w-7 animate-pulse" />
              <span className="type-data text-ink text-2xl font-black">{scanPct}%</span>
            </div>
          </div>
          <ul className="mt-5 flex flex-col gap-1.5 text-sm">
            {steps.map((label, i) => (
              <li
                key={label}
                className={`flex items-center gap-2 transition-opacity duration-300 ${
                  i < scanStep ? "text-ok opacity-100" : "text-ink-3 opacity-40"
                }`}
              >
                <span className="w-4">{i < scanStep ? "✓" : "…"}</span>
                {label}
              </li>
            ))}
          </ul>
        </>
      )}

      {phase === "done" && (
        <div className="animate-card mt-6 flex w-full flex-col items-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-4xl text-emerald-300 ring-4 ring-emerald-400/20">
            ✓
          </span>
          <p className="mt-4 text-xl font-black tracking-tight text-emerald-300">
            {s.scan.doneTitle}
          </p>
          <p className="mt-1 text-center text-sm text-ink-3">
            {format(s.scan.doneBody, { count: fixedCount })}
          </p>

          {/* Measured, not claimed. Two real runs of the Baseline Engine on
              this machine, one either side of the change — and when nothing
              moved it says "=" rather than dressing noise up as a gain. */}
          {beforeRun && afterRun && (
            <table className="mt-5 w-full max-w-xs text-[11px]">
              <tbody>
                {(
                  [
                    ["CPU", (r: BaselineRun) => r.cpuScore, true, ""],
                    ["Memory touch", (r: BaselineRun) => r.memoryTouchMs, false, " ms"],
                    ["Disk write", (r: BaselineRun) => r.diskWriteMs, false, " ms"],
                    ["Disk random read", (r: BaselineRun) => r.diskRandomReadMs, false, " ms"],
                  ] as [string, (r: BaselineRun) => number, boolean, string][]
                ).map(([label, get, higher, unit]) => {
                  const d = delta(get(beforeRun), get(afterRun), higher);
                  return (
                    <tr key={label} className="border-line border-t">
                      <td className="text-ink-3 py-1">{label}</td>
                      <td className="text-ink-2 py-1 text-right tabular-nums">
                        {get(afterRun)}
                        {unit}
                      </td>
                      <td className="w-14 py-1 text-right tabular-nums">
                        {d && (
                          <span className={d.good ? "text-emerald-300/90" : "text-rose-300/90"}>
                            {d.text}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <button
            onClick={() => {
              setFixedCount(0);
              setPhase("idle");
            }}
            className="mt-5 rounded-xl bg-surface-2 px-5 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-hover"
          >
            {s.scan.scanAgain}
          </button>
        </div>
      )}

      {phase === "results" && (
        <div className="mt-6 w-full">
          {/* A bare number told the user nothing — "35" could have been 35 of
              anything. The headline now says what the number counts and what
              it is about ("worth fixing on this PC"), which is a claim the
              grouped list below can actually back up. */}
          <div className="mb-4 flex flex-col items-center gap-1">
            <span
              className={`grid h-11 w-11 place-items-center rounded-full text-lg font-black ${
                totalIssues === 0
                  ? "bg-emerald-400/20 text-emerald-300"
                  : "bg-amber-400/20 text-amber-300"
              }`}
            >
              {totalIssues === 0 ? "✓" : totalIssues}
            </span>
            <p
              className={`text-sm font-semibold ${totalIssues === 0 ? "text-emerald-400" : "text-amber-200"}`}
            >
              {totalIssues === 0
                ? s.scan.foundNone
                : format(s.scan.foundHeadline, { count: totalIssues })}
            </p>
          </div>

          {fixableIssues.length > 0 && (
            <div className="flex flex-col gap-2">
              {/* The primary action sits above the list: after a scan the user
                  wants to act, not to scroll a checklist to find the button. */}
              {/* Two explicit choices, each carrying its own count, instead of
                  one button whose meaning depended on checkboxes further down
                  the page. "Recommended" is primary because it is the answer
                  for the user who does not want to audit a list; "all" stays
                  one click away for the user who does. */}
              <button
                onClick={() => fixAll(recommendedIds)}
                disabled={fixing || recommendedIds.length === 0}
                className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {measuring && (
                  <span className="absolute inset-0 grid place-items-center bg-black/20 text-[11px] font-semibold">
                    measuring…
                  </span>
                )}
                {fixing && (
                  <span
                    className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-300"
                    style={{ width: `${(fixProgress / Math.max(1, fixTotal)) * 100}%` }}
                  />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {fixing && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  )}
                  {fixing
                    ? format(s.scan.fixing, { done: fixProgress, total: fixTotal })
                    : format(s.scan.fixRecommended, { count: recommendedIds.length })}
                </span>
              </button>

              <button
                onClick={() => fixAll(fixableIssues.filter((i) => checked[i.id]).map((i) => i.id))}
                disabled={fixing || checkedCount === 0}
                className="relative overflow-hidden rounded-xl border border-line-2 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
              >
                {measuring && (
                  <span className="absolute inset-0 grid place-items-center bg-black/20 text-[11px] font-semibold">
                    measuring…
                  </span>
                )}
                {format(s.scan.fixEverything, { count: checkedCount })}
              </button>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {s.scan.fixHeading}
                </p>
                <button
                  onClick={() => {
                    const allChecked = fixableIssues.every((i) => checked[i.id]);
                    const next: Record<string, boolean> = {};
                    fixableIssues.forEach((i) => {
                      next[i.id] = !allChecked;
                    });
                    setChecked(next);
                  }}
                  className="text-xs text-ink-3 hover:text-ink-2"
                >
                  {fixableIssues.every((i) => checked[i.id])
                    ? s.scan.deselectAll
                    : s.scan.selectAll}
                </button>
              </div>

              {/* Grouped by what the hardware says, strongest case first, so
                  the list reads as a set of judgements about this machine
                  rather than as an undifferentiated pile of checkboxes. The
                  groups are only rendered when the profile produced verdicts;
                  otherwise everything falls into "optional" and the headings
                  would be noise. */}
              {(
                [
                  ["recommended", s.scan.groupRecommended, "text-emerald-300"],
                  ["optional", s.scan.groupOptional, "text-ink-3"],
                  ["notrecommended", s.scan.groupNotRecommended, "text-amber-300"],
                ] as const
              ).map(([group, heading, tone]) => {
                const items = fixableIssues.filter((issue) => {
                  const verdict = advice[issue.id]?.verdict;
                  if (group === "recommended") return verdict === "recommended";
                  if (group === "notrecommended")
                    return verdict === "notrecommended" || verdict === "unsupported";
                  return verdict === undefined || verdict === "neutral";
                });
                if (items.length === 0) return null;

                const showHeading = Object.keys(advice).length > 0;
                return (
                  <div key={group} className="flex flex-col gap-2">
                    {showHeading && (
                      <p
                        className={`mt-2 text-[11px] font-semibold uppercase tracking-wide ${tone}`}
                      >
                        {heading} · {items.length}
                      </p>
                    )}
                    {items.map((issue) => (
                      <label
                        key={issue.id}
                        className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm transition-colors hover:bg-surface-hover"
                      >
                        <input
                          type="checkbox"
                          checked={checked[issue.id] ?? true}
                          onChange={(e) =>
                            setChecked((c) => ({ ...c, [issue.id]: e.target.checked }))
                          }
                          className="mt-1"
                          style={{ accentColor: "var(--app-accent)" }}
                        />
                        <span
                          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
                            issue.kind === "cleanup"
                              ? "bg-sky-400/15 text-sky-300"
                              : "bg-accent-soft text-accent"
                          }`}
                        >
                          {issue.kind === "cleanup" ? (
                            <TrashIcon className="h-3.5 w-3.5" />
                          ) : (
                            <BoltIcon className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span>
                          <span className="font-medium text-ink">{issue.name}</span>
                          <p className="text-xs text-ink-3">{issue.description}</p>
                          <AdviceNote s={s} advice={advice[issue.id]} />
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {lockedIssues.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
              <p className="mb-2 text-xs font-semibold text-amber-300">{s.scan.proIssuesTitle}</p>
              <ul className="mb-3 flex flex-col gap-1 text-xs text-ink-3">
                {lockedIssues.map((issue) => (
                  <li key={issue.id}>• {issue.name}</li>
                ))}
              </ul>
              <button
                onClick={onRequirePro}
                className="rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/30"
              >
                {s.scan.unlockPro}
              </button>
            </div>
          )}

          <button
            onClick={() => setPhase("idle")}
            className="mt-4 w-full text-center text-xs text-ink-3 hover:text-ink-2"
          >
            {s.scan.scanAgain}
          </button>
        </div>
      )}
    </div>
  );
}
