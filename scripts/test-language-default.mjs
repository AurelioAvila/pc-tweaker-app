// English is the default at first launch whatever the Windows or WebView
// language, and only an explicit choice in the language menu is remembered
// (owner decision, 11 Oct 2026). Run with: node scripts/test-language-default.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const bundle = await build({
  stdin: {
    contents: "export { detectInitialLang, localeOf, LANGUAGES } from './src/i18n';",
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
});
const { detectInitialLang, localeOf, LANGUAGES } = await import(
  "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64")
);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
function windowsLanguage(tag) {
  Object.defineProperty(globalThis, "navigator", {
    value: { language: tag, languages: [tag] },
    configurable: true,
  });
}

// 1. Nothing chosen: English, whatever Windows/WebView says.
for (const tag of ["it-IT", "pt-PT", "pt-BR", "de-DE", "fr-FR", "es-ES", "en-US"]) {
  windowsLanguage(tag);
  store.clear();
  assert.equal(detectInitialLang(), "en", `no saved choice on a ${tag} system must open in English`);
}

// 2. An explicit choice is kept, on any system language.
windowsLanguage("it-IT");
for (const lang of ["it", "en", "fr", "es", "de", "pt"]) {
  store.set("pc-tweaker-lang", lang);
  assert.equal(detectInitialLang(), lang, `a saved "${lang}" must be kept`);
}

// 3. Anything that is not one of the six languages falls back to English.
for (const junk of ["", "pt-BR", "xx", "toString", "__proto__", "constructor"]) {
  store.set("pc-tweaker-lang", junk);
  assert.equal(detectInitialLang(), "en", `a saved "${junk}" must fall back to English`);
}

// 4. Portuguese is European Portuguese, in the menu and for dates/numbers.
assert.equal(LANGUAGES.find((l) => l.code === "pt").native, "Português (Portugal)");
assert.equal(localeOf("pt"), "pt-PT");
assert.equal(localeOf("en"), "en");

// 5. Only the language menu writes the choice, and the dev-only start
//    language can never reach a production build.
const files = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(`${dir}/${e.name}`) : /\.(ts|tsx)$/.test(e.name) ? [`${dir}/${e.name}`] : [],
  );
const sources = files(`${root}src`).map((f) => [f, fs.readFileSync(f, "utf8")]);
const writers = sources.filter(([, s]) => /setItem\(\s*["']pc-tweaker-lang["']/.test(s));
assert.deepEqual(
  writers.map(([f]) => f.slice(root.length).replace(/\\/g, "/")),
  ["src/App.tsx"],
  "only App.tsx may save the language",
);
const app = writers[0][1];
assert.match(app, /function setLang\(l: Lang\) \{\s*setLangState\(l\);\s*localStorage\.setItem\("pc-tweaker-lang", l\);/);
assert.match(app, /import\.meta\.env\.DEV && \(import\.meta\.env\.VITE_START_LANG/);
const callers = sources.filter(([, s]) => /\bsetLang\(/.test(s)).map(([f]) => f.slice(root.length).replace(/\\/g, "/"));
assert.deepEqual(callers.sort(), ["src/App.tsx", "src/components/account.tsx"], "setLang is called only by the language menu");

console.log("language default test passed: English first, explicit choice kept, pt is pt-PT.");
