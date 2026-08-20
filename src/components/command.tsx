import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, Strings } from "../i18n";
import { formatBytes, RAM_AUTO_INTERVALS, ramIntervalLabel } from "../lib";
import { RamCleanResult, SystemStats, Toast, TweakInfo } from "../types";

/**
 * The Command Center: the app's home and its visual signature.
 *
 * Hierarchy answers three questions in one screen: is my PC fine (System
 * Pulse), what can I safely improve (scan findings), which mode suits me now
 * (Session Profiles). The Pulse is the identity piece — a live instrument
 * trace drawn from real system samples, not a decorative animation: the same
 * element that says "alive" becomes the activity indicator while a scan runs.
 *
 * Honesty rules baked in: the memory action is named for what it does (trim
 * working sets), explains its mechanism and cost, and is recommended only
 * under real pressure; profiles never apply without an explicit preview.
 */

export type PulseSample = {
  cpu: number;
  ramUsed: number;
  ramTotal: number;
};

const SAMPLE_EVERY_MS = 1200;
const MAX_SAMPLES = 48;

/** One shared sampling loop feeds both the Pulse trace and Memory Pressure —
 *  a single IPC poll, two instruments. */
export function usePulseSamples(): PulseSample[] {
  const [samples, setSamples] = useState<PulseSample[]>([]);
  useEffect(() => {
    let alive = true;
    const tick = () => {
      invoke<SystemStats>("system_stats")
        .then((v) => {
          if (!alive) return;
          setSamples((prev) => {
            const next = [
              ...prev,
              { cpu: v.cpu_usage, ramUsed: v.ram_used, ramTotal: v.ram_total },
            ];
            return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
          });
        })
        .catch(() => {
          // A missed sample just leaves a shorter trace.
        });
    };
    tick();
    const id = window.setInterval(tick, SAMPLE_EVERY_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  return samples;
}

/** Maps samples onto an SVG polyline. Pure, so the trace math is testable
 *  and deterministic for a given sample window. */
export function tracePoints(values: number[], width: number, height: number, max: number): string {
  if (values.length < 2) return "";
  const usable = Math.max(max, 1);
  const stepX = width / (MAX_SAMPLES - 1);
  const startX = width - stepX * (values.length - 1);
  return values
    .map((v, i) => {
      const x = startX + stepX * i;
      const y = height - Math.min(v / usable, 1) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/* ---- System Pulse (hero) -------------------------------------------------- */

export function SystemPulse({
  s,
  samples,
  scanPhase,
  findings,
  onRunScan,
  onReview,
}: {
  s: Strings;
  samples: PulseSample[];
  scanPhase: "idle" | "scanning" | "results" | "done";
  findings: number;
  onRunScan: () => void;
  onReview: () => void;
}) {
  const scanning = scanPhase === "scanning";
  const hasFindings = (scanPhase === "results" || scanPhase === "done") && findings > 0;
  const cpu = samples.length > 0 ? samples[samples.length - 1].cpu : 0;
  const points = tracePoints(
    samples.map((x) => x.cpu),
    600,
    56,
    100,
  );

  const status = scanning
    ? s.command.statusScanning
    : hasFindings
      ? format(s.command.statusFindings, { count: findings })
      : s.command.statusQuiet;

  return (
    <section className="border-line bg-surface-1 rounded-[12px] border p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              scanning ? "bg-accent animate-pulse" : hasFindings ? "bg-warn" : "bg-ok"
            }`}
          />
          <h2 className="type-section">{status}</h2>
        </div>
        <p className="type-data text-ink-3 text-[12px]">
          CPU {Math.round(cpu)}
          <span className="text-ink-3">%</span>
        </p>
      </div>

      {/* The trace: a real instrument reading (CPU), drawn as a hairline.
          While scanning it switches to an indeterminate accent sweep along
          the same track — the instrument goes to work, nothing bounces. */}
      <div className="border-line relative mt-4 h-14 overflow-hidden rounded-[8px] border">
        <svg
          viewBox="0 0 600 56"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <line x1="0" y1="28" x2="600" y2="28" stroke="var(--border-subtle)" strokeWidth="1" />
          {points && (
            <polyline
              points={points}
              fill="none"
              stroke={scanning ? "var(--accent)" : "var(--text-muted)"}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
        {scanning && (
          <div
            className="bg-accent-soft absolute inset-y-0 w-1/3 animate-[pulse-sweep_1.4s_var(--ease-standard)_infinite]"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="type-label">{s.command.domainsLine}</p>
          <p className="type-caption mt-1">{s.command.consent}</p>
        </div>
        {hasFindings ? (
          <button
            onClick={onReview}
            className="bg-accent text-on-accent rounded-[8px] px-4 py-2 text-[13px] font-semibold transition-opacity duration-150 hover:opacity-90"
          >
            {format(s.command.reviewFindings, { count: findings })}
          </button>
        ) : (
          <button
            onClick={onRunScan}
            disabled={scanning}
            className="bg-accent text-on-accent rounded-[8px] px-4 py-2 text-[13px] font-semibold transition-opacity duration-150 hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {s.command.runScan}
          </button>
        )}
      </div>
    </section>
  );
}

/* ---- Memory Pressure ------------------------------------------------------- */

type ProcessMemory = { name: string; mem_bytes: number };

function pressureOf(usedFrac: number): {
  label: (s: Strings) => string;
  tone: "ok" | "warn" | "danger";
} {
  if (usedFrac >= 0.8) return { label: (s) => s.command.pressureHigh, tone: "danger" };
  if (usedFrac >= 0.6) return { label: (s) => s.command.pressureElevated, tone: "warn" };
  return { label: (s) => s.command.pressureLow, tone: "ok" };
}

export function MemoryPressure({
  s,
  samples,
  autoMinutes,
  onChangeAuto,
  pushToast,
}: {
  s: Strings;
  samples: PulseSample[];
  autoMinutes: number;
  onChangeAuto: (minutes: number) => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState<ProcessMemory[] | null>(null);
  const [trimming, setTrimming] = useState(false);
  const last = samples.length > 0 ? samples[samples.length - 1] : null;
  const usedFrac = last && last.ramTotal > 0 ? last.ramUsed / last.ramTotal : 0;
  const pressure = pressureOf(usedFrac);
  const ramPoints = tracePoints(
    samples.map((x) => (x.ramTotal > 0 ? (x.ramUsed / x.ramTotal) * 100 : 0)),
    260,
    36,
    100,
  );

  useEffect(() => {
    if (!open) return;
    let alive = true;
    invoke<ProcessMemory[]>("top_memory_processes")
      .then((v) => {
        if (alive) setTop(v);
      })
      .catch(() => {
        if (alive) setTop([]);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  async function trim() {
    setTrimming(true);
    try {
      const result = await invoke<RamCleanResult>("clean_ram");
      pushToast(
        "success",
        result.freed_bytes > 0
          ? format(s.ram.freed, { amount: formatBytes(result.freed_bytes) })
          : s.ram.freedNothing,
      );
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setTrimming(false);
    }
  }

  return (
    <section className="border-line bg-surface-1 flex flex-col rounded-[12px] border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="type-label">{s.command.memTitle}</h2>
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              pressure.tone === "ok" ? "bg-ok" : pressure.tone === "warn" ? "bg-warn" : "bg-danger"
            }`}
          />
          <span
            className={
              pressure.tone === "ok"
                ? "text-ok"
                : pressure.tone === "warn"
                  ? "text-warn"
                  : "text-danger"
            }
          >
            {pressure.label(s)}
          </span>
        </span>
      </div>

      <p className="type-data mt-2 text-[22px] font-semibold leading-none">
        {last ? formatBytes(last.ramUsed) : "—"}
        <span className="text-ink-3 ml-1 text-[12px] font-normal">
          / {last ? formatBytes(last.ramTotal) : "—"}
        </span>
      </p>

      <svg
        viewBox="0 0 260 36"
        preserveAspectRatio="none"
        className="mt-3 h-9 w-full"
        aria-hidden="true"
      >
        <line x1="0" y1="18" x2="260" y2="18" stroke="var(--border-subtle)" strokeWidth="1" />
        {ramPoints && (
          <polyline
            points={ramPoints}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>

      <button
        onClick={() => setOpen((v) => !v)}
        className="border-line-2 text-ink-2 hover:text-ink mt-4 w-full rounded-[8px] border px-3 py-2 text-[12.5px] font-semibold transition-colors duration-150"
      >
        {s.command.memReview}
      </button>

      {open && (
        <div className="border-line mt-4 border-t pt-4">
          <p className="type-label mb-2">{s.command.memTopTitle}</p>
          {top === null ? (
            <div className="flex flex-col gap-1.5">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-4/5" />
              <div className="skeleton h-4 w-3/5" />
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {top.map((p) => (
                <li key={p.name} className="flex items-baseline justify-between gap-3">
                  <span className="text-ink-2 min-w-0 truncate text-[12.5px]">{p.name}</span>
                  <span className="type-data text-ink-3 shrink-0 text-[12px]">
                    {formatBytes(p.mem_bytes)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="border-line mt-4 border-t pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="type-card">{s.command.trimTitle}</p>
              {pressure.tone !== "ok" && (
                <span className="text-warn text-[11px] font-semibold">{pressure.label(s)}</span>
              )}
            </div>
            <p className="type-caption mt-1">{s.command.trimExplainer}</p>
            <button
              onClick={() => {
                void trim();
              }}
              disabled={trimming}
              className="border-line-2 text-ink hover:border-accent/40 mt-2.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150 disabled:cursor-wait disabled:opacity-60"
            >
              {trimming ? s.ram.cleaning : s.command.trimButton}
            </button>

            <p className="type-label mt-4 mb-1.5">{s.command.autoTitle}</p>
            <div className="flex flex-wrap gap-1.5">
              {RAM_AUTO_INTERVALS.map((m) => (
                <button
                  key={m}
                  onClick={() => onChangeAuto(m)}
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150 ${
                    autoMinutes === m ? "bg-accent-soft text-accent" : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {ramIntervalLabel(m, s)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---- Session Profiles ------------------------------------------------------ */

export function SessionProfiles({
  s,
  tweaks,
  isPro,
  onRequirePro,
  onToggleGame,
  gameBusy,
}: {
  s: Strings;
  tweaks: TweakInfo[];
  isPro: boolean;
  onRequirePro: () => void;
  onToggleGame: () => Promise<void>;
  gameBusy: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const game = tweaks.find((t) => t.id === "turbo_gaming");
  const active = game?.applied ?? false;

  const upcoming = [
    { name: s.command.profileFocus, desc: s.command.profileFocusDesc },
    { name: s.command.profileQuiet, desc: s.command.profileQuietDesc },
    { name: s.command.profileDownload, desc: s.command.profileDownloadDesc },
  ];

  return (
    <section className="border-line bg-surface-1 flex flex-col rounded-[12px] border p-5">
      <h2 className="type-label">{s.command.profilesTitle}</h2>

      <div className="signal border-line mt-3 rounded-[8px] border p-3 pl-4" data-active={active}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="type-card">{s.command.profileGame}</p>
            <p className="type-caption mt-0.5">{s.command.profileGameDesc}</p>
          </div>
          <span
            className={`shrink-0 text-[11px] font-semibold ${active ? "text-accent" : "text-ink-3"}`}
          >
            {active ? s.command.statusActive : s.command.statusOff}
          </span>
        </div>
        <button
          onClick={() => setPreview(true)}
          className="border-line-2 text-ink-2 hover:text-ink mt-2.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150"
        >
          {s.command.previewBtn}
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {upcoming.map((p) => (
          <li key={p.name} className="flex items-baseline justify-between gap-3 px-1">
            <span className="text-ink-3 text-[12.5px] font-medium">{p.name}</span>
            <span className="type-caption shrink-0">{s.command.soon}</span>
          </li>
        ))}
      </ul>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-6">
          <div className="border-line-2 bg-surface-2 w-full max-w-md rounded-[14px] border p-6">
            <h3 className="type-section">{s.command.profileGame}</h3>
            <p className="type-caption mt-1">{s.command.profileGameDesc}</p>

            <ul className="mt-4 flex flex-col gap-2">
              {[s.command.gameChange1, s.command.gameChange2, s.command.gameChange3].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="bg-accent mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full"
                  />
                  <span className="text-ink-2 text-[12.5px] leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>

            <div className="border-line mt-4 flex flex-col gap-1 border-t pt-3">
              <p className="type-caption">{s.command.previewReq}</p>
              <p className="type-caption">{s.command.previewCost}</p>
              <p className="type-caption text-ok">{s.command.previewRevert}</p>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setPreview(false)}
                className="text-ink-3 hover:text-ink rounded-[8px] px-3 py-2 text-[12.5px] font-semibold transition-colors duration-150"
              >
                {s.cleanupConfirm.cancel}
              </button>
              <button
                onClick={() => {
                  if (!isPro && game?.requires_pro) {
                    setPreview(false);
                    onRequirePro();
                    return;
                  }
                  setPreview(false);
                  void onToggleGame();
                }}
                disabled={gameBusy}
                className="bg-accent text-on-accent rounded-[8px] px-4 py-2 text-[12.5px] font-semibold transition-opacity duration-150 hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {active ? s.command.restoreSession : s.command.applySession}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
