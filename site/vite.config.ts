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
 * La versione nei dati strutturati, presa da dove vive davvero.
 *
 * Era scritta a mano nel JSON-LD di index.html, e diceva 1.6.1 mentre la
 * release pubblicata era la 1.6.5: quattro versioni indietro, su un campo che
 * Google legge per i risultati ricchi. Nessuno se ne accorge perche' il sito
 * si costruisce e si pubblica correttamente comunque - il valore e' sbagliato,
 * non rotto.
 *
 * Letta da src-tauri/tauri.conf.json, che e' la versione che l'app dichiara di
 * essere, cosi' un bump di versione la aggiorna qui senza che nessuno debba
 * ricordarselo. Importata come JSON invece che letta con `fs` per non tirare
 * dentro @types/node, che questo progetto evita di proposito (vedi il commento
 * su spaFallback).
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
