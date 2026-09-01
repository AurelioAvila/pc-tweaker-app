/**
 * The messages an account produces before anyone has paid anything.
 *
 * Two of them — confirm your address, reset your password — used to be a
 * single line of HTML with a bare link. They are the first things a new
 * customer sees, and they looked like a script had sent them.
 *
 * Both deliberately show the destination as text as well as behind the
 * button. A link the reader can see before clicking is the difference between
 * a mail that looks legitimate and one that looks like phishing, and these
 * are exactly the two messages phishing imitates.
 *
 * The fourth, the password-changed notice, follows the same reasoning to the
 * opposite conclusion: it carries no token and no link that could change
 * anything, because it is the one message whose reader may not be the person
 * who acted.
 */

import { bulletRow, emailShell } from "./layout";

const ACCENT = "#ff5500";

/** The URL under the button, shown so it can be read rather than trusted. */
function linkFallback(link: string): string {
  return `
        <tr>
          <td style="padding:24px 40px 0; text-align:center;">
            <p style="margin:0; font-size:12px; line-height:1.6; color:#5b5f66; word-break:break-all;">
              Or paste this into your browser:<br>${link.replace(/&/g, "&amp;").replace(/</g, "&lt;")}
            </p>
          </td>
        </tr>`;
}

export function verificationSubject(): string {
  return "Confirm your email for PC Tweaker";
}

export function verificationHtml(firstName: string, link: string): string {
  const name = (firstName || "").trim().split(/\s+/)[0];
  return emailShell({
    eyebrow: "Confirm your email",
    headline: name ? `One step left, ${name}.` : "One step left.",
    intro:
      "Confirm this address and your PC Tweaker account is ready. It is what lets you sign in on another PC and keeps your licence attached to you rather than to one machine.",
    action: { label: "Confirm my email", url: link },
    afterActionHtml: linkFallback(link),
    note: "The link works for 24 hours.",
    footerNote: "If you did not create a PC Tweaker account, ignore this message and nothing happens.",
    accent: ACCENT,
  });
}

export function passwordResetSubject(): string {
  return "Reset your PC Tweaker password";
}

export function passwordResetHtml(link: string): string {
  return emailShell({
    eyebrow: "Password reset",
    headline: "Choose a new password.",
    intro: "Use the button below to set a new password for your PC Tweaker account.",
    action: { label: "Set a new password", url: link },
    afterActionHtml: linkFallback(link),
    note: "The link works for one hour, and only once.",
    footerNote:
      "If you did not ask for this, ignore the message — your password stays exactly as it is.",
    accent: ACCENT,
  });
}

export function passwordChangedSubject(): string {
  return "Your PC Tweaker password was changed";
}

/**
 * Sent after a password has actually changed, never before.
 *
 * This is the only way an account takeover becomes visible to the person who
 * owns the account, so it is the one message here whose reader may not be the
 * person who acted. That is why it carries no reset token and no "this wasn't
 * me" button: by the time it arrives the new password is already set, and a
 * one-click link on the message a worried reader is most likely to click is
 * exactly the shape an attacker would forge. The button goes to the support
 * page, which is a place, not an action.
 *
 * `when` is passed in rather than read here, so the email quotes the moment
 * the password actually changed rather than the moment it was rendered.
 */
export function passwordChangedHtml(firstName: string, when: string): string {
  const name = (firstName || "").trim().split(/\s+/)[0];
  const body = `
        <tr>
          <td style="padding:28px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f12; border:1px solid #2a2d33; border-radius:12px;">
              <tr>
                <td style="padding:18px; color:#9ca3af; font-size:15px; line-height:1.6;">
                  If this was you, there is nothing else to do.<br>
                  If it was not, someone else set that password. Ask for a new
                  reset link from the app right away, choose a password you use
                  nowhere else, and get in touch with us.
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
  return emailShell({
    eyebrow: "Security notice",
    headline: name ? `Your password was changed, ${name}.` : "Your password was changed.",
    intro: `The password on your PC Tweaker account was changed on ${when}. Every device that was signed in has been signed out.`,
    bodyHtml: body,
    action: { label: "Contact support", url: "https://pctweaker.app/support" },
    note: "We will never ask you for your password by email.",
    footerNote:
      "This notice is sent every time the password changes and cannot be turned off.",
    accent: ACCENT,
  });
}

export function accountWelcomeSubject(): string {
  return "Your PC Tweaker account is ready";
}

/**
 * Sent once the address is confirmed, not at registration.
 *
 * At registration the person already has an email from us asking them to
 * confirm, and two messages arriving together makes the one that needs acting
 * on easier to miss. This one also has something the other cannot have: an
 * account that actually works.
 */
export function accountWelcomeHtml(firstName: string, freeTweakCount: number): string {
  const name = (firstName || "").trim().split(/\s+/)[0];
  const body = `
        <tr><td style="padding:32px 40px 0;"><div style="height:1px; background:#2a2d33;"></div></td></tr>

        <tr>
          <td style="padding:28px 40px 0;">
            <div style="font-size:13px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#5b5f66; margin-bottom:16px;">Yours without paying anything</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${bulletRow(ACCENT, `${freeTweakCount} tweaks, each backed up before it is applied and revertible in one click`)}
${bulletRow(ACCENT, "Live monitoring of processor, memory and disk")}
${bulletRow(ACCENT, "Startup manager, temporary file cleanup and a password breach check")}
            </table>
          </td>
        </tr>`;
  return emailShell({
    eyebrow: "Account ready",
    headline: name ? `You're in, ${name}.` : "You're in.",
    intro:
      "Your email is confirmed and the account is active. Sign in from the app and everything below is already yours.",
    bodyHtml: body,
    action: { label: "Open PC Tweaker", url: "https://pctweaker.app" },
    footerNote: "Questions? Just reply to this email.",
    accent: ACCENT,
  });
}
