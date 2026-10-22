/**
 * The removable-app catalogue as the website publishes it: the same list the
 * app's Debloat screen offers (src-tauri/src/debloat.rs CATALOG), written to
 * src/generated/debloat-catalog.json by the Rust test
 * `the_public_catalogue_of_removable_apps_matches_the_code`.
 */
import catalogJson from "../generated/debloat-catalog.json";

export interface DebloatApp {
  readonly id: string;
  readonly package_name: string;
  readonly publisher_id: string;
  readonly name: string;
  readonly description: string;
  readonly impact: string;
  readonly store_url: string;
}

export const DEBLOAT_APPS: readonly DebloatApp[] = catalogJson;

/** The file the app's Debloat › Load list reads (debloat.rs, format 1). */
export function debloatListJson(ids: readonly string[]) {
  const apps = DEBLOAT_APPS.filter((a) => ids.includes(a.id)).map((a) => a.id);
  return JSON.stringify({ format: 1, kind: "pc-tweaker-debloat-list", apps }, null, 2) + "\n";
}

/** Current-user removal by hand, one line per app. */
export function debloatPowerShell(ids: readonly string[]) {
  return DEBLOAT_APPS.filter((a) => ids.includes(a.id))
    .map((a) => `Get-AppxPackage -Name '${a.package_name}' | Remove-AppxPackage`)
    .join("\n");
}
