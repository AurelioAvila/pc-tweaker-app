/**
 * Translation quality audit (advisory, not part of `npm run check`).
 *
 * `check-i18n.mjs` proves every key EXISTS in every locale with matching
 * placeholders. That says nothing about whether the text was actually
 * translated — an entry copy-pasted from English passes it happily, which is
 * exactly how "Scan"/"Performance"/"UI" sat untranslated in four locales.
 *
 * This script flags the things a human reviewer would look for:
 *   1. strings byte-identical to English in another locale
 *   2. ASCII stand-ins where the language needs an accent ("piu'", "tornera'")
 *   3. Spanish/French questions and exclamations missing their opening marks
 *
 * Everything it reports is a CANDIDATE. Plenty of identical strings are
 * correct ("CPU", "Pro", "Gaming", "{hours}h {minutes}m"), so the output is
 * meant to be read, not blindly obeyed.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(root, "..", "src", "i18n.ts");

const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64")
);

const STRINGS = mod.STRINGS;
const LOCALES = Object.keys(STRINGS);

/** Flattens nested objects/arrays into dotted paths. */
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (Array.isArray(v)) v.forEach((item, i) => flatten({ [i]: item }, key, out));
    else if (v && typeof v === "object") flatten(v, key, out);
  }
  return out;
}

const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(STRINGS[l])]));

// Terms that are genuinely the same word in these languages, or are not words
// at all. Matching English here is correct, not a missing translation.
const SAME_ON_PURPOSE = new Set([
  "CPU", "RAM", "Pro", "Free", "PC Tweaker", "UI", "Gaming", "Privacy", "GB", "MB",
  "Windows", "Stripe", "DNS", "VPN", "Turbo Gaming", "Game Sessions", "SCAN", "OK",
]);

function looksIntentional(value) {
  if (SAME_ON_PURPOSE.has(value.trim())) return true;
  // Pure placeholder/format strings and numbers carry no language.
  if (/^[\s\d{}\-:/.,%€$+hms]*$/.test(value)) return true;
  if (/^\{[a-zA-Z]+\}/.test(value) && value.length < 25) return true;
  return false;
}

const untranslated = [];
for (const key of Object.keys(flat.en)) {
  const enValue = flat.en[key];
  if (typeof enValue !== "string" || !enValue.trim() || looksIntentional(enValue)) continue;
  for (const locale of LOCALES) {
    if (locale === "en") continue;
    if (flat[locale][key] === enValue) {
      untranslated.push({ locale, key, value: enValue });
    }
  }
}

// ASCII stand-ins for letters the language actually needs.
//
// The word lists below are matched with Unicode-aware boundaries rather than
// `\b`. That distinction is not academic: JavaScript's `\b` is defined against
// `\w`, i.e. [A-Za-z0-9_], so every accented letter counts as a *non*-word
// character and manufactures a word boundary next to itself. `\btres\b` duly
// matched the "tres" inside "fenêtres" and "Paramètres" — two of the most
// common words in French — and reported perfectly correct translations as
// missing their accents. Anchoring on "not a letter" instead, with \p{L}
// covering accented letters, is what makes the check mean what it says.
const ACCENT_TRAPS = {
  it: /(?<!\p{L})(piu|gia|perche|finche|cosi|puo|sara|verra|tornera|citta|liberta|e)'/iu,
  fr: /(?<!\p{L})(deja|apres|tres|etre|meme|repondre|desactive|liberer|memoire|systeme|reglage)(?!\p{L})/iu,
  es: /(?<!\p{L})(automatica|analisis|sesion|configuracion|informacion|esta a|volvera|desactivaran)(?!\p{L})/iu,
  de: /(?<!\p{L})(ausfuhrbar|zurucksetzen|Anderungen|regelmassigen|geoffnet|Oberflache|fur)(?!\p{L})/iu,
};

const accentIssues = [];
for (const [locale, re] of Object.entries(ACCENT_TRAPS)) {
  for (const [key, value] of Object.entries(flat[locale] ?? {})) {
    if (typeof value === "string" && re.test(value)) {
      accentIssues.push({ locale, key, value });
    }
  }
}

// The regexes above are load-bearing and easy to break silently — a bad edit
// would simply stop reporting anything and look like a clean run. These assert
// both directions on the exact case that was wrong before.
const ACCENT_TRAP_SELF_TEST = [
  { locale: "fr", text: "les fenêtres ouvertes", shouldMatch: false },
  { locale: "fr", text: "dans les Paramètres", shouldMatch: false },
  { locale: "fr", text: "tres bien", shouldMatch: true },
  { locale: "fr", text: "deja fait", shouldMatch: true },
  { locale: "it", text: "piu' veloce", shouldMatch: true },
  { locale: "it", text: "più veloce", shouldMatch: false },
];
for (const c of ACCENT_TRAP_SELF_TEST) {
  const got = ACCENT_TRAPS[c.locale].test(c.text);
  if (got !== c.shouldMatch) {
    console.error(
      `accent-trap self-test failed: [${c.locale}] ${JSON.stringify(c.text)} ` +
        `matched=${got}, expected=${c.shouldMatch}`,
    );
    process.exit(2);
  }
}

// Spanish always opens questions/exclamations; French uses them too but only
// at the end, so only Spanish is checked here.
const punctuationIssues = [];
for (const [key, value] of Object.entries(flat.es ?? {})) {
  if (typeof value !== "string") continue;
  if (value.trimEnd().endsWith("?") && !value.includes("¿")) {
    punctuationIssues.push({ locale: "es", key, value, why: "missing opening ¿" });
  }
  if (value.trimEnd().endsWith("!") && !value.includes("¡")) {
    punctuationIssues.push({ locale: "es", key, value, why: "missing opening ¡" });
  }
}

/**
 * Reviewed and accepted: these keys are the same word in that language, so
 * matching English is correct. Anything NOT on this list is treated as a
 * failure, which is what turns this from a report you can ignore into a
 * check that stops the next "THEMES" from shipping in four languages.
 *
 * Adding a line here is a deliberate statement that a human looked at it.
 */
const REVIEWED_AS_CORRECT = new Set([
  // "Focus" is standard Italian product language; "Active" is valid French.
  "it:command.profileFocus", "fr:command.statusActive",
  // "PC Tweaker Uninstaller" is the product's name in every language.
  "it:uninstallerPromo.title", "fr:uninstallerPromo.title", "es:uninstallerPromo.title", "de:uninstallerPromo.title",
  "it:badges.admin", "fr:badges.admin", "es:badges.admin", "de:badges.admin",
  "it:badges.pro", "fr:badges.pro", "es:badges.pro", "de:badges.pro",
  "it:turboBoost.title", "fr:turboBoost.title", "es:turboBoost.title", "de:turboBoost.title",
  "it:turboBoost.startLabel", "fr:turboBoost.startLabel", "es:turboBoost.startLabel", "de:turboBoost.startLabel",
  "it:turboBoost.stopLabel", "fr:turboBoost.stopLabel", "es:turboBoost.stopLabel", "de:turboBoost.stopLabel",
  "it:menu.account",
  "es:menu.plan",
  "it:auth.email",
  "it:auth.password",

  // Storage acronyms. HDD, SSD and NVMe are the same in every locale we
  // ship — they are product names, not words, and "translating" them would
  // invent terminology no user would recognise on their own spec sheet.
  "it:scan.diskHdd", "fr:scan.diskHdd", "es:scan.diskHdd", "de:scan.diskHdd",
  "it:scan.diskSsd", "fr:scan.diskSsd", "es:scan.diskSsd", "de:scan.diskSsd",
  "it:scan.diskNvme", "fr:scan.diskNvme", "es:scan.diskNvme", "de:scan.diskNvme",

  // Borrowed into these languages unchanged: "desktop" is the ordinary
  // Italian and German word for the machine type, and "Optional" and
  // "Configurations" are correct German and French spellings respectively —
  // identical to English by coincidence, not by omission.
  "it:scan.formDesktop", "de:scan.formDesktop",
  "de:scan.groupOptional",
  "fr:tabs.profiles", "fr:profiles.title",
]);

const unexplained = untranslated.filter((r) => !REVIEWED_AS_CORRECT.has(`${r.locale}:${r.key}`));

function report(title, rows) {
  console.log(`\n${title}: ${rows.length}`);
  for (const r of rows) {
    console.log(`  [${r.locale}] ${r.key}${r.why ? ` (${r.why})` : ""}`);
    console.log(`      ${JSON.stringify(r.value)}`);
  }
}

const problems = unexplained.length + accentIssues.length + punctuationIssues.length;

if (problems === 0) {
  console.log(
    `i18n audit passed: no untranslated, unaccented or mispunctuated strings across ${LOCALES.length} locales ` +
      `(${REVIEWED_AS_CORRECT.size} identical-to-English keys reviewed and accepted).`,
  );
  process.exit(0);
}

report("Left in English (not on the reviewed list)", unexplained);
report("ASCII stand-in where an accent belongs", accentIssues);
report("Spanish punctuation", punctuationIssues);
console.error(
  `\n${problems} problem(s). Translate them, or — if the English word is genuinely correct in that ` +
    `language — add "<locale>:<key>" to REVIEWED_AS_CORRECT in this file.`,
);
process.exit(1);
