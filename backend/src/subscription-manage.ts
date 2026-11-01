import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import type Stripe from "stripe";
import { getPool, isConfigured } from "./db";
import { requireAuth } from "./auth";
import { asyncRoute } from "./async-route";
import { periodEndFromSubscription } from "./entitlement";
import { productEntitlement } from "./products";
import { productFromMetadata } from "./stripe-policy";
import { cancellationNotice, queueMail } from "./owner-sales";

/**
 * "Manage subscription" inside the apps of the PC Tweaker family:
 *   GET  /api/billing/subscription?product=<id>    what this account pays for that product
 *   POST /api/billing/subscription/cancel {product} stop renewing at the end of the paid period
 *   POST /api/billing/subscription/resume {product} undo that while the period still runs
 *
 * Cancelling only ever sets `cancel_at_period_end`: never an immediate
 * cancellation, never a refund. Stripe documents that flag as updatable on
 * subscriptions created by Managed Payments Checkout (only
 * `default_payment_method` is locked to the portal there), and the lifetime
 * flow in routes/stripe.ts already sets it on those subscriptions. The
 * `customer.subscription.updated` webhook then keeps access until the period
 * end, as it does for a cancellation made in Stripe's portal.
 *
 * Only the caller's own subscription is reachable: the request names a
 * product, never a subscription or customer id. Tweaky Driver keeps its plan
 * in its own service (dc_billing_accounts, same database, same Stripe
 * account); its subscriptions are found by their customer and metadata, and
 * its service reads Stripe live, so a change here shows there at once.
 */

export const MANAGED_PRODUCTS = ["pctweaker", "tweaky", "uninstaller"] as const;
export type ManagedProduct = (typeof MANAGED_PRODUCTS)[number];

export type SubscriptionsApi = {
  retrieve(id: string, params?: Stripe.SubscriptionRetrieveParams): Promise<Stripe.Subscription>;
  update(id: string, params: Stripe.SubscriptionUpdateParams): Promise<Stripe.Subscription>;
  list(params: Stripe.SubscriptionListParams): Promise<{ data: Stripe.Subscription[]; has_more: boolean }>;
};
type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

/** Statuses a customer can still stop or resume. "incomplete" never started. */
const MANAGEABLE = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);
const EXPAND = ["default_payment_method", "items.data.price"];
const iso = (seconds: number | null | undefined) => (typeof seconds === "number" && seconds > 0 ? new Date(seconds * 1000).toISOString() : null);

export class SubscriptionError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

export type SubscriptionView = {
  product: ManagedProduct;
  plan: string | null;
  interval: "month" | "year" | null;
  amount: number | null;
  currency: string | null;
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  payment_method: { brand: string; last4: string } | null;
  lifetime: boolean;
  can_cancel: boolean;
  can_resume: boolean;
};

const empty = (product: ManagedProduct, status = "none"): SubscriptionView => ({
  product, plan: null, interval: null, amount: null, currency: null, status,
  trial_end: null, current_period_end: null, cancel_at_period_end: false, cancel_at: null,
  payment_method: null, lifetime: false, can_cancel: false, can_resume: false,
});

function belongs(sub: Stripe.Subscription, product: ManagedProduct, userId: string): boolean {
  const meta = sub.metadata ?? {};
  if (product === "tweaky") {
    return meta.product === "tweaky-driver" && meta.accountScope === "pc-tweaker-shared" && meta.accountUserId === userId;
  }
  return productFromMetadata(meta) === product && (!meta.userId || meta.userId === userId);
}

export function viewOf(product: ManagedProduct, sub: Stripe.Subscription): SubscriptionView {
  const price = sub.items?.data?.[0]?.price;
  const interval = price?.recurring?.interval;
  const method = typeof sub.default_payment_method === "object" ? sub.default_payment_method : null;
  const ending = sub.cancel_at_period_end === true || sub.cancel_at != null;
  return {
    product,
    plan: interval === "month" ? "monthly" : interval === "year" ? "annual" : null,
    interval: interval === "month" || interval === "year" ? interval : null,
    amount: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
    status: sub.status,
    trial_end: sub.status === "trialing" ? iso(sub.trial_end) : null,
    current_period_end: periodEndFromSubscription(sub)?.toISOString() ?? null,
    cancel_at_period_end: sub.cancel_at_period_end === true,
    cancel_at: iso(sub.cancel_at),
    payment_method: method?.card ? { brand: method.card.brand, last4: method.card.last4 } : null,
    lifetime: false,
    can_cancel: !ending,
    can_resume: ending,
  };
}

/** Stripe key mode, which picks Tweaky Driver's live or test billing row. */
export function billingMode(secret = process.env.STRIPE_SECRET_KEY ?? ""): "live" | "test" {
  return /^(sk|rk)_live_/.test(secret) ? "live" : "test";
}

/** The caller's live subscription for a product, or why there is none. */
export async function findSubscription(
  db: Db, api: SubscriptionsApi, userId: string, product: ManagedProduct, mode = billingMode(),
): Promise<{ sub: Stripe.Subscription } | { view: SubscriptionView }> {
  let storedId: string | null = null;
  let customer: string | null = null;
  if (product === "tweaky") {
    const { rows: [table] } = await db.query("SELECT to_regclass('public.dc_billing_accounts') AS name");
    const { rows: [row] } = table?.name
      ? await db.query("SELECT * FROM dc_billing_accounts WHERE store_scope = 'pc-tweaker-shared' AND user_id = $1 AND billing_mode = $2", [userId, mode])
      : { rows: [] };
    if (row?.lifetime_granted_at && !row.lifetime_revoked_at) return { view: { ...empty(product, "lifetime"), plan: "lifetime", lifetime: true } };
    customer = row?.customer_id ?? null;
  } else {
    // Lifetime first: a leftover subscription it is already stopping is not "the plan".
    const entitlement = await productEntitlement(userId, product);
    if (entitlement.active && entitlement.plan === "lifetime") return { view: { ...empty(product, "lifetime"), plan: "lifetime", lifetime: true } };
    const { rows: [user] } = await db.query("SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1", [userId]);
    customer = user?.stripe_customer_id ?? null;
    storedId = product === "pctweaker" ? user?.stripe_subscription_id ?? null
      : (await db.query("SELECT stripe_subscription_id FROM entitlements WHERE user_id = $1 AND product = $2", [userId, product])).rows[0]?.stripe_subscription_id ?? null;
  }

  const usable = (sub: Stripe.Subscription) => MANAGEABLE.has(sub.status) && belongs(sub, product, userId);
  if (storedId) {
    const sub = await api.retrieve(storedId, { expand: EXPAND });
    if (usable(sub)) return { sub };
  }
  if (customer) {
    const listed = await api.list({ customer, status: "all", limit: 100, expand: EXPAND.map((path) => `data.${path}`) });
    const live = listed.data.filter(usable).sort((a, b) => b.created - a.created);
    if (live[0]) return { sub: live[0] };
  }

  if (product === "tweaky") return { view: empty(product) };
  // No subscription: access granted without one
  // (Uninstaller year included with PC Tweaker Lifetime, a manual grant).
  const entitlement = await productEntitlement(userId, product);
  if (entitlement.active) return { view: { ...empty(product, "included"), plan: entitlement.plan, current_period_end: entitlement.expiresAt ?? null } };
  return { view: empty(product) };
}

/** Reads, cancels at period end or resumes. Idempotent: asking for the state
 *  the subscription is already in changes nothing at Stripe. */
export async function manageSubscription(
  db: Db, api: SubscriptionsApi, userId: string, product: ManagedProduct, action: "get" | "cancel" | "resume", mode = billingMode(),
  feedback: CancelFeedback = { reason: null, comment: null },
): Promise<SubscriptionView> {
  const found = await findSubscription(db, api, userId, product, mode);
  if ("view" in found) {
    if (action === "get") return found.view;
    throw found.view.lifetime ? new SubscriptionError(409, "lifetime") : new SubscriptionError(404, "no_subscription");
  }
  let sub = found.sub;
  const ending = sub.cancel_at_period_end === true || sub.cancel_at != null;
  if (action === "cancel" && !ending) {
    const details: Stripe.SubscriptionUpdateParams.CancellationDetails = {};
    if (feedback.reason) details.feedback = feedback.reason;
    if (feedback.comment) details.comment = feedback.comment;
    sub = await api.update(sub.id, {
      cancel_at_period_end: true,
      ...(feedback.reason || feedback.comment ? { cancellation_details: details } : {}),
      expand: [...EXPAND, "customer"],
    });
    await queueCancellationNotice(db, userId, product, sub, feedback);
  } else if (action === "resume" && ending) {
    sub = await api.update(sub.id, sub.cancel_at_period_end ? { cancel_at_period_end: false, expand: EXPAND } : { cancel_at: "", expand: EXPAND });
  }
  if (action !== "get") {
    // The webhook writes the same; mirrored now so /billing/status agrees at once.
    if (product === "pctweaker") {
      await db.query("UPDATE users SET cancel_at_period_end = $2 WHERE id = $1 AND stripe_subscription_id = $3", [userId, sub.cancel_at_period_end === true, sub.id]);
    } else if (product === "uninstaller") {
      await db.query("UPDATE entitlements SET cancel_at_period_end = $3 WHERE user_id = $1 AND product = $2 AND stripe_subscription_id = $4", [userId, product, sub.cancel_at_period_end === true, sub.id]);
    }
    console.log(`subscription ${action}: user ${userId} ${product} ${sub.id} cancel_at_period_end=${sub.cancel_at_period_end === true} (was ${ending})${action === "cancel" && !ending && feedback.reason ? ` reason=${feedback.reason}` : ""}`);
  }
  return viewOf(product, sub);
}

/** Why the customer is leaving: Stripe's own `cancellation_details.feedback`
 * codes, with the label the owner's notice shows. Optional; never required to cancel. */
export const CANCEL_REASONS = {
  too_expensive: "Too expensive",
  unused: "I don't use it enough",
  missing_features: "Missing a feature I need",
  switched_service: "Switching to another tool",
  low_quality: "Technical problems / bugs",
  too_complex: "Too complicated to use",
  customer_service: "Problems with support",
  other: "Other",
} as const;
export type CancelReason = keyof typeof CANCEL_REASONS;
export type CancelFeedback = { reason: CancelReason | null; comment: string | null };
export const COMMENT_MAX = 500;

/** `{ reason, comment }` from the request body: both optional; an unknown reason
 * or a comment over 500 characters is refused (400), never silently dropped. */
export function parseCancelFeedback(body: unknown): CancelFeedback {
  const { reason, comment } = (body ?? {}) as { reason?: unknown; comment?: unknown };
  if (reason != null && reason !== "" && !(typeof reason === "string" && Object.hasOwn(CANCEL_REASONS, reason))) {
    throw new SubscriptionError(400, "invalid_reason");
  }
  if (comment != null && typeof comment !== "string") throw new SubscriptionError(400, "invalid_comment");
  // Control characters out (line breaks kept), then trimmed.
  const text = (comment ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, "").trim();
  if ([...text].length > COMMENT_MAX) throw new SubscriptionError(400, "comment_too_long");
  return { reason: reason ? (reason as CancelReason) : null, comment: text || null };
}

const PRODUCT_NAMES: Record<ManagedProduct, string> = { pctweaker: "PC Tweaker Pro", uninstaller: "PC Tweaker Uninstaller", tweaky: "Tweaky Driver" };

/** One owner notice per cancellation, queued in the owner-sales outbox. Never
 * throws: the cancellation already happened at Stripe. */
async function queueCancellationNotice(db: Db, userId: string, product: ManagedProduct, sub: Stripe.Subscription, feedback: CancelFeedback) {
  try {
    const view = viewOf(product, sub);
    const customer = typeof sub.customer === "object" && sub.customer && !("deleted" in sub.customer && sub.customer.deleted) ? sub.customer as Stripe.Customer : null;
    const { rows: [user] } = await db.query("SELECT email FROM users WHERE id = $1", [userId]);
    const periodEnd = periodEndFromSubscription(sub);
    const endsAt = sub.cancel_at ?? (periodEnd ? Math.floor(periodEnd.getTime() / 1000) : null);
    // canceled_at is the time of this cancel request: cancel, resume, cancel again = two notices.
    await queueMail(`cancel:${sub.id}:${sub.canceled_at ?? endsAt}`, cancellationNotice({
      product: PRODUCT_NAMES[product], plan: view.plan, amount: view.amount, currency: view.currency, interval: view.interval,
      subscriptionId: sub.id, customerId: customer?.id ?? (typeof sub.customer === "string" ? sub.customer : null),
      livemode: sub.livemode === true, email: user?.email ?? customer?.email ?? null,
      country: customer?.address?.country ?? null, endsAt,
      reason: feedback.reason ? CANCEL_REASONS[feedback.reason] : null, comment: feedback.comment,
    }));
  } catch (err) {
    console.error(`CANCELLATION NOTICE LOST for ${sub.id}:`, (err as Error).message);
  }
}

const isManaged = (value: unknown): value is ManagedProduct => typeof value === "string" && (MANAGED_PRODUCTS as readonly string[]).includes(value);

export function subscriptionRouter(api: () => SubscriptionsApi | null): express.Router {
  const router = express.Router();
  const limiter = (limit: number) => rateLimit({
    windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req: Request) => `user:${req.userId}`,
  });
  const handle = (action: "get" | "cancel" | "resume") => asyncRoute(async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const product = action === "get" ? req.query.product : req.body?.product;
    if (!isManaged(product)) return void res.status(400).json({ error: "unknown_product" });
    let feedback: CancelFeedback | undefined;
    try {
      if (action === "cancel") feedback = parseCancelFeedback(req.body);
    } catch (err) {
      return void res.status(400).json({ error: (err as SubscriptionError).code });
    }
    const stripe = api();
    if (!isConfigured || !stripe) return void res.status(503).json({ error: "billing_unavailable" });
    try {
      res.json(await manageSubscription(getPool(), stripe, String(req.userId), product, action, undefined, feedback));
    } catch (err) {
      if (err instanceof SubscriptionError) return void res.status(err.status).json({ error: err.code });
      console.error(`subscription ${action} failed for user ${req.userId} ${product}:`, (err as Error).message);
      res.status(502).json({ error: "billing_unavailable" });
    }
  });
  router.get("/", requireAuth, limiter(120), handle("get"));
  router.post("/cancel", requireAuth, limiter(20), handle("cancel"));
  router.post("/resume", requireAuth, limiter(20), handle("resume"));
  return router;
}
