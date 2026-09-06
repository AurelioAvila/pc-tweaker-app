import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STARTER_PRESETS, presetSelection } from "../src/components/starter-presets.mjs";

const registry = readFileSync(new URL("../src-tauri/src/tweaks.rs", import.meta.url), "utf8");
const gaming = readFileSync(new URL("../src-tauri/src/gaming.rs", import.meta.url), "utf8");
for (const preset of STARTER_PRESETS) {
  assert.equal(new Set(preset.tweaks.map((t) => t.id)).size, preset.tweaks.length);
  for (const tweak of preset.tweaks) {
    if (tweak.id === "reduce_input_lag") {
      assert.match(
        gaming,
        /pub fn input_lag_info\(\)[\s\S]*?requires_admin: false,[\s\S]*?requires_pro: false/,
      );
      continue;
    }
    const block = registry.split(`id: "${tweak.id}"`)[1]?.split("RegistryTweak {")[0];
    assert.ok(block, `Unknown preset tweak: ${tweak.id}`);
    assert.match(block, /requires_admin: false/);
    assert.match(block, /requires_pro: false/);
    assert.match(block, /hive: Hive::Hkcu/);
  }
}
const preset = STARTER_PRESETS[0];
const catalog = preset.tweaks.map((t, i) => ({
  id: t.id,
  applied: i === 0,
  requires_pro: i === 1,
}));
let selection = presetSelection(
  preset,
  catalog,
  ["disable_game_dvr", "reduce_input_lag", "untrusted"],
  false,
);
assert.deepEqual(
  selection.pending.map((t) => t.id),
  ["reduce_input_lag"],
);
assert.deepEqual(
  selection.locked.map((t) => t.id),
  ["reduce_input_lag"],
);
assert.deepEqual(presetSelection(preset, catalog, [], false).pending, []);
assert.deepEqual(
  presetSelection(preset, catalog, ["disable_sticky_keys_prompt"], true).pending.map((t) => t.id),
  ["disable_sticky_keys_prompt"],
);
assert.equal(
  presetSelection(
    preset,
    [],
    preset.tweaks.map((t) => t.id),
    true,
  ).missing.length,
  3,
);
assert.deepEqual(
  presetSelection(
    preset,
    catalog.map((t) => ({ ...t, applied: true })),
    preset.tweaks.map((t) => t.id),
    true,
  ).pending,
  [],
);
console.log(
  "Starter profile checks passed: catalog, Free/user scope, selection, already applied, unavailable and Pro gating.",
);
