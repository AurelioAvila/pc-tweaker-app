// Change history rules: origin attribution, sessions, filters, summary,
// session undo and the exports. Run with: node scripts/test-history-model.mjs
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const bundle = await build({
  stdin: { contents: "export * from './src/history-model';", resolveDir: root, loader: "ts" },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
});
const m = await import(
  "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64")
);

const e = (ts, action, target, extra = {}) => ({
  ts,
  action,
  target,
  elevated: false,
  success: true,
  ...extra,
});
const T = 1_800_000_000;
// Newest first, as the app returns them.
const entries = [
  e(T + 7200, "tweak-reverted", "dark_mode"),
  e(T + 120, "tweak-applied", "show_file_extensions", {
    changes: [{ path: "HKCU\\X", name: "HideFileExt", before: "1 (0x1)", after: "0 (0x0)" }],
  }),
  e(T + 61, "tweak-applied", "disable_game_dvr", { success: false, detail: "Access is denied" }),
  e(T + 60, "tweak-applied", "dark_mode"),
  e(T + 59, "origin", "starter:Gaming", { detail: "dark_mode,disable_game_dvr" }),
  e(T + 30, "cleanup", "temp_cleanup"),
  e(T, "tweak-applied", "menu_show_delay"),
];
const removals = [
  {
    catalogId: "solitaire",
    packageFullName: "x",
    status: "removed",
    error: null,
    timestamp: T + 90,
  },
];
const items = m.buildHistory(entries, removals);

// Markers are not rows; origins are attributed.
assert.equal(items.length, 7);
assert.ok(items.every((i) => i.action !== "origin"));
const by = (target, action) => items.find((i) => i.target === target && i.action === action);
assert.deepEqual(by("dark_mode", "tweak-applied").origin, { kind: "starter", label: "Gaming" });
assert.deepEqual(by("disable_game_dvr", "tweak-applied").origin, {
  kind: "starter",
  label: "Gaming",
});
assert.deepEqual(
  by("show_file_extensions", "tweak-applied").origin,
  { kind: "switch" },
  "not in the marker's list",
);
assert.deepEqual(
  by("menu_show_delay", "tweak-applied").origin,
  { kind: "switch" },
  "before the marker",
);
assert.equal(by("temp_cleanup", "cleanup").kind, "cleanup");
assert.equal(by("solitaire", "app-removal-removed").kind, "debloat");
assert.deepEqual(
  items.map((i) => i.ts),
  [...items.map((i) => i.ts)].sort((a, b) => b - a),
  "newest first",
);

// Sessions split at a 30-minute gap.
const ss = m.sessions(items);
assert.equal(ss.length, 2);
assert.equal(ss[0].items.length, 1, "the restore two hours later is its own session");
assert.equal(ss[1].start, T);
assert.equal(ss[1].end, T + 120);

// Undo a session: still-applied tweaks only, in applied order.
const latest = m.latestApplies(items);
assert.deepEqual(
  m.sessionUndoable(
    ss[1],
    new Set(["menu_show_delay", "show_file_extensions", "dark_mode"]),
    latest,
  ),
  ["menu_show_delay", "show_file_extensions"],
  "dark_mode was restored later, so it is not this session's to undo",
);
assert.deepEqual(m.sessionUndoable(ss[1], new Set(), latest), []);
assert.equal(latest.get("dark_mode"), "", "restored after its last apply");
assert.equal(latest.get("disable_game_dvr"), "", "a failed apply is never in effect");

// Filters.
const name = (i) => i.target;
assert.equal(m.filterItems(items, { ...m.NO_FILTERS, outcome: "failed" }, name).length, 1);
assert.equal(m.filterItems(items, { ...m.NO_FILTERS, kind: "debloat" }, name).length, 1);
assert.equal(m.filterItems(items, { ...m.NO_FILTERS, since: T + 100 }, name).length, 2);
assert.equal(
  m.filterItems(items, { ...m.NO_FILTERS, query: "hidefileext" }, name).length,
  1,
  "searches values too",
);

// Summary.
assert.deepEqual(m.summary(items, 3), { active: 3, undone: 1, failed: 1 });

// A marker claims only the first apply of each id after it: a later switch
// flip and a restore are not the batch's.
const later = m.buildHistory([
  e(T + 400, "tweak-applied", "dark_mode"),
  e(T + 300, "tweak-reverted", "dark_mode"),
  e(T + 60, "tweak-applied", "dark_mode"),
  e(T + 59, "origin", "profile:Work", { detail: "dark_mode" }),
]);
assert.deepEqual(later.map((i) => i.origin.kind), ["switch", "switch", "profile"]);

// An apply that changed nothing does not make a session the owner.
const noop = m.buildHistory([
  e(T + 500, "tweak-applied", "dark_mode", {
    changes: [{ path: "HKCU\X", name: "V", before: "0 (0x0)", after: "0 (0x0)" }],
  }),
  e(T, "tweak-applied", "dark_mode", {
    changes: [{ path: "HKCU\X", name: "V", before: "1 (0x1)", after: "0 (0x0)" }],
  }),
]);
assert.equal(m.latestApplies(noop).get("dark_mode"), noop[1].key);
assert.ok(m.unchanged(noop[0]) && !m.unchanged(noop[1]));

// CSV: one row per value, quoted, formulas neutralised.
const csv = m.toCsv(
  [...items, { ...items[0], target: "=HYPERLINK(1)", changes: [] }],
  (i) => i.target,
);
const lines = csv.trim().split("\r\n");
assert.equal(lines.length, 1 + items.length + 1);
assert.ok(csv.includes('"HKCU\\X\\HideFileExt","1 (0x1)","0 (0x0)"'));
assert.ok(csv.includes(`"'=HYPERLINK(1)"`), "a formula is never exported live");
const json = JSON.parse(m.toJson(items, name));
assert.equal(json.length, items.length);
assert.equal(json.find((r) => r.id === "show_file_extensions").changes[0].after, "0 (0x0)");

console.log("history model test passed: origins, sessions, filters, summary, undo, CSV/JSON.");
