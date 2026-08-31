import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, Strings } from "../i18n";
import { textFor } from "../lib";
import { AuditEntry, CrashReport, DriftReport, Toast, TweakAdvice, TweakInfo } from "../types";
import { ProBadge, ShieldBadge } from "./ui";

/**
 * PC Tweaker Intelligence — vertical slice 1: Personal Advisor + Change
 * Ledger.
 *
 * Both are read-first surfaces over machinery that already exists and is
 * already tested: the Advisor reads the same hardware-derived verdicts the
 * Scan uses (recommend.rs — an allowlist that structurally cannot raise
 * security-reducing tweaks), and the Ledger reads the append-only local
 * audit trail (audit.rs). Neither ever applies anything on its own: every
 * action is a button the user presses, and every applied tweak keeps its
 * saved original value for one-click rollback.
 */

/**
 * Picks the single best recommendation for this machine.
 *
 * Pure and exported so the choice is testable: scan-relevant, not applied,
 * verdict "recommended", hardware-motivated reasons first (a verdict with a
 * concrete reason is stronger evidence than a bare one), stable order after
 * that.
 */
export function pickTopRecommendation(
  tweaks: TweakInfo[],
  scanIds: Set<string>,
  advice: Record<string, TweakAdvice>,
): TweakInfo | null {
  const candidates = tweaks
    .filter((t) => scanIds.has(t.id) && !t.applied && advice[t.id]?.verdict === "recommended")
    .sort((a, b) => {
      const ar = advice[a.id]?.reason_key ? 0 : 1;
      const br = advice[b.id]?.reason_key ? 0 : 1;
      return ar - br;
    });
  return candidates[0] ?? null;
}

/** "Recommended for your PC": one card, one concrete recommendation, the
 *  reason it applies to this machine, and an honest reversibility line. */
export function AdvisorCard({
  s,
  tweaks,
  busyId,
  isPro,
  onRequirePro,
  onApply,
}: {
  s: Strings;
  tweaks: TweakInfo[];
  busyId: string | null;
  isPro: boolean;
  onRequirePro: () => void;
  onApply: (t: TweakInfo) => Promise<void>;
}) {
  const [scanIds, setScanIds] = useState<Set<string> | null>(null);
  const [advice, setAdvice] = useState<Record<string, TweakAdvice> | null>(null);

  useEffect(() => {
    let alive = true;
    invoke<string[]>("scan_relevant_ids")
      .then(async (ids) => {
        if (!alive) return;
        setScanIds(new Set(ids));
        const list = await invoke<TweakAdvice[]>("advise_tweaks", { ids });
        if (alive) setAdvice(Object.fromEntries(list.map((a) => [a.id, a])));
      })
      .catch(() => {
        // No profile, no advice: the card simply doesn't render. Never guess.
        if (alive) {
          setScanIds(new Set());
          setAdvice({});
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const top = useMemo(
    () => (scanIds && advice ? pickTopRecommendation(tweaks, scanIds, advice) : null),
    [tweaks, scanIds, advice],
  );

  // Loading: quiet skeleton, same footprint, no spinner theater.
  if (scanIds === null || advice === null) {
    return (
      <div className="mb-6 h-[92px] animate-pulse rounded-2xl border border-line bg-surface-1" />
    );
  }

  const a = top ? advice[top.id] : null;
  const reason =
    a?.reason_key && (s.scan.reasons as Record<string, string | undefined>)[a.reason_key];

  return (
    <div className="signal relative mb-6 overflow-hidden rounded-2xl border border-line bg-surface-1 p-5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {s.advisor.eyebrow}
      </p>

      {top ? (
        <>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                {textFor(s.tweaks, top.id, top.name, top.description).name}
                {top.requires_admin && <ShieldBadge label={s.badges.admin} />}
                {top.requires_pro && <ProBadge label={s.badges.pro} />}
              </h2>
              {/* The reason is the card's substance: this machine's hardware
                  argues for the change, and the user can check the argument. */}
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-3">
                {reason ?? textFor(s.tweaks, top.id, top.name, top.description).description}
              </p>
            </div>
            <button
              onClick={() => {
                if (top.requires_pro && !isPro) {
                  onRequirePro();
                  return;
                }
                void onApply(top);
              }}
              disabled={busyId === top.id}
              className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-on-accent transition hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            >
              {busyId === top.id ? "···" : s.advisor.applyButton}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 text-[11.5px]">
            <span className={reason ? "font-semibold text-ok" : "font-semibold text-ink-2"}>
              {reason ? s.advisor.confidenceHigh : s.advisor.confidenceStandard}
            </span>
            {/* Not marketing: rollback.rs snapshots the original value before
                any write, so this sentence is a description of the code. */}
            <span className="text-ink-3">{s.advisor.reversible}</span>
          </div>
        </>
      ) : (
        /* Empty state: the honest "nothing to sell you" answer. */
        <p className="mt-2 text-sm text-ink-3">{s.advisor.empty}</p>
      )}
    </div>
  );
}

/* ---- Change Ledger --------------------------------------------------------- */

const ACTION_KEYS: Record<string, keyof Strings["ledger"]["actions"]> = {
  "tweak-applied": "applied",
  "tweak-reverted": "reverted",
  cleanup: "cleanup",
  "files-deleted": "filesDeleted",
  "disk-optimize": "diskOptimize",
  "startup-change": "startupChange",
  "restore-point": "restorePoint",
};

/**
 * The update watchdog's finding, shown only when something actually drifted.
 *
 * Two readings, kept apart on purpose. That the patch level moved is one
 * fact; that applied tweaks no longer match the system is another. The app
 * can prove both and cannot prove the first caused the second — the user may
 * have changed a setting themselves — so the wording reports the correlation
 * and stops there. Re-applying is a button, never automatic: a tool that
 * silently rewrote system settings after an update would be doing the one
 * thing the rollback engine exists to make impossible.
 */
export function UpdateDriftCard({
  s,
  tweaks,
  onChanged,
  pushToast,
}: {
  s: Strings;
  tweaks: TweakInfo[];
  onChanged: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [report, setReport] = useState<DriftReport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void invoke<DriftReport>("check_update_drift")
      .then((v) => {
        if (alive) setReport(v);
      })
      .catch(() => {
        // Not being able to read the patch level is not something to put in
        // front of the user: the watchdog simply has nothing to say.
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!report || report.reverted.length === 0) return null;

  const one = report.reverted.length === 1;

  const nameOf = (id: string) => {
    const t = tweaks.find((x) => x.id === id);
    return t ? textFor(s.tweaks, t.id, t.name, t.description).name : id;
  };

  async function reapply() {
    if (!report) return;
    setBusy(true);
    try {
      await invoke("apply_tweaks", { ids: report.reverted });
      await onChanged();
      pushToast(
        "success",
        one
          ? s.drift.reappliedOne
          : format(s.drift.reappliedMany, { count: report.reverted.length }),
      );
      setReport({ ...report, reverted: [] });
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signal relative mb-6 overflow-hidden rounded-2xl border border-amber-500/30 bg-surface-1 p-5">
      {/* Title and body both follow the same fork. Only one of the two
          situations involves Windows at all, and a headline blaming it above
          a sentence saying it was not involved reads as a bug. */}
      <h2 className="text-ink font-semibold">
        {report.windowsUpdated ? s.drift.titleAfterUpdate : s.drift.titleNoUpdate}
      </h2>
      <p className="text-ink-3 mt-0.5 text-sm">
        {report.windowsUpdated
          ? one
            ? format(s.drift.afterUpdateOne, { patch: report.currentPatch })
            : format(s.drift.afterUpdateMany, {
                count: report.reverted.length,
                patch: report.currentPatch,
              })
          : one
            ? s.drift.noUpdateOne
            : format(s.drift.noUpdateMany, { count: report.reverted.length })}
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {report.reverted.map((id) => (
          <li
            key={id}
            className="border-line-2 text-ink-2 rounded-full border px-3 py-1 text-[12px]"
          >
            {nameOf(id)}
          </li>
        ))}
      </ul>

      <button
        onClick={() => void reapply()}
        disabled={busy}
        className="bg-accent text-on-accent mt-4 rounded-xl px-4 py-2.5 text-[13px] font-bold transition hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:hover:translate-y-0 disabled:hover:brightness-100"
      >
        {busy
          ? s.drift.reapplying
          : one
            ? s.drift.reapplyOne
            : format(s.drift.reapplyMany, { count: report.reverted.length })}
      </button>
    </div>
  );
}

/**
 * Crash reports, shown only when there are any.
 *
 * Lives beside the Change Ledger because it answers the same question — what
 * happened on this machine — and because the crash worth surfacing most is
 * the one nobody can see: the elevated helper has no window, so a panic there
 * looks to the user like the button simply did nothing.
 *
 * There is no "send" button, deliberately. The app does not phone home, and
 * an opt-in upload would still be an upload; copying the report to the
 * clipboard puts the decision to share it, and the choice of where, entirely
 * with the person whose machine it describes.
 */
export function CrashReportsCard({
  s,
  pushToast,
}: {
  s: Strings;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [reports, setReports] = useState<CrashReport[]>([]);

  useEffect(() => {
    let alive = true;
    void invoke<CrashReport[]>("list_crash_reports")
      .then((v) => {
        if (alive) setReports(v);
      })
      .catch(() => {
        // No reports is the normal case and the same outcome as a failed
        // read: either way there is nothing to show.
      });
    return () => {
      alive = false;
    };
  }, []);

  if (reports.length === 0) return null;

  // Plain text rather than JSON: this gets pasted into a chat message or an
  // issue, where a wall of braces is worse than lines a human can skim.
  const asText = reports
    .map((r) =>
      [
        `[${new Date(r.ts * 1000).toISOString()}] v${r.version} (${r.process})`,
        r.message,
        `at ${r.location} on thread ${r.thread}`,
      ].join("\n"),
    )
    .join("\n\n");

  return (
    <div className="signal relative mb-6 overflow-hidden rounded-2xl border border-amber-500/30 bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-ink font-semibold">{s.crashes.title}</h2>
          <p className="text-ink-3 mt-0.5 text-sm">{s.crashes.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              void navigator.clipboard
                .writeText(asText)
                .then(() => pushToast("success", s.crashes.copied))
                .catch((e: unknown) => pushToast("error", String(e)));
            }}
            className="border-line-2 text-ink-2 rounded-xl border px-3 py-2 text-[12.5px] font-bold transition hover:-translate-y-px hover:brightness-110"
          >
            {s.crashes.copy}
          </button>
          <button
            onClick={() => {
              void invoke("clear_crash_reports")
                .then(() => {
                  setReports([]);
                  pushToast("success", s.crashes.cleared);
                })
                .catch((e: unknown) => pushToast("error", String(e)));
            }}
            className="border-line-2 text-ink-2 rounded-xl border px-3 py-2 text-[12.5px] font-bold transition hover:-translate-y-px hover:brightness-110"
          >
            {s.crashes.clear}
          </button>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {reports.map((r, i) => (
          <li key={i} className="border-line rounded-xl border p-3">
            <div className="text-ink-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span>{new Date(r.ts * 1000).toLocaleString()}</span>
              <span>·</span>
              <span>v{r.version}</span>
              <span>·</span>
              {/* Which process died is the single most useful field here, so
                  it is a chip rather than another item in the grey run-on. */}
              <span className="border-line-2 text-ink-2 rounded-full border px-2 py-0.5 font-semibold">
                {r.process === "elevated" ? s.crashes.processElevated : s.crashes.processApp}
              </span>
            </div>
            <p className="text-ink mt-1 font-mono text-[12px] break-words">{r.message}</p>
            <p className="text-ink-3 mt-0.5 font-mono text-[11px]">{r.location}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The local history of what this app changed on this machine: every entry of
 * the append-only audit trail, newest first, with per-tweak rollback for
 * anything still applied. Read-only over `audit-log.jsonl`; the file never
 * leaves the machine.
 */
export function LedgerPanel({
  s,
  tweaks,
  onChanged,
  pushToast,
}: {
  s: Strings;
  tweaks: TweakInfo[];
  onChanged: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  function load() {
    invoke<AuditEntry[]>("list_audit_log")
      .then((v) => setEntries([...v].reverse()))
      .catch(() => setEntries([]));
  }
  useEffect(load, []);

  const appliedIds = useMemo(
    () => new Set(tweaks.filter((t) => t.applied).map((t) => t.id)),
    [tweaks],
  );
  const tweakName = (id: string) => {
    const t = tweaks.find((x) => x.id === id);
    return t ? textFor(s.tweaks, t.id, t.name, t.description).name : id;
  };

  async function rollback(id: string) {
    setBusy(id);
    try {
      await invoke("rollback_tweak", { id });
      await onChanged();
      pushToast("success", format(s.toasts.rolledBack, { name: tweakName(id) }));
      load();
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusy(null);
    }
  }

  if (entries === null) {
    return <div className="mb-6 h-40 animate-pulse rounded-2xl border border-line bg-surface-1" />;
  }

  return (
    <div className="signal relative mb-6 overflow-hidden rounded-2xl border border-line bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{s.ledger.title}</h2>
          <p className="mt-0.5 text-sm text-ink-3">{s.ledger.subtitle}</p>
        </div>
        {/* Only offered when there is something to clear, so the control
            never implies history exists where none does. */}
        {entries.length > 0 && (
          <button
            onClick={() => {
              setClearing(true);
              invoke("clear_audit_log")
                .then(() => {
                  setEntries([]);
                  pushToast("success", s.ledger.cleared);
                })
                .catch((e: unknown) => pushToast("error", String(e)))
                .finally(() => setClearing(false));
            }}
            disabled={clearing}
            className="shrink-0 rounded-xl border border-line-2 px-4 py-2 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-wait disabled:opacity-60"
          >
            {clearing ? s.ledger.clearing : s.ledger.clear}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">{s.ledger.empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-line">
          {entries.map((e, i) => {
            const key = ACTION_KEYS[e.action];
            const label = key ? s.ledger.actions[key] : e.action;
            const isTweak = e.action === "tweak-applied";
            const canRevert = isTweak && appliedIds.has(e.target);
            return (
              <li key={`${e.ts}-${i}`} className="flex items-start gap-3 py-2.5">
                {/* Status is shape + color, never color alone. */}
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.success ? "bg-ok" : "bg-danger"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">
                    {label}
                    <span className="text-ink-2">
                      {" "}
                      · {e.action.startsWith("tweak-") ? tweakName(e.target) : e.target}
                    </span>
                  </p>
                  <p className="type-data mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-3">
                    {new Date(e.ts * 1000).toLocaleString()}
                    {e.elevated && <span className="text-ink-3">· {s.ledger.elevated}</span>}
                    {!e.success && (
                      <span className="font-semibold text-danger">· {s.ledger.failed}</span>
                    )}
                    {e.detail && <span className="truncate">· {e.detail}</span>}
                  </p>
                </div>
                {canRevert && (
                  <button
                    onClick={() => void rollback(e.target)}
                    disabled={busy !== null}
                    className="shrink-0 rounded-lg border border-line-2 px-2.5 py-1 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                  >
                    {busy === e.target ? "···" : s.ledger.revert}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
