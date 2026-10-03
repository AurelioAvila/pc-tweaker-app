import type {
  DriverAudit,
  DriveInfo,
  StartupEntry,
  SystemProfile,
  SystemStats,
  TweakAdvice,
  TweakInfo,
  ScheduledTaskEntry,
  EcoQosState,
} from "./types";
import type { HealthResult } from "./components/health";
import type { DebloatApp } from "./components/debloat";
import { CONFIGURABLE_TWEAK_IDS } from "./catalog";
type Call = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export const SCAN_PROBES = [
  "list_tweaks",
  "scan_relevant_ids",
  "advise_tweaks",
  "system_profile",
  "list_drives_cmd",
  "list_startup_items",
  "system_stats",
  "reboot_pending",
  "health_report",
  "driver_audit",
  "list_scheduled_tasks",
  "list_debloat_apps",
  "ecoqos_status",
] as const;
export type ScanProbe = (typeof SCAN_PROBES)[number];
export type ProbeStatus = "reading" | "complete" | "unavailable";

/** Progress follows completed native reads, never a cosmetic timer. */
export async function collectScan(
  call: Call,
  progress: (percent: number, probe: ScanProbe, state: ProbeStatus) => void,
) {
  let completed = 0;
  const unavailable: ScanProbe[] = [];
  async function probe<T>(command: ScanProbe, args?: Record<string, unknown>): Promise<T | null> {
    progress(Math.round((completed / SCAN_PROBES.length) * 100), command, "reading");
    let state: ProbeStatus = "complete";
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        call<T>(command, args),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Read timed out")), 60_000);
        }),
      ]);
    } catch {
      unavailable.push(command);
      state = "unavailable";
      return null;
    } finally {
      clearTimeout(timeout);
      progress(Math.round((++completed / SCAN_PROBES.length) * 100), command, state);
    }
  }
  const inventory = Promise.all([
    probe<TweakInfo[]>("list_tweaks"),
    probe<string[]>("scan_relevant_ids"),
  ]).then(async ([tweaks, ids]) => {
    const advice = await probe<TweakAdvice[]>("advise_tweaks", { ids: ids ?? [] });
    return { tweaks, ids, advice };
  });
  const [settings, profile, drives, startup, stats, reboot, health, drivers, tasks, apps, eco] =
    await Promise.all([
      inventory,
      probe<SystemProfile>("system_profile"),
      probe<DriveInfo[]>("list_drives_cmd"),
      probe<StartupEntry[]>("list_startup_items"),
      probe<SystemStats>("system_stats"),
      probe<boolean>("reboot_pending"),
      probe<HealthResult>("health_report"),
      probe<DriverAudit>("driver_audit"),
      probe<ScheduledTaskEntry[]>("list_scheduled_tasks"),
      probe<DebloatApp[]>("list_debloat_apps"),
      probe<EcoQosState>("ecoqos_status"),
    ]);
  return {
    ...settings,
    profile,
    drives,
    startup,
    stats,
    reboot,
    health,
    drivers,
    tasks,
    apps,
    eco,
    unavailable,
    partial: unavailable.length > 0,
    at: Date.now(),
  };
}
export type ScanReport = Awaited<ReturnType<typeof collectScan>>;

export function unknownSecuritySignals(report: ScanReport): string[] {
  if (!report.health) return [];
  const factors = report.health.report.categories.find((c) => c.id === "security")?.factors ?? [];
  return ["sec_defender", "sec_uac", "sec_smartscreen"].flatMap((id) => {
    const factor = factors.find((f) => f.id === id);
    if (!factor) return [id];
    const known = id === "sec_defender" ? [0, 40] : id === "sec_uac" ? [0, 30] : [5, 30];
    return known.includes(factor.earned) ? [] : [`${factor.label}: ${factor.evidence}`];
  });
}

/** Optional toggles are not defects: bulk fixes require current hardware advice. */
export function recommendedTweaks(report: ScanReport, isPro: boolean): TweakInfo[] {
  const allowed = new Set(report.ids ?? []);
  const advised = new Set(
    (report.advice ?? []).filter((a) => a.verdict === "recommended").map((a) => a.id),
  );
  return (report.tweaks ?? []).filter(
    (t) =>
      allowed.has(t.id) &&
      advised.has(t.id) &&
      !t.applied &&
      (isPro || !t.requires_pro) &&
      t.id !== "turbo_boost" &&
      !CONFIGURABLE_TWEAK_IDS.has(t.id),
  );
}

/** Neutral choices remain visible for individual review, never part of Fix all. */
export function optionalScanTweaks(report: ScanReport): TweakInfo[] {
  const allowed = new Set(report.ids ?? []);
  const neutral = new Set(
    (report.advice ?? []).filter((a) => a.verdict === "neutral").map((a) => a.id),
  );
  return (report.tweaks ?? []).filter(
    (t) =>
      allowed.has(t.id) &&
      neutral.has(t.id) &&
      !t.applied &&
      t.id !== "turbo_boost" &&
      !CONFIGURABLE_TWEAK_IDS.has(t.id),
  );
}

export async function applyScanSelection(
  call: Call,
  report: ScanReport,
  isPro: boolean,
  selected: string[],
) {
  // Re-read eligibility before any write. A failed read aborts the batch.
  const [tweaks, ids] = await Promise.all([
    call<TweakInfo[]>("list_tweaks"),
    call<string[]>("scan_relevant_ids"),
  ]);
  const advice = await call<TweakAdvice[]>("advise_tweaks", { ids });
  const eligible = new Set(
    recommendedTweaks({ ...report, tweaks, ids, advice }, isPro).map((t) => t.id),
  );
  const originallyOffered = new Set(recommendedTweaks(report, isPro).map((t) => t.id));
  const requested = [...new Set(selected)].filter((id) => originallyOffered.has(id));
  const apply = requested.filter((id) => eligible.has(id));
  const skipped = requested.filter((id) => !eligible.has(id));
  let errors: string[] = [];
  if (apply.length) {
    try {
      errors = await call<string[]>("apply_tweaks", { ids: apply });
    } catch (error) {
      errors = [String(error)];
    }
  }
  let verified: TweakInfo[] | null = null;
  try {
    verified = await call<TweakInfo[]>("list_tweaks");
  } catch (error) {
    errors.push(String(error));
  }
  const fixed = apply.filter((id) => verified?.some((t) => t.id === id && t.applied));
  const failed = apply.filter((id) => !fixed.includes(id));
  return { fixed, failed, skipped, errors, tweaks: verified, advice, ids };
}
export type ScanObservation = {
  id: string;
  kind:
    | "storage"
    | "startup"
    | "memory"
    | "restart"
    | "security"
    | "drivers"
    | "tasks"
    | "apps"
    | "efficiency";
  evidence: string;
  section: "maintenance" | "startup" | "health" | "hardware" | "debloat" | "performance";
  warning: boolean;
};
export function scanObservations(r: ScanReport): ScanObservation[] {
  const rows: ScanObservation[] = [];
  for (const d of r.drives ?? [])
    if (d.total_bytes > 0 && d.free_bytes / d.total_bytes < 0.15)
      rows.push({
        id: `drive:${d.letter}`,
        kind: "storage",
        evidence: `${d.letter} · ${(d.free_bytes / 1024 ** 3).toFixed(1)} GB · ${Math.round((d.free_bytes / d.total_bytes) * 100)}%`,
        section: "maintenance",
        warning: true,
      });
  const enabled = (r.startup ?? []).filter((x) => x.enabled);
  if (enabled.length > 0)
    rows.push({
      id: "startup",
      kind: "startup",
      evidence: enabled.map((x) => x.name).join(", "),
      section: "startup",
      warning: false,
    });
  if (r.stats && r.stats.ram_total > 0 && r.stats.ram_used / r.stats.ram_total >= 0.85)
    rows.push({
      id: "memory",
      kind: "memory",
      evidence: `${Math.round((r.stats.ram_used / r.stats.ram_total) * 100)}%`,
      section: "maintenance",
      warning: true,
    });
  if (r.reboot === true)
    rows.push({ id: "restart", kind: "restart", evidence: "", section: "health", warning: true });
  const security = r.health?.report.categories.find((c) => c.id === "security");
  for (const f of security?.factors ?? [])
    if (
      (f.id === "sec_defender" && f.earned === 0) ||
      (f.id === "sec_uac" && f.earned === 0) ||
      (f.id === "sec_smartscreen" && f.earned === 5)
    )
      rows.push({
        id: f.id,
        kind: "security",
        evidence: f.label,
        section: "health",
        warning: true,
      });
  for (const d of r.drivers?.entries ?? [])
    if (d.age_days >= 730)
      rows.push({
        id: `driver:${d.device}:${d.version}`,
        kind: "drivers",
        evidence: `${d.device} · ${d.date}`,
        section: "hardware",
        warning: false,
      });
  const tasks = (r.tasks ?? []).filter((task) => task.enabled);
  if (tasks.length)
    rows.push({
      id: "scheduled-startup",
      kind: "tasks",
      evidence: tasks.map((task) => task.name).join(", "),
      section: "startup",
      warning: false,
    });
  const apps = (r.apps ?? []).filter((app) => app.installed && app.removable);
  if (apps.length)
    rows.push({
      id: "optional-windows-apps",
      kind: "apps",
      evidence: apps.map((app) => app.name).join(", "),
      section: "debloat",
      warning: false,
    });
  if (r.eco?.blocked_global && r.eco.enabled)
    rows.push({
      id: "efficiency-conflict",
      kind: "efficiency",
      evidence: "EcoQoS",
      section: "performance",
      warning: true,
    });
  return rows;
}

export const LAST_SCAN_KEY = "pc-tweaker-last-scan-v1";
export type LastScan = { at: number; partial: boolean };
export function readLastScan(raw: string | null): LastScan | null {
  try {
    const value = JSON.parse(raw ?? "null");
    return value &&
      Number.isFinite(value.at) &&
      value.at > 0 &&
      value.at <= Date.now() &&
      typeof value.partial === "boolean"
      ? { at: value.at, partial: value.partial }
      : null;
  } catch {
    return null;
  }
}
