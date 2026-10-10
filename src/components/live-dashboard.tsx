// "Right now" on PC Health: live charts for CPU, memory, disk, network and,
// where the PC exposes them, graphics and temperature sensors.
//
// The page promises that nothing runs in the background, so sampling is
// strictly tied to being looked at: one shared one-second timer, started only
// while this block is mounted, the document is visible and the window is in
// front, and stopped the moment any of those stops being true. Every reading
// is a system-wide counter (livemetrics.rs); no process is opened or listed
// and nothing is written to disk.
import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, type Lang, type Strings } from "../i18n";
import type { SystemStats, ThermalReport } from "../types";
import {
  formatGB,
  formatRate,
  hasSensors,
  HISTORY,
  memorySplit,
  niceCeiling,
  push,
  sparkPoints,
  verdict,
  type LiveSample,
} from "../live-metrics";
import { Badge } from "./ui";
import "./live-dashboard.css";

/** Sensors need an outside tool (nvidia-smi, or PowerShell for the CPU zone),
 *  so they are read far less often than load: the full report once, then the
 *  graphics card alone every few seconds and the CPU zone once a minute. */
const GPU_EVERY = 10;
const CPU_TEMP_EVERY = 60;
const DRIVE_EVERY = 15;

function useForeground(): boolean {
  const read = () => document.visibilityState === "visible" && document.hasFocus();
  const [on, setOn] = useState(read);
  useEffect(() => {
    const update = () => setOn(read());
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);
  return on;
}

function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const update = () => setReduced(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** A number that eases to each new reading over most of a second. It writes
 *  its own text node frame by frame, so the rest of the dashboard renders
 *  once per reading, not sixty times. */
function Num({
  value,
  reduced,
  suffix = "",
}: {
  value: number | null;
  reduced: boolean;
  suffix?: string;
}) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const paint = (v: number | null) => {
      shown.current = v;
      el.textContent = v === null ? "–" : `${Math.round(v)}${suffix}`;
    };
    const start = shown.current;
    if (value === null || start === null || reduced) {
      paint(value);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 700);
      paint(start + (value - start) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced, suffix]);
  return <span ref={node}>–</span>;
}

type Series = { values: (number | null)[]; tone: "accent" | "second"; label: string };

/** An area chart that slides one step left per reading. Hover shows the value
 *  under the pointer and how long ago it was read. */
function Spark({
  series,
  max,
  height = 64,
  tick,
  reduced,
  formatValue,
  s,
}: {
  series: Series[];
  max: number;
  height?: number;
  tick: number;
  reduced: boolean;
  formatValue: (v: number | null) => string;
  s: Strings;
}) {
  const width = 300;
  const [hover, setHover] = useState<number | null>(null);
  const id = `spark${useId().replace(/:/g, "")}`;
  const length = Math.max(...series.map((x) => x.values.length));
  return (
    <div
      className="live-spark"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const slot = Math.round(((e.clientX - box.left) / box.width) * (HISTORY - 1));
        const index = slot - (HISTORY - length);
        setHover(index >= 0 && index < length ? index : null);
      }}
    >
      <div
        key={tick}
        className={reduced ? "live-track" : "live-track live-slide"}
        style={{ "--live-step": `${100 / (HISTORY - 1)}%` } as React.CSSProperties}
      >
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            {series.map((x) => (
              <linearGradient key={x.tone} id={`${id}-${x.tone}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className={`live-stop-${x.tone}`} stopOpacity="0.35" />
                <stop offset="100%" className={`live-stop-${x.tone}`} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {series.map((x) => {
            const points = sparkPoints(x.values, max, width, height);
            if (points.length < 2) return null;
            const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
            const area = `${line} L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z`;
            return (
              <g key={x.tone} className={`live-series live-series-${x.tone}`}>
                <path d={area} fill={`url(#${id}-${x.tone})`} />
                <path d={line} className="live-line" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
      </div>
      {hover !== null && (
        <span
          className="live-cursor"
          style={{ left: `${((HISTORY - length + hover) / (HISTORY - 1)) * 100}%` }}
          aria-hidden="true"
        />
      )}
      {hover !== null && (
        <div
          className="live-tooltip"
          style={{ left: `${((HISTORY - length + hover) / (HISTORY - 1)) * 100}%` }}
          role="tooltip"
        >
          {series.map((x) => (
            <span key={x.tone} data-tone={x.tone}>
              {x.label} <strong>{formatValue(x.values[hover] ?? null)}</strong>
            </span>
          ))}
          <small>
            {length - 1 - hover === 0
              ? s.live.now
              : format(s.live.secondsAgo, { s: length - 1 - hover })}
          </small>
        </div>
      )}
    </div>
  );
}

function Ring({
  split,
  label,
  sub,
}: {
  split: ReturnType<typeof memorySplit>;
  label: React.ReactNode;
  sub: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const used = split ? split.used * c : 0;
  const cached = split ? split.cached * c : 0;
  return (
    <div className="live-ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="live-ring-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="live-ring-cached"
          strokeDasharray={`${cached} ${c}`}
          strokeDashoffset={-used}
        />
        <circle cx="50" cy="50" r={r} className="live-ring-used" strokeDasharray={`${used} ${c}`} />
      </svg>
      <div className="live-ring-center">
        <strong>{label}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  extra,
  wide = false,
  children,
}: {
  title: string;
  wide?: boolean;
  value?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="live-card" data-wide={wide}>
      <header>
        <h3>{title}</h3>
        {extra}
      </header>
      {value !== undefined && <div className="live-value">{value}</div>}
      {children}
    </section>
  );
}

export function LiveDashboard({ s, lang }: { s: Strings; lang: Lang }) {
  const foreground = useForeground();
  const reduced = useReducedMotion();
  const l = s.live;
  const [latest, setLatest] = useState<LiveSample | null>(null);
  const [cpu, setCpu] = useState<number[]>([]);
  const [cores, setCores] = useState<number[][]>([]);
  const [disk, setDisk] = useState<{ read: (number | null)[]; write: (number | null)[] }>({
    read: [],
    write: [],
  });
  const [net, setNet] = useState<{ down: (number | null)[]; up: (number | null)[] }>({
    down: [],
    up: [],
  });
  const [drive, setDrive] = useState<{ used: number; total: number } | null>(null);
  const [sensors, setSensors] = useState<ThermalReport | null | "none">(null);
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState(false);
  /** What the first full report found; null until it has answered. */
  const sensorsSeen = useRef<{ cpu: boolean; gpu: boolean } | null>(null);

  useEffect(() => {
    if (!foreground) return;
    let count = 0;
    let busy = false;
    const sample = async () => {
      if (busy) return;
      busy = true;
      try {
        const next = await invoke<LiveSample>("live_sample");
        setFailed(false);
        setLatest(next);
        setCpu((v) => push(v, next.cpu));
        setCores((v) => next.cores.map((c, i) => push(v[i] ?? [], c, 30)));
        setDisk((v) => ({
          read: push(v.read, next.disk_read_bps),
          write: push(v.write, next.disk_write_bps),
        }));
        setNet((v) => ({ down: push(v.down, next.net_down_bps), up: push(v.up, next.net_up_bps) }));
        setTick((t) => t + 1);
        if (count % DRIVE_EVERY === 0) {
          void invoke<SystemStats>("system_stats")
            .then(
              (st) => st.disk_total > 0 && setDrive({ used: st.disk_used, total: st.disk_total }),
            )
            .catch(() => undefined);
        }
        const seen = sensorsSeen.current;
        if ((count === 0 && !seen) || (seen?.cpu && count % CPU_TEMP_EVERY === 0)) {
          void invoke<ThermalReport>("thermal_report")
            .then((report) => {
              sensorsSeen.current ??= {
                cpu: report.cpu_temp_c !== null,
                gpu: report.gpus.length > 0,
              };
              setSensors(hasSensors(report) ? report : "none");
            })
            .catch(() => {
              sensorsSeen.current ??= { cpu: false, gpu: false };
              setSensors("none");
            });
        } else if (seen?.gpu && count % GPU_EVERY === 0) {
          void invoke<ThermalReport["gpus"]>("gpu_readings")
            .then((gpus) =>
              setSensors((current) =>
                current && current !== "none" ? { ...current, gpus } : current,
              ),
            )
            .catch(() => undefined);
        }
        count++;
      } catch {
        setFailed(true);
      } finally {
        busy = false;
      }
    };
    void sample();
    const timer = window.setInterval(() => void sample(), 1000);
    return () => window.clearInterval(timer);
  }, [foreground]);

  const ramPct = latest && latest.ram_total ? (latest.ram_used / latest.ram_total) * 100 : null;
  const judged = verdict(cpu, ramPct);
  const split = latest ? memorySplit(latest) : null;
  const diskMax = niceCeiling([...disk.read, ...disk.write], 1_000_000);
  const netMax = niceCeiling([...net.down, ...net.up], 200_000);
  const rate = (v: number | null) => formatRate(v, lang) ?? l.measuring;
  const pct = (v: number | null) => (v === null ? l.measuring : `${Math.round(v)}%`);
  const gpu = sensors && sensors !== "none" ? sensors.gpus[0] : undefined;
  const cpuTemp = sensors && sensors !== "none" ? sensors.cpu_temp_c : null;
  const loading = latest === null;

  const verdictBadge = !foreground ? (
    <Badge kind="muted">{l.paused}</Badge>
  ) : judged ? (
    <Badge
      kind={judged.verdict === "smooth" ? "ok" : judged.verdict === "busy" ? "warn" : "danger"}
    >
      {l[judged.verdict]}
    </Badge>
  ) : (
    <Badge kind="muted">{l.measuring}</Badge>
  );

  return (
    <section className="tool-panel live-dashboard" aria-label={l.title}>
      <header className="live-head">
        <div>
          <h2>
            <span className="live-dot" data-on={foreground} aria-hidden="true" />
            {l.title}
          </h2>
          <p>
            {!foreground
              ? l.pausedHint
              : judged && ramPct !== null
                ? format(l.verdictDetail, { cpu: judged.cpu, ram: Math.round(ramPct) })
                : l.subtitle}
          </p>
        </div>
        {verdictBadge}
      </header>
      {failed && <p className="live-error">{l.failed}</p>}

      <div className="live-grid" data-loading={loading}>
        <Card
          wide
          title={l.cpu}
          value={
            <>
              <strong>
                <Num value={latest ? latest.cpu : null} reduced={reduced} />
              </strong>
              <small>%</small>
            </>
          }
          extra={
            <span className="live-meta">
              {latest?.cpu_mhz
                ? format(l.speed, { ghz: (latest.cpu_mhz / 1000).toFixed(2) })
                : null}
              {cpuTemp !== null && cpuTemp !== undefined && <span>{Math.round(cpuTemp)} °C</span>}
            </span>
          }
        >
          <Spark
            series={[{ values: cpu, tone: "accent", label: l.cpu }]}
            max={100}
            tick={tick}
            reduced={reduced}
            formatValue={pct}
            s={s}
          />
          {cores.length > 0 && (
            <div className="live-cores" aria-label={format(l.cores, { count: cores.length })}>
              {cores.map((values, i) => {
                const now = values[values.length - 1] ?? 0;
                const points = sparkPoints(values, 100, 60, 18, 30);
                return (
                  <div
                    key={i}
                    className="live-core"
                    title={`${format(l.core, { n: i + 1 })}: ${Math.round(now)}%`}
                  >
                    <svg viewBox="0 0 60 18" preserveAspectRatio="none" aria-hidden="true">
                      {points.length > 1 && (
                        <path
                          d={`${points.map(([x, y], j) => `${j ? "L" : "M"}${x},${y}`).join(" ")} L60,18 L${points[0][0]},18 Z`}
                        />
                      )}
                    </svg>
                    <span>{Math.round(now)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title={l.memory}>
          <div className="live-memory">
            <Ring
              split={split}
              label={<Num value={ramPct} reduced={reduced} suffix="%" />}
              sub={l.used}
            />
            <dl>
              <div data-tone="used">
                <dt>{l.used}</dt>
                <dd>{latest ? formatGB(latest.ram_used, lang) : "–"}</dd>
              </div>
              <div data-tone="cached" title={l.cachedHint}>
                <dt>{l.cached}</dt>
                <dd>
                  {latest?.ram_cached != null ? formatGB(latest.ram_cached, lang) : l.notAvailable}
                </dd>
              </div>
              <div data-tone="free">
                <dt>{l.free}</dt>
                <dd>{latest && split ? formatGB(split.free * latest.ram_total, lang) : "–"}</dd>
              </div>
              <div>
                <dt>{l.total}</dt>
                <dd>{latest ? formatGB(latest.ram_total, lang) : "–"}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card
          title={l.disk}
          value={
            <span className="live-pair">
              <span data-tone="accent">
                {l.read} <strong>{rate(latest?.disk_read_bps ?? null)}</strong>
              </span>
              <span data-tone="second">
                {l.write} <strong>{rate(latest?.disk_write_bps ?? null)}</strong>
              </span>
            </span>
          }
        >
          <Spark
            series={[
              { values: disk.read, tone: "accent", label: l.read },
              { values: disk.write, tone: "second", label: l.write },
            ]}
            max={diskMax}
            tick={tick}
            reduced={reduced}
            formatValue={rate}
            s={s}
          />
          {drive && (
            <div
              className="live-bar"
              title={format(l.systemDrive, {
                used: formatGB(drive.used, lang),
                total: formatGB(drive.total, lang),
              })}
            >
              <span style={{ width: `${(drive.used / drive.total) * 100}%` }} />
              <small>
                {format(l.systemDrive, {
                  used: formatGB(drive.used, lang),
                  total: formatGB(drive.total, lang),
                })}
              </small>
            </div>
          )}
        </Card>

        <Card
          title={l.network}
          value={
            <span className="live-pair">
              <span data-tone="accent">
                {l.down} <strong>{rate(latest?.net_down_bps ?? null)}</strong>
              </span>
              <span data-tone="second">
                {l.up} <strong>{rate(latest?.net_up_bps ?? null)}</strong>
              </span>
            </span>
          }
        >
          <Spark
            series={[
              { values: net.down, tone: "accent", label: l.down },
              { values: net.up, tone: "second", label: l.up },
            ]}
            max={netMax}
            tick={tick}
            reduced={reduced}
            formatValue={rate}
            s={s}
          />
        </Card>

        {gpu ? (
          <Card
            title={l.gpu}
            value={
              <>
                <strong>
                  {gpu.utilization_pct === null ? "–" : Math.round(gpu.utilization_pct)}
                </strong>
                <small>%</small>
              </>
            }
            extra={<span className="live-meta">{gpu.name}</span>}
          >
            <div
              className="live-meter"
              role="meter"
              aria-label={l.gpuLoad}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(gpu.utilization_pct ?? 0)}
            >
              <span style={{ width: `${gpu.utilization_pct ?? 0}%` }} />
            </div>
            <dl className="live-facts">
              {gpu.temp_c !== null && (
                <div>
                  <dt>{l.temp}</dt>
                  <dd>{Math.round(gpu.temp_c)} °C</dd>
                </div>
              )}
              {gpu.fan_pct !== null && (
                <div>
                  <dt>{l.fan}</dt>
                  <dd>{Math.round(gpu.fan_pct)}%</dd>
                </div>
              )}
              {gpu.vram_used_mb !== null && gpu.vram_total_mb !== null && (
                <div>
                  <dt>{l.vram}</dt>
                  <dd>
                    {formatGB(gpu.vram_used_mb * 1024 * 1024, lang)} /{" "}
                    {formatGB(gpu.vram_total_mb * 1024 * 1024, lang)}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        ) : (
          sensors === "none" && (
            <Card title={l.sensors}>
              <div className="live-empty">
                <Badge kind="muted">{l.notAvailable}</Badge>
                <p>{l.sensorsHint}</p>
              </div>
            </Card>
          )
        )}
      </div>
    </section>
  );
}
