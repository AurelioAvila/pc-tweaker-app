/**
 * The messages an account produces before anyone has paid anything, in the
 * family email kit (email-design-kit/pc-tweaker 01 to 04), in the reader's
 * language (copy/).
 *
 * The account is shared by PC Tweaker, PC Tweaker Uninstaller and Tweaky
 * Driver, so confirm and welcome are written for the app the person signed up
 * in (`brand`). Reset and the password-changed notice speak for the account.
 *
 * Confirm and reset show the destination as text under the button: a link the
 * reader can see before clicking is the difference between a mail that looks
 * legitimate and one that looks like phishing. The security notices go the
 * other way: no token and no link that changes anything, because their reader
 * may not be the person who acted.
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
  linkFallback,
  note,
  paragraph,
  plainText,
  security,
  steps,
  textFooter,
  type EmailBrand,
} from "./layout";

const firstWord = (value: string) => (value || "").trim().split(/\s+/)[0] ?? "";
const isUninstaller = (brand: EmailBrand) => brand === EMAIL_BRANDS.uninstaller;
const numbered = (title: string, items: string[]) => [`${title}:`, ...items.map((item, i) => `${i + 1}. ${plainText(item)}`)];
const SUPPORT_PAGE = "https://pctweaker.app/support/";
const UNDO_GUIDE = "https://pctweaker.app/how-to-undo-windows-tweaks/";

// ---------------------------------------------------------------- confirm

export function verificationSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  return c.verify.subject(brand.name);
}

export function verificationText(link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  const v = c.verify;
  return [
    v.subject(brand.name),
    "",
    v.intro(brand.name),
    link,
    "",
    ...numbered(v.stepsTitle, v.stepsHtml(isUninstaller(brand))),
    "",
    plainText(v.noteHtml(brand.name)),
  ].join("\n") + textFooter(brand, v.why(brand.name), c);
}

export function verificationHtml(firstName: string, link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  const v = c.verify;
  return emailShell({
    brand,
    c,
    preheader: v.preheader,
    eyebrow: v.eyebrow,
    headline: v.headline(firstWord(firstName)),
    intro: v.intro(brand.name),
    blocks: [
      button({ label: v.button, url: link }),
      linkFallback(link),
      steps(v.stepsTitle, v.stepsHtml(isUninstaller(brand))),
      note(v.noteHtml(escapeHtml(brand.name))),
    ],
    help: { title: v.helpTitle, text: escapeHtml(v.helpText) },
    why: v.why(brand.name),
  });
}

// ---------------------------------------------------------------- welcome

export function accountWelcomeSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  return c.welcome.subject(brand.name);
}

const guide = (label: string) => link(UNDO_GUIDE, label);

export function accountWelcomeText(freeTweakCount: number, brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  const w = c.welcome;
  const u = isUninstaller(brand);
  return [
    w.subject(brand.name),
    "",
    w.intro(u, freeTweakCount),
    "",
    ...numbered(w.stepsTitle, w.stepsHtml(u)),
    "",
    plainText(w.noteHtml(u, guide)),
    "",
    `${w.button(brand.name)}: ${brand.siteUrl}`,
  ].join("\n") + textFooter(brand, w.why(brand.name), c);
}

/**
 * Sent once the address is confirmed, not at registration: two messages at
 * once makes the one that needs acting on easier to miss.
 */
export function accountWelcomeHtml(firstName: string, freeTweakCount: number, brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  const w = c.welcome;
  const u = isUninstaller(brand);
  return emailShell({
    brand,
    c,
    preheader: w.preheader(u),
    eyebrow: w.eyebrow,
    headline: w.headline(firstWord(firstName)),
    intro: w.intro(u, freeTweakCount),
    blocks: [steps(w.stepsTitle, w.stepsHtml(u)), note(w.noteHtml(u, guide)), button({ label: w.button(brand.name), url: brand.siteUrl })],
    help: { title: w.helpTitle, text: escapeHtml(w.helpText) },
    why: w.why(brand.name),
  });
}

// ---------------------------------------------------------------- reset

export function passwordResetSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  return c.reset.subject(brand.name);
}

export function passwordResetText(link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  const r = c.reset;
  return [
    r.subject(brand.name),
    "",
    r.intro(brand.name),
    link,
    "",
    ...r.rows.map(([label, value]) => `${label}: ${value}`),
    "",
    r.after,
    "",
    r.note,
  ].join("\n") + textFooter(brand, r.why(brand.name), c);
}

export function passwordResetHtml(link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  const r = c.reset;
  return emailShell({
    brand,
    c,
    preheader: r.preheader,
    eyebrow: r.eyebrow,
    headline: r.headline,
    intro: r.intro(brand.name),
    blocks: [
      button({ label: r.button, url: link }),
      linkFallback(link),
      details(r.rows),
      paragraph(escapeHtml(r.after)),
      note(escapeHtml(r.note)),
    ],
    help: { title: r.helpTitle, text: r.helpTextHtml },
    why: r.why(brand.name),
  });
}

// ---------------------------------------------------------------- changed

export function passwordChangedSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  return c.changed.subject(brand.name);
}

export function passwordChangedText(when: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  const x = c.changed;
  return [
    x.intro(brand.name, when),
    "",
    `${c.shell.ifYou} ${x.ifYou}`,
    "",
    `${c.shell.ifNot} ${x.ifNot}`,
    ...numbered(x.stepsTitle, x.stepsHtml),
    `${x.button}: ${SUPPORT_PAGE}`,
    "",
    plainText(x.noteHtml),
  ].join("\n") + textFooter(brand, x.why(brand.name), c);
}

/**
 * Sent after a password has actually changed, never before. It carries no
 * reset token and no "this wasn't me" button: by the time it arrives the new
 * password is already set, and a one-click link on the message a worried
 * reader is most likely to click is exactly the shape an attacker would forge.
 * The button goes to the support page, which is a place, not an action.
 *
 * `when` is passed in rather than read here, so the email quotes the moment
 * the password actually changed rather than the moment it was rendered.
 */
export function passwordChangedHtml(firstName: string, when: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = en): string {
  const x = c.changed;
  return emailShell({
    brand,
    c,
    preheader: x.preheader(when),
    eyebrow: x.eyebrow,
    headline: x.headline(firstWord(firstName)),
    intro: x.intro(brand.name, when),
    blocks: [
      security(escapeHtml(x.ifYou), escapeHtml(x.ifNot)),
      steps(x.stepsTitle, x.stepsHtml),
      button({ label: x.button, url: SUPPORT_PAGE }),
      note(x.noteHtml),
    ],
    help: { title: x.helpTitle, text: escapeHtml(x.helpText), expectation: x.expectation },
    why: x.why(brand.name),
  });
}

// ---------------------------------------------------------------- email change

/** "a***@example.com": enough for the owner to recognise, not to harvest. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${(local ?? "").slice(0, 1)}***@${domain ?? ""}`;
}

/** To the new address: the link that moves the account there. */
export function emailChangeMail(firstName: string, link: string, brand: EmailBrand, c: Copy = en) {
  const x = c.emailChange;
  return {
    subject: x.subject(brand.name),
    html: emailShell({
      brand,
      c,
      preheader: x.preheader,
      eyebrow: x.eyebrow,
      headline: x.headline(firstWord(firstName)),
      intro: x.intro,
      blocks: [button({ label: x.button, url: link }), linkFallback(link), note(escapeHtml(x.note))],
      help: { title: x.helpTitle, text: escapeHtml(x.helpText) },
      why: x.why,
    }),
    text: [x.subject(brand.name), "", x.intro, link, "", x.note].join("\n") + textFooter(brand, x.why, c),
  };
}

/** To the previous address, after the move: no link, like every security notice. */
export function emailChangedNotice(firstName: string, newEmail: string, when: string, brand: EmailBrand, c: Copy = en) {
  const x = c.emailChanged;
  const masked = maskEmail(newEmail);
  return {
    subject: x.subject(brand.name),
    html: emailShell({
      brand,
      c,
      preheader: x.preheader(masked),
      eyebrow: x.eyebrow,
      headline: x.headline(firstWord(firstName)),
      intro: x.intro(masked, when),
      blocks: [
        security(escapeHtml(x.ifYou), escapeHtml(x.ifNot)),
        button({ label: x.button, url: SUPPORT_PAGE }),
        note(escapeHtml(x.note)),
      ],
      help: { title: x.helpTitle, text: escapeHtml(x.helpText) },
      why: x.why(brand.name),
    }),
    text:
      [x.intro(masked, when), "", `${c.shell.ifYou} ${x.ifYou}`, `${c.shell.ifNot} ${x.ifNot}`, `${x.button}: ${SUPPORT_PAGE}`, "", x.note].join("\n") +
      textFooter(brand, x.why(brand.name), c),
  };
}

// ---------------------------------------------------------------- new sign-in

/** Kit 10. `device` is the computer name the app sent, or null. */
export function newSignInMail(email: string, device: string | null, when: string, brand: EmailBrand, c: Copy = en) {
  const x = c.signIn;
  const pc = device || x.aPc;
  return {
    subject: x.subject(brand.name),
    html: emailShell({
      brand,
      c,
      preheader: x.preheader(pc, when),
      eyebrow: x.eyebrow,
      headline: x.headline(pc),
      intro: x.intro(brand.name),
      blocks: [
        details([[x.rows.device, pc], [x.rows.when, when], [x.rows.account, email]]),
        security(escapeHtml(x.ifYou), x.ifNotHtml),
        note(escapeHtml(x.note)),
      ],
      help: { title: x.helpTitle, text: escapeHtml(x.helpText) },
      why: x.why(brand.name),
    }),
    text:
      [
        x.headline(pc),
        "",
        x.intro(brand.name),
        "",
        `${x.rows.device}: ${pc}`,
        `${x.rows.when}: ${when}`,
        `${x.rows.account}: ${email}`,
        "",
        `${c.shell.ifYou} ${x.ifYou}`,
        `${c.shell.ifNot} ${plainText(x.ifNotHtml)}`,
        "",
        x.note,
      ].join("\n") + textFooter(brand, x.why(brand.name), c),
  };
}
