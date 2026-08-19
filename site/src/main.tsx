import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme";
// Self-hosted fonts (previously Google Fonts <link>s): keeps every visitor
// request on our own origin — no IPs sent to Google, nothing to consent to.
// Weights match what the old fonts.googleapis.com URL loaded.
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./index.css";
import faviconUrl from "./assets/favicon.png";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

// Vite fingerprints this import's filename on every build, so the browser
// treats a changed icon as a brand-new URL instead of reusing a stale
// cached favicon (favicons are cached far more aggressively than pages).
const faviconLink = document.getElementById("favicon-link") as HTMLLinkElement | null;
if (faviconLink) faviconLink.href = faviconUrl;

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
