/**
 * Regenerates public/sitemap.xml with a <lastmod> taken from the real commit
 * date of the sources each page is built from.
 *
 * Run it with `npm run sitemap` whenever page content changes, and commit the
 * result. It is deliberately NOT part of `npm run build`: the Pages workflow
 * checks out at depth 1, so `git log` there sees a single synthetic commit and
 * would stamp every URL with the deploy date — which is worse than a slightly
 * old date, because it tells search engines everything changed at once, every
 * time. Generating from real history locally keeps the dates honest.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Files that, when changed, genuinely change what the page says. The shell
// (nav, footer, theme) is deliberately left out: it touches every page, so
// including it would move all 14 dates together on any layout tweak.
const SHARED = ["src/seo.ts", "index.html"];
const PAGES = {
  "/": ["src/App.tsx", "src/components", "src/i18n/dictionary.ts"],
  "/uninstaller/": ["src/pages/Uninstaller.tsx"],
  "/support/": ["src/pages/Support.tsx", "src/i18n/dictionary.ts"],
  "/privacy/": ["src/pages/Legal.tsx"],
  "/terms/": ["src/pages/Legal.tsx"],
  "/cookies/": ["src/pages/Legal.tsx"],
  "/accessibility/": ["src/pages/Legal.tsx"],
  "/windows-11-optimizer/": ["src/pages/Guides.tsx"],
  "/gaming-performance/": ["src/pages/Guides.tsx"],
  "/reversible-windows-tweaks/": ["src/pages/Guides.tsx"],
  "/windows-privacy-tool/": ["src/pages/Guides.tsx"],
  "/how-to-undo-windows-tweaks/": ["src/pages/practical-guides.ts"],
  "/windows-gaming-work-study-profiles/": ["src/pages/practical-guides.ts"],
  "/what-pc-tweaker-changes/": ["src/pages/practical-guides.ts"],
};

/** Most recent author date (YYYY-MM-DD) across the given paths, or null. */
function lastModified(paths) {
  const dates = paths
    .map((p) => {
      try {
        return execFileSync("git", ["log", "-1", "--format=%as", "--", p], {
          cwd: root,
          encoding: "utf8",
        }).trim();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null;
}

const body = Object.entries(PAGES)
  .map(([route, sources]) => {
    const lastmod = lastModified([...sources, ...SHARED]);
    const loc = `https://pctweaker.app${route}`;
    return lastmod
      ? `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`
      : `  <url><loc>${loc}</loc></url>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

writeFileSync(path.join(root, "public", "sitemap.xml"), xml, "utf8");
console.log(`Wrote ${Object.keys(PAGES).length} URLs to public/sitemap.xml`);
