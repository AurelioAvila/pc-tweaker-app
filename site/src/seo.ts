import { PRACTICAL_GUIDES } from "./pages/practical-guides";
import { text } from "./i18n/dictionary";

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
  "/uninstaller": {
    title: "Windows Uninstaller That Shows the Risk First | PC Tweaker",
    description:
      "See what an uninstall removes before it runs: a safety score with its reasons, the exact command, a restore point taken first, and the space freed.",
    canonical: `${ORIGIN}/uninstaller/`,
    ogType: "website",
  },
  // A guide's on-page H1 and intro are written for someone already reading it;
  // the title and description are written for someone deciding whether to click
  // from a result page. Where those differ, the guide carries seoTitle/
  // seoDescription and they win here — otherwise the visible copy is reused.
  ...Object.fromEntries(Object.entries(PRACTICAL_GUIDES).map(([path, guide]) => [path, {
    title: `${guide.seoTitle ?? guide.title} | PC Tweaker`,
    description: guide.seoDescription ?? guide.intro,
    canonical: `${ORIGIN}${path}/`, ogType: "website" as const,
  }])),
  "/": {
    title: "PC Tweaker | Windows Tuning for Steadier Frame Times",
    description:
      "Review Windows gaming, privacy and performance settings. Inspect each change and restore supported tweaks. Download PC Tweaker Free for Windows 10/11.",
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
    title: "PC Tweaker Privacy Policy — What Data Is Collected",
    description:
      "How PC Tweaker handles account, payment, support and optional diagnostic data, including what is stored, how long it is kept and your privacy rights.",
    canonical: `${ORIGIN}/privacy/`,
    ogType: "website",
  },
  "/terms": {
    title: "PC Tweaker Terms of Service — Use and Billing",
    description:
      "The terms governing the PC Tweaker desktop app, website and subscriptions: licence scope, acceptable use, billing, refunds and service availability.",
    canonical: `${ORIGIN}/terms/`,
    ogType: "website",
  },
  "/cookies": {
    title: "PC Tweaker Cookie Policy — No Tracking Cookies",
    description:
      "PC Tweaker uses no tracking or advertising cookies. Read what the site keeps in your browser, why a theme choice persists, and how to clear it again.",
    canonical: `${ORIGIN}/cookies/`,
    ogType: "website",
  },
  "/accessibility": {
    title: "PC Tweaker Accessibility — Keyboard and Screen Readers",
    description:
      "PC Tweaker's accessibility goals for keyboard navigation, screen readers and contrast, plus how to report a barrier so it can be fixed in a release.",
    canonical: `${ORIGIN}/accessibility/`,
    ogType: "website",
  },
  "/windows-11-optimizer": {
    title: "Windows 11 Optimizer with Reversible Tweaks | PC Tweaker",
    description:
      "Optimize Windows 11 with documented performance, privacy and maintenance tweaks you apply one at a time, review before committing and can roll back.",
    canonical: `${ORIGIN}/windows-11-optimizer/`,
    ogType: "website",
  },
  "/gaming-performance": {
    title: "Windows Gaming Performance Tweaks | PC Tweaker",
    description:
      "Tune Windows for steadier frame times: cut avoidable background overhead, watch CPU, memory and thermals live, and reverse anything that does not help.",
    canonical: `${ORIGIN}/gaming-performance/`,
    ogType: "website",
  },
  "/reversible-windows-tweaks": {
    title: "Reversible Windows Tweaks with Rollback | PC Tweaker",
    description:
      "Every supported PC Tweaker change records its previous value, so you can undo a registry, service or system setting without hunting for the original.",
    canonical: `${ORIGIN}/reversible-windows-tweaks/`,
    ogType: "website",
  },
  "/windows-privacy-tool": {
    title: "Reversible Windows Privacy Tool | PC Tweaker",
    description:
      "Review and adjust supported Windows privacy settings one by one, without destructive debloat scripts, bundled presets or irreversible package removal.",
    canonical: `${ORIGIN}/windows-privacy-tool/`,
    ogType: "website",
  },
};

/**
 * Route-specific JSON-LD, injected at the <!--ROUTE_LD--> marker by
 * scripts/prerender.mjs. A FAQPage is only listed for a route that actually
 * renders those questions and answers as visible text, and the entries are
 * read straight from the same dictionary the page renders from — so the markup
 * cannot drift away from what a reader sees.
 */
const faqPage = (
  id: string,
  url: string,
  items: readonly { readonly q: string; readonly a: string }[],
) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": id,
  url,
  isPartOf: { "@id": `${ORIGIN}/#website` },
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
});

export const ROUTE_JSONLD: Record<string, readonly object[]> = {
  "/": [faqPage(`${ORIGIN}/#faq`, `${ORIGIN}/`, text.faq.items)],
  "/support": [
    faqPage(`${ORIGIN}/support/#faq`, `${ORIGIN}/support/`, text.support.selfServe),
  ],
};

export const NOT_FOUND_SEO: RouteSeo = {
  title: "Page Not Found — PC Tweaker",
  description: "The requested PC Tweaker page could not be found.",
  canonical: `${ORIGIN}/404`,
  ogType: "website",
};
