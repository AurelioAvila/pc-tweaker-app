import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import { getPool, isConfigured } from "../db";
import { requireAuth } from "../auth";
import { periodEndFromSubscription } from "../entitlement";
import { isKnownProduct, productEntitlement, upsertEntitlement, revokeEntitlement, type Product } from "../products";
import {
  checkoutSessionParams,
  billingProductFromEvidence,
  formatChargedAmount,
  isSettledCheckout,
  planFromPrice,
  tipSessionParams,
} from "../stripe-policy";
import { sendMail } from "../mailer";
import { brandFor, proWelcomeHtml, proWelcomeSubject } from "../emails/pro-welcome";
import { SUPPORT_INBOX } from "../support-inbox";
import { lifetimeOffer, lifetimeCheckoutDecision } from "../lifetime-offer";
import { queueReceipt, type Receipt } from "../receipt-outbox";

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
type CheckoutCreationEffects = {
  environment: NodeJS.ProcessEnv;
  now: () => number;
  createSession: (params: Stripe.Checkout.SessionCreateParams) => Promise<{ url: string | null }>;
};

export function createCheckoutHandler(effects: CheckoutCreationEffects = {
  environment: process.env,
  now: Date.now,
  createSession: (params) => stripe!.checkout.sessions.create(params),
}) {
  return async (req: Request, res: Response) => {
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
    const priceId = effects.environment[resolved.envName];
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
      let alreadyOwnsLifetime = false;
      if (isConfigured) {
        const { rows } = await getPool().query(
          "SELECT stripe_customer_id, email, is_pro, plan FROM users WHERE id = $1",
          [req.userId],
        );
        customerId = rows[0]?.stripe_customer_id || null;
        customerEmail = rows[0]?.email;
        alreadyOwnsLifetime = rows[0]?.is_pro === true && rows[0]?.plan === "lifetime";
      }

      const params: Stripe.Checkout.SessionCreateParams = checkoutSessionParams({
        priceId,
        mode: plan.mode,
        userId: String(req.userId),
        planKey,
        product,
        customerId,
        customerEmail,
        successUrl: effects.environment.CHECKOUT_SUCCESS_URL || "https://example.com/checkout-success",
        cancelUrl: effects.environment.CHECKOUT_CANCEL_URL || "https://example.com/checkout-cancel",
      });
      if (product === "pctweaker" && (planKey === "lifetime" || alreadyOwnsLifetime)) {
        // Read server time after database work, immediately before the Stripe
        // request. A stale browser countdown or submitted deadline is irrelevant.
        const decision = lifetimeCheckoutDecision(lifetimeOffer(effects.environment, effects.now()), alreadyOwnsLifetime);
        if (!decision.allowed) {
          return res.status(decision.status).json({ error: decision.error, code: decision.code });
        }
        if (decision.expiresAt !== undefined) {
          params.expires_at = decision.expiresAt;
          params.metadata = { ...params.metadata, ...decision.metadata };
          params.payment_intent_data = {
            ...params.payment_intent_data,
            metadata: { ...params.payment_intent_data?.metadata, ...decision.metadata },
          };
          // An expired checkout must not generate a recovery URL that reopens
          // this campaign after the server has stopped selling it.
          params.after_expiration = { recovery: { enabled: false } };
        }
      }
      const session = await effects.createSession(params);
      res.json({ url: session.url });
    } catch (err) {
      console.error("checkout session creation failed:", err);
      res.status(500).json({ error: "could not start checkout" });
    }
  };
}
router.post("/checkout", requireAuth, checkoutLimiter, requireStripe, createCheckoutHandler());

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
  if (!isConfigured) {
    res.status(503).send("Database is not configured; event was not accepted");
    return;
  }
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
 * Current PC Tweaker webhooks load the real subscription before granting.
 * The older provisional-call contract remains monotonic: a holding window
 * may extend an expiry but cannot shorten it. Source identity and generation
 * are checked in the same UPDATE as the grant, alongside lifetime protection.
 */
async function grantPro(
  userId: string,
  { customerId, plan, expiresAt, provisional, subscriptionId, subscriptionCreatedAt }: {
    customerId: string | null; plan?: string | null; expiresAt?: Date | null; provisional?: boolean;
    subscriptionId?: string; subscriptionCreatedAt?: Date;
  },
): Promise<boolean> {
  if (plan !== "lifetime" && (!expiresAt || !Number.isFinite(expiresAt.getTime()))) {
    throw new Error("A recurring Pro grant requires a valid expiry");
  }
  if (subscriptionId && (!subscriptionCreatedAt || !Number.isFinite(subscriptionCreatedAt.getTime()))) {
    throw new Error("A subscription binding requires a valid creation time");
  }
  const result = await getPool().query(
    `UPDATE users
        SET is_pro = TRUE,
            plan = COALESCE($2, plan),
            stripe_customer_id = COALESCE($3, stripe_customer_id),
            legacy_pro_grant = FALSE,
            stripe_subscription_id = CASE WHEN $2 = 'lifetime' THEN NULL ELSE COALESCE($6, stripe_subscription_id) END,
            stripe_subscription_created_at = CASE WHEN $2 = 'lifetime' THEN NULL ELSE COALESCE($7::timestamptz, stripe_subscription_created_at) END,
            pro_expires_at = CASE
              WHEN $5::boolean AND pro_expires_at IS NOT NULL AND pro_expires_at > $4::timestamptz
                THEN pro_expires_at
              ELSE $4::timestamptz
            END
      WHERE id = $1
        AND ($2 = 'lifetime' OR NOT (is_pro = TRUE AND COALESCE(plan, '') = 'lifetime'))
        AND ($2 = 'lifetime' OR stripe_subscription_id IS NULL
             OR stripe_subscription_id = $6
             OR ($6::text IS NOT NULL AND stripe_subscription_created_at < $7::timestamptz))
      RETURNING id`,
    [userId, plan || null, customerId || null, expiresAt ?? null, provisional === true, subscriptionId ?? null, subscriptionCreatedAt ?? null],
  );
  return result.rows.length > 0;
}

/** Subscription revocation must never revoke a separately purchased lifetime grant.
 * The guard belongs in the UPDATE too, so a concurrent checkout cannot race it. */
async function revokePro(userId: string, subscriptionId?: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET is_pro = FALSE, pro_expires_at = NULL, legacy_pro_grant = FALSE
      WHERE id = $1 AND NOT (is_pro = TRUE AND COALESCE(plan, '') = 'lifetime')
        AND (stripe_subscription_id IS NULL OR stripe_subscription_id = $2)`,
    [userId, subscriptionId ?? null],
  );
}

function subscriptionSource(subscription: Stripe.Subscription): { subscriptionId: string; subscriptionCreatedAt: Date } {
  const date = new Date(subscription.created * 1000);
  if (!subscription.id || !Number.isFinite(date.getTime()) || subscription.created <= 0) {
    throw new Error("A subscription binding requires a valid ID and creation time");
  }
  return { subscriptionId: subscription.id, subscriptionCreatedAt: date };
}

function priceProducts(): Record<string, Product> {
  const pairs: [string | undefined, Product][] = [
    [process.env.STRIPE_PRICE_MONTHLY, "pctweaker"],
    [process.env.STRIPE_PRICE_ANNUAL, "pctweaker"],
    [process.env.STRIPE_PRICE_LIFETIME, "pctweaker"],
    [process.env.STRIPE_PRICE_ID, "pctweaker"],
    [process.env.STRIPE_PRICE_UNINSTALLER_ANNUAL, "uninstaller"],
    [process.env.STRIPE_PRICE_UNINSTALLER_LOYALTY, "uninstaller"],
  ];
  return Object.fromEntries(pairs.filter((pair): pair is [string, Product] => Boolean(pair[0])));
}

function subscriptionProduct(subscription: Stripe.Subscription): Product | null {
  return billingProductFromEvidence(
    subscription.metadata,
    subscription.items?.data?.map((item) => item.price.id) ?? [],
    priceProducts(),
  );
}

/** The plan for a subscription: its price first, its metadata as a fallback
 *  for anything created before the price map existed. */
function subscriptionPlan(subscription: Stripe.Subscription): string {
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const fromPrice = planFromPrice(priceId, {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    annual: process.env.STRIPE_PRICE_ANNUAL,
  });
  const plan = fromPrice ?? subscription.metadata?.plan;
  if (plan === "monthly" || plan === "annual") return plan;
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
  if (interval === "month") return "monthly";
  if (interval === "year") return "annual";
  throw new Error(`Subscription ${subscription.id} has no recognized recurring plan`);
}

/**
 * Whether this account already owns Pro outright.
 *
 * A lifetime buyer who still had a subscription running keeps receiving
 * subscription events for it — an update when it is set to stop renewing,
 * then a deletion when the paid period runs out. Both would otherwise be
 * applied on top of the perpetual grant: the first replacing "never expires"
 * with a date, the second revoking Pro from someone who has paid for it
 * permanently. These events cannot change lifetime access; active billing
 * events also retry scoped cancellation when needed.
 */
async function holdsLifetime(userId: string): Promise<boolean> {
  const { rows } = await getPool().query(
    "SELECT is_pro, plan FROM users WHERE id = $1",
    [userId],
  );
  const row = rows[0];
  return Boolean(row && row.is_pro && row.plan === "lifetime");
}

/**
 * Stops this user's identified PC Tweaker subscriptions from renewing after
 * a lifetime purchase. Other products sharing the customer stay untouched.
 *
 * Cancellation is at the end of the period they have already paid for, not
 * immediately: that money is spent either way, and ending it early would take
 * away days they are owed while giving nothing back.
 *
 * The grant is idempotent and committed first. A cancellation failure must
 * still retry the webhook, or the buyer could continue to be charged.
 */
type SubscriptionCancellationClient = {
  list(params: Stripe.SubscriptionListParams): Promise<{ data: Stripe.Subscription[]; has_more: boolean }>;
  update(id: string, params: Stripe.SubscriptionUpdateParams): Promise<unknown>;
};

async function stopSubscriptionsAfterLifetime(
  userId: string,
  customerId: string | null,
  client: SubscriptionCancellationClient | null = stripe?.subscriptions ?? null,
): Promise<void> {
  if (!customerId) {
    const { rows } = await getPool().query("SELECT stripe_customer_id FROM users WHERE id = $1", [userId]);
    customerId = rows[0]?.stripe_customer_id ?? null;
  }
  if (!customerId) return;
  if (!client) throw new Error("Stripe is unavailable for subscription cancellation");
  let startingAfter: string | undefined;
  do {
    const subscriptions = await client.list({
      customer: customerId,
      status: "all",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const subscription of subscriptions.data) {
      if (subscriptionProduct(subscription) !== "pctweaker") continue;
      if (subscription.metadata?.userId && subscription.metadata.userId !== String(userId)) continue;
      if (!["active", "trialing", "past_due", "unpaid"].includes(subscription.status)) continue;
      if (subscription.cancel_at_period_end) continue;
      await client.update(subscription.id, { cancel_at_period_end: true });
      console.log(`lifetime purchase: ${subscription.id} will not renew`);
    }
    if (!subscriptions.has_more) break;
    const lastId = subscriptions.data[subscriptions.data.length - 1]?.id;
    if (!lastId || lastId === startingAfter) throw new Error("Stripe returned an invalid pagination cursor");
    startingAfter = lastId;
  } while (true);
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

/** Durable receipt scheduling; the provider is called by the retry worker. */
async function sendProWelcomeEmail(
  userId: string,
  plan: string | null | undefined,
  expiresAt: Date | null,
  product: string = "pctweaker",
  /** What Stripe actually charged. Falls back to the per-plan table, which
   *  only describes PC Tweaker's own prices. */
  chargedLabel: string | null = null,
  receiptKey?: string,
): Promise<void> {
  if (!receiptKey) throw new Error("A billing receipt requires a purchase identity");
  await queueReceipt(receiptKey, { userId, plan: plan ?? null,
    expiresAt: expiresAt?.toISOString() ?? null, product, chargedLabel });
}

export async function deliverProReceipt(receipt: Receipt): Promise<void> {
    const { userId, plan, product, chargedLabel } = receipt;
    const expiresAt = receipt.expiresAt ? new Date(receipt.expiresAt) : null;
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
    const result = await sendMail({
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
    if (!result.delivered) throw new Error("Receipt provider did not accept the message");
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

/** External effects are explicit so regression tests can run the real event
 * handler and SQL without contacting Stripe or an email provider. */
type BillingEffects = {
  loadCheckout: (id: string) => Promise<Stripe.Checkout.Session>;
  loadSubscription: (id: string) => Promise<Stripe.Subscription>;
  stopSubscriptions: (userId: string, customerId: string | null) => Promise<void>;
  welcome: typeof sendProWelcomeEmail;
  notifySale: typeof notifyOwnerOfSale;
};

const billingEffects: BillingEffects = {
  async loadCheckout(id) {
    if (!stripe) throw new Error("Stripe is unavailable for checkout verification");
    return stripe.checkout.sessions.retrieve(id, { expand: ["line_items"] });
  },
  async loadSubscription(id) {
    if (!stripe) throw new Error("Stripe is unavailable for subscription verification");
    return stripe.subscriptions.retrieve(id);
  },
  async stopSubscriptions(userId, customerId) {
    try {
      await stopSubscriptionsAfterLifetime(userId, customerId);
    } catch (err) {
      console.error("could not stop a subscription after a lifetime purchase:", err);
      if (customerId) alertOwnerOfUncancelledSubscription(userId, customerId);
      throw err;
    }
  },
  welcome: sendProWelcomeEmail,
  notifySale: notifyOwnerOfSale,
};

async function handleCheckoutSession(session: Stripe.Checkout.Session, effects: BillingEffects): Promise<void> {
  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId || !isSettledCheckout(session.payment_status)) return;
  if (session.metadata?.product && !isKnownProduct(session.metadata.product)) return;
  if (session.mode !== "subscription" && session.mode !== "payment") return;

  // Legacy checkouts carry no product metadata. Identify their configured
  // price instead of treating every payment on a shared Stripe account as Pro.
  let priceIds = session.line_items?.data?.flatMap((item) => item.price ? [item.price.id] : []) ?? [];
  if ((!session.metadata?.product || !session.metadata?.plan) && priceIds.length === 0) {
    const verified = await effects.loadCheckout(session.id);
    priceIds = verified.line_items?.data?.flatMap((item) => item.price ? [item.price.id] : []) ?? [];
  }
  const product = billingProductFromEvidence(session.metadata, priceIds, priceProducts());
  if (!product) return;

  const customerId = typeof session.customer === "string" ? session.customer : null;
  if (session.mode === "subscription" && product === "pctweaker" && await holdsLifetime(userId)) {
    await effects.stopSubscriptions(userId, customerId);
    return;
  }
  const pricePlan = priceIds.map((id) => planFromPrice(id, {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    annual: process.env.STRIPE_PRICE_ANNUAL,
    lifetime: process.env.STRIPE_PRICE_LIFETIME,
  })).find(Boolean);
  const legacyLifetime = session.mode === "payment" && product === "pctweaker" &&
    priceIds.some((id) => Boolean(process.env.STRIPE_PRICE_ID) && id === process.env.STRIPE_PRICE_ID);
  let plan = pricePlan ?? (legacyLifetime ? "lifetime" : session.metadata?.plan);
  if (session.mode === "payment" && (product !== "pctweaker" || plan !== "lifetime")) {
    throw new Error(`Checkout ${session.id} has no recognized one-time entitlement`);
  }
  if (session.mode === "subscription" && plan !== "monthly" && plan !== "annual") {
    throw new Error(`Checkout ${session.id} has no recognized recurring plan`);
  }
  // Replaying a checkout must not create a fresh three-day window each time.
  let expiresAt = session.mode === "subscription"
    ? new Date(session.created * 1000 + PROVISIONAL_ACCESS_MS)
    : null;
  if (expiresAt && !Number.isFinite(expiresAt.getTime())) {
    throw new Error(`Checkout ${session.id} has an invalid creation time`);
  }
  if (product !== "pctweaker") {
    await upsertEntitlement(userId, product, { plan: plan!, expiresAt, provisional: true });
    effects.notifySale(userId, plan, session.mode, product);
    return;
  }

  let source: ReturnType<typeof subscriptionSource> | undefined;
  if (session.mode === "subscription") {
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!subscriptionId) throw new Error(`Checkout ${session.id} has no subscription ID`);
    const current = await effects.loadSubscription(subscriptionId);
    if (current.id !== subscriptionId || subscriptionProduct(current) !== "pctweaker" ||
        (current.metadata?.userId && current.metadata.userId !== String(userId)) ||
        (customerId && typeof current.customer === "string" && current.customer !== customerId)) {
      throw new Error(`Checkout ${session.id} does not match its subscription`);
    }
    if (!["active", "trialing", "past_due"].includes(current.status)) {
      await revokePro(userId, current.id);
      return;
    }
    expiresAt = periodEndFromSubscription(current);
    if (!expiresAt) throw new Error(`Subscription ${current.id} has an invalid period end`);
    source = subscriptionSource(current);
    plan = subscriptionPlan(current);
  }
  const granted = await grantPro(userId, { customerId, plan, expiresAt, ...source });
  if (!granted) return;
  if (session.mode === "payment") {
    // Retryable cancellation precedes receipt delivery. The SQL grant is
    // already safe to replay if Stripe is temporarily unavailable here.
    await effects.stopSubscriptions(userId, customerId);
    await effects.welcome(userId, plan, null, product, sessionCharge(session), `checkout:${session.id}`);
  }
  effects.notifySale(userId, plan, session.mode, product);
}

async function handleEvent(event: Stripe.Event, effects: BillingEffects = billingEffects): Promise<void> {
  if (!isConfigured) throw new Error("Database is not configured; event was not accepted");

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      await handleCheckoutSession(event.data.object as Stripe.Checkout.Session, effects);
      break;
    }

    // Renewals: keep Pro alive, and recover the case where a customer was
    // reinstated after a failed payment.
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      let subscription = event.data.object as Stripe.Subscription;
      const product = subscriptionProduct(subscription);
      if (!product) break;
      if (product === "pctweaker") {
        const current = await effects.loadSubscription(subscription.id);
        if (current.id !== subscription.id || subscriptionProduct(current) !== product) {
          throw new Error(`Subscription ${subscription.id} no longer matches its product`);
        }
        subscription = current;
      }
      const userId = await resolveUserId(subscription);
      if (!userId) break;
      const active = ["active", "trialing", "past_due"].includes(subscription.status);
      if (product !== "pctweaker") {
        if (active) {
          const expiresAt = periodEndFromSubscription(subscription);
          if (!expiresAt) throw new Error(`Subscription ${subscription.id} has an invalid period end`);
          await upsertEntitlement(userId, product, {
            plan: subscriptionPlan(subscription),
            expiresAt,
            stripeSubscriptionId: subscription.id,
          });
          if (event.type === "customer.subscription.created") {
            await effects.welcome(
              userId,
              subscriptionPlan(subscription),
              expiresAt,
              product,
              subscriptionCharge(subscription),
              `subscription:${subscription.id}`,
            );
          }
        } else {
          await revokeEntitlement(userId, product);
        }
        break;
      }

      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (await holdsLifetime(userId)) {
        await effects.stopSubscriptions(userId, customerId);
        break;
      }
      if (active) {
        const expiresAt = periodEndFromSubscription(subscription);
        if (!expiresAt) throw new Error(`Subscription ${subscription.id} has an invalid period end`);
        const granted = await grantPro(userId, {
          customerId,
          plan: subscriptionPlan(subscription),
          expiresAt,
          ...subscriptionSource(subscription),
        });
        // Only on creation, not every renewal/update — this event fires once
        // per subscription's lifecycle start.
        if (granted && event.type === "customer.subscription.created") {
          await effects.welcome(
            userId,
            subscriptionPlan(subscription),
            expiresAt,
            "pctweaker",
            subscriptionCharge(subscription),
            `subscription:${subscription.id}`,
          );
        }
      } else {
        await revokePro(userId, subscription.id);
      }
      break;
    }

    // The one that actually matters for revenue integrity: without it, a user
    // who cancels (or whose card ultimately fails) would keep Pro forever.
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const product = subscriptionProduct(subscription);
      if (!product) break;
      const userId = await resolveUserId(subscription);
      if (!userId) break;
      if (product !== "pctweaker") {
        await revokeEntitlement(userId, product);
        break;
      }
      if (await holdsLifetime(userId)) break;
      await revokePro(userId, subscription.id);
      break;
    }

    default:
      break;
  }
}

export { router, webhookHandler, grantPro, revokePro, handleEvent, stopSubscriptionsAfterLifetime };
