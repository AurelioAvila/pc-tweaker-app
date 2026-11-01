/**
 * Regenerates the sitemaps in public/ with a <lastmod> taken from the real
 * commit date of the sources each page is built from.
 *
 * Run `npm run build` first, then `npm run sitemap`, and commit the result.
 * The reference routes (/tweaks, /database, /tools) are read from the built
 * dist/ folder, so a control added to the catalogue gets its URL here without
 * a list to maintain; check-seo.mjs fails when a built page is in no sitemap.
 *
 * It is deliberately NOT part of `npm run build`: the deploy builds from an
 * archive with no git history, where `git log` would stamp every URL with the
 * deploy date, telling search engines everything changed at once, every time.
 *
 * Silos: sitemap.xml (product pages, guides and fixes), sitemap-tweaks.xml,
 * sitemap-database.xml and sitemap-tools.xml, all listed in sitemap-index.xml.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://pctweaker.app";

// Files that, when changed, genuinely change what the page says. The shell
// (nav, footer, theme) is deliberately left out: it touches every page, so
// including it would move every date together on any layout tweak.
const PAGES = {
  "/": ["src/App.tsx", "src/components", "src/i18n/dictionary.ts"],
  "/uninstaller/": ["src/pages/Uninstaller.tsx"],
  "/invite/": ["src/pages/Invitation.tsx"],
  "/guides/": ["src/pages/GuideDirectory.tsx", "src/pages/guide-directory.ts"],
  "/support/": ["src/pages/Support.tsx", "src/i18n/dictionary.ts"],
  "/privacy/": ["src/pages/Legal.tsx"],
  "/terms/": ["src/pages/Legal.tsx"],
  "/cookies/": ["src/pages/Legal.tsx"],
  "/accessibility/": ["src/pages/Legal.tsx"],
  "/guides/fix-dpc-isr-latency-windows-11/": ["src/pages/technical-guides.ts"],
  "/guides/amd-ryzen-x3d-core-parking-windows-11/": ["src/pages/technical-guides.ts"],
  "/guides/amd-x3d-intel-hybrid-core-steering-gaming/": ["src/pages/technical-guides.ts"],
  "/guides/windows-11-privacy-telemetry-rollback/": ["src/pages/technical-guides.ts"],
  "/windows-11-optimizer/": ["src/pages/Guides.tsx"],
  "/gaming-performance/": ["src/pages/Guides.tsx"],
  "/reversible-windows-tweaks/": ["src/pages/Guides.tsx"],
  "/windows-privacy-tool/": ["src/pages/Guides.tsx"],
  "/how-to-undo-windows-tweaks/": ["src/pages/practical-guides.ts"],
  "/windows-gaming-work-study-profiles/": ["src/pages/practical-guides.ts"],
  "/what-pc-tweaker-changes/": ["src/pages/practical-guides.ts"],
  "/turn-off-windows-recall/": ["src/pages/practical-guides.ts", "src/pages/guide-faqs.ts"],
  "/uninstall-programs-completely/": ["src/pages/practical-guides.ts", "src/pages/guide-faqs.ts"],
  "/will-my-games-work-on-linux/": ["src/pages/linux-guide.ts"],
  "/uninstaller/guides/armoury-crate/": ["src/pages/uninstaller-guides.ts"],
  "/uninstaller/guides/mcafee-webadvisor/": ["src/pages/uninstaller-guides.ts"],
  "/uninstaller/guides/microsoft-edge-webview2/": ["src/pages/uninstaller-guides.ts"],
  "/uninstaller/guides/onedrive/": ["src/pages/uninstaller-guides.ts"],
  // Static page shipped as-is from public/; not part of the React prerender.
  "/tweaky-driver/": ["public/tweaky-driver/index.html"],
};

const SILOS = {
  "sitemap.xml": { prefix: "/fixes/", sources: ["src/pages/fix-guides.ts", "src/components/ReferenceBlocks.tsx"] },
  "sitemap-tweaks.xml": { prefix: "/tweaks/", sources: ["src/generated/tweak-catalog.json", "src/reference", "src/pages/reference/pages.tsx"] },
  "sitemap-database.xml": { prefix: "/database/", sources: ["src/reference/windows-db.ts", "src/pages/reference/pages.tsx"] },
  "sitemap-tools.xml": { prefix: "/tools/", sources: ["src/pages/reference/tools.tsx", "src/reference"] },
};

/** Most recent author date (YYYY-MM-DD) across the given paths, or null. */
function lastModified(paths) {
  const dates = paths
    .map((p) => {
      try {
        return execFileSync("git", ["log", "-1", "--format=%as", "--", p], { cwd: root, encoding: "utf8" }).trim();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null;
}

/** Every built route under `prefix`, as "/a/b/". */
function builtRoutes(prefix) {
  const dir = path.join(root, "dist", prefix);
  if (!existsSync(dir)) throw new Error(`dist${prefix} is missing: run npm run build first`);
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = path.join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "index.html") out.push("/" + path.relative(path.join(root, "dist"), d).replaceAll("\\", "/") + "/");
    }
  };
  walk(dir);
  // Pages built noindex (the per-control tweak leaves) stay out of every sitemap.
  const indexable = (route) => !/name="robots" content="[^"]*noindex/.test(readFileSync(path.join(root, "dist", route.slice(1), "index.html"), "utf8"));
  return out.filter(indexable).sort();
}

const urlset = (entries) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(([route, lastmod]) => (lastmod ? `  <url><loc>${ORIGIN}${route}</loc><lastmod>${lastmod}</lastmod></url>` : `  <url><loc>${ORIGIN}${route}</loc></url>`)).join("\n")}
</urlset>
`;

const written = [];
for (const [file, silo] of Object.entries(SILOS)) {
  const date = lastModified(silo.sources);
  const entries = builtRoutes(silo.prefix).map((r) => [r, date]);
  if (file === "sitemap.xml") entries.unshift(...Object.entries(PAGES).map(([r, src]) => [r, lastModified(src)]));
  writeFileSync(path.join(root, "public", file), urlset(entries), "utf8");
  written.push([file, entries.length, entries.map((e) => e[1]).filter(Boolean).sort().at(-1)]);
}

writeFileSync(
  path.join(root, "public", "sitemap-index.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${written.map(([file, , lastmod]) => `  <sitemap><loc>${ORIGIN}/${file}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</sitemap>`).join("\n")}
</sitemapindex>
`,
  "utf8",
);
for (const [file, count] of written) console.log(`Wrote ${count} URLs to public/${file}`);
