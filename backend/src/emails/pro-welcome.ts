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
    logoUrl: "https://pctweaker.app/assets/favicon-CFvd5GJj.png",
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
    logoUrl: "https://pctweaker.app/assets/favicon-CFvd5GJj.png",
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
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(brand.name)}</title>
</head>
<body style="margin:0; padding:0; background:#050506; font-family:'Segoe UI', Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050506; padding:48px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#0a0a0c; border:1px solid #2a2d33; border-radius:20px; overflow:hidden;">

        <tr>
          <td style="background:radial-gradient(circle at 20% 0%, ${brand.accent}4d 0%, transparent 60%), #0a0a0c; padding:40px 40px 32px; text-align:center;">
            <img src="${brand.logoUrl}" width="56" height="56" alt="${escapeHtml(brand.name)}" style="border-radius:14px; display:block; margin:0 auto 18px;">
            <div style="font-size:15px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:${brand.accent};">${escapeHtml(brand.eyebrow)}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px; text-align:center;">
            <h1 style="margin:0; font-size:32px; line-height:1.25; font-weight:800; color:#f3f4f6; letter-spacing:-0.5px;">
              ${escapeHtml(brand.headline)}, ${name}.
            </h1>
            <p style="margin:16px 0 0; font-size:16px; line-height:1.6; color:#9ca3af;">
              ${renewsOn ? brand.intro : brand.introOneOff}
            </p>
          </td>
        </tr>

        <tr><td style="padding:32px 40px 0;"><div style="height:1px; background:#2a2d33;"></div></td></tr>

        <tr>
          <td style="padding:28px 40px 0;">
            <div style="font-size:13px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#5b5f66; margin-bottom:16px;">What you've unlocked</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0; color:#e5e7eb; font-size:15px; line-height:1.5;">
                  <span style="color:${brand.accent}; font-weight:700;">&rarr;</span>&nbsp; ${brand.highlights[0]}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0; color:#e5e7eb; font-size:15px; line-height:1.5;">
                  <span style="color:${brand.accent}; font-weight:700;">&rarr;</span>&nbsp; ${brand.highlights[1]}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0; color:#e5e7eb; font-size:15px; line-height:1.5;">
                  <span style="color:${brand.accent}; font-weight:700;">&rarr;</span>&nbsp; ${brand.highlights[2]}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px 8px; text-align:center;">
            <a href="${brand.siteUrl}" style="display:inline-block; background:${brand.accent}; color:#050506; font-size:16px; font-weight:800; text-decoration:none; padding:16px 36px; border-radius:12px; letter-spacing:-0.2px;">
              ${escapeHtml(brand.ctaLabel)}
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 40px 0; text-align:center;">
            <p style="margin:0; font-size:13px; color:#5b5f66;">${brand.signInHint.replace("{email}", escapeHtml(email))}</p>
          </td>
        </tr>

        <tr><td style="padding:32px 40px 0;"><div style="height:1px; background:#2a2d33;"></div></td></tr>
        <tr>
          <td style="padding:24px 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px; color:#5b5f66; padding:4px 0;">Plan</td>
                <td style="font-size:13px; color:#e5e7eb; padding:4px 0; text-align:right;">${escapeHtml(planLabel)}</td>
              </tr>
              <tr>
                <td style="font-size:13px; color:#5b5f66; padding:4px 0;">Price</td>
                <td style="font-size:13px; color:#e5e7eb; padding:4px 0; text-align:right;">${escapeHtml(priceLabel)}</td>
              </tr>
              <tr>
                <td style="font-size:13px; color:#5b5f66; padding:4px 0;">${renewsOn ? "Renews on" : "Access"}</td>
                <td style="font-size:13px; color:#e5e7eb; padding:4px 0; text-align:right;">${escapeHtml(renewsOn ?? "Never expires")}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px 40px; text-align:center;">
            <p style="margin:0; font-size:13px; color:#5b5f66; line-height:1.6;">
              ${renewsOn ? "Cancel anytime from your account settings." : "This purchase does not renew."} Questions? Just reply to this email.<br>
              ${escapeHtml(brand.name)} &middot; <a href="${brand.siteUrl}" style="color:#5b5f66;">pctweaker.app</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
