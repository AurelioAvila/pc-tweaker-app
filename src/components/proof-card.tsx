// The proof card: measure, apply, measure again, and show what moved.
//
// Any one-shot change in the app (Safe optimize, a profile, the Scan's Fix
// all) runs through `runWithProof`. The numbers are the existing Before &
// After measurement (baseline.rs: medians of 7+ timed runs, readings with a
// floor, an exact rank test) plus the PC Health score; nothing is estimated
// and a difference inside the normal variation is "no significant change".
// The card can be saved as a PNG with the brand, the version and the date,
// and nothing personal (no user, PC or profile name).
import { useEffect, useRef, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { format, type Lang, type Strings } from "../i18n";
import { formatNumber, friendlyError, uiLocale } from "../lib";
import type { RestoreStatus, Toast } from "../types";
import { Badge, type BadgeKind } from "./ui";
import { BEFORE_AFTER_COPY } from "./before-after-copy";
import {
  formatDelta,
  formatValue,
  impactValue,
  type BeforeAfter,
  type MetricChange,
} from "./before-after";
import { PROOF_COPY } from "./proof-copy";
import { FixProgress } from "./fix-progress";
import {
  applyStepEvent,
  closeWork,
  initialSteps,
  type FixStep,
  type FixStepId,
  type StepEvent,
} from "../fix-steps";
import "./proof-card.css";

export type ProofSource = "safe" | "scan" | "profile";

/** What the action reports back: the names of what it changed (shown on the
 *  card), how many it could not apply, and its restore point if it made one. */
export type ProofOutcome = {
  changed: string[];
  failures?: number;
  restorePoint?: RestoreStatus | null;
};

export type Running = {
  /** `finishing`: the work and the measurements are done, the ring is
   *  completing (fix-progress.tsx) before the card opens. */
  phase: "before" | "apply" | "after" | "finishing";
  source: ProofSource;
  name?: string;
  admin: boolean;
  steps: FixStep[];
};
type Done = {
  phase: "done";
  source: ProofSource;
  name?: string;
  outcome: ProofOutcome;
  /** Null when there was nothing to measure or the measurement failed. */
  changes: MetricChange[] | null;
  measureError: string | null;
  at: number;
};
type Failed = { phase: "error"; source: ProofSource; name?: string; error: string };
type ProofState = Running | Done | Failed | null;

// A tiny external store: one card for the whole app, callable from anywhere.
let current: ProofState = null;
/** Where focus returns when the card closes: the button that started it. */
let opener: HTMLElement | null = null;
const listeners = new Set<() => void>();
function set(next: ProofState) {
  current = next;
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const snapshot = () => current;
function closeProof() {
  set(null);
  opener?.focus();
  opener = null;
}

/** The running fix, for the progress ring; null otherwise. */
export function useProofRun(): Running | null {
  const state = useSyncExternalStore(subscribe, snapshot);
  return state && state.phase !== "done" && state.phase !== "error" ? state : null;
}

// Screens that show the ring in place (the Scan, the Safe optimize card)
// register here; the dialog shows it only when none is on screen.
let inlineViews = 0;
const inlineListeners = new Set<() => void>();
function subscribeInline(listener: () => void) {
  inlineListeners.add(listener);
  return () => inlineListeners.delete(listener);
}
export function registerInlineProgress(): () => void {
  inlineViews++;
  inlineListeners.forEach((l) => l());
  return () => {
    inlineViews--;
    inlineListeners.forEach((l) => l());
  };
}

// The ring calls `proofRevealed` once it has shown 100 % and the check; the
// card opens then (or after REVEAL_TIMEOUT_MS if no ring is on screen).
let revealed: (() => void) | null = null;
const REVEAL_TIMEOUT_MS = 15_000;
export function proofRevealed() {
  revealed?.();
}

/** True while a proof is measuring or applying: callers disable their buttons. */
export function useProofBusy(): boolean {
  const state = useSyncExternalStore(subscribe, snapshot);
  return !!state && state.phase !== "done" && state.phase !== "error";
}

async function healthScore(): Promise<number | null> {
  try {
    const result = await invoke<{ report: { overall: number } }>("health_report");
    return Number.isFinite(result.report.overall) ? result.report.overall : null;
  } catch {
    return null;
  }
}

/** The PC Health score as a row of the card. The score is a pure function
 *  of this PC's state (health.rs), so any whole point is a real change. */
function healthChange(before: number | null, after: number | null): MetricChange | null {
  if (before === null || after === null) return null;
  return {
    id: "health",
    before,
    after,
    beforeSamples: 1,
    afterSamples: 1,
    beforeSpreadPct: null,
    afterSpreadPct: null,
    changePct: before ? ((after - before) / before) * 100 : null,
    pValue: null,
    verdict: after > before ? "better" : after < before ? "worse" : "same",
    confirmed: 0,
    afterRuns: 1,
  };
}

/** Rows of the card, in this order: the score, what runs in the background,
 *  latency, then the rest. */
const ORDER = [
  "health",
  "startup_apps",
  "processes",
  "memory_used_mb",
  "timer_ms",
  "launch_ms",
  "disk_read_us",
  "cpu",
  "disk_free_mb",
];

/** Reports a step the window runs itself (e.g. the Scan's booster switch),
 *  in the same shape as the backend's "fix-progress" events. */
export type TrackStep = (event: StepEvent) => void;

/**
 * Measures, runs `apply`, measures again and opens the card. `apply` returns
 * what it changed, or null when it changed nothing and has already told the
 * user why (the card then closes without a result). Throws only for "a proof
 * is already running".
 *
 * Progress: the ring shows "measure before", the work, "measure after". The
 * work's steps come from the backend's "fix-progress" events while `apply`
 * runs (scan_fix, safe_apply); without them it is one "applying settings"
 * step. Steps the window runs itself go through `track`.
 *
 * Wiring for any screen (the Scan's Fix all included):
 *   await runWithProof("scan", async (track) => {
 *     const failures = await invoke<string[]>("apply_tweaks", { ids, source: "scan" });
 *     return { changed: names, failures: failures.length };
 *   });
 */
export async function runWithProof(
  source: ProofSource,
  apply: (track: TrackStep) => Promise<ProofOutcome | null>,
  options: { name?: string; admin?: boolean; plan?: FixStepId[] } = {},
): Promise<ProofOutcome | null> {
  if (current && current.phase !== "done" && current.phase !== "error") {
    throw new Error("a measurement is already running");
  }
  const base = { source, name: options.name, admin: options.admin ?? false };
  let steps = initialSteps(options.plan);
  const show = (phase: Running["phase"]) => set({ ...base, phase, steps });
  const track: TrackStep = (event) => {
    steps = applyStepEvent(steps, event);
    show("apply");
  };
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  show("before");
  let healthBefore: number | null = null;
  let measureError: string | null = null;
  try {
    healthBefore = await healthScore();
    await invoke<BeforeAfter>("run_baseline", { role: "before" });
  } catch (e) {
    // The change still happens; the card says it could not be measured.
    measureError = String(e);
  }

  steps = applyStepEvent(steps, { step: "measure_before", done: true, failed: !!measureError });
  // The first work step runs until the backend says otherwise.
  const first = steps.find((st) => st.id !== "measure_before");
  if (first && first.id !== "measure_after") steps = applyStepEvent(steps, { step: first.id });
  show("apply");
  const unlisten = await listen<StepEvent>("fix-progress", (e) => track(e.payload)).catch(
    () => () => undefined,
  );
  let outcome: ProofOutcome | null;
  try {
    outcome = await apply(track);
  } catch (e) {
    set({ source, name: options.name, phase: "error", error: String(e) });
    return null;
  } finally {
    unlisten();
  }
  if (!outcome) {
    closeProof();
    return null;
  }

  steps = closeWork(steps);
  let changes: MetricChange[] | null = null;
  if (!measureError && outcome.changed.length > 0) {
    steps = applyStepEvent(steps, { step: "measure_after" });
    show("after");
    try {
      const healthAfter = await healthScore();
      const result = await invoke<BeforeAfter>("run_baseline", { role: "after" });
      const health = healthChange(healthBefore, healthAfter);
      changes = [...(health ? [health] : []), ...result.changes]
        .filter((ch) => ORDER.includes(ch.id))
        .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
    } catch (e) {
      measureError = String(e);
    }
    steps = applyStepEvent(steps, { step: "measure_after", done: true, failed: !changes });
  } else {
    // Nothing to compare: no second measurement, and the ring says so by
    // not listing it.
    steps = steps.filter((st) => st.id !== "measure_after");
  }

  // The ring completes (100 %, the check), then the card opens.
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, REVEAL_TIMEOUT_MS);
    revealed = () => {
      window.clearTimeout(timer);
      resolve();
    };
    show("finishing");
  });
  revealed = null;
  set({
    source,
    name: options.name,
    phase: "done",
    outcome,
    changes,
    measureError,
    at: Math.floor(Date.now() / 1000),
  });
  return outcome;
}

type Copy = (typeof PROOF_COPY)[Lang];
type BaCopy = (typeof BEFORE_AFTER_COPY)[Lang];

function sourceLabel(state: { source: ProofSource; name?: string }, c: Copy, forImage = false) {
  if (state.source === "safe") return c.sourceSafe;
  if (state.source === "scan") return c.sourceScan;
  // A profile's name is the user's own text: on screen only, never in the image.
  return forImage || !state.name
    ? c.sourceProfile.replace(/\s*·\s*\{name\}/, "")
    : format(c.sourceProfile, { name: state.name });
}

function when(ts: number, withTime = true): string {
  return new Date(ts * 1000).toLocaleString(uiLocale(), {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  });
}

function clock(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString(uiLocale(), { timeStyle: "short" });
}

function metricName(id: string, c: Copy, ba: BaCopy): string {
  return id === "health" ? c.healthName : (ba.metrics[id]?.name ?? id);
}

function valueOf(ch: MetricChange, which: "before" | "after"): string {
  const v = ch[which];
  return ch.id === "health" ? formatNumber(v) : formatValue(ch.id, v, ch.before);
}

/** The signed difference, as on the Before & After cards. */
function deltaOf(ch: MetricChange): string {
  if (ch.id !== "health") return formatDelta(ch);
  const d = ch.after - ch.before;
  return `${d > 0 ? "+" : "−"}${formatNumber(Math.abs(d))}`;
}

/** The improvement as a big number, unsigned; its direction is in the label. */
function impactOf(ch: MetricChange): string {
  return ch.id === "health" ? formatNumber(Math.abs(ch.after - ch.before)) : impactValue(ch);
}

function impactLabel(ch: MetricChange, c: Copy, ba: BaCopy): string {
  return ch.id === "health" ? c.healthImpact : (ba.metrics[ch.id]?.impact ?? ch.id);
}

const SLOWER = new Set(["launch_ms", "memory_touch_ms", "disk_write_ms", "disk_read_us"]);
const HIGHER_IS_BETTER = new Set(["cpu", "disk_free_mb", "health"]);

/** Same words as Before & After; a lower result is stated plainly, in grey. */
function verdictOf(ch: MetricChange, ba: BaCopy): { kind: BadgeKind; text: string } {
  switch (ch.verdict) {
    case "better":
      return { kind: "ok", text: ba.better };
    case "worse":
      return {
        kind: "muted",
        text: SLOWER.has(ch.id) ? ba.slower : HIGHER_IS_BETTER.has(ch.id) ? ba.lower : ba.higher,
      };
    case "inconclusive":
      return { kind: "muted", text: ba.inconclusive };
    default:
      return { kind: "neutral", text: ba.same };
  }
}

function restoreLine(r: RestoreStatus, c: Copy): { tone: "ok" | "calm" | "warn"; text: string } {
  switch (r.kind) {
    case "created":
      return { tone: "ok", text: format(c.restoreCreated, { time: clock(r.at ?? 0) }) };
    case "reused":
      return { tone: "calm", text: format(c.restoreReused, { time: when(r.at ?? 0) }) };
    case "skipped":
      return { tone: "warn", text: c.restoreSkipped };
    default:
      return { tone: "warn", text: format(c.restoreFailed, { reason: r.reason ?? "" }) };
  }
}

// ---------------------------------------------------------------------------
// The PNG.

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(g: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && g.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

/** Draws the card. Only what the card shows, from the same values. */
async function renderPng(state: Done, c: Copy, ba: BaCopy): Promise<string> {
  const W = 1200;
  const PAD = 64;
  const [version, logo] = await Promise.all([
    getVersion().catch(() => ""),
    loadImage("/logo-mark.png"),
  ]);
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const accent = token("--app-accent", "#ff6a3d");
  const bgA = token("--app-bg-a", "#1c1c22");
  const bgB = token("--app-bg-b", "#121217");
  const ok = "#4ade80";
  const ink = "#f2f2f4";
  const ink2 = "#c2c2cc";
  const ink3 = "#8f8f9c";
  const font = (weight: number, px: number) =>
    `${String(weight)} ${String(px)}px "Inter Variable", "Segoe UI", sans-serif`;

  const changes = state.changes ?? [];
  const better = changes.filter((ch) => ch.verdict === "better").slice(0, 4);
  const anyWorse = changes.some((ch) => ch.verdict === "worse");
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = 2000;
  const g = canvas.getContext("2d");
  if (!g) return "";
  const bg = g.createLinearGradient(0, 0, W, 900);
  bg.addColorStop(0, bgA);
  bg.addColorStop(1, bgB);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, canvas.height);
  // A soft wash of the theme's accent behind the brand row.
  g.globalAlpha = 0.2;
  const glow = g.createRadialGradient(PAD, 0, 0, PAD, 0, 620);
  glow.addColorStop(0, accent);
  glow.addColorStop(1, bgB);
  g.fillStyle = glow;
  g.fillRect(0, 0, W, 620);
  g.globalAlpha = 1;

  // Brand row.
  let y = PAD;
  if (logo) g.drawImage(logo, PAD, y, 44, 44);
  g.fillStyle = ink;
  g.font = font(750, 26);
  g.textBaseline = "middle";
  g.fillText("PC Tweaker", PAD + (logo ? 58 : 0), y + 22);
  g.fillStyle = ink3;
  g.font = font(500, 18);
  g.textAlign = "right";
  g.fillText(
    [version && `v${version}`, when(state.at)].filter(Boolean).join(" · "),
    W - PAD,
    y + 22,
  );
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  y += 44 + 56;

  g.fillStyle = accent;
  g.font = font(750, 15);
  g.fillText(c.title.toUpperCase(), PAD, y);
  y += 44;
  g.fillStyle = ink;
  g.font = font(750, 40);
  g.fillText(sourceLabel(state, c, true), PAD, y);
  y += 54;

  // Hero.
  if (better.length > 0) {
    const col = (W - PAD * 2) / Math.max(better.length, 2);
    better.forEach((ch, i) => {
      const x = PAD + i * col;
      g.fillStyle = ok;
      g.font = font(800, 60);
      g.fillText(impactOf(ch), x, y + 56);
      g.fillStyle = ink2;
      g.font = font(500, 19);
      wrap(g, impactLabel(ch, c, ba), col - 24)
        .slice(0, 2)
        .forEach((l, j) => g.fillText(l, x, y + 92 + j * 26));
    });
    y += 160;
  } else if (state.changes) {
    g.fillStyle = ink;
    g.font = font(750, 32);
    g.fillText(anyWorse ? c.heroWorse : c.heroNone, PAD, y + 34);
    g.fillStyle = ink2;
    g.font = font(500, 19);
    const lines = wrap(g, anyWorse ? c.heroWorseBody : c.heroNoneBody, W - PAD * 2);
    lines.forEach((l, j) => g.fillText(l, PAD, y + 76 + j * 28));
    y += 76 + lines.length * 28 + 16;
  }

  if (state.outcome.restorePoint) {
    const line = restoreLine(state.outcome.restorePoint, c);
    g.fillStyle = line.tone === "ok" ? ok : ink3;
    g.font = font(600, 18);
    g.fillText(`${line.tone === "ok" ? "✓ " : ""}${line.text}`, PAD, y + 8, W - PAD * 2);
    y += 40;
  }

  // Measured rows, three to a line.
  if (changes.length > 0) {
    y += 10;
    const cols = 3;
    const gap = 16;
    const tw = (W - PAD * 2 - gap * (cols - 1)) / cols;
    const th = 118;
    changes.forEach((ch, i) => {
      const x = PAD + (i % cols) * (tw + gap);
      const ty = y + Math.floor(i / cols) * (th + gap);
      g.fillStyle = "rgba(255,255,255,0.05)";
      roundRect(g, x, ty, tw, th, 16);
      if (ch.verdict === "better") {
        g.fillStyle = "rgba(74,222,128,0.10)";
        roundRect(g, x, ty, tw, th, 16);
      }
      g.fillStyle = ink3;
      g.font = font(600, 16);
      g.fillText(metricName(ch.id, c, ba), x + 20, ty + 34, tw - 40);
      g.fillStyle = ink;
      g.font = font(750, 25);
      g.fillText(`${valueOf(ch, "before")} → ${valueOf(ch, "after")}`, x + 20, ty + 70, tw - 40);
      const v = verdictOf(ch, ba);
      g.fillStyle = ch.verdict === "better" ? ok : ink3;
      g.font = font(600, 16);
      g.fillText(v.text, x + 20, ty + 98, tw - 40);
    });
    y += Math.ceil(changes.length / cols) * (th + gap) + 12;
  }

  if (state.outcome.changed.length > 0) {
    g.fillStyle = ink2;
    g.font = font(700, 18);
    g.fillText(format(c.changed, { count: state.outcome.changed.length }), PAD, y + 20);
    g.fillStyle = ink3;
    g.font = font(500, 17);
    // A no-break space before each dot: a wrapped line never starts with one.
    const lines = wrap(g, state.outcome.changed.join(" · "), W - PAD * 2);
    lines.slice(0, 3).forEach((l, j) => g.fillText(l, PAD, y + 50 + j * 25));
    y += 50 + Math.min(lines.length, 3) * 25 + 10;
  }

  // Method line and the site, under a hairline.
  y += 18;
  g.fillStyle = "rgba(255,255,255,0.10)";
  g.fillRect(PAD, y, W - PAD * 2, 1);
  y += 34;
  g.fillStyle = ink3;
  g.font = font(500, 15);
  const foot = wrap(g, c.pngFooter, W - PAD * 2 - 160);
  foot.forEach((l, j) => g.fillText(l, PAD, y + j * 21));
  g.fillStyle = accent;
  g.font = font(700, 16);
  g.textAlign = "right";
  g.fillText("pctweaker.app", W - PAD, y);
  g.textAlign = "left";
  y += foot.length * 21 + PAD - 16;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = Math.ceil(y);
  out.getContext("2d")?.drawImage(canvas, 0, 0);
  return out.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// The dialog.

function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Mounted once in the app. Shows the progress while a proof runs and the
 *  card when it is done. */
export function ProofCardHost({
  s,
  lang,
  pushToast,
}: {
  s: Strings;
  lang: Lang;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const state = useSyncExternalStore(subscribe, snapshot);
  const inline = useSyncExternalStore(subscribeInline, () => inlineViews);
  if (!state) return null;
  const running = state.phase !== "done" && state.phase !== "error";
  // The Scan and the Safe optimize card show the ring in place.
  if (running && inline > 0) return null;
  const c = PROOF_COPY[lang];
  const ba = BEFORE_AFTER_COPY[lang];
  const close = closeProof;

  const save = async () => {
    if (state.phase !== "done") return;
    try {
      const date = new Date(state.at * 1000).toISOString().slice(0, 10);
      const path = await saveFileDialog({
        defaultPath: `pc-tweaker-proof-${date}.png`,
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (!path) return;
      const url = await renderPng(state, c, ba);
      await invoke("save_report_png", { path, dataBase64: url.split(",")[1] ?? "" });
      pushToast("success", c.saved);
    } catch (e) {
      pushToast("error", friendlyError(e, s));
    }
  };

  return (
    <dialog
      ref={(node) => {
        // A frame later: a ring that registers in place this same commit
        // (registerInlineProgress) has removed the dialog by then, and an
        // opened-then-removed modal would take the focus with it.
        if (node && !node.open)
          requestAnimationFrame(() => {
            if (node.isConnected && !node.open) node.showModal();
          });
      }}
      className="proof-dialog"
      aria-labelledby="proof-title"
      aria-busy={running}
      onCancel={(e) => {
        e.preventDefault();
        if (!running) close();
      }}
    >
      {running && (
        <div className="proof-progress">
          <FixProgress lang={lang} titleId="proof-title" />
        </div>
      )}

      {state.phase === "error" && (
        <div className="proof-result">
          <header className="proof-top">
            <div>
              <p className="proof-eyebrow">{c.title}</p>
              <h2 id="proof-title">{sourceLabel(state, c)}</h2>
            </div>
            <button type="button" className="proof-close" onClick={close} aria-label={c.close}>
              <CloseIcon />
            </button>
          </header>
          <p className="proof-note" data-tone="warn" role="alert">
            {format(c.failed, { error: friendlyError(state.error, s) })}
          </p>
          <footer className="proof-actions">
            <button type="button" className="tool-primary-action" onClick={close} autoFocus>
              {c.close}
            </button>
          </footer>
        </div>
      )}

      {state.phase === "done" && (
        <ProofResult state={state} c={c} ba={ba} s={s} onSave={save} onClose={close} />
      )}
    </dialog>
  );
}

function ProofResult({
  state,
  c,
  ba,
  s,
  onSave,
  onClose,
}: {
  state: Done;
  c: Copy;
  ba: BaCopy;
  s: Strings;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  const changes = state.changes ?? [];
  const better = changes.filter((ch) => ch.verdict === "better");
  const anyWorse = changes.some((ch) => ch.verdict === "worse");
  const restore = state.outcome.restorePoint ? restoreLine(state.outcome.restorePoint, c) : null;
  const nothing = state.outcome.changed.length === 0;
  const top = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  // Open on the headline, with the keyboard on Done.
  useEffect(() => {
    done.current?.focus({ preventScroll: true });
    top.current?.closest("dialog")?.scrollTo(0, 0);
  }, []);

  return (
    <div className="proof-result" ref={top}>
      <header className="proof-top">
        <div>
          <p className="proof-eyebrow">{c.title}</p>
          <h2 id="proof-title">{sourceLabel(state, c)}</h2>
          <p className="proof-when">{format(c.measuredOn, { date: when(state.at) })}</p>
        </div>
        <button type="button" className="proof-close" onClick={onClose} aria-label={c.close}>
          <CloseIcon />
        </button>
      </header>

      {nothing ? (
        <section className="proof-hero" data-tone="calm">
          <h3>{c.nothingChanged}</h3>
        </section>
      ) : state.changes === null ? (
        <section className="proof-hero" data-tone="calm">
          <p>{format(c.notMeasured, { error: friendlyError(state.measureError ?? "", s) })}</p>
        </section>
      ) : better.length > 0 ? (
        <section className="proof-hero" data-tone="better">
          <ul className="proof-impact" role="list">
            {better.slice(0, 4).map((ch) => (
              <li key={ch.id}>
                <strong>{impactOf(ch)}</strong>
                <span>{impactLabel(ch, c, ba)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="proof-hero" data-tone="calm">
          <h3>{anyWorse ? c.heroWorse : c.heroNone}</h3>
          <p>{anyWorse ? c.heroWorseBody : c.heroNoneBody}</p>
        </section>
      )}

      {restore && (
        <p className="proof-note" data-tone={restore.tone}>
          {restore.tone === "ok" && (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="m3.5 8.5 3 3 6-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {restore.text}
        </p>
      )}

      {changes.length > 0 && (
        <section className="proof-measured" aria-label={c.gridCaption}>
          <p className="proof-small">{c.gridCaption}</p>
          <ul className="proof-grid" role="list">
            {changes.map((ch) => {
              const v = verdictOf(ch, ba);
              return (
                <li key={ch.id} className="proof-tile" data-verdict={ch.verdict}>
                  <span className="proof-tile-head">
                    <span className="proof-tile-name">{metricName(ch.id, c, ba)}</span>
                    {ch.verdict === "better" ? (
                      <Badge kind="ok" title={v.text}>
                        {deltaOf(ch)}
                        <span className="sr-only"> {v.text}</span>
                      </Badge>
                    ) : ch.verdict === "same" ? (
                      <span className="sr-only">{v.text}</span>
                    ) : (
                      <Badge kind={v.kind}>{v.text}</Badge>
                    )}
                  </span>
                  <span className="proof-tile-values">
                    <span className="proof-before">{valueOf(ch, "before")}</span>
                    <span aria-hidden="true">→</span>
                    <strong>{valueOf(ch, "after")}</strong>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!nothing && (
        <details className="proof-changed">
          <summary>{format(c.changed, { count: state.outcome.changed.length })}</summary>
          <ul role="list">
            {state.outcome.changed.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </details>
      )}
      {(state.outcome.failures ?? 0) > 0 && (
        <p className="proof-note" data-tone="warn">
          {format(c.failures, { count: state.outcome.failures ?? 0 })}
        </p>
      )}
      {!nothing && state.changes !== null && <p className="proof-small">{c.laterNote}</p>}

      <footer className="proof-actions">
        {!nothing && (
          <button type="button" className="tool-secondary-action" onClick={() => void onSave()}>
            {c.save}
          </button>
        )}
        <button type="button" className="tool-primary-action" onClick={onClose} ref={done}>
          {c.done}
        </button>
      </footer>
    </div>
  );
}
