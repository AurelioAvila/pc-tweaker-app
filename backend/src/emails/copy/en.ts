/**
 * English copy for every message and page this backend sends, in the family
 * email kit's voice. The other languages implement the same shape (index.ts):
 * a missing key fails the type check, so no language can fall behind.
 *
 * Keys ending in `Html` return trusted markup: callers escape every value
 * they pass in. Everything else is plain text, escaped where it is printed.
 * `b` is the product name ("PC Tweaker", "PC Tweaker Uninstaller"), `u` is
 * true for the Uninstaller and `n` a first name, possibly empty.
 */
const named = (lead: string, n: string, end = "."): string => (n ? `${lead}, ${n}${end}` : `${lead}${end}`);

export const en = {
  tag: "en" as string,
  dateLocale: "en-GB" as string,

  shell: {
    writeTo: (address: string): string => `Write to ${address} or reply to this email.`,
    expectation: "We read everything and usually answer within one working day.",
    neverSend: "Never send a password or card number by email.",
    questions: "Questions?",
    family: "One account for PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver.",
    support: "Support",
    privacy: "Privacy",
    terms: "Terms",
    linkFallback: "If the button does not open, copy this address into your browser:",
    ifYou: "If this was you:",
    ifNot: "If it was not:",
    unsubscribe: "Unsubscribe",
  },

  plans: { monthly: "Pro, Monthly", annual: "Pro, Annual", lifetime: "Pro, Lifetime" } as Record<string, string>,

  verify: {
    subject: (b: string): string => `Confirm your email for ${b}`,
    preheader: "One click confirms this address. The link works for 24 hours.",
    eyebrow: "Confirm your email",
    headline: (n: string): string => named("One step left", n),
    intro: (b: string): string =>
      `You created a ${b} account with this address. Confirm it and the account is live. The account is what carries a Pro plan from one PC to the next, and it is the only way we can send you a password reset later.`,
    button: "Confirm my email",
    stepsTitle: "After you confirm",
    stepsHtml: (u: boolean): string[] =>
      u
        ? [
            "Go back to the Uninstaller and sign in from the <strong>Account</strong> panel. The app checks the account at sign-in, so there is nothing to refresh by hand.",
            "Nothing you removed changes. Single uninstalls, the leftover scan and the Removal Ledger never needed an account.",
            "Checkout for Uninstaller Pro only opens once the address is confirmed. A PC Tweaker plan on the same account is what unlocks the loyalty price.",
          ]
        : [
            "Go back to PC Tweaker and sign in from the <strong>Account</strong> button. The app checks the account at sign-in, so there is nothing to refresh by hand.",
            "Nothing you already applied changes. Free never needed an account: the Free controls, the Scan and your Change history are exactly as you left them.",
            "Checkout for Pro only opens once the address is confirmed. A Pro license is signed for the account, not for the machine, so signing in on another PC is all it takes to use it there.",
          ],
    noteHtml: (b: string): string =>
      `The link works for 24 hours, and only once. If it has expired, open the account menu in the app and choose <strong>Resend</strong>. If you did not create a ${b} account, ignore this email: nothing happens without the click.`,
    helpTitle: "Link not arriving, or arriving twice?",
    helpText: "Check the spam folder first, then tell us the address you signed up with.",
    why: (b: string): string => `You received this email because a ${b} account was created with this address.`,
  },

  welcome: {
    subject: (b: string): string => `Your ${b} account is ready`,
    preheader: (u: boolean): string =>
      u ? "Three things worth trying first, and what Pro adds." : "Three controls worth trying first, and how every change is undone.",
    eyebrow: "Account ready",
    headline: (n: string): string => named("You're in", n),
    intro: (u: boolean, free: number): string =>
      u
        ? "Your address is confirmed and the account is active. Sign in from the Account panel in the Uninstaller and everything below is yours without paying anything. Here is where to start."
        : `Your address is confirmed and the account is active. Sign in from the Account button in the app and the ${free} Free controls, the Scan, the Health score and the Change history are yours without paying anything. Here is where to start.`,
    stepsTitle: "Three things worth trying first",
    stepsHtml: (u: boolean): string[] =>
      u
        ? [
            "<strong>Installed apps.</strong> Every program on this PC, Microsoft Store apps included, with its size and publisher.",
            "<strong>Details, then Uninstall.</strong> Each program shows a confidence rating and a removal summary before anything runs, and machine-wide programs get a System Restore point attempt first.",
            "<strong>The leftover scan.</strong> After an uninstall the app looks for files and registry keys the program left behind, and the Removal Ledger records what was removed and the space it freed.",
          ]
        : [
            "<strong>Scan, then Run system scan.</strong> Checks across startup, storage, memory, privacy, performance and updates. Recommended and optional changes are listed apart, and nothing is applied until you approve it. Fix all shows the exact settings first and verifies each one afterwards.",
            "<strong>Startup.</strong> Entries that launch with Windows, with the publisher next to each one. Disabling two or three you never use is the single change most people notice at the next boot, and each entry has its own restore control.",
            "<strong>Profiles.</strong> Gaming, Study and Work are included in Free. Open one, read the trade-offs on each card, untick what you do not want, and apply the rest in one click. A profile adds its settings without undoing anything else you changed.",
          ],
    noteHtml: (u: boolean, guideLink: (label: string) => string): string =>
      u
        ? "Leftover cleanup, batch removal and the removal of broken entries are Uninstaller Pro. If the same account has a PC Tweaker plan, Pro costs less: the price is in Plans &amp; pricing."
        : `Before a control writes anything, PC Tweaker saves the previous value, and every control card has <strong>What this changes, exactly</strong>. Restore from the control itself, or open Change history and use <strong>Restore active tweaks</strong>. Cleanup that goes to the Recycle Bin is recoverable until you empty it; driver updates, repairs and hardware controls have their own recovery steps. Details: ${guideLink("how to undo Windows tweaks")}.`,
    button: (b: string): string => `Open ${b}`,
    helpTitle: "Something not working as described?",
    helpText: "Tell us the app version and what you clicked.",
    why: (b: string): string => `You received this email because you confirmed a ${b} account with this address. It is sent once.`,
  },

  reset: {
    subject: (b: string): string => `Reset your ${b} password`,
    preheader: "The link works once, for one hour. Nothing changes until you use it.",
    eyebrow: "Password reset",
    headline: "Choose a new password.",
    intro: (b: string): string =>
      `Someone asked to reset the password of the ${b} account registered to this address. If that was you, the button below opens a page where you set a new one. Nothing has changed yet.`,
    button: "Set a new password",
    rows: [
      ["Link valid for", "One hour, one use"],
      ["New password", "At least 8 characters, up to 72 bytes"],
      ["Applies to", "PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver"],
      ["After the change", "Every signed-in PC is signed out"],
    ] as [string, string][],
    after:
      "Once the new password is saved, sign in again on each PC where you use the apps. Applied settings, history and any Pro plan are tied to the account and the machine, not to the password, so nothing there is touched.",
    note:
      "Did not ask for this? Ignore the email: the link works for one hour, and only once, and your password stays exactly as it is. If these requests keep coming, write to us and we will look at where they originate.",
    helpTitle: "Link expired, or the page says it is not valid?",
    helpTextHtml:
      "Ask for a fresh one from <strong>Forgot password?</strong> on the sign-in screen and use the newest email you receive.",
    why: (b: string): string => `You received this email because a password reset was requested for the ${b} account at this address.`,
  },

  changed: {
    subject: (b: string): string => `Your ${b} password was changed`,
    preheader: (when: string): string => `Changed on ${when}. Every other signed-in PC was signed out. If this was not you, read on.`,
    eyebrow: "Security notice",
    headline: (n: string): string => named("Your password was changed", n),
    intro: (b: string, when: string): string =>
      `The password on your ${b} account was changed on ${when}. Every device that was signed in has been signed out, in PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver.`,
    ifYou: "sign in again on each PC and you are done. Applied settings, history and your plan are untouched.",
    ifNot: "someone else set that password and the old one no longer works. Do these three things, in this order.",
    stepsTitle: "If it was not you",
    stepsHtml: [
      "Open the app, choose <strong>Forgot password?</strong> on the sign-in screen and request a reset to this address. The link you get is yours alone, and using it signs the other person out.",
      "Choose a password you use nowhere else. If this mailbox shares its password with the old one, change the mailbox password too: that is the account an attacker would have gone through.",
      "Reply to this email so we can check the account from our side.",
    ],
    button: "Contact support",
    noteHtml:
      "This email carries no link that changes anything and no code, on purpose: a reset button in a &quot;was this you?&quot; message is exactly what a forged email would offer. We will never ask you for your password by email.",
    helpTitle: "Need us to look at the account?",
    helpText: "Security replies are read first.",
    expectation: "You will usually hear back within one working day.",
    why: (b: string): string => `This notice is sent every time the password of a ${b} account changes. It cannot be turned off.`,
  },

  emailChange: {
    subject: (b: string): string => `Confirm your new email for ${b}`,
    preheader: "One click moves your account to this address. The link works for 24 hours.",
    eyebrow: "Confirm new address",
    headline: (n: string): string => named("Confirm this address", n),
    intro:
      "You asked to move the account used by PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver to this address. Confirm it and you sign in with this address from now on; the previous one stops working for sign-in.",
    button: "Confirm the new address",
    note: "The link works for 24 hours, and only once. Until you confirm, nothing changes. Every signed-in PC is signed out after the move.",
    helpTitle: "Did not ask for this?",
    helpText: "Ignore this email: the account stays on its current address.",
    why: "You received this email because someone signed in to a PC Tweaker account and asked to move it to this address.",
  },

  emailChanged: {
    subject: (b: string): string => `The email on your ${b} account was changed`,
    preheader: (masked: string): string => `The account now uses ${masked}. If this was not you, read on.`,
    eyebrow: "Security notice",
    headline: (n: string): string => named("Your account email was changed", n),
    intro: (masked: string, when: string): string =>
      `On ${when}, the account used by PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver moved from this address to ${masked}. Every signed-in PC was signed out; sign-in now uses the new address.`,
    ifYou: "nothing else to do. Plans, settings and history moved with the account.",
    ifNot:
      "someone who knew your password moved the account. Reply to this email straight away: we can move it back and lock it while we look. Then change that password everywhere you used it.",
    button: "Contact support",
    note: "This email carries no link that changes anything, on purpose. We will never ask you for your password by email.",
    helpTitle: "Need us to look at the account?",
    helpText: "Security replies are read first.",
    why: (b: string): string => `This notice goes to the previous address every time the email of a ${b} account changes. It cannot be turned off.`,
  },

  signIn: {
    subject: (b: string): string => `New sign-in to your ${b} account`,
    preheader: (device: string, when: string): string => `Signed in on ${device} on ${when}. If that was you, nothing to do.`,
    eyebrow: "New sign-in",
    aPc: "a Windows PC",
    headline: (device: string): string => `New sign-in on ${device}.`,
    intro: (b: string): string =>
      `Your ${b} account was signed in to from a PC or network we had not seen on this account before. We send this once per new PC, and only for sign-ins with the correct password; a wrong password never produces this email.`,
    rows: { device: "PC", when: "When", account: "Account" },
    ifYou: "nothing to do, for example a second PC, a reinstall or a new network. A Pro plan follows the account.",
    ifNotHtml:
      "change your password now from <strong>Forgot password?</strong> on the sign-in screen. Setting a new password signs out every PC at once, including this one. Then reply to this email so we can look at the account.",
    note:
      "This email deliberately has no link that signs anything out: a “secure my account” link in a security alert is the exact shape a forged message would take. The only safe action is the reset you start yourself inside the app. We will never ask for your password by email.",
    helpTitle: "Not sure it was you?",
    helpText: "Treat it as not you, and tell us. Security replies are read first.",
    why: (b: string): string => `This notice is sent the first time a new PC or network signs in to a ${b} account. It cannot be turned off.`,
  },

  receipt: {
    subject: (u: boolean, lifetime: boolean): string =>
      u
        ? lifetime
          ? "Your PC Tweaker Uninstaller Pro purchase is confirmed"
          : "Your PC Tweaker Uninstaller Pro subscription is active"
        : lifetime
          ? "Your PC Tweaker Pro Lifetime license is active"
          : "Your PC Tweaker Pro subscription is active",
    rows: {
      plan: "Plan",
      charged: "Charged",
      renewsOn: "Renews on",
      access: "Access",
      neverExpires: "Never expires",
      renewal: "Renewal",
      renewalNone: "None. Nothing is charged again.",
      included: "Included",
      includedValue: "12 months of PC Tweaker Uninstaller Pro",
      account: "Account",
      shared: (email: string): string => `${email} (shared with PC Tweaker)`,
    },
    eyebrowPro: "Pro activated",
    eyebrowLifetime: "Lifetime license",
    buttonPct: "Open PC Tweaker",
    buttonUn: "Open Uninstaller",
    help: {
      title: "Paid but still not Pro, or charged something you did not expect?",
      text: "Tell us the account address and the date on the Stripe receipt.",
      expectation: "Billing replies usually go out within one working day.",
    },
    sub: {
      headline: (n: string): string => named("Pro is on your account", n),
      preheader: (plan: string, price: string, renews: string): string =>
        `${plan}, ${price}, renews on ${renews}. How to manage the plan and use Pro on a second PC.`,
      intro: (email: string, total: number, free: number, pro: number): string =>
        `Stripe confirmed the payment and the license for ${email} is signed. All ${total} controls are available now: the ${free} you had on Free plus the ${pro} Pro ones, Game Sessions and the Turbo Gaming preset included. The app refreshes its license when you return from checkout while online, so Pro should already show.`,
      stepsTitle: "Good to know from day one",
      stepsHtml: (who: string, renews: string): string[] => [
        `<strong>Managing the plan.</strong> Open Plans &amp; pricing in the app. It shows the plan and opens Stripe's billing portal, where you change the card or cancel. A cancelled plan stays Pro until ${renews} and is not charged again.`,
        `<strong>A second PC.</strong> Install PC Tweaker there and sign in with ${who}. The license is signed for the account, not the machine, so it is Pro on both. Applied controls and Change history stay per machine.`,
        "<strong>After a Windows reinstall or new hardware.</strong> Sign in again and Pro comes back on its own. Change history does not carry over, so re-apply a profile rather than looking for a restore.",
        "<strong>Where to start with Pro.</strong> Gaming, then Game Sessions: register a game and the turbo settings switch on when it launches and are undone when it exits.",
      ],
      note: "Stripe sends the invoice and payment receipt separately, from its own address; keep that one for your records. If the app still says Free after a few minutes, sign out and in once: the license is fetched again at sign-in.",
      why: "You received this email because a PC Tweaker Pro subscription was started on the account at this address.",
    },
    lifetime: {
      headline: (n: string): string => named("Pro, for good. Thank you", n),
      preheader: (price: string): string =>
        `One payment of ${price}, no renewal. Includes 12 months of Uninstaller Pro, activated on first sign-in.`,
      intro: (email: string, total: number): string =>
        `You paid once and that is the last time we charge this account. The Lifetime license for ${email} is signed and all ${total} controls, Game Sessions and the Turbo Gaming preset are available now.`,
      stepsTitle: "What Lifetime means in practice",
      stepsHtml: (who: string, uninstallerLink: string): string[] => [
        `<strong>Every PC you own.</strong> Sign in with ${who} on any Windows 10 or 11 PC and it is Pro there. There is no activation count to manage and no license key to type: the account is the key.`,
        `<strong>Uninstaller Pro for a year.</strong> Install PC Tweaker Uninstaller from ${uninstallerLink} and sign in with the same account. The 12 months start the first time you sign in there, not today. It is a separate, time-limited benefit, not an Uninstaller Lifetime license.`,
        "<strong>Reinstalls and new hardware.</strong> Nothing to transfer. After a fresh Windows, install PC Tweaker, sign in, and Pro is back. The Change history belongs to the old installation, so start from a profile rather than expecting old settings to reappear.",
        "<strong>Updates.</strong> PC Tweaker checks for updates itself, and Lifetime covers every update to PC Tweaker Pro.",
      ],
      note: "Stripe sends the invoice separately. If you ever see a monthly charge from us after this purchase, write to us straight away: a Lifetime account must never be billed again, and we will put it right.",
      why: "You received this email because a PC Tweaker Pro Lifetime license was bought on the account at this address.",
    },
    un: {
      headline: (n: string): string => named("Pro is on", n, ". Leftovers are now yours to remove."),
      preheader: (plan: string, price: string, renews: string | null): string =>
        `${plan}, ${price}, ${renews ? `renews on ${renews}` : "no renewal"}. Leftover cleanup, batch removal and broken entries are on.`,
      intro: (email: string): string =>
        `Stripe confirmed the payment and the Uninstaller Pro license for ${email} is signed. Three things change in the app: the leftover scan can now clean what it finds, several programs can be queued and removed in one run, and entries whose own uninstaller is gone can be removed too. Everything you had on Free, including the confidence rating and the Removal Ledger, stays exactly as it was.`,
      stepsTitle: "A first clean removal with Pro",
      stepsHtml: (lifetime: boolean, who: string, renews: string): string[] => [
        "Pick a program rated <strong>Safe</strong> and read its removal summary: the exact command, whether Windows Installer or the program's own uninstaller runs, the permissions it asks for and the reported size. Nothing runs until you confirm.",
        "After the uninstall, the leftover scan lists the folders, shortcuts and registry keys the program left behind. With Pro you can remove them from that same screen. Files go to the Recycle Bin, so a wrong guess is recoverable until you empty it; registry values are kept in the Removal Ledger.",
        "For a bigger clear-out, tick several programs and start a batch. Protected programs are never batchable, the related-programs check still warns before a parent takes its plugins with it, and the restore-point attempt runs before elevated removals, with the outcome recorded.",
        ...(lifetime
          ? []
          : [
              `<strong>Managing the plan.</strong> Plans &amp; pricing in the top bar shows the account and plan and opens Stripe's billing portal for the card, the interval or a cancellation. A cancelled plan stays Pro until ${renews}. Signing in with ${who} on another PC makes it Pro there too.`,
            ]),
      ],
      note: (lifetime: boolean): string =>
        `${lifetime ? "This purchase does not renew. " : ""}One account, two licenses: a PC Tweaker Pro license does not unlock Uninstaller and this one does not unlock PC Tweaker; each app verifies its own. Stripe sends the invoice separately. If Uninstaller still shows Free after a few minutes, sign out and in from Plans & pricing.`,
      help: {
        title: "Paid but still not Pro, or a removal that did not go as the summary said?",
        text: "Tell us the app version and the Removal Ledger entry (it exports to CSV).",
        expectation: "We usually answer within one working day.",
      },
      why: (lifetime: boolean): string =>
        lifetime
          ? "You received this email because PC Tweaker Uninstaller Pro was bought on the PC Tweaker account at this address."
          : "You received this email because an Uninstaller Pro subscription was started on the PC Tweaker account at this address.",
    },
  },

  reversal: {
    subject: (u: boolean): string =>
      u ? "Your PC Tweaker Uninstaller Pro payment was reversed" : "Your PC Tweaker Pro payment was reversed",
    eyebrow: "Payment reversed",
    headline: (n: string): string => named("Your payment was reversed", n),
    rows: {
      amount: "Amount reversed",
      plan: "Plan",
      proAccess: "Pro access",
      ended: "Ended",
      account: "Your account",
      accountValue: "Open, on Free",
      unPro: "Uninstaller Pro",
      unFree: "Still yours on Free",
      unFreeValue: "Single uninstalls, confidence rating, removal summary, leftover scan, Removal Ledger",
    },
    pct: {
      lead: (amount: string | null): string =>
        `${amount ? `Your payment of ${amount}` : "Your payment"} for PC Tweaker Pro was reversed by your payment provider.`,
      preheaderTail: "Pro access has ended; the free features keep working.",
      introTail:
        "Stripe has notified us, and the Pro access that came with that payment has ended on your account. This email is a record of what changed; it is not a request for anything.",
      ended: "The Pro access that came with this payment has ended. Your account and the free features keep working.",
      endedTail: "The app drops back to Free the next time it checks the license, usually at the next start or sign-in.",
      stopRenewal: "If the subscription itself is still active, cancel it from Plans & pricing so it does not renew.",
      oneOff: "This was a one-off purchase, so there is no subscription left to cancel.",
      mistake: "If you think this happened by mistake, reply to this email and we will look at the Stripe record with you.",
    },
    un: {
      preheader: (amount: string | null): string =>
        `${amount ?? "Your payment"} was reversed by your payment provider. Pro has ended; single uninstalls, the removal summary and the Removal Ledger keep working.`,
      intro: (amount: string | null): string =>
        `Your payment provider reversed ${amount ? `the payment of ${amount}` : "your payment"} for PC Tweaker Uninstaller Pro, and Stripe has told us. The Pro entitlement tied to that payment has ended. Your account stays open, and so does the PC Tweaker side of it: this reversal touches Uninstaller only.`,
      stops:
        "What stops: leftover cleanup, batch removal and the removal of broken entries. What does not change: anything already removed stays removed, the Removal Ledger keeps every receipt, and files you sent to the Recycle Bin are still there until you empty it.",
      stopRenewal:
        "If the subscription is still listed as active in Stripe, cancel it from Plans & pricing in the top bar so it does not attempt another charge.",
      oneOff: "This was a one-off entitlement, so there is nothing left to cancel.",
      origin:
        "This reversal came from your bank or card issuer, not from us. If you did not ask your bank for it, reply to this email with the date and amount on your statement and we will go through the Stripe record with you.",
    },
    helpTitle: "Questions about this reversal?",
    helpText: "Tell us the date and the amount on your bank statement.",
    why: (u: boolean): string =>
      u
        ? "You received this email because a payment for Uninstaller Pro on the PC Tweaker account at this address was reversed."
        : "You received this email because a payment for PC Tweaker Pro on the account at this address was reversed.",
  },

  ending: {
    subject: (b: string, ends: string): string => `Your ${b} Pro plan ends on ${ends}`,
    preheader: (ends: string): string => `Pro stays on until ${ends}, then the account returns to Free. Nothing is deleted.`,
    eyebrow: "Plan ending",
    headline: (n: string, ends: string): string => named(`Pro runs until ${ends}`, n),
    intro: (b: string, failed: boolean, ends: string): string =>
      failed
        ? `Stripe could not collect the renewal for your ${b} Pro subscription. Pro keeps working while Stripe retries the payment; if it cannot be collected by ${ends}, the account returns to Free.`
        : `Your ${b} Pro subscription has been cancelled, as requested. There will be no further charge. Everything Pro keeps working until the end of the period you already paid for, and then the account returns to Free.`,
    rows: { plan: "Plan", until: "Pro until", next: "Next charge", nextValue: "None", after: "Afterwards" },
    afterValue: (u: boolean, free: number): string =>
      u ? "Free: single uninstalls, leftover scan, Removal Ledger" : `Free: ${free} controls, Scan, Health score, Change history`,
    stepsTitle: (ends: string): string => `Before ${ends}`,
    steps: (u: boolean, failed: boolean): string[] => [
      u
        ? "Leftover cleanup and batch removal stop when Pro ends. Anything already removed stays removed, and the Removal Ledger keeps every receipt."
        : "Settings applied with Pro controls are not reverted when Pro ends; Windows keeps them. If you want some of them back to default, do it now from the control card or from Change history, where restore works on Free too.",
      u
        ? "Files sent to the Recycle Bin by a Pro cleanup stay there until you empty it, Pro or not."
        : "Game Sessions stops switching turbo settings on at launch once Pro ends. Nothing stays applied from a session that already exited, because every session is undone at exit.",
      failed
        ? "Update the card from Plans & pricing, then Manage subscription. Stripe retries the renewal itself; once it succeeds Pro continues with no gap."
        : "Changed your mind? Open Plans & pricing, then Manage subscription: until the end date Stripe lets you resume the same plan without a new checkout.",
    ],
    button: (b: string): string => `Open ${b}`,
    note: "Nothing is deleted when Pro ends: the account, its history and every applied setting stay exactly where they are. Stripe sends its own notice about the subscription separately.",
    helpTitle: "Did not cancel, or the date looks wrong?",
    helpText: "Tell us and we will check the Stripe record with you.",
    why: (b: string): string => `You received this email because the ${b} Pro subscription on the account at this address changed state.`,
  },

  bonus: {
    subject: "Your 12 months of Uninstaller Pro have started",
    preheader: (ends: string): string => `Included with your PC Tweaker Lifetime license, active until ${ends}. Nothing to pay, nothing to cancel.`,
    eyebrow: "Lifetime benefit",
    headline: (n: string): string => named("Your year of Uninstaller Pro started today", n),
    intro: (ends: string): string =>
      `You signed in to PC Tweaker Uninstaller with the account that holds your PC Tweaker Lifetime license, and that first sign-in is what starts the 12 months of Uninstaller Pro that come with it. No card was charged and there is no subscription behind this; it runs until ${ends} and then simply stops.`,
    rows: {
      entitlement: "Entitlement",
      entitlementValue: "Uninstaller Pro, 12-month Lifetime benefit",
      started: "Started",
      ends: "Ends",
      charged: "Charged",
      chargedValue: "Nothing. No renewal.",
    },
    stepsTitle: "What Pro adds for the year",
    stepsHtml: [
      "<strong>Leftover cleanup.</strong> The scan after every uninstall already listed what was left behind; now you can remove those folders, shortcuts and registry keys from the same screen. Files go to the Recycle Bin, registry values are kept in the Removal Ledger.",
      "<strong>Batch removal.</strong> Tick several programs and let them run in a safe order. Protected programs are excluded, and the restore-point attempt runs first for elevated removals.",
      "<strong>Broken entries.</strong> Programs whose own uninstaller is missing, which normally sit in the list forever, can be removed.",
    ],
    button: "Open Uninstaller",
    note: (ends: string): string =>
      `When the year ends, Uninstaller goes back to Free on its own: single uninstalls, the confidence rating, the leftover scan and the Removal Ledger stay, and nothing already removed comes back. Your PC Tweaker Lifetime license is unaffected either way. If you want Pro beyond ${ends}, Plans & pricing is where a paid Uninstaller plan would start; there is no automatic conversion.`,
    helpTitle: "Pro not showing in Uninstaller?",
    helpText: "Sign out and in once; each app fetches its own license at sign-in.",
    why: "You received this email because the Lifetime benefit was activated on the PC Tweaker account at this address. It is sent once.",
  },

  reminder: {
    subject: "Your PC Tweaker Lifetime checkout",
    preheader: "The checkout closed before payment, so nothing was charged. This is the only reminder.",
    eyebrow: "Checkout not completed",
    headline: (n: string): string => named("Nothing was charged", n),
    intro:
      "You opened a Lifetime checkout for PC Tweaker Pro and the Stripe page closed before a payment went through. No card was charged and your account is exactly as it was. If something got in the way, here is what people usually ask before deciding.",
    rows: (total: number): [string, string][] =>
      [
        ["Lifetime", "One payment. No renewal, ever."],
        ["Covers", `All ${total} controls, Game Sessions, every update`],
        ["PCs", "Every PC you sign in to with this account"],
        ["Also included", "12 months of PC Tweaker Uninstaller Pro"],
      ] as [string, string][],
    button: "Open PC Tweaker",
    retry:
      "To try again, open Plans & pricing in the app and choose Lifetime. Checkout needs a confirmed email address; if the button is greyed out, that is why, and Resend in the account menu fixes it. The current price is on the plan card and on the Stripe page.",
    doubts:
      "If a payment method was refused, Stripe shows the reason on its page; a different card or a wallet usually works. And if you decided against it, that is fine: Free stays Free, and this is the only reminder you will get about this checkout.",
    helpTitle: "A question before you decide?",
    helpText: "A real person answers.",
    why: "You received this email because a Lifetime checkout was started from the PC Tweaker account at this address and not completed. One reminder only.",
    unsubscribe: "Unsubscribe from emails like this.",
  },

  supportAck: {
    subject: "We received your PC Tweaker support request",
    preheader: "Your message is in the queue. Reply to this email to add a detail or a screenshot.",
    eyebrow: "Support request received",
    headline: (n: string): string => (n ? `Got it, ${n}. It is in the queue.` : "Got it. It is in the queue."),
    intro:
      "Your message reached the PC Tweaker support inbox. A person reads it, not a bot, and the answer comes back to this address. Most replies go out within one working day; something that needs a reproduction on our side can take a little longer, and we will say so.",
    replyTo: "We reply to",
    stepsTitle: "What speeds up the answer",
    steps: [
      "Reply to this email with anything you forgot: the app version, your Windows version, and the exact control or scan you used. One thread keeps everything together.",
      "If a setting is misbehaving, open Change history and tell us what the entry says. Every applied control is listed there with the value it set and the one it replaced, which is usually the whole diagnosis.",
      "Screenshots help; blur anything personal first. Never include a password, a license token or card details, and if we ever seem to ask for them, the message is not from us.",
    ],
    wait: "While you wait: if a change needs undoing right now, Restore active tweaks in Change history puts every recorded setting back without waiting for us.",
    guide: (link: string): string => `The ${link} covers the cases it does not reach.`,
    guideLabel: "undo guide",
    notYouTitle: "Did not contact us?",
    notYou:
      "Someone typed this address into the support form. You can ignore this email; nothing on an account changes through the form. If it keeps happening, tell us and we will block the source.",
    why: "You received this email because a support request was sent to PC Tweaker from this address.",
  },

  pages: {
    error: "Error",
    unavailable: "This service is not available right now.",
    missingToken: "This link is incomplete. Open it directly from the email.",
    verifiedTitle: "Email verified",
    verified: (b: string): string => `Your email is verified. You can close this window and return to ${b}.`,
    alreadyVerified: (b: string): string => `Your email is already verified. You can close this window and return to ${b}.`,
    expiredTitle: "Link expired",
    verifyExpired: "This verification link is invalid or has expired. Request a new one from the app.",
    failed: "Something went wrong. Try again later.",
    resetTitle: "Choose a new password",
    resetLead:
      "Pick something you don't use anywhere else. It applies to PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver, and you'll be signed out on your other devices.",
    newPassword: "New password",
    newPasswordPlaceholder: "At least 8 characters",
    passwordHint: "Use at least 8 characters and no more than 72 UTF-8 bytes. Accented characters and emoji may use multiple bytes.",
    confirmPassword: "Confirm password",
    confirmPlaceholder: "Type it again",
    update: "Update password",
    resetHint: "This link works once and expires an hour after it was sent.",
    notValidTitle: "Link not valid",
    notValidLead: "This page needs the link from your reset email. Open that link directly rather than reloading this page.",
    passwordRule: "Password must be at least 8 characters and no more than 72 UTF-8 bytes.",
    mismatch: "The two passwords don't match.",
    resetInvalid: "This reset link is invalid, already used, or has expired.",
    resetFailed: "Could not reset the password. Please try again.",
    updatedTitle: "Password updated",
    updated: (b: string): string => `Done. Go back to ${b} and sign in with your new password.`,
    closeHint: "You can close this window.",
    emailChangedTitle: "Email address changed",
    emailChanged: (b: string, email: string): string => `Your account now uses ${email}. Go back to ${b} and sign in with it.`,
    emailChangeInvalid: "This link is invalid, already used, or has expired. Ask for the change again from the app.",
    emailTaken: "That address is already used by another account. Nothing was changed.",
  },
};
