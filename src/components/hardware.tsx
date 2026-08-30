import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { format, Strings } from "../i18n";
import { readCachedDriverAudit, writeCachedDriverAudit } from "../lib";
import {
  DriverAudit,
  DriverEntry,
  DriverUpdate,
  GpuPowerInfo,
  InstallOutcome,
  ScanProgress,
  ThermalReport,
  UpdateSearchResult,
} from "../types";
import { DriverBoosterCard } from "./pro";

/* ------------------------------------------------------------------ *
 * Shared thermal scale
 * ------------------------------------------------------------------ */

/** How many live samples the trace and the session verdict keep. At the 2s
 *  poll below this is a rolling two-minute window. */
const TRACE_SAMPLES = 60;
const POLL_MS = 2000;

/** Above this a GeForce card is in throttling territory. */
const HOT_C = 84;
/** Sustained below this *while actually working* is genuinely good. */
const COOL_UNDER_LOAD_C = 65;
/** Below this utilisation the card isn't being asked to do anything, so its
 *  temperature says nothing about how well it cools. */
const MEANINGFUL_LOAD_PCT = 30;

/**
 * Temperature to colour. A step scale, not a smooth ramp: the boundaries are
 * the ones that mean something on a GPU, and a gradient would imply a
 * precision the reading doesn't have.
 */
function tempColor(c: number): string {
  if (c >= HOT_C) return "#f87171";
  if (c >= 72) return "#fbbf24";
  if (c >= 50) return "#34d399";
  return "#38bdf8";
}

function tempVerdict(c: number, s: Strings): string {
  if (c >= HOT_C) return s.hardware.tempHot;
  if (c >= 72) return s.hardware.tempWarm;
  if (c >= 50) return s.hardware.tempGood;
  return s.hardware.tempCool;
}

/* ------------------------------------------------------------------ *
 * Gauges
 * ------------------------------------------------------------------ */

/**
 * Segmented arc gauge. The scale runs 30-100°C because nothing below 30 is
 * reachable and nothing above 100 is survivable — starting at zero would
 * waste two thirds of the arc on temperatures no card ever reports.
 */
function ThermalArc({ tempC, s }: { tempC: number; s: Strings }) {
  const MIN = 30;
  const MAX = 100;
  const SEGMENTS = 34;
  const clamped = Math.max(MIN, Math.min(MAX, tempC));
  const lit = Math.round(((clamped - MIN) / (MAX - MIN)) * SEGMENTS);
  const colour = tempColor(tempC);

  const ticks = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const angle = (170 + (i / (SEGMENTS - 1)) * 200) * (Math.PI / 180);
    const cx = 90;
    const cy = 86;
    ticks.push(
      <line
        key={i}
        x1={cx + Math.cos(angle) * 56}
        y1={cy + Math.sin(angle) * 56}
        x2={cx + Math.cos(angle) * 70}
        y2={cy + Math.sin(angle) * 70}
        stroke={i < lit ? colour : "rgba(255,255,255,0.08)"}
        strokeWidth="4.2"
        strokeLinecap="round"
        style={{ transition: "stroke 500ms ease-out" }}
      />,
    );
  }

  return (
    <svg
      width="180"
      height="150"
      viewBox="0 0 180 146"
      role="img"
      aria-label={`${String(Math.round(tempC))} °C`}
      className="shrink-0"
    >
      {ticks}
      <text
        x="90"
        y="96"
        textAnchor="middle"
        fill={colour}
        style={{ fontSize: 38, fontWeight: 850, letterSpacing: "-0.04em" }}
      >
        {Math.round(tempC)}
        <tspan style={{ fontSize: 17, fontWeight: 700 }}>°</tspan>
      </text>
      <text
        x="90"
        y="118"
        textAnchor="middle"
        fill="rgba(255,255,255,0.42)"
        style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.18em" }}
      >
        {tempVerdict(tempC, s).toUpperCase()}
      </text>
    </svg>
  );
}

/** Rolling trace of the session's temperature samples. */
function TempTrace({ samples }: { samples: number[] }) {
  const W = 560;
  const H = 44;
  if (samples.length < 2) return <div className="h-11" />;

  // The band is fitted to the data rather than fixed to 30-100: a card that
  // sits between 47 and 52 all session would otherwise draw a flat line. A 6°
  // floor keeps sensor jitter from being magnified into dramatic swings.
  const lo = Math.min(...samples);
  const hi = Math.max(...samples);
  const mid = (lo + hi) / 2;
  const span = Math.max(6, hi - lo);
  const top = mid + span / 2;
  const bottom = mid - span / 2;

  const pts = samples
    .map((v, i) => {
      const x = (i / (TRACE_SAMPLES - 1)) * W;
      const y = H - ((v - bottom) / (top - bottom)) * H;
      return `${String(Math.round(x * 10) / 10)},${String(Math.round(y * 10) / 10)}`;
    })
    .join(" ");
  const lastX = ((samples.length - 1) / (TRACE_SAMPLES - 1)) * W;
  const colour = tempColor(samples[samples.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      preserveAspectRatio="none"
      className="h-11 w-full"
      aria-hidden="true"
    >
      <polygon
        points={`0,${String(H)} ${pts} ${String(lastX)},${String(H)}`}
        fill={colour}
        opacity="0.09"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={colour}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** A labelled proportion bar for the secondary GPU figures. */
function MetricBar({
  label,
  value,
  detail,
  pct,
}: {
  label: string;
  value: string;
  detail?: string;
  pct: number | null;
}) {
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">{label}</span>
        <span className="type-data shrink-0 text-[13px] font-bold tabular-nums text-ink">
          {value}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
        {pct !== null && (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
            style={{ width: `${String(clamped)}%` }}
          />
        )}
      </div>
      {detail && <p className="mt-1 truncate text-[10.5px] text-ink-3">{detail}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Session stopwatch and verdict
 * ------------------------------------------------------------------ */

export type ThermalSample = { tempC: number; loadPct: number | null };

/** Per-GPU rolling history: the trace the chart draws and the samples the
 *  session verdict is judged from. */
type GpuHistory = { trace: number[]; session: ThermalSample[] };

type Verdict = "risky" | "normal" | "better" | "idle";

/**
 * Judges the session from what the card actually did, not from its current
 * number.
 *
 * The load condition is the honest part: a card sitting at 40°C doing nothing
 * has proved nothing about its cooling, so it is reported as idle rather than
 * congratulated. "Better than expected" is only claimed once the card has
 * genuinely been working and stayed cool while doing it.
 */
export function judgeSession(samples: ThermalSample[]): Verdict {
  if (samples.length === 0) return "idle";
  const peak = Math.max(...samples.map((x) => x.tempC));
  if (peak >= HOT_C) return "risky";

  const working = samples.filter((x) => (x.loadPct ?? 0) >= MEANINGFUL_LOAD_PCT);
  // Five samples is ten seconds of real work — enough that the reading is
  // about the cooler and not about one transient frame.
  if (working.length < 5) return "idle";

  const peakUnderLoad = Math.max(...working.map((x) => x.tempC));
  return peakUnderLoad < COOL_UNDER_LOAD_C ? "better" : "normal";
}

function verdictStyle(v: Verdict): { text: string; ring: string; dot: string } {
  if (v === "risky") {
    return {
      text: "text-rose-300",
      ring: "ring-[color-mix(in_oklab,#f87171_40%,transparent)]",
      dot: "#f87171",
    };
  }
  if (v === "better") {
    return {
      text: "text-sky-300",
      ring: "ring-[color-mix(in_oklab,#38bdf8_40%,transparent)]",
      dot: "#38bdf8",
    };
  }
  if (v === "normal") {
    return {
      text: "text-emerald-300",
      ring: "ring-[color-mix(in_oklab,#34d399_35%,transparent)]",
      dot: "#34d399",
    };
  }
  return { text: "text-ink-3", ring: "ring-line-2", dot: "#6b7280" };
}

function verdictLabel(v: Verdict, s: Strings): string {
  if (v === "risky") return s.hardware.verdictRisky;
  if (v === "better") return s.hardware.verdictBetter;
  if (v === "normal") return s.hardware.verdictNormal;
  return s.hardware.verdictIdle;
}

function verdictHint(v: Verdict, s: Strings): string {
  if (v === "risky") return s.hardware.verdictRiskyHint;
  if (v === "better") return s.hardware.verdictBetterHint;
  if (v === "normal") return s.hardware.verdictNormalHint;
  return s.hardware.verdictIdleHint;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Elapsed watch plus the verdict that elapsed time earned. */
function SessionWatch({
  s,
  seconds,
  samples,
}: {
  s: Strings;
  seconds: number;
  samples: ThermalSample[];
}) {
  const verdict = judgeSession(samples);
  const style = verdictStyle(verdict);
  const peak = samples.length > 0 ? Math.max(...samples.map((x) => x.tempC)) : null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-4">
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
          {s.hardware.watchLabel}
        </p>
        <p className="type-data mt-0.5 text-[26px] font-black leading-none tabular-nums text-ink">
          {clock(seconds)}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-bold ring-1 ${style.ring} ${style.text}`}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: style.dot }}
            aria-hidden="true"
          />
          {verdictLabel(verdict, s)}
        </span>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">{verdictHint(verdict, s)}</p>
      </div>

      {peak !== null && (
        <div className="shrink-0 text-right">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
            {s.hardware.peakLabel}
          </p>
          <p
            className="type-data mt-0.5 text-[18px] font-bold tabular-nums"
            style={{ color: tempColor(peak) }}
          >
            {Math.round(peak)}°
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Thermal profiles (power limit)
 * ------------------------------------------------------------------ */

type ModeKey = "silent" | "standard" | "gaming";

/** What a profile actually sets. `lockClockMhz: null` means "let the card
 *  boost the way the factory intended". */
export type ModePlan = { watts: number; lockClockMhz: number | null };

/**
 * Turns a profile into the two numbers nvidia-smi will be given, derived from
 * the card's own reported range so a profile can never ask for something the
 * driver would refuse.
 *
 * The three profiles are three different wattages, plus a clock lock on
 * Gaming.
 *
 * Standard used to mean "hand the card back its factory default", which on
 * every locked consumer card — where the factory limit already equals the
 * maximum — printed the identical number as Gaming. Two tiles reading "130 W"
 * with the real difference (the clock lock) in grey small print is not a
 * choice anyone can see they are making, and it made the whole control look
 * broken.
 *
 * So Standard is now what its name promises on a three-step scale: a balanced
 * cap a little under the card's ceiling, which is where these cards spend
 * almost no performance for a real drop in heat and noise. Gaming remains the
 * card's full maximum plus the clock ceiling, so nothing here can stop the
 * user from getting every watt the factory allows.
 */
export function modePlan(info: GpuPowerInfo, mode: ModeKey): ModePlan | null {
  const { min_w, max_w, default_w, max_clock_mhz } = info;
  if (min_w === null || max_w === null) return null;
  const base = default_w ?? max_w;

  if (mode === "gaming") {
    return { watts: max_w, lockClockMhz: max_clock_mhz };
  }
  if (mode === "standard") {
    // 85% of the factory default. Far enough below Gaming to be a visibly
    // different number and an audibly different fan, close enough that the
    // frame-rate cost is in the low single digits.
    return { watts: Math.max(min_w, Math.round(base * 0.85)), lockClockMhz: null };
  }
  // Silent caps at 60% of the factory default. It was 70%, which on a 130 W
  // card meant 91 W — a real cut on paper, but not one you could hear: the
  // fan curve barely moved, so the profile felt like it had done nothing.
  // 60% lands far enough down the curve that the drop is audible, which is
  // the entire point of a profile called Silent. The card's own floor still
  // wins, so this can never ask for less than the driver accepts.
  return { watts: Math.max(min_w, Math.round(base * 0.6)), lockClockMhz: null };
}

function ThermalProfiles({
  s,
  info,
  onApplied,
  pushToast,
}: {
  s: Strings;
  info: GpuPowerInfo;
  onApplied: () => void;
  pushToast: (kind: "success" | "error", message: string) => void;
}) {
  const modes: { key: ModeKey; label: string; hint: string }[] = [
    { key: "silent", label: s.hardware.modeSilent, hint: s.hardware.modeSilentHint },
    { key: "standard", label: s.hardware.modeStandard, hint: s.hardware.modeStandardHint },
    { key: "gaming", label: s.hardware.modeGaming, hint: s.hardware.modeGamingHint },
  ];

  /** Which profile the card is already on, so the screen opens on the truth
   *  rather than on a guess the user then has to correct. */
  function currentMode(): ModeKey {
    const locked =
      info.max_clock_mhz !== null &&
      info.current_clock_mhz !== null &&
      info.current_clock_mhz >= info.max_clock_mhz;
    for (const m of modes) {
      const plan = modePlan(info, m.key);
      if (!plan) continue;
      if (plan.watts === info.current_w && (plan.lockClockMhz !== null) === locked) return m.key;
    }
    return "standard";
  }

  const [selected, setSelected] = useState<ModeKey>(currentMode);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  const plan = modePlan(info, selected);
  const applied = plan !== null && selected === currentMode();

  /**
   * Applies the profile, walking the button through the steps it is actually
   * performing.
   *
   * `set_gpu_profile` returns in well under a second, so the old version
   * flipped straight from "Apply" to "Active" with no perceptible pause. On a
   * control that changes how a graphics card draws power, an instant with no
   * feedback reads as "the click didn't register" rather than "done" — and
   * the fan, which is what the user listens for, takes several seconds to
   * respond to the new limit anyway. The stages hold the sequence open long
   * enough to be read, and the last one is honest about that lag.
   */
  async function apply() {
    if (plan === null) return;
    setBusy(true);
    const hold = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    try {
      setStage(s.hardware.profileStageReading);
      await hold(420);
      setStage(s.hardware.profileStageApplying);
      await invoke("set_gpu_profile", { watts: plan.watts, lockClockMhz: plan.lockClockMhz });
      setStage(s.hardware.profileStageSettling);
      await hold(700);
      pushToast("success", format(s.hardware.profileApplied, { watts: String(plan.watts) }));
      onApplied();
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setStage(null);
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
            {s.hardware.profilesTitle}
          </p>
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-ink-3">
            {s.hardware.profilesSubtitle}
          </p>
        </div>
        {info.current_w !== null && (
          <span className="type-data shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[11.5px] font-bold tabular-nums text-ink-2">
            {format(s.hardware.currentLimit, { watts: String(info.current_w) })}
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {modes.map((m) => {
          const p = modePlan(info, m.key);
          const isSelected = selected === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setSelected(m.key)}
              disabled={busy || p === null}
              aria-pressed={isSelected}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                isSelected
                  ? "border-accent/60 bg-accent-soft"
                  : "border-line-2 hover:border-accent/40 hover:bg-surface-2"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-[13px] font-bold ${isSelected ? "text-accent" : "text-ink"}`}
                >
                  {m.label}
                </span>
                <span className="type-data shrink-0 text-[11.5px] font-bold tabular-nums text-ink-3">
                  {p !== null ? `${String(p.watts)} W` : "—"}
                </span>
              </span>
              {/* The clock line is what visibly separates Gaming from
                  Standard on a card whose watts are already maxed — so on
                  those cards it is promoted out of the grey small print and
                  given the accent, because it is the only thing on the tile
                  that differs. Two tiles both reading "130 W" with the real
                  distinction whispered underneath is what made the profiles
                  look interchangeable. */}
              <span
                className={`type-data mt-0.5 block text-[10.5px] tabular-nums ${
                  p !== null && p.lockClockMhz !== null ? "font-bold text-accent" : "text-ink-3"
                }`}
              >
                {p !== null && p.lockClockMhz !== null
                  ? format(s.hardware.modeClockLocked, { mhz: String(p.lockClockMhz) })
                  : s.hardware.modeClockAuto}
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-ink-3">{m.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void apply()}
          disabled={busy || plan === null || applied}
          className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-[13px] font-bold text-on-accent transition hover:-translate-y-px hover:brightness-110 disabled:cursor-default disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100"
        >
          {busy && (
            <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {busy
            ? (stage ?? s.hardware.modeApplying)
            : applied
              ? s.hardware.profileActive
              : s.hardware.profileApply}
        </button>
        {plan !== null && !applied && (
          <span className="type-data text-[11.5px] tabular-nums text-ink-3">
            {format(s.hardware.profileWillSet, {
              watts: String(plan.watts),
              clock:
                plan.lockClockMhz !== null
                  ? format(s.hardware.modeClockLocked, { mhz: String(plan.lockClockMhz) })
                  : s.hardware.modeClockAuto,
            })}
          </span>
        )}
      </div>

      {info.default_is_max && (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
          {s.hardware.profileDefaultIsMax}
        </p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">{s.hardware.profileNote}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Thermals panel
 * ------------------------------------------------------------------ */

export function ThermalsPanel({
  s,
  pushToast,
}: {
  s: Strings;
  pushToast: (kind: "success" | "error", message: string) => void;
}) {
  const [report, setReport] = useState<ThermalReport | null>(null);
  const [power, setPower] = useState<GpuPowerInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // History is state, not a ref: it is read during render, and a ref read at
  // render time is exactly what forced the old force-render workaround.
  const [history, setHistory] = useState<Record<string, GpuHistory>>({});

  const loadPower = useCallback(() => {
    invoke<GpuPowerInfo>("gpu_power_info")
      .then((p) => setPower(p))
      .catch(() => setPower(null));
  }, []);

  useEffect(() => {
    let alive = true;
    const started = Date.now();

    const tick = () => {
      invoke<ThermalReport>("thermal_report")
        .then((r) => {
          if (!alive) return;
          setHistory((prev) => {
            const next = { ...prev };
            for (const gpu of r.gpus) {
              if (gpu.temp_c === null) continue;
              const old = next[gpu.name] ?? { trace: [], session: [] };
              next[gpu.name] = {
                trace: [...old.trace, gpu.temp_c].slice(-TRACE_SAMPLES),
                session: [
                  ...old.session,
                  { tempC: gpu.temp_c, loadPct: gpu.utilization_pct },
                ].slice(-TRACE_SAMPLES),
              };
            }
            return next;
          });
          setReport(r);
          setFailed(false);
          setSeconds(Math.floor((Date.now() - started) / 1000));
        })
        .catch(() => {
          // One failed poll isn't worth a visible error — the next is two
          // seconds away. Only a state with no data at all says so, and the
          // check reads current state rather than the value captured when
          // this interval was created.
          if (!alive) return;
          setReport((current) => {
            if (current === null) setFailed(true);
            return current;
          });
        });
    };

    tick();
    loadPower();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    return (
      <div className="mb-5 rounded-2xl border border-line bg-surface-1 p-5">
        <p className="text-sm text-ink-3">{s.hardware.thermalsUnavailable}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mb-5 h-[248px] animate-pulse rounded-2xl border border-line bg-surface-1" />
    );
  }

  return (
    <div className="mb-5">
      {report.gpus.map((gpu, index) => {
        const vramPct =
          gpu.vram_used_mb !== null && gpu.vram_total_mb !== null && gpu.vram_total_mb > 0
            ? (gpu.vram_used_mb / gpu.vram_total_mb) * 100
            : null;
        const powerPct =
          gpu.power_w !== null && gpu.power_limit_w !== null && gpu.power_limit_w > 0
            ? (gpu.power_w / gpu.power_limit_w) * 100
            : null;
        const past = history[gpu.name] ?? { trace: [], session: [] };
        const trace = past.trace;
        const session = past.session;

        return (
          <div
            key={gpu.name}
            className="signal relative mb-4 overflow-hidden rounded-2xl border border-line bg-surface-1 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-accent">
                  {s.hardware.gpuLabel}
                </p>
                <h3 className="mt-1 truncate text-[15px] font-semibold text-ink" title={gpu.name}>
                  {gpu.name}
                </h3>
                {gpu.driver_version && (
                  <p className="mt-0.5 text-[11.5px] text-ink-3">
                    {format(s.hardware.gpuDriver, { version: gpu.driver_version })}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-3">
                {s.hardware.liveBadge}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
              {gpu.temp_c !== null ? (
                <ThermalArc tempC={gpu.temp_c} s={s} />
              ) : (
                <div className="grid h-[146px] w-[180px] shrink-0 place-items-center rounded-xl bg-surface-2 px-4 text-center">
                  <p className="text-[11.5px] leading-relaxed text-ink-3">
                    {s.hardware.noTempSensor}
                  </p>
                </div>
              )}

              <div className="grid min-w-[230px] flex-1 grid-cols-2 gap-x-5 gap-y-4">
                <MetricBar
                  label={s.hardware.load}
                  value={
                    gpu.utilization_pct !== null
                      ? `${String(Math.round(gpu.utilization_pct))}%`
                      : "—"
                  }
                  pct={gpu.utilization_pct}
                />
                <MetricBar
                  label={s.hardware.vram}
                  value={vramPct !== null ? `${String(Math.round(vramPct))}%` : "—"}
                  detail={
                    gpu.vram_used_mb !== null && gpu.vram_total_mb !== null
                      ? `${String(Math.round((gpu.vram_used_mb / 1024) * 10) / 10)} / ${String(
                          Math.round((gpu.vram_total_mb / 1024) * 10) / 10,
                        )} GB`
                      : undefined
                  }
                  pct={vramPct}
                />
                <MetricBar
                  label={s.hardware.fan}
                  value={gpu.fan_pct !== null ? `${String(Math.round(gpu.fan_pct))}%` : "—"}
                  detail={gpu.fan_pct === 0 ? s.hardware.fanIdle : undefined}
                  pct={gpu.fan_pct}
                />
                <MetricBar
                  label={s.hardware.power}
                  value={gpu.power_w !== null ? `${String(Math.round(gpu.power_w))} W` : "—"}
                  detail={
                    gpu.power_limit_w !== null
                      ? format(s.hardware.powerLimit, {
                          limit: String(Math.round(gpu.power_limit_w)),
                        })
                      : undefined
                  }
                  pct={powerPct}
                />
              </div>
            </div>

            {/* Four samples in before drawing: a two-point line is a stub
                that reads as a rendering glitch rather than a trend. */}
            {trace.length >= 4 && (
              <div className="mt-4 border-t border-line pt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
                    {s.hardware.traceLabel}
                  </span>
                  <span className="type-data text-[10.5px] tabular-nums text-ink-3">
                    {format(s.hardware.traceRange, {
                      min: String(Math.round(Math.min(...trace))),
                      max: String(Math.round(Math.max(...trace))),
                    })}
                  </span>
                </div>
                <TempTrace samples={trace} />
              </div>
            )}

            <SessionWatch s={s} seconds={seconds} samples={session} />

            {/* Profiles belong to the first card: the limit is set per GPU
                index and only index 0 is addressed today. */}
            {index === 0 && power?.supported && (
              <ThermalProfiles s={s} info={power} onApplied={loadPower} pushToast={pushToast} />
            )}
          </div>
        );
      })}

      {/* CPU: a reading when the firmware publishes one, an explanation when
          it doesn't. Never a number this app cannot stand behind. */}
      <div className="rounded-2xl border border-line bg-surface-1 p-5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-accent">
          {s.hardware.cpuLabel}
        </p>
        {report.cpu_temp_c !== null ? (
          <div className="mt-2 flex items-baseline gap-3">
            <span
              className="type-data text-[34px] font-black leading-none tracking-tight tabular-nums"
              style={{ color: tempColor(report.cpu_temp_c) }}
            >
              {Math.round(report.cpu_temp_c)}°
            </span>
            <span className="text-[12px] text-ink-3">{s.hardware.cpuAcpiSource}</span>
          </div>
        ) : (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-3">
            {s.hardware.cpuNoSensor}
          </p>
        )}
      </div>

      {report.gpu_source === "none" && (
        <p className="mt-3 text-[12px] leading-relaxed text-ink-3">{s.hardware.noGpuTool}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Drivers
 * ------------------------------------------------------------------ */

function tierStyle(tier: string): { ring: string; text: string } {
  if (tier === "stale") {
    return { ring: "ring-[color-mix(in_oklab,#f87171_38%,transparent)]", text: "text-rose-300" };
  }
  if (tier === "aging") {
    return { ring: "ring-[color-mix(in_oklab,#fbbf24_38%,transparent)]", text: "text-amber-300" };
  }
  return { ring: "ring-[color-mix(in_oklab,#34d399_30%,transparent)]", text: "text-emerald-300" };
}

function ageLabel(days: number, s: Strings): string {
  const years = days / 365;
  if (years >= 1) {
    const shown = Math.round(years * 10) / 10;
    // Singular matters because these render as-is: "1 months" on a driver
    // installed last month reads as a bug even though the maths is right.
    return format(shown === 1 ? s.hardware.ageYear : s.hardware.ageYears, { years: String(shown) });
  }
  const months = Math.max(1, Math.round(days / 30));
  return format(months === 1 ? s.hardware.ageMonth : s.hardware.ageMonths, {
    months: String(months),
  });
}

function DriverRow({ entry, s }: { entry: DriverEntry; s: Strings }) {
  const style = tierStyle(entry.tier);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-ink" title={entry.device}>
          {entry.device}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-ink-3">
          {entry.class} · {entry.provider} ·{" "}
          {format(s.hardware.driverInstalled, { version: entry.version, date: entry.date })}
        </p>
      </div>
      <span
        className={`type-data shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ring-1 ${style.ring} ${style.text}`}
      >
        {ageLabel(entry.age_days, s)}
      </span>
      {entry.vendor_url && (
        <button
          onClick={() => void openUrl(entry.vendor_url as string).catch(() => {})}
          className="shrink-0 rounded-lg border border-line-2 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-2 transition-colors hover:border-accent/40 hover:text-ink"
        >
          {s.hardware.vendorSite}
        </button>
      )}
    </div>
  );
}

/**
 * Driver age audit.
 *
 * The framing is the feature: this counts years, it does not claim updates
 * exist. Windows records what is installed, never what is available, and this
 * app makes no call to a vendor to find out — so it reports the age it can
 * prove, stamps when it read it, and hands over the vendor's own page.
 */
/**
 * The last completed scan, kept at module scope on purpose.
 *
 * Walking every device class takes about sixteen seconds, and the panel
 * unmounts the moment the user looks at another screen. Holding the result in
 * component state alone meant coming back to Hardware silently paid for the
 * whole scan again — which is what made it look like the app was rescanning
 * on its own. The cache is only replaced by an explicit Rescan.
 */
// Seeded from localStorage so a relaunch shows the last scan instead of
// paying sixteen seconds again for nothing that changed. Module-level state
// then carries it for the rest of the session, the same as before. Read
// lazily (on first component mount) rather than at module load, since
// localStorage does not exist outside a browser (e.g. this file is also
// bundled and imported by the thermals unit tests under Node).
let cachedAudit: DriverAudit | null = null;
let cachedAuditAt: Date | null = null;
let cachedAuditLoaded = false;
function loadCachedAudit(): void {
  if (cachedAuditLoaded) return;
  cachedAuditLoaded = true;
  const storedAudit = readCachedDriverAudit();
  cachedAudit = storedAudit?.audit ?? null;
  cachedAuditAt = storedAudit?.at ?? null;
}

export function DriversPanel({
  s,
  pushToast,
}: {
  s: Strings;
  pushToast: (kind: "success" | "error", message: string) => void;
}) {
  const [audit, setAudit] = useState<DriverAudit | null>(() => {
    loadCachedAudit();
    return cachedAudit;
  });
  const [checkedAt, setCheckedAt] = useState<Date | null>(() => cachedAuditAt);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [updates, setUpdates] = useState<UpdateSearchResult | null>(null);
  // Every result starts checked: "download all" is the default action, and
  // unchecking one is how you get the custom subset instead of it being a
  // second, separate flow.
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [outcome, setOutcome] = useState<InstallOutcome | null>(null);
  // Busy only when there is nothing cached to show: a return visit renders
  // the previous result immediately instead of a progress bar for work it is
  // not going to do.
  const [busy, setBusy] = useState(() => cachedAudit === null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [rebootNeeded, setRebootNeeded] = useState(false);

  // Real progress from the Rust side: one event per device class actually
  // read, so the bar tracks work rather than a timer.
  useEffect(() => {
    const unlisten = listen<ScanProgress>("driver-scan-progress", (e) => {
      setProgress(e.payload);
    });
    return () => {
      void unlisten.then((off) => {
        off();
      });
    };
  }, []);

  const checkReboot = useCallback(() => {
    invoke<boolean>("reboot_pending")
      .then((v) => setRebootNeeded(v))
      .catch(() => setRebootNeeded(false));
  }, []);

  /** Manual rescan: a click handler, so setting state up front is fine. */
  const run = useCallback(() => {
    setBusy(true);
    setError(null);
    setProgress(null);
    invoke<DriverAudit>("driver_audit")
      .then((a) => {
        const at = new Date();
        cachedAudit = a;
        cachedAuditAt = at;
        writeCachedDriverAudit(a, at);
        setAudit(a);
        setCheckedAt(at);
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => {
        setBusy(false);
        setProgress(null);
      });
  }, []);

  // The first load deliberately does not go through `run`: every state change
  // here happens in a promise callback rather than synchronously in the
  // effect body, and an unmount guard keeps a slow scan from setting state on
  // a screen the user already left.
  useEffect(() => {
    let alive = true;
    // Already scanned this session: show it and skip the sixteen seconds.
    if (cachedAudit !== null) {
      invoke<boolean>("reboot_pending")
        .then((v) => {
          if (alive) setRebootNeeded(v);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }
    invoke<DriverAudit>("driver_audit")
      .then((a) => {
        if (!alive) return;
        const at = new Date();
        cachedAudit = a;
        cachedAuditAt = at;
        writeCachedDriverAudit(a, at);
        setAudit(a);
        setCheckedAt(at);
        setProgress(null);
      })
      .catch((e: unknown) => {
        if (alive) setError(String(e));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    invoke<boolean>("reboot_pending")
      .then((v) => {
        if (alive) setRebootNeeded(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Windows only sets the pending-restart flag once an install finishes, so
  // re-reading it when the window regains focus is what catches an update the
  // user installed while they were away in Windows Update.
  useEffect(() => {
    window.addEventListener("focus", checkReboot);
    return () => {
      window.removeEventListener("focus", checkReboot);
    };
  }, [checkReboot]);

  const aging = audit?.entries.filter((e) => e.tier === "aging").length ?? 0;
  const stale = audit?.entries.filter((e) => e.tier === "stale").length ?? 0;
  // The list leads with the classes people act on; everything else is still
  // scanned and counted, and reachable behind "show all".
  const NOTEWORTHY = 6;
  const visible = showAll ? (audit?.entries ?? []) : (audit?.entries ?? []).slice(0, NOTEWORTHY);
  const pct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{s.hardware.driversTitle}</h3>
          <p className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-ink-3">
            {s.hardware.driversSubtitle}
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="shrink-0 rounded-xl border border-line-2 px-4 py-2 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? s.hardware.driversScanning : s.hardware.driversRescan}
        </button>
      </div>

      {/* Progress is shown as position-in-work: which class, how many of how
          many, and the percentage that follows from those two. */}
      {busy && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-[12px] text-ink-2">
              {progress && progress.class
                ? format(s.hardware.scanReading, { class: progress.class })
                : s.hardware.scanStarting}
            </span>
            <span className="type-data shrink-0 text-[12px] font-bold tabular-nums text-ink">
              {progress
                ? format(s.hardware.scanCount, {
                    done: String(progress.done),
                    total: String(progress.total),
                    pct: String(pct),
                  })
                : ""}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${String(Math.max(2, pct))}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-[12.5px] text-rose-300">{error}</p>}

      {/* Only shown when Windows itself reports a pending restart, so it is
          never a routine nag. */}
      {rebootNeeded && (
        <div className="mt-4 rounded-xl px-4 py-3 ring-1 ring-[color-mix(in_oklab,#fbbf24_40%,transparent)]">
          <p className="text-[12.5px] font-semibold text-amber-300">{s.hardware.rebootTitle}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-3">{s.hardware.rebootBody}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              onClick={() => {
                void invoke("reboot_now").catch((e: unknown) => pushToast("error", String(e)));
              }}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-[12px] font-bold text-on-accent"
            >
              {s.hardware.rebootNow}
            </button>
            <button
              onClick={() => setRebootNeeded(false)}
              className="rounded-lg border border-line-2 px-3.5 py-1.5 text-[12px] font-semibold text-ink-2 hover:text-ink"
            >
              {s.hardware.rebootLater}
            </button>
          </div>
        </div>
      )}

      {audit && !error && !busy && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2">
              {format(s.hardware.driversScannedAll, {
                total: String(audit.total_scanned),
                classes: String(audit.classes_scanned),
              })}
            </span>
            <span className="rounded-full bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold text-ink-2">
              {format(s.hardware.driversCounted, { count: String(audit.entries.length) })}
            </span>
            {aging > 0 && (
              <span className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-amber-300 ring-1 ring-[color-mix(in_oklab,#fbbf24_38%,transparent)]">
                {format(s.hardware.driversAging, { count: String(aging) })}
              </span>
            )}
            {stale > 0 && (
              <span className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-rose-300 ring-1 ring-[color-mix(in_oklab,#f87171_38%,transparent)]">
                {format(s.hardware.driversStale, { count: String(stale) })}
              </span>
            )}
            {aging === 0 && stale === 0 && audit.entries.length > 0 && (
              <span className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-emerald-300 ring-1 ring-[color-mix(in_oklab,#34d399_30%,transparent)]">
                {s.hardware.driversAllCurrent}
              </span>
            )}
          </div>

          {audit.entries.length > 0 ? (
            <div className="mt-3">
              {visible.map((entry) => (
                <DriverRow
                  key={`${entry.device}-${entry.version}-${entry.date}`}
                  entry={entry}
                  s={s}
                />
              ))}
              {audit.entries.length > NOTEWORTHY && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-3 text-[12.5px] font-semibold text-accent transition-opacity hover:opacity-80"
                >
                  {showAll
                    ? s.hardware.driversShowLess
                    : format(s.hardware.driversShowAll, {
                        count: String(audit.entries.length - NOTEWORTHY),
                      })}
                </button>
              )}
            </div>
          ) : (
            <p className="mt-4 text-[12.5px] text-ink-3">{s.hardware.driversNone}</p>
          )}

          {/* This is a labeled sub-section on purpose, not a plain button:
              it is a genuinely different, narrower thing than the driver
              list above. That list reads installed-driver age from this PC;
              this queries Microsoft's own catalogue, which many vendors -
              onboard audio and chipset drivers especially - never publish
              to at all. The label exists so nobody reads this as "checked
              your Realtek/AMD/NVIDIA drivers specifically and they're fine". */}
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
              {s.hardware.winUpdateLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setSearching(true);
                  setOutcome(null);
                  invoke<UpdateSearchResult>("search_driver_updates")
                    .then((r) => {
                      setUpdates(r);
                      setSelectedTitles(new Set(r.updates.map((u) => u.title)));
                    })
                    .catch((e: unknown) => pushToast("error", String(e)))
                    .finally(() => setSearching(false));
                }}
                disabled={searching || installing}
                /* While searching the button stays lit and shows a spinner
                   instead of fading to 60% opacity. A Windows Update catalogue
                   query routinely takes 30-90 seconds, and a dimmed control
                   with no motion for that long is indistinguishable from a
                   button that did nothing when clicked — which is exactly how
                   it was being read. */
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[12.5px] font-semibold transition-colors disabled:cursor-wait ${
                  searching
                    ? "border-accent/50 text-ink"
                    : "border-line-2 text-ink-2 hover:border-accent/40 hover:text-ink disabled:opacity-60"
                }`}
              >
                {searching && (
                  <span className="border-accent inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
                )}
                {searching ? s.hardware.winUpdateSearching : s.hardware.winUpdateButton}
              </button>
              {/* Sets the expectation up front: the query is slow because it
                  is a real catalogue round trip, not because it has stalled. */}
              {searching && (
                <span className="text-[11.5px] text-ink-3">{s.hardware.winUpdateTakesAWhile}</span>
              )}

              {/* Download and install only appear once there is something to
                  install, so the button never promises work that isn't there. */}
              {updates !== null && updates.updates.length > 0 && (
                <button
                  onClick={() => {
                    setInstalling(true);
                    invoke<InstallOutcome>("install_driver_updates", {
                      titles: Array.from(selectedTitles),
                    })
                      .then((r) => {
                        setOutcome(r);
                        setUpdates(null);
                        setSelectedTitles(new Set());
                        if (r.reboot_required) setRebootNeeded(true);
                      })
                      .catch((e: unknown) => pushToast("error", String(e)))
                      .finally(() => setInstalling(false));
                  }}
                  disabled={installing || selectedTitles.size === 0}
                  className="rounded-xl bg-accent px-4 py-2 text-[12.5px] font-bold text-on-accent transition hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                >
                  {installing
                    ? s.hardware.winUpdateInstalling
                    : format(s.hardware.winUpdateInstall, {
                        count: String(selectedTitles.size),
                      })}
                </button>
              )}

              {/* Only worth offering a bulk toggle once there is more than
                  one row to toggle - with a single update, the row's own
                  checkbox already is the bulk control. */}
              {updates !== null && updates.updates.length > 1 && (
                <button
                  onClick={() => {
                    setSelectedTitles((prev) =>
                      prev.size === updates.updates.length
                        ? new Set()
                        : new Set(updates.updates.map((u) => u.title)),
                    );
                  }}
                  className="text-[12px] font-semibold text-accent transition-opacity hover:opacity-80"
                >
                  {selectedTitles.size === updates.updates.length
                    ? s.scan.deselectAll
                    : s.scan.selectAll}
                </button>
              )}
            </div>

            {updates !== null && updates.error !== null && (
              <p className="mt-2 text-[11.5px] text-amber-300">
                {format(s.hardware.winUpdateFailed, { detail: updates.error })}
              </p>
            )}

            {/* Not emerald: "nothing pending" isn't good news the way a
                clean scan is - it's just what Windows Update happened to
                have, which can be nothing even for a driver years old. */}
            {updates !== null && updates.error === null && updates.updates.length === 0 && (
              <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
                {s.hardware.winUpdateNone}
              </p>
            )}

            {updates !== null && updates.updates.length > 0 && (
              <ul className="mt-2 space-y-1">
                {updates.updates.map((u: DriverUpdate) => {
                  const checked = selectedTitles.has(u.title);
                  return (
                    <li key={u.title}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-0.5 text-[12px] text-ink-2 hover:bg-surface-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedTitles((prev) => {
                              const next = new Set(prev);
                              if (checked) next.delete(u.title);
                              else next.add(u.title);
                              return next;
                            });
                          }}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                        />
                        <span>
                          {u.title}
                          {u.size_mb !== null && (
                            <span className="type-data text-ink-3"> ({String(u.size_mb)} MB)</span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            {outcome !== null && (
              <p className="mt-2 text-[12px] text-ink-2">
                {format(s.hardware.winUpdateDone, {
                  installed: String(outcome.installed),
                  failed: String(outcome.failed),
                })}
              </p>
            )}

            <p className="mt-2 max-w-2xl text-[11.5px] leading-relaxed text-ink-3">
              {s.hardware.winUpdateNote}
            </p>
          </div>

          {/* What was left out, what this cannot know, and when it was read:
              all three are part of the reading, not footnotes to it. */}
          <div className="mt-4 space-y-1.5 border-t border-line pt-3">
            <p className="text-[11.5px] leading-relaxed text-ink-3">
              {format(s.hardware.driversInboxNote, { count: String(audit.excluded_inbox) })}
            </p>
            <p className="text-[11.5px] leading-relaxed text-ink-3">
              {s.hardware.driversNoUpdateCheck}
            </p>
            {checkedAt && (
              <p className="type-data text-[11px] tabular-nums text-ink-3">
                {format(s.hardware.driversCheckedAt, { time: checkedAt.toLocaleString() })}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Section
 * ------------------------------------------------------------------ */

export function HardwarePanel({
  s,
  isPro,
  onRequirePro,
  pushToast,
}: {
  s: Strings;
  isPro: boolean;
  onRequirePro: () => void;
  pushToast: (kind: "success" | "error", message: string) => void;
}) {
  // This is the heaviest screen in the app: two panels that each fire their
  // own IPC reads and lay out a gauge, a trace and a driver table the moment
  // they mount. Doing all of that in the same commit as the tab switch is
  // what made Hardware feel a beat slower to open than every other section —
  // the click had to wait for the whole subtree before anything appeared.
  //
  // Mounting the children on the next frame lets the click paint first: the
  // sidebar highlight, the heading and the intro land immediately, and the
  // instruments arrive one frame later, which reads as instant.
  const [instrumentsReady, setInstrumentsReady] = useState(false);

  useEffect(() => {
    let frame = 0;
    // Two frames, not one: the first is the commit that paints the heading,
    // the second is when the browser is genuinely free again.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setInstrumentsReady(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="animate-card">
      <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-ink-3">{s.hardware.intro}</p>
      {instrumentsReady ? (
        <>
          <ThermalsPanel s={s} pushToast={pushToast} />
          <DriversPanel s={s} pushToast={pushToast} />
          {/* Sits under the audit it reads from: the audit answers "how old
              are my drivers", this answers "open the pages for the old ones". */}
          <DriverBoosterCard
            s={s}
            isPro={isPro}
            onRequirePro={onRequirePro}
            pushToast={pushToast}
          />
        </>
      ) : (
        // A placeholder of roughly the right height, so the panels do not
        // arrive by shoving the page down.
        <div className="skeleton h-64 w-full" aria-hidden="true" />
      )}
    </div>
  );
}
