// Validates the translation table beyond what the compiler can see.
//
// TypeScript already guarantees every locale has every key (they all satisfy
// the `Strings` interface). What it cannot check is the *content*: a string
// that loses its `{count}` placeholder in one language still type-checks, but
// renders a broken sentence — with a literal gap where the number should be —
// to every user of that language. This catches that before it ships.
//
// Run with: npm run check:i18n
import { build } from "esbuild";

const LANGS = ["it", "en", "fr", "es", "de"];
const REFERENCE = "it";

const bundled = await build({
  entryPoints: ["src/i18n.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
});

const code = Buffer.from(bundled.outputFiles[0].text).toString("base64");
const { STRINGS } = await import(`data:text/javascript;base64,${code}`);

function flatten(value, prefix = "", out = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, path, out);
    else out[path] = child;
  }
  return out;
}

const placeholders = (text) =>
  [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const flat = Object.fromEntries(LANGS.map((lang) => [lang, flatten(STRINGS[lang])]));
const problems = [];

for (const key of Object.keys(flat[REFERENCE])) {
  const expected = placeholders(flat[REFERENCE][key]);

  for (const lang of LANGS) {
    const value = flat[lang][key];

    if (value === undefined) {
      problems.push(`${lang}: missing key "${key}"`);
      continue;
    }
    if (typeof value !== "string") continue;
    if (value.trim() === "") {
      problems.push(`${lang}: "${key}" is empty`);
      continue;
    }

    const actual = placeholders(value);
    if (actual.join(",") !== expected.join(",")) {
      problems.push(
        `${lang}: "${key}" placeholders [${actual}] don't match ${REFERENCE} [${expected}]\n      ${lang}: ${value}`,
      );
    }
    // A leftover "{...}" that isn't a known placeholder is almost always a typo
    // ({conut}, {Name}) that would render literally to the user.
    for (const name of actual) {
      if (!expected.includes(name)) problems.push(`${lang}: "${key}" has unknown placeholder {${name}}`);
    }
  }
}

// Keys present in a translation but not in the reference: dead strings, or a
// rename that only landed in some languages.
for (const lang of LANGS) {
  for (const key of Object.keys(flat[lang])) {
    if (!(key in flat[REFERENCE])) problems.push(`${lang}: extra key "${key}" not in ${REFERENCE}`);
  }
}

const keyCount = Object.keys(flat[REFERENCE]).length;

if (problems.length > 0) {
  console.error(`i18n check FAILED — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

console.log(`i18n check passed: ${keyCount} keys x ${LANGS.length} languages, all placeholders consistent.`);
