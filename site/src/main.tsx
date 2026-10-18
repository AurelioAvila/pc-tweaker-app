import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme";
import { campaignLabels, captureEntry } from "./campaign-store";
import { API_BASE, DOWNLOAD_EXE } from "./constants";
// Self-hosted fonts (previously Google Fonts <link>s): keeps every visitor
// request on our own origin — no IPs sent to Google, nothing to consent to.
// One Latin variable file per family preserves the displayed weights.
import "./fonts.css";
import "./index.css";
import faviconUrl from "./assets/favicon.png";

captureEntry(window.location.search, window.location.pathname);

// Count installer-link clicks against the first entry page or explicit campaign.
// This is not a completed download or installation. Preview traffic stays local.
document.addEventListener("click", (event) => {
  if (window.location.hostname !== "pctweaker.app") return;
  const utm = campaignLabels();
  if (utm.utm_source && (event.target as Element | null)?.closest?.(`a[href="${DOWNLOAD_EXE}"]`)) {
    try { navigator.sendBeacon(`${API_BASE}/api/download?${new URLSearchParams(utm)}`); } catch { /* The installer link works independently. */ }
  }
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

// Vite fingerprints this import's filename on every build, so the browser
// treats a changed icon as a brand-new URL instead of reusing a stale
// cached favicon (favicons are cached far more aggressively than pages).
const faviconLink = document.getElementById("favicon-link") as HTMLLinkElement | null;
if (faviconLink) faviconLink.href = faviconUrl;

const app = (
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);

if (rootEl.hasChildNodes()) {
  hydrateRoot(rootEl, app);
} else {
  createRoot(rootEl).render(app);
}
