import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { format, type Lang, Strings } from "../i18n";
import type { trialEntry } from "../trial";
import { CrownIcon, GemIcon } from "./icons";
import { trialBadgeText } from "./pricing-copy";
import { TRIAL_COPY } from "./trial-copy";

/**
 * The window's own title bar.
 *
 * The window is frameless (`decorations: false`), so this component *is* the
 * chrome: it carries the drag region, the system buttons, and the one piece
 * of status worth seeing before anything else is clicked.
 *
 * Everything shown here is measured, never asserted. The bar says how many
 * optimisations are actually applied and what the machine is doing right now;
 * it does not print a reassuring word like "Optimised", which would be a
 * verdict this app is in no position to give about someone else's PC.
 */

function MinimizeGlyph() {
  return (
    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
      <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function MaximizeGlyph({ maximized }: { maximized: boolean }) {
  return (
    <svg viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5" aria-hidden="true">
      {maximized ? (
        <>
          <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
          <path d="M2.5 2.5v-2h7v7h-2" stroke="currentColor" strokeWidth="1" />
        </>
      ) : (
        <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
      )}
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
      <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

/** A live readout: label, value, and a hairline bar showing the same number.
 *  The bar is there so a glance is enough; the number is there so the glance
 *  can be checked. */
function Meter({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="hidden items-center gap-2 md:flex">
      <span className="type-label !text-[9.5px] !text-ink-3">{label}</span>
      <span className="bg-line-2 relative h-[3px] w-12 overflow-hidden rounded-full">
        <span
          className="bg-accent absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </span>
      <span className="type-data w-8 text-[11px] font-semibold text-ink-2">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

/** The free trial in the main window (owner, 23 Oct 2026): offered ("Start
 *  3-day free trial") or counted down ("Trial — 2 days left"); null for paying
 *  accounts and for anyone who cannot start one. It sits in the title bar, on
 *  every screen, where a translated label never pushes the menu out of view. */
export type TitleTrial = { kind: "offer" | "running"; label: string } | null;

export function titleTrial(
  lang: Lang,
  entry: ReturnType<typeof trialEntry>,
  now: number,
): TitleTrial {
  if (!entry) return null;
  return entry.kind === "offer"
    ? { kind: "offer", label: format(TRIAL_COPY[lang].start, { days: entry.days }) }
    : { kind: "running", label: trialBadgeText(lang, entry.endsAt, now) };
}

/** Opens Plans & pricing, where the trial states its price, first charge and
 *  how to cancel before anything opens Stripe. */
export function TitleTrialButton({ trial, onOpen }: { trial: TitleTrial; onOpen: () => void }) {
  if (!trial) return null;
  const Icon = trial.kind === "offer" ? GemIcon : CrownIcon;
  return (
    <button type="button" onClick={onOpen} className={`titlebar-trial is-${trial.kind}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{trial.label}</span>
    </button>
  );
}

export function TitleBar({
  s,
  appliedCount,
  totalCount,
  cpuPct,
  ramPct,
  trial = null,
  onOpenPlans,
}: {
  s: Strings;
  trial?: TitleTrial;
  onOpenPlans?: () => void;
  appliedCount: number;
  totalCount: number;
  /** `null` until the first sample lands — an unmeasured meter shows nothing
   *  rather than a zero that would read as "idle". */
  cpuPct: number | null;
  ramPct: number | null;
}) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const w = getCurrentWindow();
    let alive = true;
    const sync = () => {
      w.isMaximized()
        .then((v) => {
          if (alive) setMaximized(v);
        })
        .catch(() => {});
    };
    sync();
    const unlisten = w.onResized(sync);
    return () => {
      alive = false;
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);

  const win = getCurrentWindow();
  const anyApplied = appliedCount > 0;

  return (
    <header className="titlebar sticky top-0 z-40 flex shrink-0 items-center gap-3 pl-4">
      {/* The drag region is the whole empty middle, so the bar behaves like a
          real title bar rather than a strip with one draggable spot. */}
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-3">
        <img
          src="/logo-mark.png"
          alt=""
          data-tauri-drag-region
          className="h-[18px] w-[18px] shrink-0 rounded-[5px]"
        />
        <span
          data-tauri-drag-region
          className="shrink-0 text-[12.5px] font-semibold tracking-tight text-ink"
        >
          {s.appName}
        </span>

        <span data-tauri-drag-region className="bg-line-2 h-3.5 w-px shrink-0" />

        <span
          data-tauri-drag-region
          className={`flex shrink-0 items-center gap-2 ${anyApplied ? "text-accent" : "text-ink-3"}`}
        >
          <span className="led" />
          <span className="type-data whitespace-nowrap text-[11.5px] font-medium text-ink-2">
            {format(s.titlebar.applied, { applied: appliedCount, total: totalCount })}
          </span>
        </span>

        <div data-tauri-drag-region className="ml-auto flex items-center gap-4 pr-3">
          <TitleTrialButton trial={trial} onOpen={() => onOpenPlans?.()} />
          {cpuPct !== null && <Meter label={s.titlebar.cpu} pct={cpuPct} />}
          {ramPct !== null && <Meter label={s.titlebar.ram} pct={ramPct} />}
        </div>
      </div>

      <div className="flex shrink-0 items-stretch">
        <button
          type="button"
          aria-label={s.titlebar.minimize}
          onClick={() => void win.minimize()}
          className="winbtn"
        >
          <MinimizeGlyph />
        </button>
        <button
          type="button"
          aria-label={maximized ? s.titlebar.restore : s.titlebar.maximize}
          onClick={() => void win.toggleMaximize()}
          className="winbtn"
        >
          <MaximizeGlyph maximized={maximized} />
        </button>
        <button
          type="button"
          aria-label={s.titlebar.close}
          onClick={() => void win.close()}
          className="winbtn winbtn-close"
        >
          <CloseGlyph />
        </button>
      </div>
    </header>
  );
}
