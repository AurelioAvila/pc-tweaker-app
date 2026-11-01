// Text on the accent (buttons, badges, the trial pill) must clear WCAG AA, 4.5:1,
// in every theme (owner, 1 Nov 2026). Reads each theme's raw values and the
// `--on-accent` rule from src/App.css, evaluates it the way the browser does
// (color-mix in oklab or srgb), and fails if any theme falls short. A theme
// may override `--on-accent` in its own block when dark ink is not enough.
// Run with: node scripts/check-on-accent.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");
const AA = 4.5;

const hex = (h) => {
  const v = h.length === 4 ? [...h.slice(1)].map((c) => c + c).join("") : h.slice(1);
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
};
const named = { black: [0, 0, 0], white: [1, 1, 1] };
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const toOklab = ([r, g, b]) => {
  [r, g, b] = [r, g, b].map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const fromOklab = ([L, a, b]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, gam(c))));
};
const luminance = (rgb) => {
  const [r, g, b] = rgb.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (x, y) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

/** A colour value as App.css writes it: hex, black/white, var(--x), or one color-mix(). */
function evaluate(value, vars) {
  value = value.trim();
  const v = value.match(/^var\((--[\w-]+)\)$/);
  if (v) return evaluate(vars[v[1]] ?? "", vars);
  if (value.startsWith("#")) return hex(value);
  if (named[value]) return named[value];
  const mix = value.match(/^color-mix\(in (oklab|srgb),\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+)\)$/);
  if (!mix) throw new Error(`cannot evaluate "${value}"`);
  const p = Number(mix[3]) / 100;
  const a = evaluate(mix[2], vars);
  const b = evaluate(mix[4], vars);
  if (mix[1] === "srgb") return a.map((c, i) => c * p + b[i] * (1 - p));
  const [la, lb] = [toOklab(a), toOklab(b)];
  return fromOklab(la.map((c, i) => c * p + lb[i] * (1 - p)));
}

const declarations = (block) =>
  Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]));
const rootBlock = css.match(/:root\s*\{[^}]*--on-accent:[^}]*\}/)?.[0];
if (!rootBlock) throw new Error("--on-accent is not defined on :root in src/App.css");
const base = declarations(rootBlock);
const themes = [...css.matchAll(/\[data-theme="([\w-]+)"\]\s*\{([^}]*)\}/g)];
if (themes.length < 14) throw new Error(`expected 14 themes, found ${themes.length}`);

const failures = [];
for (const [, name, block] of themes) {
  const vars = { ...base, ...declarations(block) };
  const ink = evaluate("var(--on-accent)", vars);
  const ratio = contrast(ink, evaluate("var(--app-accent)", vars));
  const line = `${name.padEnd(16)} ${ratio.toFixed(2)}:1`;
  console.log(ratio >= AA ? `ok   ${line}` : `FAIL ${line}`);
  if (ratio < AA) failures.push(name);
}
// The token only helps where it is used: a solid accent fill must not set any
// other text colour (the sign-in buttons once used white, 2.8:1).
const src = fileURLToPath(new URL("../src/", import.meta.url));
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const misuse = [];
for (const file of walk(src)) {
  const text = readFileSync(file, "utf8");
  if (file.endsWith(".css")) {
    for (const [, selector, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const fill = body.match(/background(?:-color)?:\s*var\(--(?:app-)?accent\)\s*;/);
      const color = body.match(/(?:^|[;\s])color:\s*([^;]+);/)?.[1].trim();
      if (fill && color && !/^var\(--(?:color-)?on-accent\b/.test(color))
        misuse.push(`${relative(src, file)}: ${selector.trim().split("\n").pop()} sets ${color}`);
    }
  } else if (/\.tsx?$/.test(file)) {
    for (const [cls] of text.matchAll(
      /"[^"\n]*\bbg-(?:accent|\[var\(--(?:app-)?accent\)\])(?=[\s"])[^"\n]*"/g,
    ))
      if (/\btext-(?:white|black|ink(?:-\d)?)\b/.test(cls))
        misuse.push(`${relative(src, file)}: ${cls}`);
  }
}
for (const m of misuse) console.error(`FAIL ${m} (use var(--on-accent) / text-on-accent)`);
if (failures.length) console.error(`On-accent text below ${AA}:1 in: ${failures.join(", ")}`);
if (failures.length || misuse.length) process.exit(1);
console.log(
  `On-accent text clears ${AA}:1 on all ${themes.length} themes, and every solid accent fill uses it.`,
);
