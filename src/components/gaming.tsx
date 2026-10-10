import { ToolHeader, ToolStatus } from "./tool-section";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { format, Strings } from "../i18n";
import { friendlyError, arcPath, GAUGE_C, GAUGE_R, GAUGE_START, GAUGE_SWEEP, polar } from "../lib";
import { CoreSteeringStatus, GameEntry, Toast } from "../types";
import { BoltIcon } from "./icons";
import { Badge, Toggle } from "./ui";

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
  const [steering, setSteering] = useState<CoreSteeringStatus | null>(null);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Separate from `refresh` on purpose: steering status reads the rollback
   *  journal, and a problem there must never hide the session switch. */
  function refreshSteering() {
    // A transient failure (the journal busy) keeps what is on screen; only a
    // first load that never succeeded leaves the row hidden.
    invoke<CoreSteeringStatus>("core_steering_status")
      .then(setSteering)
      .catch(() => {});
  }

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
    refreshSteering();
    const unlisten = listen<{ active: boolean; name: string | null }>(
      "game-session-changed",
      (event) => {
        setActiveGame(event.payload.active ? event.payload.name : null);
        // Steering is applied in the same watcher pass that sends this event.
        refreshSteering();
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

  async function toggleSteering() {
    if (!steering) return;
    if (!isPro && !steering.enabled) {
      onRequirePro();
      return;
    }
    await invoke("set_core_steering", { enabled: !steering.enabled });
    setSteering({ ...steering, enabled: !steering.enabled });
    // The watcher applies or restores on its next pass (every 3 s).
    window.setTimeout(refreshSteering, 4000);
  }

  const steeringText =
    steering?.kind === "vCache"
      ? format(s.gameSessions.steeringVcache, { count: steering.gameCpuSets })
      : steering?.kind === "hybrid"
        ? format(s.gameSessions.steeringHybrid, {
            game: steering.gameCpuSets,
            background: steering.backgroundCpuSets,
          })
        : s.gameSessions.steeringNone;

  // The watcher keeps steering new background processes during a session,
  // so the count is re-read while one is running.
  const steeringLive = Boolean(activeGame && steering?.enabled);
  useEffect(() => {
    if (!steeringLive) return;
    const timer = window.setInterval(refreshSteering, 5000);
    return () => window.clearInterval(timer);
  }, [steeringLive]);

  const steeringIdle = !enabled || games.length === 0;

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
      setError(friendlyError(reason, s));
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
            <Badge kind="pro">{s.badges.pro}</Badge>
          </>
        }
        description={s.gameSessions.subtitle}
        actions={
          <Toggle
            label={s.gameSessions.title}
            checked={enabled}
            busy={pending}
            s={s}
            onClick={() => void perform(toggleEnabled)}
          />
        }
      />
      {activeGame && (
        <ToolStatus tone="active">{format(s.gameSessions.active, { name: activeGame })}</ToolStatus>
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
      {steering && (
        <div className="tool-session-toolbar">
          <div className="min-w-0 flex-1">
            <strong className="text-[13px] text-ink">{s.gameSessions.steeringTitle}</strong>
            <p className="mt-0.5 text-[12px] text-ink-3">{steeringText}</p>
            {steering.enabled && steeringIdle && (
              <p className="mt-0.5 text-[12px] text-ink-3">
                {s.gameSessions.steeringNeedsSessions}
              </p>
            )}
          </div>
          <Toggle
            label={s.gameSessions.steeringTitle}
            checked={steering.enabled}
            busy={pending}
            s={s}
            disabled={!steering.enabled && (steering.kind === null || steeringIdle)}
            onClick={() => void perform(toggleSteering)}
          />
        </div>
      )}
      {activeGame && steering?.enabled && steering.steeredProcesses > 0 && (
        <ToolStatus tone="active">
          {steering.kind === "vCache"
            ? s.gameSessions.steeringActiveVcache
            : format(s.gameSessions.steeringActive, { count: steering.steeredProcesses })}
        </ToolStatus>
      )}
      {expanded && games.length > 0 && (
        <ul className="tool-session-list">
          {games.map((game) => (
            <li key={game.path}>
              <div>
                <strong>{game.name}</strong>
                <span title={game.path}>{game.path}</span>
                {/* Turbo Gaming still applies; only the game's own process
                    is never steered. */}
                {game.self_managed && (
                  <span className="text-ink-3" title={s.guard.selfManaged}>
                    {s.guard.selfManagedBadge}
                  </span>
                )}
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
  value = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
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
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
        fill="rgba(255,255,255,0.02)"
      />

      {/* Track */}
      <path
        d={arcPath(0, 1, GAUGE_R)}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
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
            stroke="rgba(255,255,255,0.32)"
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
            fill="rgba(148,163,184,0.75)"
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
  const [stage, setStage] = useState<string | null>(null);
  // Rated clock, shown as a fact under the gauge. Deliberately not a live
  // frequency: Windows reports a nominal constant on CPPC processors, so a
  // "current MHz" readout would be a fixed number pretending to be live.
  // See src-tauri/src/cpuclock.rs.
  const [ratedMhz, setRatedMhz] = useState<number | null>(null);
  // Live CPU load. This is what the needle rests on when idle, so the gauge is
  // a working instrument between activations rather than a dead dial.
  const [load, setLoad] = useState<number | null>(null);
  // The measured before/after ratio, kept until the next activation so the
  // user can still read it after the sweep settles.
  const [gain, setGain] = useState<number | null>(null);
  useEffect(() => {
    invoke<{ max_mhz: number } | null>("cpu_clock")
      .then((c) => setRatedMhz(c?.max_mhz ?? null))
      .catch(() => setRatedMhz(null));
  }, []);

  // The dial reports measured load, including during activation.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      invoke<{ cpu_usage: number }>("system_stats")
        .then((st) => {
          if (!cancelled)
            setLoad(
              Number.isFinite(st.cpu_usage) ? Math.max(0, Math.min(100, st.cpu_usage)) : null,
            );
        })
        .catch(() => {
          if (!cancelled) setLoad(null);
        });
    };
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  async function toggleTurbo() {
    if (busy) return;
    setBusy(true);
    setGain(null);
    const engaging = !applied;
    try {
      let before: { score: number } | null = null;
      if (engaging) {
        setStage(s.turboBoost.stageMeasuringBefore);
        before = await invoke<{ score: number }>("cpu_benchmark", { budgetMs: 900 }).catch(
          () => null,
        );
      }
      setStage(engaging ? s.turboBoost.stageApplying : s.turboBoost.deactivating);
      await invoke(engaging ? "apply_tweak" : "rollback_tweak", { id: "turbo_boost" });
      if (engaging) {
        setStage(s.turboBoost.stageMeasuringAfter);
        const after = await invoke<{ score: number }>("cpu_benchmark", { budgetMs: 900 }).catch(
          () => null,
        );
        setGain(
          before &&
            after &&
            Number.isFinite(before.score) &&
            Number.isFinite(after.score) &&
            before.score > 0 &&
            after.score > 0
            ? after.score / before.score
            : null,
        );
      }
      pushToast(
        "success",
        format(engaging ? s.toasts.applied : s.toasts.rolledBack, { name: s.turboBoost.title }),
      );
      await onChanged();
    } catch (error) {
      pushToast("error", String(error));
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
  // This short workload comparison cannot establish the CPU's maximum speed.
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
        actions={
          <span className="tool-boost-state" data-active={applied}>
            {applied ? s.toggle.on : s.toggle.off}
          </span>
        }
      />
      <div className="tool-boost-layout">
        <div className="tool-boost-instrument">
          <div className="relative grid place-items-center">
            {applied && !busy && (
              <span className="absolute h-32 w-32 rounded-full bg-orange-500/15 blur-2xl" />
            )}
            <TurboGauge value={(load ?? 0) / 100} engaged={applied || busy} />
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
              {load === null ? "—" : Math.round(load)}
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
          <p className="tool-boost-cadence">{s.turboBoost.loadCadence}</p>
        </div>
        <div className="tool-boost-summary">
          <p className="text-xs text-ink-3 mb-3">{s.turboBoost.loadHelp}</p>
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
            {busy ? (
              <span className="scan-spinner" aria-hidden="true" />
            ) : (
              <BoltIcon className="h-4 w-4" />
            )}
            {busy ? stage : applied ? s.turboBoost.stopLabel : s.turboBoost.startLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
