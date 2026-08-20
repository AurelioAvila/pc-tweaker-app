import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { format, Strings } from "../i18n";
import { arcPath, GAUGE_C, GAUGE_R, GAUGE_START, GAUGE_SWEEP, polar } from "../lib";
import { GameEntry, Toast } from "../types";
import { BoltIcon } from "./icons";

export function GameSessionsPanel({
  s,
  isPro,
  onRequirePro,
}: {
  s: Strings;
  isPro: boolean;
  onRequirePro: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [games, setGames] = useState<GameEntry[]>([]);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function refresh() {
    const [e, list] = await Promise.all([
      invoke<boolean>("game_sessions_enabled"),
      invoke<GameEntry[]>("list_game_sessions"),
    ]);
    setEnabled(e);
    setGames(list);
  }

  useEffect(() => {
    refresh().catch(() => {});
    const unlisten = listen<{ active: boolean; name: string | null }>(
      "game-session-changed",
      (event) => {
        setActiveGame(event.payload.active ? event.payload.name : null);
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function toggleEnabled() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    const next = !enabled;
    await invoke("set_game_sessions_enabled", { enabled: next });
    setEnabled(next);
  }

  async function addGame() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    const path = await openFolderDialog({
      multiple: false,
      filters: [{ name: "Eseguibile", extensions: ["exe"] }],
    });
    if (!path || Array.isArray(path)) return;
    await invoke("add_game_session", { path });
    await refresh();
  }

  async function removeGame(path: string) {
    await invoke("remove_game_session", { path });
    await refresh();
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            {s.gameSessions.title}
            <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-2 py-0.5 text-[10px] font-bold text-amber-950">
              PRO
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {activeGame
              ? format(s.gameSessions.active, { name: activeGame })
              : s.gameSessions.subtitle}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggleEnabled}
          className={`relative inline-flex h-8 w-14 shrink-0 appearance-none items-center rounded-full border-0 p-0
            outline-none transition-colors duration-300 ease-out ${enabled ? "" : "bg-white/15"}`}
          style={enabled ? { backgroundColor: "var(--app-accent)" } : undefined}
        >
          <span
            className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${enabled ? "translate-x-6" : "translate-x-0"}`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-slate-400 hover:text-slate-200"
          >
            {format(s.gameSessions.gamesCount, { count: games.length })} {expanded ? "▲" : "▼"}
          </button>
          {expanded && (
            <div className="mt-2 flex flex-col gap-1.5">
              {games.map((g) => (
                <div
                  key={g.path}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs"
                >
                  <span className="truncate text-slate-300">{g.name}</span>
                  <button
                    onClick={() => removeGame(g.path)}
                    className="shrink-0 text-slate-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addGame}
                className="mt-1 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-white/30 hover:text-slate-200"
              >
                {s.gameSessions.addGame}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TurboGauge({ value, engaged }: { value: number; engaged: boolean }) {
  const needle = polar(GAUGE_START + GAUGE_SWEEP * value, GAUGE_R - 12);
  // The last fifth is the "redline" — the part boost mode actually unlocks.
  const REDLINE = 0.8;

  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40">
      <defs>
        <linearGradient id="turbo-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="55%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>

      {/* Track */}
      <path
        d={arcPath(0, 1, GAUGE_R)}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
      />
      {/* Redline zone, always visible so the goal of the sweep is legible */}
      <path
        d={arcPath(REDLINE, 1, GAUGE_R)}
        stroke="rgba(239,68,68,0.30)"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
      />

      {/* Tick marks */}
      {Array.from({ length: 11 }, (_, i) => {
        const f = i / 10;
        const a = GAUGE_START + GAUGE_SWEEP * f;
        const outer = polar(a, GAUGE_R - 8);
        const inner = polar(a, GAUGE_R - (i % 5 === 0 ? 17 : 13));
        return (
          <line
            key={i}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke={f >= REDLINE ? "rgba(248,113,113,0.75)" : "rgba(255,255,255,0.35)"}
            strokeWidth={i % 5 === 0 ? 2.2 : 1.2}
            strokeLinecap="round"
          />
        );
      })}

      {/* Filled portion */}
      {value > 0.002 && (
        <path
          d={arcPath(0, value, GAUGE_R)}
          stroke="url(#turbo-fill)"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          style={{ filter: engaged ? "drop-shadow(0 0 8px rgba(251,146,60,0.65))" : "none" }}
        />
      )}

      {/* Needle */}
      <line
        x1={GAUGE_C}
        y1={GAUGE_C}
        x2={needle.x}
        y2={needle.y}
        stroke={engaged ? "#fb923c" : "#cbd5e1"}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx={GAUGE_C}
        cy={GAUGE_C}
        r="7"
        fill="#0f172a"
        stroke={engaged ? "#fb923c" : "#64748b"}
        strokeWidth="2.5"
      />
    </svg>
  );
}

export function TurboBoostPanel({
  s,
  applied,
  onChanged,
  pushToast,
}: {
  s: Strings;
  applied: boolean;
  onChanged: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [needle, setNeedle] = useState(0);
  const [stage, setStage] = useState<string | null>(null);
  // Rated clock, shown as a fact under the gauge. Deliberately not a live
  // frequency: Windows reports a nominal constant on CPPC processors, so a
  // "current MHz" readout would be a fixed number pretending to be live.
  // See src-tauri/src/cpuclock.rs.
  const [ratedMhz, setRatedMhz] = useState<number | null>(null);
  // Live CPU load. This is what the needle rests on when idle, so the gauge is
  // a working instrument between activations rather than a dead dial.
  const [load, setLoad] = useState(0);
  // The measured before/after ratio, kept until the next activation so the
  // user can still read it after the sweep settles.
  const [gain, setGain] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  // The live needle value. `needle` state is only for rendering; reading it
  // inside an async sequence would capture whatever it was when the click
  // handler started, so every sweep after the first would jump back to that
  // stale value instead of continuing from where the last one stopped.
  const needleRef = useRef(0);

  const setNeedleValue = useCallback((v: number) => {
    needleRef.current = v;
    setNeedle(v);
  }, []);

  useEffect(() => {
    invoke<{ max_mhz: number } | null>("cpu_clock")
      .then((c) => setRatedMhz(c?.max_mhz ?? null))
      .catch(() => setRatedMhz(null));
  }, []);

  // Poll CPU load while the panel is on screen, and let the needle follow it
  // whenever an activation isn't driving it.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      invoke<{ cpu_usage: number }>("system_stats")
        .then((st) => {
          if (!cancelled) setLoad(Math.max(0, Math.min(100, st.cpu_usage)));
        })
        .catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Resting position: the live load, so the dial breathes with the machine.
  useEffect(() => {
    if (!busy) setNeedleValue(load / 100);
  }, [load, busy, setNeedleValue]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const stages = [s.turboBoost.stageReading, s.turboBoost.stageRaising, s.turboBoost.stageApplying];

  /**
   * Sweeps the needle to `to`, resolving when it lands.
   *
   * Driven by setTimeout rather than requestAnimationFrame on purpose:
   * browsers stop firing rAF entirely for a window that isn't being
   * composited. Since the whole activation sequence awaits these sweeps,
   * an rAF that never fires would leave the promise pending forever — the
   * button stuck disabled and the gauge frozen — if the user minimised the
   * window mid-activation. Timers keep firing (throttled) when hidden, so the
   * sequence always finishes even if it finishes without being watched.
   */
  function sweep(to: number, ms: number): Promise<void> {
    const from = needleRef.current;
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / ms);
        // Ease-out: quick off the line, settling into the target the way a rev
        // counter does rather than crawling linearly.
        const eased = 1 - Math.pow(1 - t, 3);
        setNeedleValue(from + (to - from) * eased);
        if (t < 1) timer.current = window.setTimeout(step, 16);
        else resolve();
      };
      step();
    });
  }

  async function toggleTurbo() {
    setBusy(true);
    const engaging = !applied;

    // Kick the real work off immediately; the animation runs alongside it
    // rather than delaying it.
    const work = engaging
      ? invoke("apply_tweak", { id: "turbo_boost" })
      : invoke("rollback_tweak", { id: "turbo_boost" });

    // Never let an unhandled rejection escape while the sweep is running.
    const settled = work.then(
      () => ({ ok: true as const }),
      (e) => ({ ok: false as const, error: e }),
    );

    try {
      if (engaging) {
        // Measure first, so the "after" number has something honest to be
        // compared against. Both runs use the same fixed workload on the same
        // machine minutes apart, which is the only comparison that means
        // anything — the absolute score is never shown.
        setStage(s.turboBoost.stageMeasuringBefore);
        const before = await invoke<{ score: number }>("cpu_benchmark", { budgetMs: 900 }).catch(
          () => null,
        );
        await sweep(0.3, 300);

        for (let i = 0; i < stages.length; i++) {
          setStage(stages[i]);
          await sweep(0.3 + ((i + 1) / stages.length) * 0.62, 340);
        }

        // The registry write has to have landed before the second run, or the
        // comparison measures nothing.
        // Deliberately not named `applied`: that shadowed the outer applied
        // state, and the fallback below then read the result *object* — always
        // truthy — so a failed activation pinned the needle at the redline
        // while showing an error, the exact opposite of what happened.
        const engaged = await settled;
        if (!engaged.ok) {
          setNeedleValue(applied ? 1 : 0);
          pushToast("error", String(engaged.error));
          return;
        }

        setStage(s.turboBoost.stageMeasuringAfter);
        const after = await invoke<{ score: number }>("cpu_benchmark", { budgetMs: 900 }).catch(
          () => null,
        );
        // No fabricated figure when either run failed: no number beats a
        // wrong one.
        setGain(before && after && before.score > 0 ? after.score / before.score : null);

        await sweep(1, 260);
        pushToast("success", format(s.toasts.applied, { name: s.turboBoost.title }));
        await onChanged();
        return;
      } else {
        setStage(s.turboBoost.deactivating);
        setGain(null);
        await sweep(0, 620);
      }

      const result = await settled;
      if (!result.ok) {
        // Fall back to whatever the machine is really in, so a failed apply
        // never leaves the gauge sitting at the redline.
        setNeedleValue(applied ? 1 : 0);
        pushToast("error", String(result.error));
        return;
      }

      // The redline flourish is a transition, not a resting state: the
      // effect above takes the needle back to real load once `busy` clears.
      pushToast(
        "success",
        format(engaging ? s.toasts.applied : s.toasts.rolledBack, { name: s.turboBoost.title }),
      );
      await onChanged();
    } finally {
      setStage(null);
      setBusy(false);
    }
  }

  // "Aggressive mode - 4.20 GHz" after "Default mode - 4.20 GHz" read as
  // nothing having changed, because the rated clock is a constant of the
  // silicon and never moves. What changed is the ceiling, so that is what the
  // readout names — and once measured, by how much it actually mattered.
  const ceiling = applied ? s.turboBoost.ceilingUnlocked : s.turboBoost.ceilingLocked;
  // Three bands rather than "gain / no gain". Reporting a measured 1.02x as
  // "no measurable gain" understated a real if small result and read as the
  // app admitting it did nothing; and when there genuinely is no headroom,
  // that is a fact about the processor — already running flat out — not a
  // failure of the tweak, so it is worded as such.
  const gainText =
    gain === null
      ? null
      : gain >= 1.03
        ? format(s.turboBoost.gainMeasured, { factor: gain.toFixed(2) })
        : gain >= 1.005
          ? format(s.turboBoost.gainSlight, { factor: gain.toFixed(2) })
          : s.turboBoost.gainAtCeiling;
  const readout = busy ? stage : (gainText ?? ceiling);

  return (
    <div className="mb-6 flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] p-8">
      <h2 className="text-lg font-semibold text-slate-100">{s.turboBoost.title}</h2>
      <p className="mt-1 max-w-xs text-center text-sm text-slate-400">{s.turboBoost.subtitle}</p>

      <div className="relative mt-6 grid place-items-center">
        {applied && !busy && (
          <span className="absolute h-32 w-32 rounded-full bg-orange-500/15 blur-2xl" />
        )}
        <TurboGauge value={needle} engaged={applied || busy} />
        {/* Percentage sits inside the gauge's open bottom, where a rev counter
            puts its gear readout. */}
        <span className="pointer-events-none absolute bottom-7 flex flex-col items-center">
          <span
            className={`font-black tabular-nums leading-none transition-colors ${
              applied || busy ? "text-orange-300" : "text-slate-500"
            }`}
            style={{ fontSize: 26 }}
          >
            {Math.round(needle * 100)}
            <span className="text-[13px]">%</span>
          </span>
        </span>
      </div>

      <p
        className={`mt-1 h-5 text-center text-[12.5px] font-semibold transition-colors ${
          busy
            ? "text-orange-300"
            : gain !== null
              ? "text-emerald-300"
              : applied
                ? "text-orange-300/80"
                : "text-slate-500"
        }`}
      >
        {readout}
      </p>
      {!busy && ratedMhz !== null && (
        <p className="text-center text-[11px] text-slate-500">
          {(ratedMhz / 1000).toFixed(2)} GHz ·{" "}
          {applied ? s.turboBoost.modeAggressive : s.turboBoost.modeDefault}
        </p>
      )}

      <button
        onClick={toggleTurbo}
        disabled={busy}
        className={`mt-4 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all disabled:cursor-wait ${
          applied
            ? "bg-white/10 text-slate-200 hover:bg-white/15"
            : "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 shadow-lg shadow-orange-500/25 hover:scale-[1.03]"
        }`}
      >
        <BoltIcon className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} />
        {busy ? "···" : applied ? s.turboBoost.stopLabel : s.turboBoost.startLabel}
      </button>
    </div>
  );
}
