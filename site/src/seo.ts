export interface RouteSeo {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly ogType: "website";
}

const ORIGIN = "https://pctweaker.app";

// Canonicals carry the trailing slash because that is the URL that answers.
// The build emits each route as a directory with its own index.html, and the
// host 301s "/support" to "/support/" — so a canonical without the slash
// pointed search engines at a redirect instead of at the page itself.

export const ROUTE_SEO: Record<string, RouteSeo> = {
  "/": {
    title: "PC Tweaker — Every Millisecond Is Earned",
    description:
      "Optimize Windows 10/11 with 54 reversible performance tweaks, live hardware monitoring and driver updates. Free, safe and fully transparent.",
    canonical: `${ORIGIN}/`,
    ogType: "website",
  },
  "/support": {
    title: "PC Tweaker Support — Help, Troubleshooting and Contact",
    description:
      "Get help with PC Tweaker installation, rollback, licenses, billing and Windows optimization. Use the troubleshooting guides or contact support.",
    canonical: `${ORIGIN}/support/`,
    ogType: "website",
  },
  "/privacy": {
    title: "Privacy Policy — PC Tweaker",
    description:
      "Read how PC Tweaker handles account, payment, support and optional diagnostic data, including retention, security and privacy rights.",
    canonical: `${ORIGIN}/privacy/`,
    ogType: "website",
  },
  "/terms": {
    title: "Terms of Service — PC Tweaker",
    description:
      "Read the terms that govern the PC Tweaker desktop application, website, subscriptions, acceptable use and service availability.",
    canonical: `${ORIGIN}/terms/`,
    ogType: "website",
  },
  "/cookies": {
    title: "Cookie Policy — PC Tweaker",
    description:
      "PC Tweaker does not use tracking or advertising cookies. Read what the website stores locally and how theme preferences work.",
    canonical: `${ORIGIN}/cookies/`,
    ogType: "website",
  },
  "/accessibility": {
    title: "Accessibility — PC Tweaker",
    description:
      "Learn about PC Tweaker's accessibility goals and how to report a keyboard, screen reader or assistive technology problem.",
    canonical: `${ORIGIN}/accessibility/`,
    ogType: "website",
  },
  "/windows-11-optimizer": {
    title: "Windows 11 Optimizer with Reversible Tweaks | PC Tweaker",
    description:
      "Optimize Windows 11 with transparent performance, privacy and maintenance tweaks designed around individual control and automatic rollback.",
    canonical: `${ORIGIN}/windows-11-optimizer/`,
    ogType: "website",
  },
  "/gaming-performance": {
    title: "Windows Gaming Performance Tweaks | PC Tweaker",
    description:
      "Tune Windows for more consistent gaming performance with explicit system adjustments, hardware monitoring and reversible changes.",
    canonical: `${ORIGIN}/gaming-performance/`,
    ogType: "website",
  },
  "/reversible-windows-tweaks": {
    title: "Reversible Windows Tweaks with Automatic Rollback | PC Tweaker",
    description:
      "Apply transparent Windows tweaks with a recovery path. PC Tweaker keeps supported changes understandable, auditable and reversible.",
    canonical: `${ORIGIN}/reversible-windows-tweaks/`,
    ogType: "website",
  },
  "/windows-privacy-tool": {
    title: "Reversible Windows Privacy Tool | PC Tweaker",
    description:
      "Review and adjust supported Windows privacy settings without destructive debloating, bundled scripts or irreversible presets.",
    canonical: `${ORIGIN}/windows-privacy-tool/`,
    ogType: "website",
  },
};

export const NOT_FOUND_SEO: RouteSeo = {
  title: "Page Not Found — PC Tweaker",
  description: "The requested PC Tweaker page could not be found.",
  canonical: `${ORIGIN}/404`,
  ogType: "website",
};
