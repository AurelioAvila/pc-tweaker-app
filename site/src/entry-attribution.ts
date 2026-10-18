// Only published pages can become campaign labels. Never copy arbitrary paths,
// search parameters, referrers or account information into attribution.
const ENTRY_PATHS = new Set([
  "/", "/windows-11-optimizer", "/gaming-performance", "/reversible-windows-tweaks",
  "/windows-privacy-tool", "/how-to-undo-windows-tweaks", "/what-pc-tweaker-changes",
  "/windows-gaming-work-study-profiles", "/turn-off-windows-recall",
  "/uninstall-programs-completely", "/guides",
  "/guides/fix-dpc-isr-latency-windows-11",
  "/guides/amd-ryzen-x3d-core-parking-windows-11",
  "/guides/amd-x3d-intel-hybrid-core-steering-gaming",
  "/guides/windows-11-privacy-telemetry-rollback",
]);

export function pageEntryLabels(pathname: string): Record<string, string> {
  const path = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  if (!ENTRY_PATHS.has(path)) return {};
  const slug = path === "/" ? "home" : path.startsWith("/guides/") ? path.slice(8) : path.slice(1);
  return {
    utm_source: "website",
    utm_medium: "owned-content",
    utm_campaign: `pct-${path.startsWith("/guides/") ? "guide-" : ""}${slug}`,
    utm_content: "entry-page",
  };
}
