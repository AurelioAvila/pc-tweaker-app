import { ToolHeader, ToolStatus } from "./tool-section";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { format, Strings } from "../i18n";
import { formatBytes, arcPath, GAUGE_C, GAUGE_R, GAUGE_START, GAUGE_SWEEP, polar } from "../lib";
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
  /** RAM the working-set trim handed back when the session started. Zero is a
   *  real answer on a machine that was already tidy, so it reads as "boost
   *  active" without a number rather than as "0 B freed". */
  const [freedBytes, setFreedBytes] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [e, list] = await Promise.all([
      invoke<boolean>("game_sessions_enabled"),
      invoke<GameEntry[]>("list_game_sessions"),
    ]);
    setEnabled(e);
    setGames(list);
  }

  useEffect(() => {
    refresh().catch((reason: unknown) => setError(String(reason)));
    const unlisten = listen<{ active: boolean; name: string | null; freed_bytes: number }>(
      "game-session-changed",
      (event) => {
        setActiveGame(event.payload.active ? event.payload.name : null);
        setFreedBytes(event.payload.active ? event.payload.freed_bytes : 0);
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function toggleEnabled() {
    if (!isPro && !enabled) {
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
      filters: [{ name: "Windows executable", extensions: ["exe"] }],
    });
    if (!path || Array.isArray(path)) return;
    await invoke("add_game_session", { path });
    await refresh();
  }

  async function removeGame(path: string) {
    await invoke("remove_game_session", { path });
    await refresh();
  }

  async function perform(operation: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await operation();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="tool-panel tool-session-panel" aria-busy={pending}>
      <ToolHeader
        title={
          <>
            {s.gameSessions.title}
            <span className="tool-pro-tag">PRO</span>
          </>
        }
        description={s.gameSessions.subtitle}
        actions={
          <button
            type="button"
            role="switch"
            aria-label={s.gameSessions.title}
            aria-checked={enabled}
            disabled={pending}
            onClick={() => void perform(toggleEnabled)}
            className="tool-session-switch"
            data-enabled={enabled}
          >
            <span />
          </button>
        }
      />
      {activeGame && (
        <ToolStatus tone="active">
          {freedBytes > 0
            ? format(s.gameSessions.activeFreed, {
                name: activeGame,
                freed: formatBytes(freedBytes),
              })
            : format(s.gameSessions.active, { name: activeGame })}
        </ToolStatus>
      )}
      <div className="tool-session-toolbar">
        <button
          type="button"
          className="tool-disclosure-button"
          aria-expanded={expanded && games.length > 0}
          disabled={games.length === 0}
          onClick={() => setExpanded((value) => !value)}
        >
          {format(s.gameSessions.gamesCount, { count: games.length })}
          {games.length > 0 && <span aria-hidden="true">{expanded ? "−" : "+"}</span>}
        </button>
        <button
          type="button"
          className="tool-secondary-action"
          disabled={pending}
          onClick={() => void perform(addGame)}
        >
          {s.gameSessions.addGame}
        </button>
      </div>
      {expanded && games.length > 0 && (
        <ul className="tool-session-list">
          {games.map((game) => (
            <li key={game.path}>
              <div>
                <strong>{game.name}</strong>
                <span title={game.path}>{game.path}</span>
              </div>
              <button
                type="button"
                className="tool-icon-action"
                disabled={pending}
                aria-label={s.search.clear + ": " + game.name}
                onClick={() => void perform(() => removeGame(game.path))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <ToolStatus tone="error">{error}</ToolStatus>}
    </section>
  );
}

export function TurboGauge({ value, engaged }: { value: number; engaged: boolean }) {
  // The last fifth is the "redline" — the part boost mode actually unlocks.
  const REDLINE = 0.8;
  const angle = GAUGE_START + GAUGE_SWEEP * value;
  // A tapered needle with a counterweight tail, like a real rev counter's,
  // instead of a uniform line from the hub.
  const tip = polar(angle, GAUGE_R - 14);
  const baseA = polar(angle + 90, 3);
  const baseB = polar(angle - 90, 3);
  const tail = polar(angle + 180, 13);

  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40">
      <defs>
        <linearGradient id="turbo-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="55%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <radialGradient id="turbo-hub">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
      </defs>

      {/* Bezel: a full hairline circle behind the dial gives it the depth of
          an instrument face rather than a floating arc. */}
      <circle
        cx={GAUGE_C}
        cy={GAUGE_C}
        r={GAUGE_R + 8}
        stroke={engaged ? "rgba(251,146,60,0.55)" : "rgba(255,255,255,0.06)"}
        strokeWidth={engaged ? 1.5 : 1}
        fill={engaged ? "rgba(251,146,60,0.05)" : "rgba(255,255,255,0.02)"}
        style={{
          filter: engaged ? "drop-shadow(0 0 10px rgba(251,146,60,0.35))" : "none",
          transition: "all 500ms ease-out",
        }}
      />

      {/* Track */}
      <path
        d={arcPath(0, 1, GAUGE_R)}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      {/* Redline zone. Dim while the ceiling is capped, lit once boost mode is
          Aggressive and the processor floor is pinned — this band is precisely
          what the tweak unlocks, so lighting it is a statement about the
          setting, not about the current load. The needle is left alone: it
          goes on reporting real utilisation. */}
      <path
        d={arcPath(REDLINE, 1, GAUGE_R)}
        stroke={engaged ? "rgba(251,146,60,0.95)" : "rgba(239,68,68,0.35)"}
        strokeWidth={engaged ? 8.5 : 7}
        fill="none"
        strokeLinecap="round"
        style={{
          filter: engaged ? "drop-shadow(0 0 7px rgba(251,146,60,0.8))" : "none",
          transition: "all 500ms ease-out",
        }}
      />
      {/* Outer headroom ring, drawn only when engaged: the span of the dial
          the processor is now permitted to reach and hold. */}
      {engaged && (
        <path
          d={arcPath(0, 1, GAUGE_R + 8)}
          stroke="url(#turbo-fill)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
        />
      )}

      {/* Tick marks */}
      {Array.from({ length: 21 }, (_, i) => {
        const f = i / 20;
        const a = GAUGE_START + GAUGE_SWEEP * f;
        const major = i % 5 === 0;
        const outer = polar(a, GAUGE_R - 7);
        const inner = polar(a, GAUGE_R - (major ? 16 : 11));
        return (
          <line
            key={i}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke={f >= REDLINE ? "rgba(248,113,113,0.8)" : "rgba(255,255,255,0.32)"}
            strokeWidth={major ? 2 : 1}
            strokeLinecap="round"
          />
        );
      })}

      {/* Dial numerals at the quarter marks, so the sweep reads as a scale */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const p = polar(GAUGE_START + GAUGE_SWEEP * f, GAUGE_R - 25);
        return (
          <text
            key={f}
            x={p.x}
            y={p.y + 3}
            textAnchor="middle"
            fontSize="8"
            fontWeight="700"
            fill={f >= REDLINE ? "rgba(248,113,113,0.8)" : "rgba(148,163,184,0.75)"}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {Math.round(f * 100)}
          </text>
        );
      })}

      {/* Filled portion: a soft wide pass underneath for glow, a crisp pass on
          top — reads as light in the channel instead of a flat stroke. */}
      {value > 0.002 && (
        <>
          <path
            d={arcPath(0, value, GAUGE_R)}
            stroke="url(#turbo-fill)"
            strokeWidth="11"
            fill="none"
            strokeLinecap="round"
            opacity={engaged ? 0.4 : 0.18}
            style={{ filter: "blur(4px)" }}
          />
          <path
            d={arcPath(0, value, GAUGE_R)}
            stroke="url(#turbo-fill)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Needle */}
      <polygon
        points={`${tip.x},${tip.y} ${baseA.x},${baseA.y} ${tail.x},${tail.y} ${baseB.x},${baseB.y}`}
        fill={engaged ? "#fb923c" : "#cbd5e1"}
        style={{ filter: engaged ? "drop-shadow(0 0 4px rgba(251,146,60,0.7))" : "none" }}
      />
      <circle
        cx={GAUGE_C}
        cy={GAUGE_C}
        r="7.5"
        fill="url(#turbo-hub)"
        stroke={engaged ? "#fb923c" : "#64748b"}
        strokeWidth="2"
      />
      <circle cx={GAUGE_C} cy={GAUGE_C} r="2" fill={engaged ? "#fbbf24" : "#94a3b8"} />
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
    <div className="tool-panel tool-boost-panel" aria-busy={busy}>
      <ToolHeader
        title={s.turboBoost.title}
        description={s.turboBoost.subtitle}
        icon={<BoltIcon className="h-5 w-5" />}
      />
      <div className="tool-boost-layout">
        <div className="tool-boost-instrument">
          <div className="relative grid place-items-center">
            {applied && !busy && (
              <span className="absolute h-32 w-32 rounded-full bg-orange-500/15 blur-2xl" />
            )}
            <TurboGauge value={needle} engaged={applied || busy} />
          </div>

          {/* The readout used to sit inside the dial's open bottom, the way a rev
          counter carries its gear number. On this dial it could not: the arc
          closes at roughly the same height the text needed, so the label was
          drawn over the coloured band and became unreadable, and the needle —
          which sweeps down to the lower left at low load — crossed straight
          through the digits. Below the dial there is nothing to collide with,
          at any label length in any of the six languages. */}
          <div className="pointer-events-none mt-2 flex items-baseline justify-center gap-2">
            <span
              className={`font-black tabular-nums leading-none transition-colors ${
                applied || busy ? "text-orange-300" : "text-ink-3"
              }`}
              style={{ fontSize: 26 }}
            >
              {Math.round(needle * 100)}
              <span className="text-[13px]">%</span>
            </span>
            {/* Labelled, because an unlabelled figure under a dial called Turbo
            Boost reads as the feature's own output — and this one is live CPU
            load, which the tweak does not change and should not. Naming it is
            what stops an idle 2% looking like a failure. Set beside the number
            rather than under it: the card already stacks the gain readout and
            the clock line below this, and a fourth centred row made the whole
            lower half read as a list of unrelated captions. */}
            <span className="type-label text-ink-3 text-[9px] tracking-[0.18em]">
              {s.turboBoost.loadLabel}
            </span>
          </div>
        </div>
        <div className="tool-boost-summary">
          <p
            role="status"
            aria-live="polite"
            className={`tool-boost-readout mt-1 text-left text-[12.5px] font-semibold transition-colors ${
              busy
                ? "text-orange-300"
                : gain !== null
                  ? "text-emerald-300"
                  : applied
                    ? "text-orange-300/80"
                    : "text-ink-3"
            }`}
          >
            {readout}
          </p>
          {!busy && ratedMhz !== null && (
            <p className="tool-boost-clock text-[12px] text-ink-3">
              {(ratedMhz / 1000).toFixed(2)} GHz ·{" "}
              {applied ? s.turboBoost.modeAggressive : s.turboBoost.modeDefault}
            </p>
          )}

          <button
            onClick={toggleTurbo}
            disabled={busy}
            /* Both states carry the same gold treatment. STOP used to fall back to
           a flat grey surface, which read as a disabled control rather than
           the live "this is running, press to end it" action it actually is —
           the one moment the panel most needs to look engaged was the one
           moment it looked switched off. The label and the gauge already
           carry the state, so the button does not need to dim to say it. */
            className="tool-primary-action mt-4 flex items-center gap-2"
          >
            <BoltIcon className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} />
            {busy ? "···" : applied ? s.turboBoost.stopLabel : s.turboBoost.startLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
