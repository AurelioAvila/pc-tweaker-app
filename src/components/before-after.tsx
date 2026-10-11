// Before & After: measure, change, measure again, and show only what moved.
//
// Design intent (owner brief, October 2026):
// - the "after" is the hero: bigger numbers, a thicker bar, a summary of the
//   improvements in plain words at the top;
// - the numbers are never touched: every value on screen is the median the
//   backend measured, every verdict is the backend's (baseline.rs), and a
//   difference inside the normal run-to-run variation is shown as "no
//   significant change" in neutral colours, never as a loss;
// - a lower result is stated plainly, in neutral grey, with the usual cause
//   and a way to check it, because a single run can be disturbed.
import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { format, type Lang, type Strings } from "../i18n";
import { formatNumber, uiLocale } from "../lib";
import type { AuditEntry, Toast, TweakInfo } from "../types";
import { ToolDetails, ToolHeader, ToolStatus } from "./tool-section";
import { PageBoundary } from "./page-boundary";
import { Badge, type BadgeKind } from "./ui";
import { BEFORE_AFTER_COPY } from "./before-after-copy";
import "./before-after.css";

type Verdict = "better" | "worse" | "same" | "inconclusive";
type Run = { ts: number; role?: "before" | "after" };
/** Mirrors `MetricChange` in src-tauri/src/baseline.rs. */
export type MetricChange = {
  id: string;
  before: number;
  after: number;
  beforeSamples: number;
  afterSamples: number;
  beforeSpreadPct: number | null;
  afterSpreadPct: number | null;
  changePct: number | null;
  pValue: number | null;
  verdict: Verdict;
  confirmed: number;
  afterRuns: number;
};
/** Mirrors `BeforeAfter` in src-tauri/src/baseline.rs. */
export type BeforeAfter = {
  before: Run | null;
  after: Run | null;
  afterRuns: number;
  changes: MetricChange[];
};
/** Mirrors `BootRecord` and `BootReport` in src-tauri/src/diagnostics/boot.rs. */
type BootRecord = { ts: number; bootMs: number };
type BootReport = { records: BootRecord[]; change: MetricChange | null };

type Copy = (typeof BEFORE_AFTER_COPY)[Lang];

/** Display order: what people feel first, then the counts behind it. */
export const METRIC_ORDER = [
  "launch_ms",
  "disk_read_us",
  "disk_write_ms",
  "memory_touch_ms",
  "cpu",
  "processes",
  "startup_apps",
  "memory_used_mb",
  "disk_free_mb",
];
const HIGHER_IS_BETTER = new Set(["cpu", "disk_free_mb"]);
const TIMED = new Set(["cpu", "launch_ms", "memory_touch_ms", "disk_write_ms", "disk_read_us"]);

function percent(fraction: number, signed = false): string {
  const digits = Math.abs(fraction) < 0.1 ? 1 : 0;
  return new Intl.NumberFormat(uiLocale(), {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(fraction);
}

function ms(value: number): string {
  return `${formatNumber(value, value < 10 ? 2 : value < 100 ? 1 : 0)} ms`;
}

function size(mb: number): string {
  return Math.abs(mb) >= 1024 ? `${formatNumber(mb / 1024, 1)} GB` : `${formatNumber(mb)} MB`;
}

/** A measured value as shown. The processor work rate has no meaningful
 *  unit of its own (see cpubench.rs), so it is shown against the before. */
export function formatValue(id: string, value: number, base: number): string {
  switch (id) {
    case "cpu":
      return percent(base > 0 ? value / base : 1);
    case "disk_read_us":
      return value < 1000 ? `${formatNumber(value)} µs` : ms(value / 1000);
    case "processes":
    case "startup_apps":
      return formatNumber(value);
    case "memory_used_mb":
    case "disk_free_mb":
      return size(value);
    case "boot_ms":
      return `${formatNumber(value / 1000, 1)} s`;
    default:
      return ms(value);
  }
}

/** The signed difference, as the reader would say it. */
export function formatDelta(change: MetricChange): string {
  const d = change.after - change.before;
  switch (change.id) {
    case "processes":
    case "startup_apps":
      return `${d > 0 ? "+" : "−"}${formatNumber(Math.abs(d))}`;
    case "memory_used_mb":
    case "disk_free_mb":
      return `${d > 0 ? "+" : "−"}${size(Math.abs(d))}`;
    case "boot_ms":
      return `${d > 0 ? "+" : "−"}${formatNumber(Math.abs(d) / 1000, 1)} s`;
    default:
      return percent((change.changePct ?? 0) / 100, true).replace("-", "−");
  }
}

/** The size of a measured improvement, unsigned; its direction is in the
 *  label that follows it ("less time to…", "fewer…", "more…"). */
export function impactValue(change: MetricChange): string {
  return formatDelta(change).replace(/^[+−]/, "");
}

function worseLabel(id: string, c: Copy): string {
  if (TIMED.has(id) && !HIGHER_IS_BETTER.has(id)) return c.slower;
  return HIGHER_IS_BETTER.has(id) ? c.lower : c.higher;
}

function verdictBadge(change: MetricChange, c: Copy): { kind: BadgeKind; text: string } {
  switch (change.verdict) {
    case "better":
      return { kind: "ok", text: c.better };
    case "worse":
      return { kind: "muted", text: worseLabel(change.id, c) };
    case "inconclusive":
      return { kind: "muted", text: c.inconclusive };
    default:
      return { kind: "neutral", text: c.same };
  }
}

function when(ts: number): string {
  return new Date(ts * 1000).toLocaleString(uiLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sorted(changes: MetricChange[]): MetricChange[] {
  const rank = (id: string) => {
    const i = METRIC_ORDER.indexOf(id);
    return i < 0 ? METRIC_ORDER.length : i;
  };
  return [...changes].sort((a, b) => rank(a.id) - rank(b.id));
}

function MetricCard({ change, c }: { change: MetricChange; c: Copy }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const text = c.metrics[change.id] ?? { name: change.id, help: "", impact: "" };
  const top = Math.max(change.before, change.after, Number.EPSILON);
  const badge = verdictBadge(change, c);
  const spreads = [change.beforeSpreadPct, change.afterSpreadPct].filter((v) => v !== null);
  const spread = spreads.length > 0 ? Math.max(...spreads) : null;
  return (
    <article className="ba-metric" data-verdict={change.verdict}>
      <header className="ba-metric-head">
        <h4>{text.name}</h4>
        {text.help && (
          <button
            type="button"
            className="ba-help"
            aria-expanded={helpOpen}
            aria-label={text.help}
            title={text.help}
            onClick={() => setHelpOpen((v) => !v)}
          >
            i
          </button>
        )}
      </header>
      {helpOpen && <p className="ba-metric-help">{text.help}</p>}
      <dl className="ba-bars">
        <div className="ba-bar-row" data-side="before">
          <dt>{c.colBefore}</dt>
          <dd>
            <span className="ba-bar" aria-hidden="true">
              <i style={{ width: `${String((change.before / top) * 100)}%` }} />
            </span>
            <span className="ba-value">{formatValue(change.id, change.before, change.before)}</span>
          </dd>
        </div>
        <div className="ba-bar-row" data-side="after">
          <dt>{c.colAfter}</dt>
          <dd>
            <span className="ba-bar" aria-hidden="true">
              <i style={{ width: `${String((change.after / top) * 100)}%` }} />
            </span>
            <span className="ba-value">{formatValue(change.id, change.after, change.before)}</span>
          </dd>
        </div>
      </dl>
      <footer className="ba-metric-foot">
        <Badge kind={badge.kind}>{badge.text}</Badge>
        {(change.verdict === "better" || change.verdict === "worse") && (
          <span className="ba-delta">{formatDelta(change)}</span>
        )}
        <span className="ba-meta">
          {spread !== null
            ? `${format(c.spread, { pct: formatNumber(spread, spread < 10 ? 1 : 0) })} · ${format(c.medianOf, { count: change.afterSamples })}`
            : c.reading}
        </span>
      </footer>
      {change.verdict === "better" && change.afterRuns > 1 && (
        <p className="ba-confirmed">
          {format(c.confirmed, { count: change.confirmed, total: change.afterRuns })}
        </p>
      )}
      {change.verdict === "worse" && (
        <p className="ba-note">{TIMED.has(change.id) ? c.worseHint : text.help}</p>
      )}
    </article>
  );
}

/** Draws the comparison as a PNG. Only values the backend measured are drawn,
 *  formatted exactly as on screen. */
function renderReport(data: BeforeAfter, changes: MetricChange[], c: Copy): string {
  const W = 1080;
  const PAD = 56;
  const ROW = 50;
  const better = changes.filter((ch) => ch.verdict === "better");
  const anyWorse = changes.some((ch) => ch.verdict === "worse");
  // Drawn on a canvas taller than needed, then cropped to what was drawn.
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = 420 + better.length * 40 + changes.length * ROW + 200;
  const g = canvas.getContext("2d");
  if (!g) return "";
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--app-accent").trim() || "#ff6a3d";
  const ok = css.getPropertyValue("--success").trim() || "#4ade80";
  const font = (weight: number, px: number) =>
    `${String(weight)} ${String(px)}px "Inter Variable", "Segoe UI", sans-serif`;
  g.fillStyle = "#121217";
  g.fillRect(0, 0, W, canvas.height);
  g.fillStyle = accent;
  g.fillRect(0, 0, W, 6);

  let y = PAD + 24;
  g.fillStyle = "#f2f2f4";
  g.font = font(750, 30);
  g.fillText(c.reportTitle, PAD, y);
  y += 32;
  g.fillStyle = "#9a9aa6";
  g.font = font(500, 17);
  if (data.before && data.after) {
    g.fillText(
      format(c.measuredAt, { before: when(data.before.ts), after: when(data.after.ts) }),
      PAD,
      y,
    );
  }
  y += 52;

  g.fillStyle = "#9a9aa6";
  g.font = font(700, 14);
  g.fillText(c.impactTitle.toUpperCase(), PAD, y);
  y += 38;
  if (better.length === 0) {
    g.fillStyle = "#f2f2f4";
    g.font = font(700, 26);
    g.fillText(anyWorse ? c.impactWorseTitle : c.impactNoneTitle, PAD, y);
    y += 40;
  }
  for (const ch of better) {
    const value = impactValue(ch);
    g.fillStyle = ok;
    g.font = font(800, 28);
    g.fillText(value, PAD, y);
    const width = g.measureText(value).width;
    g.fillStyle = "#e6e6ea";
    g.font = font(500, 22);
    g.fillText(c.metrics[ch.id]?.impact ?? ch.id, PAD + width + 12, y);
    y += 40;
  }
  y += 28;

  const cols = [PAD, 500, 660, 820];
  g.fillStyle = "#9a9aa6";
  g.font = font(700, 14);
  g.fillText(c.colBefore.toUpperCase(), cols[1], y);
  g.fillText(c.colAfter.toUpperCase(), cols[2], y);
  y += 14;
  for (const ch of changes) {
    g.fillStyle = "#26262e";
    g.fillRect(PAD, y, W - PAD * 2, 1);
    y += ROW - 16;
    g.fillStyle = "#e6e6ea";
    g.font = font(600, 19);
    g.fillText(c.metrics[ch.id]?.name ?? ch.id, cols[0], y, cols[1] - cols[0] - 16);
    g.fillStyle = "#9a9aa6";
    g.font = font(500, 19);
    g.fillText(formatValue(ch.id, ch.before, ch.before), cols[1], y);
    g.fillStyle = "#f2f2f4";
    g.font = font(750, 21);
    g.fillText(formatValue(ch.id, ch.after, ch.before), cols[2], y);
    const moved = ch.verdict === "better" || ch.verdict === "worse";
    g.font = moved ? font(650, 17) : font(500, 14);
    g.fillStyle = ch.verdict === "better" ? ok : "#9a9aa6";
    g.fillText(moved ? formatDelta(ch) : verdictBadge(ch, c).text, cols[3], y, W - PAD - cols[3]);
    y += 16;
  }
  y += 34;
  g.fillStyle = "#8a8a96";
  g.font = font(500, 14);
  // Wrap the method line to the card width.
  let line = "";
  for (const word of c.reportFooter.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > W - PAD * 2) {
      g.fillText(line, PAD, y);
      y += 20;
      line = word;
    } else line = next;
  }
  if (line) g.fillText(line, PAD, y);

  const out = document.createElement("canvas");
  out.width = W;
  out.height = Math.min(canvas.height, Math.ceil(y + PAD));
  out.getContext("2d")?.drawImage(canvas, 0, 0);
  return out.toDataURL("image/png");
}

type PanelProps = {
  s: Strings;
  lang: Lang;
  tweaks: TweakInfo[];
  pushToast: (kind: Toast["kind"], message: string) => void;
};

/** A failure inside Before & After stays inside it: the rest of PC Health
 *  keeps working. */
export function BeforeAfterPanel(props: PanelProps) {
  return (
    <PageBoundary s={props.s} resetKey="before-after">
      <BeforeAfterContent {...props} />
    </PageBoundary>
  );
}

function BeforeAfterContent({ s, lang, tweaks, pushToast }: PanelProps) {
  const c = BEFORE_AFTER_COPY[lang];
  const [data, setData] = useState<BeforeAfter | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [boot, setBoot] = useState<BootReport | null>(null);
  const [bootBusy, setBootBusy] = useState(false);
  const [bootRead, setBootRead] = useState(false);

  const beforeTs = data?.before?.ts ?? null;
  const loadBoot = useCallback(
    (refresh: boolean) => {
      if (refresh) setBootBusy(true);
      return invoke<BootReport>("boot_times", { refresh, beforeTs })
        .then((report) => {
          setBoot(report);
          if (refresh) setBootRead(true);
        })
        .catch((e: unknown) => {
          if (refresh) setError(format(c.failed, { error: String(e) }));
        })
        .finally(() => setBootBusy(false));
    },
    [beforeTs, c.failed],
  );

  useEffect(() => {
    invoke<BeforeAfter>("before_after")
      .then(setData)
      .catch(() => undefined);
  }, []);
  // Stored startup times only: reading Windows' log again asks for
  // administrator permission, so that waits for the button.
  useEffect(() => {
    invoke<BootReport>("boot_times", { refresh: false, beforeTs })
      .then(setBoot)
      .catch(() => undefined);
  }, [beforeTs]);
  useEffect(() => {
    invoke<AuditEntry[]>("list_audit_log")
      .then(setAudit)
      .catch(() => undefined);
  }, [data]);

  const measure = (role: "before" | "after") => {
    setBusy(true);
    setError(null);
    invoke<BeforeAfter>("run_baseline", { role })
      .then(setData)
      .catch((e: unknown) => setError(format(c.failed, { error: String(e) })))
      .finally(() => setBusy(false));
  };

  const changes = useMemo(() => sorted(data?.changes ?? []), [data]);
  const better = changes.filter((ch) => ch.verdict === "better");
  const worse = changes.filter((ch) => ch.verdict === "worse");
  // Runs that spread this widely mostly mean the PC was busy while measuring.
  const noisy = changes.some(
    (ch) => TIMED.has(ch.id) && Math.max(ch.beforeSpreadPct ?? 0, ch.afterSpreadPct ?? 0) > 20,
  );
  const bootChange = boot?.change ?? null;

  // What PC Tweaker changed between the two measurements, from its own log.
  const between = useMemo(() => {
    if (!data?.before) return [];
    const from = data.before.ts;
    const to = data.after?.ts ?? Number.MAX_SAFE_INTEGER;
    const labels: Record<string, string> = {
      cleanup: s.ledger.actions.cleanup,
      "files-deleted": s.ledger.actions.filesDeleted,
      "disk-optimize": s.ledger.actions.diskOptimize,
      "startup-change": s.ledger.actions.startupChange,
    };
    const name = (id: string) => s.tweaks[id]?.name ?? tweaks.find((t) => t.id === id)?.name ?? id;
    return audit
      .filter((e) => e.success && e.ts >= from && e.ts <= to)
      .flatMap((e) => {
        if (e.action === "tweak-applied") return [name(e.target)];
        if (e.action === "tweak-reverted") return [`${name(e.target)} (${c.undone})`];
        return labels[e.action] ? [labels[e.action]] : [];
      })
      .filter((v, i, all) => all.indexOf(v) === i);
  }, [audit, data, s, tweaks, c.undone]);

  const saveImage = async () => {
    if (!data) return;
    try {
      const path = await saveFileDialog({
        defaultPath: "pc-tweaker-before-after.png",
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (!path) return;
      const url = renderReport(data, changes, c);
      await invoke("save_report_png", { path, dataBase64: url.split(",")[1] ?? "" });
      pushToast("success", c.saved);
    } catch (e) {
      pushToast("error", String(e));
    }
  };

  const step = !data?.before ? 0 : !data.after ? 2 : 3;
  const hasResult = data?.before && data.after;

  return (
    <section className="tool-panel ba-panel" aria-busy={busy}>
      <ToolHeader
        title={c.title}
        description={c.subtitle}
        actions={
          hasResult ? (
            <button
              type="button"
              className="tool-secondary-action"
              onClick={() => void saveImage()}
            >
              {c.save}
            </button>
          ) : undefined
        }
      />

      <ol className="ba-steps">
        {[c.stepBefore, c.stepChange, c.stepAfter].map((label, i) => {
          const state =
            i < step ? "done" : i === step || (step === 2 && i === 1) ? "current" : "todo";
          return (
            <li
              key={label}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="ba-step-dot" aria-hidden="true">
                {state === "done" ? "✓" : i + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {busy && <ToolStatus busy>{c.running}</ToolStatus>}
      {error && <ToolStatus tone="error">{error}</ToolStatus>}

      {!data?.before && !busy && (
        <div className="ba-empty">
          <p>{c.emptyIntro}</p>
          <button type="button" className="tool-primary-action" onClick={() => measure("before")}>
            {c.runBefore}
          </button>
        </div>
      )}

      {data?.before && !data.after && !busy && (
        <div className="ba-empty">
          <p className="ba-when">{format(c.beforeTaken, { time: when(data.before.ts) })}</p>
          <p>{c.nextHint}</p>
          <div className="ba-actions">
            <button type="button" className="tool-primary-action" onClick={() => measure("after")}>
              {c.runAfter}
            </button>
            <button
              type="button"
              className="tool-secondary-action"
              onClick={() => measure("before")}
            >
              {c.startOver}
            </button>
          </div>
        </div>
      )}

      {hasResult && data.before && data.after && (
        <>
          <div
            className="ba-hero"
            data-tone={better.length > 0 || bootChange?.verdict === "better" ? "better" : "calm"}
          >
            <p className="ba-eyebrow">{c.impactTitle}</p>
            {better.length > 0 || bootChange?.verdict === "better" ? (
              <ul className="ba-impact" role="list">
                {[...(bootChange?.verdict === "better" ? [bootChange] : []), ...better].map(
                  (ch) => (
                    <li key={ch.id}>
                      <strong>{impactValue(ch)}</strong>
                      <span>{c.metrics[ch.id]?.impact ?? ch.id}</span>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <div className="ba-calm">
                <span className="ba-calm-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d={worse.length > 0 ? "M12 11v6M12 7.5v.01" : "m5 12.5 4.5 4.5L19 7.5"}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <h3>{worse.length > 0 ? c.impactWorseTitle : c.impactNoneTitle}</h3>
                  <p>{worse.length > 0 ? c.worseHint : c.impactNoneBody}</p>
                  {worse.length === 0 && <p className="ba-quiet">{c.impactNoneNote}</p>}
                </div>
              </div>
            )}
            {better.length > 0 && worse.length === 0 && better.length < changes.length && (
              <p className="ba-quiet">{c.impactAlso}</p>
            )}
            {noisy && <p className="ba-quiet">{c.noisy}</p>}
            <p className="ba-when">
              {format(c.measuredAt, { before: when(data.before.ts), after: when(data.after.ts) })}
            </p>
          </div>

          <div className="ba-between">
            <h4>{c.changesBetween}</h4>
            {between.length === 0 ? (
              <p>{c.changesNone}</p>
            ) : (
              <ul role="list">
                {between.slice(0, 6).map((label) => (
                  <li key={label}>{label}</li>
                ))}
                {between.length > 6 && (
                  <li>{format(c.changesMore, { count: between.length - 6 })}</li>
                )}
              </ul>
            )}
          </div>

          <div className="ba-grid">
            {changes.map((ch) => (
              <MetricCard key={ch.id} change={ch} c={c} />
            ))}
          </div>

          <div className="ba-actions">
            <button
              type="button"
              className="tool-primary-action"
              disabled={busy}
              onClick={() => measure("after")}
            >
              {c.runAgain}
            </button>
            <button
              type="button"
              className="tool-secondary-action"
              disabled={busy}
              onClick={() => measure("before")}
            >
              {c.startOver}
            </button>
          </div>
        </>
      )}

      {data?.before && (
        <div className="ba-boot">
          <div className="ba-boot-head">
            <div>
              <h4>{c.bootTitle}</h4>
              <p>{c.bootHelp}</p>
            </div>
            <button
              type="button"
              className="tool-secondary-action"
              disabled={bootBusy}
              onClick={() => void loadBoot(true)}
            >
              {bootBusy ? c.bootReading : c.bootRead}
            </button>
          </div>
          {bootRead && boot?.records.length === 0 && <p className="ba-quiet">{c.bootNone}</p>}
          {boot && boot.records.length > 0 && (
            <>
              <p className="ba-quiet">
                {format(c.bootCounts, {
                  before: boot.records.filter((r) => r.ts <= data.before!.ts).length,
                  after: boot.records.filter((r) => r.ts > data.before!.ts).length,
                })}
              </p>
              {bootChange && bootChange.verdict !== "inconclusive" ? (
                <MetricCard change={bootChange} c={c} />
              ) : (
                <p className="ba-quiet">{c.bootNeedMore}</p>
              )}
            </>
          )}
        </div>
      )}

      <ToolDetails label={c.method} className="ba-method">
        {c.methodBody.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </ToolDetails>
    </section>
  );
}
