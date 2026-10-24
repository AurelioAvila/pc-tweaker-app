import tauriConf from "../../src-tauri/tauri.conf.json";
import { referenceModule } from "./reference-registry";
import { msUntil, type Promo } from "../../src/promo";
import { TECHNICAL_GUIDES } from "./pages/technical-guides";
import { PRACTICAL_GUIDES } from "./pages/practical-guides";
import { FIX_GUIDES } from "./pages/fix-guides";
import { GUIDE_FAQS } from "./pages/guide-faqs";
import { DIRECTORY_GUIDES } from "./pages/guide-directory";
import { text } from "./i18n/dictionary";
import { UNINSTALLER_DOWNLOAD_EXE } from "./constants";
import { guideBreadcrumbs } from "./pages/guide-breadcrumbs";

export interface RouteSeo {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly ogType: "website" | "article";
  /** A 1200x630 card made at build time (scripts/og.mjs); the site-wide card otherwise. */
  readonly image?: string;
  readonly imageAlt?: string;
  /** Built and linked, but kept out of search results and the sitemaps. */
  readonly noindex?: boolean;
}

const ORIGIN = "https://pctweaker.app";

export function getRouteImage(seo: RouteSeo) {
  return {
    url: seo.image ?? `${ORIGIN}/og-pc-tweaker-429591f13e.png`,
    alt: seo.imageAlt ?? "PC Tweaker main window: the sidebar sections, the system check and the free trial in the title bar",
  };
}

// Canonicals carry the trailing slash because that is the URL that answers.
// The build emits each route as a directory with its own index.html, and the
// host 301s "/support" to "/support/" — so a canonical without the slash
// pointed search engines at a redirect instead of at the page itself.

export const ROUTE_SEO: Record<string, RouteSeo> = {
  "/guides": {
    title: "Windows Tuning and Troubleshooting Guides | PC Tweaker",
    description: "Find PC Tweaker guides for Windows 11 tuning, DPC latency, X3D and Intel Hybrid CPUs, privacy, rollback and uninstalling programs. Start with your task.",
    canonical: `${ORIGIN}/guides/`,
    ogType: "website",
  },
  "/uninstaller": {
    title: "Windows Uninstaller That Shows the Risk First | PC Tweaker",
    description:
      "Review a Windows uninstall before it runs: inspect its risk score, command and permissions, then check restore-point status and the local removal receipt.",
    canonical: `${ORIGIN}/uninstaller/`,
    ogType: "website",
    image: `${ORIGIN}/uninstaller/og-uninstaller-a9f627cc79.png`,
    imageAlt: "PC Tweaker Uninstaller listing installed apps with a removal confidence label for each, shown with example programs",
  },
  // A guide's on-page H1 and intro are written for someone already reading it;
  // the title and description are written for someone deciding whether to click
  // from a result page. Guides carry their own seoTitle and seoDescription
  // so neither has to reuse the longer on-page introduction.
  ...Object.fromEntries(Object.entries({ ...PRACTICAL_GUIDES, ...FIX_GUIDES }).map(([path, guide]) => [path, {
    title: `${guide.seoTitle} | PC Tweaker`,
    description: guide.seoDescription,
    canonical: `${ORIGIN}${path}/`, ogType: "article" as const,
    ...(path in FIX_GUIDES ? { image: `${ORIGIN}/og${path}.png`, imageAlt: guide.seoTitle }
      : "socialImage" in guide ? { image: `${ORIGIN}${guide.socialImage}`, imageAlt: guide.socialImageAlt } : {}),
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
    title: "Windows 11 Tweaker and Optimizer You Can Undo | PC Tweaker",
    description:
      "Tweak and optimize Windows 11 with documented performance, privacy and maintenance changes: review each one first, apply it on its own, and roll it back.",
    canonical: `${ORIGIN}/windows-11-optimizer/`,
    ogType: "website",
  },
  "/gaming-performance": {
    title: "Windows Gaming Tweaks: Test Frame Times | PC Tweaker",
    description:
      "Investigate Windows 11 game stutter before changing settings. Review Game DVR and HwSchMode, compare repeatable frame times and restore supported tweaks.",
    canonical: `${ORIGIN}/gaming-performance/`,
    ogType: "website",
  },
  "/reversible-windows-tweaks": {
    title: "Reversible Windows Tweaks: Saved-Value Rollback | PC Tweaker",
    description:
      "Restore supported registry and service tweaks from values PC Tweaker saved before each change. Check backups, restart requirements and rollback limits.",
    canonical: `${ORIGIN}/reversible-windows-tweaks/`,
    ogType: "website",
  },
  "/windows-privacy-tool": {
    title: "Windows Privacy Tweaker: Review and Restore | PC Tweaker",
    description:
      "Review Windows 10/11 diagnostic data, advertising ID and Recall policies individually. Check permissions and restore supported settings from saved values.",
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

const homeApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://pctweaker.app/#software",
  "name": "PC Tweaker",
  "operatingSystem": "Windows 10, Windows 11",
  "applicationCategory": "UtilitiesApplication",
  "softwareVersion": tauriConf.version,
  "softwareRequirements": "Windows 10 or Windows 11",
  "downloadUrl": "https://dl.pctweaker.app/pc-tweaker/PCTweaker-Setup.exe",
  "description": "Windows tuning for gaming, privacy and maintenance, with visible setting changes and restore tools for supported tweaks.",
  "url": "https://pctweaker.app/",
  "image": "https://pctweaker.app/og-pc-tweaker-429591f13e.png",
  "sameAs": [
    "https://github.com/AurelioAvila/pc-tweaker-app",
    "https://apps.microsoft.com/detail/9nh3c6dt1g87",
    "https://www.majorgeeks.com/files/details/pc_tweaker.html"
  ],
  "author": { "@type": "Person", "name": "Aurelio Avila", "url": "https://github.com/AurelioAvila" },
  "publisher": { "@id": "https://pctweaker.app/#organization" },
  "offers": [
    { "@type": "Offer", "price": "0", "priceCurrency": "EUR", "name": "Free", "description": "Free plan — no account required" },
    { "@type": "Offer", "price": "7.99", "priceCurrency": "EUR", "name": "Pro monthly", "description": "Pro subscription billed monthly" },
    { "@type": "Offer", "price": "59.99", "priceCurrency": "EUR", "name": "Pro annual", "description": "Pro subscription billed yearly" },
    { "@type": "Offer", "price": "99", "priceCurrency": "EUR", "name": "Pro lifetime", "description": "One-time Pro purchase" }
  ]
};

// The Uninstaller is its own product with its own prices, so its page carries
// its own SoftwareApplication rather than borrowing PC Tweaker's from the
// homepage. The offers mirror the plan cards on that page; check-seo.mjs pins
// them so a price change on the page cannot leave the markup behind.
const uninstallerApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${ORIGIN}/uninstaller/#software`,
  name: "PC Tweaker Uninstaller",
  softwareVersion: "0.13.3",
  operatingSystem: "Windows 10, Windows 11",
  applicationCategory: "UtilitiesApplication",
  downloadUrl: UNINSTALLER_DOWNLOAD_EXE,
  url: `${ORIGIN}/uninstaller/`,
  image: `${ORIGIN}/uninstaller/og-uninstaller-a9f627cc79.png`,
  screenshot: ["inventory", "removal-brief", "ledger"].map((name) => ({
    "@type": "ImageObject",
    contentUrl: `${ORIGIN}/uninstaller/images/${name}-0.13.3.png`,
    caption: `Uninstaller 0.13.3 interface preview with example data: ${name}`,
  })),
  sameAs: ["https://github.com/AurelioAvila/pc-tweaker-uninstaller"],
  description:
    "Windows uninstaller that shows each removal's risk score, command and permissions before it runs, then keeps a local receipt of what was removed.",
  author: { "@type": "Person", name: "Aurelio Avila", url: "https://github.com/AurelioAvila" },
  publisher: { "@id": `${ORIGIN}/#organization` },
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "EUR", name: "Free", description: "Single uninstalls, risk review and the local removal ledger" },
    { "@type": "Offer", price: "9.99", priceCurrency: "EUR", name: "Uninstaller Pro annual", description: "Pro subscription billed yearly" },
  ],
};

export const ROUTE_JSONLD: Record<string, readonly object[]> = {
  "/guides": [{
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${ORIGIN}/guides/#collection`,
    url: `${ORIGIN}/guides/`,
    name: "PC Tweaker guides",
    description: ROUTE_SEO["/guides"].description,
    inLanguage: "en",
    isPartOf: { "@id": `${ORIGIN}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: DIRECTORY_GUIDES.length,
      itemListElement: DIRECTORY_GUIDES.map((guide, index) => ({
        "@type": "ListItem", position: index + 1, name: guide.title, url: `${ORIGIN}${guide.path}`,
      })),
    },
  }],
  "/": [homeApp, faqPage(`${ORIGIN}/#faq`, `${ORIGIN}/`, text.faq.items)],
  "/uninstaller": [uninstallerApp],
  ...Object.fromEntries(Object.entries(TECHNICAL_GUIDES).map(([path, guide]) => [path, [{
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": `${ORIGIN}${path}/#article`,
    url: `${ORIGIN}${path}/`,
    mainEntityOfPage: `${ORIGIN}${path}/`,
    headline: guide.title,
    description: guide.seoDescription,
    datePublished: guide.published,
    dateModified: guide.updated,
    image: `${ORIGIN}${guide.socialImage}`,
    inLanguage: "en",
    author: { "@type": "Person", name: "Aurelio Avila", url: "https://github.com/AurelioAvila" },
    publisher: { "@id": `${ORIGIN}/#organization` },
    isPartOf: { "@id": `${ORIGIN}/#website` },
  }]])),
  "/support": [
    faqPage(`${ORIGIN}/support/#faq`, `${ORIGIN}/support/`, text.support.selfServe),
  ],
  // Fix guides: where they sit, what they are, and the by-hand steps they show.
  ...Object.fromEntries(Object.entries(FIX_GUIDES).map(([path, guide]) => [path, [{
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbs(path, [["Fixes", "/fixes/"], [guide.seoTitle, `${path}/`]]),
      {
        "@type": "TechArticle",
        "@id": `${ORIGIN}${path}/#article`,
        headline: guide.seoTitle,
        description: guide.seoDescription,
        url: `${ORIGIN}${path}/`,
        inLanguage: "en",
        dateModified: "2026-10-15",
        isPartOf: { "@id": `${ORIGIN}/#website` },
        publisher: { "@id": `${ORIGIN}/#organization` },
        about: { "@id": `${ORIGIN}/#software` },
        citation: guide.sources.items.map((s) => s.url),
      },
      {
        "@type": "HowTo",
        "@id": `${ORIGIN}${path}/#howto`,
        name: guide.title,
        step: guide.steps.map((st, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: st.title,
          text: [st.note, st.code].filter(Boolean).join(" "),
        })),
      },
    ],
  }]])),
  // Guides that render a "Common questions" section (src/pages/guide-faqs.ts).
  ...Object.fromEntries(Object.entries(GUIDE_FAQS).map(([path, items]) => [
    path, [faqPage(`${ORIGIN}${path}/#faq`, `${ORIGIN}${path}/`, items)],
  ])),
};

/** A BreadcrumbList from Home through the given trail ([name, path] pairs). */
export function breadcrumbs(path: string, trail: readonly (readonly [string, string])[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${ORIGIN}${path}/#breadcrumbs`,
    itemListElement: [["Home", "/"] as const, ...trail].map(([name, to], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: `${ORIGIN}${to}`,
    })),
  };
}

export const NOT_FOUND_SEO: RouteSeo = {
  title: "Page Not Found — PC Tweaker",
  description: "The requested PC Tweaker page could not be found.",
  canonical: `${ORIGIN}/404`,
  ogType: "website",
};

const OFFER_PLANS: Record<string, string> = {
  "Pro monthly": "monthly",
  "Pro annual": "annual",
  "Pro lifetime": "lifetime",
  "Uninstaller Pro annual": "annual",
};

type ApplicationOffers = {
  "@type"?: string;
  name?: string;
  offers?: { name: string; price: string; description: string }[];
};

/** Regular prices remain the static fallback. The same verified promotion
 *  used by the plan cards supplies current offers after hydration. */
export function getRouteJsonLd(route: string, promo: Promo | null = null): readonly object[] {
  const crumbs = guideBreadcrumbs(route);
  const nodes = [
    // Reference pages live in a separate chunk, loaded before one of them renders (reference-registry.ts).
    ...(ROUTE_JSONLD[route] ?? referenceModule()?.REFERENCE_JSONLD[route] ?? []),
    ...(crumbs.length ? [{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": `${ORIGIN}${route}/#breadcrumb`,
      itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem", position: index + 1, name: crumb.name, item: `${ORIGIN}${crumb.path}`,
      })),
    }] : []),
  ];
  if (!promo || promo.status !== "active" || msUntil(promo, promo.startsAt, 0) > 0 || msUntil(promo, promo.endsAt, 0) <= 0)
    return nodes;
  return nodes.map((node) => {
    const app = node as ApplicationOffers;
    if (app["@type"] !== "SoftwareApplication" || !app.offers) return node;
    const product = app.name === "PC Tweaker" ? "pctweaker"
      : app.name === "PC Tweaker Uninstaller" ? "uninstaller" : null;
    if (!product) return node;
    return {
      ...node,
      offers: app.offers.map((base) => {
        const offer = promo.offers.find((item) => item.product === product && item.plan === OFFER_PLANS[base.name]);
        if (!offer) return base;
        const period = offer.plan === "monthly" ? "month" : "year";
        return {
          ...base,
          price: (offer.price / 100).toFixed(2),
          description: offer.firstPeriodOnly
            ? `Promotional first ${period}; then EUR ${(offer.regular / 100).toFixed(2)} per ${period}`
            : "Promotional one-time purchase; no renewal",
          validFrom: promo.startsAt,
          validThrough: promo.endsAt,
        };
      }),
    };
  });
}
