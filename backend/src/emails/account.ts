/**
 * The messages an account produces before anyone has paid anything, in the
 * family email kit (email-design-kit/pc-tweaker 01 to 04).
 *
 * The account is shared by PC Tweaker, PC Tweaker Uninstaller and Tweaky
 * Driver, so confirm and welcome are written for the app the person signed up
 * in (`brand`). Reset and the password-changed notice speak for the account.
 *
 * Confirm and reset show the destination as text under the button: a link the
 * reader can see before clicking is the difference between a mail that looks
 * legitimate and one that looks like phishing. The password-changed notice
 * goes the other way: no token and no link that changes anything, because its
 * reader may not be the person who acted.
 */

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
  security,
  steps,
  textFooter,
  type EmailBrand,
} from "./layout";

const firstWord = (value: string) => (value || "").trim().split(/\s+/)[0];
const isUninstaller = (brand: EmailBrand) => brand === EMAIL_BRANDS.uninstaller;
/** "One step left, Marco." or "One step left." when there is no name. */
const greet = (lead: string, firstName: string) => {
  const name = firstWord(firstName);
  return name ? `${lead}, ${name}.` : `${lead}.`;
};
const plain = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

// ---------------------------------------------------------------- confirm

export function verificationSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Confirm your email for ${brand.name}`;
}

function verificationSteps(brand: EmailBrand): string[] {
  return isUninstaller(brand)
    ? [
        "Go back to the Uninstaller and sign in from the <strong>Account</strong> panel. The app checks the account at sign-in, so there is nothing to refresh by hand.",
        "Nothing you removed changes. Single uninstalls, the leftover scan and the Removal Ledger never needed an account.",
        "Checkout for Uninstaller Pro only opens once the address is confirmed. A PC Tweaker plan on the same account is what unlocks the loyalty price.",
      ]
    : [
        "Go back to PC Tweaker and sign in from the <strong>Account</strong> button. The app checks the account at sign-in, so there is nothing to refresh by hand.",
        "Nothing you already applied changes. Free never needed an account: the Free controls, the Scan and your Change history are exactly as you left them.",
        "Checkout for Pro only opens once the address is confirmed. A Pro licence is signed for the account, not for the machine, so signing in on another PC is all it takes to use it there.",
      ];
}

export function verificationText(link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return [
    `Confirm your email for ${brand.name}`,
    "",
    `You created a ${brand.name} account with this address. Confirm it and the account is live:`,
    link,
    "",
    "After you confirm:",
    ...verificationSteps(brand).map((s, i) => `${i + 1}. ${plain(s)}`),
    "",
    "This link expires in 24 hours and works once. If you did not create this account, ignore this message: nothing happens without the click.",
  ].join("\n") + textFooter(brand, `You received this email because a ${brand.name} account was created with this address.`);
}

export function verificationHtml(firstName: string, link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return emailShell({
    brand,
    preheader: "One click confirms this address. The link works for 24 hours.",
    eyebrow: "Confirm your email",
    headline: greet("One step left", firstName),
    intro: `You created a ${brand.name} account with this address. Confirm it and the account is live. The account is what carries a Pro plan from one PC to the next, and it is the only way we can send you a password reset later.`,
    blocks: [
      button({ label: "Confirm my email", url: link }),
      linkFallback(link),
      steps("After you confirm", verificationSteps(brand)),
      note(
        `The link works for 24 hours, and only once. If it has expired, open the account menu in the app and choose <strong>Resend</strong>. If you did not create a ${escapeHtml(brand.name)} account, ignore this email: nothing happens without the click.`,
      ),
    ],
    help: {
      title: "Link not arriving, or arriving twice?",
      text: "Check the spam folder first, then tell us the address you signed up with.",
    },
    why: `You received this email because a ${brand.name} account was created with this address.`,
  });
}

// ---------------------------------------------------------------- welcome

export function accountWelcomeSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Your ${brand.name} account is ready`;
}

function welcomeContent(freeTweakCount: number, brand: EmailBrand) {
  if (isUninstaller(brand))
    return {
      intro:
        "Your address is confirmed and the account is active. Sign in from the Account panel in the Uninstaller and everything below is yours without paying anything. Here is where I would start.",
      heading: "Three things worth trying first",
      items: [
        "<strong>Installed apps.</strong> Every program on this PC, Microsoft Store apps included, with its size and publisher.",
        "<strong>Details, then Uninstall.</strong> Each program shows a confidence score and a removal brief before anything runs, and machine-wide programs get a System Restore point attempt first.",
        "<strong>The leftover scan.</strong> After an uninstall the app looks for files and registry keys the program left behind, and the Removal Ledger records what was removed and the space it freed.",
      ],
      noteHtml:
        "Leftover cleanup, batch removal and the removal of broken entries are Uninstaller Pro. If the same account has a PC Tweaker plan, Pro costs less: the price is in Plans &amp; pricing.",
    };
  return {
    intro: `Your address is confirmed and the account is active. Sign in from the Account button in the app and the ${freeTweakCount} Free controls, the Scan, the Health score and the Change history are yours without paying anything. Here is where I would start.`,
    heading: "Three things worth trying first",
    items: [
      "<strong>Scan, then Run system scan.</strong> Checks across startup, storage, memory, privacy, performance and updates. Recommended and optional changes are listed apart, and nothing is applied until you approve it. Fix all shows the exact settings first and verifies each one afterwards.",
      "<strong>Startup.</strong> Entries that launch with Windows, with the publisher next to each one. Disabling two or three you never use is the single change most people notice at the next boot, and each entry has its own restore control.",
      "<strong>Profiles.</strong> Gaming, Study and Work are included in Free. Open one, read the trade-offs on each card, untick what you do not want, and apply the rest in one click. A profile adds its settings without undoing anything else you changed.",
    ],
    noteHtml: `Before a control writes anything, PC Tweaker saves the previous value, and every control card has <strong>What this changes, exactly</strong>. Restore from the control itself, or open Change history and use <strong>Undo all</strong>. Cleanup that goes to the Recycle Bin is recoverable until you empty it; driver updates, repairs and hardware controls have their own recovery steps. Details: ${link("https://pctweaker.app/how-to-undo-windows-tweaks/", "how to undo Windows tweaks")}.`,
  };
}

export function accountWelcomeText(freeTweakCount: number, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  const c = welcomeContent(freeTweakCount, brand);
  return [
    `Your ${brand.name} account is ready`,
    "",
    c.intro,
    "",
    `${c.heading}:`,
    ...c.items.map((s, i) => `${i + 1}. ${plain(s)}`),
    "",
    plain(c.noteHtml),
    "",
    `Open ${brand.name}: ${brand.siteUrl}`,
  ].join("\n") + textFooter(brand, `You received this email because you confirmed a ${brand.name} account with this address. It is sent once.`);
}

/**
 * Sent once the address is confirmed, not at registration: two messages at
 * once makes the one that needs acting on easier to miss.
 */
export function accountWelcomeHtml(firstName: string, freeTweakCount: number, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  const c = welcomeContent(freeTweakCount, brand);
  return emailShell({
    brand,
    preheader: isUninstaller(brand)
      ? "Three things worth trying first, and what Pro adds."
      : "Three controls worth trying first, and how every change is undone.",
    eyebrow: "Account ready",
    headline: greet("You're in", firstName),
    intro: c.intro,
    blocks: [steps(c.heading, c.items), note(c.noteHtml), button({ label: `Open ${brand.name}`, url: brand.siteUrl })],
    help: {
      title: "Something not working as described?",
      text: "Tell us the app version and what you clicked.",
    },
    why: `You received this email because you confirmed a ${brand.name} account with this address. It is sent once.`,
  });
}

// ---------------------------------------------------------------- reset

export function passwordResetSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Reset your ${brand.name} password`;
}

export function passwordResetText(link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return [
    `Reset your ${brand.name} password`,
    "",
    `Someone asked to reset the password of the ${brand.name} account registered to this address. If that was you, open this link to set a new one:`,
    link,
    "",
    "The link works once and expires in one hour. The new password needs at least 8 characters and up to 72 bytes, and it applies to PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver. Every signed-in PC is signed out when it changes.",
    "",
    "Did not ask for this? Ignore the email. Your password stays unchanged.",
  ].join("\n") + textFooter(brand, `You received this email because a password reset was requested for the ${brand.name} account at this address.`);
}

export function passwordResetHtml(link: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return emailShell({
    brand,
    preheader: "The link works once, for one hour. Nothing changes until you use it.",
    eyebrow: "Password reset",
    headline: "Choose a new password.",
    intro: `Someone asked to reset the password of the ${brand.name} account registered to this address. If that was you, the button below opens a page where you set a new one. Nothing has changed yet.`,
    blocks: [
      button({ label: "Set a new password", url: link }),
      linkFallback(link),
      details([
        ["Link valid for", "One hour, one use"],
        ["New password", "At least 8 characters, up to 72 bytes"],
        ["Applies to", "PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver"],
        ["After the change", "Every signed-in PC is signed out"],
      ]),
      paragraph(
        "Once the new password is saved, sign in again on each PC where you use the apps. Applied settings, history and any Pro plan are tied to the account and the machine, not to the password, so nothing there is touched.",
      ),
      note(
        "Did not ask for this? Ignore the email: the link works for one hour, and only once, and your password stays exactly as it is. If these requests keep coming, write to us and we will look at where they originate.",
      ),
    ],
    help: {
      title: "Link expired, or the page says it is not valid?",
      text: "Ask for a fresh one from <strong>Forgot password?</strong> on the sign-in screen and use the newest email you receive.",
    },
    why: `You received this email because a password reset was requested for the ${brand.name} account at this address.`,
  });
}

// ---------------------------------------------------------------- changed

export function passwordChangedSubject(brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return `Your ${brand.name} password was changed`;
}

export function passwordChangedText(when: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return [
    `Your ${brand.name} password was changed on ${when}. Every device that was signed in has been signed out, in PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver.`,
    "",
    "If this was you, sign in again on each PC and you are done.",
    "",
    "If it was not: open the app, choose Forgot password? on the sign-in screen and request a reset to this address; choose a password you use nowhere else; and reply to this email so we can check the account. Support: https://pctweaker.app/support",
    "",
    "We will never ask you for your password by email.",
  ].join("\n") + textFooter(brand, `This notice is sent every time the password of a ${brand.name} account changes. It cannot be turned off.`);
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
export function passwordChangedHtml(firstName: string, when: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  return emailShell({
    brand,
    preheader: `Changed on ${when}. Every signed-in PC was signed out. If this was not you, read on.`,
    eyebrow: "Security notice",
    headline: greet("Your password was changed", firstName),
    intro: `The password on your ${brand.name} account was changed on ${when}. Every device that was signed in has been signed out, in PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver, including the one where the change was made.`,
    blocks: [
      security(
        "sign in again on each PC and you are done. Applied settings, history and your plan are untouched.",
        "someone else set that password and the old one no longer works. Do these three things, in this order.",
      ),
      steps("If it was not you", [
        "Open the app, choose <strong>Forgot password?</strong> on the sign-in screen and request a reset to this address. The link you get is yours alone, and using it signs the other person out.",
        "Choose a password you use nowhere else. If this mailbox shares its password with the old one, change the mailbox password too: that is the account an attacker would have gone through.",
        "Reply to this email so we can check the account from our side.",
      ]),
      button({ label: "Contact support", url: "https://pctweaker.app/support" }),
      note(
        "This email carries no link that changes anything and no code, on purpose: a reset button in a &quot;was this you?&quot; message is exactly what a forged email would offer. We will never ask you for your password by email.",
      ),
    ],
    help: {
      title: "Need us to look at the account?",
      text: "Security replies are read first.",
      expectation: "You will usually hear back within one working day.",
    },
    why: `This notice is sent every time the password of a ${brand.name} account changes. It cannot be turned off.`,
  });
}
