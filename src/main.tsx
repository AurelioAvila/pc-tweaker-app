import React from "react";
import ReactDOM from "react-dom/client";
// The app's single type family (self-hosted; no network fonts). The declared
// font used to be Sora but was never actually bundled, so the whole UI
// silently rendered in the system fallback.
import "@fontsource-variable/inter";
import App from "./App";
import { PageBoundary } from "./components/page-boundary";
import { detectInitialLang, STRINGS } from "./i18n";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* The last line of defence: an error outside any page still shows a way
        back instead of a blank window. */}
    <PageBoundary s={STRINGS[detectInitialLang()]} resetKey="app" scope="app">
      <App />
    </PageBoundary>
  </React.StrictMode>,
);
