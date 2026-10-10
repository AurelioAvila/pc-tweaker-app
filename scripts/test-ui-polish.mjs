import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
const native = fs.readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const hives = [...native.matchAll(/hive:\s*"([^"]*)"/g)].map((match) => match[1]);
assert.equal(
  hives.filter((value) => value === "\\u{2014}").length,
  15,
  "All composite tweaks use the encoding-safe sentinel",
);
assert.ok(
  hives.every((value) => ["\\u{2014}", "Windows API"].includes(value)),
  "No corrupted native badges",
);
// One badge component. Every tag in the app goes through `Badge`, so Pro,
// Admin, hive and status tags cannot drift apart again.
const ui = fs.readFileSync(new URL("../src/components/ui.tsx", import.meta.url), "utf8");
assert.match(ui, /export function Badge\(/, "Badge is exported from ui.tsx");
assert.doesNotMatch(
  ui,
  /export function (ProBadge|ShieldBadge|SoonBadge)\b/,
  "no second badge component",
);
const sources = fs
  .readdirSync(new URL("../src", import.meta.url), { recursive: true })
  .filter((f) => /\.(tsx|css)$/.test(f))
  .map((f) => [
    f.replaceAll("\\", "/"),
    fs.readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"),
  ]);
// A deliberate exception: the removable filter chip in the cookie cleaner is an input, not a tag.
const pillAllowed = new Set(["components/cleaners.tsx"]);
for (const [file, text] of sources) {
  assert.doesNotMatch(text, /\b(tool-pro-tag|scan-tag|pro-chip)\b/, `${file}: local badge class`);
  assert.doesNotMatch(
    text,
    /\baccent-sky-\d+/,
    `${file}: checkbox colour outside the theme accent`,
  );
  if (file.endsWith(".tsx") && !pillAllowed.has(file))
    assert.doesNotMatch(
      text,
      /<span\s+className=[{"`][^"`]*rounded-full[^"`]*\bpy-(?:0\.5|1|1\.5)\b/,
      `${file}: hand-made pill; use <Badge>`,
    );
}
// A failing page shows a way back instead of a blank window: both workspace
// views sit inside a page boundary, and the whole app inside a root one.
const appSource = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
assert.equal(appSource.match(/<PageBoundary /g)?.length, 2, "both workspace views are guarded");
assert.match(mainSource, /<PageBoundary[^>]*scope="app"[^>]*>\s*<App \/>/, "the root is guarded");
const { outputFiles } = await build({
  stdin: {
    contents: `
 import {createElement} from 'react';
 import {renderToStaticMarkup} from 'react-dom/server';
 import {TweakIcon} from './src/components/tweak-icon';
 export const render = id => renderToStaticMarkup(createElement(TweakIcon,{id,fallback:'fallback'}));
`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
});
const module = { exports: {} };
new Function("module", "exports", "require", outputFiles[0].text)(
  module,
  module.exports,
  (await import("node:module")).createRequire(import.meta.url),
);
for (const [id, tone] of [
  ["reduce_input_lag", "cyan"],
  ["disable_mouse_acceleration", "cyan"],
  ["disable_sticky_keys_prompt", "cyan"],
  ["disable_filter_keys_shortcut", "cyan"],
  ["hardware_gpu_scheduling", "violet"],
  ["priority_separation", "amber"],
  ["keep_kernel_in_ram", "violet"],
]) {
  const html = module.exports.render(id);
  assert.ok(html.includes(`data-tone="${tone}"`), id);
  assert.ok(!html.includes("fallback"), id);
  assert.ok(html.includes('aria-hidden="true"'), id);
}
assert.ok(module.exports.render("future_unknown_setting").includes("fallback"));
console.log(
  "PASS: native hive labels, semantic mouse/keyboard/CPU/GPU/RAM icons, decorative accessibility and unknown fallback.",
);
