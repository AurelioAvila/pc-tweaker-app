/**
 * Checks the built site against the rules the reference pages are held to.
 * Runs after `npm run build` (npm run check:reference), offline.
 *
 * - every catalogue control has notes, and every page lists its sources;
 * - the catalogue file has the size the Rust test pins;
 * - banned words never reach a built file (owner rules: no anti-cheat claims,
 *   no "illustrative", no Brazilian Portuguese);
 * - reference and fix pages carry no price in their HTML: prices come from
 *   the billing API after load, never typed into a page;
 * - every in-site link and every structured-data block is sound.
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const site = new URL("../", import.meta.url);
const dist = new URL("dist/", site);
const read = (url) => readFile(url, "utf8");

// --- catalogue and notes ------------------------------------------------
const catalog = JSON.parse(await read(new URL("src/generated/tweak-catalog.json", site)));
const lib = await read(new URL("../src-tauri/src/lib.rs", site));
const total = Number(lib.match(/assert_eq!\(total, (\d+),/)?.[1]);
const pro = Number(lib.match(/assert_eq!\(pro, (\d+),/)?.[1]);
assert.equal(catalog.length, total, `tweak-catalog.json has ${catalog.length} controls, the Rust test pins ${total}: run UPDATE_PUBLIC_CATALOG=1 cargo test public_catalogue`);
assert.equal(catalog.filter((t) => t.requires_pro).length, pro, "Pro count in tweak-catalog.json differs from the Rust test");

const notes = await read(new URL("src/reference/tweak-notes.ts", site));
const noteBlock = (id) => notes.split(`\n  ${id}: {`)[1]?.split(/\n  [a-z0-9_]+: \{/)[0];
for (const t of catalog) {
  const block = noteBlock(t.id);
  assert.ok(block, `No reference note for ${t.id}`);
  assert.match(block, /verdict: "/, `${t.id}: note has no verdict`);
  if (t.changes.length === 0) assert.match(block, /manual: \{/, `${t.id} discloses no change and its note has no manual method`);
}

// --- built pages --------------------------------------------------------
const files = (await readdir(dist, { recursive: true })).map((f) => f.replaceAll("\\", "/"));
const pages = files.filter((f) => f.endsWith(".html"));
const textFiles = files.filter((f) => /\.(html|js|css|txt|xml|json|webmanifest)$/.test(f));
const isReference = (f) => /^(tweaks|database|tools|fixes)\//.test(f);

const BANNED = [
  [/anti[\s-]?cheat/i, "anti-cheat"],
  [/\b(battleye|ricochet|easy\s?anti)/i, "anti-cheat product names"],
  [/illustrat(ive|ed|ion)/i, "illustrative"],
  [/pt[-_]br\b|brazil/i, "Brazilian Portuguese"],
];
// One exception, asked for by the owner on 24 October 2026: the neutral removal
// guide for Riot Vanguard, and only the places that list, render or attribute it
// (the JS bundle carries every guide's text). Any other page naming Vanguard still
// fails, and "anti-cheat" stays banned on that guide as everywhere else.
const VANGUARD_ALLOWED = /^(uninstaller\/guides\/riot-vanguard\/index\.html|uninstaller\/index\.html|guides\/index\.html|sitemap\.xml|suite-downloads\.js|assets\/[^/]+\.js)$/;
for (const f of textFiles) {
  const text = await read(new URL(f, dist));
  for (const [re, what] of BANNED) assert.ok(!re.test(text), `${f} contains a banned term (${what}): ${text.match(re)?.[0]}`);
  assert.ok(!/\bvanguard/i.test(text) || VANGUARD_ALLOWED.test(f), `${f} names Vanguard outside its removal guide`);
}

const PRICE = /€\s?\d|\d[\d.,]*\s?€|\bEUR\s?\d/;
let referencePages = 0;
for (const f of pages.filter(isReference)) {
  const html = await read(new URL(f, dist));
  referencePages++;
  const body = html.slice(html.indexOf("<body"));
  assert.ok(!PRICE.test(body), `${f} has a price in its HTML; prices must come from the billing API: ${body.match(PRICE)?.[0]}`);
  const detail = /^(tweaks\/[^/]+\/[^/]+|database\/[^/]+\/[^/]+|tools\/[^/]+|fixes\/[^/]+)\/index\.html$/.test(f);
  if (detail) assert.match(body, /aria-label="Sources"/, `${f} lists no sources`);
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const nodes = ld.flatMap((b) => b["@graph"] ?? [b]);
  const crumbs = nodes.find((n) => n["@type"] === "BreadcrumbList");
  assert.ok(crumbs, `${f} has no BreadcrumbList`);
  crumbs.itemListElement.forEach((item, i) => assert.equal(item.position, i + 1, `${f} breadcrumb positions`));
  const art = nodes.find((n) => n["@type"] === "TechArticle");
  if (art) assert.ok(art.citation?.length > 0, `${f} TechArticle has no citation`);
  if (/^tweaks\/[^/]+\/[^/]+\/index\.html$/.test(f)) {
    assert.ok(art, `${f} has no TechArticle`);
    assert.match(body, /github\.com\/AurelioAvila\/pc-tweaker-app\/blob\/master\/src-tauri\/src\//, `${f} does not link its source code`);
    assert.match(body, /id="verdict"/, `${f} has no verdict`);
  }
}
assert.ok(referencePages > 100, `Only ${referencePages} reference pages were built`);

// --- links, structured data and languages, on every page ---------------
const exists = new Set(files);
for (const f of pages) {
  const html = await read(new URL(f, dist));
  for (const [, href] of html.matchAll(/<a[^>]+href="(\/[^"#?]*)"/g)) {
    const target = href.endsWith("/") ? `${href.slice(1)}index.html` : href.slice(1);
    assert.ok(href === "/" || exists.has(target), `${f} links to ${href}, which is not built`);
  }
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const raw = JSON.stringify(JSON.parse(json));
    assert.ok(!raw.includes("aggregateRating") && !/"@type":"Review"/.test(raw), `${f}: unverifiable rating markup`);
  }
  for (const [, lang] of html.matchAll(/hreflang="([^"]+)"/g)) {
    assert.ok(["en", "x-default", "de", "es", "fr", "it", "pt-PT"].includes(lang), `${f}: hreflang ${lang} is not a language the product ships`);
  }
}

console.log(`Reference checks passed: ${catalog.length} controls, ${referencePages} reference pages, ${textFiles.length} files scanned.`);
