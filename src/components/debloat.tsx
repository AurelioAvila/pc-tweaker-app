import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { STRINGS, type Lang } from "../i18n";
import { FEATURE_INTELLIGENCE } from "../lib";
import { ToolHeader, ToolStatus } from "./tool-section";
import { DEBLOAT_COPY, DEBLOAT_IMPACT } from "./debloat-copy";
import { STARTER_COPY } from "./starter-copy";
import "./debloat.css";

export interface DebloatApp {
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

function AppMark({ id }: { id: string }) {
  const paths: Record<string, React.ReactNode> = {
    solitaire: (
      <>
        <path d="M12 3 4 12l8 9 8-9-8-9Z" />
        <path d="M12 7v10M8 12h8" />
      </>
    ),
    weather: (
      <>
        <circle cx="8" cy="8" r="3" />
        <path d="M15 18H6a3 3 0 0 1 0-6h1m5 6h5a3 3 0 0 0-.7-5.9 5 5 0 0 0-9-1" />
      </>
    ),
    news: (
      <>
        <path d="M5 3h12v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm12 4h3v11a2 2 0 0 1-2 2H6" />
        <path d="M8 7h6M8 11h6M8 15h6" />
      </>
    ),
    copilot: (
      <>
        <path d="m12 2 2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1L12 2Z" />
      </>
    ),
    clipchamp: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="m10 8 6 4-6 4V8Z" />
      </>
    ),
    outlook: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="m4 8 8 6 8-6" />
      </>
    ),
  };
  return (
    <span className={`debloat-app-mark debloat-app-mark-${id}`} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[id] ?? (
          <>
            <rect x="4" y="4" width="16" height="16" rx="4" />
            <path d="M8 12h8" />
          </>
        )}
      </svg>
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
  const filtered = installed.filter((app) => {
    const available = app.removable && !!app.packageFullName;
    return (
      (appFilter === "all" || (appFilter === "removable" ? available : !available)) &&
      `${app.name} ${app.packageFullName ?? ""}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase())
    );
  });
  const chosen = installed.filter(
    (app) => app.packageFullName && selection.has(app.packageFullName) && app.removable,
  );
  const appName = (catalogId: string) =>
    apps.find((app) => app.catalogId === catalogId)?.name ?? catalogId;
  const impact = (app: DebloatApp) => c[DEBLOAT_IMPACT[app.catalogId]] ?? app.impact;
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
        <ToolHeader
          title={c.title}
          description={c.intro}
          actions={<span className="debloat-scope">{c.currentUser}</span>}
        />
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
              <p>
                {installed.length} {c.installed.toLocaleLowerCase()} · {removable.length}{" "}
                {c.removable.toLocaleLowerCase()}
              </p>
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
          {installed.length > 0 && (
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
                        ? installed.length
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
          {!scanning && !scanError && installed.length === 0 && <ToolStatus>{c.empty}</ToolStatus>}
          {!scanning && installed.length > 0 && filtered.length === 0 && (
            <ToolStatus>{c.noMatch}</ToolStatus>
          )}
          <div className="debloat-list">
            {filtered.map((app) => {
              const canRemove = app.removable && !!app.packageFullName;
              return (
                <div
                  key={app.packageFullName ?? app.catalogId}
                  className={`debloat-row ${canRemove ? "" : "unavailable"}`}
                >
                  <label className="debloat-row-choice">
                    <input
                      type="checkbox"
                      checked={!!app.packageFullName && selection.has(app.packageFullName)}
                      disabled={!canRemove || scanning || running || !!scanError}
                      onChange={() => toggle(app)}
                    />
                    <AppMark id={app.catalogId} />
                    <span className="debloat-row-main">
                      <strong>{app.name}</strong>
                      <span className="debloat-impact">{impact(app)}</span>
                    </span>
                  </label>
                  <span className={`debloat-availability ${canRemove ? "is-removable" : ""}`}>
                    {canRemove ? c.removable : c.unavailable}
                  </span>
                  <details className="debloat-row-details">
                    <summary>{c.details}</summary>
                    <p>{impact(app)}</p>
                    {!canRemove && app.reason !== "requiresStandardUser" && (
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
          <div className="debloat-action">
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
