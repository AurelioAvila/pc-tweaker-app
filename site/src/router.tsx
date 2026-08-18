import { useCallback, useEffect, useState } from "react";

/* ============================================================
   MINIMAL ROUTER
   The site has two routes; pulling in react-router for that
   would cost more bytes than the pages themselves. This reads
   location.pathname, re-renders on back/forward, and exposes a
   navigate() that pushes without a full page load.

   Deep links work because the build emits a 404.html copy of
   index.html (see vite.config.ts) — GitHub Pages serves that
   for any unknown path, and this router then resolves the real
   route on the client.
   ============================================================ */

function currentPath(): string {
  // Trailing slashes are normalized away so "/support/" and "/support"
  // resolve to the same route instead of falling through to the 404 page.
  const p = window.location.pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

export function useRoute(): { path: string; navigate: (to: string) => void } {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === currentPath()) return;
    window.history.pushState({}, "", to);
    setPath(currentPath());
    window.scrollTo(0, 0);
  }, []);

  return { path, navigate };
}

/**
 * An internal link that routes on the client but is still a real <a> with a
 * real href — so middle-click, ctrl-click, "open in new tab" and crawlers
 * all behave normally. Modified clicks fall through to the browser.
 */
export function Link({
  to,
  className,
  children,
  onNavigate,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  onNavigate: (to: string) => void;
}) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate(to);
      }}
    >
      {children}
    </a>
  );
}
