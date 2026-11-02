// The rest of the pretend PC for the browser demo (backend.ts): what every
// page outside the Scan reads when it opens, and plausible answers to its
// buttons, so the whole window can be clicked through. Sample data only.
import type {
  AuditEntry,
  BrowserCleanupInfo,
  CleanupInfo,
  CleanupPreview,
  CookieScan,
  CoreSteeringStatus,
  DownloadLimitState,
  DpcReport,
  GameEntry,
  GpuPowerInfo,
  GpuReading,
  HudSnapshot,
  LargeFile,
  MonitorProfilesState,
  NetworkSnapshot,
  PriorityRulesStatus,
  ProcessGuardStatus,
  RepairOutcome,
  ThermalReport,
  TweakInfo,
  TweakPreview,
  TweakProfile,
  ValueChange,
  X3dReport,
} from "../types";
import type { BeforeAfter } from "../components/before-after";
import type { DebloatApp, DebloatRecord } from "../components/debloat";
import type { LiveSample } from "../live-metrics";
import type { ResourceUsers } from "../components/live-dashboard";

type Args = Record<string, unknown>;
const GB = 1024 ** 3;
const MB = 1024 ** 2;
const now = () => Math.floor(Date.now() / 1000);
const DAY = 86_400;

/** A value that wanders smoothly inside [lo, hi], like a live reading. */
function drift(lo: number, hi: number, step: number) {
  let value = (lo + hi) / 2;
  let velocity = 0;
  return () => {
    velocity = velocity * 0.7 + (Math.random() - 0.5) * step;
    value += velocity;
    if (value < lo) [value, velocity] = [lo + (lo - value), Math.abs(velocity)];
    if (value > hi) [value, velocity] = [hi - (value - hi), -Math.abs(velocity)];
    return Math.min(hi, Math.max(lo, value));
  };
}

const RATED_MHZ = 4500;
const PEAK_MHZ = 5400;

export const APPS: DebloatApp[] = [
  ["Microsoft.BingNews", "News", 38],
  ["Microsoft.GetHelp", "Get Help", 12],
  ["Clipchamp.Clipchamp", "Clipchamp", 214],
  ["Microsoft.BingWeather", "Weather", 41],
  ["Microsoft.MicrosoftSolitaireCollection", "Solitaire & Casual Games", 176],
  ["Microsoft.ZuneMusic", "Media Player", 63],
  ["Microsoft.WindowsFeedbackHub", "Feedback Hub", 29],
  ["MicrosoftCorporationII.QuickAssist", "Quick Assist", 9],
].map(([catalogId, name, mb]) => ({
  catalogId: String(catalogId),
  name: String(name),
  description: "",
  impact: "low",
  packageFullName: `${catalogId}_1.0.0.0_x64__8wekyb3d8bbwe`,
  installed: true,
  removable: true,
  reason: null,
  storeUrl: `ms-windows-store://pdp/?PFN=${catalogId}_8wekyb3d8bbwe`,
  publisher: "Microsoft Corporation",
  sizeBytes: Number(mb) * MB,
  dataBytes: Number(mb) * 0.1 * MB,
  installedAt: now() - 210 * DAY,
  lastActivity: now() - 40 * DAY,
  startsWithWindows: false,
  memoryBytes: null,
  dataSince: now() - 210 * DAY,
}));

const CLEANUPS: CleanupInfo[] = [
  {
    id: "temp_cleanup",
    name: "Clean temporary files",
    description: "Moves the contents of %TEMP% to the Recycle Bin.",
    requires_admin: false,
    requires_pro: false,
  },
  {
    id: "winupdate_cache_cleanup",
    name: "Clear Windows Update cache",
    description: "Moves already-installed Windows Update packages to the Recycle Bin.",
    requires_admin: true,
    requires_pro: true,
  },
];

const GPU: GpuReading = {
  name: "NVIDIA GeForce RTX 4070",
  temp_c: 44,
  utilization_pct: 4,
  vram_used_mb: 1460,
  vram_total_mb: 12_282,
  fan_pct: 0,
  power_w: 17,
  power_limit_w: 200,
  driver_version: "32.0.15.6094",
};

const BROWSERS: BrowserCleanupInfo[] = [
  { id: "brave", name: "Brave", running: false, cache_bytes: 612 * MB, cookies_bytes: 9 * MB },
  {
    id: "edge",
    name: "Microsoft Edge",
    running: false,
    cache_bytes: 287 * MB,
    cookies_bytes: 4 * MB,
  },
  { id: "firefox", name: "Firefox", running: false, cache_bytes: 154 * MB, cookies_bytes: 3 * MB },
];

const COOKIES: CookieScan[] = BROWSERS.map((b, i) => ({
  id: b.id,
  name: b.name,
  running: false,
  total: [1840, 760, 410][i],
  protected: [120, 64, 30][i],
  removable: [1720, 696, 380][i],
  top_removable: [
    { host: "doubleclick.net", count: [212, 88, 40][i] },
    { host: "adnxs.com", count: [154, 61, 33][i] },
    { host: "scorecardresearch.com", count: [97, 40, 21][i] },
  ],
}));

export const GAMES: GameEntry[] = [
  {
    path: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\cs2.exe",
    name: "Counter-Strike 2",
  },
  { path: "C:\\Riot Games\\VALORANT\\live\\VALORANT.exe", name: "VALORANT" },
];

const MONITORS: MonitorProfilesState = {
  displays: [
    {
      id: "\\\\.\\DISPLAY1",
      name: "ASUS VG27AQ",
      current_hz: 165,
      frequencies: [60, 100, 120, 144, 165],
      supported: true,
    },
  ],
  rules: [],
  enabled: false,
  active: null,
  pending_confirmation: false,
  deadline_ms: null,
  error: null,
};

const LINK: NetworkSnapshot = {
  online: true,
  link: {
    target: "1.1.1.1",
    sent: 20,
    received: 20,
    samplesUs: Array.from({ length: 20 }, (_, i) => 11_000 + ((i * 937) % 2400)),
    minMs: 11,
    medianMs: 12.1,
    maxMs: 13.4,
    jitterMs: 0.6,
  },
  tcp: null,
};

function registryChanges(t: TweakInfo, applied: boolean): ValueChange[] {
  return t.changes.flatMap((c) =>
    c.kind === "registry"
      ? [{ path: c.path, name: c.valueName, before: applied ? null : "1", after: c.setsTo }]
      : [],
  );
}

/** An audit log a few days old: a starter profile, a single switch, an undo. */
export function initialAudit(tweaks: TweakInfo[]): AuditEntry[] {
  const byId = (id: string) => tweaks.find((t) => t.id === id);
  const entry = (
    days: number,
    action: string,
    target: string,
    detail: string | null = null,
  ): AuditEntry => {
    const t = byId(target);
    return {
      ts: now() - days * DAY,
      action,
      target,
      elevated: !!t?.requires_admin,
      success: true,
      detail,
      changes:
        t && action.startsWith("tweak") ? registryChanges(t, action !== "tweak-applied") : [],
    };
  };
  return [
    entry(1.2, "tweak-reverted", "disable_window_animations"),
    entry(2.4, "tweak-applied", "disable_window_animations"),
    entry(3.1, "ram-trim", "ram", "1.2 GB"),
    entry(6.5, "tweak-applied", "dark_mode"),
    entry(6.5, "tweak-applied", "show_file_extensions"),
    entry(6.5, "origin", "starter:Everyday", "dark_mode,show_file_extensions"),
  ];
}

export function auditEntry(t: TweakInfo | undefined, id: string, applied: boolean): AuditEntry {
  return {
    ts: now(),
    action: applied ? "tweak-applied" : "tweak-reverted",
    target: id,
    elevated: !!t?.requires_admin,
    success: true,
    detail: null,
    changes: t ? registryChanges(t, !applied) : [],
  };
}

/** Live readings that wander like a real PC's: the CPU idles at 2-14 % and,
 *  with Turbo Boost on, runs 25-70 % of its measured headroom above base. */
export function liveReadings() {
  const idle = drift(2, 14, 3);
  const boost = drift(0.25, 0.7, 0.08);
  const below = drift(0.55, 0.97, 0.04);
  return (turbo: boolean): LiveSample => {
    const cpu = idle();
    const mhz = turbo ? RATED_MHZ + (PEAK_MHZ - RATED_MHZ) * boost() : RATED_MHZ * below();
    return {
      cpu,
      cores: Array.from({ length: 16 }, (_, i) => Math.max(0.5, cpu + Math.sin(i * 1.7) * 4)),
      cpu_mhz: Math.round(mhz),
      ram_total: 32 * GB,
      ram_used: 11.4 * GB,
      ram_cached: 7.2 * GB,
      disk_read_bps: Math.random() * 4e6,
      disk_write_bps: Math.random() * 2e6,
      net_down_bps: Math.random() * 9e5,
      net_up_bps: Math.random() * 2e5,
      rated_mhz: RATED_MHZ,
      busiest_mhz: Math.round(Math.min(PEAK_MHZ, mhz + 180)),
      peak_mhz: PEAK_MHZ,
      min_state_pct: turbo ? 100 : 5,
    };
  };
}

const resourceUsers = (): ResourceUsers => ({
  cpu: [
    { name: "Brave", processes: 14, cpu: 3.1 + Math.random(), memory: 1.9 * GB },
    { name: "Discord", processes: 6, cpu: 0.9, memory: 640 * MB },
    { name: "Steam", processes: 4, cpu: 0.5, memory: 420 * MB },
    { name: "Windows Explorer", processes: 1, cpu: 0.3, memory: 210 * MB },
    { name: "PC Tweaker", processes: 2, cpu: 0.4, memory: 160 * MB },
  ],
  memory: [
    { name: "Brave", processes: 14, cpu: 3.1, memory: 1.9 * GB },
    { name: "Discord", processes: 6, cpu: 0.9, memory: 640 * MB },
    { name: "Steam", processes: 4, cpu: 0.5, memory: 420 * MB },
    { name: "Windows Explorer", processes: 1, cpu: 0.3, memory: 210 * MB },
    { name: "PC Tweaker", processes: 2, cpu: 0.4, memory: 160 * MB },
  ],
  own_cpu: 0.4,
  others_cpu: 6.1,
});

const thermal = (): ThermalReport => ({
  cpu_temp_c: 48 + Math.round(Math.random() * 4),
  cpu_source: "ACPI thermal zone",
  gpus: [{ ...GPU, temp_c: 43 + Math.round(Math.random() * 3) }],
  gpu_source: "NVIDIA NVML",
});

const DPC: DpcReport = {
  seconds: 10,
  dpc: { kind: "dpc", count: 48_210, maxUs: 412, overLimit: 3, limitUs: 1000 },
  isr: { kind: "isr", count: 21_840, maxUs: 96, overLimit: 0, limitUs: 1000 },
  drivers: [
    {
      driver: "nvlddmkm.sys",
      dpc: { count: 9120, maxUs: 412, totalUs: 410_000, overLimit: 0 },
      isr: { count: 9100, maxUs: 41, totalUs: 120_000, overLimit: 0 },
    },
    {
      driver: "ndis.sys",
      dpc: { count: 14_200, maxUs: 188, totalUs: 260_000, overLimit: 0 },
      isr: { count: 0, maxUs: 0, totalUs: 0, overLimit: 0 },
    },
  ],
  worst: [
    { kind: "dpc", driver: "nvlddmkm.sys", durationUs: 412, atMs: 3120 },
    { kind: "dpc", driver: "ndis.sys", durationUs: 188, atMs: 6420 },
  ],
  eventsLost: 0,
  buffersLost: 0,
  skewedEvents: 0,
  driversResolved: true,
};

const NO_BEFORE_AFTER: BeforeAfter = {
  before: null,
  after: null,
  afterRuns: 0,
  changes: [],
  restartedBetween: false,
};

/** Answers for the pages; `undefined` when the command is not a page's. */
export function pageAnswer(
  cmd: string,
  a: Args,
  ctx: {
    pro: boolean;
    tweaks: () => TweakInfo[];
    applied: Set<string>;
    audit: AuditEntry[];
    removals: DebloatRecord[];
    live: (turbo: boolean) => LiveSample;
    /** Switches the pages turn on and off, so a toggle stays where it was put. */
    on: Set<string>;
    games: GameEntry[];
  },
): unknown {
  const flip = (key: string, value: unknown) => {
    if (value) ctx.on.add(key);
    else ctx.on.delete(key);
    return null;
  };
  switch (cmd) {
    case "list_audit_log":
      return ctx.audit;
    case "active_changes":
      return ctx
        .tweaks()
        .filter((t) => ctx.applied.has(t.id))
        .map((t) => ({ id: t.id, changes: registryChanges(t, false) }));
    case "debloat_history":
      return ctx.removals;
    case "list_debloat_apps":
      return APPS.filter((x) => !ctx.removals.some((r) => r.catalogId === x.catalogId));
    case "remove_debloat_app": {
      const app = APPS.find((x) => x.catalogId === a.catalogId) ?? APPS[0];
      const record: DebloatRecord = {
        catalogId: app.catalogId,
        packageFullName: app.packageFullName ?? "",
        publisherId: "8wekyb3d8bbwe",
        scope: "currentUser",
        status: "removed",
        error: null,
        timestamp: now(),
      };
      ctx.removals.unshift(record);
      return record;
    }
    case "debloat_reinstall_link":
      return "ms-windows-store://home";
    case "read_debloat_list":
      return [];
    case "list_health_history":
      return Array.from({ length: 8 }, (_, i) => ({
        ts: now() - (8 - i) * 3 * DAY,
        overall: [57, 58, 58, 60, 61, 61, 63, 64][i],
      }));
    case "boot_times":
      return {
        records: Array.from({ length: 6 }, (_, i) => ({
          ts: now() - (6 - i) * DAY,
          bootMs: [24_100, 23_400, 25_200, 22_900, 23_700, 22_600][i],
        })),
        change: null,
      };
    case "before_after":
      return NO_BEFORE_AFTER;
    case "list_crash_reports":
      return [];
    case "thermal_report":
      return thermal();
    case "gpu_readings":
      return thermal().gpus;
    case "gpu_power_info":
      return {
        supported: true,
        current_w: 200,
        default_w: 200,
        min_w: 100,
        max_w: 220,
        default_is_max: false,
        max_clock_mhz: 2475,
        current_clock_mhz: 210,
      } satisfies GpuPowerInfo;
    case "disk_health":
      return { drive: String(a.drive ?? "C:"), media_type: "NVMe", status: "OK" };
    case "search_driver_updates":
      return { updates: [], error: null };
    case "core_steering_status":
      return {
        enabled: false,
        kind: null,
        gameCpuSets: 0,
        backgroundCpuSets: 0,
        steeredProcesses: 0,
      } satisfies CoreSteeringStatus;
    case "monitor_profiles_state":
      return { ...MONITORS, enabled: ctx.on.has("monitor") };
    case "priority_rules_status":
      return {
        enabled: ctx.on.has("priority"),
        engineRunning: ctx.on.has("priority"),
        paused: false,
        rules: [],
        activeProcesses: 0,
        pendingRestore: 0,
        lastError: null,
      } satisfies PriorityRulesStatus;
    case "process_guard_status":
    case "set_process_guard":
      return { respectGames: true, paused: false } satisfies ProcessGuardStatus;
    case "game_sessions_enabled":
      return ctx.on.has("games");
    case "set_game_sessions_enabled":
      return flip("games", a.enabled);
    case "list_game_sessions":
      return ctx.games;
    case "add_game_session": {
      const path = String(a.path ?? "");
      if (path && !ctx.games.some((g) => g.path === path))
        ctx.games.push({
          path,
          name:
            path
              .split("\\")
              .pop()
              ?.replace(/\.exe$/i, "") ?? path,
        });
      return null;
    }
    case "remove_game_session": {
      const at = ctx.games.findIndex((g) => g.path === a.path);
      if (at >= 0) ctx.games.splice(at, 1);
      return null;
    }
    case "set_core_steering":
      return null;
    case "x3d_report":
      return {
        cpu: "AMD Ryzen 7 7700X",
        ccds: [{ index: 0, mask: 0xffff, logical_count: 16, l3_bytes: 32 * MB }],
        vcache_ccd: null,
        status: "single_die",
      } satisfies X3dReport;
    case "x3d_processes":
      return [];
    case "ecoqos_set_enabled":
      return flip("ecoqos", a.enabled);
    case "priority_rules_set_enabled":
      return flip("priority", a.enabled);
    case "monitor_set_enabled":
      return flip("monitor", a.enabled);
    case "install_driver_updates":
      return { installed: 0, failed: 0, reboot_required: false };
    case "read_profile_file":
      return {
        profile: {
          format: 1,
          name: "Imported",
          created_at: new Date().toISOString(),
          tweaks: ["disable_game_dvr"],
        },
        unknown: [],
      };
    case "save_profile":
      return {
        format: 1,
        name: String(a.name ?? "My profile"),
        created_at: new Date().toISOString(),
        tweaks: (a.tweaks as string[]) ?? [...ctx.applied],
      } satisfies TweakProfile;
    case "shred_files":
      return { shredded_count: 1, skipped_count: 0, bytes_overwritten: 24 * MB, touched_ssd: true };
    case "delete_files":
      return { freed_bytes: 412 * MB, deleted_count: 1, skipped_count: 0 };
    case "compare_lifetime_profiles":
      return {
        left_name: "Evening gaming",
        right_name: "Current settings",
        common: ["disable_game_dvr"],
        only_left: ["reduce_input_lag", "disable_mouse_acceleration"],
        only_right: [...ctx.applied],
        unknown_left_count: 0,
        unknown_right_count: 0,
      };
    case "fps_status":
      return { running: false, elevated: false };
    case "hud_is_open":
      return false;
    case "hud_snapshot":
      return {
        cpu_pct: 9,
        ram_used_mb: 11_670,
        ram_total_mb: 32_768,
        gpu_pct: 4,
        gpu_temp_c: 44,
        vram_used_mb: 1460,
        vram_total_mb: 12_282,
        bottleneck: "idle",
        foreground: null,
        fps: null,
      } satisfies HudSnapshot;
    case "download_limit_state":
    case "restore_download_limit":
      return {
        supported: true,
        configuredKbps: null,
        provider: "Delivery Optimization",
        applied: false,
        conflict: null,
      } satisfies DownloadLimitState;
    case "set_download_limit":
      return {
        supported: true,
        configuredKbps: Number(a.kbps ?? 5000),
        provider: "Delivery Optimization",
        applied: true,
        conflict: null,
      } satisfies DownloadLimitState;
    case "last_network_verification":
      return null;
    case "verify_network":
      return LINK;
    case "list_cleanup_targets":
      return CLEANUPS;
    case "preview_cleanup":
      return {
        items: [
          { name: "nvidia-cache", is_dir: true, bytes: 410 * MB },
          { name: "~DF3A1B.tmp", is_dir: false, bytes: 64 * MB },
          { name: "setup-logs", is_dir: true, bytes: 22 * MB },
        ],
        total_bytes: 1.62 * GB,
        item_count: 6120,
        truncated: true,
        accessible: true,
      } satisfies CleanupPreview;
    case "run_cleanup":
    case "run_cleanup_selected":
      return { freed_bytes: 1.57 * GB, deleted_count: 5874, skipped_count: 246 };
    case "list_browser_cleanup":
      return BROWSERS;
    case "run_browser_cleanup":
      return { freed_bytes: 598 * MB };
    case "scan_cookies":
      return COOKIES;
    case "clean_cookies":
      return {
        removed: 2796,
        kept: 214,
        cleaned: ["Brave", "Microsoft Edge", "Firefox"],
        skipped_running: [],
      };
    case "cookie_whitelist":
      return ["google.com", "github.com"];
    case "clean_app_caches":
      return { freed_bytes: 820 * MB, deleted: 2848, skipped: 0 };
    case "registry_backups":
      return [];
    case "ram_schedule_ready":
      return true;
    case "scheduled_cleanup_enabled":
    case "drift_watch_enabled":
    case "set_drift_watch":
    case "set_scheduled_cleanup":
      return false;
    case "set_ram_boost_threshold":
      return Number(a.mb ?? a.thresholdMb ?? 1024);
    case "clean_ram":
      return {
        freed_bytes: 1.4 * GB,
        trimmed_processes: 86,
        skipped_processes: 9,
        ram_used_before: 11.6 * GB,
        ram_used_after: 10.2 * GB,
        ram_total: 32 * GB,
      };
    case "purge_standby_memory":
      return { free_before_mb: 820, free_after_mb: 6920 };
    case "top_memory_processes":
      return [
        { name: "Brave", mem_bytes: 1.9 * GB },
        { name: "Discord", mem_bytes: 640 * MB },
        { name: "Steam", mem_bytes: 420 * MB },
        { name: "Windows Explorer", mem_bytes: 210 * MB },
      ];
    case "resource_users":
      return resourceUsers();
    case "live_sample":
      return ctx.live(ctx.applied.has("turbo_boost"));
    case "turbo_boost_already_set":
      return false;
    case "boost_probe": {
      const turbo = ctx.applied.has("turbo_boost");
      return {
        score: turbo ? 1_184_000 : 1_046_000,
        duration_ms: Number(a.seconds ?? 3) * 1000,
        avg_mhz: turbo ? 5210 : 4620,
        peak_mhz: turbo ? 5400 : 5050,
      };
    }
    case "scan_large_files":
      return [
        { path: "C:\\Users\\Demo\\Videos\\Captures\\match-2026-10-28.mp4", size: 8.4 * GB },
        { path: "C:\\Users\\Demo\\Downloads\\ubuntu-24.04-desktop-amd64.iso", size: 5.9 * GB },
        { path: "C:\\Users\\Demo\\Downloads\\old-backup.zip", size: 3.1 * GB },
      ] satisfies LargeFile[];
    case "scan_duplicates":
      return [
        {
          size: 412 * MB,
          paths: [
            "C:\\Users\\Demo\\Downloads\\installer.exe",
            "C:\\Users\\Demo\\Desktop\\installer (1).exe",
          ],
        },
      ];
    case "run_system_repair":
      return {
        status: "healthy",
        steps: [{ step: "quick", exit_code: 0, tail: "No component store corruption detected." }],
      } satisfies RepairOutcome;
    case "secure_defrag":
    case "optimize_disk":
      return {
        drive: String(a.drive ?? "C:"),
        media_type: "NVMe",
        operation: "retrim",
        summary: "The drive was trimmed.",
        analysis: [],
      };
    case "flush_dns_cache":
      return { success: true, detail: "The DNS resolver cache was flushed." };
    case "trace_dpc_latency":
      return DPC;
    case "preview_tweak": {
      const t = ctx.tweaks().find((x) => x.id === a.id);
      if (!t) return null;
      return {
        id: t.id,
        rows: t.changes.map((change) => ({ change, current: "1", changes: true })),
        applied: ctx.applied.has(t.id),
        willChange: true,
        requiresAdmin: t.requires_admin,
        unavailable: null,
      } satisfies TweakPreview;
    }
    case "list_profiles":
      return [
        {
          format: 1,
          name: "Evening gaming",
          created_at: new Date((now() - 9 * DAY) * 1000).toISOString(),
          tweaks: ["disable_game_dvr", "reduce_input_lag", "disable_mouse_acceleration"],
        },
      ] satisfies TweakProfile[];
    case "capture_profile":
      return {
        format: 1,
        name: String(a.name ?? "My profile"),
        created_at: new Date().toISOString(),
        tweaks: [...ctx.applied],
      } satisfies TweakProfile;
    case "read_avatar":
    case "license_device_hash":
    case "referral_issuer":
      return null;
    case "account_service_probe":
      return "ok";
    case "preview_lifetime_report":
      return "PC Tweaker report (demo)";
    case "save_lifetime_report":
      return true;
    case "is_store_install":
    case "referral_license_status":
    case "hud_is_compact":
      return false;
    default:
      return undefined;
  }
}
