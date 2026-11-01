import {
  CATALOG,
  CATEGORIES,
  CHECKED_ISO,
  ORIGIN,
  sourceFile,
  tweakSlug,
  type CatalogTweak,
} from "../../reference/catalog";
import { TWEAK_NOTES, VERDICTS, type TweakNote } from "../../reference/tweak-notes";
import { WINDOWS_DB, DB_VERDICTS, dbPath, type DbEntry } from "../../reference/windows-db";
import { FIX_GUIDES } from "../fix-guides";
import { breadcrumbs, type RouteSeo } from "../../seo";

export type CategoryKey = keyof typeof CATEGORIES;

export interface TweakPage {
  readonly t: CatalogTweak;
  readonly note: TweakNote;
  readonly path: string;
  readonly title: string;
  readonly category: CategoryKey;
}

export const TWEAKS: readonly TweakPage[] = CATALOG.map((t) => {
  const note = TWEAK_NOTES[t.id];
  // A control without notes would publish a page with no verdict; the build stops instead.
  if (!note) throw new Error(`No reference notes for catalogue id ${t.id} (src/reference/tweak-notes.ts)`);
  return {
    t,
    note,
    category: t.category,
    path: `/tweaks/${CATEGORIES[t.category].slug}/${tweakSlug(t, note.slug)}`,
    title: note.title ?? t.name,
  };
});

export const tweakById = (id: string) => TWEAKS.find((p) => p.t.id === id);
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];
export const categoryPath = (c: CategoryKey) => `/tweaks/${CATEGORIES[c].slug}`;

export const TOOLS = [
  {
    path: "/tools/process-checker",
    name: "Process & Service Safety Checker",
    title: "Windows Process and Service Safety Checker",
    blurb: "Type a process or service name and see what it is, whether to leave it alone, and how to check the file yourself.",
    description:
      "Look up a Windows process or service by name: what it does, whether to leave it alone, what PC Tweaker does with it, and how to check its file and signature.",
  },
  {
    path: "/tools/timer-resolution-calculator",
    name: "Timer & Latency Calculator",
    title: "Timer Resolution and Latency Calculator",
    blurb: "The arithmetic behind timer periods, frame times, polling rates and audio buffers, with every formula shown.",
    description:
      "Work out frame time, timer-period overshoot, mouse polling delay and audio buffer latency from public formulas. Theoretical arithmetic, not a measurement.",
  },
  {
    path: "/tools/profile-builder",
    name: "Profile Builder",
    title: "PC Tweaker Profile Builder: Plan Your Tweaks",
    blurb: "Pick controls from the real catalogue, then download a profile file PC Tweaker can import for review, plus a Markdown checklist.",
    description:
      "Choose Windows controls from PC Tweaker's catalogue and download a profile file the app imports for review, plus a Markdown list of every change it makes.",
  },
  {
    path: "/tools/debloat-windows-11",
    name: "Debloat List Builder",
    title: "Debloat Windows 11: Choose Apps, Keep a Way Back",
    blurb: "Pick preinstalled apps to remove, then get a list PC Tweaker loads for review, the PowerShell lines and the Store link that brings each one back.",
    description:
      "Choose which preinstalled Windows 11 apps to remove, see what each removal costs, and get a list PC Tweaker loads for review plus the Store links to reinstall.",
  },
] as const;

/* ------------------------------------------------------------------ *
 * Titles and descriptions.
 * ------------------------------------------------------------------ */

const brand = (title: string) => (`${title} | PC Tweaker`.length <= 60 ? `${title} | PC Tweaker` : title);

/** The first candidate whose length search engines show in full (140-160). */
function fit(candidates: readonly string[], what: string): string {
  const ok = candidates.find((c) => c.length >= 140 && c.length <= 160);
  if (!ok) throw new Error(`No description of 140-160 characters for ${what}: ${candidates.map((c) => c.length).join(", ")}`);
  return ok;
}

const TAILS = [
  "",
  " Sources included.",
  " With sources and undo steps.",
  " Includes sources and undo steps.",
  " Every value is shown, with its sources.",
  " Every value is shown, with sources and undo steps.",
  " Exact values, scope, sources and how to undo it.",
  " Checked against Microsoft documentation where it exists.",
];

function tweakDescription(p: TweakPage): string {
  const name = p.t.name;
  const bases = [
    `What “${name}” changes in Windows, how to set and undo it by hand, and when it is worth it.`,
    `“${name}”: the exact Windows change, how to make and undo it by hand, and an honest verdict.`,
    `“${name}”: the change it makes, the manual steps and an honest verdict.`,
    `${name}: what it changes, how to do it by hand and when it helps.`,
  ];
  return fit(bases.flatMap((b) => TAILS.map((t) => b + t)), p.t.id);
}

/** Searchers type the file name and ask whether it is safe or can go; the title says what it is and answers the first. */
function dbTitle(e: DbEntry): string {
  const ask = e.kind === "process" ? "Is It Safe?" : "Can You Disable It?";
  const what = "What It Is and ";
  const plain = e.displayName.includes("(");
  const ok = [
    ...(plain ? [] : [`${e.name}: ${what}${ask} (${e.displayName})`, `${e.name} (${e.displayName}): ${ask}`, `${e.name} (${e.displayName}): ${e.kind === "process" ? "Safe?" : "Disable It?"}`]),
    `${e.name}: ${what}${ask}`,
    `${e.name}: ${ask}`,
  ].find((t) => t.length <= 60);
  if (!ok) throw new Error(`No title of 60 characters or fewer for ${e.slug}`);
  return ok;
}

const dbDir = (e: DbEntry) => e.path.slice(0, e.path.lastIndexOf("\\"));

function dbDescription(e: DbEntry): string {
  const what = e.kind === "process" ? "process" : "service";
  const svc = /service$/i.test(e.displayName) ? e.displayName : `${e.displayName} service`;
  const dir = dbDir(e);
  const signed = e.signer?.startsWith("Microsoft") ? ", signed by Microsoft" : "";
  const bases =
    e.kind === "process"
      ? [
          `${e.name} is the ${e.displayName}. ${e.answer} The genuine file is in ${dir}${signed}: how to check yours.`,
          `${e.name} is the ${e.displayName}. ${e.answer} The genuine file is in ${dir}${signed}.`,
          `${e.name}. ${e.answer} The genuine file is in ${dir}${signed}. How to check yours.`,
          `${e.name} (${e.displayName}). ${e.answer} Where the genuine file lives and how to check it.`,
          `${e.name} is the ${e.displayName}. ${e.answer} What it does and how to check the file on your PC.`,
        ]
      : [
          `${e.name} is the ${svc}. ${e.answer} What it does, what PC Tweaker changes and how to check it.`,
          `${e.name} is the ${svc}. ${e.answer} What it does and how to check it on your PC.`,
          `${e.name}. ${e.answer} What this Windows ${what} does, what PC Tweaker changes and how to check it.`,
          `${e.name}. ${e.answer} What this Windows ${what} does and how to check it on your own PC.`,
        ];
  return fit(bases.flatMap((b) => TAILS.map((t) => b + t)), e.slug);
}

/** Questions the page already answers in its own text; the same list renders on the page and in the FAQPage markup. */
export function dbFaq(e: DbEntry): { q: string; a: string }[] {
  const dir = dbDir(e);
  const safe =
    e.kind === "process"
      ? {
          q: `Is ${e.name} safe, or could it be a virus?`,
          a: `The genuine file is in ${dir}${e.signer ? ` and is signed by ${e.signer}` : ""}. A program can borrow a familiar name, so check where your copy runs from and who signed it with the commands in “Check it yourself”. A file with this name anywhere else, or with another signer, deserves a closer look.`,
        }
      : {
          q: `What does the ${e.name} service do?`,
          a: `${e.purpose} It runs ${e.path}${e.binary ? ` (${e.binary})` : ""}${e.account ? ` as ${e.account}` : ""}.`,
        };
  const end = {
    q: `Can I ${e.kind === "process" ? "end" : "disable"} ${e.name}?`,
    a: `${DB_VERDICTS[e.verdict].label}. ${e.why}`,
  };
  return [safe, end, ...(e.busy ? [e.busy] : [])];
}

const ogFor = (path: string) => `${ORIGIN}/og${path}.png`;

function seo(path: string, title: string, description: string, image = true): RouteSeo {
  return {
    title,
    description,
    canonical: `${ORIGIN}${path}/`,
    ogType: "website",
    ...(image ? { image: ogFor(path), imageAlt: title.replace(/ \| PC Tweaker$/, "") } : {}),
  };
}

const CATEGORY_DESCRIPTIONS: Record<CategoryKey, string> = {
  performance: "Windows performance settings explained one by one: delays, animations, background work and power, each with the exact change, manual steps and an undo.",
  gaming: "Windows gaming settings checked against Microsoft's documentation: what each changes, how to set and undo it by hand, and which ones have no measured benefit.",
  privacy: "Windows privacy settings and policies, one page each: diagnostic data, ads, suggestions and AI features, with the exact value, manual steps and how to undo.",
  ui: "Windows 11 interface settings for the taskbar, Start, File Explorer and theme, each with the exact registry value, how to set it by hand and how to undo it.",
  maintenance: "Windows maintenance settings for updates, long paths, search indexing, startup and storage: the exact change, the trade-off and how to undo it by hand.",
};

export const REFERENCE_SEO: Record<string, RouteSeo> = {
  "/tweaks": seo(
    "/tweaks",
    "Windows Tweaks Explained, One Setting at a Time",
    "Every Windows control in PC Tweaker: the exact registry value or service it changes, how to set and undo it by hand, and an honest verdict on when it helps.",
  ),
  ...Object.fromEntries(
    CATEGORY_KEYS.map((c) => [
      categoryPath(c),
      seo(
        categoryPath(c),
        brand(`${CATEGORIES[c].label} Tweaks for Windows`),
        CATEGORY_DESCRIPTIONS[c],
      ),
    ]),
  ),
  // One page per control shares most of its wording with its siblings (measured 22 Oct 2026: median 23%
  // of the text unique), so the leaves stay noindex,follow until each carries enough of its own; the
  // category hubs list every control and are the indexed entry points.
  ...Object.fromEntries(TWEAKS.map((p) => [p.path, { ...seo(p.path, brand(p.title), tweakDescription(p)), noindex: true }])),
  "/database": seo(
    "/database",
    "Windows Processes and Services: What to Leave Alone",
    "What common Windows processes and services do, which ones to leave alone, which you can set to Manual, and how to check a file and its signature yourself.",
  ),
  ...Object.fromEntries(
    WINDOWS_DB.map((e) => [dbPath(e), seo(dbPath(e), dbTitle(e), dbDescription(e))]),
  ),
  "/fixes": seo(
    "/fixes",
    "Windows Fixes With Manual Steps and Undo | PC Tweaker",
    "Problem-first Windows guides: audio crackling, long paths, Sticky Keys, update bandwidth, AI features and GPU scheduling, each with steps you can undo.",
  ),
  "/tools": seo(
    "/tools",
    "Free Windows Tools: Checker, Debloat, Calculator, Profiles",
    "Four free browser tools: look up a process or service, build a Windows 11 debloat list, calculate timer and latency figures, and plan a PC Tweaker profile.",
  ),
  ...Object.fromEntries(TOOLS.map((tool) => [tool.path, seo(tool.path, brand(tool.title), tool.description)])),
};

/* ------------------------------------------------------------------ *
 * Structured data: one @graph per page.
 * ------------------------------------------------------------------ */

const graph = (...nodes: object[]) => [{ "@context": "https://schema.org", "@graph": nodes }];
const page = (path: string, type: string, extra: object = {}) => ({
  "@type": type,
  "@id": `${ORIGIN}${path}/#page`,
  url: `${ORIGIN}${path}/`,
  name: REFERENCE_SEO[path].title.replace(/ \| PC Tweaker$/, ""),
  description: REFERENCE_SEO[path].description,
  inLanguage: "en",
  isPartOf: { "@id": `${ORIGIN}/#website` },
  ...extra,
});
const article = (path: string, citations: readonly string[], about?: object) => ({
  "@type": "TechArticle",
  "@id": `${ORIGIN}${path}/#article`,
  headline: REFERENCE_SEO[path].title.replace(/ \| PC Tweaker$/, ""),
  description: REFERENCE_SEO[path].description,
  url: `${ORIGIN}${path}/`,
  inLanguage: "en",
  dateModified: CHECKED_ISO,
  image: REFERENCE_SEO[path].image,
  isPartOf: { "@id": `${ORIGIN}/#website` },
  publisher: { "@id": `${ORIGIN}/#organization` },
  ...(about ? { about } : {}),
  citation: [...new Set(citations)],
});

/** "1 November 2026" -> "2026-11-01". */
const isoDay = (d: string) => new Date(`${d} 12:00 UTC`).toISOString().slice(0, 10);

const TWEAKS_CRUMB = ["Windows tweaks", "/tweaks/"] as const;
const DB_CRUMB = ["Windows database", "/database/"] as const;

export const REFERENCE_JSONLD: Record<string, readonly object[]> = {
  "/tweaks": graph(breadcrumbs("/tweaks", [TWEAKS_CRUMB]), page("/tweaks", "CollectionPage")),
  ...Object.fromEntries(
    CATEGORY_KEYS.map((c) => [
      categoryPath(c),
      graph(
        breadcrumbs(categoryPath(c), [TWEAKS_CRUMB, [CATEGORIES[c].label, `${categoryPath(c)}/`]]),
        page(categoryPath(c), "CollectionPage"),
      ),
    ]),
  ),
  ...Object.fromEntries(
    TWEAKS.map((p) => [
      p.path,
      graph(
        breadcrumbs(p.path, [TWEAKS_CRUMB, [CATEGORIES[p.category].label, `${categoryPath(p.category)}/`], [p.title, `${p.path}/`]]),
        article(p.path, [sourceFile(p.t).url, ...(p.note.sources ?? []).map((s) => s.url)], { "@id": `${ORIGIN}/#software` }),
      ),
    ]),
  ),
  "/database": graph(breadcrumbs("/database", [DB_CRUMB]), page("/database", "CollectionPage")),
  ...Object.fromEntries(
    WINDOWS_DB.map((e) => [
      dbPath(e),
      [
        ...graph(
          breadcrumbs(dbPath(e), [DB_CRUMB, [e.name, `${dbPath(e)}/`]]),
          { ...article(dbPath(e), e.sources.map((s) => s.url)), ...(e.checked ? { dateModified: isoDay(e.checked) } : {}) },
        ),
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": `${ORIGIN}${dbPath(e)}/#faq`,
          url: `${ORIGIN}${dbPath(e)}/`,
          isPartOf: { "@id": `${ORIGIN}/#website` },
          mainEntity: dbFaq(e).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        },
      ],
    ]),
  ),
  "/fixes": graph(breadcrumbs("/fixes", [["Fixes", "/fixes/"]]), page("/fixes", "CollectionPage")),
  "/tools": graph(breadcrumbs("/tools", [["Tools", "/tools/"]]), page("/tools", "CollectionPage")),
  ...Object.fromEntries(
    TOOLS.map((tool) => [
      tool.path,
      graph(breadcrumbs(tool.path, [["Tools", "/tools/"], [tool.name, `${tool.path}/`]]), page(tool.path, "WebPage")),
    ]),
  ),
};

/** What each Open Graph card shows, for scripts/og.mjs. */
export function ogCards(): { path: string; eyebrow: string; title: string; detail: string; badge?: string }[] {
  return [
    ...TWEAKS.map((p) => ({
      path: p.path,
      eyebrow: `WINDOWS TWEAK · ${CATEGORIES[p.category].label.toUpperCase()}`,
      title: p.title,
      detail: p.t.changes.map((c) => (c.kind === "registry" ? `${c.valueName} = ${c.setsTo}` : c.kind === "service" ? `${c.name}: ${c.action}` : c.program)).slice(0, 2).join("  ·  ") || p.t.name,
      badge: VERDICTS[p.note.verdict].label,
    })),
    ...WINDOWS_DB.map((e) => ({
      path: dbPath(e),
      eyebrow: e.kind === "process" ? "WINDOWS PROCESS" : "WINDOWS SERVICE",
      title: `${e.name}`,
      detail: e.displayName,
      badge: DB_VERDICTS[e.verdict].label,
    })),
    ...Object.entries(FIX_GUIDES).map(([path, g]) => ({ path, eyebrow: g.eyebrow, title: g.seoTitle, detail: "Manual steps, undo, and the same job in PC Tweaker" })),
    ...TOOLS.map((tool) => ({ path: tool.path, eyebrow: "FREE TOOL", title: tool.name, detail: tool.blurb })),
    { path: "/tweaks", eyebrow: "REFERENCE", title: "Windows tweaks, explained", detail: `${CATALOG.length} controls with exact values and undo steps` },
    ...CATEGORY_KEYS.map((c) => ({ path: categoryPath(c), eyebrow: "WINDOWS TWEAKS", title: `${CATEGORIES[c].label} tweaks`, detail: `${TWEAKS.filter((p) => p.category === c).length} controls, each with an honest verdict` })),
    { path: "/database", eyebrow: "REFERENCE", title: "Windows processes and services", detail: `${WINDOWS_DB.length} entries: what to leave alone and why` },
    { path: "/fixes", eyebrow: "GUIDES", title: "Windows fixes", detail: "Problem first, with steps you can undo" },
    { path: "/tools", eyebrow: "FREE TOOLS", title: "Windows tools", detail: "Checker, calculator, profile and debloat lists" },
  ];
}
