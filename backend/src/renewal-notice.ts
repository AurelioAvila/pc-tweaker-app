import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import type Stripe from "stripe";
import { address } from "./email-relay";
import { orderId, queueMail, type QueuedMail } from "./owner-sales";
import { SUPPORT_INBOX } from "./support-inbox";
import { en } from "./emails/copy/en";
import type { Copy } from "./emails/copy";
import { EMAIL_BRANDS, button, details, emailShell, linkFallback, note, plainText, steps, textFooter, type EmailBrand } from "./emails/layout";

/**
 * California's automatic-renewal notice, and nothing else: owner rule of
 * 31/10/2026, no renewal reminders; exception of 1/11/2026, "solo per la
 * California". Cal. Bus. & Prof. Code §17602(b)(2) asks for a notice 15 to 45
 * days before a subscription with a term of a year or more renews, stating
 * what renews, for how long, the charge, how to cancel with a link to the
 * cancellation step, and how to reach the business ((a)(8)(A)-(F)).
 *
 * Every product sells on the one Stripe account and this endpoint receives
 * its `invoice.upcoming`, sent N days before each renewal (Settings, Billing,
 * Subscriptions and emails, "Upcoming renewal events": 30). Only an active
 * subscription billed yearly or longer, whose billing address is US-CA, gets
 * the notice; one per subscription and renewal date, through the durable
 * outbox. Stripe's own upcoming-renewal emails are switched off. Under
 * Managed Payments Link still sends its own anniversary notice to every
 * annual subscriber; this one is ours, with the direct cancellation link.
 */

type Brand = { brand: EmailBrand; copy: Copy; portal?: string };

const LIGHT = { buttonText: "#ffffff", googleFonts: "" };
const ONE_ACCOUNT = en; // the family footer line is true for these three
const STANDALONE: Copy = { ...en, shell: { ...en.shell, family: "" } };

/** Products with yearly prices on the account. `portal`: the product's own
 * customer-portal configuration (live); the account default otherwise. */
export const RENEWAL_PRODUCTS: Record<string, Brand> = {
  pctweaker: { brand: EMAIL_BRANDS.pctweaker, copy: ONE_ACCOUNT },
  uninstaller: { brand: EMAIL_BRANDS.uninstaller, copy: ONE_ACCOUNT },
  "tweaky-driver": {
    copy: ONE_ACCOUNT, portal: "bpc_1UHXatGdoWjZBiDjDV3RyeG8",
    brand: {
      ...LIGHT, name: "Tweaky Driver", bg: "#f4f7fb", card: "#ffffff", panel: "#eef3fa", line: "#dce5f0", ink: "#14213d", muted: "#53647b",
      accent: "#1761c5", accentText: "#1761c5", accentTextDark: "#1761c5",
      display: "'Segoe UI Variable Text','Segoe UI',Arial,sans-serif", body: "'Segoe UI Variable Text','Segoe UI',Arial,sans-serif",
      siteUrl: "https://pctweaker.app/tweaky-driver/", siteLabel: "pctweaker.app/tweaky-driver",
      privacyUrl: "https://pctweaker.app/privacy/", termsUrl: "https://pctweaker.app/terms/",
      supportEmail: "tweakydriver@pctweaker.app", logoUrl: "https://pctweaker.app/email/tweaky-driver.png",
    },
  },
  redaxa: {
    copy: STANDALONE, portal: "bpc_1UQoPkGdoWjZBiDjZnPZVOAI",
    brand: {
      ...LIGHT, name: "Redaxa", bg: "#f2f0ea", card: "#f7f6f2", panel: "#ffffff", line: "#e3dfd5", ink: "#1b1724", muted: "#5a5466",
      accent: "#a3471d", accentText: "#a3471d", accentTextDark: "#a3471d",
      display: "'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif", body: "'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif",
      siteUrl: "https://redaxa.getcertsprint.com", siteLabel: "redaxa.getcertsprint.com",
      privacyUrl: "https://redaxa.getcertsprint.com/privacy.html", termsUrl: "https://redaxa.getcertsprint.com/terms.html",
      supportEmail: "redaxa@getcertsprint.com", supportUrl: "mailto:redaxa@getcertsprint.com",
      logoUrl: "https://redaxa.getcertsprint.com/outputs/redaxa-mark-128.png",
    },
  },
  glarion: {
    copy: STANDALONE, portal: "bpc_1UQixXGdoWjZBiDjCNEdAsgC",
    brand: {
      ...LIGHT, name: "Glarion", bg: "#faf7fb", card: "#ffffff", panel: "#f2edf8", line: "#dcd2e5", ink: "#2d103a", muted: "#695174",
      accent: "#7345b2", accentText: "#7345b2", accentTextDark: "#7345b2", googleFonts: "family=Manrope:wght@400;600;700",
      display: "Manrope,'Segoe UI',Arial,sans-serif", body: "Manrope,'Segoe UI',Arial,sans-serif",
      siteUrl: "https://glarion.app", siteLabel: "glarion.app",
      privacyUrl: "https://glarion.app/privacy.html", termsUrl: "https://glarion.app/terms.html",
      supportEmail: "hello@glarion.app", supportUrl: "mailto:hello@glarion.app", logoUrl: "https://glarion.app/glarion-mark-180.png",
    },
  },
};

type Address = Stripe.Address | null | undefined;
type Sub = Stripe.Subscription & {
  managed_payments?: { enabled?: boolean } | null;
  presentment_details?: { presentment_currency?: string } | null;
  items: { data: (Stripe.SubscriptionItem & { current_period_end?: number })[] };
};
type UpcomingInvoice = Stripe.Invoice & {
  parent?: { subscription_details?: { subscription?: string | { id: string } } } | null;
  subscription?: string | { id: string } | null;
};
export type RenewalStripe = {
  subscriptions: Pick<Stripe["subscriptions"], "retrieve">;
  billingPortal?: { sessions: Pick<Stripe["billingPortal"]["sessions"], "create"> };
};

const idOf = (ref: string | { id: string } | null | undefined) => (typeof ref === "string" ? ref : ref?.id) ?? null;
const obj = <T>(ref: unknown): T | null => (ref && typeof ref === "object" ? (ref as T) : null);
const EXPAND = ["customer", "customer.invoice_settings.default_payment_method", "default_payment_method", "latest_invoice", "items.data.price.product"];

/** Which catalogue entry a subscription belongs to: its own tag, else the Stripe product's name. */
export function renewalProduct(sub: Sub): string | null {
  const tag = sub.metadata?.product;
  if (tag && RENEWAL_PRODUCTS[tag]) return tag;
  const name = obj<Stripe.Product>(sub.items?.data?.[0]?.price?.product)?.name ?? "";
  if (/^PC Tweaker Uninstaller/i.test(name)) return "uninstaller";
  const key = Object.keys(RENEWAL_PRODUCTS).find((k) => name.toLowerCase().startsWith(RENEWAL_PRODUCTS[k].brand.name.toLowerCase()));
  return key ?? null;
}

/** The billing address that decides the state: the customer's, else the
 * default card's, else the latest invoice's, else this invoice's. The first
 * one with a country decides the country; a US one without a state borrows
 * the state from the next US address. */
export function billingAddress(sources: Address[]): { country: string; state: string } | null {
  const known = sources.filter((a): a is Stripe.Address => !!a?.country);
  if (!known.length) return null;
  const country = known[0].country!.toUpperCase();
  const state = known.find((a) => a.country!.toUpperCase() === country && a.state)?.state ?? "";
  return { country, state: state.trim().toUpperCase() };
}

export function isCalifornia(a: { country: string; state: string } | null): boolean {
  return a?.country === "US" && (a.state === "CA" || a.state === "CALIFORNIA");
}

/** Billed every year or longer: a term California treats as "one year or longer". */
export function termYears(price: Stripe.Price | null | undefined): number {
  const r = price?.recurring;
  if (!r) return 0;
  const count = r.interval_count || 1;
  if (r.interval === "year") return count;
  if (r.interval === "month" && count % 12 === 0) return count / 12;
  return 0;
}

function secret(): string {
  const key = process.env.JWT_SECRET;
  if (!key) throw new Error("JWT_SECRET is not configured; the cancellation link cannot be signed");
  return key;
}
const sign = (sub: string, expires: number) => createHmac("sha256", secret()).update(`ca-renewal-cancel:${sub}:${expires}`).digest("hex");

/** The email's cancellation link: signed, for one subscription, valid until a
 * month after the renewal, so it still works for a late cancellation. */
export function cancelLink(sub: string, renewsAt: number): string {
  const expires = renewsAt + 30 * 86_400;
  const api = (process.env.PUBLIC_API_URL || "https://api.pctweaker.app").replace(/\/$/, "");
  return `${api}/api/billing/renewal/cancel?s=${encodeURIComponent(sub)}&e=${expires}&t=${sign(sub, expires)}`;
}

export function verifyCancelLink(s: unknown, e: unknown, t: unknown, now = Date.now()): "ok" | "invalid" | "expired" {
  if (typeof s !== "string" || !/^sub_[A-Za-z0-9]{8,64}$/.test(s) || typeof e !== "string" || !/^\d{9,11}$/.test(e) || typeof t !== "string") return "invalid";
  const want = Buffer.from(sign(s, Number(e)));
  const got = Buffer.from(t);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return "invalid";
  return Number(e) * 1000 < now ? "expired" : "ok";
}

const day = (unix: number) =>
  new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(unix * 1000));
const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);

function cardLabel(pm: Stripe.PaymentMethod | null): string | null {
  if (pm?.card?.last4) return `${pm.card.brand ? pm.card.brand[0].toUpperCase() + pm.card.brand.slice(1) : "Card"} ending ${pm.card.last4}`;
  if (pm?.type === "link") return "Link";
  return null;
}

export type RenewalNotice = { key: string; mail: QueuedMail & { to: string } };

/** The notice an `invoice.upcoming` deserves, or null. Throws when Stripe
 * cannot be read, so the webhook fails and Stripe sends the event again. */
export async function caRenewalNoticeFor(event: Stripe.Event, stripe: RenewalStripe | null): Promise<RenewalNotice | null> {
  if (event.type !== "invoice.upcoming") return null;
  const invoice = event.data.object as UpcomingInvoice;
  const subId = idOf(invoice.parent?.subscription_details?.subscription ?? invoice.subscription);
  if (!subId) return null;
  if (!stripe) throw new Error("Stripe is not configured; the renewal could not be checked");
  const sub = (await stripe.subscriptions.retrieve(subId, { expand: EXPAND })) as unknown as Sub;
  const item = sub.items?.data?.[0];
  const years = termYears(item?.price);
  const customer = obj<Stripe.Customer & { deleted?: boolean }>(sub.customer);
  const latest = obj<Stripe.Invoice>(sub.latest_invoice);
  const defaultPm = obj<Stripe.PaymentMethod>(sub.default_payment_method) ?? obj<Stripe.PaymentMethod>(customer?.invoice_settings?.default_payment_method);
  const where = billingAddress([customer?.address, defaultPm?.billing_details?.address, latest?.customer_address, invoice.customer_address]);
  const renewsAt = invoice.lines?.data?.[0]?.period?.start ?? item?.current_period_end ?? 0;
  const skip = (why: string) => { console.log(`invoice.upcoming ${subId}: no California notice (${why})`); return null; };
  if (!years) return skip(`billed every ${item?.price?.recurring?.interval_count ?? "?"} ${item?.price?.recurring?.interval ?? "?"}`);
  if (!isCalifornia(where)) return skip(`billing address ${where ? `country ${where.country}, state ${where.state || "?"}` : "unknown"}`);
  if (!["active", "past_due"].includes(sub.status)) return skip(`status ${sub.status}`);
  if (sub.cancel_at_period_end || (sub.cancel_at && sub.cancel_at <= renewsAt)) return skip("already set to end");
  if (!renewsAt) throw new Error(`No renewal date for ${subId}`);
  const product = renewalProduct(sub);
  const to = customer && !customer.deleted ? customer.email ?? invoice.customer_email : invoice.customer_email;
  if (!product || !to) {
    // A California renewal we cannot tell about: the owner must, by hand.
    const why = !product ? `product "${obj<Stripe.Product>(item?.price?.product)?.name ?? "?"}" has no brand in renewal-notice.ts` : "the customer has no email address";
    console.error(`CALIFORNIA RENEWAL NOTICE NOT SENT for ${subId}: ${why}`);
    return {
      key: `ca-renewal-missing:${subId}:${renewsAt}`,
      mail: {
        to: SUPPORT_INBOX,
        subject: `Action needed: California renewal notice not sent · ${orderId(subId)}`,
        text: `Subscription ${subId} renews on ${day(renewsAt)} and the billing address is in California, so the law asks for a renewal notice 15 to 45 days before. It was not sent: ${why}. Send it by hand or fix the mapping.\nhttps://dashboard.stripe.com/subscriptions/${subId}`,
        html: `<p>Subscription <a href="https://dashboard.stripe.com/subscriptions/${subId}">${subId}</a> renews on ${day(renewsAt)} and the billing address is in California, so the law asks for a renewal notice 15 to 45 days before. It was not sent: ${why.replace(/[<>&"]/g, "")}. Send it by hand or fix the mapping.</p>`,
      },
    };
  }
  const { brand: b, copy } = RENEWAL_PRODUCTS[product];
  const amount = money(invoice.amount_due ?? (item?.price?.unit_amount ?? 0) * (item?.quantity ?? 1), invoice.currency ?? item?.price?.currency ?? "eur");
  const presented = sub.presentment_details?.presentment_currency;
  const foreign = presented && presented.toLowerCase() !== (invoice.currency ?? "").toLowerCase() ? presented.toUpperCase() : null;
  const stripeName = obj<Stripe.Product>(item?.price?.product)?.name ?? b.name;
  const plan = `${stripeName.replace(/\s*[—–-]?\s*annual[e]?$/i, "").trim() || b.name}, ${years === 1 ? "Annual" : `${years}-year`}`;
  const date = day(renewsAt);
  const every = years === 1 ? "year" : `${years} years`;
  const link = cancelLink(subId, renewsAt);
  const order = orderId(subId);
  const card = cardLabel(defaultPm);

  const rows: [string, string][] = [
    ["Plan", plan],
    ["Renews on", date],
    ["Renewal term", years === 1 ? "1 year, then every year until you cancel" : `${years} years, then every ${years} years until you cancel`],
    ["Charge", foreign ? `${amount} per ${every}, charged in ${foreign} at the exchange rate on the renewal date` : `${amount} per ${every}`],
    ...(card ? [["Payment method", card] as [string, string]] : []),
    ["Order ID", order],
  ];
  const how = [
    "Open the cancellation link above. It goes straight to the cancellation step for this subscription on Stripe's secure billing page; confirm there and the plan will not renew.",
    ...(sub.managed_payments?.enabled ? ["Or cancel from your Link account at link.com, where this purchase is listed as sold through Link."] : []),
    `Or reply to this email before ${date} and we will cancel it for you.`,
  ];
  const keep = `If you cancel, nothing more is charged and your plan stays active until ${date}.`;
  const why = `You are receiving this because your ${b.name} plan renews automatically and your billing address is in California.`;
  const intro = `Your ${b.name} subscription renews automatically for another ${every} on ${date}. On that day ${amount} is charged to your payment method on file. To keep it, there is nothing to do; to stop it, cancel before that date.`;
  const help = { title: "Questions about this renewal?", text: "We can explain the charge or cancel the renewal for you." };

  const html = emailShell({
    preheader: `${amount} for another ${every} unless you cancel before ${date}. The button below opens the cancellation step.`,
    eyebrow: "Renewal notice",
    headline: `Your plan renews on ${date}`,
    intro,
    blocks: [details(rows), button({ label: "Cancel the renewal", url: link }), linkFallback(link), steps("How to cancel", how), note(keep)],
    help,
    why,
    brand: b,
    c: copy,
  });
  const text = [
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Cancel the renewal: ${link}`,
    "",
    "How to cancel:",
    ...how.map((step, i) => `${i + 1}. ${plainText(step)}`),
    "",
    keep,
    textFooter(b, why, copy),
  ].join("\n");
  const key = `ca-renewal:${subId}:${renewsAt}`;
  return {
    key,
    mail: {
      to,
      from: `${b.name} <${address(process.env.MAIL_FROM || "noreply@pctweaker.app").email}>`,
      replyTo: b.supportEmail,
      subject: `Your ${b.name} plan renews on ${date}`,
      text,
      html,
      idempotencyKey: key,
    },
  };
}

/** Queues the notice once per subscription and renewal date (a replayed
 * event finds the row and stops). Throws on Stripe or database errors. */
export async function queueCaRenewalNotice(event: Stripe.Event, stripe: RenewalStripe | null): Promise<void> {
  if (event.type !== "invoice.upcoming") return;
  const found = await caRenewalNoticeFor(event, stripe);
  if (!found) return;
  const queued = await queueMail(found.key, found.mail);
  console.log(`California renewal notice ${queued ? "queued" : "already queued, not repeated"}: ${found.key}`);
}

/** GET /api/billing/renewal/cancel: the email's link. Opens Stripe's customer
 * portal at the cancellation step of that subscription, with the product's
 * own portal; falls back to the portal's home when the subscription can no
 * longer be cancelled there (already ending), then to the account default. */
export function renewalCancelRoute(stripe: () => RenewalStripe | null) {
  return async (req: Request, res: Response) => {
    const { s, e, t } = req.query;
    const state = verifyCancelLink(s, e, t);
    res.type("text/plain");
    if (state === "invalid") return void res.status(404).send("This cancellation link is not valid. Reply to the renewal email and we will cancel the subscription for you.");
    if (state === "expired") return void res.status(410).send("This cancellation link has expired. Reply to the renewal email and we will cancel the subscription for you.");
    const api = stripe();
    if (!api?.billingPortal) return void res.status(503).send("Billing is not available right now. Reply to the renewal email and we will cancel the subscription for you.");
    try {
      const sub = (await api.subscriptions.retrieve(s as string, { expand: ["items.data.price.product"] })) as unknown as Sub;
      const entry = RENEWAL_PRODUCTS[renewalProduct(sub) ?? ""];
      const customer = idOf(sub.customer as string | { id: string });
      if (!customer) throw new Error("subscription has no customer");
      const base = { customer, return_url: entry?.brand.siteUrl ?? "https://pctweaker.app" };
      const own = entry?.portal ? { configuration: entry.portal } : {};
      const attempts = [
        { ...base, ...own, flow_data: { type: "subscription_cancel" as const, subscription_cancel: { subscription: sub.id } } },
        { ...base, ...own },
        base,
      ];
      for (const [i, params] of attempts.entries()) {
        try {
          const session = await api.billingPortal.sessions.create(params);
          return void res.redirect(303, session.url);
        } catch (err) {
          if (i === attempts.length - 1) throw err;
        }
      }
    } catch (err) {
      console.error("renewal cancel link: portal not opened for %s: %s", String(s), (err as Error).message);
      res.status(502).send("Stripe's billing page could not be opened just now. Try again in a minute, or reply to the renewal email and we will cancel the subscription for you.");
    }
  };
}
