import { useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, Strings } from "../i18n";
import { formatBytes } from "../lib";
import { AuditEntry, DriveInfo, Section, StartupEntry, SystemStats } from "../types";

/**
 * The honest half of the health dashboard: real numbers the machine already
 * knows (drive space, startup apps, uptime), each linking to the section
 * where the user can act. Deliberately NO composite "health score" — a single
 * invented number is the signature move of the scareware this app defines
 * itself against. Everything here is read-only.
 */

/** Drive fill levels where the bar changes color. Facts about "almost full",
 *  not a judgment: 85% is where Windows itself starts complaining. */
const DRIVE_WARN_FRACTION = 0.85;
const DRIVE_CRITICAL_FRACTION = 0.95;

/** Uptime beyond which the (factual) restart hint appears. */
const LONG_UPTIME_DAYS = 7;

function driveBarColor(usedFraction: number): string {
  if (usedFraction >= DRIVE_CRITICAL_FRACTION) return "bg-red-400";
  if (usedFraction >= DRIVE_WARN_FRACTION) return "bg-amber-400";
  return "bg-emerald-400";
}

function uptimeLabel(s: Strings, uptimeSecs: number): string {
  const days = Math.floor(uptimeSecs / 86400);
  const hours = Math.floor((uptimeSecs % 86400) / 3600);
  const minutes = Math.floor((uptimeSecs % 3600) / 60);
  return days > 0
    ? format(s.scan.dashUptimeDh, { days, hours })
    : format(s.scan.dashUptimeHm, { hours, minutes });
}

/** Maps audit action keys to their translated labels; unknown keys render
 *  as-is so a newer log never shows blank rows in an older UI. */
function actionLabel(s: Strings, action: string): string {
  switch (action) {
    case "tweak-applied":
      return s.scan.dashActTweakApplied;
    case "tweak-reverted":
      return s.scan.dashActTweakReverted;
    case "cleanup":
      return s.scan.dashActCleanup;
    case "files-deleted":
      return s.scan.dashActFilesDeleted;
    case "startup-change":
      return s.scan.dashActStartupChange;
    case "disk-optimize":
      return s.scan.dashActDiskOptimize;
    case "restore-point":
      return s.scan.dashActRestorePoint;
    default:
      return action;
  }
}

function timeLabel(ts: number): string {
  const d = new Date(ts * 1000);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString();
}

function Card({
  title,
  onAction,
  actionLabel,
  children,
}: {
  title: string;
  onAction?: () => void;
  actionLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{title}</p>
        {onAction && actionLabel && (
          <button
            onClick={onAction}
            className="rounded-lg px-2 py-0.5 text-[11px] font-semibold text-indigo-300 hover:bg-surface-2"
          >
            {actionLabel} →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function DashboardCards({
  s,
  onNavigate,
}: {
  s: Strings;
  onNavigate: (section: Section) => void;
}) {
  const [drives, setDrives] = useState<DriveInfo[] | null>(null);
  const [startup, setStartup] = useState<StartupEntry[] | null>(null);
  const [uptimeSecs, setUptimeSecs] = useState<number | null>(null);
  const [history, setHistory] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    // Read-only snapshots; a failed card simply doesn't render rather than
    // showing made-up data.
    invoke<DriveInfo[]>("list_drives_cmd")
      .then((v) => {
        if (alive) setDrives(v);
      })
      .catch(() => {
        if (alive) setDrives([]);
      });
    invoke<StartupEntry[]>("list_startup_items")
      .then((v) => {
        if (alive) setStartup(v);
      })
      .catch(() => {
        if (alive) setStartup([]);
      });
    invoke<SystemStats>("system_stats")
      .then((v) => {
        if (alive) setUptimeSecs(v.uptime_secs);
      })
      .catch(() => {
        // Card stays hidden.
      });
    invoke<AuditEntry[]>("list_audit_log")
      .then((v) => {
        if (alive) setHistory(v);
      })
      .catch(() => {
        if (alive) setHistory([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const showDrives = drives !== null && drives.length > 0;
  const showStartup = startup !== null && startup.length > 0;
  const showUptime = uptimeSecs !== null;
  if (!showDrives && !showStartup && !showUptime) return null;

  const enabledStartup = (startup ?? []).filter((e) => e.enabled).length;
  const longUptime = (uptimeSecs ?? 0) >= LONG_UPTIME_DAYS * 86400;

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {showDrives && (
        <Card
          title={s.scan.dashDrivesTitle}
          onAction={() => onNavigate("manutenzione")}
          actionLabel={s.scan.dashManage}
        >
          <div className="flex flex-col gap-3">
            {drives.map((d) => {
              const used = d.total_bytes - d.free_bytes;
              const fraction = d.total_bytes > 0 ? used / d.total_bytes : 0;
              return (
                <div key={d.letter}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-2">{d.letter}</span>
                    <span className="text-[11.5px] text-ink-3">
                      {format(s.scan.dashFreeOf, {
                        free: formatBytes(d.free_bytes),
                        total: formatBytes(d.total_bytes),
                      })}
                      {fraction >= DRIVE_WARN_FRACTION && (
                        <span className="ml-1.5 font-semibold text-amber-300">
                          {s.scan.dashAlmostFull}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${driveBarColor(fraction)}`}
                      style={{ width: `${String(Math.min(100, Math.round(fraction * 100)))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {showStartup && (
        <Card
          title={s.scan.dashStartupTitle}
          onAction={() => onNavigate("startup")}
          actionLabel={s.scan.dashManage}
        >
          <p className="text-2xl font-bold text-ink">
            {enabledStartup}
            <span className="ml-1 text-sm font-medium text-ink-3">/ {startup.length}</span>
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
            {format(s.scan.dashStartupCount, { on: enabledStartup, total: startup.length })}
          </p>
        </Card>
      )}

      {showUptime && (
        <Card title={s.scan.dashUptimeTitle}>
          <p className="text-2xl font-bold text-ink">{uptimeLabel(s, uptimeSecs)}</p>
          {longUptime && (
            <p className="mt-1 text-[12px] leading-relaxed text-amber-200/80">
              {s.scan.dashUptimeLongHint}
            </p>
          )}
        </Card>
      )}

      {history !== null && (
        <Card title={s.scan.dashHistoryTitle}>
          {history.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-ink-3">{s.scan.dashHistoryEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {history.slice(0, 5).map((e, i) => (
                <li
                  key={`${String(e.ts)}-${String(i)}`}
                  className="flex items-baseline gap-2 text-[12px]"
                  title={e.detail ?? undefined}
                >
                  <span
                    aria-hidden="true"
                    className={e.success ? "text-emerald-400" : "text-red-400"}
                  >
                    {e.success ? "✓" : "✗"}
                  </span>
                  <span className="text-ink-2">{actionLabel(s, e.action)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-3">{e.target}</span>
                  <span className="shrink-0 text-ink-3">{timeLabel(e.ts)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
