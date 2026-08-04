import express, { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { getPool, isConfigured } from "../db";
import { requireAuth } from "../auth";

const router = express.Router();

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

// Pro is sold as a subscription: monthly, or yearly at a discount. Each plan
// is a separate recurring Price in Stripe; `lifetime` stays supported so the
// original one-time STRIPE_PRICE_ID keeps working for anyone who bought it.
const PLANS: Record<PlanKey, PlanDef> = {
  monthly: { env: "STRIPE_PRICE_MONTHLY", mode: "subscription" },
  annual: { env: "STRIPE_PRICE_ANNUAL", mode: "subscription" },
  lifetime: { env: "STRIPE_PRICE_ID", mode: "payment" },
};

// Creates a Checkout Session for the logged-in user. The desktop app opens
// the returned URL in the system browser (Stripe Checkout can't run inside
// the app's webview) via @tauri-apps/plugin-opener.
router.post("/checkout", requireAuth, requireStripe, async (req: Request, res: Response) => {
  const planKey = String(req.body?.plan || "annual") as PlanKey;
  const plan = PLANS[planKey];
  if (!plan) {
    return res.status(400).json({ error: `unknown plan: ${planKey}` });
  }

  const priceId = process.env[plan.env];
  if (!priceId) {
    return res.status(503).json({ error: `${plan.env} is not configured` });
  }

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
      ...(customerId ? { customer: customerId } : customerEmail ? { customer_email: customerEmail } : {}),
      // Echoed back on every future event for this subscription, so we can
      // always map it to our own user even if the customer id changes.
      ...(plan.mode === "subscription"
        ? { subscription_data: { metadata: { userId: String(req.userId), plan: planKey } } }
        : { payment_intent_data: { metadata: { userId: String(req.userId), plan: planKey } } }),
      metadata: { userId: String(req.userId), plan: planKey },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("checkout session creation failed:", err);
    res.status(500).json({ error: "could not start checkout" });
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
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // Returning 200 anyway: Stripe retries non-2xx, and a bug in our handler
    // would otherwise have Stripe replay the same event indefinitely. The
    // error is logged so it can be replayed deliberately from the dashboard.
    console.error(`failed to handle Stripe event ${event.type}:`, err);
  }

  res.json({ received: true });
}

async function grantPro(userId: string, { customerId, plan }: { customerId: string | null; plan?: string | null }): Promise<void> {
  await getPool().query(
    `UPDATE users
        SET is_pro = TRUE,
            plan = COALESCE($2, plan),
            stripe_customer_id = COALESCE($3, stripe_customer_id)
      WHERE id = $1`,
    [userId, plan || null, customerId || null],
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

async function handleEvent(event: Stripe.Event): Promise<void> {
  if (!isConfigured) return;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.userId;
      if (!userId) break;

      // For one-off payments "completed" can fire before the money actually
      // arrives (bank transfers), so require payment_status = paid. For
      // subscriptions Stripe reports "no_payment_required" on trials and the
      // subscription's own lifecycle events are the source of truth.
      const paid = session.payment_status === "paid" || session.mode === "subscription";
      if (!paid) break;

      const customerId = typeof session.customer === "string" ? session.customer : null;
      await grantPro(userId, { customerId, plan: session.metadata?.plan });
      break;
    }

    // Renewals: keep Pro alive, and recover the case where a customer was
    // reinstated after a failed payment.
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserId(subscription);
      if (!userId) break;

      const active = ["active", "trialing", "past_due"].includes(subscription.status);
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (active) {
        await grantPro(userId, { customerId, plan: subscription.metadata?.plan });
      } else {
        await getPool().query("UPDATE users SET is_pro = FALSE WHERE id = $1", [userId]);
      }
      break;
    }

    // The one that actually matters for revenue integrity: without it, a user
    // who cancels (or whose card ultimately fails) would keep Pro forever.
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserId(subscription);
      if (!userId) break;
      await getPool().query("UPDATE users SET is_pro = FALSE WHERE id = $1", [userId]);
      break;
    }

    default:
      break;
  }
}

export { router, webhookHandler };
