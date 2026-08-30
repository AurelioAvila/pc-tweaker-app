import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { format, Strings } from "../i18n";
import { formatBytes } from "../lib";
import {
  DefragOutcome,
  DefragProgress,
  DriverAudit,
  PurgeResult,
  ShredResult,
  Toast,
} from "../types";
import { ProBadge, ShieldBadge } from "./ui";

/* ------------------------------------------------------------------ *
 * Secure Defragmentation
 * ------------------------------------------------------------------ */

/**
 * Disk optimisation with the operation chosen by media type and real progress.
 *
 * The percentage comes from `defrag`'s own output rather than from a timer, so
 * a bar that is moving means work is happening and a bar that has stopped
 * means it has actually stopped. Where Windows reports no percentage the bar
 * goes indeterminate instead of freezing at a stale number — see
 * securedefrag.rs.
 */
export function SecureDefragCard({
  s,
  drive,
  mediaType,
  isPro,
  onRequirePro,
  pushToast,
}: {
  s: Strings;
  drive: string;
  mediaType: string;
  isPro: boolean;
  onRequirePro: () => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DefragProgress | null>(null);
  const [outcome, setOutcome] = useState<DefragOutcome | null>(null);

  useEffect(() => {
    const unlisten = listen<DefragProgress>("secure-defrag-progress", (e) => {
      setProgress(e.payload);
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  // "retrim" on anything not confirmed to be a spinning disk. Stated before
  // the user presses the button, not after, so the label can never imply a
  // defragmentation that deliberately will not happen.
  const willDefrag = mediaType === "HDD";

  async function run() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    setRunning(true);
    setOutcome(null);
    setProgress(null);
    try {
      const result = await invoke<DefragOutcome>("secure_defrag", { drive });
      setOutcome(result);
      pushToast("success", result.summary);
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  const percent = progress?.percent ?? null;

  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-ink">{s.secureDefrag.title}</h3>
          <ShieldBadge label={s.badges.admin} />
          <ProBadge label={s.badges.pro} />
        </div>
        <span className="type-data rounded-full bg-surface-2 px-2.5 py-0.5 text-[11.5px] font-bold text-ink-2">
          {drive} · {mediaType}
        </span>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
        {willDefrag ? s.secureDefrag.willDefrag : s.secureDefrag.willRetrim}
      </p>

      {running && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] font-semibold text-ink-2">
              {/* The phase is named because on an SSD the two halves feel very
                  different: analysis is where the time goes, the retrim that
                  follows is over in seconds. Without a label the fast half
                  reads as the whole operation having been skipped. */}
              {progress?.phase === "analyze"
                ? s.secureDefrag.phaseAnalyze
                : s.secureDefrag.phaseOptimize}
              {" · "}
              {percent === null ? s.secureDefrag.working : `${String(percent)}%`}
            </span>
            {progress?.line && (
              <span className="truncate text-[11px] text-ink-3" title={progress.line}>
                {progress.line}
              </span>
            )}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            {percent === null ? (
              // Indeterminate: a sliding band, because pinning the bar at a
              // percentage Windows is not currently reporting would be a
              // number we made up.
              <div className="h-full w-1/3 animate-[defrag-sweep_1.4s_ease-in-out_infinite] rounded-full bg-accent" />
            ) : (
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${String(percent)}%` }}
              />
            )}
          </div>
        </div>
      )}

      {outcome && !running && (
        <div className="mt-3 rounded-xl bg-surface-2 p-3">
          <p className="text-[12.5px] font-semibold text-ink-2">
            {outcome.operation === "defrag" ? s.secureDefrag.doneDefrag : s.secureDefrag.doneRetrim}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-3">{outcome.summary}</p>

          {/* The analysis report, verbatim. On flash storage this is the part
              with the information in it — the optimisation is a retrim that
              only concerns free blocks, which is correct and is also why it
              finishes almost immediately. */}
          {outcome.analysis.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11.5px] font-semibold text-ink-2">
                {s.secureDefrag.analysisTitle}
              </summary>
              <div className="type-data mt-1.5 max-h-48 overflow-y-auto rounded-lg bg-black/20 p-2">
                {outcome.analysis.map((l, i) => (
                  <p key={i} className="text-[11px] leading-relaxed text-ink-3">
                    {l}
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <button
        onClick={() => void run()}
        disabled={running}
        className="mt-4 flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-[13px] font-bold text-on-accent transition hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:hover:translate-y-0 disabled:hover:brightness-100"
      >
        {running && (
          <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {running ? s.secureDefrag.running : s.secureDefrag.start}
      </button>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">{s.secureDefrag.note}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Zero-Trace: memory purge + secure shredder
 * ------------------------------------------------------------------ */

/**
 * The two Zero-Trace operations, in one card.
 *
 * Both carry their real limits in the copy rather than in a footnote nobody
 * reads: the purge does not touch the pagefile, and the shredder cannot
 * guarantee physical erasure on an SSD. See zerotrace.rs for why claiming
 * otherwise would be a promise the platform does not let this keep.
 */
export function ZeroTraceCard({
  s,
  isPro,
  onRequirePro,
  pushToast,
}: {
  s: Strings;
  isPro: boolean;
  onRequirePro: () => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [purging, setPurging] = useState(false);
  const [purge, setPurge] = useState<PurgeResult | null>(null);
  const [shredding, setShredding] = useState(false);
  const [shred, setShred] = useState<ShredResult | null>(null);

  async function runPurge() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    setPurging(true);
    setPurge(null);
    try {
      setPurge(await invoke<PurgeResult>("purge_standby_memory"));
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setPurging(false);
    }
  }

  async function runShred() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    const picked = await openFileDialog({ multiple: true });
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    if (paths.length === 0) return;

    setShredding(true);
    setShred(null);
    try {
      const result = await invoke<ShredResult>("shred_files", { paths });
      setShred(result);
      pushToast(
        "success",
        format(s.zeroTrace.shredDone, {
          count: result.shredded_count,
          size: formatBytes(result.bytes_overwritten),
        }),
      );
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setShredding(false);
    }
  }

  const freed = purge ? Math.max(0, purge.free_after_mb - purge.free_before_mb) : 0;

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface-1 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-ink">{s.zeroTrace.title}</h2>
        <ProBadge label={s.badges.pro} />
      </div>
      <p className="mt-1 text-sm leading-relaxed text-ink-3">{s.zeroTrace.subtitle}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {/* Memory purge */}
        <div className="rounded-xl border border-line-2 p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-bold text-ink">{s.zeroTrace.purgeTitle}</h3>
            <ShieldBadge label={s.badges.admin} />
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{s.zeroTrace.purgeBody}</p>

          {purge && (
            <p className="type-data mt-2 text-[12px] font-bold tabular-nums text-emerald-300">
              {format(s.zeroTrace.purgeResult, {
                freed: String(freed),
                after: String(purge.free_after_mb),
              })}
            </p>
          )}

          <button
            onClick={() => void runPurge()}
            disabled={purging}
            className="mt-3 flex items-center gap-2 rounded-lg border border-line-2 px-3.5 py-1.5 text-[12px] font-semibold text-ink-2 transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-wait"
          >
            {purging && (
              <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {purging ? s.zeroTrace.purging : s.zeroTrace.purgeButton}
          </button>
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-3">{s.zeroTrace.purgeLimit}</p>
        </div>

        {/* Shredder */}
        <div className="rounded-xl border border-line-2 p-4">
          <h3 className="text-[13px] font-bold text-ink">{s.zeroTrace.shredTitle}</h3>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{s.zeroTrace.shredBody}</p>

          {shred && (
            <p className="type-data mt-2 text-[12px] font-bold tabular-nums text-ink-2">
              {format(s.zeroTrace.shredSummary, {
                shredded: shred.shredded_count,
                skipped: shred.skipped_count,
              })}
            </p>
          )}
          {/* Shown only once a shredded file was actually on solid-state
              storage, so the caveat lands where it is true rather than as
              blanket small print. */}
          {shred?.touched_ssd && (
            <p className="mt-1.5 rounded-lg bg-amber-400/10 p-2 text-[10.5px] leading-relaxed text-amber-300">
              {s.zeroTrace.ssdCaveat}
            </p>
          )}

          <button
            onClick={() => void runShred()}
            disabled={shredding}
            className="mt-3 flex items-center gap-2 rounded-lg border border-rose-400/40 px-3.5 py-1.5 text-[12px] font-semibold text-rose-300 transition-colors hover:bg-rose-400/10 disabled:cursor-wait"
          >
            {shredding && (
              <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {shredding ? s.zeroTrace.shredding : s.zeroTrace.shredButton}
          </button>
          <p className="mt-2 text-[10.5px] font-semibold leading-relaxed text-rose-300/80">
            {s.zeroTrace.shredWarning}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Gaming HUD
 * ------------------------------------------------------------------ */

/**
 * The overlay's control panel.
 *
 * The HUD deliberately reports no frame time or frame rate. Reading a game's
 * frame pacing from outside the game means consuming the DXGI ETW providers
 * the way PresentMon does, which this app has no way to do — and a plausible
 * moving number labelled "frametime" would be worse than not having one. What
 * it does show is measured: see hud.rs.
 */
export function GamingHudCard({
  s,
  isPro,
  onRequirePro,
  pushToast,
}: {
  s: Strings;
  isPro: boolean;
  onRequirePro: () => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Locked means click-through: the overlay stops taking the mouse so a click
  // over it reaches the game. It starts unlocked because an overlay that
  // cannot be grabbed cannot be placed, and the click that tries to move it
  // lands on whatever is behind — on the desktop, that rearranges the icons.
  const [locked, setLocked] = useState(false);
  const [compact, setCompact] = useState(false);
  // The frame counter is a separate concern from the overlay: it can be
  // running with the panel hidden, and the panel is useful without it.
  const [measuring, setMeasuring] = useState(false);
  const [elevated, setElevated] = useState(false);
  const busy = useRef(false);

  // The capture survives a navigation away from this screen, so the card asks
  // what the state is rather than assuming it starts off.
  useEffect(() => {
    let alive = true;

    // Check if the HUD window is already open (e.g. from a previous session
    // when we navigate back to this screen)
    void invoke<boolean>("hud_is_open")
      .then(async (isOpen) => {
        if (!alive) return;
        setOpen(isOpen);
        if (isOpen) {
          try {
            const isCompact = await invoke<boolean>("hud_is_compact");
            if (alive) setCompact(isCompact);
          } catch {
            // The overlay is still known to be open even if its size could
            // not be read; falling back to the normal layout is the safe
            // guess, and the size button lets the user correct it.
          }
        }
      })
      .catch(() => {});

    void invoke<{ running: boolean; elevated: boolean }>("fps_status")
      .then((st) => {
        if (!alive) return;
        setMeasuring(st.running);
        setElevated(st.elevated);
      })
      .catch(() => {
        // Leaving both false hides the control and shows the requirement,
        // which is the safe reading of "we could not find out".
      });
    return () => {
      alive = false;
    };
  }, []);

  async function toggleSize() {
    if (busy.current) return;
    busy.current = true;
    try {
      const next = !compact;
      await invoke("set_hud_compact", { compact: next });
      setCompact(next);
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      busy.current = false;
    }
  }

  async function toggleFps() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    try {
      if (measuring) {
        await invoke("stop_fps_capture");
        setMeasuring(false);
      } else {
        await invoke("start_fps_capture");
        setMeasuring(true);
      }
    } catch (e) {
      // The message the backend sends for the unelevated case is the whole
      // explanation, not an error code, so it is shown as it arrives.
      pushToast("error", String(e));
    } finally {
      busy.current = false;
    }
  }

  async function toggleLock() {
    if (busy.current) return;
    busy.current = true;
    try {
      const next = !locked;
      await invoke("set_hud_click_through", { enabled: next });
      setLocked(next);
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      busy.current = false;
    }
  }

  async function toggle() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    try {
      if (open) {
        await invoke("close_hud_overlay");
        setOpen(false);
        // The next overlay is created unlocked, so the button must not still
        // claim otherwise.
        setLocked(false);
      } else {
        await invoke("open_hud_overlay");
        setOpen(true);
        // The overlay reopens at the size it was last left at, so the button
        // has to agree with it rather than assume the normal one.
        setCompact(await invoke<boolean>("hud_is_compact"));
      }
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      busy.current = false;
    }
  }

  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[13.5px] font-semibold text-ink">{s.hud.title}</h2>
            <ProBadge label={s.badges.pro} />
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{s.hud.subtitle}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-3">{s.hud.fpsAbout}</p>
          {/* The overlay labels this "DROP", which says what the number is
              for. This is where its usual name is given — 1% low, as
              Afterburner, FrameView, Adrenalin and PresentMon all print it —
              so that anyone who wants to read more knows the term to search
              for. The overlay has room for a word; this has room for a
              sentence. */}
          <p className="mt-1 text-[11px] leading-relaxed text-ink-3">{s.hud.fpsLowExplained}</p>
          {/* The requirement is stated before the click rather than after it:
              a button that only ever fails is worse than one that explains
              itself. */}
          {!elevated && (
            <p className="mt-1 text-[11px] leading-relaxed text-amber-300/80">
              {s.hud.fpsNeedsAdmin}
            </p>
          )}
          {measuring && (
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-300/80">
              {s.hud.fpsRunning}
            </p>
          )}
          {open && (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
              {locked ? s.hud.lockedHint : s.hud.dragHint}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {open && (
            <button
              onClick={() => void toggleSize()}
              className="rounded-xl border border-line-2 px-3 py-2 text-[12.5px] font-bold text-ink-2 transition hover:-translate-y-px hover:brightness-110"
            >
              {compact ? s.hud.sizeNormal : s.hud.sizeCompact}
            </button>
          )}
          {open && (
            <button
              onClick={() => void toggleLock()}
              className="rounded-xl border border-line-2 px-3 py-2 text-[12.5px] font-bold text-ink-2 transition hover:-translate-y-px hover:brightness-110"
            >
              {locked ? s.hud.unlock : s.hud.lock}
            </button>
          )}
          {elevated && (
            <button
              onClick={() => void toggleFps()}
              className={`rounded-xl px-3 py-2 text-[12.5px] font-bold transition hover:-translate-y-px hover:brightness-110 ${
                measuring
                  ? "border border-emerald-400/40 text-emerald-300"
                  : "border border-line-2 text-ink-2"
              }`}
            >
              {measuring ? s.hud.fpsStop : s.hud.fpsStart}
            </button>
          )}
          <button
            onClick={() => void toggle()}
            className={`rounded-xl px-4 py-2 text-[12.5px] font-bold transition hover:-translate-y-px hover:brightness-110 ${
              open ? "border border-line-2 text-ink-2" : "bg-accent text-on-accent"
            }`}
          >
            {open ? s.hud.hide : s.hud.show}
          </button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Driver Booster
 * ------------------------------------------------------------------ */

/**
 * Bulk driver handling: pick the ones worth attention, open all their download
 * pages at once.
 *
 * ## Why it opens pages instead of downloading packages
 *
 * It would be trivial to put a "Download all" button here that appeared to
 * fetch and install drivers. It would also be the most dangerous thing in this
 * app. There is no vendor API that answers "which driver is correct for this
 * exact device on this exact Windows build" — the download pages are hand-
 * curated per model, and picking wrong on a display adapter is one of the few
 * mistakes that leaves someone with no screen to fix it from.
 *
 * So the bulk action is bulk *navigation*: the tedious part of updating
 * drivers by hand is finding six vendor pages, not clicking six download
 * buttons. Windows Update, which does know what it is installing, keeps its
 * own install path on the Hardware screen.
 */
export function DriverBoosterCard({
  s,
  isPro,
  onRequirePro,
  pushToast,
}: {
  s: Strings;
  isPro: boolean;
  onRequirePro: () => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [audit, setAudit] = useState<DriverAudit | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /** Only drivers that are both worth attention and actionable. A row with no
   *  vendor page is not something this card can do anything about, and listing
   *  it would pad the count with entries whose checkbox does nothing. */
  const actionable = (audit?.entries ?? []).filter(
    (e) => e.vendor_url !== null && (e.tier === "stale" || e.tier === "aging"),
  );

  async function scan() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    setScanning(true);
    setSelected(new Set());
    try {
      const result = await invoke<DriverAudit>("driver_audit");
      setAudit(result);
      if (result.entries.filter((e) => e.tier !== "current").length === 0) {
        pushToast("success", s.driverBooster.allCurrent);
      }
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setScanning(false);
    }
  }

  function toggle(device: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(device)) next.delete(device);
      else next.add(device);
      return next;
    });
  }

  const allSelected = actionable.length > 0 && selected.size === actionable.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(actionable.map((e) => e.device)));
  }

  /** Cap on how many pages one click may open. Ten browser tabs at once is
   *  already aggressive; fifty would look like the app had malfunctioned. */
  const MAX_OPEN = 10;

  /**
   * The distinct vendor pages behind the current selection.
   *
   * `vendor_url` is one download portal per vendor, not a deep link to a
   * specific driver, so several selected devices from the same maker share a
   * single URL. Opening it once per device would have thrown up the same
   * NVIDIA page three times.
   */
  const selectedPages = Array.from(
    new Set(actionable.filter((e) => selected.has(e.device)).map((e) => e.vendor_url as string)),
  );

  async function openSelected() {
    if (selectedPages.length === 0) return;
    const batch = selectedPages.slice(0, MAX_OPEN);
    for (const url of batch) {
      try {
        await openUrl(url);
      } catch {
        // One page failing to open must not abandon the rest of the batch.
      }
    }
    if (selectedPages.length > batch.length) {
      // Said out loud rather than silently truncated: a bulk action that
      // quietly does less than asked is worse than one that explains itself.
      pushToast(
        "success",
        format(s.driverBooster.openedCapped, {
          opened: batch.length,
          total: selectedPages.length,
        }),
      );
    } else {
      pushToast("success", format(s.driverBooster.opened, { count: batch.length }));
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{s.driverBooster.title}</h3>
            <ProBadge label={s.badges.pro} />
          </div>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-3">
            {s.driverBooster.subtitle}
          </p>
        </div>
        <button
          onClick={() => void scan()}
          disabled={scanning}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12.5px] font-bold text-on-accent transition hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:hover:translate-y-0 disabled:hover:brightness-100"
        >
          {scanning && (
            <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {scanning ? s.driverBooster.scanning : s.driverBooster.scan}
        </button>
      </div>

      {audit && actionable.length === 0 && (
        <p className="mt-4 rounded-xl bg-surface-2 p-3 text-[12.5px] text-ink-3">
          {s.driverBooster.nothingActionable}
        </p>
      )}

      {actionable.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <button
              onClick={toggleAll}
              className="text-[12px] font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              {allSelected ? s.driverBooster.selectNone : s.driverBooster.selectAll}
            </button>
            <span className="type-data text-[11.5px] tabular-nums text-ink-3">
              {format(s.driverBooster.selectedCount, {
                selected: selected.size,
                total: actionable.length,
              })}
              {selectedPages.length > 0 && (
                <>
                  {" · "}
                  {format(s.driverBooster.pagesForSelection, {
                    pages: selectedPages.length,
                  })}
                </>
              )}
            </span>
          </div>

          <div className="mt-2 max-h-72 overflow-y-auto">
            {actionable.map((entry) => {
              const checked = selected.has(entry.device);
              return (
                <label
                  key={entry.device}
                  className="flex cursor-pointer items-center gap-3 border-b border-line py-2.5 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(entry.device)}
                    className="h-4 w-4 shrink-0 accent-[var(--app-accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {entry.device}
                    </span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {entry.class} · {entry.provider} · {entry.version}
                    </span>
                  </span>
                  <span
                    className={`type-data shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums ${
                      entry.tier === "stale"
                        ? "bg-rose-400/15 text-rose-300"
                        : "bg-amber-400/15 text-amber-300"
                    }`}
                  >
                    {Math.round(entry.age_days / 365)}y
                  </span>
                </label>
              );
            })}
          </div>

          <button
            onClick={() => void openSelected()}
            disabled={selectedPages.length === 0}
            className="mt-3 w-full rounded-xl bg-[linear-gradient(to_right,var(--app-accent),var(--app-accent2))] py-2.5 text-[13px] font-bold text-slate-900 transition hover:-translate-y-px hover:brightness-110 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:brightness-100"
          >
            {format(s.driverBooster.openSelected, { count: selectedPages.length })}
          </button>
        </>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">{s.driverBooster.note}</p>
    </div>
  );
}
