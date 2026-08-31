/**
 * The shell every message from this backend is built in.
 *
 * It was extracted from the Pro welcome, which was the only email that had
 * been designed. The others — verify your address, reset your password — were
 * a single line of HTML each, and those two are the *first* messages a new
 * customer ever receives: they set the impression long before anyone reaches
 * a purchase confirmation. Having one polished email and two bare ones is not
 * a small inconsistency, it is the wrong one being polished.
 *
 * Extracted rather than copied, so the next email cannot drift into being a
 * third visual language.
 */

export type EmailAction = {
  label: string;
  url: string;
};

export type EmailShellInput = {
  /** Small uppercase line above the headline, e.g. "Confirm your email". */
  eyebrow: string;
  headline: string;
  /** Sentence under the headline. Plain text; it is escaped. */
  intro: string;
  /** Optional pre-built markup between the intro and the button. */
  bodyHtml?: string;
  action?: EmailAction;
  /** Markup placed after the button — the purchase receipt sits here, where a
   *  reader looks for it once they have been told what happened. */
  afterActionHtml?: string;
  /** Small print under the button. Plain text; it is escaped. */
  note?: string;
  /** Closing line above the signature. Plain text; it is escaped. */
  footerNote?: string;
  accent?: string;
  productName?: string;
  siteUrl?: string;
  logoUrl?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DEFAULT_ACCENT = "#ff5500";
const DEFAULT_PRODUCT = "PC Tweaker";
const DEFAULT_SITE = "https://pctweaker.app";
const DEFAULT_LOGO = "https://pctweaker.app/assets/favicon-CFvd5GJj.png";

/** A row of text with the accent arrow, for lists inside `bodyHtml`. */
export function bulletRow(accent: string, text: string): string {
  return `              <tr>
                <td style="padding:10px 0; color:#e5e7eb; font-size:15px; line-height:1.5;">
                  <span style="color:${accent}; font-weight:700;">&rarr;</span>&nbsp; ${text}
                </td>
              </tr>`;
}

/** A two-column key/value row, for the receipt block. */
export function detailRow(label: string, value: string): string {
  return `              <tr>
                <td style="font-size:13px; color:#5b5f66; padding:4px 0;">${escapeHtml(label)}</td>
                <td style="font-size:13px; color:#e5e7eb; padding:4px 0; text-align:right;">${escapeHtml(value)}</td>
              </tr>`;
}

export function emailShell({
  eyebrow,
  headline,
  intro,
  bodyHtml = "",
  action,
  afterActionHtml = "",
  note,
  footerNote,
  accent = DEFAULT_ACCENT,
  productName = DEFAULT_PRODUCT,
  siteUrl = DEFAULT_SITE,
  logoUrl = DEFAULT_LOGO,
}: EmailShellInput): string {
  const button = action
    ? `
        <tr>
          <td style="padding:32px 40px 8px; text-align:center;">
            <a href="${escapeHtml(action.url)}" style="display:inline-block; background:${accent}; color:#050506; font-size:16px; font-weight:800; text-decoration:none; padding:16px 36px; border-radius:12px; letter-spacing:-0.2px;">
              ${escapeHtml(action.label)}
            </a>
          </td>
        </tr>`
    : "";
  const noteRow = note
    ? `
        <tr>
          <td style="padding:8px 40px 0; text-align:center;">
            <p style="margin:0; font-size:13px; color:#5b5f66;">${escapeHtml(note)}</p>
          </td>
        </tr>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(productName)}</title>
</head>
<body style="margin:0; padding:0; background:#050506; font-family:'Segoe UI', Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050506; padding:48px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#0a0a0c; border:1px solid #2a2d33; border-radius:20px; overflow:hidden;">

        <tr>
          <td style="background:radial-gradient(circle at 20% 0%, ${accent}4d 0%, transparent 60%), #0a0a0c; padding:40px 40px 32px; text-align:center;">
            <img src="${escapeHtml(logoUrl)}" width="56" height="56" alt="${escapeHtml(productName)}" style="border-radius:14px; display:block; margin:0 auto 18px;">
            <div style="font-size:15px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:${accent};">${escapeHtml(eyebrow)}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px; text-align:center;">
            <h1 style="margin:0; font-size:32px; line-height:1.25; font-weight:800; color:#f3f4f6; letter-spacing:-0.5px;">
              ${escapeHtml(headline)}
            </h1>
            <p style="margin:16px 0 0; font-size:16px; line-height:1.6; color:#9ca3af;">
              ${escapeHtml(intro)}
            </p>
          </td>
        </tr>
${bodyHtml}${button}${noteRow}${afterActionHtml}
        <tr>
          <td style="padding:32px 40px 40px; text-align:center;">
            <p style="margin:0; font-size:13px; color:#5b5f66; line-height:1.6;">
              ${footerNote ? `${escapeHtml(footerNote)}<br>` : ""}
              ${escapeHtml(productName)} &middot; <a href="${escapeHtml(siteUrl)}" style="color:#5b5f66;">pctweaker.app</a>
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
