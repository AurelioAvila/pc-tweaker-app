import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const serverBundle = path.join(root, "dist-ssr", "entry-server.js");
const { render, ROUTE_SEO, ROUTE_JSONLD, NOT_FOUND_SEO } = await import(pathToFileURL(serverBundle));
const template = await readFile(path.join(dist, "index.html"), "utf8");

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceTag(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Missing SEO tag: ${label}`);
  return html.replace(pattern, replacement);
}

// A JSON-LD payload is data, not markup, so the only character that can break
// out of a <script> block is the "<" that starts a closing tag. Escaping it as
// a unicode escape keeps the JSON byte-for-byte valid to a parser while making
// the sequence "</script>" impossible to form.
function jsonLdScript(payload) {
  const json = JSON.stringify(payload, null, 2).replaceAll("<", "\\u003c");
  return `<script type="application/ld+json">\n${json}\n  </script>`;
}

function buildPage(route, seo, noindex = false) {
  let html = template;
  // The SoftwareApplication block describes the product and belongs on the
  // page that is about the product. The sitewide Organization/WebSite graph
  // above it stays on every page so the whole property resolves to one entity.
  if (route !== "/") {
    html = html.replace(/\s*<script type="application\/ld\+json" data-ld="app">[\s\S]*?<\/script>/i, "");
  }
  const routeLd = (!noindex && ROUTE_JSONLD[route]) || [];
  html = replaceTag(
    html,
    /<!--ROUTE_LD-->/,
    // A function replacement, so a "$" anywhere in the JSON is never read as a
    // String.replace substitution pattern.
    () => routeLd.map(jsonLdScript).join("\n  "),
    "route JSON-LD marker",
  );
  html = replaceTag(html, /<title>[^<]*<\/title>/i, `<title>${seo.title}</title>`, "title");
  html = replaceTag(
    html,
    /<meta name="description" content="[^"]*"\s*\/>/i,
    `<meta name="description" content="${escapeAttribute(seo.description)}" />`,
    "description",
  );
  html = replaceTag(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/>/i,
    `<link rel="canonical" href="${escapeAttribute(seo.canonical)}" />`,
    "canonical",
  );

  const properties = {
    "og:title": seo.title,
    "og:description": seo.description,
    "og:url": seo.canonical,
    "og:type": seo.ogType,
  };
  for (const [property, value] of Object.entries(properties)) {
    html = replaceTag(
      html,
      new RegExp(`<meta property="${property}" content="[^"]*"\\s*\\/>`, "i"),
      `<meta property="${property}" content="${escapeAttribute(value)}" />`,
      property,
    );
  }

  const twitter = {
    "twitter:title": seo.title,
    "twitter:description": seo.description,
  };
  for (const [name, value] of Object.entries(twitter)) {
    html = replaceTag(
      html,
      new RegExp(`<meta name="${name}" content="[^"]*"\\s*\\/>`, "i"),
      `<meta name="${name}" content="${escapeAttribute(value)}" />`,
      name,
    );
  }

  if (noindex) {
    html = html.replace("</head>", '  <meta name="robots" content="noindex,follow" />\n</head>');
  }
  html = replaceTag(
    html,
    /<div id="root"><\/div>/,
    `<div id="root">${render(route)}</div>`,
    "root",
  );
  return html;
}

for (const [route, seo] of Object.entries(ROUTE_SEO)) {
  const file = route === "/" ? path.join(dist, "index.html") : path.join(dist, route.slice(1), "index.html");
  await writeFile(file, buildPage(route, seo), "utf8");
}

await writeFile(path.join(dist, "404.html"), buildPage("/404", NOT_FOUND_SEO, true), "utf8");
await rm(path.join(root, "dist-ssr"), { recursive: true, force: true });
