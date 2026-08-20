import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, Strings } from "../i18n";
import { StartupEntry, Toast } from "../types";
import { RocketIcon } from "./icons";
import { ShieldBadge, Toggle } from "./ui";

/**
 * Reads and toggles the same Run + StartupApproved registry entries Windows'
 * own Task Manager uses, so what's shown here matches what Windows reports
 * and disabling something is exactly as reversible as doing it there.
 */
export function StartupManager({
  s,
  pushToast,
}: {
  s: Strings;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [items, setItems] = useState<StartupEntry[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const keyOf = (item: StartupEntry) => `${item.scope}:${item.name}`;

  async function refresh() {
    const list = await invoke<StartupEntry[]>("list_startup_items");
    setItems(list);
    setLoaded(true);
  }

  useEffect(() => {
    refresh().catch((e) => pushToast("error", String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleItem(item: StartupEntry) {
    setBusyKey(keyOf(item));
    try {
      await invoke("set_startup_enabled", {
        scope: item.scope,
        name: item.name,
        enabled: !item.enabled,
      });
      await refresh();
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusyKey(null);
    }
  }

  const enabledCount = items.filter((i) => i.enabled).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-surface-1 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">{s.startupManager.title}</h2>
          {loaded && items.length > 0 && (
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2">
              {format(s.startupManager.activeCount, { enabled: enabledCount, total: items.length })}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-3">{s.startupManager.description}</p>
        <p className="mt-2 text-xs text-ink-3">{s.startupManager.impactNote}</p>
      </div>

      {loaded && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-3">
          {s.startupManager.empty}
        </div>
      )}

      {items.map((item, i) => (
        <div
          key={keyOf(item)}
          style={{ animationDelay: `${i * 40}ms` }}
          className="animate-card group relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 transition-colors hover:border-line-2 hover:bg-surface-2"
        >
          <div className="flex items-center gap-4">
            <div
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
                item.enabled
                  ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                  : "bg-surface-2 text-ink-3 ring-1 ring-line"
              }`}
            >
              <RocketIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{item.name}</h3>
                {item.requires_admin && (
                  <>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
                      {s.startupManager.machineWide}
                    </span>
                    <ShieldBadge label={s.badges.admin} />
                  </>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-3" title={item.command}>
                {item.command}
              </p>
            </div>
            <Toggle
              checked={item.enabled}
              busy={busyKey === keyOf(item)}
              onClick={() => toggleItem(item)}
              s={s}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
