// PC Health Score — the explainable scorecard, staged like an instrument.
//
// Design intent (product-owner brief, round three):
// - computing is a CEREMONY: a staged checklist mirrors what the backend
//   genuinely does (profile → tweak states → security reads → scoring), the
//   gauge draws itself, the number counts up. The stages are presentation
//   pacing over one real call — their order and wording match health.rs, so
//   nothing on screen claims work that isn't happening;
// - the gauge is a segmented arc with a needle, not a bare number;
// - every category has an icon, a verdict badge, and a "Show more" that
//   opens the factor breakdown — earned/max as merit bars plus the evidence
//   sentence. The factor list IS the calculation; no hidden weights.
//
// Factor labels stay English from the backend (tweak-name convention): a
// translated label that drifted from the scoring logic would be worse than
// an untranslated one.
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { invoke } from "@tauri-apps/api/core";

type HealthFactor = { id: string; label: string; earned: number; max: number; evidence: string };
type HealthCategory = { id: string; score: number; factors: HealthFactor[] };
type HealthReport = { overall: number; categories: HealthCategory[] };
type BaselineRun = {
  ts: number;
  cpuScore: number;
  memoryTouchMs: number;
  diskWriteMs: number;
  diskRandomReadMs: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  performance: "Performance",
  gaming: "Gaming",
  responsiveness: "Responsiveness",
  memory: "Memory",
  storage: "Storage",
  startup: "Startup",
  maintenance: "Maintenance",
  privacy: "Privacy",
  security: "Security",
};

const stroke = { strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const CATEGORY_ICONS: Record<string, ReactElement> = {
  performance: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M13 3 5 13.5h5L11 21l8-10.5h-5L13 3Z" stroke="currentColor" {...stroke} />
    </svg>
  ),
  gaming: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M7 8h10a4.5 4.5 0 0 1 4.4 5.5l-.6 2.6a2.6 2.6 0 0 1-4.6 1L14.7 15h-5l-1.5 2.1a2.6 2.6 0 0 1-4.6-1l-.6-2.6A4.5 4.5 0 0 1 7 8Z"
        stroke="currentColor"
        {...stroke}
      />
      <path
        d="M8.5 11v3M7 12.5h3M15.4 11.4h0M17.4 13h0"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  ),
  responsiveness: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M4 12h4l2.5-5.5L14 17l2.5-5H20" stroke="currentColor" {...stroke} />
    </svg>
  ),
  memory: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x="4" y="7" width="16" height="10" rx="1.5" stroke="currentColor" {...stroke} />
      <path
        d="M8 10.5v3M12 10.5v3M16 10.5v3M6 17v2.4M10 17v2.4M14 17v2.4M18 17v2.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  storage: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <ellipse cx="12" cy="6.5" rx="7" ry="2.8" stroke="currentColor" {...stroke} />
      <path
        d="M5 6.5v11c0 1.55 3.1 2.8 7 2.8s7-1.25 7-2.8v-11M5 12c0 1.55 3.1 2.8 7 2.8s7-1.25 7-2.8"
        stroke="currentColor"
        {...stroke}
      />
    </svg>
  ),
  startup: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M12 3c3.2 1.9 5 5 5 8.4 0 1.5-.3 2.9-.8 4.1L12 14l-4.2 1.5A10.6 10.6 0 0 1 7 11.4C7 8 8.8 4.9 12 3Z"
        stroke="currentColor"
        {...stroke}
      />
      <path
        d="M9 18.5 8 21m7-2.5 1 2.5m-4-2v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  maintenance: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M14.5 6.5a4 4 0 0 0-5.4 4.7L4 16.3V20h3.7l5.1-5.1a4 4 0 0 0 4.7-5.4l-2.6 2.6-2.5-.6-.6-2.5 2.7-2.5Z"
        stroke="currentColor"
        {...stroke}
      />
    </svg>
  ),
  privacy: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M12 3 5.5 5.6v5c0 4.1 2.7 7.8 6.5 9 3.8-1.2 6.5-4.9 6.5-9v-5L12 3Z"
        stroke="currentColor"
        {...stroke}
      />
      <circle cx="12" cy="10.3" r="1.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12v2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  security: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x="5.5" y="10" width="13" height="9" rx="1.8" stroke="currentColor" {...stroke} />
      <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" {...stroke} />
      <circle cx="12" cy="14.5" r="1.4" fill="currentColor" />
    </svg>
  ),
};

function tone(score: number): { text: string; stroke: string; badge: string } {
  if (score >= 85)
    return {
      text: "text-emerald-300",
      stroke: "#34d399",
      badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
    };
  if (score >= 65)
    return {
      text: "text-amber-300",
      stroke: "#fbbf24",
      badge: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
    };
  if (score >= 45)
    return {
      text: "text-orange-300",
      stroke: "#fb923c",
      badge: "bg-orange-400/10 text-orange-300 ring-orange-400/30",
    };
  return {
    text: "text-rose-300",
    stroke: "#fb7185",
    badge: "bg-rose-400/10 text-rose-300 ring-rose-400/30",
  };
}

/** Signed percentage delta; `higherIsBetter` decides which direction is green. */
function delta(
  prev: number,
  now: number,
  higherIsBetter: boolean,
): { text: string; good: boolean } | null {
  if (prev <= 0 || now <= 0) return null;
  const pct = ((now - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return { text: "=", good: true };
  const good = higherIsBetter ? pct > 0 : pct < 0;
  return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`, good };
}

/** 0 → target count-up, eased, driven by rAF. */
function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  const frame = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs]);
  return value;
}

/** Segmented speedometer: 40 ticks over 240°, gradient by position, lit up
 *  to the score; a needle points at it; the number counts up in the middle. */
function Speedometer({ score, verdict }: { score: number; verdict: string }) {
  const shown = useCountUp(score, 1100);
  const t = tone(score);
  const SEGMENTS = 40;
  const START = -210; // degrees; sweep 240° to +30
  const SWEEP = 240;
  const lit = Math.round((shown / 100) * SEGMENTS);
  const needleAngle = START + (shown / 100) * SWEEP;
  const ticks = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const angle = ((START + (i / (SEGMENTS - 1)) * SWEEP) * Math.PI) / 180;
    const inner = 62;
    const outer = 74;
    const x1 = 90 + inner * Math.cos(angle);
    const y1 = 90 + inner * Math.sin(angle);
    const x2 = 90 + outer * Math.cos(angle);
    const y2 = 90 + outer * Math.sin(angle);
    // Position-based gradient: the dial always shows the full rose→emerald
    // range; only how far it lights up depends on the score.
    const hue = 350 + (i / (SEGMENTS - 1)) * 130; // 350 (rose) → 480≈120 (green)
    const on = i < lit;
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={on ? `hsl(${String(hue % 360)} 80% 62%)` : "rgba(255,255,255,0.09)"}
        strokeWidth="4.4"
        strokeLinecap="round"
      />,
    );
  }
  return (
    <svg
      width="180"
      height="160"
      viewBox="0 0 180 150"
      role="img"
      aria-label={`${String(score)} / 100`}
    >
      {ticks}
      {/* needle */}
      <g
        transform={`rotate(${String(needleAngle)} 90 90)`}
        style={{ transition: "transform 120ms linear" }}
      >
        <line
          x1="90"
          y1="90"
          x2="142"
          y2="90"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="90"
          cy="90"
          r="4.5"
          fill="#0c0f0c"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="1.6"
        />
      </g>
      <text
        x="90"
        y="122"
        textAnchor="middle"
        className={`fill-current ${t.text}`}
        style={{ fontSize: 34, fontWeight: 850, letterSpacing: "-0.03em" }}
      >
        {shown}
      </text>
      <text
        x="90"
        y="138"
        textAnchor="middle"
        fill="rgba(255,255,255,0.4)"
        style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.18em" }}
      >
        {verdict}
      </text>
    </svg>
  );
}

function MiniRing({ score }: { score: number }) {
  const t = tone(score);
  const radius = 12.5;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" className="shrink-0">
      <circle
        cx="15"
        cy="15"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="3"
      />
      <circle
        cx="15"
        cy="15"
        r={radius}
        fill="none"
        stroke={t.stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${String(filled)} ${String(circumference - filled)}`}
        transform="rotate(-90 15 15)"
        style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)" }}
      />
      <text
        x="15"
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
        className={`fill-current ${t.text}`}
        style={{ fontSize: 9.5, fontWeight: 800 }}
      >
        {score}
      </text>
    </svg>
  );
}

export function HealthPanel({
  title,
  subtitle,
  refreshLabel,
  computeLabel,
  computingLabel,
  idleHint,
  showMore,
  showLess,
  stages,
  verdicts,
  baseline,
}: {
  title: string;
  subtitle: string;
  refreshLabel: string;
  computeLabel: string;
  computingLabel: string;
  idleHint: string;
  showMore: string;
  showLess: string;
  stages: [string, string, string, string];
  verdicts: { excellent: string; good: string; fair: string; needsWork: string };
  baseline: { title: string; hint: string; run: string; running: string; empty: string };
}) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [stageIndex, setStageIndex] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [runs, setRuns] = useState<BaselineRun[] | null>(null);
  const [benchBusy, setBenchBusy] = useState(false);

  const verdictFor = useCallback(
    (score: number): string => {
      if (score >= 85) return verdicts.excellent;
      if (score >= 65) return verdicts.good;
      if (score >= 45) return verdicts.fair;
      return verdicts.needsWork;
    },
    [verdicts],
  );

  const compute = useCallback(() => {
    setPhase("loading");
    setError(null);
    setOpen(null);
    setStageIndex(0);
    // The stages mirror what health_report actually does, in order. The
    // ticker paces their reveal; the last one completes only when the real
    // call resolves — and never before a minimum dwell, so the ceremony
    // reads as measurement rather than a flicker.
    const ticker = window.setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, 3));
    }, 420);
    const begun = performance.now();
    const MIN_DWELL_MS = 1900;
    invoke<HealthReport>("health_report")
      .then((r) => {
        const wait = Math.max(0, MIN_DWELL_MS - (performance.now() - begun));
        window.setTimeout(() => {
          window.clearInterval(ticker);
          setStageIndex(4);
          setReport(r);
          setPhase("done");
        }, wait);
      })
      .catch((e: unknown) => {
        window.clearInterval(ticker);
        setError(typeof e === "string" ? e : "Health report failed.");
        setPhase(report ? "done" : "idle");
      });
    invoke<BaselineRun[]>("list_baselines")
      .then(setRuns)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runBaseline = useCallback(() => {
    setBenchBusy(true);
    invoke<BaselineRun>("run_baseline")
      .then(() =>
        invoke<BaselineRun[]>("list_baselines")
          .then(setRuns)
          .catch(() => undefined),
      )
      .catch(() => undefined)
      .finally(() => {
        setBenchBusy(false);
      });
  }, []);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          <p className="mt-0.5 max-w-md text-xs leading-relaxed text-white/45">{subtitle}</p>
        </div>
        {phase === "done" && (
          <button
            type="button"
            onClick={compute}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            {refreshLabel}
          </button>
        )}
      </div>

      {error !== null && <p className="relative mt-4 text-xs text-rose-300">{error}</p>}

      {phase === "idle" && (
        <div className="relative mb-4 mt-8 flex flex-col items-center gap-4 text-center">
          <div className="grid h-24 w-24 place-items-center rounded-full border border-dashed border-white/15 text-white/25">
            <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9">
              <path
                d="M3.5 12h3l2.5-6 4 12 2.5-6h5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-white/40">{idleHint}</p>
          <button
            type="button"
            onClick={compute}
            className="rounded-xl bg-emerald-400/90 px-5 py-2.5 text-xs font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300"
          >
            {computeLabel}
          </button>
        </div>
      )}

      {phase === "loading" && (
        /* The ceremony: pulsing dial skeleton + the real pipeline as a
           checklist that completes stage by stage. */
        <div className="relative mb-4 mt-8 flex flex-col items-center gap-6">
          <div className="relative grid h-32 w-32 place-items-center">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400/70 [animation-duration:1.1s]" />
            <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-amber-400/50 [animation-duration:1.7s]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              {computingLabel}
            </span>
          </div>
          <ul className="grid gap-1.5 text-[11px]">
            {stages.map((label, i) => {
              const state = i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 transition-colors ${state === "pending" ? "text-white/25" : state === "active" ? "text-white/80" : "text-emerald-300/80"}`}
                >
                  <span className="grid h-4 w-4 place-items-center">
                    {state === "done" ? (
                      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                        <path
                          d="m3.5 8.5 3 3 6-7"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : state === "active" ? (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
                    )}
                  </span>
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {phase === "done" && report !== null && (
        <div className="relative mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex shrink-0 flex-col items-center lg:w-48">
            <Speedometer score={report.overall} verdict={verdictFor(report.overall)} />
          </div>

          <div className="grid min-w-0 flex-1 gap-1.5">
            {report.categories.map((cat) => {
              const expanded = open === cat.id;
              const t = tone(cat.score);
              return (
                <div
                  key={cat.id}
                  className={`rounded-xl border bg-black/25 transition-colors ${expanded ? "border-white/20" : "border-white/10 hover:border-white/15"}`}
                >
                  <div className="flex w-full items-center gap-3 px-3 py-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white/55">
                      {CATEGORY_ICONS[cat.id]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/80">
                      {CATEGORY_LABELS[cat.id] ?? cat.id}
                    </span>
                    <span
                      className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wider ring-1 sm:inline ${t.badge}`}
                    >
                      {verdictFor(cat.score)}
                    </span>
                    <MiniRing score={cat.score} />
                    <button
                      type="button"
                      className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold text-white/40 transition hover:bg-white/5 hover:text-white"
                      onClick={() => {
                        setOpen(expanded ? null : cat.id);
                      }}
                      aria-expanded={expanded}
                    >
                      {expanded ? showLess : showMore}
                    </button>
                  </div>
                  {expanded && (
                    <ul className="border-t border-white/10 px-3 py-2.5">
                      {cat.factors.map((f) => {
                        const ratio = f.max === 0 ? 0 : f.earned / f.max;
                        return (
                          <li
                            key={f.id}
                            className="grid grid-cols-[minmax(0,1fr)_72px_44px] items-center gap-3 py-1.5 text-[11px]"
                          >
                            <span className="min-w-0 text-white/70">
                              {f.label}
                              <span className="ml-1.5 text-white/35">· {f.evidence}</span>
                            </span>
                            <span className="h-1 overflow-hidden rounded-full bg-white/10">
                              <span
                                className={`block h-full rounded-full ${ratio >= 1 ? "bg-emerald-400/80" : ratio <= 0 ? "bg-rose-400/60" : "bg-amber-400/70"}`}
                                style={{ width: `${String(Math.max(4, ratio * 100))}%` }}
                              />
                            </span>
                            <span
                              className={`text-right tabular-nums ${ratio >= 1 ? "text-emerald-300/80" : ratio <= 0 ? "text-rose-300/70" : "text-white/50"}`}
                            >
                              {f.earned}/{f.max}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phase === "done" && report !== null && (
        <div className="relative mt-4 rounded-xl border border-white/10 bg-black/25 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-white/80">{baseline.title}</h3>
              <p className="mt-0.5 text-[11px] text-white/40">{baseline.hint}</p>
            </div>
            <button
              type="button"
              onClick={runBaseline}
              disabled={benchBusy}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              {benchBusy ? baseline.running : baseline.run}
            </button>
          </div>
          {runs !== null && runs.length === 0 && !benchBusy && (
            <p className="mt-2.5 text-[11px] text-white/35">{baseline.empty}</p>
          )}
          {runs !== null && runs.length > 0 && (
            <table className="mt-2.5 w-full text-[11px]">
              <tbody>
                {(
                  [
                    ["CPU", (r: BaselineRun) => r.cpuScore, true, ""],
                    ["Memory touch", (r: BaselineRun) => r.memoryTouchMs, false, " ms"],
                    ["Disk write", (r: BaselineRun) => r.diskWriteMs, false, " ms"],
                    ["Disk random read", (r: BaselineRun) => r.diskRandomReadMs, false, " ms"],
                  ] as [string, (r: BaselineRun) => number, boolean, string][]
                ).map(([label, get, higher, unit]) => {
                  const last = runs[runs.length - 1];
                  const prev = runs.length > 1 ? runs[runs.length - 2] : null;
                  const d = prev ? delta(get(prev), get(last), higher) : null;
                  return (
                    <tr key={label} className="border-t border-white/5">
                      <td className="py-1 text-white/55">{label}</td>
                      <td className="py-1 text-right tabular-nums text-white/75">
                        {get(last)}
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
        </div>
      )}
    </section>
  );
}
