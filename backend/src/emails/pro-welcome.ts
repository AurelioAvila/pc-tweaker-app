/**
 * "Welcome to Pro" confirmation email. Nothing sends this automatically yet
 * (see stripe.ts) — it exists because a paying customer currently gets zero
 * communication from us beyond Stripe's own receipt.
 */

export type ProWelcomeEmailInput = {
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

export function proWelcomeSubject(): string {
  return "You're Pro now — welcome to PC Tweaker Pro";
}

export function proWelcomeHtml({ firstName, email, plan, priceLabel, renewsOn }: ProWelcomeEmailInput): string {
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
<title>Welcome to PC Tweaker Pro</title>
</head>
<body style="margin:0; padding:0; background:#050506; font-family:'Segoe UI', Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050506; padding:48px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#0a0a0c; border:1px solid #2a2d33; border-radius:20px; overflow:hidden;">

        <tr>
          <td style="background:radial-gradient(circle at 20% 0%, rgba(255,85,0,0.30) 0%, transparent 60%), #0a0a0c; padding:40px 40px 32px; text-align:center;">
            <img src="https://pctweaker.app/assets/favicon-CFvd5GJj.png" width="56" height="56" alt="PC Tweaker" style="border-radius:14px; display:block; margin:0 auto 18px;">
            <div style="font-size:15px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#ff5500;">Pro Activated</div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px; text-align:center;">
            <h1 style="margin:0; font-size:32px; line-height:1.25; font-weight:800; color:#f3f4f6; letter-spacing:-0.5px;">
              You're Pro now, ${name}.
            </h1>
            <p style="margin:16px 0 0; font-size:16px; line-height:1.6; color:#9ca3af;">
              Thanks for subscribing to PC Tweaker Pro. Your account is upgraded and every Pro tweak is unlocked — no extra setup needed.
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
                  <span style="color:#ff5500; font-weight:700;">&rarr;</span>&nbsp; All 50 tweaks, including Turbo Gaming &amp; Game Sessions
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0; color:#e5e7eb; font-size:15px; line-height:1.5;">
                  <span style="color:#ff5500; font-weight:700;">&rarr;</span>&nbsp; Duplicate &amp; large file finders, drive optimization
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0; color:#e5e7eb; font-size:15px; line-height:1.5;">
                  <span style="color:#ff5500; font-weight:700;">&rarr;</span>&nbsp; Disable Recall &amp; Memory Integrity, classic right-click menu
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px 8px; text-align:center;">
            <a href="https://pctweaker.app" style="display:inline-block; background:#ff5500; color:#050506; font-size:16px; font-weight:800; text-decoration:none; padding:16px 36px; border-radius:12px; letter-spacing:-0.2px;">
              Open PC Tweaker
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 40px 0; text-align:center;">
            <p style="margin:0; font-size:13px; color:#5b5f66;">Sign in with ${escapeHtml(email)} to see your Pro tweaks.</p>
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
              Cancel anytime from your account settings. Questions? Just reply to this email.<br>
              PC Tweaker &middot; <a href="https://pctweaker.app" style="color:#5b5f66;">pctweaker.app</a>
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
