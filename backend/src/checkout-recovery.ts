import { getPool } from "./db";
import { unsubscribeUrl } from "./routes/newsletter";

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

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function lifetimeReminderEmail(to: ReminderRecipient) {
  const greeting = to.firstName ? `Hi ${to.firstName.trim()},` : "Hi,";
  const lines = [
    "Your PC Tweaker Lifetime checkout closed before payment, so nothing was charged.",
    "If you still want it, open PC Tweaker, go to Plans and choose Lifetime: one payment, Pro for good, no renewals.",
    "If something got in the way, such as a payment method or a question about what Pro includes, just reply to this email.",
  ];
  const footer = "This is the only reminder about this checkout.";
  const unsubscribe = to.unsubscribeUrl
    ? `<p style="font-size:12px;color:#888">${footer} Don't want emails like this? <a href="${escapeHtml(to.unsubscribeUrl)}">Unsubscribe with one click</a>.</p>`
    : `<p style="font-size:12px;color:#888">${footer}</p>`;
  return {
    to: to.email,
    subject: "Your PC Tweaker Lifetime checkout",
    html: `<p>${escapeHtml(greeting)}</p>${lines.map((l) => `<p>${l}</p>`).join("")}${unsubscribe}`,
    text: [greeting, ...lines, footer + (to.unsubscribeUrl ? ` Unsubscribe: ${to.unsubscribeUrl}` : "")].join("\n\n"),
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
