import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Ratchet for the "Control Room" token system (src/App.css): components may
// only use semantic color utilities (text-ink-2, bg-surface-1, text-danger,
// ...). Raw Tailwind palette classes (text-rose-300, bg-white/5) ignore the 14
// themes and the AA-tuned status colors. The legacy ones are being removed
// screen by screen, so this does not demand zero: it fails when any file has
// MORE than its recorded baseline, and tells you to lower the baseline when a
// file improves. `node scripts/check-design-tokens.mjs --update` rewrites it.

const root = fileURLToPath(new URL("..", import.meta.url));
const baselinePath = join(root, "scripts", "design-token-baseline.json");
const RAW =
  /\b(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|from|via|to|fill|stroke|shadow|outline|divide|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/(?:\d+|\[[\d.]+\]))?(?![\w-])/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(tsx|ts)$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

const counts = {};
for (const file of walk(join(root, "src"))) {
  const n = (readFileSync(file, "utf8").match(RAW) ?? []).length;
  if (n > 0) counts[relative(root, file).replaceAll("\\", "/")] = n;
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (process.argv.includes("--update")) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + "\n");
  console.log(
    `design-token baseline updated: ${total} raw palette classes in ${Object.keys(sorted).length} files`,
  );
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const worse = [];
const better = [];
for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
  const now = counts[file] ?? 0;
  const allowed = baseline[file] ?? 0;
  if (now > allowed) worse.push(`  ${file}: ${now} (baseline ${allowed})`);
  else if (now < allowed) better.push(`  ${file}: ${now} (baseline ${allowed})`);
}

if (worse.length > 0) {
  console.error(
    "Raw Tailwind palette classes increased. Use the semantic tokens from src/App.css\n" +
      "(ink/ink-2/ink-3, surface-1/2/hover, line/line-2, accent, ok/warn/caution/danger/info):\n" +
      worse.join("\n"),
  );
  process.exit(1);
}
if (better.length > 0) {
  console.log(
    "Fewer raw palette classes than the baseline - lock it in with --update:\n" + better.join("\n"),
  );
}
console.log(`design tokens OK: ${total} legacy raw palette classes left`);
