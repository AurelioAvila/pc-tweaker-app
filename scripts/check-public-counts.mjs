// Public texts must state the catalog the app actually ships. The counts come
// from the Rust catalogue test (src-tauri/src/lib.rs), which fails when the code
// and those numbers disagree; this check fails when a public text does.
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const lib = read("src-tauri/src/lib.rs");
const total = Number(lib.match(/assert_eq!\(total, (\d+),/)?.[1]);
const pro = Number(lib.match(/assert_eq!\(pro, (\d+),/)?.[1]);
if (!total || !pro) throw new Error("catalogue counts not found in src-tauri/src/lib.rs");
const free = total - pro;

const listings = fs
  .readdirSync(new URL("../scripts/store/listing/", import.meta.url))
  .filter((f) => f.endsWith(".json"))
  .map((f) => `scripts/store/listing/${f}`);
const files = ["README.md", "site/src/i18n/dictionary.ts", "site/src/pages/practical-guides.ts", ...listings];

// A number right before a catalog noun, in the six languages the texts use.
const NOUN = String.raw`(?:Windows[ -])?(?:Free |Pro )?(?:controls?|tweaks?|settings|controlli|impostazioni|réglages|contrôles|ajustes|controles|controlos|Einstellungen)`;
const claim = new RegExp(String.raw`\b(\d{2,3})\s+${NOUN}`, "gi");
const NEW = /^\s*(new|nuovi|nouveaux|nuevos|neue|novos)\b/i;
const problems = [];
for (const file of files) {
  const text = read(file);
  for (const m of text.matchAll(claim)) {
    const n = Number(m[1]);
    if ([total, free, pro].includes(n)) continue;
    // "15 new controls" / "15 ajustes nuevos" count a release's additions, not the catalog.
    if (NEW.test(text.slice(m.index + m[1].length)) || NEW.test(text.slice(m.index + m[0].length))) continue;
    problems.push(`${file}: "${m[0]}" (catalog: ${total} total, ${free} Free, ${pro} Pro)`);
  }
}
// Store policy 10.8.4 (the 1.18.0 submission failed on it): the description must state the
// in-app purchase types and prices, so it has to carry the prices the app charges.
const appLib = read("src/lib.ts");
const prices = ["PRICE_MONTHLY", "PRICE_ANNUAL", "PRICE_LIFETIME"].map(
  (name) => appLib.match(new RegExp(`export const ${name} = ([\\d.]+);`))?.[1],
);
if (prices.some((p) => !p)) throw new Error("Pro prices not found in src/lib.ts");
for (const file of listings) {
  const { description } = JSON.parse(read(file));
  for (const n of [total, free, pro]) {
    if (!description.includes(String(n))) problems.push(`${file}: description does not state ${n}`);
  }
  // Every euro amount as written, "€59.99" or "59,99 €", normalised to "59.99".
  const amounts = new Set(
    [...description.matchAll(/€(\d+(?:[.,]\d+)?)|(?<![\d.,])(\d+(?:[.,]\d+)?) €/g)].map((m) =>
      (m[1] ?? m[2]).replace(",", "."),
    ),
  );
  for (const price of prices) {
    if (!amounts.has(price)) problems.push(`${file}: description does not state the Pro price ${price} €`);
  }
}
const seo = read("site/scripts/check-seo.mjs");
if (!seo.includes(`[${free}, "CONTROLS INCLUDED FREE"]`) || !seo.includes(`[${total}, "CONTROLS IN THIS RELEASE"]`)) {
  problems.push(`site/scripts/check-seo.mjs: homepage stats are not ${free} Free / ${total} total`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Public counts match the catalog: ${total} controls, ${free} Free, ${pro} Pro (${files.length} files).`);
