import { useEffect, useState } from "react";
import { text } from "../i18n/dictionary";

/**
 * Acknowledges a completed tip. Stripe redirects back to `/?tip=thanks`, and
 * without this the tipper lands on the homepage with no sign anything
 * happened — the one place in this feature where silence isn't acceptable.
 *
 * Deliberately not a toast system: this is the only after-redirect state the
 * site has, so it reads the query string itself and drops the parameter on
 * dismiss so a reload or a shared link doesn't show it again.
 *
 * The query string is read in an effect, not during render. The page is
 * server-rendered, and the server has no location: reading it in a useState
 * initialiser made the first client render disagree with the server's HTML on
 * /?tip=thanks — React threw away the whole SSR tree and re-rendered the page
 * on the client (hydration errors #418/#423). An effect runs after hydration
 * has matched, so the banner appears without costing the page its SSR.
 */
export function TipThanks() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tip") === "thanks") {
      setShown(true);
    }
  }, []);

  if (!shown) return null;

  return (
    <div
      role="status"
      className="fixed top-[68px] left-1/2 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--bg)] px-4 py-3 text-[13.5px] text-[var(--fg)] shadow-lg"
    >
      <span>☕ {text.footer.tipThanks}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          window.history.replaceState({}, "", window.location.pathname);
          setShown(false);
        }}
        className="cursor-pointer text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
      >
        ✕
      </button>
    </div>
  );
}
