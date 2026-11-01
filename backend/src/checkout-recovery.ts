import { getPool } from "./db";
import { button, details, EMAIL_BRANDS, emailShell, escapeHtml, mutedLink, note, paragraph, textFooter } from "./emails/layout";
import { en } from "./emails/copy/en";
import { copyFor, type Copy } from "./emails/copy";
import { isKnownProduct, productEntitlement, type Product } from "./products";
import { CATALOGUE } from "./emails/pro-welcome";
import { listUnsubscribeHeaders, unsubscribeUrl } from "./routes/newsletter";

/** An expired Checkout Session, reduced to what the reminder needs. */
export type ExpiredCheckout = {
  id: string;
  mode: string;
  userId: string | null;
  plan?: string;
  product?: string;
};

export type ReminderRecipient = { email: string; firstName: string | null; unsubscribeUrl: string | null };

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * One reminder for an abandoned PC Tweaker Lifetime checkout, and only to an
 * account holder who verified their email, still isn't Pro and never opted
 * out. At most one per person every 30 days, claimed in the database before
 * sending so two instances can't both mail. A failed send is not retried:
 * for a reminder, missing one beats sending two.
 */
export async function remindAbandonedLifetime(
  sessions: ExpiredCheckout[],
  send: (to: ReminderRecipient) => Promise<void>,
  now = new Date(),
): Promise<number> {
  const db = getPool();
  const cutoff = new Date(now.getTime() - COOLDOWN_MS);
  let sent = 0;
  for (const session of sessions) {
    if (session.mode !== "payment" || session.plan !== "lifetime" || session.product !== "pctweaker") continue;
    if (!session.userId || !/^\d+$/.test(session.userId)) continue;
    const { rows } = await db.query(
      "SELECT email, first_name FROM users WHERE id = $1 AND email_verified AND NOT is_pro",
      [session.userId],
    );
    if (!rows.length) continue;
    const optedOut = await db.query(
      "SELECT 1 FROM newsletter_subscribers WHERE lower(email) = lower($1) AND unsubscribed_at IS NOT NULL",
      [rows[0].email],
    );
    if (optedOut.rows.length) continue;
    // Each statement is atomic, so a concurrent instance either inserts first
    // or finds the fresh sent_at and claims nothing. The row is ours only if it
    // carries this session and this run's timestamp.
    const ours = (rows: { session_id: string; sent_at: Date }[]) =>
      rows.some((r) => r.session_id === session.id && new Date(r.sent_at).getTime() === now.getTime());
    const inserted = await db.query(
      `INSERT INTO checkout_reminders (user_id, session_id, sent_at) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO NOTHING RETURNING session_id, sent_at`,
      [session.userId, session.id, now],
    );
    if (!ours(inserted.rows)) {
      const renewed = await db.query(
        `UPDATE checkout_reminders SET session_id = $2, sent_at = $3
         WHERE user_id = $1 AND sent_at < $4 RETURNING session_id, sent_at`,
        [session.userId, session.id, now, cutoff],
      );
      if (!ours(renewed.rows)) continue;
    }
    try {
      await send({ email: rows[0].email, firstName: rows[0].first_name, unsubscribeUrl: unsubscribeUrl(rows[0].email) });
      sent++;
    } catch {
      console.error("Lifetime checkout reminder failed; not retried");
    }
  }
  return sent;
}

export function lifetimeReminderEmail(to: ReminderRecipient, c: Copy = en) {
  const x = c.reminder;
  const headline = x.headline(to.firstName?.trim().split(/\s+/)[0] ?? "");
  return {
    to: to.email,
    subject: x.subject,
    ...(to.unsubscribeUrl ? { headers: listUnsubscribeHeaders(to.unsubscribeUrl) } : {}),
    html: emailShell({
      c,
      preheader: x.preheader,
      eyebrow: x.eyebrow,
      headline,
      intro: x.intro,
      blocks: [
        details(x.rows(CATALOGUE.total)),
        button({ label: x.button, url: "https://pctweaker.app" }),
        paragraph(escapeHtml(x.retry)),
        note(escapeHtml(x.doubts)),
      ],
      help: { title: x.helpTitle, text: escapeHtml(x.helpText) },
      why: x.why,
      whyHtml: to.unsubscribeUrl ? mutedLink(to.unsubscribeUrl, x.unsubscribe) : "",
    }),
    text:
      [headline, x.intro, x.retry, x.doubts, `${x.why}${to.unsubscribeUrl ? ` ${c.shell.unsubscribe}: ${to.unsubscribeUrl}` : ""}`].join("\n\n") +
      textFooter(undefined, "", c),
  };
}

/** Hourly. The 21-day look-back stays inside the 30-day cooldown, so one
 * abandoned checkout can never earn a second reminder. */
export function startCheckoutReminderWorker(
  listExpired: (sinceSeconds: number) => Promise<ExpiredCheckout[]>,
  send: (to: ReminderRecipient) => Promise<void>,
): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const since = Math.floor(Date.now() / 1000) - 21 * 24 * 60 * 60;
      await remindAbandonedLifetime(await listExpired(since), send);
    } catch {
      console.error("Checkout reminder worker failed; will retry");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => { void tick(); }, 60 * 60 * 1000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}

/** A Checkout payment that was declined or blocked, with the session it
 * belonged to (routes/stripe.ts, listFailedCheckouts). */
export type FailedCheckout = {
  sessionId: string;
  status: string | null;
  userId: string | null;
  plan?: string;
  product?: string;
  /** A coffee: never followed up. */
  tip: boolean;
  /** Paid in USDC: the card advice in the email would not fit. */
  crypto: boolean;
  /** The latest refusal in this session. */
  failedAt: Date;
};

export type FailureRecipient = { email: string; firstName: string | null; locale: string | null; product: Product; plan: string };

const PLANS = new Set(["monthly", "annual", "lifetime"]);
/** Time to retry on Stripe's own page before we write. */
const SETTLE_MS = 30 * 60 * 1000;
/** Older refusals are left alone: a day-old "try again" reads as noise. It is
 * also shorter than the cooldown, so a refusal can never earn a second email
 * once the first one's 24 hours are up. */
export const FAILURE_WINDOW_MS = 6 * 60 * 60 * 1000;
const NOTICE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Where "Resume checkout" goes: the site's purchase panel opened on the same
 * plan (sign-in, then the guarded checkout), or the Uninstaller's plan card,
 * which is bought from the app. Never a pre-made Stripe session. */
export function resumeCheckoutUrl(product: unknown, plan: unknown): string {
  if (product === "uninstaller") return "https://pctweaker.app/uninstaller/#uninstaller-pro";
  return typeof plan === "string" && PLANS.has(plan) ? `https://pctweaker.app/#buy-${plan}` : "https://pctweaker.app/#access";
}

/**
 * One email when a signed-in customer's Checkout payment was declined or
 * blocked (Stripe's network-level fraud screening included), so a refused
 * card does not cost us the customer. Only for account checkouts of a known
 * product and plan, never for tips; only once the customer has had 30
 * minutes to retry on Stripe's page; never when the session completed or the
 * account has the product by now. At most one per account, product and plan
 * every 24 hours, claimed in the database before sending (same pattern as
 * the Lifetime reminder above), and a failed send is not retried.
 */
export async function noticeFailedCheckouts(
  failures: FailedCheckout[],
  send: (to: FailureRecipient) => Promise<void>,
  now = new Date(),
): Promise<number> {
  const db = getPool();
  const cutoff = new Date(now.getTime() - NOTICE_COOLDOWN_MS);
  let sent = 0;
  for (const f of failures) {
    if (f.tip || f.crypto || f.status === "complete") continue;
    if (!f.userId || !/^\d+$/.test(f.userId) || !isKnownProduct(f.product) || !f.plan || !PLANS.has(f.plan)) continue;
    const age = now.getTime() - f.failedAt.getTime();
    if (age < SETTLE_MS || age > FAILURE_WINDOW_MS) continue;
    const { rows } = await db.query("SELECT email, first_name, locale FROM users WHERE id = $1 AND email_verified", [f.userId]);
    if (!rows.length) continue;
    // Paid since, with another card or another plan: nothing to recover.
    if ((await productEntitlement(f.userId, f.product)).active) continue;
    const key = [f.userId, f.product, f.plan];
    const ours = (claimed: { session_id: string; sent_at: Date }[]) =>
      claimed.some((r) => r.session_id === f.sessionId && new Date(r.sent_at).getTime() === now.getTime());
    const inserted = await db.query(
      `INSERT INTO checkout_failure_notices (user_id, product, plan, session_id, sent_at) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, product, plan) DO NOTHING RETURNING session_id, sent_at`,
      [...key, f.sessionId, now],
    );
    if (!ours(inserted.rows)) {
      const renewed = await db.query(
        `UPDATE checkout_failure_notices SET session_id = $4, sent_at = $5
         WHERE user_id = $1 AND product = $2 AND plan = $3 AND sent_at < $6 AND session_id <> $4 RETURNING session_id, sent_at`,
        [...key, f.sessionId, now, cutoff],
      );
      if (!ours(renewed.rows)) continue;
    }
    try {
      await send({ email: rows[0].email, firstName: rows[0].first_name, locale: rows[0].locale ?? null, product: f.product, plan: f.plan });
      sent++;
    } catch {
      console.error("Failed-payment notice not delivered; not retried");
    }
  }
  return sent;
}

export function paymentFailedEmail(to: FailureRecipient, c: Copy = copyFor(to.locale)) {
  const x = c.paymentFailed;
  const brand = EMAIL_BRANDS[to.product];
  const url = resumeCheckoutUrl(to.product, to.plan);
  const headline = x.headline(to.firstName?.trim().split(/\s+/)[0] ?? "");
  return {
    to: to.email,
    subject: x.subject(brand.name),
    html: emailShell({
      c,
      brand,
      preheader: x.preheader,
      eyebrow: x.eyebrow,
      headline,
      intro: x.intro(brand.name),
      blocks: [paragraph(escapeHtml(x.retry)), button({ label: x.button, url }), note(escapeHtml(x.app))],
      help: { title: x.helpTitle, text: escapeHtml(x.helpText) },
      why: x.why,
    }),
    text: [headline, x.intro(brand.name), x.retry, `${x.button}: ${url}`, x.app].join("\n\n") + textFooter(brand, x.why, c),
  };
}

/** Every 10 minutes, over the last FAILURE_WINDOW_MS of refusals. */
export function startFailedPaymentWorker(
  listFailed: (sinceSeconds: number) => Promise<FailedCheckout[]>,
  send: (to: FailureRecipient) => Promise<void>,
): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await noticeFailedCheckouts(await listFailed(Math.floor((Date.now() - FAILURE_WINDOW_MS) / 1000)), send);
    } catch {
      console.error("Failed-payment worker failed; will retry");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => { void tick(); }, 10 * 60 * 1000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}

type SessionLike = { id: string; mode: string | null; status: string | null; created: number; client_reference_id: string | null; metadata: Record<string, string> | null };
type RefusedIntent = { id: string; created: number; customer: string | { id: string } | null; description: string | null };

/**
 * The Checkout Session a refused PaymentIntent belongs to, or null.
 * One-off payments (Lifetime, tips) carry the intent on the session. A
 * subscription's first payment is the intent of the invoice Checkout opens
 * ("Subscription creation"), with no metadata and no link back, so it is the
 * customer's latest subscription session opened before it; Checkout makes a
 * new customer per session unless the account already has one. Renewals
 * ("Subscription update") are left to invoice.payment_failed.
 */
export async function checkoutOfFailedPayment(
  list: (params: Record<string, unknown>) => Promise<{ data: SessionLike[] }>,
  intent: RefusedIntent,
): Promise<SessionLike | null> {
  const { data: [byIntent] } = await list({ payment_intent: intent.id, limit: 1 });
  if (byIntent) return byIntent;
  const customer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
  if (intent.description !== "Subscription creation" || !customer) return null;
  const { data } = await list({ customer, limit: 10 });
  return data
    .filter((s) => s.mode === "subscription" && s.created <= intent.created)
    .sort((a, b) => b.created - a.created)[0] ?? null;
}

export function failedCheckout(session: SessionLike, failedAtSeconds: number): FailedCheckout {
  return {
    sessionId: session.id,
    status: session.status,
    userId: session.client_reference_id,
    plan: session.metadata?.plan,
    product: session.metadata?.product,
    tip: Boolean(session.metadata?.tip_product),
    crypto: session.metadata?.pay_with === "crypto",
    failedAt: new Date(failedAtSeconds * 1000),
  };
}
