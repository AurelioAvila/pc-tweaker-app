import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tauriConf from "../src-tauri/tauri.conf.json";

/** Client-side routes that must also exist as real files. Keep in sync with
 *  the routes handled in src/router.tsx. */
const ROUTES = [
  "support",
  "privacy",
  "terms",
  "cookies",
  "accessibility",
  "windows-11-optimizer",
  "gaming-performance",
  "reversible-windows-tweaks",
  "windows-privacy-tool",
];

/**
 * GitHub Pages serves static files only — it has no SPA rewrite rule, so a
 * direct hit on /support (a shared link, or a refresh) finds no file.
 *
 * Pages does serve 404.html for unknown paths, and since that copy is the
 * whole app the router resolves the route client-side — but Pages sends it
 * with an HTTP 404 status, which tells search engines and link unfurlers the
 * page doesn't exist. So each known route additionally gets a real
 * `<route>/index.html`, which Pages serves at `/<route>` with a 200. The
 * 404.html copy stays as the safety net for anything not listed above.
 *
 * Emitted through Rollup's asset API rather than a filesystem copy so the
 * site build needs no Node type dependency.
 */
function spaFallback(): Plugin {
  return {
    name: "spa-404-fallback",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (!index || index.type !== "asset") {
        this.warn("index.html not found in bundle — route fallbacks were not emitted");
        return;
      }
      this.emitFile({ type: "asset", fileName: "404.html", source: index.source });
      for (const route of ROUTES) {
        this.emitFile({ type: "asset", fileName: `${route}/index.html`, source: index.source });
      }
    },
  };
}

/**
 * The version in the structured data, taken from where it actually lives.
 *
 * It was hand-written into index.html's JSON-LD and said 1.6.1 while the
 * published release was 1.6.5: four versions behind, on a field Google reads
 * for rich results. Nobody notices, because the site builds and deploys
 * correctly regardless — the value is wrong, not broken.
 *
 * Read from src-tauri/tauri.conf.json, which is the version the app claims to
 * be, so a version bump updates this without anyone having to remember.
 * Imported as JSON rather than read with `fs` so this project does not pull in
 * @types/node, which it avoids on purpose (see the note on spaFallback).
 */
function appVersion(): Plugin {
  return {
    name: "app-version",
    transformIndexHtml(html) {
      return html.replace(/__APP_VERSION__/g, tauriConf.version);
    },
  };
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss(), appVersion(), ...(isSsrBuild ? [] : [spaFallback()])],
}));
