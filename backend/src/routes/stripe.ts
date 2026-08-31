import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import { getPool, isConfigured } from "../db";
import { requireAuth } from "../auth";
import { periodEndFromSubscription } from "../entitlement";
import { isKnownProduct, productEntitlement, upsertEntitlement, revokeEntitlement, type Product } from "../products";
import { isSettledCheckout, productFromMetadata } from "../stripe-policy";
import { sendMail } from "../mailer";
import { proWelcomeHtml, proWelcomeSubject } from "../emails/pro-welcome";
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
  keyGenerator: (req: Request) => `user:${req.userId}`,
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

    const session = await stripe!.checkout.sessions.create({
      mode: plan.mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: process.env.CHECKOUT_SUCCESS_URL || "https://example.com/checkout-success",
      cancel_url: process.env.CHECKOUT_CANCEL_URL || "https://example.com/checkout-cancel",
      client_reference_id: String(req.userId),
      // Tax is asked for explicitly rather than inherited from a dashboard
      // default, because that default is not the same in both modes: live
      // subscription sessions come back with automatic tax on, while a
      // payment-mode session defaults to off. Customers here are in the US,
      // where this is not academic — one of the two paying subscribers is in
      // Nebraska and is correctly charged 7.5% sales tax on top. A lifetime
      // sale silently skipping that would under-collect tax on exactly the
      // purchases that are hardest to correct after the fact.
      automatic_tax: { enabled: true },
      ...(customerId ? { customer: customerId } : customerEmail ? { customer_email: customerEmail } : {}),
      // Stripe refuses a session that combines automatic tax with an existing
      // customer unless it is allowed to save the address Checkout collects.
      ...(customerId ? { customer_update: { address: "auto" as const } } : {}),
      // Subscription mode always creates a customer; payment mode defaults to
      // "if_required" and may leave none behind. Without one, a lifetime
      // buyer gets no stripe_customer_id, which means no billing portal and
      // no way to reach their own invoice. Only valid in payment mode.
      ...(plan.mode === "payment" ? { customer_creation: "always" as const } : {}),
      // Echoed back on every future event for this subscription, so we can
      // always map it to our own user AND our own product even if the
      // customer id changes. Events with no product metadata are pctweaker
      // by definition — every subscription older than this field is one.
      ...(plan.mode === "subscription"
        ? { subscription_data: { metadata: { userId: String(req.userId), plan: planKey, product } } }
        : { payment_intent_data: { metadata: { userId: String(req.userId), plan: planKey, product } } }),
      metadata: { userId: String(req.userId), plan: planKey, product },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("checkout session creation failed:", err);
    res.status(500).json({ error: "could not start checkout" });
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

async function grantPro(
  userId: string,
  { customerId, plan, expiresAt }: { customerId: string | null; plan?: string | null; expiresAt?: Date | null },
): Promise<void> {
  await getPool().query(
    `UPDATE users
        SET is_pro = TRUE,
            plan = COALESCE($2, plan),
            stripe_customer_id = COALESCE($3, stripe_customer_id),
            pro_expires_at = $4
      WHERE id = $1`,
    [userId, plan || null, customerId || null, expiresAt ?? null],
  );
}

/** Ends access immediately: cancelled, unpaid, or refunded. */
async function revokePro(userId: string): Promise<void> {
  await getPool().query("UPDATE users SET is_pro = FALSE, pro_expires_at = NULL WHERE id = $1", [userId]);
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
async function sendProWelcomeEmail(userId: string, plan: string | null | undefined, expiresAt: Date | null): Promise<void> {
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
      subject: proWelcomeSubject(),
      html: proWelcomeHtml({
        firstName: user.first_name || "there",
        email: user.email,
        plan: plan || "monthly",
        priceLabel: PLAN_PRICE_LABELS[plan || "monthly"] ?? PLAN_PRICE_LABELS.monthly,
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
): void {
  void (async () => {
    const { rows } = await getPool().query("SELECT email FROM users WHERE id = $1", [userId]);
    const email = rows[0]?.email ?? "(unknown address)";
    const planName = plan ?? "unknown plan";
    const kind = mode === "subscription" ? "subscription" : "one-off purchase";
    await sendMail({
      to: SUPPORT_INBOX,
      subject: `New PC Tweaker sale — ${planName}`,
      html: `<p>Someone just bought PC Tweaker Pro.</p>
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
        });
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
      await grantPro(userId, { customerId, plan: session.metadata?.plan, expiresAt });

      // The welcome email used to be sent only from customer.subscription
      // .created — an event a one-off purchase never produces. A lifetime
      // buyer therefore paid and heard nothing at all. Subscriptions keep
      // getting theirs from that event, so sending here too would send twice;
      // this branch covers exactly the mode that event never fires for.
      if (session.mode !== "subscription") {
        await sendProWelcomeEmail(userId, session.metadata?.plan, null);
      }
      notifyOwnerOfSale(userId, session.metadata?.plan, session.mode ?? null);
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
          await upsertEntitlement(userId, product, {
            plan: subscription.metadata?.plan ?? null,
            expiresAt: periodEndFromSubscription(subscription),
            stripeSubscriptionId: subscription.id,
          });
        } else {
          await revokeEntitlement(userId, product);
        }
        break;
      }

      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (active) {
        const expiresAt = periodEndFromSubscription(subscription);
        await grantPro(userId, {
          customerId,
          plan: subscription.metadata?.plan,
          expiresAt,
        });
        // Only on creation, not every renewal/update — this event fires once
        // per subscription's lifecycle start.
        if (event.type === "customer.subscription.created") {
          await sendProWelcomeEmail(userId, subscription.metadata?.plan, expiresAt);
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
      await revokePro(userId);
      break;
    }

    default:
      break;
  }
}

export { router, webhookHandler };
