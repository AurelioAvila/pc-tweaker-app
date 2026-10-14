/**
 * The confirmation a customer gets after paying, for any product on this
 * backend, and the notice when a payment is reversed. Family email kit
 * (email-design-kit/pc-tweaker 05a, 05b, 06). Stripe's own receipt is an
 * accounting document; this says what was unlocked, where to use it, and
 * what to do on a second PC or after a reinstall.
 */

import {
  EMAIL_BRANDS,
  button,
  details,
  emailShell,
  escapeHtml,
  link,
  note,
  paragraph,
  plainText,
  steps,
  textFooter,
  type EmailBrand,
} from "./layout";

/** Catalogue counts quoted below. scripts/check-public-counts.mjs fails the
 *  build when they differ from the catalogue the app ships. */
const TOTAL_CONTROLS = 81;
const FREE_CONTROLS = 46;
const PRO_CONTROLS = 35;

export type ProductBrand = {
  /** Shown in subjects and the plan row, e.g. "PC Tweaker Pro". */
  name: string;
  /** Logo, colours and site of the app. */
  visual: EmailBrand;
  ctaLabel: string;
};

export const PRODUCT_BRANDS: Record<string, ProductBrand> = {
  pctweaker: { name: "PC Tweaker Pro", visual: EMAIL_BRANDS.pctweaker, ctaLabel: "Open PC Tweaker" },
  uninstaller: { name: "PC Tweaker Uninstaller Pro", visual: EMAIL_BRANDS.uninstaller, ctaLabel: "Open Uninstaller" },
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
   *  which never renews: the card then says so instead of quoting a date
   *  that would simply be untrue. */
  renewsOn: string | null;
};

export function brandFor(product: string | null | undefined): ProductBrand {
  return PRODUCT_BRANDS[product ?? ""] ?? PRODUCT_BRANDS.pctweaker;
}

const PLAN_LABELS: Record<string, string> = {
  lifetime: "Pro, Lifetime",
  annual: "Pro, Annual",
  monthly: "Pro, Monthly",
};
const planLabelFor = (plan: string | null) => PLAN_LABELS[plan ?? ""] ?? PLAN_LABELS.monthly;
const greet = (lead: string, firstName: string, tail = ".") => {
  const name = (firstName || "").trim().split(/\s+/)[0];
  return name ? `${lead}, ${name}${tail}` : `${lead}${tail}`;
};

export function proWelcomeSubject(product?: string | null, plan?: string | null): string {
  if (product === "uninstaller")
    return plan === "lifetime"
      ? `Your ${brandFor(product).name} purchase is confirmed`
      : `Your ${brandFor(product).name} subscription is active`;
  return plan === "lifetime"
    ? "Your PC Tweaker Pro Lifetime license is active"
    : "Your PC Tweaker Pro subscription is active";
}

type Receipt = {
  eyebrow: string;
  headline: string;
  preheader: string;
  intro: string;
  rows: [string, string][];
  heading: string;
  items: string[];
  noteHtml: string;
  help: { title: string; text: string; expectation: string };
  why: string;
};

function receipt({ product, firstName, email, plan, priceLabel, renewsOn }: ProWelcomeEmailInput): Receipt {
  const brand = brandFor(product);
  const lifetime = renewsOn === null;
  const who = escapeHtml(email);
  const help = {
    title: "Paid but still not Pro, or charged something you did not expect?",
    text: "Tell us the account address and the date on the Stripe receipt.",
    expectation: "Billing replies usually go out within one working day.",
  };

  if (product === "uninstaller") {
    const items = [
      "Pick a program rated <strong>Safe</strong> by the Confidence Score and read its Removal Brief: the exact command, whether Windows Installer or the program's own uninstaller runs, the permissions it asks for and the reported size. Nothing runs until you confirm.",
      "After the uninstall, the leftover scan lists the folders, shortcuts and registry keys the program left behind. With Pro you can remove them from that same screen. Files go to the Recycle Bin, so a wrong guess is recoverable until you empty it; registry values are kept in the Removal Ledger.",
      "For a bigger clear-out, tick several programs and start a batch. Protected programs are never batchable, the related-programs check still warns before a parent takes its plugins with it, and the restore-point attempt runs before elevated removals, with the outcome recorded.",
    ];
    if (!lifetime)
      items.push(
        `<strong>Managing the plan.</strong> Plans &amp; pricing in the top bar shows the account and plan and opens Stripe's billing portal for the card, the interval or a cancellation. A cancelled plan stays Pro until ${escapeHtml(renewsOn ?? "")}. Signing in with ${who} on another PC makes it Pro there too.`,
      );
    return {
      eyebrow: "Pro activated",
      headline: greet("Pro is on", firstName, ". Leftovers are now yours to remove."),
      preheader: `${planLabelFor(plan)}, ${priceLabel}${renewsOn ? `, renews on ${renewsOn}` : ", no renewal"}. Leftover cleanup, batch removal and broken entries are on.`,
      intro: `Stripe confirmed the payment and the Uninstaller Pro license for ${email} is signed. Three things change in the app: the leftover scan can now clean what it finds, several programs can be queued and removed in one run, and entries whose own uninstaller is gone can be removed too. Everything you had on Free, including the Confidence Score and the Removal Ledger, stays exactly as it was.`,
      rows: [
        ["Plan", planLabelFor(plan)],
        ["Charged", priceLabel],
        renewsOn ? ["Renews on", renewsOn] : ["Access", "Never expires"],
        ["Account", `${email} (shared with PC Tweaker)`],
      ],
      heading: "A first clean removal with Pro",
      items,
      noteHtml: `${lifetime ? "This purchase does not renew. " : ""}One account, two licenses: a PC Tweaker Pro license does not unlock Uninstaller and this one does not unlock PC Tweaker; each app verifies its own. Stripe sends the invoice separately. If Uninstaller still shows Free after a few minutes, sign out and in from Plans &amp; pricing.`,
      help: {
        title: "Paid but still not Pro, or a removal that did not go as the Brief said?",
        text: "Tell us the app version and the Removal Ledger entry (it exports to CSV).",
        expectation: "We usually answer within one working day.",
      },
      why: lifetime
        ? `You received this email because ${brand.name} was bought on the PC Tweaker account at this address.`
        : "You received this email because an Uninstaller Pro subscription was started on the PC Tweaker account at this address.",
    };
  }

  if (lifetime) {
    return {
      eyebrow: "Lifetime license",
      headline: greet("Pro, for good. Thank you", firstName),
      preheader: `One payment of ${priceLabel}, no renewal. Includes 12 months of Uninstaller Pro, activated on first sign-in.`,
      intro: `You paid once and that is the last time we charge this account. The Lifetime license for ${email} is signed and all ${TOTAL_CONTROLS} controls, Game Sessions and the Turbo Gaming preset are available now.`,
      rows: [
        ["Plan", planLabelFor("lifetime")],
        ["Charged", priceLabel],
        ["Access", "Never expires"],
        ["Renewal", "None. Nothing is charged again."],
        ["Included", "12 months of PC Tweaker Uninstaller Pro"],
        ["Account", email],
      ],
      heading: "What Lifetime means in practice",
      items: [
        `<strong>Every PC you own.</strong> Sign in with ${who} on any Windows 10 or 11 PC and it is Pro there. There is no activation count to manage and no license key to type: the account is the key.`,
        `<strong>Uninstaller Pro for a year.</strong> Install PC Tweaker Uninstaller from ${link("https://pctweaker.app/uninstaller/", "pctweaker.app/uninstaller")} and sign in with the same account. The 12 months start the first time you sign in there, not today. It is a separate, time-limited benefit, not an Uninstaller Lifetime license.`,
        "<strong>Reinstalls and new hardware.</strong> Nothing to transfer. After a fresh Windows, install PC Tweaker, sign in, and Pro is back. The Change history belongs to the old installation, so start from a profile rather than expecting old settings to reappear.",
        "<strong>Updates.</strong> PC Tweaker checks for updates itself, and Lifetime covers every update to PC Tweaker Pro.",
      ],
      noteHtml:
        "Stripe sends the invoice separately. If you ever see a monthly charge from us after this purchase, write to us straight away: a Lifetime account must never be billed again, and we will put it right.",
      help,
      why: `You received this email because a PC Tweaker Pro Lifetime license was bought on the account at this address.`,
    };
  }

  return {
    eyebrow: "Pro activated",
    headline: greet("Pro is on your account", firstName),
    preheader: `${planLabelFor(plan)}, ${priceLabel}, renews on ${renewsOn}. How to manage the plan and use Pro on a second PC.`,
    intro: `Stripe confirmed the payment and the license for ${email} is signed. All ${TOTAL_CONTROLS} controls are available now: the ${FREE_CONTROLS} you had on Free plus the ${PRO_CONTROLS} Pro ones, Game Sessions and the Turbo Gaming preset included. The app refreshes its license when you return from checkout while online, so Pro should already show.`,
    rows: [
      ["Plan", planLabelFor(plan)],
      ["Charged", priceLabel],
      ["Renews on", renewsOn ?? ""],
      ["Account", email],
    ],
    heading: "Good to know from day one",
    items: [
      `<strong>Managing the plan.</strong> Open Plans &amp; pricing in the app. It shows the plan and opens Stripe's billing portal, where you change the card or cancel. A cancelled plan stays Pro until ${escapeHtml(renewsOn ?? "")} and is not charged again.`,
      `<strong>A second PC.</strong> Install PC Tweaker there and sign in with ${who}. The license is signed for the account, not the machine, so it is Pro on both. Applied controls and Change history stay per machine.`,
      "<strong>After a Windows reinstall or new hardware.</strong> Sign in again and Pro comes back on its own. Change history does not carry over, so re-apply a profile rather than looking for a restore.",
      "<strong>Where to start with Pro.</strong> Gaming, then Game Sessions: register a game and the turbo settings switch on when it launches and are undone when it exits.",
    ],
    noteHtml:
      "Stripe sends the invoice and payment receipt separately, from its own address; keep that one for your records. If the app still says Free after a few minutes, sign out and in once: the license is fetched again at sign-in.",
    help,
    why: `You received this email because a PC Tweaker Pro subscription was started on the account at this address.`,
  };
}

export function proWelcomeText(input: ProWelcomeEmailInput): string {
  const r = receipt(input);
  const brand = brandFor(input.product);
  return [
    r.headline,
    "",
    r.intro,
    "",
    ...r.rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `${r.heading}:`,
    ...r.items.map((s, i) => `${i + 1}. ${plainText(s)}`),
    "",
    plainText(r.noteHtml),
    "",
    `${brand.ctaLabel}: ${brand.visual.siteUrl}`,
  ].join("\n") + textFooter(brand.visual, r.why);
}

export function proWelcomeHtml(input: ProWelcomeEmailInput): string {
  const r = receipt(input);
  const brand = brandFor(input.product);
  return emailShell({
    brand: brand.visual,
    preheader: r.preheader,
    eyebrow: r.eyebrow,
    headline: r.headline,
    intro: r.intro,
    blocks: [
      details(r.rows),
      button({ label: brand.ctaLabel, url: brand.visual.siteUrl }),
      steps(r.heading, r.items),
      note(r.noteHtml),
    ],
    help: r.help,
    why: r.why,
  });
}

export type RefundEmailInput = {
  product?: string | null;
  firstName: string;
  plan: string | null;
  /** e.g. "€99.00"; null when Stripe gave no amount. */
  refundedLabel: string | null;
};

// Digital purchases are not refundable: this notice reports a reversal Stripe
// told us about and never mentions, offers or implies a refund.
const reversedIntro = (brand: ProductBrand, label: string | null) =>
  `${label ? `Your payment of ${label}` : "Your payment"} for ${brand.name} was reversed by your payment provider.`;
const ACCESS_ENDED = "The Pro access that came with this payment has ended. Your account and the free features keep working.";
const STOP_RENEWAL = "If the subscription itself is still active, cancel it from Plans & pricing so it does not renew.";
const ONE_OFF = "This was a one-off purchase, so there is no subscription left to cancel.";
const MISTAKE = "If you think this happened by mistake, reply to this email and we will look at the Stripe record with you.";
const subscriptionPlan = (plan: string | null) => plan === "monthly" || plan === "annual";

/** Uninstaller copy (kit pc-tweaker-uninstaller 02): the reversal touches
 *  Uninstaller only, and its Free side keeps working. */
function uninstallerReversal(firstName: string, plan: string | null, refundedLabel: string | null) {
  const paid = refundedLabel ? `the payment of ${refundedLabel}` : "your payment";
  return {
    preheader: `${refundedLabel ?? "Your payment"} was reversed by your payment provider. Pro has ended; single uninstalls, the Brief and the Ledger keep working.`,
    headline: greet("Your payment was reversed", firstName),
    intro: `Your payment provider reversed ${paid} for PC Tweaker Uninstaller Pro, and Stripe has told us. The Pro entitlement tied to that payment has ended. Your account stays open, and so does the PC Tweaker side of it: this reversal touches Uninstaller only.`,
    rows: [
      ...(refundedLabel ? [["Amount reversed", refundedLabel] as [string, string]] : []),
      ...(plan && PLAN_LABELS[plan] ? [["Plan", PLAN_LABELS[plan]] as [string, string]] : []),
      ["Uninstaller Pro", "Ended"],
      ["Still yours on Free", "Single uninstalls, Confidence Score, Removal Brief, leftover scan, Removal Ledger"],
    ] as [string, string][],
    stops:
      "What stops: leftover cleanup, batch removal and the removal of broken entries. What does not change: anything already removed stays removed, the Removal Ledger keeps every receipt, and files you sent to the Recycle Bin are still there until you empty it.",
    next: subscriptionPlan(plan)
      ? "If the subscription is still listed as active in Stripe, cancel it from Plans & pricing in the top bar so it does not attempt another charge."
      : "This was a one-off entitlement, so there is nothing left to cancel.",
    origin:
      "This reversal came from your bank or card issuer, not from us. If you did not ask your bank for it, reply to this email with the date and amount on your statement and we will go through the Stripe record with you.",
    why: "You received this email because a payment for Uninstaller Pro on the PC Tweaker account at this address was reversed.",
  };
}

export function refundSubject(product?: string | null): string {
  return `Your ${brandFor(product).name} payment was reversed`;
}

/** Sent once per fully reversed charge, after access has been removed. */
export function refundText({ product, firstName, plan, refundedLabel }: RefundEmailInput): string {
  const brand = brandFor(product);
  if (product === "uninstaller") {
    const u = uninstallerReversal(firstName, plan, refundedLabel);
    return [
      u.headline,
      u.intro,
      u.rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
      u.stops,
      u.next,
      u.origin,
    ].join("\n\n") + textFooter(brand.visual, u.why);
  }
  return [
    greet("Your payment was reversed", firstName),
    "",
    reversedIntro(brand, refundedLabel),
    "",
    ACCESS_ENDED,
    "",
    subscriptionPlan(plan) ? STOP_RENEWAL : ONE_OFF,
    "",
    MISTAKE,
  ].join("\n") + textFooter(brand.visual, `You received this email because a payment for ${brand.name} on the account at this address was reversed.`);
}

export function refundHtml({ product, firstName, plan, refundedLabel }: RefundEmailInput): string {
  const brand = brandFor(product);
  if (product === "uninstaller") {
    const u = uninstallerReversal(firstName, plan, refundedLabel);
    return emailShell({
      brand: brand.visual,
      preheader: u.preheader,
      eyebrow: "Payment reversed",
      headline: u.headline,
      intro: u.intro,
      blocks: [details(u.rows), paragraph(escapeHtml(u.stops)), paragraph(escapeHtml(u.next)), note(escapeHtml(u.origin))],
      help: { title: "Questions about this reversal?", text: "Tell us the date and the amount on your bank statement." },
      why: u.why,
    });
  }
  const rows: [string, string][] = [
    ...(refundedLabel ? [["Amount reversed", refundedLabel] as [string, string]] : []),
    ...(plan && PLAN_LABELS[plan] ? [["Plan", PLAN_LABELS[plan]] as [string, string]] : []),
    ["Pro access", "Ended"],
    ["Your account", "Open, on Free"],
  ];
  return emailShell({
    brand: brand.visual,
    preheader: `${reversedIntro(brand, refundedLabel)} Pro access has ended; the free features keep working.`,
    eyebrow: "Payment reversed",
    headline: greet("Your payment was reversed", firstName),
    intro: `${reversedIntro(brand, refundedLabel)} Stripe has notified us, and the Pro access that came with that payment has ended on your account. This email is a record of what changed; it is not a request for anything.`,
    blocks: [
      details(rows),
      paragraph(escapeHtml(`${ACCESS_ENDED} The app drops back to Free the next time it checks the license, usually at the next start or sign-in.`)),
      paragraph(escapeHtml(subscriptionPlan(plan) ? STOP_RENEWAL : ONE_OFF)),
      note(escapeHtml(MISTAKE)),
    ],
    help: {
      title: "Questions about this reversal?",
      text: "Tell us the date and the amount on your bank statement.",
    },
    why: `You received this email because a payment for ${brand.name} on the account at this address was reversed.`,
  });
}
