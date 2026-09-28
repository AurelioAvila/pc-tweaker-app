import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { STRINGS, type Lang } from "../i18n";
import { FEATURE_INTELLIGENCE } from "../lib";
import { ToolHeader, ToolStatus } from "./tool-section";
import {
  DEBLOAT_COPY,
  DEBLOAT_IMPACT,
  LIBRARY_COPY,
  APP_CATEGORIES,
  EXTRA_IMPACTS,
} from "./debloat-copy";
import { STARTER_COPY } from "./starter-copy";
import "./debloat.css";

export interface DebloatApp {
  iconDataUrl?: string | null;
  catalogId: string;
  name: string;
  description: string;
  impact: string;
  packageFullName: string | null;
  installed: boolean;
  removable: boolean;
  reason: string | null;
  storeUrl: string | null;
}

export interface DebloatRecord {
  catalogId: string;
  packageFullName: string;
  publisherId: string;
  scope: "currentUser";
  status: "pending" | "removed" | "failed" | "unknown";
  error: string | null;
  timestamp: number;
}

type Result = Pick<DebloatRecord, "catalogId" | "packageFullName" | "status" | "error">;
type View = "apps" | "suggestions" | "history";
type AppFilter = "all" | "removable" | "unavailable";
const SUGGESTION_IDS = [
  "disable_start_suggestions",
  "disable_suggested_apps",
  "disable_tailored_experiences",
  "disable_feedback_requests",
] as const;

function AppMark({ app }: { app: DebloatApp }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="debloat-app-mark" aria-hidden="true">
      {app.iconDataUrl?.startsWith("data:image/png;base64,") && !failed ? (
        <img src={app.iconDataUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className="debloat-monogram">
          {app.name
            .replace(/^Microsoft /, "")
            .slice(0, 2)
            .toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function DebloatPanel({
  lang,
  onNavigate,
  active = true,
}: {
  lang: Lang;
  onNavigate: (section: "privacy" | "profiles" | "ledger") => void;
  active?: boolean;
}) {
  const c = DEBLOAT_COPY[lang];
  const l = LIBRARY_COPY[lang];
  const [category, setCategory] = useState("all");
  const [showAbsent, setShowAbsent] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "category">("name");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const s = STRINGS[lang];
  const [view, setView] = useState<View>("apps");
  const [apps, setApps] = useState<DebloatApp[]>([]);
  const [records, setRecords] = useState<DebloatRecord[]>([]);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [previewApps, setPreviewApps] = useState<DebloatApp[] | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [query, setQuery] = useState("");
  const [appFilter, setAppFilter] = useState<AppFilter>("all");
  const [scanning, setScanning] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const runningRef = useRef(false);
  const loadedRef = useRef(false);

  async function scan() {
    setScanning(true);
    setScanError(null);
    try {
      const next = await invoke<DebloatApp[]>("list_debloat_apps");
      setApps(next);
      const valid = new Set(
        next
          .filter((app) => app.installed && app.removable && app.packageFullName)
          .map((app) => app.packageFullName),
      );
      setSelection((previous) => new Set([...previous].filter((id) => valid.has(id))));
    } catch (error) {
      setScanError(String(error));
    } finally {
      setScanning(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const next = await invoke<DebloatRecord[]>("debloat_history");
      setRecords(next);
      return next;
    } catch (error) {
      setHistoryError(String(error));
      throw error;
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!active || loadedRef.current) return;
    const timer = window.setTimeout(() => {
      loadedRef.current = true;
      void scan();
      void loadHistory().catch(() => {});
    }, 0);
    // The parent keeps this panel mounted during navigation so an operation can finish.
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (previewApps && !dialog?.open) dialog?.showModal();
    if (!previewApps && dialog?.open) dialog.close();
  }, [previewApps]);

  function toggle(app: DebloatApp) {
    if (!app.packageFullName || !app.removable || running || scanning) return;
    setSelection((previous) => {
      const next = new Set(previous);
      if (next.has(app.packageFullName!)) next.delete(app.packageFullName!);
      else next.add(app.packageFullName!);
      return next;
    });
  }

  async function removeSelected() {
    if (!previewApps?.length || runningRef.current) return;
    const batch = previewApps;
    runningRef.current = true;
    setRunning(true);
    setResults([]);
    setPreviewApps(null);
    setView("apps");
    for (const app of batch) {
      const packageFullName = app.packageFullName;
      if (!packageFullName) continue;
      let result: Result;
      try {
        result = await invoke<DebloatRecord>("remove_debloat_app", { packageFullName });
      } catch (error) {
        // A transport error can occur after Windows acted. The journal is reconciled below; never claim success or retry automatically.
        result = {
          catalogId: app.catalogId,
          packageFullName,
          status: "unknown",
          error: String(error),
        };
      }
      setResults((previous) => [...previous, result]);
      await loadHistory().catch(() => {});
    }
    setSelection(new Set());
    await scan();
    runningRef.current = false;
    setRunning(false);
  }

  async function openRecovery(catalogId: string) {
    if (recoveryBusy) return;
    setRecoveryBusy(catalogId);
    setRecoveryError(null);
    try {
      const url = await invoke<string>("debloat_reinstall_link", { catalogId });
      await openUrl(url);
    } catch (error) {
      setRecoveryError(String(error));
    } finally {
      setRecoveryBusy(null);
    }
  }

  const installed = apps.filter((app) => app.installed);
  const removable = installed.filter((app) => app.removable && app.packageFullName);
  const elevated = installed.some((app) => app.reason === "requiresStandardUser");
  const categoryOf = (app: DebloatApp) => APP_CATEGORIES[app.catalogId] ?? "windows";
  const filtered = (showAbsent ? apps : installed).filter((app) => {
    const available = app.removable && !!app.packageFullName;
    return (
      (!selectedOnly || (!!app.packageFullName && selection.has(app.packageFullName))) &&
      (category === "all" || categoryOf(app) === category) &&
      (appFilter === "all" ||
        (appFilter === "removable" ? available : app.installed && !available)) &&
      `${app.name} ${app.packageFullName ?? ""}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase())
    );
  });
  filtered.sort(
    (a, b) =>
      (sortBy === "category" ? l[categoryOf(a)].localeCompare(l[categoryOf(b)], lang) : 0) ||
      a.name.localeCompare(b.name, lang),
  );
  const chosen = installed.filter(
    (app) => app.packageFullName && selection.has(app.packageFullName) && app.removable,
  );
  const appName = (catalogId: string) =>
    apps.find((app) => app.catalogId === catalogId)?.name ?? catalogId;
  const impact = (app: DebloatApp) =>
    c[DEBLOAT_IMPACT[app.catalogId]] ?? EXTRA_IMPACTS[lang][app.catalogId] ?? app.impact;
  const status = (value: DebloatRecord["status"]) => c[value];
  const reason = (value: string | null) =>
    value === "publisherMismatch" ||
    value === "protectedPackage" ||
    value === "dependency" ||
    value === "nonRemovable" ||
    value === "unverifiedRemovability" ||
    value === "requiresStandardUser"
      ? c[value]
      : c.unavailable;

  return (
    <section className="debloat" aria-label={c.title}>
      <div className="debloat-hero">
        <p className="debloat-eyebrow">{l.eyebrow}</p>
        <ToolHeader
          title={l.title}
          description={l.intro}
          actions={<span className="debloat-scope">{c.currentUser}</span>}
        />
        <div className="debloat-summary" aria-live="polite">
          <div>
            <strong>{scanning ? "—" : installed.length}</strong>
            <span>{c.installed}</span>
          </div>
          <div>
            <strong>{scanning ? "—" : removable.length}</strong>
            <span>{c.removable}</span>
          </div>
          <div>
            <strong>{scanning ? "—" : apps.length}</strong>
            <span>{l.catalogue}</span>
          </div>
          <p>{c.scope}</p>
        </div>
      </div>

      <nav className="debloat-tabs" aria-label={c.title}>
        {(["apps", "suggestions", "history"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={view === tab ? "active" : ""}
            aria-current={view === tab ? "page" : undefined}
            onClick={() => setView(tab)}
          >
            {c[tab]}
          </button>
        ))}
      </nav>

      {view === "apps" && (
        <div className="debloat-stack">
          <div className="debloat-toolbar">
            <div>
              <h3>{c.choose}</h3>
            </div>
            <button
              type="button"
              className="debloat-secondary"
              disabled={scanning || running}
              onClick={() => void scan()}
            >
              {scanning ? c.scanning : c.scan}
            </button>
          </div>
          {scanError && (
            <ToolStatus tone="error">
              {c.scanError} {scanError}
            </ToolStatus>
          )}
          {scanning && !installed.length && <ToolStatus busy>{c.scanning}</ToolStatus>}
          {elevated && !scanning && (
            <div className="debloat-elevated" role="status">
              <strong>{c.elevatedTitle}</strong>
              <p>{c.requiresStandardUser}</p>
            </div>
          )}
          {apps.length > 0 && (
            <div className="debloat-filters">
              <div className="debloat-filter-buttons" role="group" aria-label={c.filterLabel}>
                {(["all", "removable", "unavailable"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={appFilter === option}
                    onClick={() => setAppFilter(option)}
                  >
                    {c[option]}{" "}
                    <span>
                      {option === "all"
                        ? showAbsent
                          ? apps.length
                          : installed.length
                        : option === "removable"
                          ? removable.length
                          : installed.length - removable.length}
                    </span>
                  </button>
                ))}
              </div>
              <label className="debloat-search">
                <span className="sr-only">{c.search}</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={c.search}
                  disabled={running}
                />
              </label>
            </div>
          )}
          <div className="debloat-library-controls">
            <div className="debloat-categories" role="group" aria-label={l.categories}>
              {(["all", "media", "productivity", "connections", "windows"] as const).map((key) => (
                <button key={key} aria-pressed={category === key} onClick={() => setCategory(key)}>
                  {key === "all" ? c.all : l[key]}
                  <span>
                    {
                      (showAbsent ? apps : installed).filter(
                        (a) => key === "all" || categoryOf(a) === key,
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
            <label className="debloat-show-absent">
              <input
                type="checkbox"
                checked={showAbsent}
                onChange={(e) => setShowAbsent(e.target.checked)}
              />
              {l.showAbsent}
            </label>
          </div>
          <div className="debloat-view-options">
            <label>
              {l.sort}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "category")}
              >
                <option value="name">{l.name}</option>
                <option value="category">{l.category}</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={selectedOnly}
                onChange={(e) => setSelectedOnly(e.target.checked)}
              />
              {l.selectedOnly} <span>{chosen.length}</span>
            </label>
          </div>
          {recoveryError && <ToolStatus tone="error">{recoveryError}</ToolStatus>}
          {!scanning && !scanError && installed.length === 0 && <ToolStatus>{c.empty}</ToolStatus>}
          {!scanning && installed.length > 0 && filtered.length === 0 && (
            <ToolStatus>{c.noMatch}</ToolStatus>
          )}
          <div className="debloat-list" aria-busy={scanning}>
            {scanning &&
              !apps.length &&
              [0, 1, 2, 3].map((n) => (
                <div className="debloat-skeleton" key={n} aria-hidden="true">
                  <i />
                  <span />
                  <span />
                </div>
              ))}
            {filtered.map((app) => {
              const canRemove = app.removable && !!app.packageFullName;
              return (
                <div
                  key={app.packageFullName ?? app.catalogId}
                  className={`debloat-row ${canRemove ? "" : "unavailable"} ${app.packageFullName && selection.has(app.packageFullName) ? "is-selected" : ""}`}
                >
                  <label className="debloat-row-choice">
                    <input
                      type="checkbox"
                      checked={!!app.packageFullName && selection.has(app.packageFullName)}
                      disabled={!canRemove || scanning || running || !!scanError}
                      onChange={() => toggle(app)}
                    />
                    <AppMark app={app} />
                    <span className="debloat-row-main">
                      <strong>{app.name}</strong>
                      <span className="debloat-app-category">{l[categoryOf(app)]}</span>
                    </span>
                  </label>
                  <span className={`debloat-availability ${canRemove ? "is-removable" : ""}`}>
                    {!app.installed ? l.notInstalled : canRemove ? c.removable : c.unavailable}
                  </span>
                  <p className="debloat-impact">{impact(app)}</p>
                  <details className="debloat-row-details">
                    <summary>{c.details}</summary>
                    <p>{app.description}</p>
                    {app.storeUrl && (
                      <button
                        className="debloat-store-link"
                        disabled={!!recoveryBusy || running}
                        onClick={() => void openRecovery(app.catalogId)}
                      >
                        {recoveryBusy === app.catalogId ? c.scanning : "Microsoft Store ↗"}
                      </button>
                    )}
                    {app.installed && !canRemove && app.reason !== "requiresStandardUser" && (
                      <p>{reason(app.reason)}</p>
                    )}
                    {app.packageFullName && (
                      <>
                        <small>{c.identity}</small>
                        <code>{app.packageFullName}</code>
                      </>
                    )}
                  </details>
                </div>
              );
            })}
          </div>
          <details className="debloat-protected">
            <summary>{c.protectedTitle}</summary>
            <p>{c.protected}</p>
            <p>{c.scope}</p>
          </details>
          <div className="debloat-action" data-has-selection={chosen.length > 0 || running}>
            <div className="debloat-selection-tools">
              <button
                disabled={running || scanning || !!scanError || !filtered.some((a) => a.removable)}
                onClick={() =>
                  setSelection(
                    (previous) =>
                      new Set([
                        ...previous,
                        ...filtered
                          .filter((a) => a.removable && a.packageFullName)
                          .map((a) => a.packageFullName!),
                      ]),
                  )
                }
              >
                {l.selectVisible}
              </button>
              <button
                disabled={running || scanning || !selection.size}
                onClick={() => setSelection(new Set())}
              >
                {l.clear}
              </button>
            </div>
            <span>
              {chosen.length} {c.selected}
            </span>
            <button
              type="button"
              disabled={chosen.length === 0 || running || scanning || !!scanError}
              onClick={() => setPreviewApps(chosen)}
            >
              {c.preview}
            </button>
          </div>
          {running && <ToolStatus busy>{c.removing}</ToolStatus>}
          {results.length > 0 && (
            <div className="tool-panel debloat-results" aria-live="polite">
              <h3>{c.resultTitle}</h3>
              <p>{c.resultNote}</p>
              <ul>
                {results.map((result) => (
                  <li key={result.packageFullName}>
                    <strong>{appName(result.catalogId)}</strong>
                    <span data-status={result.status}>{status(result.status)}</span>
                    {result.error && <small>{result.error}</small>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!running && results.length > 0 && scanError && (
            <ToolStatus tone="error">{c.refreshError}</ToolStatus>
          )}
        </div>
      )}

      {view === "suggestions" && (
        <div className="tool-panel debloat-info">
          <h3>{c.privacyTitle}</h3>
          <p>{c.privacyText}</p>
          <ul className="debloat-controls">
            {SUGGESTION_IDS.map(
              (id) =>
                s.tweaks[id] && (
                  <li key={id}>
                    <strong>{s.tweaks[id].name}</strong>
                    <span>{s.tweaks[id].description}</span>
                  </li>
                ),
            )}
          </ul>
          <div className="debloat-links">
            <button type="button" onClick={() => onNavigate("privacy")}>
              {c.openPrivacy}
            </button>
            <button type="button" onClick={() => onNavigate("profiles")}>
              {c.openProfiles}: {STARTER_COPY[lang].study}
            </button>
            {FEATURE_INTELLIGENCE && (
              <button type="button" onClick={() => onNavigate("ledger")}>
                {c.openRollback}
              </button>
            )}
          </div>
          <p className="debloat-caveat">{c.privacyNote}</p>
        </div>
      )}

      {view === "history" && (
        <div className="debloat-stack">
          <div className="tool-panel debloat-toolbar">
            <div>
              <h3>{c.history}</h3>
              <p>{c.recoveryNote}</p>
            </div>
            <button
              type="button"
              className="debloat-secondary"
              onClick={() => void loadHistory().catch(() => {})}
              disabled={running}
            >
              {c.reloadHistory}
            </button>
          </div>
          {historyError && (
            <ToolStatus tone="error">
              {c.historyError} {historyError}
            </ToolStatus>
          )}
          {recoveryError && (
            <ToolStatus tone="error">
              {c.recoveryError} {recoveryError}
            </ToolStatus>
          )}
          {historyLoading && <ToolStatus busy>{c.loadingHistory}</ToolStatus>}
          {!historyLoading && !historyError && records.length === 0 && (
            <ToolStatus>{c.historyEmpty}</ToolStatus>
          )}
          <ol className="debloat-history">
            {[...records]
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((record, index) => (
                <li
                  className="tool-panel"
                  key={`${record.timestamp}-${record.packageFullName}-${index}`}
                >
                  <div>
                    <strong>{appName(record.catalogId)}</strong>
                    <span data-status={record.status}>{status(record.status)}</span>
                  </div>
                  <time>
                    {Number.isFinite(record.timestamp)
                      ? new Date(record.timestamp * 1000).toLocaleString(lang)
                      : c.dateUnknown}
                  </time>
                  <code>{record.packageFullName}</code>
                  {record.error && <p className="debloat-reason">{record.error}</p>}
                  {record.status === "removed" && (
                    <button
                      type="button"
                      onClick={() => void openRecovery(record.catalogId)}
                      disabled={!!recoveryBusy}
                    >
                      {recoveryBusy === record.catalogId ? "…" : c.recovery}
                    </button>
                  )}
                </li>
              ))}
          </ol>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="debloat-dialog"
        aria-labelledby="debloat-preview-title"
        onClose={() => setPreviewApps(null)}
      >
        {previewApps && (
          <div>
            <h2 id="debloat-preview-title">{c.previewTitle}</h2>
            <p>{c.previewIntro}</p>
            <p className="debloat-dialog-scope">{c.currentUser}</p>
            <ul>
              {previewApps.map((app) => (
                <li key={app.packageFullName}>
                  <strong>{app.name}</strong>
                  <span>{impact(app)}</span>
                  <small>{c.identity}</small>
                  <code>{app.packageFullName}</code>
                </li>
              ))}
            </ul>
            <p className="debloat-caveat">{c.recoveryNote}</p>
            <div className="debloat-dialog-actions">
              <button
                type="button"
                className="debloat-secondary"
                onClick={() => setPreviewApps(null)}
              >
                {c.cancel}
              </button>
              <button type="button" onClick={() => void removeSelected()}>
                {c.remove}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
