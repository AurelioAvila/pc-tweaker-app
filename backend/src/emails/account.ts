/**
 * The messages an account produces before anyone has paid anything.
 *
 * The account is shared by PC Tweaker, PC Tweaker Uninstaller and Tweaky
 * Driver, so these messages are branded for the app the person signed up in
 * (`brand`) and say once, in the footer, that the same account works in all
 * three. PC Tweaker is the default: it is where most accounts start.
 *
 * Confirm and reset deliberately show the destination as text as well as
 * behind the button. A link the reader can see before clicking is the
 * difference between a mail that looks legitimate and one that looks like
 * phishing, and these are exactly the two messages phishing imitates.
 *
 * The password-changed notice follows the same reasoning to the opposite
 * conclusion: it carries no token and no link that could change anything,
 * because it is the one message whose reader may not be the person who acted.
 */

import {
  EMAIL_BRANDS,
  bulletRow,
  divider,
  emailShell,
  infoBox,
  linkFallback,
  listTable,
  row,
  sectionLabel,
  textFooter,
  type EmailBrand,
} from "./layout";

const firstWord = (value: string) => (value || "").trim().split(/\s+/)[0];

export function verificationText(link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Confirm your email for ${brand.name}\n\nConfirm this address to activate your account:\n${link}\n\nThis link expires in 24 hours. If you did not create this account, ignore this message.${textFooter(brand)}`;
}

export function passwordResetText(link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Reset your ${brand.name} password\n\nChoose a new password:\n${link}\n\nThis link works once and expires in one hour. If you did not request this, ignore this message. Your password stays unchanged.${textFooter(brand)}`;
}

export function passwordChangedText(when: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Your ${brand.name} password was changed on ${when}. Every device that was signed in has been signed out, in PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver.\n\nIf this was not you, request a new reset link from the app immediately and contact support: https://pctweaker.app/support\n\nWe will never ask you for your password by email.${textFooter(brand)}`;
}

export function accountWelcomeText(freeTweakCount: number, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  const included =
    brand === EMAIL_BRANDS.uninstaller
      ? "Your free account includes the full program inventory, a confidence score and removal brief before every uninstall, single uninstalls, and the leftover scan with its Removal Ledger."
      : `Your free account includes ${freeTweakCount} tweaks, live processor, memory and disk monitoring, a startup manager, temporary file cleanup and a password breach check.`;
  return `Your ${brand.name} account is ready\n\nYour email is confirmed. Sign in from the app to get started.\n\n${included}\n\nOpen ${brand.name}: ${brand.siteUrl}${textFooter(brand)}`;
}

export function verificationSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Confirm your email for ${brand.name}`;
}

export function verificationHtml(firstName: string, link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  const name = firstWord(firstName);
  return emailShell({
    preheader: `Confirm this address to activate your ${brand.name} account. The link works for 24 hours.`,
    eyebrow: "Confirm your email",
    headline: name ? `One step left, ${name}.` : "One step left.",
    intro: `Confirm this address and your ${brand.name} account is ready. It lets you sign in on another PC and keeps your plan attached to you rather than to one machine.`,
    action: { label: "Confirm my email", url: link },
    afterActionHtml: linkFallback(link),
    note: "The link works for 24 hours.",
    footerNote: `If you did not create a ${brand.name} account, ignore this message and nothing happens.`,
    brand,
  });
}

export function passwordResetSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Reset your ${brand.name} password`;
}

export function passwordResetHtml(link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return emailShell({
    preheader: "Set a new password with the link inside. It works once, for one hour.",
    eyebrow: "Password reset",
    headline: "Choose a new password.",
    intro: `Use the button below to set a new password for your ${brand.name} account. The new password applies to PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver.`,
    action: { label: "Set a new password", url: link },
    afterActionHtml: linkFallback(link),
    note: "The link works for one hour, and only once.",
    footerNote:
      "If you did not ask for this, ignore the message: your password stays exactly as it is.",
    brand,
  });
}

export function passwordChangedSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Your ${brand.name} password was changed`;
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
export function passwordChangedHtml(firstName: string, when: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  const name = firstWord(firstName);
  return emailShell({
    preheader: "Every signed-in device has been signed out. If this was not you, contact support now.",
    eyebrow: "Security notice",
    headline: name ? `Your password was changed, ${name}.` : "Your password was changed.",
    intro: `The password on your ${brand.name} account was changed on ${when}. Every device that was signed in has been signed out, in all three apps.`,
    bodyHtml: infoBox(
      "If this was you, there is nothing else to do.<br>If it was not, someone else set that password. Ask for a new reset link from the app right away, choose a password you use nowhere else, and get in touch with us.",
    ),
    action: { label: "Contact support", url: "https://pctweaker.app/support" },
    note: "We will never ask you for your password by email.",
    footerNote: "This notice is sent every time the password changes and cannot be turned off.",
    brand,
  });
}

export function accountWelcomeSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Your ${brand.name} account is ready`;
}

/**
 * Sent once the address is confirmed, not at registration.
 *
 * At registration the person already has an email from us asking them to
 * confirm, and two messages arriving together makes the one that needs acting
 * on easier to miss. This one also has something the other cannot have: an
 * account that actually works.
 */
export function accountWelcomeHtml(firstName: string, freeTweakCount: number, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  const name = firstWord(firstName);
  const uninstaller = brand === EMAIL_BRANDS.uninstaller;
  const lines = uninstaller
    ? [
        "Every program on this PC, Microsoft Store apps included",
        "A confidence score and removal brief before every uninstall",
        "Single uninstalls, free for good",
        "Leftover scan and Removal Ledger",
      ]
    : [
        `${freeTweakCount} tweaks, each backed up before it is applied and revertible in one click`,
        "Live monitoring of processor, memory and disk",
        "Startup manager, temporary file cleanup and a password breach check",
      ];
  const body =
    divider() +
    row(sectionLabel("Yours without paying anything") + listTable(lines.map((line) => bulletRow(brand.accentText, line)).join("\n")));
  return emailShell({
    preheader: "Your email is confirmed. Here is what your free account already includes.",
    eyebrow: "Account ready",
    headline: name ? `You're in, ${name}.` : "You're in.",
    intro:
      "Your email is confirmed and the account is active. Sign in from the app and everything below is already yours.",
    bodyHtml: body,
    action: { label: `Open ${brand.name}`, url: brand.siteUrl },
    footerNote: "Questions? Just reply to this email.",
    brand,
  });
}
