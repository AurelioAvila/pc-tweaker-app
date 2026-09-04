// Shared data shapes crossing module boundaries. Pure types only.
export type AuthState =
  | { status: "anonymous" }
  | {
      status: "authenticated";
      email: string;
      isPro: boolean;
      emailVerified: boolean;
      /** The plan the entitlement came from, or null when Pro was granted
       *  directly rather than bought. */
      plan: string | null;
      /** Whether a Stripe customer exists for this account. Pro without one
       *  has nothing a billing portal could show. */
      hasBilling: boolean;
    };

export type Category = "performance" | "privacy" | "ui" | "manutenzione" | "gaming";

/** Navigable sections: the tweak categories plus the two standalone screens. */
export type Section =
  Category | "scan" | "health" | "hardware" | "startup" | "profiles" | "pricing" | "ledger";

export type TweakInfo = {
  id: string;
  name: string;
  description: string;
  category: Category;
  hive: string;
  requires_admin: boolean;
  requires_pro: boolean;
  applied: boolean;
  /** Everything this tweak actually does, for the "Technical details"
   *  disclosure. Empty when the mechanism cannot be stated precisely - the
   *  app shows no panel rather than a plausible-looking guess. */
  changes: TechnicalChange[];
};

/** Mirrors the Rust `TechnicalChange` tagged union (serde `tag = "kind"`).
 *  Discriminated on `kind` so a new backend variant surfaces as a TypeScript
 *  error here instead of rendering as the wrong sort of row. */
export type TechnicalChange =
  | {
      kind: "registry";
      path: string;
      valueName: string;
      /** `REG_DWORD` / `REG_SZ`, named as regedit names them. */
      valueType: string;
      setsTo: string;
    }
  | { kind: "command"; program: string; arguments: string }
  | { kind: "service"; name: string; action: string };

export type CleanupInfo = {
  id: string;
  name: string;
  description: string;
  requires_admin: boolean;
  requires_pro: boolean;
};

export type CleanupResult = {
  freed_bytes: number;
  deleted_count: number;
  skipped_count: number;
};

export type BrowserCleanupInfo = {
  id: string;
  name: string;
  running: boolean;
  cache_bytes: number;
  cookies_bytes: number;
};

export type BrowserCleanupResult = {
  freed_bytes: number;
};

export type DuplicateGroup = {
  size: number;
  paths: string[];
};

export type LargeFile = {
  path: string;
  size: number;
};

export type DiskOptResult = {
  drive: string;
  media_type: string;
  summary: string;
};

export type DiskHealthInfo = {
  drive: string;
  media_type: string;
  status: string;
};

export type FlushDnsResult = {
  success: boolean;
  detail: string;
};

export type DriveInfo = {
  letter: string;
  media_type: string;
  total_bytes: number;
  free_bytes: number;
  is_system: boolean;
};

export type Toast = {
  id: number;
  kind: "success" | "error";
  message: string;
};

export type GameEntry = { path: string; name: string };

export type ScanIssue = {
  kind: "tweak" | "cleanup";
  id: string;
  name: string;
  description: string;
};

/**
 * A hardware-derived verdict for one tweak, from the Rust `advise_tweaks`
 * command. `reason_key` indexes `s.scan.reasons` so the explanation is
 * translated like everything else rather than arriving as English from Rust.
 */
export type TweakAdvice = {
  id: string;
  verdict: "recommended" | "notrecommended" | "neutral" | "unsupported";
  reason_key: string | null;
};

/** Shape of the Rust `system_profile` command's reply. */
export type SystemProfile = {
  windows_version: string | null;
  windows_build: string | null;
  cpu: string | null;
  cpu_physical_cores: number | null;
  cpu_logical_cores: number | null;
  gpu: string | null;
  ram_total_bytes: number | null;
  system_disk: "hdd" | "ssd" | "nvme" | "unknown";
  form_factor: "desktop" | "laptop" | "unknown";
  power_plan_guid: string | null;
  power_plan: string | null;
};

export type SystemStats = {
  cpu_usage: number;
  cpu_name: string;
  cpu_cores: number;
  ram_used: number;
  ram_total: number;
  disk_used: number;
  disk_total: number;
  os_name: string;
  uptime_secs: number;
};

/** Mirrors Rust `thermals::GpuReading`. Every optional field is `null` when
 *  the card exposes no such sensor — which is not the same as a zero reading,
 *  and the UI must keep the two apart. */
export type GpuReading = {
  name: string;
  temp_c: number | null;
  utilization_pct: number | null;
  vram_used_mb: number | null;
  vram_total_mb: number | null;
  fan_pct: number | null;
  power_w: number | null;
  power_limit_w: number | null;
  driver_version: string | null;
};

export type ThermalReport = {
  cpu_temp_c: number | null;
  /** "acpi" | "unavailable" — the provenance shown to the user. */
  cpu_source: string;
  gpus: GpuReading[];
  /** "nvidia-smi" | "none". */
  gpu_source: string;
};

/** Mirrors Rust `drivers::DriverEntry`. `tier` is an age band only: this app
 *  never claims a newer driver exists, because Windows cannot tell it that. */
export type DriverEntry = {
  device: string;
  version: string;
  date: string;
  age_days: number;
  class: string;
  provider: string;
  tier: "current" | "aging" | "stale";
  vendor_url: string | null;
  /** Classes where a stale driver has a felt effect; these lead the list. */
  important: boolean;
};

/** Mirrors Rust `gpupower::GpuPowerInfo`. Watts are whole numbers because
 *  nvidia-smi only accepts whole watts. */
export type GpuPowerInfo = {
  supported: boolean;
  current_w: number | null;
  default_w: number | null;
  min_w: number | null;
  max_w: number | null;
  default_is_max: boolean;
  max_clock_mhz: number | null;
  current_clock_mhz: number | null;
};

export type DriverAudit = {
  entries: DriverEntry[];
  excluded_inbox: number;
  /** Every driver looked at, whoever signed it. */
  total_scanned: number;
  /** Device classes walked, so the UI can say what "all of them" meant. */
  classes_scanned: number;
};

/** One step of the driver scan: which class is being read, and where that
 *  sits in the total. Emitted by Rust as `driver-scan-progress`. */
export type ScanProgress = {
  done: number;
  total: number;
  class: string;
};

/** One pending driver update from the Windows Update catalogue. */
export type DriverUpdate = {
  title: string;
  /** `null` when the catalogue states no size, rather than a 0 that would
   *  read as "free". */
  size_mb: number | null;
};

export type UpdateSearchResult = {
  updates: DriverUpdate[];
  /** Set when the search itself could not run, which is a different thing
   *  from finding nothing. */
  error: string | null;
};

export type InstallOutcome = {
  installed: number;
  failed: number;
  /** Straight from Windows Update's own result, not inferred. */
  reboot_required: boolean;
};

export type RamCleanResult = {
  freed_bytes: number;
  trimmed_processes: number;
  skipped_processes: number;
  ram_used_before: number;
  ram_used_after: number;
  ram_total: number;
};

export type StartupEntry = {
  name: string;
  command: string;
  scope: string;
  /** Which of Windows' three startup mechanisms this entry belongs to. Each
   *  has its own registry key and its own approval key, so this has to travel
   *  back with every toggle — `scope` plus `name` does not identify a row. */
  location: "run" | "run32" | "folder";
  enabled: boolean;
  requires_admin: boolean;
  /** The target executable is gone from disk — an entry an uninstaller left
   *  behind. See the field's doc comment in src-tauri/src/startup.rs. */
  orphaned: boolean;
};

/** A third-party task that runs at logon or boot. Windows' own tasks are
 *  never returned; see src-tauri/src/scheduledtasks.rs. */
export type ScheduledTaskEntry = {
  /** Full scheduler path, and the id used to toggle it. */
  path: string;
  name: string;
  /** Empty when the task's action is not a plain executable. */
  command: string;
  author: string;
  enabled: boolean;
  trigger: "logon" | "boot";
  requires_admin: boolean;
};

/* ---------------- Third-party cache cleaner (src-tauri/src/appcache.rs) --- */

export type CacheCategory = "shaders" | "launchers" | "apps" | "dev" | "windows";

export type CacheGroup = {
  id: string;
  category: CacheCategory;
  name: string;
  bytes: number;
  files: number;
  /** Process holding these files open, or "" when nothing is in the way. */
  blocked_by: string;
};

export type CacheScanProgress = { id: string; index: number; total: number };

export type CacheCleanResult = {
  freed_bytes: number;
  deleted: number;
  /** Files a running program still had open. Expected, not a failure. */
  skipped: number;
};

/* ---------------- Selective cookie cleaner (src-tauri/src/cookies.rs) ----- */

export type CookieDomainCount = { host: string; count: number };

export type CookieScan = {
  id: string;
  name: string;
  /** Scanning works while the browser is open; cleaning does not. */
  running: boolean;
  total: number;
  protected: number;
  removable: number;
  top_removable: CookieDomainCount[];
};

export type CookieCleanResult = {
  removed: number;
  kept: number;
  cleaned: string[];
  skipped_running: string[];
};

/* ---------------- DISM / SFC repair (src-tauri/src/sysrepair.rs) ---------- */

export type RepairJob = "check" | "repair" | "component_cleanup";

export type RepairStep = "scan" | "restore" | "sfc" | "cleanup";

export type RepairProgress = {
  step: RepairStep;
  step_index: number;
  step_total: number;
  /** Progress within the current step, 0-100. */
  percent: number;
  line: string;
};

export type RepairStepOutcome = { step: RepairStep; exit_code: number; tail: string };

/** `completed` is the honest fallback when the tools ran but their output
 *  could not be read confidently — a localised `sfc` summary, most often. */
export type RepairStatus = "healthy" | "repairable" | "repaired" | "unrepairable" | "completed";

export type RepairOutcome = { status: RepairStatus; steps: RepairStepOutcome[] };

export type TweakProfile = {
  format: number;
  name: string;
  created_at: string;
  tweaks: string[];
};

export type LoadedProfile = { profile: TweakProfile; unknown: string[] };

/** One line of the local audit trail (src-tauri/src/audit.rs). */
export type AuditEntry = {
  ts: number;
  action: string;
  target: string;
  elevated: boolean;
  success: boolean;
  detail?: string | null;
};

/** What the update watchdog saw (src-tauri/src/updatewatch.rs). The two
 *  readings are independent: `windowsUpdated` says the patch level moved,
 *  `reverted` says which applied tweaks no longer match the system. The app
 *  never claims the first caused the second. */
export type DriftReport = {
  windowsUpdated: boolean;
  previousPatch: string | null;
  currentPatch: string;
  reverted: string[];
};

/** A recorded panic (src-tauri/src/crash.rs). Written by both the app and
 *  the elevated helper; `process` says which one died. Never leaves the
 *  machine unless the user copies it out deliberately. */
export type CrashReport = {
  ts: number;
  version: string;
  process: string;
  message: string;
  location: string;
  thread: string;
};

/** Dry-run preview of a cleanup action (src-tauri/src/cleanup.rs). */
export type CleanupPreviewItem = {
  name: string;
  is_dir: boolean;
  bytes: number;
};

export type CleanupPreview = {
  items: CleanupPreviewItem[];
  total_bytes: number;
  item_count: number;
  truncated: boolean;
  accessible: boolean;
};

/** One cache-coherent CPU die, from Rust `x3d::Ccd`. */
export type Ccd = {
  index: number;
  /** Affinity mask. Arrives as a JSON number: safe up to 53 logical
   *  processors, which is far past where this feature applies. */
  mask: number;
  logical_count: number;
  l3_bytes: number;
};

export type X3dStatus = "ready" | "single_die" | "uniform_cache" | "unavailable";

export type X3dReport = {
  cpu: string;
  ccds: Ccd[];
  /** Index into `ccds`, and `null` unless `status` is "ready". */
  vcache_ccd: number | null;
  status: X3dStatus;
};

export type ProcessEntry = {
  pid: number;
  name: string;
  cpu_pct: number;
  memory_bytes: number;
  /** `null` when the process could not be opened — usually because it runs
   *  with higher privileges than this app. */
  affinity: number | null;
};

/* ---------------------------------------------------------------- *
 * Pro: Secure Defrag, Zero-Trace, gaming HUD
 * ---------------------------------------------------------------- */

export type DefragPhase = "analyze" | "optimize";

export type DefragProgress = {
  phase: DefragPhase;
  drive: string;
  /** null while defrag is in a stage it reports no percentage for. */
  percent: number | null;
  /** Windows' own wording, in the system language — see securedefrag.rs. */
  line: string;
  done: boolean;
};

export type DefragOutcome = {
  drive: string;
  media_type: string;
  /** "defrag" on a confirmed hard disk, "retrim" otherwise. */
  operation: string;
  summary: string;
  /** What `defrag /A` reported before anything changed — see securedefrag.rs
   *  for why this exists: on an SSD it is the substance of the run. */
  analysis: string[];
};

export type PurgeResult = {
  free_before_mb: number;
  free_after_mb: number;
};

export type ShredResult = {
  shredded_count: number;
  skipped_count: number;
  bytes_overwritten: number;
  touched_ssd: boolean;
};

export type Bottleneck = "cpu" | "gpu" | "balanced" | "idle";

export type HudSnapshot = {
  cpu_pct: number;
  ram_used_mb: number;
  ram_total_mb: number;
  gpu_pct: number | null;
  gpu_temp_c: number | null;
  vram_used_mb: number | null;
  vram_total_mb: number | null;
  bottleneck: Bottleneck;
  foreground: { name: string; pid: number; priority: string } | null;
  /** Present-event frame rate for the foreground process. Null when the
   *  counter is off, the foreground window is not presenting, or it has not
   *  drawn yet — all three mean "no reading", never zero. */
  fps: {
    fps: number;
    frametime_ms: number;
    low1_fps: number | null;
    sample_frames: number;
  } | null;
};
