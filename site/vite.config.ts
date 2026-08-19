import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Client-side routes that must also exist as real files. Keep in sync with
 *  the routes handled in src/router.tsx. */
const ROUTES = ["support", "privacy", "terms", "cookies", "accessibility"];

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

export default defineConfig({
  plugins: [react(), tailwindcss(), spaFallback()],
});
