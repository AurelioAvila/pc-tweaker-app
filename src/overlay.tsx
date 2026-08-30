/**
 * The in-game HUD.
 *
 * Runs in its own transparent, always-on-top window so it can sit over a
 * fullscreen-borderless game. It is draggable by default and becomes
 * click-through on request, from the card that opened it: created
 * click-through it could never be placed, because a click aimed at it went
 * straight through to whatever was behind. Kept
 * deliberately small and dependency-free — it renders while a game is running,
 * so its own cost is part of the product.
 *
 * ## Frame rate
 *
 * Shown only when the frame counter is running and the foreground process is
 * actually presenting. It is counted from the DXGI present events — the
 * source PresentMon reads — rather than estimated from GPU load or from this
 * window's own repaints, either of which would move convincingly and mean
 * nothing on a screen people use to decide what hardware to buy. When there
 * is no reading the metric is absent rather than zero: a game that is loading
 * has no frame rate, and zero would be a claim about it.
 *
 * See src-tauri/src/fps.rs.
 */
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { Bottleneck, HudSnapshot } from "./types";
// Deliberately NOT App.css. That stylesheet ends with
// `html, body, #root { background-color: var(--bg-app) }`, which loads after
// overlay.html's inline `background: transparent` and wins the cascade — so
// the whole 430x96 window painted itself the app's dark violet, and the
// rounded panel sat inside a solid rectangle instead of floating over the
// game. The overlay styles every element inline and uses no class from it,
// so the import was only ever costing it a background it did not want and a
// stylesheet it did not read.
//
// The font is imported directly for the same reason: it lives in main.tsx,
// which is the main window's entry, so this window was falling back to the
// system UI face while asking for Inter.
import "@fontsource-variable/inter";

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

/** "1/12G", or an em dash when the card did not report it. Rounded to whole
 *  gigabytes: a decimal place here is precision nobody reads mid-game, and it
 *  would cost width the panel has better uses for. */
function memory(usedMb: number | null, totalMb: number | null): string {
  if (usedMb === null) return "—";
  const used = Math.round(usedMb / 1024);
  if (totalMb === null || totalMb <= 0) return `${String(used)}G`;
  return `${String(used)}/${String(Math.round(totalMb / 1024))}G`;
}

function Metric({
  label,
  value,
  pct,
  compact,
  reserve = 30,
  bar = true,
}: {
  label: string;
  value: string;
  pct: number | null;
  compact: boolean;
  /** Width held for the value in compact mode. See the note on the span. */
  reserve?: number;
  /** Whether the value is a proportion of something. Frame rate is not: it
   *  has no ceiling to fill, so an always-empty track under it would read as
   *  a reading that failed rather than as a quantity with no maximum. */
  bar?: boolean;
}) {
  // Compact drops the bar entirely rather than shrinking it. A 2px bar in a
  // 38px window is decoration, not a reading, and the number it sits under
  // already says the same thing more precisely.
  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            // Wide enough for the longest reading this metric produces, and
            // right-aligned inside it. Without the reserve the panel measured
            // a pixel narrower at 9% than at 10%, and since the window now
            // follows that measurement it would have twitched once a second
            // while a game was running.
            minWidth: reserve,
            textAlign: "right",
            color: pct === null ? "rgba(255,255,255,0.35)" : pct >= HOT_PCT ? "#fca5a5" : "#fff",
          }}
        >
          {value}
        </span>
      </div>
    );
  }

  return (
    <div style={{ minWidth: 62 }}>
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
      {bar && (
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
      )}
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
  const [compact, setCompact] = useState(false);
  const observer = useRef<ResizeObserver | null>(null);
  // The window follows the panel, not the other way round.
  //
  // It used to be the other way round: hud_window.rs held a width per mode and
  // the panel stretched to fill it. Compact was 286px, which fitted four
  // metrics and cut the fifth in half — "VRAM 1G" rendered as "VRAM 1" against
  // the panel's right edge. Any constant would have had the same problem
  // eventually, because the content is not constant: the readings change
  // width, a frame counter appears and disappears, and a translated label or a
  // longer process name changes it more. Measuring is the only version of this
  // that cannot be wrong.
  //
  // Attached through a callback ref rather than a mount effect. The panel does
  // not exist until the first snapshot arrives — before that this component
  // renders nothing at all — so an effect with an empty dependency list found
  // a null ref, returned, and never observed anything. That is precisely how
  // the clipping came back the moment the readings grew wider.
  const observePanel = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;

    let applied = "";
    const fit = () => {
      const rect = node.getBoundingClientRect();
      const w = Math.ceil(rect.width);
      const h = Math.ceil(rect.height);
      // A zero measurement means the panel is not laid out yet; resizing the
      // window to nothing would leave it unrecoverable.
      if (w < 1 || h < 1) return;
      const key = `${String(w)}x${String(h)}`;
      if (key === applied) return;
      applied = key;
      void getCurrentWindow()
        .setSize(new LogicalSize(w, h))
        .catch(() => {
          // The panel is still readable at whatever size the window already
          // is; a failed resize is not worth interrupting a game for.
        });
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(node);
    observer.current = ro;
  }, []);

  useEffect(() => {
    let alive = true;
    void invoke<boolean>("hud_is_compact")
      .then((v) => {
        if (alive) setCompact(v);
      })
      .catch(() => {
        // Normal size is the safe answer: it fits whatever the window is.
      });
    const stop = listen<boolean>("hud-compact", (e) => {
      if (alive) setCompact(e.payload);
    });
    return () => {
      alive = false;
      void stop.then((off) => off());
    };
  }, []);

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

  // In the order they are read: what the frame is doing, then what is doing
  // it, then how hot and how full the machine is.
  const metrics = [
    // Only when it is real. A frame counter showing a dash where the number
    // should be is a worse overlay than one that simply has no frame counter
    // until it does.
    snap.fps && (
      <Metric
        key="fps"
        label="FPS"
        value={String(Math.round(snap.fps.fps))}
        pct={null}
        bar={false}
        compact={compact}
        reserve={34}
      />
    ),
    snap.fps?.low1_fps != null && (
      <Metric
        key="low"
        // "DROP" rather than the industry's "1% LOW". The standard label is
        // what Afterburner, FrameView, Adrenalin and PresentMon all print,
        // and it is what guides call it — but it names the statistic rather
        // than the thing, and someone who has not met the term reads a
        // percentage sign and expects a percentage. "DROP" says what the
        // number is for: this is where the frame rate goes when it goes. The
        // technical name is given in the card, so it stays possible to look
        // up. It is also two characters shorter, which the panel can use.
        label="DROP"
        value={String(Math.round(snap.fps.low1_fps))}
        pct={null}
        bar={false}
        compact={compact}
        reserve={34}
      />
    ),
    <Metric
      key="cpu"
      label="CPU"
      value={`${String(Math.round(snap.cpu_pct))}%`}
      pct={snap.cpu_pct}
      compact={compact}
    />,
    <Metric
      key="gpu"
      label="GPU"
      value={snap.gpu_pct === null ? "—" : `${String(Math.round(snap.gpu_pct))}%`}
      pct={snap.gpu_pct}
      compact={compact}
    />,
    <Metric
      key="temp"
      label="TEMP"
      value={snap.gpu_temp_c === null ? "—" : `${String(Math.round(snap.gpu_temp_c))}°`}
      pct={snap.gpu_temp_c}
      compact={compact}
    />,
    // Memory is shown as used-of-total. On its own "1G" of VRAM says nothing:
    // whether that is comfortable or nearly full depends entirely on the
    // card, and in compact mode there is no bar under it to imply the
    // proportion. The percentages above need no such help — a percentage
    // already carries its own denominator.
    <Metric
      key="ram"
      label="RAM"
      value={memory(snap.ram_used_mb, snap.ram_total_mb)}
      pct={ramPct}
      compact={compact}
      reserve={48}
    />,
    <Metric
      key="vram"
      label="VRAM"
      value={memory(snap.vram_used_mb, snap.vram_total_mb)}
      pct={vramPct}
      compact={compact}
      reserve={48}
    />,
  ].filter(Boolean);

  // Dealt into balanced rows rather than filled to a maximum: seven metrics
  // split four-and-three, six split three-and-three. Filling would give six a
  // row of four above a row of two, which is the lopsided shape this is meant
  // to avoid.
  const rows =
    metrics.length > 5
      ? [
          metrics.slice(0, Math.ceil(metrics.length / 2)),
          metrics.slice(Math.ceil(metrics.length / 2)),
        ]
      : [metrics];

  return (
    <div
      ref={observePanel}
      // The whole panel is the drag handle. It has no title bar to grab and
      // no room for one, and every pixel of it is either a label or a bar —
      // nothing here responds to a click, so nothing is lost by making the
      // entire surface draggable.
      //
      // Done with startDragging rather than `data-tauri-drag-region`: that
      // attribute only applies to the element carrying it, and this panel is
      // filled edge to edge with child divs, so it left just the few pixels of
      // padding draggable and everything else inert. A mousedown handler on
      // the root catches the event as it bubbles up from whichever label or
      // bar was actually under the cursor.
      onMouseDown={(e) => {
        // Left button only: a right-click here should do nothing rather than
        // start a drag the user did not ask for.
        if (e.button !== 0) return;
        void getCurrentWindow().startDragging();
      }}
      style={{
        cursor: "move",
        // Otherwise a drag starting on a number selects the text instead of
        // moving the window.
        userSelect: "none",
        fontFamily: "Inter, system-ui, sans-serif",
        // Darker and less transparent than before: over a bright game frame
        // the old 0.72 let the scene through enough to make the numbers hard
        // to read, which is the one thing this panel exists to do.
        background: "rgba(7,9,15,0.82)",
        backdropFilter: "blur(14px)",
        // A hairline rather than a visible edge — the panel should read as
        // floating over the game, not as a window sitting on top of it.
        border: "1px solid rgba(255,255,255,0.07)",
        // No drop shadow. The panel fills the window exactly, so a shadow has
        // nowhere to fall: it is drawn around the rounded rectangle and then
        // cut off by the window's square edge. At each corner the two edges'
        // shadows overlap, which made the darkest part of the clipped halo a
        // small wedge between the panel's rounded corner and the window's
        // square one — the faint triangles the overlay was showing. The
        // translucent dark ground and the hairline border already do the work
        // of lifting it off the game.
        borderRadius: compact ? 9 : 12,
        // Compact used to carry no vertical padding at all, because the panel
        // stretched to the window's height and the height was a constant that
        // supplied the breathing room. Now that the window follows the panel,
        // the panel has to state it: without this it collapsed to the 18px of
        // its own text.
        padding: compact ? "9px 11px" : "9px 12px",
        display: "flex",
        flexDirection: compact ? "row" : "column",
        alignItems: compact ? "center" : undefined,
        gap: compact ? 13 : 7,
        // Sized by its contents, with the window then sized to match, so the
        // panel is the window and there is no dead margin around it — and
        // nothing can be clipped by a window that turned out too small.
        width: "max-content",
        boxSizing: "border-box",
        color: "#fff",
      }}
    >
      {!compact && (
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
      )}

      {/* Laid out in rows of at most four.
          One row of seven metrics stretched most of the way across the top of
          the screen, which is a poor shape for something meant to sit over a
          game. Splitting it two-and-five was worse: the eye reads a short row
          above a long one as a heading over a list, and these are all
          readings of the same kind. So the metrics are simply dealt into two
          balanced rows once there are more than five of them, and left on one
          row when there are not — which is how the panel looks with the frame
          counter off, exactly as it did before the counter existed. */}
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 5 : 7 }}>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: compact ? 13 : 14,
              alignItems: compact ? "baseline" : undefined,
            }}
          >
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("hud-root") as HTMLElement).render(
  <StrictMode>
    <Hud />
  </StrictMode>,
);
