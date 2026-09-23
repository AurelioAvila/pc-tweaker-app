import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL("../src/components/debloat-copy.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { DEBLOAT_COPY, DEBLOAT_IMPACT } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);
assert.deepEqual(Object.keys(DEBLOAT_COPY).sort(), ["de", "en", "es", "fr", "it", "pt"]);
assert.deepEqual(Object.keys(DEBLOAT_IMPACT).sort(), [
  "clipchamp",
  "copilot",
  "news",
  "outlook",
  "solitaire",
  "weather",
]);
for (const [lang, copy] of Object.entries(DEBLOAT_COPY)) {
  for (const key of [
    ...Object.values(DEBLOAT_IMPACT),
    "publisherMismatch",
    "protectedPackage",
    "dependency",
    "nonRemovable",
    "unverifiedRemovability",
    "requiresStandardUser",
    "previewIntro",
    "recoveryNote",
    "removable",
    "all",
    "filterLabel",
    "details",
    "elevatedTitle",
  ]) {
    assert.ok(copy[key]?.trim(), `${lang}: missing ${key}`);
    if (lang !== "en")
      assert.notEqual(copy[key], DEBLOAT_COPY.en[key], `${lang}: untranslated ${key}`);
  }
}
const advanced = await build({
  entryPoints: [fileURLToPath(new URL("../src/components/advanced-copy.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { ADVANCED_COPY } = await import(
  `data:text/javascript;base64,${Buffer.from(advanced.outputFiles[0].text).toString("base64")}`
);
const catalogue = await build({
  entryPoints: [fileURLToPath(new URL("../src/catalog.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { CONFIGURABLE_TWEAK_IDS, isCurrentCatalogTweak } = await import(
  `data:text/javascript;base64,${Buffer.from(catalogue.outputFiles[0].text).toString("base64")}`
);
assert.deepEqual([...CONFIGURABLE_TWEAK_IDS].sort(), [
  "ecoqos_rules",
  "limit_do_background_download",
  "monitor_refresh_profile",
]);
assert.equal(isCurrentCatalogTweak("disable_copilot"), false);
assert.equal(isCurrentCatalogTweak("turbo_boost"), true);
assert.deepEqual(Object.keys(ADVANCED_COPY).sort(), Object.keys(DEBLOAT_COPY).sort());
for (const [lang, copy] of Object.entries(ADVANCED_COPY)) {
  for (const key of [
    "ecoConflict",
    "doReadback",
    "doRestore",
    "monitorPreview",
    "monitorConfirm",
    "monitorRestore",
  ]) {
    assert.ok(copy[key]?.trim(), `${lang}: missing ${key}`);
    if (lang !== "en")
      assert.notEqual(copy[key], ADVANCED_COPY.en[key], `${lang}: untranslated ${key}`);
  }
}
console.log("Debloat and advanced UI copy: six locales, recovery and safety text checked.");
