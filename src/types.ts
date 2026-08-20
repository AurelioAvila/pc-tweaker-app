// Shared data shapes crossing module boundaries. Pure types only.
export type AuthState =
  | { status: "anonymous" }
  | { status: "authenticated"; email: string; isPro: boolean; emailVerified: boolean };

export type Category = "performance" | "privacy" | "ui" | "manutenzione" | "gaming";

/** Navigable sections: the tweak categories plus the two standalone screens. */
export type Section = Category | "scan" | "startup" | "profiles" | "pricing";

export type TweakInfo = {
  id: string;
  name: string;
  description: string;
  category: Category;
  hive: string;
  requires_admin: boolean;
  requires_pro: boolean;
  applied: boolean;
};

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
