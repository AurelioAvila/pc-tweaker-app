import "./tool-surfaces.css";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, localeOf, type Lang, type Strings } from "../i18n";
import { formatNumber } from "../lib";
import { REGISTRY_CLASSES } from "../scan-items";
import type {
  RegistryBackup,
  RegistryClass,
  RegistryRestoreResult,
  RegistryScan,
  ScanFixResult,
  Toast,
} from "../types";
import { SCAN2_COPY } from "./scan2-copy";
import { Badge } from "./ui";

function RegistryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <path d="m14 17 2 2 4-4.5" />
    </svg>
  );
}

/**
 * Registry leftovers of removed programs, five safe kinds only
 * (src-tauri/src/regclean.rs). Finding them is free; cleaning is Pro and
 * always writes a backup first; restoring a backup is free.
 */
export function RegistryCleanerCard({
  s,
  lang,
  isPro,
  onRequirePro,
  onToast,
}: {
  s: Strings;
  lang: Lang;
  isPro: boolean;
  onRequirePro: () => void;
  onToast: (kind: Toast["kind"], message: string) => void;
}) {
  const c = SCAN2_COPY[lang];
  const [found, setFound] = useState<RegistryScan | null>(null);
  const [selected, setSelected] = useState<Set<RegistryClass>>(new Set());
  const [backups, setBackups] = useState<RegistryBackup[]>([]);
  const [busy, setBusy] = useState<"scan" | "clean" | string | null>(null);

  async function loadBackups() {
    setBackups(await invoke<RegistryBackup[]>("registry_backups").catch(() => []));
  }
  useEffect(() => {
    void invoke<RegistryBackup[]>("registry_backups")
      .catch(() => [])
      .then(setBackups);
  }, []);

  async function scan() {
    setBusy("scan");
    try {
      const result = await invoke<RegistryScan>("registry_scan");
      setFound(result);
      setSelected(new Set(result.items.map((i) => i.class)));
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setBusy(null);
    }
  }

  async function clean() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    if (!found) return;
    setBusy("clean");
    try {
      const ids = found.items.filter((i) => selected.has(i.class)).map((i) => i.id);
      const result = await invoke<ScanFixResult>("scan_fix", {
        plan: { tweaks: [], cleanups: [], app_caches: [], registry: ids, purge: false },
      });
      const removed = result.registry?.removed ?? 0;
      onToast("success", format(c.doneRegistry, { count: formatNumber(removed) }));
      for (const e of result.errors) onToast("error", e);
      await loadBackups();
      setBusy(null);
      await scan();
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setBusy(null);
    }
  }

  async function restore(stamp: string) {
    setBusy(stamp);
    try {
      const result = await invoke<RegistryRestoreResult>("registry_restore", { stamp });
      onToast("success", format(c.restoredRegistry, { count: formatNumber(result.restored) }));
      if (found) {
        setBusy(null);
        await scan();
      }
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setBusy(null);
    }
  }

  const count = (cls: RegistryClass) => found?.items.filter((i) => i.class === cls).length ?? 0;
  const chosen = found?.items.filter((i) => selected.has(i.class)).length ?? 0;

  return (
    <li className="tool-panel tool-card tool-registry-card animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg">
      <div className="tool-card-head flex items-start gap-4">
        <div className="tool-card-icon grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-accent/30">
          <RegistryIcon className="h-5 w-5" />
        </div>
        <div className="tool-card-copy min-w-0 flex-1">
          <h2 className="font-semibold text-ink">{c.rcTitle}</h2>
          <p className="mt-0.5 text-sm text-ink-3">{c.rcBody}</p>
        </div>
      </div>

      <div className="tool-control-group mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void scan()}
          disabled={busy !== null}
          className="tool-primary-action"
        >
          {busy === "scan" ? c.rcScanning : c.rcScan}
        </button>
        {found && found.items.length > 0 && (
          <>
            <button
              onClick={() => void clean()}
              disabled={busy !== null || chosen === 0}
              className="tool-secondary-action"
            >
              {busy === "clean" ? c.rcCleaning : c.rcClean}
              {!isPro && <Badge kind="pro">{s.badges.pro}</Badge>}
            </button>
            <span className="text-xs text-ink-3">
              {format(c.rcFound, { count: formatNumber(found.items.length) })}
            </span>
          </>
        )}
      </div>

      {found && found.items.length === 0 && <p className="mt-4 text-sm text-ink-3">{c.rcNone}</p>}

      {found && found.items.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {REGISTRY_CLASSES.filter((cls) => count(cls) > 0).map((cls) => (
            <li key={cls}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(cls)}
                  disabled={busy !== null}
                  onChange={(e) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(cls);
                      else next.delete(cls);
                      return next;
                    })
                  }
                  className="h-4 w-4 shrink-0 accent-accent"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{c.registry[cls][0]}</p>
                  <p className="mt-0.5 text-xs text-ink-3">{c.registry[cls][1]}</p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-ink-2">
                  {formatNumber(count(cls))}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {found && found.items.length > 0 && (
        <p className="mt-3 text-xs text-ink-3">{c.registryNote}</p>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <p className="type-label mb-1.5">{c.rcBackups}</p>
        {backups.length === 0 ? (
          <p className="text-xs text-ink-3">{c.rcNoBackups}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {backups.slice(0, 5).map((b) => (
              <li key={b.stamp} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-2">
                  {format(c.rcBackupLine, {
                    date: new Date(Number(b.stamp)).toLocaleString(localeOf(lang)),
                    count: formatNumber(b.items),
                  })}
                </span>
                <button
                  onClick={() => void restore(b.stamp)}
                  disabled={busy !== null}
                  className="tool-secondary-action"
                >
                  {busy === b.stamp ? c.restoringRegistry : c.rcRestore}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
