/**
 * The shell every message from this backend is built in: the family email
 * design kit (email-design-kit/_base/layout.html), the same layout the Tweaky
 * Driver account service uses with its own brand. PC Tweaker and the
 * Uninstaller are dark brands: the dark-mode query pins their own colours so
 * a client cannot invert them into something unreadable.
 *
 * Content goes in through the block helpers below, never as hand-coloured
 * markup, so every email stays in the kit. Anything that came from a person
 * (name, address, subject line) is escaped by the helper that prints it, or
 * by the caller with `escapeHtml` before it is passed as markup.
 */

import { en } from "./copy/en";
import type { Copy } from "./copy";

export type EmailAction = {
  label: string;
  url: string;
};

export type EmailBrand = {
  /** Product name in the header, the footer and the title. */
  name: string;
  bg: string;
  card: string;
  panel: string;
  line: string;
  ink: string;
  muted: string;
  /** Top rule, button and step numbers. */
  accent: string;
  /** Text on the accent (button label, step numbers). */
  buttonText: string;
  /** Links and the eyebrow on the card. */
  accentText: string;
  /** Same as accentText for these dark brands; kept for list marks. */
  accentTextDark: string;
  display: string;
  body: string;
  googleFonts: string;
  siteUrl: string;
  siteLabel: string;
  privacyUrl: string;
  termsUrl: string;
  supportEmail: string;
  /** 96 px PNG served from the website, shown at 40 px. */
  logoUrl: string;
  /** Footer "Support" link; the family's support page when absent. */
  supportUrl?: string;
};

const FAMILY_SUPPORT = "https://pctweaker.app/support/";

const GRAPHITE = {
  bg: "#0a0a0d",
  card: "#121217",
  panel: "#1a1a21",
  line: "#2a2d33",
  ink: "#f3f4f6",
  muted: "#9ca3af",
  accent: "#ff6a3d",
  buttonText: "#0a0a0d",
  accentText: "#ff8a63",
  accentTextDark: "#ff8a63",
  display: "'Space Grotesk','Segoe UI',Arial,sans-serif",
  body: "Inter,'Segoe UI',Arial,sans-serif",
  googleFonts: "family=Inter:wght@400;600;700&family=Space+Grotesk:wght@600;700",
  privacyUrl: "https://pctweaker.app/privacy/",
  termsUrl: "https://pctweaker.app/terms/",
  supportEmail: "support@pctweaker.app",
};

export const EMAIL_BRANDS = {
  pctweaker: {
    ...GRAPHITE,
    name: "PC Tweaker",
    siteUrl: "https://pctweaker.app",
    siteLabel: "pctweaker.app",
    logoUrl: "https://pctweaker.app/email/pc-tweaker.png",
  },
  uninstaller: {
    ...GRAPHITE,
    name: "PC Tweaker Uninstaller",
    siteUrl: "https://pctweaker.app/uninstaller/",
    siteLabel: "pctweaker.app/uninstaller",
    logoUrl: "https://pctweaker.app/email/uninstaller.png",
  },
} satisfies Record<string, EmailBrand>;

/** Secondary text colour of both brands; AA on the card and on the panel. */
export const EMAIL_MUTED_TEXT = GRAPHITE.muted;
/** The surfaces and text colours the contrast test checks. These brands are
 *  dark in every client, so both names describe the same palette. */
export const EMAIL_LIGHT = { card: GRAPHITE.card, box: GRAPHITE.panel, text: GRAPHITE.ink, muted: GRAPHITE.muted } as const;
export const EMAIL_DARK = EMAIL_LIGHT;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Our own block markup as plain text for the text part. Splitting on "<"
 *  drops every tag and leaves no "<" at all; "&amp;" and "&quot;" are then
 *  decoded in a single pass so nothing is unescaped twice ("&lt;" stays). */
export function plainText(html: string): string {
  return html
    .split("<")
    .map((part, i) => (i === 0 ? part : part.slice(part.indexOf(">") + 1)))
    .join("")
    .replace(/&(amp|quot);/g, (_, name: string) => (name === "amp" ? "&" : '"'));
}

/** Blocks are rendered for one brand and language; the shell passes both down. */
export type Block = (brand: EmailBrand, c: Copy) => string;

const font = (b: EmailBrand) => `font-family:${b.body};`;

/** A body paragraph. `html` is trusted markup. */
export function paragraph(html: string): Block {
  return (b) => `<p class="ink" style="margin:0 0 18px;${font(b)}font-size:16px;line-height:25px;color:${b.ink};">${html}</p>`;
}

/** Small print tied to this email. `html` is trusted markup. */
export function note(html: string): Block {
  return (b) => `<p class="muted" style="margin:0 0 20px;${font(b)}font-size:13px;line-height:19px;color:${b.muted};">${html}</p>`;
}
/** The same block under the name the list mail uses. */
export const smallPrint = note;

/** Small uppercase heading over steps or a list. Plain text; escaped. */
export function sectionLabel(text: string): Block {
  return (b) => `<p class="muted" style="margin:0 0 10px;${font(b)}font-size:12px;line-height:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${b.muted};">${escapeHtml(text)}</p>`;
}

/** The label/value card: plan, amount, dates. Values are plain text; escaped. */
export function details(rows: [label: string, value: string][]): Block {
  return (b) => {
    const cells = rows
      .map(([label, value], i) => {
        const rule = i < rows.length - 1 ? `border-bottom:1px solid ${b.line};` : "";
        return `<tr>
                <td class="muted" width="38%" valign="top" style="padding:10px 12px 10px 0;${rule}${font(b)}font-size:13px;line-height:20px;color:${b.muted};">${escapeHtml(label)}</td>
                <td class="ink" valign="top" style="padding:10px 0;${rule}${font(b)}font-size:15px;line-height:20px;font-weight:700;color:${b.ink};word-break:break-word;">${escapeHtml(value)}</td>
              </tr>`;
      })
      .join("\n");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="panel" bgcolor="${b.panel}" style="background:${b.panel};border-radius:10px;margin:0 0 24px;">
          <tr><td style="padding:6px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${cells}
            </table>
          </td></tr>
        </table>`;
  };
}

/** The one button of an email, bulletproof in Outlook. */
export function button(action: EmailAction): Block {
  return (b) => {
    const url = escapeHtml(action.url);
    const label = escapeHtml(action.label);
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="margin:4px 0 24px;">
          <tr><td align="center" bgcolor="${b.accent}" style="border-radius:10px;background:${b.accent};">
            <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="21%" stroke="f" fillcolor="${b.accent}"><w:anchorlock/><center style="color:${b.buttonText};font-family:Arial,sans-serif;font-size:16px;font-weight:700;">${label}</center></v:roundrect><![endif]-->
            <!--[if !mso]><!--><a href="${url}" style="display:inline-block;padding:14px 28px;${font(b)}font-size:16px;line-height:20px;font-weight:700;color:${b.buttonText};text-decoration:none;border-radius:10px;background:${b.accent};">${label}</a><!--<![endif]-->
          </td></tr>
        </table>`;
  };
}

/** The address under a button that carries a token, so it can be read
 *  rather than trusted. */
export function linkFallback(url: string): Block {
  return (b, c) => {
    const safe = escapeHtml(url);
    return `<p class="muted" style="margin:-8px 0 24px;${font(b)}font-size:13px;line-height:19px;color:${b.muted};word-break:break-all;">${escapeHtml(c.shell.linkFallback)}<br><a href="${safe}" class="link" style="color:${b.accentText};">${safe}</a></p>`;
  };
}

/** Numbered steps: two to four things the reader can do. Items are trusted markup. */
export function steps(heading: string, items: string[]): Block {
  return (b, c) => {
    const rows = items
      .map(
        (item, i) => `<tr>
            <td width="24" valign="top" style="padding:1px 12px 12px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" width="24" height="24" bgcolor="${b.accent}" style="width:24px;height:24px;border-radius:12px;background:${b.accent};font-family:Arial,sans-serif;font-size:12px;line-height:24px;font-weight:700;color:${b.buttonText};">${i + 1}</td></tr></table></td>
            <td class="ink" valign="top" style="padding:0 0 12px;${font(b)}font-size:15px;line-height:22px;color:${b.ink};">${item}</td>
          </tr>`,
      )
      .join("\n");
    return `${sectionLabel(heading)(b, c)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
${rows}
        </table>`;
  };
}

/** "If this was you / if it was not", for security notices. Trusted markup. */
export function security(ifYou: string, ifNot: string): Block {
  return (b, c) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="panel" bgcolor="${b.panel}" style="background:${b.panel};border-radius:10px;margin:0 0 24px;">
          <tr><td style="padding:16px 18px;">
            <p class="ink" style="margin:0 0 8px;${font(b)}font-size:15px;line-height:22px;color:${b.ink};"><strong>${escapeHtml(c.shell.ifYou)}</strong> ${ifYou}</p>
            <p class="ink" style="margin:0;${font(b)}font-size:15px;line-height:22px;color:${b.ink};"><strong>${escapeHtml(c.shell.ifNot)}</strong> ${ifNot}</p>
          </td></tr>
        </table>`;
}

/** An underlined link in body text, in the brand's link colour. */
export function link(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" class="link" style="color:${GRAPHITE.accentText};text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/** A muted inline link, for unsubscribe lines. */
export function mutedLink(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" class="muted" style="color:${EMAIL_MUTED_TEXT};text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/** A plain key/value row, for callers that print one outside `details`. */
export function detailRow(label: string, value: string): string {
  return `<tr><td class="muted" style="padding:8px 12px 8px 0;font-size:13px;color:${EMAIL_MUTED_TEXT};">${escapeHtml(label)}</td><td class="ink" style="padding:8px 0;font-size:15px;font-weight:700;color:${GRAPHITE.ink};">${escapeHtml(value)}</td></tr>`;
}

export type EmailShellInput = {
  /** Inbox preview text: a sentence that adds to the subject. Escaped. */
  preheader: string;
  /** Small uppercase line above the headline, e.g. "Confirm your email". */
  eyebrow: string;
  headline: string;
  /** Paragraph under the headline: plain text, escaped. Or `introHtml`. */
  intro: string;
  introHtml?: string;
  blocks?: Block[];
  /** Help block inside the card: a question, and what to do (trusted
   *  markup). The support address, the reply expectation and the
   *  never-send-a-password line are appended. */
  help: { title: string; text: string; expectation?: string };
  /** Why the reader got this email, first footer line. Escaped. */
  why: string;
  /** Extra trusted markup after the "why" line, e.g. an unsubscribe link. */
  whyHtml?: string;
  brand?: EmailBrand;
  /** The reader's language; English when absent. */
  c?: Copy;
};

/** The plain-text help and footer every message ends with. */
export function textFooter(brand: EmailBrand = EMAIL_BRANDS.pctweaker, why = "", c: Copy = en): string {
  const s = c.shell;
  return [
    "\n",
    `${s.questions} ${s.writeTo(brand.supportEmail)} ${s.neverSend}`,
    "",
    "--",
    ...(why ? [why] : []),
    `${brand.name} · ${brand.siteUrl}`,
    ...(s.family ? [s.family] : []),
    `${s.support}: ${brand.supportUrl ?? FAMILY_SUPPORT} · ${s.privacy}: ${brand.privacyUrl} · ${s.terms}: ${brand.termsUrl}`,
  ].join("\n");
}

export function emailShell({
  preheader,
  eyebrow,
  headline,
  intro,
  introHtml,
  blocks = [],
  help,
  why,
  whyHtml = "",
  brand: b = EMAIL_BRANDS.pctweaker,
  c = en,
}: EmailShellInput): string {
  const support = escapeHtml(b.supportEmail);
  const s = c.shell;
  return `<!doctype html>
<html lang="${c.tag}" dir="ltr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<title>${escapeHtml(headline)} · ${escapeHtml(b.name)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
${b.googleFonts ? `<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?${b.googleFonts}&display=swap" rel="stylesheet"><!--<![endif]-->` : ""}
<style>
  body,table,td,p,a,li{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0;border-collapse:collapse}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;display:block}
  body{margin:0;padding:0;width:100%!important}
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
  @media only screen and (max-width:620px){
    .wrap{padding:16px 10px!important}
    .card-pad{padding:26px 20px 8px!important}
    .head{padding:18px 20px!important}
    .help{padding:18px 20px!important}
    .h1{font-size:24px!important;line-height:30px!important}
    .btn,.btn td,.btn a{width:100%!important;display:block!important;text-align:center!important;box-sizing:border-box!important}
  }
  @media (prefers-color-scheme: dark){
    .bg{background:${b.bg}!important}
    .card{background:${b.card}!important;border-color:${b.line}!important}
    .panel{background:${b.panel}!important}
    .ink{color:${b.ink}!important}
    .muted{color:${b.muted}!important}
    .link{color:${b.accentText}!important}
  }
  [data-ogsc] .bg{background:${b.bg}!important}
  [data-ogsc] .card{background:${b.card}!important;border-color:${b.line}!important}
  [data-ogsc] .panel{background:${b.panel}!important}
  [data-ogsc] .ink{color:${b.ink}!important}
  [data-ogsc] .muted{color:${b.muted}!important}
  [data-ogsc] .link{color:${b.accentText}!important}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${b.bg};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${b.bg};">${escapeHtml(preheader)}${"&#8199;&#847;".repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" bgcolor="${b.bg}" style="background:${b.bg};" lang="${c.tag}" dir="ltr">
<tr><td align="center" class="wrap" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:600px;margin:0 auto;">
  <tr><td class="card" bgcolor="${b.card}" style="background:${b.card};border:1px solid ${b.line};border-radius:14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="height:5px;font-size:0;line-height:0;background:${b.accent};border-radius:14px 14px 0 0;">&nbsp;</td></tr>
      <tr><td class="head" style="padding:20px 32px;border-bottom:1px solid ${b.line};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40" valign="middle" style="padding:0 12px 0 0;"><a href="${escapeHtml(b.siteUrl)}" style="text-decoration:none;"><img src="${escapeHtml(b.logoUrl)}" width="40" height="40" alt="${escapeHtml(b.name)}" style="display:block;width:40px;height:40px;border-radius:10px;"></a></td>
            <td valign="middle" style="font-family:${b.display};font-size:19px;line-height:24px;font-weight:700;letter-spacing:-0.2px;"><a href="${escapeHtml(b.siteUrl)}" class="ink" style="color:${b.ink};text-decoration:none;">${escapeHtml(b.name)}</a></td>
          </tr>
        </table>
      </td></tr>
      <tr><td class="card-pad" style="padding:32px 32px 8px;">
        <p style="margin:0 0 10px;${font(b)}font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${b.accentText};">${escapeHtml(eyebrow)}</p>
        <h1 class="h1 ink" style="margin:0 0 14px;font-family:${b.display};font-size:26px;line-height:32px;font-weight:700;letter-spacing:-0.4px;color:${b.ink};">${escapeHtml(headline)}</h1>
        <p class="ink" style="margin:0 0 22px;${font(b)}font-size:16px;line-height:25px;color:${b.ink};">${introHtml ?? escapeHtml(intro)}</p>
${blocks.map((block) => `        ${block(b, c)}`).join("\n")}
      </td></tr>
      <tr><td class="panel help" bgcolor="${b.panel}" style="background:${b.panel};padding:18px 32px;border-radius:0 0 14px 14px;">
        <p class="ink" style="margin:0 0 4px;${font(b)}font-size:14px;line-height:21px;font-weight:700;color:${b.ink};">${escapeHtml(help.title)}</p>
        <p class="muted" style="margin:0;${font(b)}font-size:14px;line-height:21px;color:${b.muted};">${help.text} ${s.writeTo(`<a href="mailto:${support}" class="link" style="color:${b.accentText};">${support}</a>`)} ${escapeHtml(help.expectation ?? s.expectation)} ${escapeHtml(s.neverSend)}</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:20px 8px 0;">
    <p class="muted" style="margin:0 0 6px;${font(b)}font-size:12px;line-height:18px;color:${b.muted};">${escapeHtml(why)}${whyHtml ? ` ${whyHtml}` : ""}</p>
    ${s.family ? `<p class="muted" style="margin:0 0 6px;${font(b)}font-size:12px;line-height:18px;color:${b.muted};">${escapeHtml(s.family)}</p>` : ""}
    <p class="muted" style="margin:0;${font(b)}font-size:12px;line-height:18px;color:${b.muted};">${escapeHtml(b.name)} &middot; <a href="${escapeHtml(b.siteUrl)}" class="link" style="color:${b.muted};">${escapeHtml(b.siteLabel)}</a> &middot; <a href="${escapeHtml(b.supportUrl ?? FAMILY_SUPPORT)}" class="link" style="color:${b.muted};">${escapeHtml(s.support)}</a> &middot; <a href="${escapeHtml(b.privacyUrl)}" class="link" style="color:${b.muted};">${escapeHtml(s.privacy)}</a> &middot; <a href="${escapeHtml(b.termsUrl)}" class="link" style="color:${b.muted};">${escapeHtml(s.terms)}</a></p>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
