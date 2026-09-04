import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, Strings } from "../i18n";
import { ScheduledTaskEntry, StartupEntry, Toast } from "../types";
import { HistoryIcon, RocketIcon } from "./icons";
import { ShieldBadge, Toggle } from "./ui";

/**
 * Reads and toggles the same StartupApproved entries Windows' own Task Manager
 * uses, so what's shown here matches what Windows reports and disabling
 * something is exactly as reversible as doing it there.
 *
 * Three places, not one: the 64-bit `Run` key, its 32-bit counterpart under
 * `WOW6432Node`, and the Startup folder. This app is a 64-bit process, so
 * reading only the first meant every entry belonging to 32-bit software — most
 * consumer installers — was silently missing from a list whose entire job is to
 * be complete.
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
  const [rescanning, setRescanning] = useState(false);

  // Location is part of the key: the same program name can legitimately
  // appear in the registry and in the Startup folder, and a key without it
  // would put both rows into the busy state on one click.
  const keyOf = (item: StartupEntry) => `${item.scope}:${item.location}:${item.name}`;

  async function refresh() {
    const list = await invoke<StartupEntry[]>("list_startup_items");
    setItems(list);
    setLoaded(true);
  }

  /**
   * The user-facing rescan.
   *
   * The list was already read fresh from the registry on every mount — there
   * is no cache — but nothing on screen said so, so a list that still showed
   * software you had just uninstalled looked like the app was holding a stale
   * copy. (It wasn't: the uninstaller left its Run value behind, which is why
   * those rows are now dropped entirely.) An explicit button with a visible
   * pass gives that check somewhere to happen, and the brief hold below makes
   * it legible: an instant no-op re-render reads as a dead button.
   */
  async function rescan() {
    setRescanning(true);
    const startedAt = Date.now();
    try {
      await refresh();
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      const elapsed = Date.now() - startedAt;
      window.setTimeout(() => setRescanning(false), Math.max(0, 450 - elapsed));
    }
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
        location: item.location,
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

  /**
   * Entries whose executable is gone are dropped, not listed.
   *
   * They were briefly shown with a "no longer installed" badge, on the
   * reasoning that hiding real registry state is worse than explaining it.
   * That was the wrong call for this screen: this list answers "what starts
   * with my PC", and a program that has been uninstalled does not start with
   * anything — the row was noise dressed up as information. The count below
   * keeps it from being a silent disappearance.
   */
  /** Startup-folder rows carry the shortcut's real file name, because that is
   *  the key the registry write needs. Trimming `.lnk` is a display decision
   *  and belongs here rather than in the code that has to get the key right. */
  const displayName = (item: StartupEntry) =>
    item.location === "folder" ? item.name.replace(/\.(lnk|url)$/i, "") : item.name;

  const locationLabel: Record<StartupEntry["location"], string> = {
    run: s.startupManager.locationRun,
    run32: s.startupManager.locationRun32,
    folder: s.startupManager.locationFolder,
  };

  const visible = items.filter((i) => !i.orphaned);
  const hiddenCount = items.length - visible.length;
  const enabledCount = visible.filter((i) => i.enabled).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-surface-1 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">{s.startupManager.title}</h2>
          <div className="flex items-center gap-2">
            {loaded && visible.length > 0 && (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2">
                {format(s.startupManager.activeCount, {
                  enabled: enabledCount,
                  total: visible.length,
                })}
              </span>
            )}
            <button
              onClick={() => void rescan()}
              disabled={rescanning}
              className="border-line-2 text-ink-2 hover:border-accent/40 hover:text-ink flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-wait"
            >
              <span
                className={`inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent ${
                  rescanning ? "animate-spin" : ""
                }`}
              />
              {rescanning ? s.startupManager.refreshing : s.startupManager.refresh}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-3">{s.startupManager.description}</p>
        <p className="mt-2 text-xs text-ink-3">{s.startupManager.impactNote}</p>
        {hiddenCount > 0 && (
          <p className="mt-1.5 text-xs text-ink-3">
            {format(s.startupManager.hiddenOrphans, { count: hiddenCount })}
          </p>
        )}
      </div>

      {loaded && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-3">
          {s.startupManager.empty}
        </div>
      )}

      {visible.map((item, i) => (
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
                <h3 className="font-semibold text-ink">{displayName(item)}</h3>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-3">
                  {locationLabel[item.location]}
                </span>
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

/**
 * Third-party tasks that run at sign-in or boot.
 *
 * A separate list from the one above because it answers the same question
 * through a different mechanism, and because the safety rules differ: these
 * are read from the Task Scheduler, Windows' own tasks are filtered out in the
 * backend and never reach this component, and most rows need administrator
 * rights to change.
 */
export function ScheduledTaskManager({
  s,
  pushToast,
}: {
  s: Strings;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [tasks, setTasks] = useState<ScheduledTaskEntry[]>([]);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  async function refresh() {
    setTasks(await invoke<ScheduledTaskEntry[]>("list_scheduled_tasks"));
    setLoaded(true);
  }

  /** Reading the tasks means one `schtasks` call per candidate, so unlike the
   *  registry list above this genuinely takes a moment — no artificial hold is
   *  needed to make the button feel like it did something. */
  async function rescan() {
    setRescanning(true);
    try {
      await refresh();
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setRescanning(false);
    }
  }

  useEffect(() => {
    refresh().catch((e) => pushToast("error", String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleTask(task: ScheduledTaskEntry) {
    setBusyPath(task.path);
    try {
      await invoke("set_scheduled_task_enabled", {
        path: task.path,
        enabled: !task.enabled,
      });
      await refresh();
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusyPath(null);
    }
  }

  const enabledCount = tasks.filter((t) => t.enabled).length;

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-surface-1 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">{s.scheduledTasks.title}</h2>
          <div className="flex items-center gap-2">
            {loaded && tasks.length > 0 && (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2">
                {format(s.scheduledTasks.activeCount, {
                  enabled: enabledCount,
                  total: tasks.length,
                })}
              </span>
            )}
            <button
              onClick={() => void rescan()}
              disabled={rescanning}
              className="border-line-2 text-ink-2 hover:border-accent/40 hover:text-ink flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-wait"
            >
              <span
                className={`inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent ${
                  rescanning ? "animate-spin" : ""
                }`}
              />
              {rescanning ? s.scheduledTasks.refreshing : s.scheduledTasks.refresh}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-3">{s.scheduledTasks.description}</p>
        <p className="mt-2 text-xs text-ink-3">{s.scheduledTasks.note}</p>
      </div>

      {loaded && tasks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-3">
          {s.scheduledTasks.empty}
        </div>
      )}

      {tasks.map((task, i) => (
        <div
          key={task.path}
          style={{ animationDelay: `${i * 40}ms` }}
          className="animate-card group relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 transition-colors hover:border-line-2 hover:bg-surface-2"
        >
          <div className="flex items-center gap-4">
            <div
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
                task.enabled
                  ? "bg-violet-400/15 text-violet-300 ring-1 ring-violet-400/30"
                  : "bg-surface-2 text-ink-3 ring-1 ring-line"
              }`}
            >
              <HistoryIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{task.name}</h3>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-3">
                  {task.trigger === "boot"
                    ? s.scheduledTasks.triggerBoot
                    : s.scheduledTasks.triggerLogon}
                </span>
                {task.requires_admin && <ShieldBadge label={s.badges.admin} />}
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-3" title={task.command || task.path}>
                {task.command || task.path}
              </p>
            </div>
            <Toggle
              checked={task.enabled}
              busy={busyPath === task.path}
              onClick={() => toggleTask(task)}
              s={s}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
