// Validates the translation table beyond what the compiler can see.
//
// TypeScript already guarantees every locale has every key (they all satisfy
// the `Strings` interface). What it cannot check is the *content*: a string
// that loses its `{count}` placeholder in one language still type-checks, but
// renders a broken sentence — with a literal gap where the number should be —
// to every user of that language. This catches that before it ships.
//
// Run with: npm run check:i18n
import { loadTranslations } from "./i18n-tables.mjs";

const LANGS = ["it", "en", "fr", "es", "de", "pt"];
const REFERENCE = "it";

const STRINGS = await loadTranslations();

function flatten(value, prefix = "", out = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object") flatten(child, path, out);
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
    if (/\uFFFD|\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2\u20ac/.test(value)) {
      problems.push(`${lang}: "${key}" contains corrupted encoding`);
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

// Portuguese is European Portuguese (pt-PT), never Brazilian: the owner's
// decision of 11 Oct 2026. Words and constructions that are Brazilian-only,
// matched as whole words (JavaScript's \b ignores accented letters).
const BRAZILIAN = [
  "tela", "telas", "arquivo(?! de componentes)", "arquivos", "usuári[oa]s?", "celular",
  "aplicativos?", "gerenci\\p{L}*", "salv(ar|e|ou|ando|ei)", "baix(ar|e|ou|ando|ado|ados|ada|adas)",
  "mouse", "senhas?", "vocês?", "cadastr\\p{L}*", "registr(o|os|ar|ado|ados|ada|adas|ou|e)",
  "detect\\p{L}*", "contato", "fato", "lixeira", "deletar", "equipe", "câmera",
  "autônom\\p{L}*", "anônim\\p{L}*", "eletrônic\\p{L}*", "econômic\\p{L}*", "fenômen\\p{L}*",
].map((w) => new RegExp(`(?<!\\p{L})(${w})(?!\\p{L})`, "iu"));
// "está fazendo" (pt-PT: "está a fazer"), a label opening on a gerund
// ("Verificando..."), and a sentence opening on a bare possessive ("Seu PC").
const BRAZILIAN_SYNTAX = [
  /(?<!\p{L})(est(á|ão|ava|avam|ou|amos)|fic(a|am)|continua(m)?)\s+\p{L}+ndo(?!\p{L})/iu,
  /^(?!Quando|Comando|Segundo|Fundo|Mundo)\p{L}+(ando|endo|indo)(?!\p{L})/u,
  /(^|[.:;!?]\s+)(Seu|Sua|Seus|Suas)\s/u,
];
for (const [key, value] of Object.entries(flat.pt)) {
  if (typeof value !== "string") continue;
  const hit = [...BRAZILIAN, ...BRAZILIAN_SYNTAX].map((re) => value.match(re)).find(Boolean);
  if (hit) problems.push(`pt: "${key}" is Brazilian Portuguese ("${hit[0].trim()}"), use pt-PT\n      pt: ${value}`);
}

const keyCount = Object.keys(flat[REFERENCE]).length;

if (problems.length > 0) {
  console.error(`i18n check FAILED — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

console.log(`i18n check passed: ${keyCount} keys x ${LANGS.length} languages, all placeholders consistent.`);
