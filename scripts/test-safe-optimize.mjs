// Safe optimize (1.19): the list stays low-risk and every entry has its reason
// in every language. Run with: node scripts/test-safe-optimize.mjs
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const outfile = new URL(".safe-optimize-test-bundle.mjs", import.meta.url);
let loaded;
try {
  await build({
    stdin: {
      contents: `
        export { SAFE_OPTIMIZE, safePlan } from './src/components/safe-optimize';
        export { PROOF_COPY } from './src/components/proof-copy';
        export { MANUAL_ONLY_TWEAK_IDS } from './src/catalog';
      `,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    define: { "import.meta.env": "{}" },
    external: ["react", "react/*", "@tauri-apps/*"],
    loader: { ".css": "empty", ".png": "empty", ".svg": "empty" },
    outfile: fileURLToPath(outfile),
    logLevel: "silent",
  });
  loaded = await import(outfile.href);
} finally {
  rmSync(outfile, { force: true });
}
const { SAFE_OPTIMIZE, safePlan, PROOF_COPY, MANUAL_ONLY_TWEAK_IDS } = loaded;

const registry = readFileSync(new URL("../src-tauri/src/tweaks.rs", import.meta.url), "utf8");
const settings = readFileSync(
  new URL("../src-tauri/src/settings_tweaks.rs", import.meta.url),
  "utf8",
);

const blockOf = (id) =>
  registry.split(`id: "${id}"`)[1]?.split("RegistryTweak {")[0] ??
  settings.split(`id: "${id}"`)[1]?.split("SettingsTweak {")[0];
// A policy shows "managed by your organization" in Settings: never "safe".
const POLICY = /\\Policies\\/i;
assert.match(blockOf("disable_delivery_optimization"), POLICY, "the policy check sees policies");

assert.equal(new Set(SAFE_OPTIMIZE).size, SAFE_OPTIMIZE.length, "no duplicates");
for (const id of SAFE_OPTIMIZE) {
  assert.ok(!MANUAL_ONLY_TWEAK_IDS.has(id), `${id} is manual-only`);
  const block = blockOf(id);
  assert.ok(block, `${id} is not in the tweak catalogue`);
  assert.doesNotMatch(block, POLICY, `${id} writes a policy`);
  // Per-user, or the one machine switch Control Panel itself offers.
  if (!/hive: Hive::Hkcu/.test(block))
    assert.equal(id, "block_oem_device_apps", `${id} is not per-user`);
}

const langs = Object.keys(PROOF_COPY);
assert.deepEqual(langs.sort(), ["de", "en", "es", "fr", "it", "pt"]);
for (const lang of langs) {
  const reasons = PROOF_COPY[lang].safeReasons;
  assert.deepEqual(
    Object.keys(reasons).sort(),
    [...SAFE_OPTIMIZE].sort(),
    `${lang}: one reason per id`,
  );
  for (const [id, text] of Object.entries(reasons)) {
    assert.ok(text.length > 30 && /[.!]$/.test(text), `${lang}: ${id} reason`);
  }
}

// The plan: what runs now, what Pro adds, what is already in place.
const t = (id, extra = {}) => ({
  id,
  name: id,
  description: "",
  category: "privacy",
  hive: "HKCU",
  requires_admin: false,
  requires_pro: false,
  applied: false,
  changes: [],
  ...extra,
});
const catalog = [
  t("disable_start_suggestions", { applied: true }),
  t("disable_suggested_apps", { already_set: true }),
  t("disable_feedback_requests"),
  t("disable_startup_delay", { unavailable: "windows_version" }),
  t("disable_windows_suggestions", { requires_pro: true }),
  t("block_oem_device_apps", { requires_pro: true, requires_admin: true, hive: "HKLM" }),
  t("dark_mode"),
];
const ids = (list) => list.map((x) => x.id);
const free = safePlan(catalog, false);
assert.deepEqual(ids(free.ready), ["disable_feedback_requests"]);
assert.deepEqual(ids(free.locked), ["disable_windows_suggestions", "block_oem_device_apps"]);
assert.deepEqual(ids(free.items), [
  "disable_start_suggestions",
  "disable_suggested_apps",
  "disable_feedback_requests",
  "disable_windows_suggestions",
  "block_oem_device_apps",
]);
const pro = safePlan(catalog, true);
assert.deepEqual(ids(pro.ready), [
  "disable_feedback_requests",
  "disable_windows_suggestions",
  "block_oem_device_apps",
]);
assert.deepEqual(pro.locked, []);
assert.ok(!ids(pro.items).includes("dark_mode"), "only listed settings");
assert.deepEqual(safePlan([], true).ready, []);

console.log(
  `safe optimize OK: ${SAFE_OPTIMIZE.length} settings, reasons in ${langs.length} languages`,
);
