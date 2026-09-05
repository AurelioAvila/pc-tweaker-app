import "./tool-surfaces.css";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { format, Strings } from "../i18n";
import { formatBytes } from "../lib";
import {
  CacheCategory,
  CacheCleanResult,
  CacheGroup,
  CacheScanProgress,
  CookieCleanResult,
  CookieScan,
  Toast,
} from "../types";
import { GlobeIcon, TrashIcon } from "./icons";
import { ProBadge } from "./ui";

const CATEGORY_ORDER: CacheCategory[] = ["shaders", "launchers", "apps", "dev", "windows"];

/**
 * Caches belonging to programs other than Windows.
 *
 * Scanning is free and cleaning is not, on purpose: the number this produces
 * is the honest argument for the upgrade, and charging to find out whether
 * there is anything to reclaim would be charging for the question rather than
 * the answer.
 */
export function AppCacheCard({
  s,
  isPro,
  onRequirePro,
  onToast,
}: {
  s: Strings;
  isPro: boolean;
  onRequirePro: () => void;
  onToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [groups, setGroups] = useState<CacheGroup[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [scanned, setScanned] = useState<CacheScanProgress | null>(null);

  useEffect(() => {
    const unlisten = listen<CacheScanProgress>("app-cache-progress", (e) => setScanned(e.payload));
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  async function scan() {
    setScanning(true);
    try {
      const found = await invoke<CacheGroup[]>("scan_app_caches");
      setGroups(found);
      // Everything found is safe to remove by construction, so pre-selecting
      // it saves thirteen clicks. Nothing is deleted until the button below.
      setSelected(new Set(found.map((g) => g.id)));
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setScanning(false);
      setScanned(null);
    }
  }

  async function clean() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    setCleaning(true);
    try {
      const result = await invoke<CacheCleanResult>("clean_app_caches", {
        ids: [...selected],
      });
      onToast(
        "success",
        format(s.appCache.cleanedToast, { freed: formatBytes(result.freed_bytes) }),
      );
      if (result.skipped > 0) {
        onToast("error", format(s.appCache.skippedNote, { count: result.skipped }));
      }
      await scan();
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setCleaning(false);
    }
  }

  const categoryLabel: Record<CacheCategory, string> = {
    shaders: s.appCache.catShaders,
    launchers: s.appCache.catLaunchers,
    apps: s.appCache.catApps,
    dev: s.appCache.catDev,
    windows: s.appCache.catWindows,
  };

  const selectedBytes = (groups ?? [])
    .filter((g) => selected.has(g.id))
    .reduce((sum, g) => sum + g.bytes, 0);

  return (
    <li className="tool-panel tool-card tool-app-cache-card animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20">
      <div className="tool-card-head flex items-start gap-4">
        <div className="tool-card-icon grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30">
          <TrashIcon className="h-5 w-5" />
        </div>
        <div className="tool-card-copy min-w-0 flex-1">
          <h2 className="font-semibold text-ink">{s.appCache.title}</h2>
          <p className="mt-0.5 text-sm text-ink-3">{s.appCache.description}</p>
        </div>
      </div>

      <div className="tool-control-group mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void scan()}
          disabled={scanning || cleaning}
          className="tool-primary-action rounded-xl bg-sky-500 px-3.5 py-1.5 text-sm font-semibold text-sky-950 transition hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
        >
          {scanning ? s.appCache.scanning : s.appCache.scanButton}
        </button>
        {groups && groups.length > 0 && (
          <>
            <button
              onClick={() => void clean()}
              disabled={cleaning || scanning || selected.size === 0}
              className="border-line-2 text-ink-2 hover:border-accent/40 hover:text-ink flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cleaning ? s.appCache.cleaning : s.appCache.cleanButton}
              {!isPro && <ProBadge label={s.badges.pro} />}
            </button>
            <span className="text-xs text-ink-3">
              {format(s.appCache.selectedTotal, { size: formatBytes(selectedBytes) })}
            </span>
          </>
        )}
        {scanning && scanned && (
          <span className="text-xs text-ink-3">
            {scanned.index} / {scanned.total}
          </span>
        )}
      </div>

      {groups && groups.length === 0 && (
        <p className="mt-4 text-sm text-ink-3">{s.appCache.noneFound}</p>
      )}

      {groups && groups.length > 0 && (
        <>
          <p className="mt-3 text-xs text-ink-3">{s.appCache.permanentNote}</p>
          {CATEGORY_ORDER.filter((c) => groups.some((g) => g.category === c)).map((category) => (
            <div key={category} className="mt-4">
              <p className="type-label mb-1.5">{categoryLabel[category]}</p>
              <ul className="flex flex-col gap-2">
                {groups
                  .filter((g) => g.category === category)
                  .map((g) => (
                    <li key={g.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(g.id)}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(g.id);
                              else next.delete(g.id);
                              return next;
                            })
                          }
                          className="h-4 w-4 shrink-0 accent-sky-400"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {s.appCache.names[g.id] ?? g.name}
                          </p>
                          {g.blocked_by && (
                            <p className="mt-0.5 truncate text-xs text-amber-300/80">
                              {format(s.appCache.blockedBy, { process: g.blocked_by })}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-sm tabular-nums text-ink-2">
                          {formatBytes(g.bytes)}
                        </span>
                      </label>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </li>
  );
}

/**
 * Cookies, minus the ones holding a sign-in.
 *
 * The whitelist is edited here rather than in settings because it is only ever
 * meaningful next to the numbers it changes: seeing "412 to remove, 38 kept"
 * move as a domain is added is the only way to understand what the list does.
 */
export function CookieCleanerCard({
  s,
  isPro,
  onRequirePro,
  onToast,
}: {
  s: Strings;
  isPro: boolean;
  onRequirePro: () => void;
  onToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [scans, setScans] = useState<CookieScan[] | null>(null);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    invoke<string[]>("cookie_whitelist")
      .then(setWhitelist)
      .catch(() => setWhitelist([]));
  }, []);

  async function scan() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    setScanning(true);
    try {
      setScans(await invoke<CookieScan[]>("scan_cookies"));
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setScanning(false);
    }
  }

  /** Saves and immediately rescans, so the counts always match the list that
   *  produced them rather than the one from before the edit. */
  async function saveWhitelist(entries: string[]) {
    setWhitelist(entries);
    try {
      await invoke("set_cookie_whitelist", { entries });
      if (scans) await scan();
    } catch (e) {
      onToast("error", String(e));
    }
  }

  async function clean(browser: CookieScan) {
    setBusyId(browser.id);
    try {
      const result = await invoke<CookieCleanResult>("clean_cookies", {
        browsers: [browser.id],
      });
      onToast(
        "success",
        format(s.cookieCleaner.cleanedToast, { removed: result.removed, kept: result.kept }),
      );
      await scan();
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function restore(browser: CookieScan) {
    setBusyId(browser.id);
    try {
      await invoke("restore_cookies", { browser: browser.id });
      onToast("success", format(s.cookieCleaner.restoredToast, { browser: browser.name }));
      await scan();
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <li className="tool-panel tool-card tool-cookie-cleaner-card animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20">
      <div className="tool-card-head flex items-start gap-4">
        <div className="tool-card-icon grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-400/15 text-teal-300 ring-1 ring-teal-400/30">
          <GlobeIcon className="h-5 w-5" />
        </div>
        <div className="tool-card-copy min-w-0 flex-1">
          <h2 className="font-semibold text-ink">{s.cookieCleaner.title}</h2>
          <p className="mt-0.5 text-sm text-ink-3">{s.cookieCleaner.description}</p>
        </div>
      </div>

      <div className="tool-control-group mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void scan()}
          disabled={scanning}
          className="flex items-center gap-1.5 rounded-xl bg-teal-500 px-3.5 py-1.5 text-sm font-semibold text-teal-950 transition hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
        >
          {scanning ? s.cookieCleaner.scanning : s.cookieCleaner.scanButton}
          {!isPro && <ProBadge label={s.badges.pro} />}
        </button>
        <button
          onClick={() => setShowList((v) => !v)}
          className="text-xs font-semibold text-ink-2 underline-offset-2 hover:underline"
        >
          {s.cookieCleaner.whitelistTitle}
        </button>
      </div>

      {showList && (
        <div className="mt-3 rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-ink-3">{s.cookieCleaner.whitelistNote}</p>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const entry = draft.trim().toLowerCase();
              if (!entry.includes(".")) return;
              setDraft("");
              void saveWhitelist([...new Set([...whitelist, entry])].sort());
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={s.cookieCleaner.whitelistPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-teal-400/50"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-surface-1 px-3 py-1.5 text-sm font-semibold text-ink-2 ring-1 ring-line hover:text-ink"
            >
              {s.cookieCleaner.whitelistAdd}
            </button>
          </form>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {whitelist.map((entry) => (
              <button
                key={entry}
                onClick={() => void saveWhitelist(whitelist.filter((w) => w !== entry))}
                title={s.cookieCleaner.whitelistRemove}
                className="group rounded-full bg-surface-1 px-2.5 py-0.5 text-[11px] text-ink-2 ring-1 ring-line hover:text-rose-300 hover:ring-rose-400/40"
              >
                {entry}
                <span className="ml-1 opacity-40 group-hover:opacity-100">&times;</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => void saveWhitelist([])}
            className="mt-2.5 text-[11px] font-semibold text-ink-3 underline-offset-2 hover:underline"
          >
            {s.cookieCleaner.whitelistReset}
          </button>
        </div>
      )}

      {scans && scans.length === 0 && (
        <p className="mt-4 text-sm text-ink-3">{s.cookieCleaner.noneFound}</p>
      )}

      {scans && scans.length > 0 && (
        <>
          <ul className="mt-4 flex flex-col gap-2">
            {scans.map((b) => (
              <li key={b.id} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{b.name}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {format(s.cookieCleaner.totals, {
                        removable: b.removable,
                        protected: b.protected,
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => void restore(b)}
                      disabled={b.running || busyId === b.id}
                      title={s.cookieCleaner.restoreButton}
                      className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-3 ring-1 ring-line transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyId === b.id ? s.cookieCleaner.restoring : s.cookieCleaner.restoreButton}
                    </button>
                    <button
                      onClick={() => void clean(b)}
                      disabled={b.running || busyId === b.id || b.removable === 0}
                      className="rounded-xl bg-teal-500 px-3.5 py-1.5 text-sm font-semibold text-teal-950 transition hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === b.id ? s.cookieCleaner.cleaning : s.cookieCleaner.cleanButton}
                    </button>
                  </div>
                </div>
                {b.running && (
                  <p className="mt-1.5 text-xs text-amber-300/80">
                    {format(s.cookieCleaner.runningWarning, { browser: b.name })}
                  </p>
                )}
                {!b.running && b.removable === 0 && (
                  <p className="mt-1.5 text-xs text-ink-3">{s.cookieCleaner.nothingToClean}</p>
                )}
                {b.top_removable.length > 0 && (
                  <p className="mt-1.5 truncate text-[11px] text-ink-3">
                    {s.cookieCleaner.topDomains}{" "}
                    {b.top_removable
                      .slice(0, 5)
                      .map((d) => d.host.replace(/^\./, ""))
                      .join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">{s.cookieCleaner.backupNote}</p>
        </>
      )}
    </li>
  );
}
