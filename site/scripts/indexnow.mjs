#!/usr/bin/env node
/**
 * Tells IndexNow (Bing, Yandex, Seznam, Naver and the other participating
 * engines) about pages that are new or changed since the last submission.
 * Free, no account: the key is the public file site/public/<key>.txt.
 *
 *   node site/scripts/indexnow.mjs            submit what changed on the live site
 *   node site/scripts/indexnow.mjs --dry-run  list it, submit nothing
 *   node site/scripts/indexnow.mjs --all      submit every URL in the sitemaps
 *   node site/scripts/indexnow.mjs --key=<32 hex>  key when run outside the repo
 *
 * Run it after a production deploy (deploy-site.ps1 -Production does). It
 * reads the live sitemap index, compares each URL's <lastmod> with what it
 * sent last time (kept in %LOCALAPPDATA%\pctweaker-indexnow\state.json, never
 * in the repo), and only records a URL as sent once IndexNow accepted it.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "pctweaker.app";
const ORIGIN = `https://${HOST}`;
const args = new Set(process.argv.slice(2));
const flag = (name) => process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

function findKey() {
  const given = flag("key");
  if (given) return given;
  const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
  const file = existsSync(pub) && readdirSync(pub).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (!file) throw new Error("No IndexNow key: pass --key=<32 hex> or keep <key>.txt in site/public");
  return file.slice(0, -4);
}

const key = findKey();
if (!/^[0-9a-f]{32}$/.test(key)) throw new Error("The IndexNow key must be 32 hex characters");

const get = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": "pctweaker-indexnow/1" } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
};

// The engines fetch this file to prove the site owns the key.
const published = (await get(`${ORIGIN}/${key}.txt`)).trim();
if (published !== key) throw new Error(`${ORIGIN}/${key}.txt does not contain the key`);

const index = await get(`${ORIGIN}/sitemap-index.xml`);
const live = new Map();
for (const [, loc] of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const xml = await get(loc);
  for (const m of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)) live.set(m[1], m[2] ?? "");
}

const stateDir = path.join(process.env.LOCALAPPDATA ?? path.join(homedir(), ".local", "state"), "pctweaker-indexnow");
const stateFile = path.join(stateDir, "state.json");
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : {};
const changed = [...live].filter(([url, lastmod]) => args.has("--all") || state[url] !== lastmod).map(([url]) => url);

console.log(`${live.size} URLs in the sitemaps, ${changed.length} new or changed since the last submission.`);
if (changed.length === 0 || args.has("--dry-run")) {
  changed.forEach((u) => console.log(`  ${u}`));
  process.exit(0);
}

for (let i = 0; i < changed.length; i += 10000) {
  const urlList = changed.slice(i, i + 10000);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key, keyLocation: `${ORIGIN}/${key}.txt`, urlList }),
  });
  // 200: received; 202: received, key check pending. Anything else is not a submission.
  if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow answered ${res.status}: ${await res.text()}`);
  for (const url of urlList) state[url] = live.get(url);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`IndexNow accepted ${urlList.length} URLs (HTTP ${res.status}).`);
}
