/**
 * The in-game HUD.
 *
 * Runs in its own transparent, click-through, always-on-top window so it can
 * sit over a fullscreen-borderless game without stealing input. Kept
 * deliberately small and dependency-free — it renders while a game is running,
 * so its own cost is part of the product.
 *
 * ## No frame time, on purpose
 *
 * Every overlay in this category leads with frametime and 1% lows. This one
 * does not, because it cannot measure them: a game's frame pacing is only
 * observable through the DXGI/D3D ETW providers (what PresentMon consumes),
 * which needs a privileged trace session this app does not run. Sampling GPU
 * load gives utilisation, not pacing, and timing this window's own repaints
 * measures the compositor's treatment of this window. Either would produce a
 * number that moves convincingly and means nothing, on a screen people would
 * use to decide what hardware to buy. See src-tauri/src/hud.rs.
 */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { Bottleneck, HudSnapshot } from "./types";
import "./App.css";

/** Sampling interval. Each tick spawns nvidia-smi for the GPU figures, so this
 *  is paced for a status panel rather than pretending to be an instrument. */
const POLL_MS = 1000;

/** Above this a part is reported as saturated, matching hud.rs. */
const HOT_PCT = 85;

function barColour(pct: number): string {
  if (pct >= HOT_PCT) return "#f87171";
  if (pct >= 60) return "#fbbf24";
  return "#34d399";
}

function Metric({ label, value, pct }: { label: string; value: string; pct: number | null }) {
  return (
    <div style={{ minWidth: 64 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            color: pct === null ? "rgba(255,255,255,0.4)" : "#fff",
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          marginTop: 3,
          height: 3,
          borderRadius: 999,
          background: "rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}
      >
        {pct !== null && (
          <div
            style={{
              height: "100%",
              width: `${String(Math.max(0, Math.min(100, pct)))}%`,
              background: barColour(pct),
              borderRadius: 999,
              transition: "width 400ms ease-out",
            }}
          />
        )}
      </div>
    </div>
  );
}

/** The bottleneck verdict, with "balanced" and "idle" deliberately neutral —
 *  neither is a fault, and colouring them like one would push people toward
 *  hardware that would not help. */
function BottleneckChip({ value }: { value: Bottleneck }) {
  const style: Record<Bottleneck, { text: string; colour: string }> = {
    cpu: { text: "CPU BOUND", colour: "#fbbf24" },
    gpu: { text: "GPU BOUND", colour: "#38bdf8" },
    balanced: { text: "BALANCED", colour: "rgba(255,255,255,0.55)" },
    idle: { text: "IDLE", colour: "rgba(255,255,255,0.3)" },
  };
  const v = style[value];
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 900,
        letterSpacing: "0.14em",
        color: v.colour,
        border: `1px solid ${v.colour}`,
        borderRadius: 999,
        padding: "2px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {v.text}
    </span>
  );
}

function Hud() {
  const [snap, setSnap] = useState<HudSnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const s = await invoke<HudSnapshot>("hud_snapshot");
        if (alive) setSnap(s);
      } catch {
        // A failed sample is not worth surfacing on an overlay drawn over a
        // game: the panel simply keeps the last reading until the next tick.
      }
      if (alive) timer = window.setTimeout(() => void tick(), POLL_MS);
    };
    void tick();

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!snap) return null;

  const ramPct = snap.ram_total_mb > 0 ? (snap.ram_used_mb / snap.ram_total_mb) * 100 : null;
  const vramPct =
    snap.vram_total_mb && snap.vram_used_mb !== null && snap.vram_total_mb > 0
      ? (snap.vram_used_mb / snap.vram_total_mb) * 100
      : null;

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        background: "rgba(9,12,20,0.72)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        padding: "9px 12px",
        display: "inline-flex",
        flexDirection: "column",
        gap: 7,
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            maxWidth: 150,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {snap.foreground?.name ?? "—"}
        </span>
        {snap.foreground && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(255,255,255,0.45)",
              whiteSpace: "nowrap",
            }}
          >
            {snap.foreground.priority.toUpperCase()}
          </span>
        )}
        <BottleneckChip value={snap.bottleneck} />
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        <Metric label="CPU" value={`${String(Math.round(snap.cpu_pct))}%`} pct={snap.cpu_pct} />
        <Metric
          label="GPU"
          value={snap.gpu_pct === null ? "—" : `${String(Math.round(snap.gpu_pct))}%`}
          pct={snap.gpu_pct}
        />
        <Metric
          label="TEMP"
          value={snap.gpu_temp_c === null ? "—" : `${String(Math.round(snap.gpu_temp_c))}°`}
          pct={snap.gpu_temp_c}
        />
        <Metric
          label="RAM"
          value={`${String(Math.round(snap.ram_used_mb / 1024))}G`}
          pct={ramPct}
        />
        <Metric
          label="VRAM"
          value={
            snap.vram_used_mb === null ? "—" : `${String(Math.round(snap.vram_used_mb / 1024))}G`
          }
          pct={vramPct}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById("hud-root") as HTMLElement).render(
  <StrictMode>
    <Hud />
  </StrictMode>,
);
