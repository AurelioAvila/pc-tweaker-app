import React from "react";
import ReactDOM from "react-dom/client";
// The app's single type family (self-hosted; no network fonts). The declared
// font used to be Sora but was never actually bundled, so the whole UI
// silently rendered in the system fallback.
import "@fontsource-variable/inter";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
