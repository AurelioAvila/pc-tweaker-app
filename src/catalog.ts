// These catalogue entries have their own configuration and recovery controls.
export const CONFIGURABLE_TWEAK_IDS = new Set([
  "ecoqos_rules",
  "limit_do_background_download",
  "monitor_refresh_profile",
]);

// Kept in the list only so existing snapshots can still be restored.
export const isCurrentCatalogTweak = (id: string) => id !== "disable_copilot";
