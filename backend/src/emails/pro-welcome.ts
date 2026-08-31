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

/** The per-product words and colours the shared layout is filled with. */
import { bulletRow, detailRow, emailShell } from "./layout";

export type ProductBrand = {
  /** Shown in the subject line and the footer, e.g. "PC Tweaker Pro". */
  name: string;
  accent: string;
  siteUrl: string;
  logoUrl: string;
  /** Small uppercase line above the headline, e.g. "Pro activated". */
  eyebrow: string;
  headline: string;
  intro: string;
  /** Used when the purchase does not renew. "Thanks for subscribing" is the
   *  wrong sentence to send someone who deliberately paid once so they would
   *  never have a subscription. */
  introOneOff: string;
  /** Three concrete things the payment just unlocked. Kept to three: a list
   *  long enough to scroll reads as marketing, not as a receipt. */
  highlights: [string, string, string];
  ctaLabel: string;
  signInHint: string;
};

export const PRODUCT_BRANDS: Record<string, ProductBrand> = {
  pctweaker: {
    name: "PC Tweaker Pro",
    accent: "#ff5500",
    siteUrl: "https://pctweaker.app",
    logoUrl: "https://pctweaker.app/logo.png",
    eyebrow: "Pro Activated",
    headline: "You're Pro now",
    intro:
      "Thanks for subscribing to PC Tweaker Pro. Your account is upgraded and every Pro tweak is unlocked — no extra setup needed.",
    introOneOff:
      "Thanks for buying PC Tweaker Pro. Your account is upgraded for good and every Pro tweak is unlocked — no extra setup needed.",
    highlights: [
      "All 50 tweaks, including Turbo Gaming &amp; Game Sessions",
      "Duplicate &amp; large file finders, drive optimization",
      "Disable Recall &amp; Memory Integrity, classic right-click menu",
    ],
    ctaLabel: "Open PC Tweaker",
    signInHint: "Sign in with {email} to see your Pro tweaks.",
  },
  uninstaller: {
    name: "PC Tweaker Uninstaller Pro",
    accent: "#ff5500",
    siteUrl: "https://pctweaker.app/uninstaller",
    logoUrl: "https://pctweaker.app/logo.png",
    eyebrow: "Pro Activated",
    headline: "Uninstaller Pro is yours",
    intro:
      "Thanks for subscribing to Uninstaller Pro. Your account is upgraded — the deep scan and everything behind it is unlocked, with no extra setup needed.",
    introOneOff:
      "Thanks for buying Uninstaller Pro. Your account is upgraded — the deep scan and everything behind it is unlocked, with no extra setup needed.",
    highlights: [
      "Deep scan for the files and registry keys an uninstaller leaves behind",
      "Bulk removal, so a queue of programs goes in one pass",
      "Removal reports, and a record of what was taken off the machine",
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function brandFor(product: string | null | undefined): ProductBrand {
  return PRODUCT_BRANDS[product ?? ""] ?? PRODUCT_BRANDS.pctweaker;
}

export function proWelcomeSubject(product?: string | null): string {
  const brand = brandFor(product);
  return product === "uninstaller"
    ? `Your ${brand.name} purchase is confirmed`
    : "You're Pro now — welcome to PC Tweaker Pro";
}

export function proWelcomeHtml({ product, firstName, email, plan, priceLabel, renewsOn }: ProWelcomeEmailInput): string {
  const brand = brandFor(product);
  const name = escapeHtml(firstName || "there");
  const planLabel =
    plan === "lifetime"
      ? "Pro — Lifetime"
      : plan === "annual"
        ? "Pro — Annual"
        : "Pro — Monthly";

  const body = `
        <tr><td style="padding:32px 40px 0;"><div style="height:1px; background:#2a2d33;"></div></td></tr>

        <tr>
          <td style="padding:28px 40px 0;">
            <div style="font-size:13px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#5b5f66; margin-bottom:16px;">What you've unlocked</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${brand.highlights.map((h) => bulletRow(brand.accent, h)).join("\n")}
            </table>
          </td>
        </tr>`;

  const receipt = `
        <tr><td style="padding:32px 40px 0;"><div style="height:1px; background:#2a2d33;"></div></td></tr>
        <tr>
          <td style="padding:24px 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${detailRow("Plan", planLabel)}
${detailRow("Price", priceLabel)}
${detailRow(renewsOn ? "Renews on" : "Access", renewsOn ?? "Never expires")}
            </table>
          </td>
        </tr>`;

  return emailShell({
    eyebrow: brand.eyebrow,
    headline: `${brand.headline}, ${firstName || "there"}.`,
    intro: renewsOn ? brand.intro : brand.introOneOff,
    bodyHtml: body,
    action: { label: brand.ctaLabel, url: brand.siteUrl },
    note: brand.signInHint.replace("{email}", email),
    // The receipt sits after the button, where a reader looks for it once
    // they have already been told what happened.
    afterActionHtml: receipt,
    footerNote: `${renewsOn ? "Cancel anytime from your account settings." : "This purchase does not renew."} Questions? Just reply to this email.`,
    accent: brand.accent,
    productName: brand.name,
    siteUrl: brand.siteUrl,
    logoUrl: brand.logoUrl,
  });
}

// `name` is escaped by emailShell now; the local binding is kept out of the
// template to avoid escaping twice.
void escapeHtml;
