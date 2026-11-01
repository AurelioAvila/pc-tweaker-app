import React from "react";
import ReactDOM from "react-dom/client";
// The app's single type family (self-hosted; no network fonts). The declared
// font used to be Sora but was never actually bundled, so the whole UI
// silently rendered in the system fallback.
import "@fontsource-variable/inter";
import App from "./App";
import { PageBoundary } from "./components/page-boundary";
import { detectInitialLang, STRINGS } from "./i18n";

// The app chrome is not selectable text (App.css), so Ctrl+A must not paint the
// whole window: it selects inside a text field as usual, inside a focused log
// or report block, and nowhere else.
document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "a") return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("input, textarea, [contenteditable='true']")) return;
  event.preventDefault();
  const block = target?.closest("pre, code, .selectable");
  if (block) window.getSelection()?.selectAllChildren(block);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* The last line of defence: an error outside any page still shows a way
        back instead of a blank window. */}
    <PageBoundary s={STRINGS[detectInitialLang()]} resetKey="app" scope="app">
      <App />
    </PageBoundary>
  </React.StrictMode>,
);
