import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import { getPool, isConfigured } from "../db";
import { requireAuth } from "../auth";
import { periodEndFromSubscription } from "../entitlement";
import { isKnownProduct, productEntitlement, upsertEntitlement, revokeEntitlement, type Product } from "../products";
import {
  checkoutSessionParams,
  formatChargedAmount,
  isSettledCheckout,
  planFromPrice,
  productFromMetadata,
  tipSessionParams,
} from "../stripe-policy";
import { sendMail } from "../mailer";
import { brandFor, proWelcomeHtml, proWelcomeSubject } from "../emails/pro-welcome";
import { SUPPORT_INBOX } from "../support-inbox";

const router = express.Router();

// Checkout is behind requireAuth, so this isn't guarding against anonymous
// abuse — it's here so an authenticated account (or a leaked token) can't be
// used to hammer Stripe's session-creation API in a loop. Keyed on the user
// id rather than IP for the same reason the auth limiter keys on email: it's
// the thing that can't be rotated for free.
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // /tip is unauthenticated, so req.userId is undefined there — without
  // the fallback every anonymous tipper would share a single bucket.
  keyGenerator: (req: Request) => (req.userId ? `user:${req.userId}` : `ip:${req.ip}`),
});

/** How long checkout alone buys, until the subscription event confirms the
 * real billing period. Generous enough to absorb a slow or retried webhook,
 * short enough that a permanently missing one costs days, not a lifetime. */
const PROVISIONAL_ACCESS_MS = 3 * 24 * 60 * 60 * 1000;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
// The installed `stripe` package's types only know about the API version it
// shipped with ("2024-06-20"); "2025-03-31.basil" is a newer version Stripe
// itself supports and this account is pinned to (set when the webhook
// signing secret was configured). The cast changes nothing at runtime — it's
// still the exact string sent to Stripe's API — it only works around the SDK
// type not having caught up yet.
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion })
  : null;

function requireStripe(req: Request, res: Response, next: NextFunction) {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured (STRIPE_SECRET_KEY missing)" });
  }
  next();
}

type PlanKey = "monthly" | "annual" | "lifetime";
type PlanDef = { env: string; mode: "subscription" | "payment" };

// Pro is sold monthly, yearly at a discount, or once and for good. Each is a
// separate Price in Stripe, and the client never names one — it names a plan,
// and this map is the only thing that turns a plan into a price.
//
// Lifetime deliberately does NOT reuse STRIPE_PRICE_ID. That variable holds
// the original one-time price from before subscriptions existed, at whatever
// amount was charged then; pointing the new lifetime tier at it would show
// one price in the app and charge another at checkout. A dedicated variable
// means the worst case is a clean "not configured" error instead of a
// customer billed an amount nobody quoted them.
const PLANS: Record<PlanKey, PlanDef> = {
  monthly: { env: "STRIPE_PRICE_MONTHLY", mode: "subscription" },
  annual: { env: "STRIPE_PRICE_ANNUAL", mode: "subscription" },
  lifetime: { env: "STRIPE_PRICE_LIFETIME", mode: "payment" },
};

/**
 * Resolves the Stripe Price and mode for a checkout request, server-side.
 *
 * The client names a product and a plan; it never names a price. For the
 * Uninstaller the price depends on loyalty — an active PC Tweaker
 * subscription earns the discounted yearly price — and that check runs HERE,
 * against the database, because an entitlement claimed by the client is
 * exactly the kind of input a paying-less attacker would forge.
 */
async function resolveCheckoutPrice(
  userId: number,
  product: Product,
  planKey: PlanKey,
): Promise<{ envName: string; mode: "subscription" | "payment" } | { error: string; status: number }> {
  if (product === "pctweaker") {
    const plan = Object.prototype.hasOwnProperty.call(PLANS, planKey) ? PLANS[planKey] : undefined;
    if (!plan) return { error: `unknown plan: ${planKey}`, status: 400 };
    return { envName: plan.env, mode: plan.mode };
  }
  // Uninstaller sells one plan: a yearly subscription. Loyalty pricing is a
  // different Stripe Price, not a coupon, so the invoice states it plainly.
  if (planKey !== "annual") return { error: "the Uninstaller is sold as an annual plan", status: 400 };
  const pctweaker = await productEntitlement(userId, "pctweaker");
  return {
    envName: pctweaker.active ? "STRIPE_PRICE_UNINSTALLER_LOYALTY" : "STRIPE_PRICE_UNINSTALLER_ANNUAL",
    mode: "subscription",
  };
}

// Creates a Checkout Session for the logged-in user. The desktop app opens
// the returned URL in the system browser (Stripe Checkout can't run inside
// the app's webview) via @tauri-apps/plugin-opener.
router.post("/checkout", requireAuth, checkoutLimiter, requireStripe, async (req: Request, res: Response) => {
  const planKey = String(req.body?.plan || "annual") as PlanKey;
  const product = req.body?.product ?? "pctweaker";
  // `PLANS[planKey]` alone would resolve a key like "__proto__" or
  // "constructor" to Object.prototype instead of undefined, since PLANS is a
  // plain object literal — resolveCheckoutPrice guards it with hasOwnProperty
  // for the same reason as before. The product goes through an allowlist.
  if (!isKnownProduct(product)) {
    return res.status(400).json({ error: "unknown product" });
  }
  if (!isConfigured) {
    return res.status(503).json({ error: "database not configured" });
  }

  const resolved = await resolveCheckoutPrice(req.userId as number, product, planKey);
  if ("error" in resolved) {
    return res.status(resolved.status).json({ error: resolved.error });
  }
  const priceId = process.env[resolved.envName];
  if (!priceId) {
    return res.status(503).json({ error: `${resolved.envName} is not configured` });
  }
  const plan: PlanDef = { env: resolved.envName, mode: resolved.mode };

  try {
    // Reuse the customer we already know about, so a user who resubscribes
    // doesn't end up as two unrelated customers in Stripe (which would break
    // the cancellation lookup below).
    let customerId: string | null = null;
    let customerEmail: string | undefined;
    if (isConfigured) {
      const { rows } = await getPool().query(
        "SELECT stripe_customer_id, email FROM users WHERE id = $1",
        [req.userId],
      );
      customerId = rows[0]?.stripe_customer_id || null;
      customerEmail = rows[0]?.email;
    }

    const session = await stripe!.checkout.sessions.create(
      checkoutSessionParams({
        priceId,
        mode: plan.mode,
        userId: String(req.userId),
        planKey,
        product,
        customerId,
        customerEmail,
        successUrl: process.env.CHECKOUT_SUCCESS_URL || "https://example.com/checkout-success",
        cancelUrl: process.env.CHECKOUT_CANCEL_URL || "https://example.com/checkout-cancel",
      }),
    );
    res.json({ url: session.url });
  } catch (err) {
    console.error("checkout session creation failed:", err);
    res.status(500).json({ error: "could not start checkout" });
  }
});

// A one-off tip. Deliberately outside the account system: no login, no
// entitlement, nothing granted on the webhook side — someone paying €1 to
// say thanks shouldn't need an account first, and there is nothing for that
// payment to unlock.
router.post("/tip", checkoutLimiter, requireStripe, async (req: Request, res: Response) => {
  const priceId = process.env.STRIPE_PRICE_COFFEE;
  if (!priceId) {
    return res.status(503).json({ error: "STRIPE_PRICE_COFFEE is not configured" });
  }
  try {
    const session = await stripe!.checkout.sessions.create(
      tipSessionParams(priceId, process.env.APP_URL || "https://pctweaker.app", req.body?.quantity),
    );
    res.json({ url: session.url });
  } catch (err) {
    console.error("tip checkout session creation failed:", err);
    res.status(500).json({ error: "could not open checkout" });
  }
});

// Opens Stripe's own hosted billing portal for the logged-in user: cancel,
// swap plan, update the card, download invoices. We don't reimplement any
// of that ourselves — Stripe's UI is the customer's actual system of
// record for their subscription, and duplicating "cancel" logic here would
// just be a second place for it to drift from what Stripe itself will do.
router.post("/portal", requireAuth, requireStripe, async (req: Request, res: Response) => {
  if (!isConfigured) {
    return res.status(503).json({ error: "database not configured" });
  }

  const { rows } = await getPool().query(
    "SELECT stripe_customer_id FROM users WHERE id = $1",
    [req.userId],
  );
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) {
    // Not the same as "you are not Pro". An account reaches this branch when
    // it has no Stripe customer at all — which is exactly the case for Pro
    // granted by hand in the database, where there is no payment history for
    // Stripe to show. Saying "no subscription" to someone looking at their
    // own working Pro badge reads as the app having lost their purchase.
    return res.status(404).json({
      error: "this account has no Stripe billing history, so there is nothing to manage",
    });
  }

  try {
    const session = await stripe!.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.APP_URL || "https://pctweaker.app",
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("billing portal session creation failed:", err);
    res.status(500).json({ error: "could not open billing portal" });
  }
});

// Mounted with express.raw() in index.ts — Stripe's signature check needs
// the exact raw request body, not the JSON-parsed one.
async function webhookHandler(req: Request, res: Response): Promise<void> {
  if (!stripe) {
    res.status(503).send("Stripe is not configured");
    return;
  }
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(503).send("STRIPE_WEBHOOK_SECRET is not configured");
    return;
  }
  if (!signature) {
    res.status(400).send("Missing stripe-signature header");
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err: any) {
    console.error("webhook signature verification failed:", err.message);
    res.status(400).send("Webhook signature verification failed");
    return;
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // Fail loudly so Stripe retries. This used to answer 200 regardless, to
    // avoid a buggy handler being replayed forever — but Stripe gives up on
    // its own after roughly three days, so the real effect was that a
    // transient database error during a *cancellation* silently dropped the
    // revocation and left that user on Pro for good. A retried event is
    // cheap; a permanently unrevoked subscription is not.
    console.error(`failed to handle Stripe event ${event.type}:`, err);
    res.status(500).send("handler failed, please retry");
    return;
  }

  res.json({ received: true });
}

/**
 * `provisional` marks the short holding window written by
 * `checkout.session.completed`, which is a guess — the real period end only
 * comes with the `customer.subscription.*` event. Stripe does not order the
 * two, and when the subscription event lands first, an unguarded write pushed
 * the expiry back down to the guess: a customer billed until October lost Pro
 * three days after paying. A provisional value may therefore only ever extend
 * an expiry, never shorten one. Real subscription events stay authoritative,
 * and cancellation goes through revokePro, not through here.
 */
async function grantPro(
  userId: string,
  { customerId, plan, expiresAt, provisional }: { customerId: string | null; plan?: string | null; expiresAt?: Date | null; provisional?: boolean },
): Promise<void> {
  await getPool().query(
    `UPDATE users
        SET is_pro = TRUE,
            plan = COALESCE($2, plan),
            stripe_customer_id = COALESCE($3, stripe_customer_id),
            pro_expires_at = CASE
              WHEN $5::boolean AND pro_expires_at IS NOT NULL AND pro_expires_at > $4::timestamptz
                THEN pro_expires_at
              ELSE $4::timestamptz
            END
      WHERE id = $1`,
    [userId, plan || null, customerId || null, expiresAt ?? null, provisional === true],
  );
}

/** Ends access immediately: cancelled, unpaid, or refunded. */
async function revokePro(userId: string): Promise<void> {
  await getPool().query("UPDATE users SET is_pro = FALSE, pro_expires_at = NULL WHERE id = $1", [userId]);
}

/** The plan for a subscription: its price first, its metadata as a fallback
 *  for anything created before the price map existed. */
function subscriptionPlan(subscription: Stripe.Subscription): string | null {
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const fromPrice = planFromPrice(priceId, {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    annual: process.env.STRIPE_PRICE_ANNUAL,
    lifetime: process.env.STRIPE_PRICE_LIFETIME,
  });
  return fromPrice ?? subscription.metadata?.plan ?? null;
}

/**
 * Whether this account already owns Pro outright.
 *
 * A lifetime buyer who still had a subscription running keeps receiving
 * subscription events for it — an update when it is set to stop renewing,
 * then a deletion when the paid period runs out. Both would otherwise be
 * applied on top of the perpetual grant: the first replacing "never expires"
 * with a date, the second revoking Pro from someone who has paid for it
 * permanently. Every subscription event is therefore ignored for an account
 * in this state.
 */
async function holdsLifetime(userId: string): Promise<boolean> {
  const { rows } = await getPool().query(
    "SELECT plan, pro_expires_at FROM users WHERE id = $1",
    [userId],
  );
  const row = rows[0];
  return Boolean(row && row.plan === "lifetime" && row.pro_expires_at === null);
}

/**
 * Stops any subscription still billing an account that has just bought Pro
 * outright. Without this the customer pays 9.99 a month, forever, on top of
 * the one-off price they paid to stop doing exactly that.
 *
 * Cancellation is at the end of the period they have already paid for, not
 * immediately: that money is spent either way, and ending it early would take
 * away days they are owed while giving nothing back. Nothing renews after.
 *
 * Best-effort by design. The perpetual grant is already committed by the time
 * this runs, so throwing here would make Stripe retry the whole webhook and
 * re-grant what is already granted. A failure is loud in the logs instead.
 */
async function stopSubscriptionsAfterLifetime(
  userId: string,
  customerId: string | null,
): Promise<void> {
  if (!stripe || !customerId) return;
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });
    for (const subscription of subscriptions.data) {
      if (subscription.cancel_at_period_end) continue;
      await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
      console.log(`lifetime purchase: ${subscription.id} will not renew`);
    }
  } catch (err) {
    // The one failure that costs the customer money rather than just an
    // error page. Whatever went wrong — an API key without permission to
    // touch subscriptions, an outage — someone has now paid for permanent
    // access and is still on a recurring charge, so this asks a human to
    // finish the job by hand instead of leaving it in a log nobody reads.
    console.error("could not stop a subscription after a lifetime purchase:", err);
    alertOwnerOfUncancelledSubscription(userId, customerId);
  }
}

/** Asks the owner to cancel a subscription the webhook could not stop. */
function alertOwnerOfUncancelledSubscription(userId: string, customerId: string): void {
  void (async () => {
    const { rows } = await getPool().query("SELECT email FROM users WHERE id = $1", [userId]);
    const email = rows[0]?.email ?? "(unknown address)";
    await sendMail({
      to: SUPPORT_INBOX,
      subject: "Action needed: lifetime buyer is still being billed monthly",
      html: `<p>This account bought Pro outright, but the subscription it already had
                could not be stopped automatically.</p>
             <p><strong>Account:</strong> ${escapeHtml(email)}<br>
                <strong>Stripe customer:</strong> ${escapeHtml(customerId)}</p>
             <p>Their Pro access is safe and permanent. What is not resolved is the
                recurring charge: set it to cancel in the Stripe dashboard, or they
                will be billed again.</p>`,
    });
  })().catch((err: Error) =>
    console.error("BILLING ALERT LOST — a lifetime buyer may still be charged:", err.message),
  );
}

/** The amount on a completed Checkout Session, ready for the receipt line. */
function sessionCharge(session: Stripe.Checkout.Session): string | null {
  return formatChargedAmount(session.amount_total, session.currency, null);
}

/** The same for a subscription, which carries its interval as well. */
function subscriptionCharge(subscription: Stripe.Subscription): string | null {
  const price = subscription.items?.data?.[0]?.price;
  return formatChargedAmount(
    price?.unit_amount,
    price?.currency,
    price?.recurring?.interval ?? null,
  );
}

const PLAN_PRICE_LABELS: Record<string, string> = {
  monthly: "€9.99 / month",
  annual: "€59 / year",
  lifetime: "€74.99 once",
};

/**
 * Best-effort welcome email on subscription creation. Deliberately never
 * throws: a failed send shouldn't turn into a Stripe retry that re-runs
 * grantPro (harmless but pointless) or, worse, make the webhook report
 * failure for something the customer's access doesn't depend on.
 */
async function sendProWelcomeEmail(
  userId: string,
  plan: string | null | undefined,
  expiresAt: Date | null,
  product: string = "pctweaker",
  /** What Stripe actually charged. Falls back to the per-plan table, which
   *  only describes PC Tweaker's own prices. */
  chargedLabel: string | null = null,
): Promise<void> {
  try {
    const { rows } = await getPool().query(
      "SELECT email, first_name FROM users WHERE id = $1",
      [userId],
    );
    const user = rows[0];
    if (!user?.email) return;
    // No expiry means the purchase never renews, and the template says so.
    // The previous `expiresAt ?? new Date()` quietly turned that case into
    // "renews on <today>", which for a lifetime buyer is both wrong and
    // alarming.
    const renewsOn = expiresAt
      ? expiresAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        })
      : null;
    await sendMail({
      to: user.email,
      subject: proWelcomeSubject(product),
      html: proWelcomeHtml({
        product,
        firstName: user.first_name || "there",
        email: user.email,
        plan: plan || "monthly",
        priceLabel:
          chargedLabel ?? PLAN_PRICE_LABELS[plan || "monthly"] ?? PLAN_PRICE_LABELS.monthly,
        renewsOn,
      }),
    });
  } catch (err) {
    console.error("failed to send Pro welcome email:", err);
  }
}

// Local, like every other route file's copy: the address and the plan name
// are interpolated into an HTML mail, and one of them is a user-chosen
// account email.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Tells the shop owner a sale happened.
 *
 * Nothing did this before: the customer got a welcome email and the owner got
 * nothing, so the only sale notification was whatever Stripe's dashboard was
 * configured to send. Reuses SUPPORT_INBOX, the address reviews and support
 * messages already go to.
 *
 * Best-effort and never awaited into the webhook's own result: a mail server
 * having a bad minute must not make Stripe retry a payment that was already
 * recorded correctly. It is logged loudly instead, because a sale nobody was
 * told about is the kind of thing worth finding in a log later.
 */
function notifyOwnerOfSale(
  userId: string,
  plan: string | null | undefined,
  mode: string | null,
  product: string = "pctweaker",
): void {
  void (async () => {
    const { rows } = await getPool().query("SELECT email FROM users WHERE id = $1", [userId]);
    const email = rows[0]?.email ?? "(unknown address)";
    const planName = plan ?? "unknown plan";
    const kind = mode === "subscription" ? "subscription" : "one-off purchase";
    await sendMail({
      to: SUPPORT_INBOX,
      subject: `New ${brandFor(product).name} sale — ${planName}`,
      html: `<p>Someone just bought ${escapeHtml(brandFor(product).name)}.</p>
             <p><strong>Plan:</strong> ${escapeHtml(planName)} (${escapeHtml(kind)})<br>
                <strong>Account:</strong> ${escapeHtml(email)}</p>
             <p>Stripe has the payment; this is only the heads-up.</p>`,
    });
  })().catch((err: Error) =>
    console.error("SALE NOTIFICATION LOST — could not tell the owner:", err.message),
  );
}

/// Subscription events don't carry our user id directly, so resolve it from
/// whatever the event does give us: the metadata we attached at checkout
/// first, then the Stripe customer id we stored.
async function resolveUserId(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription?.metadata?.userId;
  if (fromMetadata) return fromMetadata;

  const customerId = typeof subscription?.customer === "string" ? subscription.customer : null;
  if (!customerId) return null;

  const { rows } = await getPool().query("SELECT id FROM users WHERE stripe_customer_id = $1", [customerId]);
  return rows[0]?.id ?? null;
}

async function handleCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
      const userId = session.client_reference_id || session.metadata?.userId;
      if (!userId || !isSettledCheckout(session.payment_status)) return;

      const product = productFromMetadata(session.metadata);
      if (!product) return;
      if (product !== "pctweaker") {
        // Non-pctweaker products live in the entitlements table. Same
        // provisional-window reasoning as below: the subscription event
        // carries the real period end and overwrites this.
        await upsertEntitlement(userId, product, {
          plan: session.metadata?.plan ?? null,
          expiresAt: new Date(Date.now() + PROVISIONAL_ACCESS_MS),
          provisional: session.mode === "subscription",
        });
        // This branch used to return here, which is why a customer who bought
        // any product other than PC Tweaker paid and then heard nothing at
        // all — and why no sale on those products was ever reported to the
        // owner either. Both belong to every product, not to one of them.
        if (session.mode !== "subscription") {
          await sendProWelcomeEmail(userId, session.metadata?.plan, null, product, sessionCharge(session));
        }
        notifyOwnerOfSale(userId, session.metadata?.plan, session.mode ?? null, product);
        return;
      }

      const customerId = typeof session.customer === "string" ? session.customer : null;
      // A one-off purchase is genuinely perpetual, so it gets no expiry. A
      // subscription's real period end only arrives with the separate
      // `customer.subscription.*` event, which may land before or after this
      // one — so store a short provisional window rather than NULL, which
      // entitlement.ts would read as "never expires". The subscription event
      // overwrites it with the true date; if that event never arrives at all,
      // access lapses in days instead of lasting forever.
      const expiresAt =
        session.mode === "subscription" ? new Date(Date.now() + PROVISIONAL_ACCESS_MS) : null;
      await grantPro(userId, {
        customerId,
        plan: session.metadata?.plan,
        expiresAt,
        provisional: session.mode === "subscription",
      });

      // The welcome email used to be sent only from customer.subscription
      // .created — an event a one-off purchase never produces. A lifetime
      // buyer therefore paid and heard nothing at all. Subscriptions keep
      // getting theirs from that event, so sending here too would send twice;
      // this branch covers exactly the mode that event never fires for.
      if (session.mode !== "subscription") {
        await sendProWelcomeEmail(userId, session.metadata?.plan, null, product, sessionCharge(session));
        // An existing subscriber upgrading to lifetime: the perpetual grant
        // is in place, so the recurring charge has to stop.
        await stopSubscriptionsAfterLifetime(userId, customerId);
      }
      notifyOwnerOfSale(userId, session.metadata?.plan, session.mode ?? null, product);
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  if (!isConfigured) return;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      await handleCheckoutSession(event.data.object as Stripe.Checkout.Session);
      break;
    }

    // Renewals: keep Pro alive, and recover the case where a customer was
    // reinstated after a failed payment.
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserId(subscription);
      if (!userId) break;

      const product = productFromMetadata(subscription.metadata);
      if (!product) break;
      const active = ["active", "trialing", "past_due"].includes(subscription.status);
      if (product !== "pctweaker") {
        if (active) {
          const expiresAt = periodEndFromSubscription(subscription);
          await upsertEntitlement(userId, product, {
            plan: subscriptionPlan(subscription),
            expiresAt,
            stripeSubscriptionId: subscription.id,
          });
          if (event.type === "customer.subscription.created") {
            await sendProWelcomeEmail(
              userId,
              subscriptionPlan(subscription),
              expiresAt,
              product,
              subscriptionCharge(subscription),
            );
          }
        } else {
          await revokeEntitlement(userId, product);
        }
        break;
      }

      if (await holdsLifetime(userId)) break;

      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (active) {
        const expiresAt = periodEndFromSubscription(subscription);
        await grantPro(userId, {
          customerId,
          plan: subscriptionPlan(subscription),
          expiresAt,
        });
        // Only on creation, not every renewal/update — this event fires once
        // per subscription's lifecycle start.
        if (event.type === "customer.subscription.created") {
          await sendProWelcomeEmail(
            userId,
            subscriptionPlan(subscription),
            expiresAt,
            "pctweaker",
            subscriptionCharge(subscription),
          );
        }
      } else {
        await revokePro(userId);
      }
      break;
    }

    // The one that actually matters for revenue integrity: without it, a user
    // who cancels (or whose card ultimately fails) would keep Pro forever.
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserId(subscription);
      if (!userId) break;
      const product = productFromMetadata(subscription.metadata);
      if (!product) break;
      if (product !== "pctweaker") {
        await revokeEntitlement(userId, product);
        break;
      }
      if (await holdsLifetime(userId)) break;
      await revokePro(userId);
      break;
    }

    default:
      break;
  }
}

export { router, webhookHandler, grantPro };
