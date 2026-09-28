import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
const native = fs.readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const hives = [...native.matchAll(/hive:\s*"([^"]*)"/g)].map((match) => match[1]);
assert.equal(
  hives.filter((value) => value === "\\u{2014}").length,
  14,
  "All composite tweaks use the encoding-safe sentinel",
);
assert.ok(
  hives.every((value) => ["\\u{2014}", "Windows API"].includes(value)),
  "No corrupted native badges",
);
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
