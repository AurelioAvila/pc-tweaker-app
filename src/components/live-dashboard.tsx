// "Right now" on PC Health: live charts for CPU, memory, disk, network and,
// where the PC exposes them, graphics and temperature sensors, what is using
// the machine, and a plain word on anything that needs attention.
//
// The page promises that nothing runs in the background, so sampling is
// strictly tied to being looked at: one shared one-second timer, started only
// while this block is mounted, the document is visible and the window is in
// front, and stopped the moment any of those stops being true. Every reading
// is a system-wide counter or the handle-free process table (livemetrics.rs,
// process_guard.rs); no process is opened and nothing is written to disk.
import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, type Lang, type Strings } from "../i18n";
import type { Section, SystemStats, ThermalReport } from "../types";
import {
  formatGB,
  formatRate,
  hasSensors,
  HISTORY,
  insights,
  memorySplit,
  niceCeiling,
  peakOf,
  push,
  sparkPoints,
  verdict,
  WINDOW_SHORT,
  type LiveSample,
} from "../live-metrics";
import { Badge, type BadgeKind } from "./ui";
import "./live-dashboard.css";

/** Sensors need an outside tool (nvidia-smi, or PowerShell for the CPU zone),
 *  so they are read far less often than load: the full report once, then the
 *  graphics card alone every few seconds and the CPU zone once a minute. */
const GPU_EVERY = 10;
const CPU_TEMP_EVERY = 60;
const DRIVE_EVERY = 15;
/** The process table is read every other second: plenty for a top five. */
const USERS_EVERY = 2;

export type ResourceUser = { name: string; processes: number; cpu: number; memory: number };
export type ResourceUsers = { cpu: ResourceUser[]; memory: ResourceUser[] };

export function useForeground(): boolean {
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

export function useReducedMotion(): boolean {
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
export function Num({
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

export type Series = { values: (number | null)[]; tone: "accent" | "second"; label: string };

/** An area chart that slides one step left per reading. Hover shows the value
 *  under the pointer and how long ago it was read. With `axis`, it draws a
 *  thin grid with labels; with `peak`, it marks the first series' highest
 *  point in view. */
export function Spark({
  series,
  max,
  height = 64,
  tick,
  reduced,
  formatValue,
  s,
  slots = WINDOW_SHORT,
  axis,
  peak = false,
}: {
  series: Series[];
  max: number;
  height?: number;
  tick: number;
  reduced: boolean;
  formatValue: (v: number | null) => string;
  s: Strings;
  slots?: number;
  axis?: number[];
  peak?: boolean;
}) {
  const width = 600;
  const [hover, setHover] = useState<number | null>(null);
  const id = `spark${useId().replace(/:/g, "")}`;
  const shown = series.map((x) => ({ ...x, values: x.values.slice(-slots) }));
  const length = Math.max(0, ...shown.map((x) => x.values.length));
  const x = (index: number) => ((slots - length + index) / (slots - 1)) * 100;
  const top = peak ? peakOf(shown[0]?.values ?? []) : null;
  return (
    <div
      className="live-spark"
      data-axis={!!axis}
      style={{ height }}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const slot = Math.round(((e.clientX - box.left) / box.width) * (slots - 1));
        const index = slot - (slots - length);
        setHover(index >= 0 && index < length ? index : null);
      }}
    >
      {axis?.map((value) => (
        <span
          key={value}
          className="live-grid-line"
          style={{ bottom: `${(value / max) * 100}%` }}
          aria-hidden="true"
        >
          <small>{formatValue(value)}</small>
        </span>
      ))}
      <div className="live-clip">
        <div
          key={tick}
          className={reduced ? "live-track" : "live-track live-slide"}
          style={{ "--live-step": `${100 / (slots - 1)}%` } as React.CSSProperties}
        >
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              {shown.map((x) => (
                <linearGradient key={x.tone} id={`${id}-${x.tone}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" className={`live-stop-${x.tone}`} stopOpacity="0.35" />
                  <stop offset="100%" className={`live-stop-${x.tone}`} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {shown.map((x) => {
              const points = sparkPoints(x.values, max, width, height, slots);
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
          {top && top.value > 0 && (
            <span
              className="live-peak"
              style={{ left: `${x(top.index)}%`, bottom: `${Math.min(1, top.value / max) * 100}%` }}
            >
              <small>{format(s.live.peak, { value: formatValue(top.value) })}</small>
            </span>
          )}
        </div>
      </div>
      {hover !== null && (
        <span className="live-cursor" style={{ left: `${x(hover)}%` }} aria-hidden="true" />
      )}
      {hover !== null && (
        <div className="live-tooltip" style={{ left: `${x(hover)}%` }} role="tooltip">
          {shown.map((x) => (
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
  index,
  children,
}: {
  title: string;
  value?: React.ReactNode;
  extra?: React.ReactNode;
  wide?: boolean;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <section className="live-card" data-wide={wide} style={{ "--i": index } as React.CSSProperties}>
      <header>
        <h3>{title}</h3>
        {extra}
      </header>
      {value !== undefined && <div className="live-value">{value}</div>}
      {children}
    </section>
  );
}

export function UsersList({
  users,
  value,
  s,
}: {
  users: ResourceUser[];
  value: (u: ResourceUser) => { text: string; ratio: number };
  s: Strings;
}) {
  if (!users.length) return <p className="live-muted">{s.live.measuring}</p>;
  return (
    <ol className="live-users">
      {users.map((u) => {
        const v = value(u);
        return (
          <li key={u.name}>
            <span className="live-user-name">
              <strong>{u.name}</strong>
              <small>
                {u.processes === 1
                  ? s.live.processOne
                  : format(s.live.processes, { count: u.processes })}
              </small>
            </span>
            <span className="live-user-value">{v.text}</span>
            <span className="live-user-bar" aria-hidden="true">
              <span style={{ width: `${Math.max(2, Math.min(100, v.ratio * 100))}%` }} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function LiveDashboard({
  s,
  lang,
  onNavigate,
}: {
  s: Strings;
  lang: Lang;
  onNavigate?: (section: Section) => void;
}) {
  const foreground = useForeground();
  const reduced = useReducedMotion();
  const l = s.live;
  const [latest, setLatest] = useState<LiveSample | null>(null);
  const [cpu, setCpu] = useState<number[]>([]);
  const [ram, setRam] = useState<(number | null)[]>([]);
  const [cores, setCores] = useState<number[][]>([]);
  const [disk, setDisk] = useState<{ read: (number | null)[]; write: (number | null)[] }>({
    read: [],
    write: [],
  });
  const [net, setNet] = useState<{ down: (number | null)[]; up: (number | null)[] }>({
    down: [],
    up: [],
  });
  const [users, setUsers] = useState<ResourceUsers | null>(null);
  const [drive, setDrive] = useState<{ used: number; total: number } | null>(null);
  const [sensors, setSensors] = useState<ThermalReport | null | "none">(null);
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState(false);
  const [slots, setSlots] = useState(WINDOW_SHORT);
  /** What the first full report found; null until it has answered. */
  const sensorsSeen = useRef<{ cpu: boolean; gpu: boolean } | null>(null);
  /** When each slow source was last read, so coming back to the window does
   *  not start PowerShell or nvidia-smi again straight away. */
  const lastRead = useRef({ cpuTemp: 0, gpu: 0, sample: 0 });

  useEffect(() => {
    if (!foreground) return;
    let count = 0;
    let busy = false;
    let cancelled = false;
    const sample = async () => {
      if (busy) return;
      busy = true;
      try {
        const next = await invoke<LiveSample>("live_sample");
        if (cancelled) return;
        // After a pause the charts start again rather than joining two
        // moments with a line that suggests nothing happened in between.
        const gap = lastRead.current.sample > 0 && Date.now() - lastRead.current.sample > 5000;
        lastRead.current.sample = Date.now();
        const from = <T,>(v: T[]) => (gap ? [] : v);
        setFailed(false);
        setLatest(next);
        setCpu((v) => push(from(v), next.cpu));
        setRam((v) =>
          push(from(v), next.ram_total ? (next.ram_used / next.ram_total) * 100 : null),
        );
        setCores((v) => next.cores.map((c, i) => push(from(v)[i] ?? [], c, 30)));
        setDisk((v) => ({
          read: push(from(v.read), next.disk_read_bps),
          write: push(from(v.write), next.disk_write_bps),
        }));
        setNet((v) => ({
          down: push(from(v.down), next.net_down_bps),
          up: push(from(v.up), next.net_up_bps),
        }));
        setTick((t) => t + 1);
        if (count % USERS_EVERY === 0) {
          void invoke<ResourceUsers>("resource_users")
            .then(setUsers)
            .catch(() => undefined);
        }
        if (count % DRIVE_EVERY === 0) {
          void invoke<SystemStats>("system_stats")
            .then(
              (st) => st.disk_total > 0 && setDrive({ used: st.disk_used, total: st.disk_total }),
            )
            .catch(() => undefined);
        }
        const seen = sensorsSeen.current;
        const now = Date.now();
        if (
          (!seen && count === 0) ||
          (seen?.cpu && now - lastRead.current.cpuTemp >= CPU_TEMP_EVERY * 1000)
        ) {
          lastRead.current.cpuTemp = now;
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
        } else if (seen?.gpu && now - lastRead.current.gpu >= GPU_EVERY * 1000) {
          lastRead.current.gpu = now;
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
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [foreground]);

  const ramPct = latest && latest.ram_total ? (latest.ram_used / latest.ram_total) * 100 : null;
  const drivePct = drive ? (drive.used / drive.total) * 100 : null;
  const judged = verdict(cpu, ramPct);
  const notes = insights({ cpu, memoryPct: ramPct, drivePct });
  const split = latest ? memorySplit(latest) : null;
  const diskMax = niceCeiling([...disk.read, ...disk.write].slice(-slots * 2), 1_000_000);
  const netMax = niceCeiling([...net.down, ...net.up].slice(-slots * 2), 200_000);
  const rate = (v: number | null) => formatRate(v, lang) ?? l.measuring;
  const pct = (v: number | null) => (v === null ? l.measuring : `${Math.round(v)}%`);
  const peakRate = (values: (number | null)[]) =>
    formatRate(peakOf(values.slice(-slots))?.value ?? null, lang);
  const gpu = sensors && sensors !== "none" ? sensors.gpus[0] : undefined;
  const cpuTemp = sensors && sensors !== "none" ? sensors.cpu_temp_c : null;
  const loading = latest === null;
  const totalCpu = Math.max(1, ...(users?.cpu.map((u) => u.cpu) ?? [0]));
  const totalMemory = latest?.ram_total ?? 1;
  const minutes = slots / 60;
  const diskPeak = peakRate([...disk.read, ...disk.write]);
  const netPeak = peakRate([...net.down, ...net.up]);

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
  const noteText = (id: (typeof notes)[number]["id"], value?: number) =>
    id === "memory"
      ? format(l.insightMemory, { pct: value ?? 0 })
      : id === "cpu"
        ? format(l.insightCpu, { pct: value ?? 0 })
        : id === "drive"
          ? format(l.insightDrive, { pct: value ?? 0 })
          : l.insightCalm;
  const noteKind: Record<(typeof notes)[number]["tone"], BadgeKind> = {
    ok: "ok",
    warn: "warn",
    danger: "danger",
  };

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

      {!loading && (
        <ul className="live-notes" aria-live="polite">
          {notes.map((note) => (
            <li key={note.id} data-tone={note.tone}>
              <Badge kind={noteKind[note.tone]}>{note.tone === "ok" ? "✓" : "!"}</Badge>
              <span>{noteText(note.id, note.pct)}</span>
              {note.id === "memory" && onNavigate && (
                <button
                  type="button"
                  className="tool-secondary-action"
                  onClick={() => onNavigate("startup")}
                >
                  {l.actionStartup}
                </button>
              )}
              {note.id === "drive" && onNavigate && (
                <button
                  type="button"
                  className="tool-secondary-action"
                  onClick={() => onNavigate("maintenance")}
                >
                  {l.actionCleanup}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="live-grid" data-loading={loading}>
        <Card
          index={0}
          wide
          title={l.activity}
          extra={
            <div className="live-zoom" role="group" aria-label={l.activity}>
              {[WINDOW_SHORT, HISTORY].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={slots === n}
                  onClick={() => setSlots(n)}
                >
                  {n === WINDOW_SHORT ? l.zoomShort : l.zoomLong}
                </button>
              ))}
            </div>
          }
          value={
            <span className="live-pair">
              <span data-tone="accent">
                {l.cpu}{" "}
                <strong>
                  <Num value={latest ? latest.cpu : null} reduced={reduced} suffix="%" />
                </strong>
              </span>
              <span data-tone="second">
                {l.memory}{" "}
                <strong>
                  <Num value={ramPct} reduced={reduced} suffix="%" />
                </strong>
              </span>
            </span>
          }
        >
          <Spark
            series={[
              { values: cpu, tone: "accent", label: l.cpu },
              { values: ram, tone: "second", label: l.memory },
            ]}
            max={100}
            height={170}
            tick={tick}
            reduced={reduced}
            formatValue={pct}
            s={s}
            slots={slots}
            axis={[25, 50, 75, 100]}
            peak
          />
          <div className="live-axis-x" aria-hidden="true">
            <span>{format(l.minutesAgo, { n: minutes })}</span>
            <span>{l.now}</span>
          </div>
        </Card>

        <Card index={1} title={l.memory}>
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
          index={2}
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
                          d={`${points.map(([px, py], j) => `${j ? "L" : "M"}${px},${py}`).join(" ")} L60,18 L${points[0][0]},18 Z`}
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

        <Card index={3} title={l.usingTitle} wide>
          <p className="live-muted">{l.usingHint}</p>
          <div className="live-users-grid">
            <div>
              <h4>{l.usingCpu}</h4>
              <UsersList
                users={users?.cpu ?? []}
                value={(u) => ({ text: `${u.cpu.toFixed(1)}%`, ratio: u.cpu / totalCpu })}
                s={s}
              />
            </div>
            <div>
              <h4>{l.usingMemory}</h4>
              <UsersList
                users={users?.memory ?? []}
                value={(u) => ({ text: formatGB(u.memory, lang), ratio: u.memory / totalMemory })}
                s={s}
              />
            </div>
          </div>
        </Card>

        <Card
          index={4}
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
          extra={
            diskPeak && <span className="live-meta">{format(l.peak, { value: diskPeak })}</span>
          }
        >
          <Spark
            series={[
              { values: disk.read, tone: "accent", label: l.read },
              { values: disk.write, tone: "second", label: l.write },
            ]}
            max={diskMax}
            height={72}
            tick={tick}
            reduced={reduced}
            formatValue={rate}
            s={s}
            slots={slots}
          />
          {drive && (
            <div className="live-bar">
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
          index={5}
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
          extra={netPeak && <span className="live-meta">{format(l.peak, { value: netPeak })}</span>}
        >
          <Spark
            series={[
              { values: net.down, tone: "accent", label: l.down },
              { values: net.up, tone: "second", label: l.up },
            ]}
            max={netMax}
            height={72}
            tick={tick}
            reduced={reduced}
            formatValue={rate}
            s={s}
            slots={slots}
          />
        </Card>

        {gpu ? (
          <Card
            index={6}
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
            <Card index={6} title={l.sensors}>
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
