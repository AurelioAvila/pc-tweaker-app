export interface RouteSeo {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly ogType: "website";
}

const ORIGIN = "https://pctweaker.app";

export const ROUTE_SEO: Record<string, RouteSeo> = {
  "/": {
    title: "PC Tweaker — Every Millisecond Is Earned",
    description:
      "50 real Windows tweaks — registry, power plan, services — each snapshotted before applying. One click to apply, one to undo. Free for Windows 10/11.",
    canonical: `${ORIGIN}/`,
    ogType: "website",
  },
  "/support": {
    title: "PC Tweaker Support — Help, Troubleshooting and Contact",
    description:
      "Get help with PC Tweaker installation, rollback, licenses, billing and Windows optimization. Use the troubleshooting guides or contact support.",
    canonical: `${ORIGIN}/support`,
    ogType: "website",
  },
  "/privacy": {
    title: "Privacy Policy — PC Tweaker",
    description:
      "Read how PC Tweaker handles account, payment, support and optional diagnostic data, including retention, security and privacy rights.",
    canonical: `${ORIGIN}/privacy`,
    ogType: "website",
  },
  "/terms": {
    title: "Terms of Service — PC Tweaker",
    description:
      "Read the terms that govern the PC Tweaker desktop application, website, subscriptions, acceptable use and service availability.",
    canonical: `${ORIGIN}/terms`,
    ogType: "website",
  },
  "/cookies": {
    title: "Cookie Policy — PC Tweaker",
    description:
      "PC Tweaker does not use tracking or advertising cookies. Read what the website stores locally and how theme preferences work.",
    canonical: `${ORIGIN}/cookies`,
    ogType: "website",
  },
  "/accessibility": {
    title: "Accessibility — PC Tweaker",
    description:
      "Learn about PC Tweaker's accessibility goals and how to report a keyboard, screen reader or assistive technology problem.",
    canonical: `${ORIGIN}/accessibility`,
    ogType: "website",
  },
};

export const NOT_FOUND_SEO: RouteSeo = {
  title: "Page Not Found — PC Tweaker",
  description: "The requested PC Tweaker page could not be found.",
  canonical: `${ORIGIN}/404`,
  ogType: "website",
};
