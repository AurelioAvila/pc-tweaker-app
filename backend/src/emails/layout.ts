/**
 * The shell every message from this backend is built in, and the one the
 * Tweaky Driver account service mirrors: PC Tweaker, PC Tweaker Uninstaller
 * and Tweaky Driver share one account, so a customer of two of them should
 * see one family of emails, not three visual languages.
 *
 * Light first, because that is what renders the same in every client,
 * Outlook for Windows included. Clients that honour `prefers-color-scheme`
 * (Apple Mail, iOS, Outlook.com) get a matching dark version from the classes
 * below; Gmail inverts the light version on its own. Every colour pair is
 * checked for WCAG AA in test/email-contrast.test.mjs.
 *
 * Content goes in through the helpers at the bottom of this file, never as
 * hand-coloured markup, so a new email cannot drift from the palette.
 */

export type EmailAction = {
  label: string;
  url: string;
};

export type EmailBrand = {
  /** Product name next to the logo and in the footer. */
  name: string;
  /** Top bar and button. */
  accent: string;
  /** Button label colour, chosen for AA contrast on `accent`. */
  buttonText: string;
  /** Eyebrow and links on the light card, and on the dark one. */
  accentText: string;
  accentTextDark: string;
  siteUrl: string;
  siteLabel: string;
  /** 96 px PNG served from the website, shown at 48 px. */
  logoUrl: string;
};

export const EMAIL_BRANDS = {
  pctweaker: {
    name: "PC Tweaker",
    accent: "#ff5500",
    buttonText: "#111111",
    accentText: "#c2410c",
    accentTextDark: "#ff8a4c",
    siteUrl: "https://pctweaker.app",
    siteLabel: "pctweaker.app",
    logoUrl: "https://pctweaker.app/email/pc-tweaker.png",
  },
  uninstaller: {
    name: "PC Tweaker Uninstaller",
    accent: "#7c3aed",
    buttonText: "#ffffff",
    accentText: "#6d28d9",
    accentTextDark: "#b69cff",
    siteUrl: "https://pctweaker.app/uninstaller",
    siteLabel: "pctweaker.app/uninstaller",
    logoUrl: "https://pctweaker.app/email/uninstaller.png",
  },
} satisfies Record<string, EmailBrand>;

export type EmailShellInput = {
  /** Inbox preview text shown after the subject. Required so no message
   *  falls back to whatever text the client scrapes first. Plain text; it is
   *  escaped. */
  preheader: string;
  /** Small uppercase line above the headline, e.g. "Confirm your email". */
  eyebrow: string;
  headline: string;
  /** Sentence under the headline. Plain text; it is escaped. */
  intro: string;
  /** Rows built with the helpers below, between the intro and the button. */
  bodyHtml?: string;
  action?: EmailAction;
  /** Rows placed after the button — the purchase receipt sits here, where a
   *  reader looks for it once they have been told what happened. */
  afterActionHtml?: string;
  /** Small print under the button. Plain text; it is escaped. */
  note?: string;
  /** Why this message was sent, first line of the footer. Plain text. */
  footerNote?: string;
  brand?: EmailBrand;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Light palette (inline, the default everywhere) and its dark counterpart
// (applied by class where the client supports it).
const PAGE = "#f3f4f6";
const CARD = "#ffffff";
const LINE = "#e5e7eb";
const BOX = "#f9fafb";
const HEADING = "#111827";
const TEXT = "#374151";
/** Secondary text; AA on the card and on boxes. */
export const EMAIL_MUTED_TEXT = "#6b7280";
export const EMAIL_DARK = {
  page: "#0b0c0f",
  card: "#16181d",
  line: "#2a2e36",
  box: "#1d2027",
  heading: "#f3f4f6",
  text: "#d1d5db",
  muted: "#9ca3af",
} as const;
export const EMAIL_LIGHT = { page: PAGE, card: CARD, line: LINE, box: BOX, heading: HEADING, text: TEXT, muted: EMAIL_MUTED_TEXT } as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const PAD = 40;

/** One content row of the card. `html` is trusted markup from the helpers. */
export function row(html: string, top = 24): string {
  return `
        <tr>
          <td class="fx-pad" style="padding:${top}px ${PAD}px 0;">${html}</td>
        </tr>`;
}

export function divider(top = 28): string {
  return row(`<div class="fx-rule" style="height:1px; line-height:1px; font-size:1px; background:${LINE};">&nbsp;</div>`, top);
}

/** Small uppercase heading for a list or a receipt. Plain text; escaped. */
export function sectionLabel(text: string): string {
  return `<div class="fx-m" style="font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${EMAIL_MUTED_TEXT}; margin:0 0 12px;">${escapeHtml(text)}</div>`;
}

/** A muted paragraph. `html` is trusted markup (links built by the caller). */
export function smallPrint(html: string, top = 20): string {
  return row(`<p class="fx-m" style="margin:0; font-size:13px; line-height:1.6; color:${EMAIL_MUTED_TEXT};">${html}</p>`, top);
}

/** A tinted panel for the one paragraph a reader must not skim past. */
export function infoBox(html: string, top = 24): string {
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="fx-box" style="background:${BOX}; border:1px solid ${LINE}; border-radius:12px;">
              <tr><td class="fx-t" style="padding:16px 18px; font-size:15px; line-height:1.6; color:${TEXT};">${html}</td></tr>
            </table>`,
    top,
  );
}

/** A muted inline link. */
export function mutedLink(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" class="fx-m" style="color:${EMAIL_MUTED_TEXT}; text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/** The URL under a button, shown so it can be read rather than trusted. */
export function linkFallback(url: string): string {
  return smallPrint(
    `Or paste this into your browser:<br><span style="word-break:break-all;">${escapeHtml(url)}</span>`,
  );
}

/** A list line with the brand's accent mark. `text` is trusted markup. */
export function bulletRow(accent: string, text: string): string {
  return `              <tr>
                <td width="22" valign="top" style="padding:7px 0; font-size:15px; line-height:1.5; color:${accent}; font-weight:700;">&#10003;</td>
                <td class="fx-t" style="padding:7px 0; color:${TEXT}; font-size:15px; line-height:1.5;">${text}</td>
              </tr>`;
}

/** A two-column key/value row, for the receipt block. */
export function detailRow(label: string, value: string): string {
  return `              <tr>
                <td class="fx-m" style="font-size:14px; color:${EMAIL_MUTED_TEXT}; padding:6px 0;">${escapeHtml(label)}</td>
                <td class="fx-h" style="font-size:14px; color:${HEADING}; padding:6px 0; text-align:right; font-weight:600;">${escapeHtml(value)}</td>
              </tr>`;
}

/** A list or a receipt: rows from bulletRow/detailRow inside one table. */
export function listTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows}
            </table>`;
}

/** The lines every message ends with, for the plain-text part. */
export function textFooter(brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return [
    "",
    "--",
    `${brand.name} · ${brand.siteUrl}`,
    "One account for PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver.",
    "Support: https://pctweaker.app/support · Privacy: https://pctweaker.app/privacy",
  ].join("\n");
}

export function emailShell({
  preheader,
  eyebrow,
  headline,
  intro,
  bodyHtml = "",
  action,
  afterActionHtml = "",
  note,
  footerNote,
  brand = EMAIL_BRANDS.pctweaker,
}: EmailShellInput): string {
  const D = EMAIL_DARK;
  const button = action
    ? row(
        `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td bgcolor="${brand.accent}" style="border-radius:10px; background:${brand.accent};">
                <a href="${escapeHtml(action.url)}" style="display:inline-block; padding:14px 28px; font-family:${FONT}; font-size:16px; font-weight:700; line-height:1.2; color:${brand.buttonText}; text-decoration:none; border-radius:10px;">${escapeHtml(action.label)}</a>
              </td>
            </tr></table>`,
        28,
      )
    : "";
  const noteRow = note
    ? `
        <tr>
          <td class="fx-pad" style="padding:${action ? 14 : 24}px ${PAD}px 0;">
            <p class="fx-m" style="margin:0; font-size:13px; color:${EMAIL_MUTED_TEXT}; line-height:1.6;">${escapeHtml(note)}</p>
          </td>
        </tr>`
    : "";
  const footerLink = (url: string, label: string) =>
    `<a href="${url}" class="fx-m" style="color:${EMAIL_MUTED_TEXT}; text-decoration:underline;">${label}</a>`;

  return `<!doctype html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(headline)} · ${escapeHtml(brand.name)}</title>
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { text-decoration-skip-ink:auto; }
  @media only screen and (max-width:620px) {
    .fx-pad { padding-left:24px !important; padding-right:24px !important; }
    .fx-h1 { font-size:24px !important; }
    .fx-outer { padding:16px 8px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .fx-bg { background:${D.page} !important; }
    .fx-card { background:${D.card} !important; border-color:${D.line} !important; }
    .fx-box { background:${D.box} !important; border-color:${D.line} !important; }
    .fx-rule { background:${D.line} !important; }
    .fx-h { color:${D.heading} !important; }
    .fx-t { color:${D.text} !important; }
    .fx-m { color:${D.muted} !important; }
    .fx-acc { color:${brand.accentTextDark} !important; }
  }
  [data-ogsc] .fx-h { color:${D.heading} !important; }
  [data-ogsc] .fx-t { color:${D.text} !important; }
  [data-ogsc] .fx-m { color:${D.muted} !important; }
  [data-ogsc] .fx-acc { color:${brand.accentTextDark} !important; }
  [data-ogsb] .fx-bg { background:${D.page} !important; }
  [data-ogsb] .fx-card { background:${D.card} !important; }
  [data-ogsb] .fx-box { background:${D.box} !important; }
</style>
</head>
<body class="fx-bg" style="margin:0; padding:0; background:${PAGE}; font-family:${FONT};">
<div style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; mso-hide:all; font-size:1px; line-height:1px; color:${PAGE};">${escapeHtml(preheader)}${"&#8199;&#847;".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="fx-bg" bgcolor="${PAGE}" style="background:${PAGE};">
  <tr>
    <td align="center" class="fx-outer" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table lang="en" dir="ltr" role="presentation" width="100%" cellpadding="0" cellspacing="0" class="fx-card" bgcolor="${CARD}" style="max-width:600px; width:100%; background:${CARD}; border:1px solid ${LINE}; border-radius:16px; overflow:hidden; font-family:${FONT};">
        <tr><td height="4" bgcolor="${brand.accent}" style="height:4px; line-height:4px; font-size:4px; background:${brand.accent};">&nbsp;</td></tr>
        <tr>
          <td class="fx-pad" style="padding:28px ${PAD}px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td width="40" valign="middle"><img src="${escapeHtml(brand.logoUrl)}" width="40" height="40" alt="" style="display:block; border:0; border-radius:10px;"></td>
              <td valign="middle" class="fx-h" style="padding-left:12px; font-size:16px; font-weight:700; color:${HEADING}; letter-spacing:-0.1px;">${escapeHtml(brand.name)}</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td class="fx-pad" style="padding:32px ${PAD}px 0;">
            <div class="fx-acc" style="font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:${brand.accentText};">${escapeHtml(eyebrow)}</div>
            <h1 class="fx-h fx-h1" style="margin:10px 0 0; font-size:28px; line-height:1.25; font-weight:800; color:${HEADING}; letter-spacing:-0.4px;">${escapeHtml(headline)}</h1>
            <p class="fx-t" style="margin:14px 0 0; font-size:16px; line-height:1.65; color:${TEXT};">${escapeHtml(intro)}</p>
          </td>
        </tr>
${bodyHtml}${button}${noteRow}${afterActionHtml}
        <tr><td style="padding:0 0 40px;">&nbsp;</td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
        <tr>
          <td class="fx-pad" style="padding:24px ${PAD}px 0; font-family:${FONT};">
            <p class="fx-m" style="margin:0; font-size:12px; line-height:1.7; color:${EMAIL_MUTED_TEXT};">
              ${footerNote ? `${escapeHtml(footerNote)}<br>` : ""}One account for PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver.<br>
              ${footerLink("https://pctweaker.app/support", "Support")} &nbsp;&middot;&nbsp; ${footerLink("https://pctweaker.app/privacy", "Privacy")} &nbsp;&middot;&nbsp; ${footerLink(escapeHtml(brand.siteUrl), escapeHtml(brand.siteLabel))}
            </p>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}
