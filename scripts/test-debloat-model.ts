// The rules behind the Debloat list: filters, order, the explicit
// "Select recommended", and the space estimate.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canRemove,
  estimatedSpace,
  filterApps,
  footprint,
  formatSize,
  pruneSelection,
  recommendedSelection,
  sortApps,
  tierOf,
  TIERS,
} from "../src/debloat-model";
import { APP_CATEGORIES } from "../src/components/debloat-copy";
import type { DebloatApp } from "../src/components/debloat";

const MB = 1024 * 1024;
const app = (catalogId: string, extra: Partial<DebloatApp> = {}): DebloatApp => ({
  catalogId,
  name: catalogId[0].toUpperCase() + catalogId.slice(1),
  description: "",
  impact: "",
  packageFullName: `pkg.${catalogId}`,
  installed: true,
  removable: true,
  reason: null,
  storeUrl: null,
  publisher: "Microsoft Corporation",
  sizeBytes: 10 * MB,
  dataBytes: 1 * MB,
  ...extra,
});
const apps = [
  app("solitaire", { sizeBytes: 2 * MB }),
  app("news", { sizeBytes: null, dataBytes: null }),
  app("weather"),
  app("clipchamp", { sizeBytes: 80 * MB, dataBytes: 20 * MB }),
  app("phone", { removable: false, reason: "dependency" }),
  app("todo", { installed: false, packageFullName: null, sizeBytes: null, dataBytes: null }),
];
const categoryOf = (a: DebloatApp) => APP_CATEGORIES[a.catalogId] ?? "windows";
const base = { category: "all" as const, query: "", showLocked: false, showAbsent: false };
const ids = (list: DebloatApp[]) => list.map((a) => a.catalogId);

test("every catalogue app has a tier, and unknown ones are treated with caution", () => {
  for (const id of Object.keys(APP_CATEGORIES)) assert.ok(TIERS[id], id);
  assert.equal(tierOf({ catalogId: "something-new" }), "caution");
});

test("the list shows removable apps; locked and absent ones only when asked", () => {
  assert.deepEqual(ids(filterApps(apps, base, categoryOf)), [
    "solitaire",
    "news",
    "weather",
    "clipchamp",
  ]);
  assert.ok(ids(filterApps(apps, { ...base, showLocked: true }, categoryOf)).includes("phone"));
  assert.ok(ids(filterApps(apps, { ...base, showAbsent: true }, categoryOf)).includes("todo"));
  assert.deepEqual(ids(filterApps(apps, { ...base, category: "media" }, categoryOf)), [
    "solitaire",
    "clipchamp",
  ]);
  // Search matches name, publisher and package identity, case-insensitively.
  assert.deepEqual(ids(filterApps(apps, { ...base, query: "  NEWS " }, categoryOf)), ["news"]);
  assert.equal(filterApps(apps, { ...base, query: "microsoft corporation" }, categoryOf).length, 4);
  assert.deepEqual(filterApps(apps, { ...base, query: "nothing like this" }, categoryOf), []);
});

test("sorting keeps removable apps first, then follows the chosen key", () => {
  const all = filterApps(apps, { ...base, showLocked: true, showAbsent: true }, categoryOf);
  const byTier = ids(sortApps(all, "tier", "en"));
  assert.deepEqual(
    byTier.slice(0, 2),
    ["News", "Solitaire"].map((n) => n.toLowerCase()),
  );
  assert.ok(byTier.indexOf("weather") < byTier.indexOf("clipchamp"), "safe before caution");
  assert.deepEqual(byTier.slice(-2).sort(), ["phone", "todo"], "not removable comes last");
  const bySize = ids(sortApps(all, "size", "en"));
  assert.equal(bySize[0], "clipchamp");
  assert.equal(bySize.indexOf("news"), 3, "unknown size sorts after known sizes");
  assert.deepEqual(ids(sortApps(all, "name", "en")).slice(0, 4), [
    "clipchamp",
    "news",
    "solitaire",
    "weather",
  ]);
  assert.deepEqual(
    ids(all),
    ids(filterApps(apps, { ...base, showLocked: true, showAbsent: true }, categoryOf)),
    "sorting never mutates",
  );
});

test("Select recommended picks only removable recommended apps", () => {
  assert.deepEqual(recommendedSelection(apps).sort(), ["pkg.news", "pkg.solitaire"]);
  const locked = apps.map((a) => (a.catalogId === "news" ? { ...a, removable: false } : a));
  assert.deepEqual(recommendedSelection(locked), ["pkg.solitaire"]);
  assert.equal(apps.filter(canRemove).length, 4);
});

test("the space estimate adds files and data, and flags unknown sizes", () => {
  const picked = new Set(["pkg.solitaire", "pkg.clipchamp"]);
  assert.deepEqual(estimatedSpace(apps, picked), { bytes: 103 * MB, complete: true });
  const withUnknown = estimatedSpace(apps, new Set(["pkg.solitaire", "pkg.news"]));
  assert.deepEqual(withUnknown, { bytes: 3 * MB, complete: false });
  assert.deepEqual(estimatedSpace(apps, new Set()), { bytes: 0, complete: true });
  assert.equal(footprint(app("x", { sizeBytes: null, dataBytes: 5 })), 5);
  assert.equal(footprint(app("x", { sizeBytes: null, dataBytes: null })), null);
});

test("a rescan drops selections that are no longer removable", () => {
  const kept = pruneSelection(apps, new Set(["pkg.solitaire", "pkg.phone", "pkg.gone"]));
  assert.deepEqual([...kept], ["pkg.solitaire"]);
});

test("sizes read naturally", () => {
  assert.equal(formatSize(null), null);
  assert.equal(formatSize(512, "en"), "512 B");
  assert.equal(formatSize(934 * 1024, "en"), "934 KB");
  assert.equal(formatSize(1012 * MB, "en"), "1.0 GB", "no '1,012 MB'");
  assert.equal(formatSize(87.9 * MB, "it"), "87,9 MB");
});
