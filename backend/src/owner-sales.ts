import type Stripe from "stripe";
import { getPool } from "./db";
import { sendMail } from "./mailer";
import { SUPPORT_INBOX } from "./support-inbox";

/**
 * The owner's notice for every money movement on the Stripe account, for every
 * product (PC Tweaker, Uninstaller, Tweaky Driver, Redaxa, Redexa Social,
 * Frame Witness, CertSprint, Glarion, Havenly): they all share one account and
 * this endpoint receives its paid invoices, completed checkouts, refunds and
 * disputes. Stripe's own "payment received" email says only "Subscription
 * update" (28/10/2026: a 4.99 EUR first charge after an Uninstaller trial
 * arrived with no product, plan or invoice number), so each notice names what
 * was sold, why money moved, the invoice or order reference and the links.
 *
 * Subscriptions are announced from their paid invoice (new, first charge after
 * a free trial, renewal, plan change); one-off purchases from their completed
 * Checkout; a trial start (nothing charged yet) from its Checkout. Notices are
 * queued once per Stripe object and delivered by a durable worker, so a mail
 * outage neither loses one nor makes Stripe retry a webhook.
 */

type Fact = [label: string, value: string | null | undefined, href?: string];
export type OwnerNotice = { subject: string; text: string; html: string };
type Lookup = Pick<Stripe, "checkout" | "subscriptions" | "invoices"> | null;

type BasilInvoice = Stripe.Invoice & {
  parent?: { subscription_details?: { subscription?: string | { id: string }; metadata?: Record<string, string> } };
  total_taxes?: { amount: number }[];
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const idOf = (ref: string | { id: string } | null | undefined) => (typeof ref === "string" ? ref : ref?.id) ?? null;

export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
}

export function romeTime(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" })
    .format(new Date(unixSeconds * 1000));
}

/** "1 × PC Tweaker Uninstaller (at €4.99 / year)" -> "PC Tweaker Uninstaller". */
export function productName(lineDescription: string | null | undefined): string | null {
  if (!lineDescription) return null;
  return lineDescription.replace(/^\s*\d+\s*×\s*/, "").replace(/\s*\(at [^)]*\)\s*$/, "").trim() || null;
}

/** "PC Tweaker Uninstaller annual"; the plan is left out when the name already says it. */
function titled(product: string, plan: string | null): string {
  return plan && !product.toLowerCase().includes(plan.toLowerCase()) ? `${product} ${plan}` : product;
}

function dashboard(livemode: boolean, path: string): string {
  return `https://dashboard.stripe.com/${livemode ? "" : "test/"}${path}`;
}

function metadataFacts(...sources: (Record<string, string> | null | undefined)[]): Fact[] {
  const seen = new Map<string, string>();
  // Hashes and device fingerprints help nobody reading a sale notice.
  for (const source of sources)
    for (const [k, v] of Object.entries(source ?? {}))
      if (v && !/device|hash|fingerprint/i.test(k) && !seen.has(k)) seen.set(k, v);
  return [...seen].map(([k, v]) => [`Metadata ${k}`, v]);
}

export function render(subject: string, intro: string, facts: Fact[]): OwnerNotice {
  const shown = facts.filter(([, v]) => v);
  const text = [intro, "", ...shown.map(([k, v, href]) => `${k}: ${v}${href ? ` (${href})` : ""}`)].join("\n");
  const rows = shown
    .map(([k, v, href]) => `<tr><td style="padding:3px 12px 3px 0;color:#666;vertical-align:top">${esc(k)}</td>`
      + `<td style="padding:3px 0">${href ? `<a href="${esc(href)}">${esc(v!)}</a>` : esc(v!)}</td></tr>`)
    .join("");
  return { subject, text, html: `<p>${esc(intro)}</p><table style="border-collapse:collapse;font:14px/1.4 sans-serif">${rows}</table>` };
}

/** Why a subscription invoice was paid, in words. */
export function invoiceReason(reason: string | null | undefined, firstAfterTrial: boolean): string {
  if (reason === "subscription_create") return "New subscription";
  if (reason === "subscription_cycle") return firstAfterTrial ? "First charge after the free trial" : "Renewal";
  if (reason === "subscription_update") return "Plan change (prorated)";
  return "Invoice paid";
}

export async function invoiceNotice(invoice: BasilInvoice, livemode: boolean, stripe: Lookup): Promise<OwnerNotice | null> {
  if ((invoice.amount_paid ?? 0) <= 0) return null;
  const line = invoice.lines?.data?.[0];
  const product = productName(line?.description) ?? "Unknown product";
  const details = invoice.parent?.subscription_details;
  const subscriptionId = idOf(details?.subscription ?? null);
  let firstAfterTrial = false;
  if (invoice.billing_reason === "subscription_cycle" && subscriptionId && stripe) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    // The first cycle invoice of a trialled subscription starts where the trial ended.
    firstAfterTrial = !!sub.trial_end && Math.abs((line?.period?.start ?? 0) - sub.trial_end) < 86_400;
  }
  const reason = invoiceReason(invoice.billing_reason, firstAfterTrial);
  const amount = money(invoice.amount_paid, invoice.currency);
  const tax = (invoice.total_taxes ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const plan = details?.metadata?.plan ?? null;
  const reference = invoice.number ?? invoice.id;
  const customerId = idOf(invoice.customer as string | { id: string } | null);
  return render(
    `${amount} · ${titled(product, plan)} — ${reason} (${reference})`,
    `${reason}: ${amount} for ${product}.`,
    [
      ["Product", product],
      ["Plan", plan ? `${plan}${line?.description ? ` · ${line.description}` : ""}` : line?.description],
      ["Amount paid", tax ? `${amount} (tax ${money(tax, invoice.currency)})` : amount],
      ["Reason", reason],
      ["Invoice", reference, invoice.hosted_invoice_url ?? undefined],
      ["Customer", [invoice.customer_name, invoice.customer_email].filter(Boolean).join(" · ") || null],
      ["Country", invoice.customer_address?.country],
      ["Next renewal", subscriptionId ? romeTime(line?.period?.end) : null],
      ["Paid at", romeTime(invoice.status_transitions?.paid_at ?? invoice.created)],
      ["Stripe invoice", invoice.id, dashboard(livemode, `invoices/${invoice.id}`)],
      ["Stripe subscription", subscriptionId, subscriptionId ? dashboard(livemode, `subscriptions/${subscriptionId}`) : undefined],
      ["Stripe customer", customerId, customerId ? dashboard(livemode, `customers/${customerId}`) : undefined],
      ...metadataFacts(details?.metadata, invoice.metadata as Record<string, string>),
    ],
  );
}

export async function checkoutNotice(session: Stripe.Checkout.Session, livemode: boolean, stripe: Lookup): Promise<OwnerNotice | null> {
  const trial = session.mode === "subscription" && (session.amount_total ?? 0) === 0;
  const paidOnce = session.mode === "payment" && session.payment_status === "paid" && (session.amount_total ?? 0) > 0;
  // A paid subscription Checkout is announced by its first invoice instead.
  if (!trial && !paidOnce) return null;
  let items: { description?: string | null; quantity?: number | null }[] = session.line_items?.data ?? [];
  if (!items.length && stripe) items = (await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 })).data;
  const product = items.map((i) => `${i.quantity && i.quantity > 1 ? `${i.quantity} × ` : ""}${i.description ?? "item"}`).join(", ")
    || session.metadata?.product || "Unknown product";
  const plan = session.metadata?.plan ?? null;
  const customer = session.customer_details;
  const customerId = idOf(session.customer as string | { id: string } | null);
  const paymentId = idOf(session.payment_intent as string | { id: string } | null);
  const subscriptionId = idOf(session.subscription as string | { id: string } | null);
  const invoiceId = idOf(session.invoice as string | { id: string } | null);
  let invoiceNumber: string | null = null;
  if (invoiceId && stripe) invoiceNumber = (await stripe.invoices.retrieve(invoiceId)).number ?? null;
  let firstCharge: string | null = null;
  if (trial && subscriptionId && stripe) firstCharge = romeTime((await stripe.subscriptions.retrieve(subscriptionId)).trial_end);
  const shared: Fact[] = [
    ["Product", product],
    ["Plan", plan],
    ["Customer", [customer?.name, customer?.email].filter(Boolean).join(" · ") || null],
    ["Country", customer?.address?.country],
    ["Checkout", session.id, dashboard(livemode, `checkout/sessions/${session.id}`)],
    ["Stripe customer", customerId, customerId ? dashboard(livemode, `customers/${customerId}`) : undefined],
    ...metadataFacts(session.metadata as Record<string, string>),
  ];
  if (trial) {
    return render(
      `Trial started · ${titled(product, plan)} (no charge yet)`,
      `A free trial of ${product} started. Nothing has been charged yet.`,
      [
        ["Reason", "Free trial started"],
        ["First charge", firstCharge ? `${firstCharge}, unless cancelled before` : null],
        ["Started at", romeTime(session.created)],
        ["Stripe subscription", subscriptionId, subscriptionId ? dashboard(livemode, `subscriptions/${subscriptionId}`) : undefined],
        ...shared,
      ],
    );
  }
  const amount = money(session.amount_total!, session.currency ?? "eur");
  const reference = invoiceNumber ?? paymentId ?? session.id;
  return render(
    `${amount} · ${titled(product, plan)} — One-off purchase (${reference})`,
    `One-off purchase: ${amount} for ${product}.`,
    [
      ["Amount paid", amount],
      ["Reason", "One-off purchase"],
      ["Invoice", invoiceNumber, invoiceId ? dashboard(livemode, `invoices/${invoiceId}`) : undefined],
      ["Paid at", romeTime(session.created)],
      ["Stripe payment", paymentId, paymentId ? dashboard(livemode, `payments/${paymentId}`) : undefined],
      ...shared,
    ],
  );
}

export function refundNotice(charge: Stripe.Charge, livemode: boolean): OwnerNotice | null {
  if (!charge.amount_refunded) return null;
  const amount = money(charge.amount_refunded, charge.currency);
  const paymentId = idOf(charge.payment_intent as string | { id: string } | null);
  const what = charge.description ?? "a payment";
  return render(
    `Refund ${amount} — ${what} (${charge.receipt_number ?? charge.id})`,
    `${amount} was refunded${charge.refunded ? " (in full)" : ""}.`,
    [
      ["Refunded", `${amount} of ${money(charge.amount, charge.currency)}`],
      ["Payment", what],
      ["Customer", [charge.billing_details?.name, charge.billing_details?.email].filter(Boolean).join(" · ") || null],
      ["Receipt", charge.receipt_number, charge.receipt_url ?? undefined],
      ["Stripe payment", paymentId ?? charge.id, dashboard(livemode, `payments/${paymentId ?? charge.id}`)],
      ...metadataFacts(charge.metadata as Record<string, string>),
    ],
  );
}

export function disputeNotice(dispute: Stripe.Dispute, livemode: boolean): OwnerNotice {
  const amount = money(dispute.amount, dispute.currency);
  const paymentId = idOf(dispute.payment_intent as string | { id: string } | null);
  return render(
    `Dispute ${amount} — ${dispute.reason} (${dispute.id})`,
    `A customer disputed ${amount}. Evidence is due by ${romeTime(dispute.evidence_details?.due_by) ?? "the date in Stripe"}.`,
    [
      ["Amount", amount],
      ["Reason", dispute.reason],
      ["Status", dispute.status],
      ["Evidence due", romeTime(dispute.evidence_details?.due_by)],
      ["Stripe dispute", dispute.id, dashboard(livemode, `disputes/${dispute.id}`)],
      ["Stripe payment", paymentId, paymentId ? dashboard(livemode, `payments/${paymentId}`) : undefined],
    ],
  );
}

/** The notice an event deserves and its once-only key, or null. */
export async function ownerNoticeFor(event: Stripe.Event, stripe: Lookup): Promise<{ key: string; notice: OwnerNotice } | null> {
  const object = event.data.object as { id: string };
  let notice: OwnerNotice | null = null;
  let key = "";
  switch (event.type) {
    case "invoice.paid":
      key = `invoice:${object.id}`;
      notice = await invoiceNotice(object as BasilInvoice, event.livemode, stripe);
      break;
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      // Both events of one Checkout share a key, so a delayed payment is told once.
      key = `checkout:${object.id}`;
      notice = await checkoutNotice(object as Stripe.Checkout.Session, event.livemode, stripe);
      break;
    case "charge.refunded": {
      const charge = object as Stripe.Charge;
      key = `refund:${charge.id}:${charge.amount_refunded}`;
      notice = refundNotice(charge, event.livemode);
      break;
    }
    case "charge.dispute.created":
      key = `dispute:${object.id}`;
      notice = disputeNotice(object as Stripe.Dispute, event.livemode);
      break;
  }
  return notice ? { key, notice } : null;
}

/** Queue the event's notice once. Never throws: the payment itself is already
 * recorded, and a notice must not make Stripe retry the webhook. If Stripe
 * cannot be read for the details, the notice goes out with what the event
 * itself carries. */
export async function queueOwnerNotice(event: Stripe.Event, stripe: Lookup): Promise<void> {
  try {
    const found = await ownerNoticeFor(event, stripe).catch((err: Error) => {
      console.error(`owner notice details unavailable for ${event.id}:`, err.message);
      return ownerNoticeFor(event, null);
    });
    if (!found) return;
    await getPool().query(
      `INSERT INTO owner_notices (notice_key, payload, next_attempt_at) VALUES ($1, $2, $3) ON CONFLICT (notice_key) DO NOTHING`,
      [found.key, JSON.stringify(found.notice), new Date()],
    );
  } catch (err) {
    console.error("SALE NOTICE LOST — could not queue the owner's notice:", (err as Error).message);
  }
}

/** Sends due notices; a failure is retried with backoff, never lost. Each row
 * is claimed by pushing next_attempt_at forward, so two API instances never
 * send the same one twice. */
export async function deliverOwnerNotices(
  send: (n: OwnerNotice) => Promise<void> = async (n) => { await sendMail({ to: SUPPORT_INBOX, ...n }); },
  now = new Date(),
): Promise<number> {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT notice_key FROM owner_notices WHERE delivered_at IS NULL AND next_attempt_at <= $1
     ORDER BY next_attempt_at LIMIT 5`, [now],
  );
  let delivered = 0;
  for (const { notice_key } of rows) {
    const claimed = await db.query(
      `UPDATE owner_notices SET attempts = attempts + 1, next_attempt_at = $2
       WHERE notice_key = $1 AND delivered_at IS NULL AND next_attempt_at <= $3 RETURNING payload, attempts`,
      [notice_key, new Date(now.getTime() + 10 * 60_000), now],
    );
    if (!claimed.rows.length) continue;
    const { payload, attempts } = claimed.rows[0];
    try {
      await send(payload as OwnerNotice);
      await db.query(`UPDATE owner_notices SET delivered_at = $2 WHERE notice_key = $1`, [notice_key, new Date()]);
      delivered++;
    } catch (err) {
      const delay = Math.min(6 * 3600_000, 30_000 * 2 ** Math.min(attempts, 10));
      await db.query(`UPDATE owner_notices SET next_attempt_at = $2 WHERE notice_key = $1`,
        [notice_key, new Date(now.getTime() + delay)]);
      console.error("owner sale notice not sent; retry scheduled:", (err as Error).message);
    }
  }
  return delivered;
}

export function startOwnerNoticeWorker(): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    deliverOwnerNotices().catch((err) => console.error("owner notice worker failed:", err)).finally(() => { running = false; });
  }, 30_000);
  timer.unref();
  return () => clearInterval(timer);
}
