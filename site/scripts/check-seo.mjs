import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const sitemap = await readFile(new URL("sitemap.xml", dist), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]));
assert.ok(urls.length > 0, "Sitemap must contain routes");

// Search Console reported these as "Page with redirect": an internal link to
// the bare path is a link to a 301, so the target never gets the full value of
// it. Every in-site href must point straight at the URL that answers with 200.
const ROUTES = urls.map((url) => url.pathname).filter((path) => path !== "/");

const titles = new Set();
const descriptions = new Set();

for (const url of urls) {
  assert.equal(url.origin, "https://pctweaker.app");
  assert.ok(url.pathname.endsWith("/"), `Sitemap URL must be the trailing-slash form: ${url}`);
  const html = await readFile(new URL(`${url.pathname.slice(1)}index.html`, dist), "utf8");

  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title && !titles.has(title), `Missing or duplicate title: ${url}`);
  // 60 is where Google starts truncating a title in a desktop result.
  assert.ok(title.length <= 60, `Title is ${title.length} chars (max 60): ${url}`);
  titles.add(title);

  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(description, `Missing description: ${url}`);
  assert.ok(!descriptions.has(description), `Duplicate description: ${url}`);
  assert.ok(
    description.length >= 140 && description.length <= 160,
    `Description is ${description.length} chars (want 140-160): ${url}`,
  );
  descriptions.add(description);

  assert.ok(html.includes(`rel="canonical" href="${url.href}"`), `Wrong canonical: ${url}`);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `Expected one rendered H1: ${url}`);
  assert.ok(!/name="robots" content="[^"\n]*noindex/.test(html), `Indexed route has noindex: ${url}`);
  assert.ok(!html.includes("__APP_VERSION__"), `Unresolved version: ${url}`);

  // The card image every platform reads. Below 1200x630 it is downgraded to a
  // small thumbnail, which is what the previous 1002x702 asset was getting.
  assert.ok(html.includes('property="og:image:width" content="1200"'), `og:image not 1200 wide: ${url}`);
  assert.ok(html.includes('property="og:image:height" content="630"'), `og:image not 630 tall: ${url}`);

  for (const [, href] of html.matchAll(/<a[^>]+href="(\/[^"#?]*)"/g)) {
    assert.ok(
      href === "/" || !ROUTES.includes(`${href}/`),
      `Internal link to a redirect (missing trailing slash): ${href} on ${url}`,
    );
  }

  // Every page carries the sitewide identity graph, so the whole property
  // resolves to one Organization and one WebSite rather than just the homepage.
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
  const graph = blocks.find((block) => Array.isArray(block["@graph"]))?.["@graph"];
  assert.ok(graph, `Missing sitewide JSON-LD graph: ${url}`);
  assert.deepEqual(
    graph.map((node) => node["@type"]).sort(),
    ["Organization", "WebSite"],
    `Unexpected sitewide graph: ${url}`,
  );

  // There is no verifiable first-party rating for this domain, so neither of
  // these may ever appear — however tempting the external review scores are.
  const raw = JSON.stringify(blocks);
  assert.ok(!raw.includes("aggregateRating"), `Unverifiable aggregateRating: ${url}`);
  assert.ok(!/"@type":\s*"Review"/.test(raw), `Unverifiable Review markup: ${url}`);

  // A FAQPage is only honest where the page renders those questions as text.
  const faq = blocks.find((block) => block["@type"] === "FAQPage");
  if (faq) {
    for (const entry of faq.mainEntity) {
      const question = entry.name.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
      assert.ok(html.includes(question), `FAQ question not rendered on the page: ${entry.name}`);
    }
  }
}

const home = await readFile(new URL("index.html", dist), "utf8");
const app = JSON.parse(
  home.match(/<script type="application\/ld\+json" data-ld="app">([\s\S]*?)<\/script>/)[1],
);
assert.ok(app.softwareVersion, "Software version must be populated");
assert.equal(app["@type"], "SoftwareApplication");
// Prices are a factual claim about what a visitor will be charged. Keep them
// pinned to the plans the pricing section and the FAQ actually state.
assert.deepEqual(
  app.offers.map((offer) => offer.price).sort(),
  ["0", "59.99", "7.99", "99"].sort(),
  "SoftwareApplication offers must match the published pricing",
);
assert.ok(!home.includes("Free plan — 35 tweaks"), "Stale Free plan count");
assert.ok(home.includes("/uninstaller/"), "Uninstaller must have an internal link");
assert.ok(home.match(/<script type="application\/ld\+json">[\s\S]*?FAQPage/), "Homepage FAQ must be marked up");

const missing = await readFile(new URL("404.html", dist), "utf8");
assert.ok(missing.includes('content="noindex,follow"'), "404 must be noindex");
assert.ok(
  ![...missing.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .some((match) => match[1].includes("FAQPage")),
  "404 must not carry route JSON-LD",
);

const robots = await readFile(new URL("robots.txt", dist), "utf8");
assert.match(robots, /Sitemap:\s*https:\/\/pctweaker\.app\/sitemap\.xml/, "robots.txt must point at the sitemap");
assert.match(robots, /^\s*Allow:\s*\/$/m, "robots.txt must allow crawling");

console.log(`SEO checks passed for ${urls.length} sitemap routes, robots.txt and the 404 page.`);
