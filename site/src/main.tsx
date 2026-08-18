import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme";
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
