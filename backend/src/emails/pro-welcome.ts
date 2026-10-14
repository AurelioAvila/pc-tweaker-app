/**
 * The confirmation a customer gets after paying, for any product on this
 * backend. Stripe's own receipt is an accounting document; it does not say
 * what was unlocked or where to use it, which is what this is for.
 *
 * One template, one voice, per-product wording. The alternative — a separate
 * email per product — is how a two-product catalogue ends up looking like two
 * unrelated companies to the same customer, who is very often the same person
 * buying twice.
 */

import {
  EMAIL_BRANDS,
  bulletRow,
  detailRow,
  divider,
  emailShell,
  listTable,
  row,
  sectionLabel,
  smallPrint,
  textFooter,
  escapeHtml,
  type EmailBrand,
} from "./layout";

/** The per-product words the shared layout is filled with. */
export type ProductBrand = {
  /** Shown in the subject line, e.g. "PC Tweaker Pro". */
  name: string;
  /** Logo, colours and site of the app. */
  visual: EmailBrand;
  /** Small uppercase line above the headline, e.g. "Pro activated". */
  eyebrow: string;
  headline: string;
  intro: string;
  /** Used when the purchase does not renew. "Thanks for subscribing" is the
   *  wrong sentence to send someone who deliberately paid once so they would
   *  never have a subscription. */
  introOneOff: string;
  /** Three concrete things the payment just unlocked, worded as the app's
   *  own plan page words them. Kept to three: a list long enough to scroll
   *  reads as marketing, not as a receipt. */
  highlights: [string, string, string];
  ctaLabel: string;
  signInHint: string;
};

/** Catalogue counts quoted below. scripts/check-public-counts.mjs fails the
 *  build when they differ from the catalogue the app ships. */
const TOTAL_CONTROLS = 81;
const FREE_CONTROLS = 46;
const PRO_CONTROLS = 35;

export const PRODUCT_BRANDS: Record<string, ProductBrand> = {
  pctweaker: {
    name: "PC Tweaker Pro",
    visual: EMAIL_BRANDS.pctweaker,
    eyebrow: "Pro activated",
    headline: "You're Pro now",
    intro:
      "Thanks for subscribing to PC Tweaker Pro. Your account is upgraded and every Pro tweak is unlocked, with no extra setup needed.",
    introOneOff:
      "Thanks for buying PC Tweaker Pro. Your account is upgraded for good and every Pro tweak is unlocked, with no extra setup needed.",
    highlights: [
      `All ${TOTAL_CONTROLS} controls (${FREE_CONTROLS} Free, ${PRO_CONTROLS} Pro), with Game Sessions and the Turbo Gaming preset`,
      "Advanced privacy controls for telemetry and activity history",
      "Duplicate file finder, Windows Update cache cleanup and indexing control",
    ],
    ctaLabel: "Open PC Tweaker",
    signInHint: "Sign in with {email} to see your Pro tweaks.",
  },
  uninstaller: {
    name: "PC Tweaker Uninstaller Pro",
    visual: EMAIL_BRANDS.uninstaller,
    eyebrow: "Pro activated",
    headline: "Uninstaller Pro is yours",
    intro:
      "Thanks for subscribing to Uninstaller Pro. Your account is upgraded and leftover cleanup, batch removal and broken-entry removal are unlocked, with no extra setup needed.",
    introOneOff:
      "Thanks for buying Uninstaller Pro. Your account is upgraded and leftover cleanup, batch removal and broken-entry removal are unlocked, with no extra setup needed.",
    highlights: [
      "Leftover cleanup, with files sent to the Recycle Bin",
      "Batch removal of several programs, in a safe order",
      "Removal of broken entries whose uninstaller is gone",
    ],
    ctaLabel: "Open Uninstaller",
    signInHint: "Sign in with {email} to unlock it on this PC.",
  },
};

export type ProWelcomeEmailInput = {
  /** Which product was bought. Unknown values fall back to PC Tweaker rather
   *  than sending an email with holes in it. */
  product?: string;
  firstName: string;
  email: string;
  plan: "monthly" | "annual" | "lifetime" | string;
  priceLabel: string; // e.g. "€9.99 / month"
  /** Pre-formatted, e.g. "September 24, 2026". Null for a one-off purchase,
   *  which never renews — the row then reads "Access / Never expires" instead
   *  of quoting a date that would simply be untrue. */
  renewsOn: string | null;
};

export function brandFor(product: string | null | undefined): ProductBrand {
  return PRODUCT_BRANDS[product ?? ""] ?? PRODUCT_BRANDS.pctweaker;
}

export function proWelcomeSubject(product?: string | null): string {
  const brand = brandFor(product);
  return product === "uninstaller"
    ? `Your ${brand.name} purchase is confirmed`
    : "You're Pro now — welcome to PC Tweaker Pro";
}

const planLabelFor = (plan: string) =>
  plan === "lifetime" ? "Pro — Lifetime" : plan === "annual" ? "Pro — Annual" : "Pro — Monthly";

export function proWelcomeText({ product, firstName, email, plan, priceLabel, renewsOn }: ProWelcomeEmailInput): string {
  const brand = brandFor(product);
  return [
    `${brand.headline}, ${firstName || "there"}.`, "",
    renewsOn ? brand.intro : brand.introOneOff, "",
    "What you've unlocked:", ...brand.highlights.map((line) => `- ${line}`), "",
    `Plan: ${planLabelFor(plan)}`, `Price: ${priceLabel}`,
    renewsOn ? `Renews on: ${renewsOn}` : "Access: Never expires", "",
    `${brand.ctaLabel}: ${brand.visual.siteUrl}`, brand.signInHint.replace("{email}", email), "",
    renewsOn ? "Cancel anytime from your account settings." : "This purchase does not renew.",
    "Questions? Just reply to this email.",
  ].join("\n") + textFooter(brand.visual);
}

export function proWelcomeHtml({ product, firstName, email, plan, priceLabel, renewsOn }: ProWelcomeEmailInput): string {
  const brand = brandFor(product);
  const unlocked =
    divider() +
    row(
      sectionLabel("What you've unlocked") +
        listTable(brand.highlights.map((h) => bulletRow(brand.visual.accentText, escapeHtml(h))).join("\n")),
    );
  const receipt =
    divider() +
    row(
      sectionLabel("Your plan") +
        listTable(
          [
            detailRow("Plan", planLabelFor(plan)),
            detailRow("Price", priceLabel),
            detailRow(renewsOn ? "Renews on" : "Access", renewsOn ?? "Never expires"),
          ].join("\n"),
        ),
    );

  return emailShell({
    preheader: `Your payment went through and ${brand.name} is active on your account. Plan details inside.`,
    eyebrow: brand.eyebrow,
    headline: `${brand.headline}, ${firstName || "there"}.`,
    intro: renewsOn ? brand.intro : brand.introOneOff,
    bodyHtml: unlocked,
    action: { label: brand.ctaLabel, url: brand.visual.siteUrl },
    note: brand.signInHint.replace("{email}", email),
    // The receipt sits after the button, where a reader looks for it once
    // they have already been told what happened.
    afterActionHtml: receipt,
    footerNote: `${renewsOn ? "Cancel anytime from your account settings." : "This purchase does not renew."} Questions? Just reply to this email.`,
    brand: brand.visual,
  });
}

export type RefundEmailInput = {
  product?: string | null;
  firstName: string;
  plan: string | null;
  /** e.g. "€99.00"; null when Stripe gave no amount. */
  refundedLabel: string | null;
};

const PLAN_LABELS: Record<string, string> = {
  lifetime: "Pro — Lifetime", annual: "Pro — Annual", monthly: "Pro — Monthly",
};
const ACCESS_ENDED = "The Pro access that came with this payment has ended. Your account and the free features keep working.";
const STOP_RENEWAL = "If the subscription is still active, cancel it from your account settings so it does not renew.";
const MISTAKE = "If you think this is a mistake, just reply to this email and we'll look into it.";
// Digital purchases are not refundable: this notice reports a reversal Stripe
// told us about and never mentions, offers or implies a refund.
const reversedHeadline = (firstName: string) => firstName ? `Your payment was reversed, ${firstName}.` : "Your payment was reversed.";
const reversedIntro = (brand: ProductBrand, label: string | null) =>
  `${label ? `Your payment of ${label}` : "Your payment"} for ${brand.name} was reversed by your payment provider.`;

export function refundSubject(product?: string | null): string {
  return `Your ${brandFor(product).name} payment was reversed`;
}

/** Sent once per fully reversed (refunded) charge, after access has been removed. */
export function refundText({ product, firstName, plan, refundedLabel }: RefundEmailInput): string {
  const brand = brandFor(product);
  return [
    reversedHeadline(firstName), "",
    reversedIntro(brand, refundedLabel), "",
    ACCESS_ENDED,
    ...(plan === "monthly" || plan === "annual" ? ["", STOP_RENEWAL] : []), "",
    MISTAKE,
  ].join("\n") + textFooter(brand.visual);
}

export function refundHtml({ product, firstName, plan, refundedLabel }: RefundEmailInput): string {
  const brand = brandFor(product);
  const details =
    divider() +
    row(
      listTable(
        [
          refundedLabel ? detailRow("Amount reversed", refundedLabel) : "",
          plan && PLAN_LABELS[plan] ? detailRow("Plan", PLAN_LABELS[plan]) : "",
          detailRow("Pro access", "Ended"),
        ].filter(Boolean).join("\n"),
      ),
    ) +
    smallPrint(escapeHtml(plan === "monthly" || plan === "annual" ? `${ACCESS_ENDED} ${STOP_RENEWAL}` : ACCESS_ENDED));
  return emailShell({
    preheader: `${reversedIntro(brand, refundedLabel)} Here is what changes.`,
    eyebrow: "Payment reversed",
    headline: reversedHeadline(firstName),
    intro: reversedIntro(brand, refundedLabel),
    bodyHtml: details,
    footerNote: MISTAKE,
    brand: brand.visual,
  });
}
