// Grammar guards for translations: no doubled word in Portuguese, and every
// count label beside a number has a singular (…One) form that really differs
// from the plural in the languages that inflect.
import { loadTranslations } from "./i18n-tables.mjs";

const T = await loadTranslations();
const problems = [];

function walk(value, path, visit) {
  if (typeof value === "string") visit(path, value);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, visit);
}

// 1. Doubled consecutive words in pt ("por isso isso").
walk(T.pt, "", (path, text) => {
  const m = text.match(/(?<![\p{L}\p{N}])(\p{L}{2,})\s+\1(?![\p{L}\p{N}])/iu);
  if (m) problems.push(`pt ${path}: repeated word "${m[1]}"`);
});

// 2. Count labels: singular key must exist everywhere; it/fr/es/pt must inflect.
const COUNT_LABELS = ["installed", "removable", "selected"];
const INFLECTS = ["it", "fr", "es", "pt"];
for (const lang of Object.keys(T)) {
  const d = T[lang].componentDebloat;
  for (const key of COUNT_LABELS) {
    if (typeof d[key] !== "string" || typeof d[`${key}One`] !== "string")
      problems.push(`${lang} componentDebloat.${key}: missing plural or ${key}One form`);
    else if (INFLECTS.includes(lang) && d[key] === d[`${key}One`])
      problems.push(`${lang} componentDebloat.${key}: plural equals singular "${d[key]}"`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("i18n grammar OK");
