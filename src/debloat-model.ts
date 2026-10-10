// The rules behind the Debloat list: what counts as recommended, how the list
// is filtered and sorted, what "Select recommended" picks and how much space
// a selection can free. Pure functions, tested without a window.
import type { DebloatApp } from "./components/debloat";

export type Tier = "recommended" | "safe" | "caution";

/** How much thought removing each catalogue app deserves.
 *  - recommended: rarely used, and nothing personal is lost;
 *  - safe: nothing personal is lost, but plenty of people use it;
 *  - caution: local data, pairing or a default role goes with it.
 *  Editorial, from the catalogue's own "what you lose" notes. Anything not
 *  listed here is treated with caution. */
export const TIERS: Record<string, Tier> = {
  solitaire: "recommended",
  news: "recommended",
  feedback: "recommended",
  office: "recommended",
  weather: "safe",
  copilot: "safe",
  clipchamp: "caution",
  recorder: "caution",
  todo: "caution",
  media: "caution",
  movies: "caution",
  phone: "caution",
  outlook: "caution",
};

export const tierOf = (app: Pick<DebloatApp, "catalogId">): Tier =>
  TIERS[app.catalogId] ?? "caution";

export const canRemove = (app: DebloatApp) =>
  app.installed && app.removable && !!app.packageFullName;

export type Category = "all" | "media" | "productivity" | "connections" | "windows";
export type SortKey = "name" | "size" | "tier";

export type Filters = {
  category: Category;
  query: string;
  /** Also list apps that are installed but cannot be removed here. */
  showLocked: boolean;
  /** Also list catalogue apps that are not installed at all. */
  showAbsent: boolean;
};

export function filterApps(
  apps: readonly DebloatApp[],
  f: Filters,
  categoryOf: (app: DebloatApp) => Exclude<Category, "all">,
): DebloatApp[] {
  const q = f.query.trim().toLocaleLowerCase();
  return apps.filter(
    (app) =>
      (app.installed ? canRemove(app) || f.showLocked : f.showAbsent) &&
      (f.category === "all" || categoryOf(app) === f.category) &&
      (!q ||
        `${app.name} ${app.publisher ?? ""} ${app.packageFullName ?? ""}`
          .toLocaleLowerCase()
          .includes(q)),
  );
}

/** Total on-disk footprint: the app's files plus this account's data. */
export const footprint = (app: DebloatApp): number | null =>
  app.sizeBytes == null && app.dataBytes == null
    ? null
    : (app.sizeBytes ?? 0) + (app.dataBytes ?? 0);

const TIER_ORDER: Record<Tier, number> = { recommended: 0, safe: 1, caution: 2 };

/** Removable apps first in every order; then by the chosen key, then by name. */
export function sortApps(apps: readonly DebloatApp[], by: SortKey, lang?: string): DebloatApp[] {
  return [...apps].sort((a, b) => {
    const removable = Number(canRemove(b)) - Number(canRemove(a));
    if (removable) return removable;
    const key =
      by === "size"
        ? (footprint(b) ?? -1) - (footprint(a) ?? -1)
        : by === "tier"
          ? TIER_ORDER[tierOf(a)] - TIER_ORDER[tierOf(b)]
          : 0;
    return key || a.name.localeCompare(b.name, lang);
  });
}

/** What "Select recommended" adds: removable apps marked recommended. It is
 *  only ever a button; nothing is selected without the user asking. */
export const recommendedSelection = (apps: readonly DebloatApp[]): string[] =>
  apps.filter((a) => canRemove(a) && tierOf(a) === "recommended").map((a) => a.packageFullName!);

/** Upper bound on the space a selection frees, and whether every app in it
 *  had a known size. Windows keeps an app's files while another account still
 *  uses it, so this is "up to", never a promise. */
export function estimatedSpace(apps: readonly DebloatApp[], selected: ReadonlySet<string>) {
  let bytes = 0;
  let complete = true;
  for (const app of apps) {
    if (!app.packageFullName || !selected.has(app.packageFullName)) continue;
    const size = footprint(app);
    if (size === null) complete = false;
    else bytes += size;
  }
  return { bytes, complete };
}

/** Keeps only selections that still point at removable apps after a rescan. */
export const pruneSelection = (apps: readonly DebloatApp[], selected: ReadonlySet<string>) =>
  new Set(
    apps
      .filter((a) => canRemove(a) && selected.has(a.packageFullName!))
      .map((a) => a.packageFullName!),
  );

export function formatSize(bytes: number | null, lang?: string): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  // Switch units at 1000 so a size never reads as "1,012 MB".
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value >= 100 || unit < 2 ? 0 : 1;
  return `${value.toLocaleString(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[unit]}`;
}
