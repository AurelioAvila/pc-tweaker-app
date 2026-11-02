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
  CacheGroup,
  HardwareAudit,
  InterruptSample,
  JunkTarget,
  RamBoostStatus,
  RegistryScan,
  ScanFixPlan,
  ScanFixResult,
} from "./types";
import type { HealthResult } from "./components/health";
import { factorEvidence, factorLabel } from "./components/health-copy";
import type { Lang } from "./i18n";
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
  "junk_summary",
  "scan_app_caches",
  "registry_scan",
  "ram_boost_status",
  "hardware_audit",
  "interrupt_sample",
] as const;
/** Index of the first check added in 1.19 (marked "New" in the scope list). */
export const FIRST_NEW_PROBE = SCAN_PROBES.indexOf("junk_summary");
export type ScanProbe = (typeof SCAN_PROBES)[number];
export type ProbeStatus = "reading" | "complete" | "unavailable";

/** Progress follows completed native reads, never a cosmetic timer. */
/** Thrown by [`collectScan`] when its signal is aborted. */
export class ScanCancelled extends Error {
  constructor() {
    super("SCAN_CANCELLED");
    this.name = "ScanCancelled";
  }
}

/** One finished read: its answer (null when the source was unavailable) and
 *  when it was read, so a resumed scan can say how old each part is. */
export type ScanStep = { state: Exclude<ProbeStatus, "reading">; at: number; value: unknown };

/** A scan that can be paused and resumed. Every read is independent and
 *  read-only, so a paused scan keeps what it finished and a resume runs only
 *  what is missing; a read cut off by the pause is simply read again. The
 *  driver inventory resumes from the device class it stopped at (the backend
 *  keeps its partial list under `id`). Lives in memory only: closing the app
 *  discards it. */
export type ScanSession = {
  id: string;
  startedAt: number;
  steps: Partial<Record<ScanProbe, ScanStep>>;
  /** The driver audit request still running in the backend, if any. A pause
   *  or an end waits for it, so the backend has saved (or dropped) its partial
   *  inventory before the next request for this session arrives. */
  auditInFlight?: Promise<unknown>;
};

/** Resolves once no driver audit for `session` is running in the backend. */
export async function settled(session: ScanSession): Promise<void> {
  await session.auditInFlight?.catch(() => undefined);
}

export function newScanSession(now = Date.now()): ScanSession {
  return { id: `scan-${now}-${Math.random().toString(36).slice(2, 8)}`, startedAt: now, steps: {} };
}

/** How much work each check usually is (they add up to 100): half of its
 *  share of the scan ring (`scanShare`). The driver inventory is the long one. */
export const SCAN_WEIGHT: Record<ScanProbe, number> = {
  list_tweaks: 2,
  scan_relevant_ids: 2,
  advise_tweaks: 3,
  system_profile: 4,
  list_drives_cmd: 2,
  list_startup_items: 3,
  system_stats: 1,
  reboot_pending: 1,
  health_report: 8,
  driver_audit: 30,
  list_scheduled_tasks: 4,
  list_debloat_apps: 7,
  ecoqos_status: 1,
  junk_summary: 8,
  scan_app_caches: 6,
  registry_scan: 5,
  ram_boost_status: 2,
  hardware_audit: 5,
  interrupt_sample: 6,
};
/**
 * Presentation pacing: the scan ring takes at least this long from start to
 * 100 %. The reads themselves run as fast as the PC allows (usually a few
 * seconds); the ring then walks through them, never ticking a check before
 * it has really finished, giving each one a minimum time on screen
 * (`scanDwellMs`). A check that is slower than its time keeps the ring
 * waiting on it. Owner's decision for 1.19: a scan that ends in a few
 * seconds does not read as a thorough one.
 */
export const SCAN_MIN_MS = 60_000;

/** Each check's slice of the ring and of SCAN_MIN_MS, in percent: half
 *  shared evenly, half by how much work it is (SCAN_WEIGHT). Sums to 100. */
export function scanShare(probe: ScanProbe): number {
  return 50 / SCAN_PROBES.length + SCAN_WEIGHT[probe] / 2;
}

/** The minimum time a check stays the current one on the ring. */
export function scanDwellMs(probe: ScanProbe): number {
  return (SCAN_MIN_MS * scanShare(probe)) / 100;
}

/**
 * Where the scan ring heads now, 0-100. The checks already ticked off count
 * in full. The current one (`head`) fills its slice over its time on screen
 * (`headMs` of `scanDwellMs`) when it has finished (`headDone`); while it is
 * still reading it fills more slowly and never past 92 % of its slice, so a
 * check is never shown done before it is. 100 only once every check is
 * ticked and the scan has returned (`finished`), and never 99 % waiting on
 * nothing.
 */
export function scanRingTarget(o: {
  ticked: readonly ScanProbe[];
  head: ScanProbe | null;
  headDone: boolean;
  headMs: number;
  finished: boolean;
}): number {
  if (o.finished && !o.head) return 100;
  const at = o.ticked.reduce((sum, p) => sum + scanShare(p), 0);
  if (!o.head) return Math.min(99, at);
  const x = Math.max(0, o.headMs) / scanDwellMs(o.head);
  const fill = o.headDone ? Math.min(1, x) : 0.92 * (1 - Math.exp(-x));
  return Math.min(99, at + scanShare(o.head) * fill);
}

export function finishedSteps(session: ScanSession): number {
  return SCAN_PROBES.filter((probe) => session.steps[probe]).length;
}

/** Runs the reads `session` does not have yet, recording each one as it
 *  finishes. Resolves true when every read is done, false when `signal` was
 *  aborted first (a pause or a stop): the finished reads stay in `session`,
 *  answers that arrive after the abort are dropped. */
export async function runScanSession(
  call: Call,
  session: ScanSession,
  progress: (probe: ScanProbe, state: ProbeStatus) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  const stopped = new Promise<never>((_, reject) => {
    if (signal?.aborted) reject(new ScanCancelled());
    signal?.addEventListener("abort", () => reject(new ScanCancelled()), { once: true });
  });
  stopped.catch(() => undefined);
  async function probe<T>(command: ScanProbe, args?: Record<string, unknown>): Promise<T | null> {
    const done = session.steps[command];
    if (done) return done.value as T | null;
    if (signal?.aborted) throw new ScanCancelled();
    progress(command, "reading");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let step: ScanStep;
    const request = call<T>(command, args);
    if (command === "driver_audit") {
      session.auditInFlight = request;
      request.then(
        () => undefined,
        () => undefined,
      );
    }
    try {
      const value = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            // A read that ran out of time must not keep running behind the scan.
            if (command === "driver_audit") void call("cancel_scan").catch(() => undefined);
            reject(new Error("Read timed out"));
          }, 60_000);
        }),
        stopped,
      ]);
      step = { state: "complete", at: Date.now(), value };
    } catch {
      if (signal?.aborted) throw new ScanCancelled();
      step = { state: "unavailable", at: Date.now(), value: null };
    } finally {
      clearTimeout(timeout);
    }
    if (signal?.aborted) throw new ScanCancelled();
    session.steps[command] = step;
    progress(command, step.state);
    return step.value as T | null;
  }
  const inventory = Promise.all([
    probe<TweakInfo[]>("list_tweaks"),
    probe<string[]>("scan_relevant_ids"),
  ]).then(([, ids]) => probe<TweakAdvice[]>("advise_tweaks", { ids: ids ?? [] }));
  try {
    await Promise.all([
      inventory,
      probe<SystemProfile>("system_profile"),
      probe<DriveInfo[]>("list_drives_cmd"),
      probe<StartupEntry[]>("list_startup_items"),
      probe<SystemStats>("system_stats"),
      probe<boolean>("reboot_pending"),
      probe<HealthResult>("health_report"),
      probe<DriverAudit>("driver_audit", { cancellable: true, session: session.id }),
      probe<ScheduledTaskEntry[]>("list_scheduled_tasks"),
      probe<DebloatApp[]>("list_debloat_apps"),
      probe<EcoQosState>("ecoqos_status"),
      probe<JunkTarget[]>("junk_summary"),
      probe<CacheGroup[]>("scan_app_caches"),
      probe<RegistryScan>("registry_scan"),
      probe<RamBoostStatus>("ram_boost_status"),
      probe<HardwareAudit>("hardware_audit"),
      probe<InterruptSample>("interrupt_sample"),
    ]);
  } catch (e) {
    if (e instanceof ScanCancelled || signal?.aborted) return false;
    throw e;
  }
  return !signal?.aborted;
}

/** The report a session supports so far. Reads that never ran are listed in
 *  `skipped`, separately from reads that ran and failed (`unavailable`). */
export function scanReport(session: ScanSession, at = Date.now()) {
  const value = <T>(probe: ScanProbe) => (session.steps[probe]?.value ?? null) as T | null;
  const unavailable = SCAN_PROBES.filter((p) => session.steps[p]?.state === "unavailable");
  const skipped = SCAN_PROBES.filter((p) => !session.steps[p]);
  const times = SCAN_PROBES.flatMap((p) => (session.steps[p] ? [session.steps[p].at] : []));
  return {
    tweaks: value<TweakInfo[]>("list_tweaks"),
    ids: value<string[]>("scan_relevant_ids"),
    advice: value<TweakAdvice[]>("advise_tweaks"),
    profile: value<SystemProfile>("system_profile"),
    drives: value<DriveInfo[]>("list_drives_cmd"),
    startup: value<StartupEntry[]>("list_startup_items"),
    stats: value<SystemStats>("system_stats"),
    reboot: value<boolean>("reboot_pending"),
    health: value<HealthResult>("health_report"),
    drivers: value<DriverAudit>("driver_audit"),
    tasks: value<ScheduledTaskEntry[]>("list_scheduled_tasks"),
    apps: value<DebloatApp[]>("list_debloat_apps"),
    eco: value<EcoQosState>("ecoqos_status"),
    junk: value<JunkTarget[]>("junk_summary"),
    caches: value<CacheGroup[]>("scan_app_caches"),
    registry: value<RegistryScan>("registry_scan"),
    memory: value<RamBoostStatus>("ram_boost_status"),
    hardware: value<HardwareAudit>("hardware_audit"),
    latency: value<InterruptSample>("interrupt_sample"),
    unavailable,
    skipped,
    partial: unavailable.length > 0 || skipped.length > 0,
    /** When the oldest finished read was taken. */
    oldestAt: times.length ? Math.min(...times) : at,
    at,
  };
}

/** Reads every source in one go. Aborting `signal` rejects at once with
 *  [`ScanCancelled`]; reads still in flight are left to finish on their own
 *  (all of them are read-only) and their answers are dropped. */
export async function collectScan(
  call: Call,
  progress: (percent: number, probe: ScanProbe, state: ProbeStatus) => void,
  signal?: AbortSignal,
) {
  const session = newScanSession();
  const done = await runScanSession(
    call,
    session,
    (probe, state) =>
      progress(Math.round((finishedSteps(session) / SCAN_PROBES.length) * 100), probe, state),
    signal,
  );
  if (!done) throw new ScanCancelled();
  return scanReport(session);
}
export type ScanReport = ReturnType<typeof scanReport>;

/** Where each check's answer sits in a ScanReport. */
export const REPORT_KEY = {
  list_tweaks: "tweaks",
  scan_relevant_ids: "ids",
  advise_tweaks: "advice",
  system_profile: "profile",
  list_drives_cmd: "drives",
  list_startup_items: "startup",
  system_stats: "stats",
  reboot_pending: "reboot",
  health_report: "health",
  driver_audit: "drivers",
  list_scheduled_tasks: "tasks",
  list_debloat_apps: "apps",
  ecoqos_status: "eco",
  junk_summary: "junk",
  scan_app_caches: "caches",
  registry_scan: "registry",
  ram_boost_status: "memory",
  hardware_audit: "hardware",
  interrupt_sample: "latency",
} as const satisfies Record<ScanProbe, keyof ScanReport>;

/** A finished check's one-line result for the scope list: what it read and
 *  whether that is something to look at (`issue`). Measured values only. */
export type ProbeResult =
  | { kind: "ok"; issue: false }
  | { kind: "found" | "checked"; count: number; issue: boolean }
  | { kind: "bytes"; bytes: number; issue: boolean }
  | { kind: "percent"; percent: number; issue: boolean };

const OK: ProbeResult = { kind: "ok", issue: false };
const found = (count: number, issue = count > 0): ProbeResult =>
  count > 0 ? { kind: "found", count, issue } : OK;
const checked = (count: number): ProbeResult => ({ kind: "checked", count, issue: false });

/** The result of one check from its answer; null when there is none. */
export function probeResult(probe: ScanProbe, value: unknown): ProbeResult | null {
  if (value === null || value === undefined) return null;
  const list = <T>() => (Array.isArray(value) ? (value as T[]) : []);
  switch (probe) {
    case "list_tweaks":
    case "scan_relevant_ids":
    case "advise_tweaks":
      return checked(list().length);
    case "system_profile":
      return OK;
    case "list_drives_cmd": {
      const drives = list<DriveInfo>();
      const low = drives.filter((d) => d.total_bytes > 0 && d.free_bytes / d.total_bytes < 0.15);
      return low.length ? found(low.length) : checked(drives.length);
    }
    case "list_startup_items":
      return found(list<StartupEntry>().filter((x) => x.enabled).length, false);
    case "system_stats": {
      const st = value as SystemStats;
      if (!(st.ram_total > 0)) return null;
      const percent = Math.round((st.ram_used / st.ram_total) * 100);
      return { kind: "percent", percent, issue: percent >= 85 };
    }
    case "reboot_pending":
      return value === true ? found(1) : OK;
    case "health_report": {
      // This row is "Security signals": the protections found switched off.
      const factors =
        (value as HealthResult).report?.categories.find((c) => c.id === "security")?.factors ?? [];
      return found(
        factors.filter(
          (f) =>
            ((f.id === "sec_defender" || f.id === "sec_uac") && f.earned === 0) ||
            (f.id === "sec_smartscreen" && f.earned === 5),
        ).length,
      );
    }
    case "driver_audit":
      return found((value as DriverAudit).entries.filter((d) => d.age_days >= 730).length);
    case "list_scheduled_tasks":
      return found(list<ScheduledTaskEntry>().filter((t) => t.enabled).length, false);
    case "list_debloat_apps":
      return found(list<DebloatApp>().filter((a) => a.installed && a.removable).length, false);
    case "ecoqos_status": {
      const eco = value as EcoQosState;
      return eco.blocked_global && eco.enabled ? found(1) : OK;
    }
    case "junk_summary": {
      const bytes = list<JunkTarget>()
        .filter((j) => j.accessible)
        .reduce((sum, j) => sum + j.bytes, 0);
      return { kind: "bytes", bytes, issue: bytes > 0 };
    }
    case "scan_app_caches": {
      const bytes = list<CacheGroup>().reduce((sum, g) => sum + g.bytes, 0);
      return { kind: "bytes", bytes, issue: bytes > 0 };
    }
    case "registry_scan":
      return found((value as RegistryScan).items.length);
    case "ram_boost_status": {
      const m = value as RamBoostStatus;
      if (!m.lists) return null;
      return {
        kind: "bytes",
        bytes: m.lists.standby_mb * 1024 * 1024,
        issue: m.lists.free_mb < (m.threshold_mb || 1024),
      };
    }
    case "hardware_audit": {
      const h = value as HardwareAudit;
      return found(
        (h.memory?.below_rated ? 1 : 0) +
          h.links.filter((l) => l.below_max).length +
          h.rebar.filter((r) => r.state === "off").length,
      );
    }
    case "interrupt_sample":
      return (value as InterruptSample).concentrated ? found(1) : OK;
  }
}

export function unknownSecuritySignals(report: ScanReport, lang: Lang = "en"): string[] {
  if (!report.health) return [];
  const factors = report.health.report.categories.find((c) => c.id === "security")?.factors ?? [];
  return ["sec_defender", "sec_uac", "sec_smartscreen"].flatMap((id) => {
    const factor = factors.find((f) => f.id === id);
    if (!factor) return [id];
    const known = id === "sec_defender" ? [0, 40] : id === "sec_uac" ? [0, 30] : [5, 30];
    return known.includes(factor.earned)
      ? []
      : [
          `${factorLabel(lang, factor.id, factor.label)}${lang === "fr" ? " : " : ": "}${factorEvidence(lang, factor.parts, factor.evidence)}`,
        ];
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
      !t.already_set &&
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
      !t.already_set &&
      t.id !== "turbo_boost" &&
      !CONFIGURABLE_TWEAK_IDS.has(t.id),
  );
}

/** The non-setting parts of a Scan fix. */
export type ScanExtras = Omit<ScanFixPlan, "tweaks">;
export const NO_EXTRAS: ScanExtras = { cleanups: [], app_caches: [], registry: [], purge: false };
const hasExtras = (e: ScanExtras) =>
  e.cleanups.length > 0 || e.app_caches.length > 0 || e.registry.length > 0 || e.purge;

/** Applies a Scan selection in one native call (`scan_fix`, one
 *  administrator prompt at most): the eligible settings plus `extras`. */
export async function applyScanSelection(
  call: Call,
  report: ScanReport,
  isPro: boolean,
  selected: string[],
  extras: ScanExtras = NO_EXTRAS,
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
  let measured: ScanFixResult | null = null;
  if (apply.length || hasExtras(extras)) {
    try {
      measured = await call<ScanFixResult>("scan_fix", { plan: { tweaks: apply, ...extras } });
      errors = [...measured.tweak_errors, ...measured.errors];
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
  return { fixed, failed, skipped, errors, tweaks: verified, advice, ids, measured };
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
