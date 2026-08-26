// Shared data shapes crossing module boundaries. Pure types only.
export type AuthState =
  | { status: "anonymous" }
  | { status: "authenticated"; email: string; isPro: boolean; emailVerified: boolean };

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
  enabled: boolean;
  requires_admin: boolean;
};

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
