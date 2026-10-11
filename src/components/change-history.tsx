import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { format, Lang, Strings, localeOf } from "../i18n";
import { friendlyError, textFor } from "../lib";
import type { AuditEntry, Toast, TweakInfo, ValueChange } from "../types";
import {
  buildHistory,
  filterItems,
  latestApplies,
  NO_FILTERS,
  sessions,
  sessionUndoable,
  summary,
  toCsv,
  toJson,
  type Filters,
  type HistoryItem,
  type RemovalRecord,
} from "../history-model";
import { HISTORY_COPY } from "./history-copy";
import { Badge } from "./ui";
import "./workspace-panels.css";
import "./change-history.css";

/**
 * Change history: every change PC Tweaker made on this PC, grouped by day and
 * by session, with where it came from, its result, the registry values before
 * and after (from 1.18.1), filters, search, exports, and safe undo of one
 * change, a whole session or everything still in effect, always after a
 * confirmation that lists what will change. Read from the local audit trail
 * (audit.rs) and the Debloat history; nothing leaves the PC.
 */

const ACTION_KEYS: Record<string, keyof Strings["ledger"]["actions"]> = {
  "tweak-applied": "applied",
  "tweak-reverted": "reverted",
  cleanup: "cleanup",
  "files-deleted": "filesDeleted",
  "disk-optimize": "diskOptimize",
  "startup-change": "startupChange",
  "restore-point": "restorePoint",
  "process-guard": "processGuard",
  "core-steering": "coreSteering",
  "ram-trim": "ramTrim",
  "tweak-auto-reverted": "autoReverted",
  "priority-applied": "priorityRule",
  "priority-restored": "priorityRule",
  "temp-cleanup-scheduled": "scheduledCleanup",
  "ecoqos-applied": "ecoqos",
  "ecoqos-restored": "ecoqos",
};

type ActiveChange = { id: string; changes: ValueChange[] };
type Confirm = { title: string; ids: string[] };

const DAY_S = 24 * 60 * 60;

type Range = "all" | "today" | "7" | "30";

/** The start of a period, in Unix seconds: midnight today, or N days ago. */
function sinceOf(range: Range): number {
  if (range === "all") return 0;
  if (range === "today") return Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  return Math.floor(Date.now() / 1000) - Number(range) * DAY_S;
}

export function ChangeHistory({
  s,
  lang,
  tweaks,
  onChanged,
  pushToast,
}: {
  s: Strings;
  lang: Lang;
  tweaks: TweakInfo[];
  onChanged: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const c = HISTORY_COPY[lang];
  const locale = localeOf(lang);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [removals, setRemovals] = useState<RemovalRecord[]>([]);
  const [active, setActive] = useState<ActiveChange[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [range, setRange] = useState<Range>("all");
  // Set when the period is picked (an event), never computed while drawing.
  const [since, setSince] = useState(0);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const request = useRef(0);

  const load = useCallback(() => {
    const id = ++request.current;
    Promise.all([
      invoke<AuditEntry[]>("list_audit_log"),
      invoke<RemovalRecord[]>("debloat_history").catch(() => []),
      invoke<ActiveChange[]>("active_changes").catch(() => []),
    ])
      .then(([log, apps, now]) => {
        if (id !== request.current) return;
        setLoadError(null);
        setEntries(log);
        setRemovals(apps);
        setActive(now);
      })
      .catch((e: unknown) => {
        if (id !== request.current) return;
        setLoadError(String(e));
        setEntries((current) => current ?? []);
      });
  }, []);

  useEffect(() => {
    load();
    return () => {
      request.current += 1;
    };
  }, [load]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (confirm && !dialog?.open) dialog?.showModal();
    if (!confirm && dialog?.open) dialog.close();
  }, [confirm]);

  const appliedNow = useMemo(
    () => new Set(tweaks.filter((t) => t.applied).map((t) => t.id)),
    [tweaks],
  );
  const tweakName = useCallback(
    (id: string) => {
      const t = tweaks.find((x) => x.id === id);
      return t ? textFor(s.tweaks, t.id, t.name, t.description).name : id;
    },
    [tweaks, s],
  );

  /** Registry tweaks list their hive; composite ones (power plans, services,
   *  network) do not, so they have no single value to show. */
  const isRegistry = (id: string) => tweaks.find((t) => t.id === id)?.hive.startsWith("HK") ?? true;

  const nameOf = useCallback(
    (item: HistoryItem): string => {
      if (item.action === "restore-point") return s.ledger.actions.restorePoint;
      if (item.kind === "tweak") return tweakName(item.target);
      if (item.kind === "debloat") return item.target;
      if (item.action === "process-guard")
        return item.target === "paused" ? s.ledger.guardPaused : s.ledger.guardResumed;
      if (item.target === "restored") return s.ledger.restored;
      if (item.target === "postponed") return s.ledger.postponed;
      if (item.action === "ram-trim") return s.ram.title;
      if (item.target === "temp_cleanup")
        return textFor(s.cleanup, item.target, item.target, "").name;
      const count = /^(\d+) processes$/.exec(item.target);
      if (count) return format(s.ledger.processes, { count: Number(count[1]) });
      return item.target;
    },
    [tweakName, s],
  );

  const items = useMemo(() => buildHistory(entries ?? [], removals), [entries, removals]);
  const visible = useMemo(
    () => filterItems(items, { ...filters, since }, nameOf),
    [items, filters, since, nameOf],
  );
  const grouped = useMemo(() => sessions(visible), [visible]);
  const latest = useMemo(() => latestApplies(items), [items]);
  const totals = summary(items, appliedNow.size);
  const filtered =
    filters.kind !== "all" || filters.outcome !== "all" || !!filters.query || range !== "all";

  const time = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const day = (ts: number) =>
    new Date(ts * 1000).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  function actionLabel(item: HistoryItem): string {
    if (item.kind === "debloat") {
      if (item.action.endsWith("removed")) return c.removalRemoved;
      if (item.action.endsWith("failed")) return c.removalFailed;
      if (item.action.endsWith("pending")) return c.removalPending;
      return c.removalUnknown;
    }
    const key = ACTION_KEYS[item.action];
    return key ? s.ledger.actions[key] : item.action;
  }

  function originLabel(item: HistoryItem): string {
    const o = item.origin;
    if (o.kind === "profile") return format(c.originProfile, { name: o.label ?? "" });
    if (o.kind === "starter") return format(c.originStarter, { name: o.label ?? "" });
    if (o.kind === "scan") return c.originScan;
    if (o.kind === "reapply") return c.originReapply;
    if (o.kind === "switch") return c.originSwitch;
    return c.originApp;
  }

  async function undo(ids: string[]) {
    setBusy(true);
    try {
      const failures = await invoke<string[]>("rollback_tweaks", { ids });
      await onChanged();
      const after = await invoke<TweakInfo[]>("list_tweaks");
      const still = new Set(after.filter((t) => t.applied).map((t) => t.id));
      const done = ids.filter((id) => !still.has(id)).length;
      if (done === ids.length && failures.length === 0) {
        pushToast("success", format(c.undoDone, { count: done }));
      } else {
        pushToast("error", format(c.undoPartial, { done, total: ids.length }));
      }
    } catch (e) {
      pushToast("error", friendlyError(e, s));
    } finally {
      setBusy(false);
      setConfirm(null);
      load();
    }
  }

  async function exportAs(kind: "csv" | "json") {
    const stamp = new Date().toISOString().slice(0, 10);
    const path = await saveFileDialog({
      defaultPath: `pc-tweaker-history-${stamp}.${kind}`,
      filters: [{ name: kind.toUpperCase(), extensions: [kind] }],
    }).catch(() => null);
    if (!path) return;
    try {
      const contents = kind === "csv" ? toCsv(visible, nameOf) : toJson(visible, nameOf);
      await invoke("save_history_export", { path, contents });
      pushToast("success", c.exported);
    } catch (e) {
      pushToast("error", friendlyError(e, s));
    }
  }

  function clearHistory() {
    setClearing(true);
    invoke("clear_audit_log")
      .then(() => {
        request.current += 1;
        setEntries([]);
        pushToast("success", s.ledger.cleared);
        load();
      })
      .catch((e: unknown) => pushToast("error", String(e)))
      .finally(() => setClearing(false));
  }

  const toggleOpen = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (entries === null) {
    return (
      <section
        className="workspace-ledger change-history"
        aria-label={s.tabs.ledger}
        aria-busy="true"
      >
        <header className="workspace-panel-header">
          <div>
            <p>{s.ledger.subtitle}</p>
          </div>
        </header>
        <div className="workspace-panel-empty" role="status">
          {s.scheduledTasks.refreshing}
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-ledger change-history" aria-label={s.tabs.ledger}>
      <header className="workspace-panel-header">
        <div>
          <h2 className="history-print-only">{s.tabs.ledger}</h2>
          <p>{s.ledger.subtitle}</p>
          <p className="history-print-only">
            {c.printTitle} · {format(c.printed, { date: new Date().toLocaleString(locale) })}
          </p>
        </div>
        {items.length > 0 && (
          <div className="history-header-actions no-print">
            <span className="history-export-label">{c.export}</span>
            <button
              className="workspace-button workspace-button-secondary"
              onClick={() => void exportAs("csv")}
            >
              CSV
            </button>
            <button
              className="workspace-button workspace-button-secondary"
              onClick={() => void exportAs("json")}
            >
              JSON
            </button>
            <button
              className="workspace-button workspace-button-secondary"
              onClick={() => window.print()}
            >
              {c.exportPdf}
            </button>
            <button
              onClick={clearHistory}
              disabled={clearing}
              className="workspace-button workspace-button-secondary workspace-button-delete"
            >
              {clearing ? s.ledger.clearing : s.ledger.clear}
            </button>
          </div>
        )}
      </header>

      {loadError && (
        <div className="workspace-panel-error" role="alert">
          <p>{loadError}</p>
          <button onClick={load} className="workspace-button workspace-button-secondary">
            {s.scheduledTasks.refresh}
          </button>
        </div>
      )}

      <dl className="history-summary">
        <div>
          <dt>{c.summaryActive}</dt>
          <dd>{totals.active}</dd>
        </div>
        <div>
          <dt>{c.summaryUndone}</dt>
          <dd>{totals.undone}</dd>
        </div>
        <div data-tone={totals.failed ? "danger" : undefined}>
          <dt>{c.summaryFailed}</dt>
          <dd>{totals.failed}</dd>
        </div>
      </dl>

      <section className="history-compare" aria-labelledby="history-compare-title">
        <div className="history-compare-head">
          <div>
            <h3 id="history-compare-title">{c.compareTitle}</h3>
            <p>{active.length ? c.compareBody : c.compareEmpty}</p>
          </div>
          {active.length > 0 && (
            <div className="history-compare-actions no-print">
              <button
                className="workspace-button workspace-button-secondary"
                aria-expanded={compareOpen}
                onClick={() => setCompareOpen((v) => !v)}
              >
                {compareOpen ? c.compareHide : format(c.compareShow, { count: active.length })}
              </button>
              <button
                className="workspace-button workspace-button-secondary"
                disabled={busy}
                onClick={() => setConfirm({ title: c.undoTitleAll, ids: active.map((a) => a.id) })}
              >
                {format(c.undoAll, { count: active.length })}
              </button>
            </div>
          )}
        </div>
        {active.length > 0 && compareOpen && (
          <ul className="history-compare-list">
            {active.map((a) => (
              <li key={a.id}>
                <strong>{tweakName(a.id)}</strong>
                {a.changes.length ? (
                  <Values changes={a.changes} c={c} />
                ) : (
                  <p className="history-muted">{c.compareNoValues}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {items.length > 0 && (
        <div className="history-filters no-print" role="search">
          <input
            type="search"
            value={filters.query}
            placeholder={c.search}
            aria-label={c.search}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          />
          <select
            aria-label={c.type}
            value={filters.kind}
            onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value as Filters["kind"] }))}
          >
            <option value="all">{c.typeAll}</option>
            <option value="tweak">{c.typeTweak}</option>
            <option value="cleanup">{c.typeCleanup}</option>
            <option value="debloat">{c.typeDebloat}</option>
            <option value="system">{c.typeSystem}</option>
          </select>
          <select
            aria-label={c.outcome}
            value={filters.outcome}
            onChange={(e) =>
              setFilters((f) => ({ ...f, outcome: e.target.value as Filters["outcome"] }))
            }
          >
            <option value="all">{c.outcomeAll}</option>
            <option value="success">{c.outcomeSuccess}</option>
            <option value="failed">{c.outcomeFailed}</option>
          </select>
          <select
            aria-label={c.range}
            value={range}
            onChange={(e) => {
              const next = e.target.value as Range;
              setRange(next);
              setSince(sinceOf(next));
            }}
          >
            <option value="all">{c.rangeAll}</option>
            <option value="today">{c.rangeToday}</option>
            <option value="7">{c.range7}</option>
            <option value="30">{c.range30}</option>
          </select>
          {filtered && (
            <button
              className="workspace-button workspace-button-secondary"
              onClick={() => {
                setFilters(NO_FILTERS);
                setRange("all");
                setSince(0);
              }}
            >
              {c.clearFilters}
            </button>
          )}
        </div>
      )}

      {items.length === 0 && !loadError ? (
        <div className="workspace-panel-empty">
          <span className="workspace-empty-symbol" aria-hidden="true">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7v5h5M4.7 12a8 8 0 1 1 2.5 6M12 8v4l3 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p>{s.ledger.empty}</p>
        </div>
      ) : items.length > 0 && visible.length === 0 ? (
        <p className="workspace-panel-empty" role="status">
          {c.emptyFiltered}
        </p>
      ) : (
        <ol className="workspace-ledger-list history-sessions">
          {grouped.map((session, i) => {
            const undoable = sessionUndoable(session, appliedNow, latest);
            const newDay = i === 0 || day(session.end) !== day(grouped[i - 1].end);
            return (
              <li key={`${session.end}-${session.items[0].key}`}>
                {newDay && <h3 className="workspace-ledger-date">{day(session.end)}</h3>}
                <div className="history-session">
                  <div className="history-session-head">
                    <span className="history-session-time">
                      {time(session.start) === time(session.end)
                        ? time(session.end)
                        : format(c.sessionTime, {
                            start: time(session.start),
                            end: time(session.end),
                          })}
                    </span>
                    <span className="history-muted">
                      {session.items.length === 1
                        ? c.sessionOne
                        : format(c.sessionCount, { count: session.items.length })}
                    </span>
                    {undoable.length > 0 && (
                      <button
                        className="workspace-button workspace-button-secondary no-print"
                        disabled={busy}
                        onClick={() => setConfirm({ title: c.undoTitleSession, ids: undoable })}
                      >
                        {format(c.undoSession, { count: undoable.length })}
                      </button>
                    )}
                  </div>
                  <ol>
                    {session.items.map((item) => (
                      <HistoryRow
                        key={item.key}
                        item={item}
                        name={nameOf(item)}
                        action={actionLabel(item)}
                        origin={originLabel(item)}
                        time={time(item.ts)}
                        inEffect={
                          item.action !== "tweak-applied" || !item.success
                            ? null
                            : latest.get(item.target) !== item.key
                              ? appliedNow.has(item.target)
                                ? null
                                : false
                              : appliedNow.has(item.target)
                        }
                        open={open.has(item.key)}
                        onToggle={() => toggleOpen(item.key)}
                        onUndo={() => setConfirm({ title: c.undoTitleOne, ids: [item.target] })}
                        registryTweak={isRegistry(item.target)}
                        busy={busy}
                        s={s}
                        c={c}
                      />
                    ))}
                  </ol>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <dialog
        ref={dialogRef}
        className="debloat-dialog history-dialog"
        aria-labelledby="history-confirm-title"
        onClose={() => setConfirm(null)}
      >
        {confirm && (
          <div>
            <h2 id="history-confirm-title">{confirm.title}</h2>
            <p className="history-muted">{c.undoBody}</p>
            <ul>
              {confirm.ids.map((id) => {
                const values = active.find((a) => a.id === id)?.changes ?? [];
                return (
                  <li key={id}>
                    <div>
                      <strong>{tweakName(id)}</strong>
                      {values.length > 0 && <Values changes={values} c={c} />}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="debloat-dialog-actions">
              <button
                type="button"
                className="tool-secondary-action"
                autoFocus
                onClick={() => setConfirm(null)}
              >
                {c.cancel}
              </button>
              <button
                type="button"
                className="tool-danger-action"
                disabled={busy}
                onClick={() => void undo(confirm.ids)}
              >
                {confirm.ids.length === 1
                  ? c.undoConfirmOne
                  : format(c.undoConfirmCount, { count: confirm.ids.length })}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}

type Copy = (typeof HISTORY_COPY)["en"];

function HistoryRow({
  item,
  name,
  action,
  origin,
  time,
  inEffect,
  registryTweak,
  open,
  onToggle,
  onUndo,
  busy,
  s,
  c,
}: {
  item: HistoryItem;
  name: string;
  action: string;
  origin: string;
  time: string;
  /** For an applied tweak: whether it is still in effect now. */
  inEffect: boolean | null;
  /** A single-value registry tweak, as opposed to a power plan, a service... */
  registryTweak: boolean;
  open: boolean;
  onToggle: () => void;
  onUndo: () => void;
  busy: boolean;
  s: Strings;
  c: Copy;
}) {
  const showsValues =
    item.kind === "tweak" && item.success && item.action !== "tweak-auto-reverted";
  return (
    <li>
      <div className={`workspace-ledger-event ${item.success ? "" : "has-failed"}`}>
        {/* Status is shape + colour, never colour alone. */}
        <span
          className={`workspace-ledger-status ${item.success ? "is-success" : "is-failed"}`}
          aria-hidden="true"
        >
          {item.success ? "✓" : "×"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="workspace-ledger-target">{name}</p>
          <div className="workspace-ledger-meta">
            {action !== name && <span>{action}</span>}
            <time dateTime={new Date(item.ts * 1000).toISOString()}>{time}</time>
            <Badge kind="muted">{origin}</Badge>
            {item.elevated && <span className="workspace-ledger-admin">{s.ledger.elevated}</span>}
            {!item.success && <span className="workspace-ledger-failure">{s.ledger.failed}</span>}
            {inEffect !== null && (
              <Badge kind={inEffect ? "ok" : "neutral"}>
                {inEffect ? c.stillActive : c.noLongerActive}
              </Badge>
            )}
          </div>
          {item.detail && <p className="workspace-ledger-detail">{item.detail}</p>}
          {showsValues && (
            <button
              className="history-values-toggle no-print"
              aria-expanded={open}
              onClick={onToggle}
            >
              {open ? c.hideValues : c.showValues}
            </button>
          )}
          {showsValues &&
            open &&
            (item.changes.length ? (
              <Values changes={item.changes} c={c} />
            ) : (
              <p className="history-muted">{registryTweak ? c.notRecorded : c.compareNoValues}</p>
            ))}
        </div>
        {inEffect && (
          <button
            onClick={onUndo}
            disabled={busy}
            aria-label={`${c.undoOne} · ${name}`}
            className="workspace-button workspace-button-secondary no-print"
          >
            {c.undoOne}
          </button>
        )}
      </div>
    </li>
  );
}

function Values({ changes, c }: { changes: ValueChange[]; c: Copy }) {
  return (
    <table className="history-values">
      <thead>
        <tr>
          <th scope="col">{c.value}</th>
          <th scope="col">{c.before}</th>
          <th scope="col">{c.after}</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((v) => (
          <tr key={`${v.path}\\${v.name}`}>
            <th scope="row">
              <code>
                {v.path}\{v.name}
              </code>
            </th>
            <td>{v.before ?? <em>{c.notSet}</em>}</td>
            <td>{v.after ?? <em>{c.notSet}</em>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
