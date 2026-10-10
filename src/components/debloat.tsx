import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { format, STRINGS, type Lang } from "../i18n";
import { FEATURE_INTELLIGENCE } from "../lib";
import {
  canRemove,
  estimatedSpace,
  filterApps,
  footprint,
  formatSize,
  pruneSelection,
  recommendedSelection,
  sortApps,
  tierOf,
  type Category,
  type SortKey,
  type Tier,
} from "../debloat-model";
import { ToolStatus } from "./tool-section";
import { Badge, type BadgeKind } from "./ui";
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
  publisher?: string | null;
  sizeBytes?: number | null;
  dataBytes?: number | null;
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
type Step = {
  app: DebloatApp;
  state: "waiting" | "removing" | Result["status"];
  error?: string | null;
};
const SUGGESTION_IDS = [
  "disable_start_suggestions",
  "disable_suggested_apps",
  "disable_tailored_experiences",
  "disable_feedback_requests",
] as const;
const CATEGORIES: Category[] = ["all", "media", "productivity", "connections", "windows"];
const TIER_KIND: Record<Tier, BadgeKind> = { recommended: "ok", safe: "info", caution: "warn" };
const STATUS_KIND: Record<Step["state"], BadgeKind> = {
  waiting: "muted",
  removing: "accent",
  removed: "ok",
  failed: "danger",
  unknown: "warn",
  pending: "muted",
};

function AppMark({ app }: { app: Pick<DebloatApp, "iconDataUrl" | "name"> }) {
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
  const s = STRINGS[lang];
  const [view, setView] = useState<View>("apps");
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("tier");
  const [showLocked, setShowLocked] = useState(false);
  const [showAbsent, setShowAbsent] = useState(false);
  const [apps, setApps] = useState<DebloatApp[]>([]);
  const [records, setRecords] = useState<DebloatRecord[]>([]);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<DebloatApp[] | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
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
      setSelection((previous) => pruneSelection(next, previous));
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
    if (confirming && !dialog?.open) dialog?.showModal();
    if (!confirming && dialog?.open) dialog.close();
  }, [confirming]);

  const busy = running || scanning || !!scanError;
  function toggle(app: DebloatApp) {
    if (!canRemove(app) || busy) return;
    setSelection((previous) => {
      const next = new Set(previous);
      if (next.has(app.packageFullName!)) next.delete(app.packageFullName!);
      else next.add(app.packageFullName!);
      return next;
    });
  }

  async function removeSelected() {
    if (!confirming?.length || runningRef.current) return;
    const batch = confirming;
    runningRef.current = true;
    setRunning(true);
    setConfirming(null);
    setSteps(batch.map((app) => ({ app, state: "waiting" })));
    for (const [index, app] of batch.entries()) {
      const packageFullName = app.packageFullName;
      if (!packageFullName) continue;
      setSteps((current) =>
        current.map((step, i) => (i === index ? { ...step, state: "removing" } : step)),
      );
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
      setSteps((current) =>
        current.map((step, i) =>
          i === index ? { ...step, state: result.status, error: result.error } : step,
        ),
      );
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

  const categoryOf = (app: DebloatApp) => APP_CATEGORIES[app.catalogId] ?? "windows";
  const installed = apps.filter((app) => app.installed);
  const removable = apps.filter(canRemove);
  const elevated = installed.some((app) => app.reason === "requiresStandardUser");
  const filters = { category, query, showLocked, showAbsent };
  const visible = sortApps(filterApps(apps, filters, categoryOf), sortBy, lang);
  const counted = (key: Category) =>
    filterApps(apps, { ...filters, category: key, query: "" }, categoryOf).length;
  const chosen = removable.filter((app) => selection.has(app.packageFullName!));
  const space = estimatedSpace(apps, selection);
  const freeable = estimatedSpace(apps, new Set(removable.map((a) => a.packageFullName!)));
  const size = (bytes: number | null) => formatSize(bytes, lang) ?? c.sizeUnknown;
  const recommended = recommendedSelection(visible);
  const appByCatalog = (catalogId: string) => apps.find((app) => app.catalogId === catalogId);
  const impact = (app: DebloatApp) =>
    c[DEBLOAT_IMPACT[app.catalogId]] ?? EXTRA_IMPACTS[lang][app.catalogId] ?? app.impact;
  const tierLabel = (tier: Tier) =>
    tier === "recommended" ? c.tierRecommended : tier === "safe" ? c.tierSafe : c.tierCaution;
  const tierHint = (tier: Tier) =>
    tier === "recommended"
      ? c.tierHintRecommended
      : tier === "safe"
        ? c.tierHintSafe
        : c.tierHintCaution;
  const reason = (value: string | null) =>
    value === "publisherMismatch" ||
    value === "protectedPackage" ||
    value === "dependency" ||
    value === "nonRemovable" ||
    value === "unverifiedRemovability" ||
    value === "requiresStandardUser"
      ? c[value]
      : c.unavailable;
  const stateLabel = (state: Step["state"]) =>
    state === "waiting" ? c.waiting : state === "removing" ? c.removing : c[state];
  const done = steps.filter((step) => step.state !== "waiting" && step.state !== "removing").length;
  const filtered = category !== "all" || query.trim() !== "" || showLocked || showAbsent;

  return (
    <section className="debloat" aria-label={c.title}>
      <header className="debloat-hero">
        <div className="debloat-hero-copy">
          <p className="debloat-eyebrow">{l.eyebrow}</p>
          <h2>{l.title}</h2>
          <p>{l.intro}</p>
        </div>
        <dl className="debloat-stats" aria-live="polite">
          <div>
            <dt>{c.installed}</dt>
            <dd>{scanning && !apps.length ? "–" : installed.length}</dd>
          </div>
          <div>
            <dt>{c.removable}</dt>
            <dd>{scanning && !apps.length ? "–" : removable.length}</dd>
          </div>
          <div title={c.spaceNote}>
            <dt>{c.statSpace}</dt>
            <dd>
              {scanning && !apps.length ? "–" : format(c.upTo, { size: size(freeable.bytes) })}
            </dd>
          </div>
        </dl>
        <Badge kind="muted" className="debloat-scope-badge">
          {c.currentUser}
        </Badge>
      </header>

      <nav className="debloat-tabs" aria-label={c.title}>
        {(["apps", "suggestions", "history"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-current={view === tab ? "page" : undefined}
            onClick={() => setView(tab)}
          >
            {c[tab]}
            {tab === "history" && records.length > 0 && <Badge>{records.length}</Badge>}
          </button>
        ))}
      </nav>

      {view === "apps" && (
        <div className="debloat-stack">
          <div className="debloat-toolbar">
            <label className="debloat-search">
              <span className="sr-only">{c.search}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path
                  d="m10.5 10.5 3 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={c.search}
                disabled={running}
              />
            </label>
            <label className="debloat-sort">
              <span>{l.sort}</span>
              <select
                className="tool-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
              >
                <option value="tier">{c.sortTier}</option>
                <option value="size">{c.sortSize}</option>
                <option value="name">{l.name}</option>
              </select>
            </label>
            <button
              type="button"
              className="tool-secondary-action"
              disabled={scanning || running}
              onClick={() => void scan()}
            >
              {scanning ? c.scanning : c.scan}
            </button>
          </div>

          <div className="debloat-segments" role="group" aria-label={l.categories}>
            {CATEGORIES.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={category === key}
                onClick={() => setCategory(key)}
              >
                {key === "all" ? c.all : l[key]}
                <Badge kind={category === key ? "accent" : "neutral"}>{counted(key)}</Badge>
              </button>
            ))}
          </div>

          <div className="debloat-options">
            <label>
              <input
                type="checkbox"
                checked={showLocked}
                onChange={(e) => setShowLocked(e.target.checked)}
              />
              {c.showLocked}
            </label>
            <label>
              <input
                type="checkbox"
                checked={showAbsent}
                onChange={(e) => setShowAbsent(e.target.checked)}
              />
              {l.showAbsent}
            </label>
            <span className="debloat-options-spacer" />
            <button
              type="button"
              className="tool-secondary-action"
              disabled={busy || recommended.every((id) => selection.has(id))}
              title={c.tierHintRecommended}
              onClick={() => setSelection((previous) => new Set([...previous, ...recommended]))}
            >
              {c.selectRecommended}
            </button>
          </div>

          {scanError && (
            <ToolStatus tone="error">
              {c.scanError} {scanError}
            </ToolStatus>
          )}
          {elevated && !scanning && (
            <div className="debloat-elevated" role="status">
              <strong>{c.elevatedTitle}</strong>
              <p>{c.requiresStandardUser}</p>
            </div>
          )}
          {recoveryError && <ToolStatus tone="error">{recoveryError}</ToolStatus>}
          {!scanning && !scanError && installed.length === 0 && (
            <div className="debloat-empty">
              <strong>{c.empty}</strong>
            </div>
          )}
          {!scanning && apps.length > 0 && visible.length === 0 && (
            <div className="debloat-empty">
              <strong>{query.trim() ? c.noMatch : c.emptyFilter}</strong>
              {filtered && (
                <button
                  type="button"
                  className="tool-secondary-action"
                  onClick={() => {
                    setCategory("all");
                    setQuery("");
                  }}
                >
                  {c.clearFilters}
                </button>
              )}
            </div>
          )}

          <ul className="debloat-list" aria-busy={scanning}>
            {scanning &&
              !apps.length &&
              [0, 1, 2, 3, 4].map((n) => (
                <li className="debloat-skeleton" key={n} aria-hidden="true">
                  <i />
                  <span />
                  <span />
                </li>
              ))}
            {visible.map((app) => {
              const removableApp = canRemove(app);
              const selected = removableApp && selection.has(app.packageFullName!);
              const tier = tierOf(app);
              const bytes = footprint(app);
              return (
                <li
                  key={app.packageFullName ?? app.catalogId}
                  className="debloat-row"
                  data-selected={selected}
                  data-locked={!removableApp}
                >
                  <label className="debloat-row-hit">
                    <input
                      type="checkbox"
                      className="debloat-check"
                      checked={selected}
                      disabled={!removableApp || busy}
                      onChange={() => toggle(app)}
                      aria-describedby={`impact-${app.catalogId}`}
                    />
                    <AppMark app={app} />
                    <span className="debloat-row-text">
                      <span className="debloat-row-title">
                        <strong>{app.name}</strong>
                        {app.installed && (
                          <Badge kind={TIER_KIND[tier]} title={tierHint(tier)}>
                            {tierLabel(tier)}
                          </Badge>
                        )}
                        {app.installed && !removableApp && (
                          <Badge kind="muted" title={reason(app.reason)}>
                            {c.lockedBadge}
                          </Badge>
                        )}
                        {!app.installed && <Badge kind="muted">{l.notInstalled}</Badge>}
                      </span>
                      <span className="debloat-row-sub">
                        {[app.publisher, l[categoryOf(app)]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </label>
                  <span className="debloat-row-size" title={c.spaceNote}>
                    {app.installed ? size(bytes) : ""}
                  </span>
                  <details className="debloat-row-more">
                    <summary title={impact(app)}>
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <circle
                          cx="8"
                          cy="8"
                          r="6.2"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          fill="none"
                        />
                        <path
                          d="M8 7.2v4"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                        <circle cx="8" cy="5" r="0.8" fill="currentColor" />
                      </svg>
                      {c.whatYouLose}
                    </summary>
                    <div className="debloat-row-details">
                      <p id={`impact-${app.catalogId}`}>{impact(app)}</p>
                      <p className="debloat-muted">{app.description}</p>
                      {app.installed && !removableApp && (
                        <p className="debloat-muted">{reason(app.reason)}</p>
                      )}
                      {app.installed && (app.sizeBytes != null || app.dataBytes != null) && (
                        <p className="debloat-muted">
                          {c.appFiles}: {size(app.sizeBytes ?? null)} · {c.appData}:{" "}
                          {size(app.dataBytes ?? null)}
                        </p>
                      )}
                      {app.packageFullName && (
                        <p className="debloat-identity">
                          <small>{c.identity}</small>
                          <code>{app.packageFullName}</code>
                        </p>
                      )}
                      {app.storeUrl && (
                        <button
                          type="button"
                          className="tool-secondary-action"
                          disabled={!!recoveryBusy || running}
                          onClick={() => void openRecovery(app.catalogId)}
                        >
                          {recoveryBusy === app.catalogId ? c.scanning : `${c.recovery} ↗`}
                        </button>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>

          <details className="debloat-protected">
            <summary>{c.protectedTitle}</summary>
            <p>{c.protected}</p>
            <p>{c.scope}</p>
          </details>

          {steps.length > 0 && (
            <div className="tool-panel debloat-progress" aria-live="polite">
              <div className="debloat-progress-head">
                <h3>
                  {running ? format(c.progress, { done, total: steps.length }) : c.resultTitle}
                </h3>
                <div className="debloat-progress-bar" aria-hidden="true">
                  <span style={{ width: `${(done / steps.length) * 100}%` }} />
                </div>
              </div>
              <ul>
                {steps.map((step) => (
                  <li key={step.app.packageFullName}>
                    <AppMark app={step.app} />
                    <strong>{step.app.name}</strong>
                    <Badge kind={STATUS_KIND[step.state]}>{stateLabel(step.state)}</Badge>
                    {step.state === "removed" && step.app.storeUrl && (
                      <button
                        type="button"
                        className="tool-secondary-action"
                        disabled={!!recoveryBusy}
                        onClick={() => void openRecovery(step.app.catalogId)}
                      >
                        {c.reinstall} ↗
                      </button>
                    )}
                    {step.error && <small>{step.error}</small>}
                  </li>
                ))}
              </ul>
              {!running && <p className="debloat-muted">{c.resultNote}</p>}
              {!running && scanError && <ToolStatus tone="error">{c.refreshError}</ToolStatus>}
            </div>
          )}

          <div className="debloat-actionbar" data-visible={chosen.length > 0 && !running}>
            <span className="debloat-actionbar-summary">
              {chosen.length
                ? format(c.selectionSummary, {
                    count: chosen.length,
                    size: size(space.bytes),
                  })
                : c.selectionNone}
            </span>
            <button
              type="button"
              className="tool-secondary-action"
              disabled={busy || !selection.size}
              onClick={() => setSelection(new Set())}
            >
              {l.clear}
            </button>
            <button
              type="button"
              className="tool-danger-action"
              disabled={chosen.length === 0 || busy}
              onClick={() => setConfirming(chosen)}
            >
              {chosen.length === 1 ? c.removeOne : format(c.removeCount, { count: chosen.length })}
            </button>
          </div>
        </div>
      )}

      {view === "suggestions" && (
        <div className="debloat-stack">
          <div className="tool-panel debloat-panel">
            <h3>{c.privacyTitle}</h3>
            <p className="debloat-muted">{c.privacyText}</p>
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
              <button
                type="button"
                className="tool-primary-action"
                onClick={() => onNavigate("privacy")}
              >
                {c.openPrivacy}
              </button>
              <button
                type="button"
                className="tool-secondary-action"
                onClick={() => onNavigate("profiles")}
              >
                {c.openProfiles}: {STARTER_COPY[lang].study}
              </button>
              {FEATURE_INTELLIGENCE && (
                <button
                  type="button"
                  className="tool-secondary-action"
                  onClick={() => onNavigate("ledger")}
                >
                  {c.openRollback}
                </button>
              )}
            </div>
            <p className="debloat-caveat">{c.privacyNote}</p>
          </div>
        </div>
      )}

      {view === "history" && (
        <div className="debloat-stack">
          <div className="tool-panel debloat-panel">
            <div className="debloat-panel-head">
              <div>
                <h3>{c.history}</h3>
                <p className="debloat-muted">{c.recoveryNote}</p>
              </div>
              <button
                type="button"
                className="tool-secondary-action"
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
              <div className="debloat-empty">
                <strong>{c.historyEmpty}</strong>
              </div>
            )}
            <ol className="debloat-history">
              {[...records]
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((record, index) => {
                  const app = appByCatalog(record.catalogId);
                  return (
                    <li key={`${record.timestamp}-${record.packageFullName}-${index}`}>
                      <AppMark
                        app={{ name: app?.name ?? record.catalogId, iconDataUrl: app?.iconDataUrl }}
                      />
                      <div className="debloat-history-main">
                        <span className="debloat-row-title">
                          <strong>{app?.name ?? record.catalogId}</strong>
                          <Badge kind={STATUS_KIND[record.status]}>{c[record.status]}</Badge>
                        </span>
                        <time>
                          {Number.isFinite(record.timestamp)
                            ? new Date(record.timestamp * 1000).toLocaleString(lang)
                            : c.dateUnknown}
                        </time>
                        <code>{record.packageFullName}</code>
                        {record.error && <p className="debloat-reason">{record.error}</p>}
                      </div>
                      {record.status === "removed" && (
                        <button
                          type="button"
                          className="tool-secondary-action"
                          onClick={() => void openRecovery(record.catalogId)}
                          disabled={!!recoveryBusy}
                        >
                          {recoveryBusy === record.catalogId ? "…" : `${c.reinstall} ↗`}
                        </button>
                      )}
                    </li>
                  );
                })}
            </ol>
          </div>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="debloat-dialog"
        aria-labelledby="debloat-preview-title"
        onClose={() => setConfirming(null)}
      >
        {confirming && (
          <div>
            <h2 id="debloat-preview-title">
              {format(c.confirmTitle, { count: confirming.length })}
            </h2>
            <p className="debloat-muted">{c.previewIntro}</p>
            <div className="debloat-dialog-meta">
              <Badge kind="muted">{c.currentUser}</Badge>
              <Badge>
                {format(c.confirmSpace, {
                  size: size(
                    estimatedSpace(confirming, new Set(confirming.map((a) => a.packageFullName!)))
                      .bytes,
                  ),
                })}
              </Badge>
            </div>
            <ul>
              {confirming.map((app) => (
                <li key={app.packageFullName}>
                  <AppMark app={app} />
                  <div>
                    <span className="debloat-row-title">
                      <strong>{app.name}</strong>
                      <Badge kind={TIER_KIND[tierOf(app)]}>{tierLabel(tierOf(app))}</Badge>
                    </span>
                    <span className="debloat-muted">{impact(app)}</span>
                    <code>{app.packageFullName}</code>
                  </div>
                </li>
              ))}
            </ul>
            <p className="debloat-caveat">{c.recoveryNote}</p>
            <div className="debloat-dialog-actions">
              <button
                type="button"
                className="tool-secondary-action"
                autoFocus
                onClick={() => setConfirming(null)}
              >
                {c.cancel}
              </button>
              <button
                type="button"
                className="tool-danger-action"
                onClick={() => void removeSelected()}
              >
                {confirming.length === 1
                  ? c.removeOne
                  : format(c.removeCount, { count: confirming.length })}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
