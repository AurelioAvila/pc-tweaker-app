/**
 * The confirmation a customer gets after paying, for any product on this
 * backend, the notice when a payment is reversed, the subscription-ending
 * notice and the Uninstaller year included with Lifetime. Family email kit
 * (email-design-kit/pc-tweaker 05a, 05b, 06, 09 and pc-tweaker-uninstaller
 * 01 to 03), in the reader's language (copy/). Stripe's own receipt is an
 * accounting document; these say what was unlocked, where to use it, and what
 * to do on a second PC or after a reinstall.
 */

import { en } from "./copy/en";
import type { Copy } from "./copy";
import {
  EMAIL_BRANDS,
  button,
  details,
  emailShell,
  escapeHtml,
  link,
  note,
  paragraph,
  plainText,
  steps,
  textFooter,
  type EmailBrand,
} from "./layout";

/** Catalogue counts quoted below. scripts/check-public-counts.mjs fails the
 *  build when they differ from the catalogue the app ships. */
const TOTAL_CONTROLS = 81;
const FREE_CONTROLS = 46;
const PRO_CONTROLS = 35;
export const CATALOGUE = { total: TOTAL_CONTROLS, free: FREE_CONTROLS, pro: PRO_CONTROLS };

export type ProductBrand = {
  /** Shown in the plan row, e.g. "PC Tweaker Pro". */
  name: string;
  /** Logo, colours and site of the app. */
  visual: EmailBrand;
};

export const PRODUCT_BRANDS: Record<string, ProductBrand> = {
  pctweaker: { name: "PC Tweaker Pro", visual: EMAIL_BRANDS.pctweaker },
  uninstaller: { name: "PC Tweaker Uninstaller Pro", visual: EMAIL_BRANDS.uninstaller },
};

export type ProWelcomeEmailInput = {
  /** Which product was bought. Unknown values fall back to PC Tweaker rather
   *  than sending an email with holes in it. */
  product?: string;
  firstName: string;
  email: string;
  plan: "monthly" | "annual" | "lifetime" | string;
  priceLabel: string; // e.g. "€9.99 / month"
  /** Pre-formatted in the reader's language. Null for a one-off purchase,
   *  which never renews: the card then says so instead of quoting a date
   *  that would simply be untrue. */
  renewsOn: string | null;
};

export function brandFor(product: string | null | undefined): ProductBrand {
  return PRODUCT_BRANDS[product ?? ""] ?? PRODUCT_BRANDS.pctweaker;
}

const firstWord = (value: string) => (value || "").trim().split(/\s+/)[0] ?? "";
const planLabel = (c: Copy, plan: string | null) => c.plans[plan ?? ""] ?? c.plans.monthly;
const listed = (rows: [string, string][]) => rows.map(([label, value]) => `${label}: ${value}`);
const numbered = (title: string, items: string[]) => [`${title}:`, ...items.map((item, i) => `${i + 1}. ${plainText(item)}`)];

export function proWelcomeSubject(product?: string | null, plan?: string | null, c: Copy = en): string {
  return c.receipt.subject(product === "uninstaller", plan === "lifetime");
}

type Mail = {
  eyebrow: string;
  headline: string;
  preheader: string;
  intro: string;
  rows: [string, string][];
  heading: string;
  items: string[];
  noteHtml: string;
  button: string;
  help: { title: string; text: string; expectation?: string };
  why: string;
};

function receipt({ product, firstName, email, plan, priceLabel, renewsOn }: ProWelcomeEmailInput, c: Copy): Mail {
  const r = c.receipt;
  const rows = r.rows;
  const lifetime = renewsOn === null;
  const who = escapeHtml(email);
  const name = firstWord(firstName);
  const help = { title: r.help.title, text: escapeHtml(r.help.text), expectation: r.help.expectation };

  if (product === "uninstaller") {
    return {
      eyebrow: r.eyebrowPro,
      headline: r.un.headline(name),
      preheader: r.un.preheader(planLabel(c, plan), priceLabel, renewsOn),
      intro: r.un.intro(email),
      rows: [
        [rows.plan, planLabel(c, plan)],
        [rows.charged, priceLabel],
        renewsOn ? [rows.renewsOn, renewsOn] : [rows.access, rows.neverExpires],
        [rows.account, rows.shared(email)],
      ],
      heading: r.un.stepsTitle,
      items: r.un.stepsHtml(lifetime, who, escapeHtml(renewsOn ?? "")),
      noteHtml: escapeHtml(r.un.note(lifetime)),
      button: r.buttonUn,
      help: { title: r.un.help.title, text: escapeHtml(r.un.help.text), expectation: r.un.help.expectation },
      why: r.un.why(lifetime),
    };
  }

  if (lifetime) {
    return {
      eyebrow: r.eyebrowLifetime,
      headline: r.lifetime.headline(name),
      preheader: r.lifetime.preheader(priceLabel),
      intro: r.lifetime.intro(email, TOTAL_CONTROLS),
      rows: [
        [rows.plan, planLabel(c, "lifetime")],
        [rows.charged, priceLabel],
        [rows.access, rows.neverExpires],
        [rows.renewal, rows.renewalNone],
        [rows.included, rows.includedValue],
        [rows.account, email],
      ],
      heading: r.lifetime.stepsTitle,
      items: r.lifetime.stepsHtml(who, link("https://pctweaker.app/uninstaller/", "pctweaker.app/uninstaller")),
      noteHtml: escapeHtml(r.lifetime.note),
      button: r.buttonPct,
      help,
      why: r.lifetime.why,
    };
  }

  return {
    eyebrow: r.eyebrowPro,
    headline: r.sub.headline(name),
    preheader: r.sub.preheader(planLabel(c, plan), priceLabel, renewsOn ?? ""),
    intro: r.sub.intro(email, TOTAL_CONTROLS, FREE_CONTROLS, PRO_CONTROLS),
    rows: [
      [rows.plan, planLabel(c, plan)],
      [rows.charged, priceLabel],
      [rows.renewsOn, renewsOn ?? ""],
      [rows.account, email],
    ],
    heading: r.sub.stepsTitle,
    items: r.sub.stepsHtml(who, escapeHtml(renewsOn ?? "")),
    noteHtml: escapeHtml(r.sub.note),
    button: r.buttonPct,
    help,
    why: r.sub.why,
  };
}

function render(m: Mail, brand: EmailBrand, c: Copy) {
  return {
    html: emailShell({
      brand,
      c,
      preheader: m.preheader,
      eyebrow: m.eyebrow,
      headline: m.headline,
      intro: m.intro,
      blocks: [details(m.rows), button({ label: m.button, url: brand.siteUrl }), steps(m.heading, m.items), note(m.noteHtml)],
      help: m.help,
      why: m.why,
    }),
    text:
      [m.headline, "", m.intro, "", ...listed(m.rows), "", ...numbered(m.heading, m.items), "", plainText(m.noteHtml), "", `${m.button}: ${brand.siteUrl}`].join("\n") +
      textFooter(brand, m.why, c),
  };
}

export function proWelcomeText(input: ProWelcomeEmailInput, c: Copy = en): string {
  return render(receipt(input, c), brandFor(input.product).visual, c).text;
}

export function proWelcomeHtml(input: ProWelcomeEmailInput, c: Copy = en): string {
  return render(receipt(input, c), brandFor(input.product).visual, c).html;
}

// ---------------------------------------------------------------- reversal

export type RefundEmailInput = {
  product?: string | null;
  firstName: string;
  plan: string | null;
  /** e.g. "€99.00"; null when Stripe gave no amount. */
  refundedLabel: string | null;
};

// Digital purchases are not refundable: this notice reports a reversal Stripe
// told us about and never mentions, offers or implies a refund.
const subscriptionPlan = (plan: string | null) => plan === "monthly" || plan === "annual";

export function refundSubject(product?: string | null, c: Copy = en): string {
  return c.reversal.subject(product === "uninstaller");
}

function reversal({ product, firstName, plan, refundedLabel }: RefundEmailInput, c: Copy) {
  const x = c.reversal;
  const rows = x.rows;
  const amount = refundedLabel ? [[rows.amount, refundedLabel] as [string, string]] : [];
  const planRow = plan && c.plans[plan] ? [[rows.plan, c.plans[plan]] as [string, string]] : [];
  const headline = x.headline(firstWord(firstName));
  if (product === "uninstaller") {
    const u = x.un;
    return {
      brand: EMAIL_BRANDS.uninstaller,
      headline,
      preheader: u.preheader(refundedLabel),
      intro: u.intro(refundedLabel),
      rows: [...amount, ...planRow, [rows.unPro, rows.ended], [rows.unFree, rows.unFreeValue]] as [string, string][],
      paragraphs: [u.stops, subscriptionPlan(plan) ? u.stopRenewal : u.oneOff],
      noteText: u.origin,
      textParagraphs: [u.stops, subscriptionPlan(plan) ? u.stopRenewal : u.oneOff, u.origin],
      why: x.why(true),
    };
  }
  const p = x.pct;
  const lead = p.lead(refundedLabel);
  return {
    brand: EMAIL_BRANDS.pctweaker,
    headline,
    preheader: `${lead} ${p.preheaderTail}`,
    intro: `${lead} ${p.introTail}`,
    rows: [...amount, ...planRow, [rows.proAccess, rows.ended], [rows.account, rows.accountValue]] as [string, string][],
    paragraphs: [`${p.ended} ${p.endedTail}`, subscriptionPlan(plan) ? p.stopRenewal : p.oneOff],
    noteText: p.mistake,
    textParagraphs: [lead, p.ended, subscriptionPlan(plan) ? p.stopRenewal : p.oneOff, p.mistake],
    why: x.why(false),
  };
}

/** Sent once per fully reversed charge, after access has been removed. */
export function refundText(input: RefundEmailInput, c: Copy = en): string {
  const r = reversal(input, c);
  const body = input.product === "uninstaller" ? [r.intro, listed(r.rows).join("\n"), ...r.textParagraphs] : r.textParagraphs;
  return [r.headline, ...body].join("\n\n") + textFooter(r.brand, r.why, c);
}

export function refundHtml(input: RefundEmailInput, c: Copy = en): string {
  const r = reversal(input, c);
  return emailShell({
    brand: r.brand,
    c,
    preheader: r.preheader,
    eyebrow: c.reversal.eyebrow,
    headline: r.headline,
    intro: r.intro,
    blocks: [details(r.rows), ...r.paragraphs.map((text) => paragraph(escapeHtml(text))), note(escapeHtml(r.noteText))],
    help: { title: c.reversal.helpTitle, text: escapeHtml(c.reversal.helpText) },
    why: r.why,
  });
}

// ---------------------------------------------------------------- ending

export type EndingInput = {
  product: string;
  firstName: string;
  plan: string | null;
  endsOn: string;
  reason: "cancelled" | "payment_failed";
};

/** Kit 09: a subscription set to end, by cancellation or a failed renewal. */
export function endingMail({ product, firstName, plan, endsOn, reason }: EndingInput, c: Copy = en) {
  const x = c.ending;
  const u = product === "uninstaller";
  const brand = u ? EMAIL_BRANDS.uninstaller : EMAIL_BRANDS.pctweaker;
  const failed = reason === "payment_failed";
  const rows: [string, string][] = [
    [x.rows.plan, planLabel(c, plan)],
    [x.rows.until, endsOn],
    [x.rows.next, x.rows.nextValue],
    [x.rows.after, x.afterValue(u, FREE_CONTROLS)],
  ];
  const items = x.steps(u, failed);
  const headline = x.headline(firstWord(firstName), endsOn);
  return {
    subject: x.subject(brand.name, endsOn),
    html: emailShell({
      brand,
      c,
      preheader: x.preheader(endsOn),
      eyebrow: x.eyebrow,
      headline,
      intro: x.intro(brand.name, failed, endsOn),
      blocks: [
        details(rows),
        steps(x.stepsTitle(endsOn), items.map(escapeHtml)),
        button({ label: x.button(brand.name), url: brand.siteUrl }),
        note(escapeHtml(x.note)),
      ],
      help: { title: x.helpTitle, text: escapeHtml(x.helpText) },
      why: x.why(brand.name),
    }),
    text:
      [headline, "", x.intro(brand.name, failed, endsOn), "", ...listed(rows), "", ...numbered(x.stepsTitle(endsOn), items), "", x.note].join("\n") +
      textFooter(brand, x.why(brand.name), c),
  };
}

// ---------------------------------------------------------------- bonus

/** Uninstaller kit 03: the year of Uninstaller Pro that comes with Lifetime. */
export function bonusMail(firstName: string, startedOn: string, endsOn: string, c: Copy = en) {
  const x = c.bonus;
  const brand = EMAIL_BRANDS.uninstaller;
  const rows: [string, string][] = [
    [x.rows.entitlement, x.rows.entitlementValue],
    [x.rows.started, startedOn],
    [x.rows.ends, endsOn],
    [x.rows.charged, x.rows.chargedValue],
  ];
  const headline = x.headline(firstWord(firstName));
  return {
    subject: x.subject,
    html: emailShell({
      brand,
      c,
      preheader: x.preheader(endsOn),
      eyebrow: x.eyebrow,
      headline,
      intro: x.intro(endsOn),
      blocks: [details(rows), steps(x.stepsTitle, x.stepsHtml), button({ label: x.button, url: brand.siteUrl }), note(escapeHtml(x.note(endsOn)))],
      help: { title: x.helpTitle, text: escapeHtml(x.helpText) },
      why: x.why,
    }),
    text:
      [headline, "", x.intro(endsOn), "", ...listed(rows), "", ...numbered(x.stepsTitle, x.stepsHtml), "", x.note(endsOn), "", `${x.button}: ${brand.siteUrl}`].join("\n") +
      textFooter(brand, x.why, c),
  };
}
