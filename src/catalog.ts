// These catalogue entries have their own configuration and recovery controls.
export const CONFIGURABLE_TWEAK_IDS = new Set([
  "ecoqos_rules",
  "limit_do_background_download",
  "monitor_refresh_profile",
]);

// Kept in the list only so existing snapshots can still be restored.
export const isCurrentCatalogTweak = (id: string) => id !== "disable_copilot";

// Applied only from their own switch, never in a batch, a profile or an
// update re-apply. Mirrors MANUAL_ONLY_TWEAKS in src-tauri/src/lib.rs, which
// enforces the same rule on every bulk path.
export const MANUAL_ONLY_TWEAK_IDS = new Set(["disable_memory_integrity"]);

/** Windows builds the catalogue names, as people know them. */
const BUILD_NAMES: Record<number, string> = {
  22000: "Windows 11",
  22621: "Windows 11 22H2",
  22631: "Windows 11 23H2",
  26100: "Windows 11 24H2",
};

export const buildName = (build: number) => BUILD_NAMES[build] ?? `Windows build ${build}`;
