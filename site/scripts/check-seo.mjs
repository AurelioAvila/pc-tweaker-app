import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const sitemap = await readFile(new URL("sitemap.xml", dist), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]));
assert.ok(urls.length > 0, "Sitemap must contain routes");
const titles = new Set();
for (const url of urls) {
  assert.equal(url.origin, "https://pctweaker.app");
  const html = await readFile(new URL(`${url.pathname.slice(1)}index.html`, dist), "utf8");
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title && !titles.has(title), `Missing or duplicate title: ${url}`);
  titles.add(title);
  assert.ok(html.includes(`rel="canonical" href="${url.href}"`), `Wrong canonical: ${url}`);
  assert.ok(html.match(/<meta name="description" content="[^"]+"/), `Missing description: ${url}`);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `Expected one rendered H1: ${url}`);
  assert.ok(!/name="robots" content="[^"\n]*noindex/.test(html), `Indexed route has noindex: ${url}`);
  assert.ok(!html.includes("__APP_VERSION__"), `Unresolved version: ${url}`);
}
const home = await readFile(new URL("index.html", dist), "utf8");
const schema = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
assert.ok(schema.softwareVersion, "Software version must be populated");
assert.ok(!home.includes("Free plan — 35 tweaks"), "Stale Free plan count");
assert.ok(home.includes("/uninstaller/"), "Uninstaller must have an internal link");
const missing = await readFile(new URL("404.html", dist), "utf8");
assert.ok(missing.includes('content="noindex,follow"'), "404 must be noindex");
console.log(`SEO checks passed for ${urls.length} sitemap routes and the 404 page.`);
