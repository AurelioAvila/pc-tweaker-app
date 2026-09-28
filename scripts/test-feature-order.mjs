import assert from "node:assert/strict";
import { build } from "esbuild";
const { outputFiles } = await build({
  entryPoints: ["src/feature-order.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { orderSectionTweaks } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);
const items = [
  { id: "unknown-first", requires_pro: true },
  { id: "disable_game_dvr", requires_pro: false },
  { id: "ecoqos_rules", requires_pro: true },
  { id: "power_plan_performance", requires_pro: false },
  { id: "unknown-second", requires_pro: false },
];
const original = structuredClone(items);
const ordered = orderSectionTweaks(items, "performance");
assert.deepEqual(
  ordered.map((t) => t.id),
  ["power_plan_performance", "ecoqos_rules", "disable_game_dvr", "unknown-first", "unknown-second"],
);
assert.deepEqual(items, original, "Sorting must not mutate the catalog");
assert.deepEqual(
  orderSectionTweaks(
    items.map((t) => ({ ...t, requires_pro: !t.requires_pro })),
    "performance",
  ).map((t) => t.id),
  ordered.map((t) => t.id),
  "Price tier must not change relevance ordering",
);
assert.deepEqual(orderSectionTweaks(items, "privacy"), original);
assert.deepEqual(orderSectionTweaks([], "gaming"), []);
const gaming = orderSectionTweaks(
  [
    "disable_memory_integrity",
    "hardware_gpu_scheduling",
    "reduce_input_lag",
    "monitor_refresh_profile",
  ].map((id) => ({ id })),
  "gaming",
);
assert.deepEqual(
  gaming.map((t) => t.id),
  [
    "monitor_refresh_profile",
    "reduce_input_lag",
    "hardware_gpu_scheduling",
    "disable_memory_integrity",
  ],
);
console.log(
  "PASS: relevance order, mixed tiers, stable unknowns, unchanged catalog, security tradeoff last.",
);
