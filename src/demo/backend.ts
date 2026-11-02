// A pretend PC for the browser demo (demo/boot.ts): answers the app's native
// commands with fixed sample data and timings, and emits the same events as
// the Rust side ("driver-scan-progress", "fix-progress"). Nothing here is
// measured; it exists so the Scan -> Fix all -> proof card -> Safe optimize
// flow can be reviewed in a browser. Never part of a production build.
import catalog from "../../site/src/generated/tweak-catalog.json";
import type {
  AuditEntry,
  CacheGroup,
  GameEntry,
  DriftReport,
  DriveInfo,
  DriverAudit,
  EcoQosState,
  HardwareAudit,
  InterruptSample,
  JunkTarget,
  RamBoostStatus,
  RegistryScan,
  ScanFixPlan,
  ScanFixResult,
  ScheduledTaskEntry,
  StartupEntry,
  SystemProfile,
  SystemStats,
  TweakAdvice,
  TweakInfo,
} from "../types";
import type { HealthResult } from "../components/health";
import type { DebloatRecord } from "../components/debloat";
import type { BeforeAfter, MetricChange } from "../components/before-after";
import { APPS, GAMES, auditEntry, initialAudit, liveReadings, pageAnswer } from "./pages";

type Emit = (event: string, payload: unknown) => void;
type Args = Record<string, unknown> | undefined;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** A delay that differs a little on every run, like a real PC. */
const vary = (ms: number) => Math.round(ms * (0.85 + Math.random() * 0.3));
const now = () => Math.floor(Date.now() / 1000);
const GB = 1024 ** 3;

// The settings the scan finds slowing this PC down (Fix all); the neutral
// ones stay for Safe optimize to apply afterwards.
const RECOMMENDED = new Set([
  "disable_startup_delay",
  "disable_game_dvr",
  "disable_start_suggestions",
  "disable_suggested_apps",
  "disable_tailored_experiences",
  "reset_advertising_id",
  "disable_app_launch_tracking",
  "disable_bing_search",
  "network_throttling_index",
  "disable_location_tracking",
  "disable_background_apps",
  "auto_end_frozen_tasks",
  "disable_telemetry_tasks",
  "hardware_gpu_scheduling",
  "games_gpu_priority",
  "system_responsiveness",
]);
const NEUTRAL = new Set([
  "menu_show_delay",
  "disable_feedback_requests",
  "disable_windows_suggestions",
  "block_oem_device_apps",
  "show_file_extensions",
  "classic_context_menu",
]);
const ALREADY_SET = new Set(["hide_taskbar_chat", "disable_cortana"]);

type Pc = {
  applied: Set<string>;
  /** Change history, newest first, like the app's audit log. */
  audit: AuditEntry[];
  removals: DebloatRecord[];
  on: Set<string>;
  games: GameEntry[];
  cleaned: Set<string>;
  cachesCleared: boolean;
  registryRemoved: Set<string>;
  purged: boolean;
  /** Settings changed since the last "before" measurement. */
  lastChange: number;
  health: number;
};

const JUNK: JunkTarget[] = [
  {
    id: "temp_cleanup",
    files: 6120,
    bytes: 1.62 * GB,
    accessible: true,
    requires_admin: false,
    requires_pro: false,
  },
  {
    id: "winupdate_cache_cleanup",
    files: 2592,
    bytes: 2.17 * GB,
    accessible: true,
    requires_admin: true,
    requires_pro: true,
  },
];
const CACHES: CacheGroup[] = [
  {
    id: "nvidia_dx",
    category: "shaders",
    name: "NVIDIA DirectX shader cache",
    bytes: 0.41 * GB,
    files: 96,
    blocked_by: "",
  },
  {
    id: "steam_htmlcache",
    category: "launchers",
    name: "Steam web cache",
    bytes: 0.23 * GB,
    files: 1840,
    blocked_by: "",
  },
  {
    id: "discord_cache",
    category: "apps",
    name: "Discord cache",
    bytes: 0.18 * GB,
    files: 912,
    blocked_by: "",
  },
];
const REGISTRY: RegistryScan = {
  items: [
    {
      id: "r1",
      class: "uninstall",
      hive: "HKLM",
      key: "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OldTool",
      value: null,
      label: "OldTool 2.1",
      missing: "C:\\Program Files\\OldTool\\uninst.exe",
    },
    {
      id: "r2",
      class: "app_paths",
      hive: "HKLM",
      key: "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\viewer.exe",
      value: null,
      label: "viewer.exe",
      missing: "C:\\Program Files\\Viewer\\viewer.exe",
    },
    {
      id: "r3",
      class: "mui_cache",
      hive: "HKCU",
      key: "Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache",
      value: "C:\\Games\\demo.exe.FriendlyAppName",
      label: "demo.exe",
      missing: "C:\\Games\\demo.exe",
    },
    {
      id: "r4",
      class: "mui_cache",
      hive: "HKCU",
      key: "Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache",
      value: "C:\\Tools\\setup.exe.FriendlyAppName",
      label: "setup.exe",
      missing: "C:\\Tools\\setup.exe",
    },
    {
      id: "r5",
      class: "startup_run",
      hive: "HKCU",
      key: "Software\\Microsoft\\Windows\\CurrentVersion\\Run",
      value: "Updater",
      label: "Updater",
      missing: "C:\\Old\\updater.exe",
    },
    {
      id: "r6",
      class: "shared_dlls",
      hive: "HKLM",
      key: "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\SharedDLLs",
      value: "C:\\Program Files\\OldTool\\core.dll",
      label: "core.dll",
      missing: "C:\\Program Files\\OldTool\\core.dll",
    },
  ],
};

function tweaks(pc: Pc): TweakInfo[] {
  return catalog.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category as TweakInfo["category"],
    hive: t.hive,
    requires_admin: t.requires_admin,
    requires_pro: t.requires_pro,
    changes: t.changes as TweakInfo["changes"],
    min_build: t.min_build,
    pro_edition: t.pro_edition,
    enterprise_edition: t.enterprise_edition,
    applied: pc.applied.has(t.id),
    already_set: ALREADY_SET.has(t.id),
    unavailable: null,
  }));
}

function advice(ids: string[]): TweakAdvice[] {
  return ids.map((id) => ({
    id,
    verdict: RECOMMENDED.has(id) ? "recommended" : NEUTRAL.has(id) ? "neutral" : "notrecommended",
    reason_key: null,
  }));
}

function health(pc: Pc): HealthResult {
  const factor = (id: string, label: string, earned: number, max: number, evidence: string) => ({
    id,
    label,
    earned,
    max,
    evidence,
  });
  return {
    ts: now(),
    comparison: null,
    report: {
      overall: pc.health,
      categories: [
        {
          id: "security",
          score: 100,
          factors: [
            factor("sec_defender", "Microsoft Defender", 40, 40, "Real-time protection on"),
            factor("sec_uac", "User Account Control", 30, 30, "On"),
            factor("sec_smartscreen", "SmartScreen", 30, 30, "On"),
          ],
        },
        {
          id: "performance",
          score: pc.health - 6,
          factors: [factor("perf_startup", "Startup programs", 12, 20, "9 enabled")],
        },
      ],
    },
  };
}

function stats(): SystemStats {
  return {
    cpu_usage: 9 + Math.random() * 12,
    cpu_name: "AMD Ryzen 7 7700X",
    cpu_cores: 16,
    ram_used: (11.2 + Math.random() * 0.6) * GB,
    ram_total: 32 * GB,
    disk_used: 702 * GB,
    disk_total: 931 * GB,
    os_name: "Windows 11 Pro",
    uptime_secs: 5 * 3600 + 1200,
  };
}

const PROFILE: SystemProfile = {
  windows_version: "Windows 11 Pro",
  windows_build: "26100",
  cpu: "AMD Ryzen 7 7700X",
  cpu_physical_cores: 8,
  cpu_logical_cores: 16,
  gpu: "NVIDIA GeForce RTX 4070",
  ram_total_bytes: 32 * GB,
  system_disk: "nvme",
  form_factor: "desktop",
  power_plan_guid: "381b4222-f694-41f0-9685-ff5bb260df2e",
  power_plan: "Balanced",
};
const DRIVES: DriveInfo[] = [
  {
    letter: "C:",
    media_type: "NVMe",
    total_bytes: 931 * GB,
    free_bytes: 229 * GB,
    is_system: true,
  },
  {
    letter: "D:",
    media_type: "HDD",
    total_bytes: 1863 * GB,
    free_bytes: 141 * GB,
    is_system: false,
  },
];
const STARTUP: StartupEntry[] = [
  ["Steam", "C:\\Program Files (x86)\\Steam\\steam.exe -silent"],
  ["Discord", "C:\\Users\\Demo\\AppData\\Local\\Discord\\Update.exe --processStart Discord.exe"],
  [
    "EpicGamesLauncher",
    "C:\\Program Files (x86)\\Epic Games\\Launcher\\EpicGamesLauncher.exe -silent",
  ],
  ["OneDrive", "C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe /background"],
].map(([name, command]) => ({
  name,
  command,
  scope: "user",
  location: "run" as const,
  enabled: true,
  requires_admin: false,
  orphaned: false,
}));
const TASKS: ScheduledTaskEntry[] = [
  {
    path: "\\GoogleUpdateTaskMachineUA",
    name: "GoogleUpdateTaskMachineUA",
    command: "C:\\Program Files (x86)\\Google\\Update\\GoogleUpdate.exe",
    author: "Google LLC",
    enabled: true,
    trigger: "logon",
    requires_admin: true,
  },
];
const ECO: EcoQosState = {
  enabled: false,
  engine_running: false,
  blocked_global: false,
  rules: [],
  active_processes: 0,
  pending_restore: 0,
  last_error: null,
};
const DRIVERS: DriverAudit = {
  entries: [
    {
      device: "Realtek PCIe GbE Family Controller",
      version: "10.42.526.2020",
      date: "2020-05-26",
      age_days: 2351,
      class: "Net",
      provider: "Realtek",
      tier: "stale",
      vendor_url: "https://www.realtek.com/",
      important: true,
    },
    {
      device: "Realtek High Definition Audio",
      version: "6.0.9235.1",
      date: "2021-09-14",
      age_days: 1875,
      class: "MEDIA",
      provider: "Realtek",
      tier: "stale",
      vendor_url: "https://www.realtek.com/",
      important: true,
    },
    {
      device: "NVIDIA GeForce RTX 4070",
      version: "32.0.15.6094",
      date: "2026-08-19",
      age_days: 75,
      class: "Display",
      provider: "NVIDIA",
      tier: "current",
      vendor_url: "https://www.nvidia.com/drivers",
      important: true,
    },
  ],
  excluded_inbox: 212,
  total_scanned: 247,
  classes_scanned: 34,
};
const DRIVER_CLASSES = [
  "AudioEndpoint",
  "Battery",
  "Bluetooth",
  "Camera",
  "CDROM",
  "Computer",
  "DiskDrive",
  "Display",
  "Firmware",
  "HDC",
  "HIDClass",
  "Image",
  "Keyboard",
  "MEDIA",
  "Monitor",
  "Mouse",
  "MTD",
  "Net",
  "Ports",
  "PrintQueue",
  "Processor",
  "SCSIAdapter",
  "SecurityDevices",
  "SmartCardReader",
  "SoftwareComponent",
  "SoftwareDevice",
  "System",
  "USB",
  "USBDevice",
  "Volume",
  "VolumeSnapshot",
  "WPD",
  "Biometric",
  "Sensor",
];
const HARDWARE: HardwareAudit = {
  memory: {
    configured_mts: 4800,
    rated_mts: 6000,
    rated_source: "part_number",
    part_number: "F5-6000J3038F16G",
    generation: "DDR5",
    modules: 2,
    below_rated: true,
  },
  links: [
    {
      kind: "nvme",
      name: "Samsung SSD 990 PRO 1TB",
      current_gen: 4,
      max_gen: 4,
      current_width: 4,
      max_width: 4,
      below_max: false,
    },
    {
      kind: "gpu",
      name: "NVIDIA GeForce RTX 4070",
      current_gen: 4,
      max_gen: 4,
      current_width: 16,
      max_width: 16,
      below_max: false,
    },
  ],
  rebar: [{ gpu: "NVIDIA GeForce RTX 4070", state: "off", largest_window_mb: 256 }],
};
const LATENCY: InterruptSample = {
  seconds: 2,
  cpus: 16,
  interrupts_per_sec: 24_600,
  dpcs_per_sec: 6_120,
  cpu0_interrupt_share: 0.61,
  cpu0_dpc_share: 0.57,
  concentrated: true,
};

function memory(pc: Pc): RamBoostStatus {
  return {
    enabled: pc.applied.has("smart_ram_booster"),
    threshold_mb: 1024,
    can_run: false,
    lists: pc.purged
      ? { free_mb: 6920, standby_mb: 1290, modified_mb: 110 }
      : { free_mb: 820, standby_mb: 7400, modified_mb: 120 },
    total_mb: 32_768,
    last: null,
    session_count: 0,
    session_freed_mb: 0,
    last_skip: null,
  };
}

/** One measured row of the proof card. */
function change(id: string, before: number, after: number): MetricChange {
  const tiny = Math.abs(after - before) < Math.abs(before) * 0.01;
  const verdict =
    after === before || tiny
      ? "same"
      : (id === "disk_free_mb" ? after > before : after < before)
        ? "better"
        : "worse";
  return {
    id,
    before,
    after,
    beforeSamples: 7,
    afterSamples: 7,
    beforeSpreadPct: 2,
    afterSpreadPct: 2,
    changePct: before ? ((after - before) / before) * 100 : null,
    pValue: verdict === "same" ? 0.6 : 0.01,
    verdict,
    confirmed: verdict === "same" ? 0 : 1,
    afterRuns: 1,
  };
}

/** The pretend PC. `emit` delivers an event to the app's listeners. */
export function demoBackend(emit: Emit, pro: boolean) {
  const pc: Pc = {
    applied: new Set(),
    audit: [],
    removals: [],
    on: new Set(),
    games: GAMES.slice(),
    cleaned: new Set(),
    cachesCleared: false,
    registryRemoved: new Set(),
    purged: false,
    lastChange: 0,
    health: 64,
  };
  pc.audit = initialAudit(tweaks(pc));
  pc.applied = new Set(["dark_mode", "show_file_extensions"]);
  const live = liveReadings();
  const step = (payload: Record<string, unknown>) => emit("fix-progress", payload);
  /** Applies (or undoes) settings and writes them to the change history,
   *  under one origin marker like the app's batches. */
  function record(ids: string[], applied: boolean, origin?: string) {
    const all = tweaks(pc);
    for (const id of ids) {
      if (applied) pc.applied.add(id);
      else pc.applied.delete(id);
      pc.audit.unshift(
        auditEntry(
          all.find((t) => t.id === id),
          id,
          applied,
        ),
      );
    }
    if (origin && ids.length)
      pc.audit.unshift({
        ts: Math.floor(Date.now() / 1000),
        action: "origin",
        target: origin,
        elevated: false,
        success: true,
        detail: ids.join(","),
      });
  }
  let auditCancelled = false;
  // The scan's reads take their scan-length time; the same reads after a fix
  // (the report refreshing, the proof's health score) answer quickly.
  let scanUntil = 0;
  const read = (ms: number) => sleep(vary(Date.now() < scanUntil ? ms : Math.min(ms, 350)));

  async function driverAudit(): Promise<DriverAudit> {
    auditCancelled = false;
    const total = DRIVER_CLASSES.length;
    await sleep(vary(700));
    for (let done = 1; done <= total; done++) {
      if (auditCancelled) throw new Error("cancelled");
      emit("driver-scan-progress", { done, total, class: DRIVER_CLASSES[done - 1] });
      await sleep(vary(160));
    }
    await sleep(vary(500));
    return DRIVERS;
  }

  /** Runs one step of a fix: started, then finished after `ms`. */
  async function run(id: string, ms: number, extra: Record<string, unknown> = {}) {
    step({ step: id, done: false, failed: false });
    await sleep(vary(ms));
    step({ step: id, done: true, failed: false, ...extra });
  }

  /** The administrator prompt, then the restore point. */
  async function restorePoint() {
    step({ step: "restore_point", done: false, failed: false });
    await sleep(vary(1000)); // Windows asking for administrator permission
    await sleep(vary(1800));
    const rp = { kind: "created" as const, at: now() };
    step({ step: "restore_point", done: true, failed: false, restore_point: rp });
    return rp;
  }

  async function scanFix(plan: ScanFixPlan): Promise<ScanFixResult> {
    const byId = new Map(catalog.map((t) => [t.id, t]));
    const adminTweaks = plan.tweaks.filter((id) => byId.get(id)?.requires_admin);
    const userTweaks = plan.tweaks.filter((id) => !adminTweaks.includes(id));
    const sysJunk = plan.cleanups.filter((id) => JUNK.find((j) => j.id === id)?.requires_admin);
    const userJunk = plan.cleanups.filter((id) => !sysJunk.includes(id));
    const sysReg = plan.registry.filter(
      (id) => REGISTRY.items.find((r) => r.id === id)?.hive === "HKLM",
    );
    const userReg = plan.registry.filter((id) => !sysReg.includes(id));
    const elevated = adminTweaks.length + sysJunk.length + sysReg.length > 0 || plan.purge;
    step({
      plan: [
        elevated && "restore_point",
        adminTweaks.length && "system_settings",
        sysJunk.length && "system_junk",
        sysReg.length && "system_registry",
        plan.purge && "memory",
        userTweaks.length && "settings",
        userJunk.length && "junk",
        plan.app_caches.length && "caches",
        userReg.length && "registry",
      ].filter(Boolean),
    });
    const rp = elevated ? await restorePoint() : null;
    const bytes = (ids: string[]) =>
      ids.reduce((sum, id) => sum + (JUNK.find((j) => j.id === id)?.bytes ?? 0), 0);
    const cacheBytes = CACHES.filter((g) => plan.app_caches.includes(g.id)).reduce(
      (s, g) => s + g.bytes,
      0,
    );
    if (adminTweaks.length) await run("system_settings", 700, { count: adminTweaks.length });
    if (sysJunk.length) await run("system_junk", 1000, { bytes: bytes(sysJunk) });
    if (sysReg.length) await run("system_registry", 450, { count: sysReg.length });
    if (plan.purge) await run("memory", 650, { bytes: 6100 * 1024 * 1024 });
    if (userTweaks.length) await run("settings", 550, { count: userTweaks.length });
    if (userJunk.length) await run("junk", 1200, { bytes: bytes(userJunk) * 0.97 });
    if (plan.app_caches.length) await run("caches", 850, { bytes: cacheBytes });
    if (userReg.length) await run("registry", 400, { count: userReg.length });
    record(plan.tweaks, true, "scan");
    plan.cleanups.forEach((id) => pc.cleaned.add(id));
    plan.registry.forEach((id) => pc.registryRemoved.add(id));
    if (plan.app_caches.length) pc.cachesCleared = true;
    if (plan.purge) pc.purged = true;
    pc.lastChange = plan.tweaks.length + plan.cleanups.length * 3 + plan.registry.length;
    pc.health = Math.min(93, pc.health + 14);
    return {
      restore_point: rp,
      tweak_errors: [],
      cleanups: plan.cleanups.map((id) => {
        const j = JUNK.find((x) => x.id === id);
        return {
          id,
          freed_bytes: (j?.bytes ?? 0) * 0.97,
          deleted: Math.round((j?.files ?? 0) * 0.96),
          skipped: 44,
        };
      }),
      app_caches: plan.app_caches.length
        ? { id: "app_caches", freed_bytes: cacheBytes, deleted: 2848, skipped: 0 }
        : null,
      registry: plan.registry.length
        ? { removed: plan.registry.length, skipped: 0, stamp: String(Date.now()) }
        : null,
      purge: plan.purge ? { free_before_mb: 820, free_after_mb: 6920 } : null,
      errors: [],
    };
  }

  async function safeApply(ids: string[]) {
    const admin = ids.filter((id) => catalog.find((t) => t.id === id)?.requires_admin);
    const user = ids.filter((id) => !admin.includes(id));
    step({
      plan: [
        "restore_point",
        ...(admin.length ? ["system_settings"] : []),
        ...(user.length ? ["settings"] : []),
      ],
    });
    const rp = await restorePoint();
    if (admin.length) await run("system_settings", 600, { count: admin.length });
    if (user.length) await run("settings", 600, { count: user.length });
    record(ids, true, "safe-optimize");
    pc.lastChange = ids.length;
    pc.health = Math.min(93, pc.health + 3);
    return { restorePoint: rp, failures: [] };
  }

  async function baseline(role: unknown): Promise<BeforeAfter> {
    // The real measurement takes about fifteen seconds each way.
    await sleep(vary(2500));
    const big = pc.lastChange > 8;
    return {
      before: null,
      after: null,
      afterRuns: 1,
      restartedBetween: false,
      changes:
        role === "after"
          ? big
            ? [
                change("startup_apps", 9, 6),
                change("processes", 184, 171),
                change("memory_used_mb", 11_480, 10_610),
                change("timer_ms", 1, 1),
                change("launch_ms", 412, 405),
                change("disk_free_mb", 234_500, 238_700),
              ]
            : [
                change("startup_apps", 6, 6),
                change("processes", 171, 168),
                change("memory_used_mb", 10_610, 10_540),
                change("timer_ms", 1, 1),
                change("launch_ms", 405, 404),
              ]
          : [],
    };
  }

  /** Every command the app may call; anything else answers null. */
  return async function invoke(cmd: string, args: Args): Promise<unknown> {
    const a = args ?? {};
    switch (cmd) {
      // The scan's 19 reads, each with its own time.
      case "list_tweaks":
        await sleep(vary(300));
        return tweaks(pc);
      case "scan_relevant_ids":
        await sleep(vary(450));
        return catalog.map((t) => t.id);
      case "advise_tweaks":
        await sleep(vary(650));
        return advice((a.ids as string[]) ?? []);
      case "system_profile":
        scanUntil = Date.now() + 500;
        await sleep(vary(1100));
        return PROFILE;
      case "list_drives_cmd":
        await sleep(vary(600));
        return DRIVES;
      case "list_startup_items":
        await sleep(vary(1500));
        return STARTUP;
      case "system_stats":
        return stats();
      case "reboot_pending":
        await sleep(vary(800));
        return false;
      case "health_report":
        await read(2600);
        return health(pc);
      case "driver_audit":
        return driverAudit();
      case "cancel_scan":
        auditCancelled = true;
        return null;
      case "list_scheduled_tasks":
        await sleep(vary(2100));
        return TASKS;
      case "list_debloat_apps":
        await read(3300);
        return APPS.filter((x) => !pc.removals.some((r) => r.catalogId === x.catalogId));
      case "ecoqos_status":
        await read(1000);
        return { ...ECO, enabled: pc.on.has("ecoqos"), engine_running: pc.on.has("ecoqos") };
      case "junk_summary":
        await read(4200);
        return JUNK.map((j) =>
          pc.cleaned.has(j.id)
            ? { ...j, files: Math.round(j.files * 0.04), bytes: j.bytes * 0.03 }
            : j,
        );
      case "scan_app_caches":
        await read(3000);
        return pc.cachesCleared ? [] : CACHES;
      case "registry_scan":
        await read(5000);
        return { items: REGISTRY.items.filter((r) => !pc.registryRemoved.has(r.id)) };
      case "ram_boost_status":
        await read(1700);
        return memory(pc);
      case "hardware_audit":
        await sleep(vary(4700));
        return HARDWARE;
      case "interrupt_sample":
        await sleep(vary(5900));
        return LATENCY;
      // Fixes.
      case "scan_fix":
        return scanFix(a.plan as ScanFixPlan);
      case "safe_apply":
        return safeApply((a.ids as string[]) ?? []);
      case "apply_tweak":
        await sleep(vary(350));
        record([String(a.id)], true);
        return null;
      case "apply_tweaks":
        await sleep(vary(600));
        record((a.ids as string[]) ?? [], true, a.source ? String(a.source) : undefined);
        return [];
      case "rollback_tweak":
        await sleep(vary(300));
        record([String(a.id)], false);
        return null;
      case "rollback_tweaks":
        await sleep(vary(500));
        record((a.ids as string[]) ?? [], false);
        return [];
      case "run_baseline":
        return baseline(a.role);
      case "registry_restore":
        await sleep(vary(500));
        pc.registryRemoved.clear();
        return { restored: REGISTRY.items.length, skipped: 0 };
      // The rest of the window.
      case "check_update_drift":
        return {
          windowsUpdated: false,
          previousPatch: null,
          currentPatch: "26100.6899",
          reverted: [],
          alert: false,
        } satisfies DriftReport;
      case "update_alert_status":
        return { on: pro, chosen: true };
      case "plugin:app|version":
        return "1.19.0";
      case "plugin:app|name":
        return "PC Tweaker";
      case "plugin:dialog|save":
        return "C:\\Users\\Demo\\Pictures\\pc-tweaker-proof.png";
      default: {
        const page = pageAnswer(cmd, a, {
          pro,
          tweaks: () => tweaks(pc),
          applied: pc.applied,
          audit: pc.audit,
          removals: pc.removals,
          live,
          on: pc.on,
          games: pc.games,
        });
        if (page !== undefined) return page;
        return cmd.startsWith("list_") ? [] : null;
      }
    }
  };
}
