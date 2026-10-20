import Stripe from "stripe";
import { getPool, isConfigured } from "./db";
import {
  ReferralError,
  Referrals,
  type ReservedQuote,
  type VerifiedReferralPayment,
} from "./referrals";
import {
  isReferralPlan,
  REFERRAL_VERSION,
  referralsEnabled,
  type ReferralPlan,
} from "./referral-policy";

type Invoice = Stripe.Invoice & {
  parent?: {
    subscription_details?: {
      subscription?: string | { id: string };
      metadata?: Record<string, string>;
    };
  };
  payments?: { data: { payment?: { payment_intent?: string | { id: string } } }[] };
};
const reference = (value: unknown): string | null =>
  typeof value === "string"
    ? value
    : value && typeof value === "object" && "id" in value && typeof value.id === "string"
      ? value.id
      : null;

export class ReferralStripe {
  constructor(
    readonly core: Referrals,
    readonly stripe: Stripe,
  ) {}
  async account() {
    const account = await this.stripe.accounts.retrieve();
    if (account.id !== this.core.environment.REFERRALS_STRIPE_ACCOUNT)
      throw new ReferralError("payment_environment_mismatch", 503);
    return account.id;
  }
  private priceIds() {
    return Object.entries(this.core.environment)
      .filter(
        ([key, value]) =>
          /^STRIPE_PRICE_(MONTHLY|ANNUAL|LIFETIME|LIFETIME_PROMO|ID)$/.test(key) && value,
      )
      .map(([, value]) => value!);
  }
  private isOurInvoice(invoice: Invoice) {
    return (
      invoice.parent?.subscription_details?.metadata?.product === "pctweaker" ||
      invoice.subscription_details?.metadata?.product === "pctweaker" ||
      invoice.lines.data.some((line) => this.priceIds().includes(line.price?.id ?? ""))
    );
  }
  async priorPurchase(
    customerId: string | null,
    exceptInvoice?: string | null,
    exceptPayment?: string | null,
  ) {
    if (!customerId) return false;
    let seen = 0;
    for await (const invoice of this.stripe.invoices.list({
      customer: customerId,
      status: "paid",
      limit: 100,
    })) {
      if (++seen > 1000) throw new ReferralError("purchase_history_review_required");
      if (
        invoice.id !== exceptInvoice &&
        invoice.amount_paid > 0 &&
        this.isOurInvoice(invoice as Invoice)
      )
        return true;
    }
    for await (const session of this.stripe.checkout.sessions.list({
      customer: customerId,
      status: "complete",
      limit: 100,
    })) {
      if (++seen > 2000) throw new ReferralError("purchase_history_review_required");
      if (
        session.mode === "payment" &&
        session.metadata?.product === "pctweaker" &&
        session.payment_status === "paid" &&
        (session.amount_total ?? 0) > 0 &&
        reference(session.payment_intent) !== exceptPayment
      )
        return true;
    }
    return false;
  }
  async customer(userId: number) {
    const { rows } = await this.core.db.query(
      "SELECT email,stripe_customer_id FROM users WHERE id=$1",
      [userId],
    );
    if (!rows[0]) throw new ReferralError("invalid_account", 403);
    if (rows[0].stripe_customer_id) return rows[0].stripe_customer_id as string;
    const customer = await this.stripe.customers.create(
      { email: rows[0].email, metadata: { userId: String(userId) } },
      { idempotencyKey: "referral-customer-" + userId },
    );
    const saved = await this.core.db.query(
      `UPDATE users SET stripe_customer_id=$2 WHERE id=$1
      AND stripe_customer_id IS NULL RETURNING stripe_customer_id`,
      [userId, customer.id],
    );
    if (saved.rows[0]) return customer.id;
    const current = await this.core.db.query("SELECT stripe_customer_id FROM users WHERE id=$1", [
      userId,
    ]);
    return current.rows[0].stripe_customer_id as string;
  }

  async checkout(userId: number, plan: ReferralPlan, params: Stripe.Checkout.SessionCreateParams) {
    await this.account();
    const enrolment = await this.core.enrolment(userId);
    if (!enrolment) return null;
    const used = await this.core.db.query(
      "SELECT id FROM referral_quotes WHERE enrolment_id=$1 AND state='paid'",
      [enrolment.id],
    );
    if (used.rows[0]) return null;
    if (params.subscription_data?.trial_period_days)
      throw new ReferralError("choose_paid_plan_for_referral");
    if (
      params.line_items?.length !== 1 ||
      params.line_items[0].quantity !== 1 ||
      !params.line_items[0].price
    )
      throw new ReferralError("unsupported_referral_offer");
    const customerId = await this.customer(userId);
    if (await this.priorPurchase(customerId)) throw new ReferralError("invitation_not_eligible");
    // A saved quote is immutable: retries reuse the same provider parameters and idempotency key.
    const existing = await this.core.db.query(
      `SELECT * FROM referral_quotes WHERE enrolment_id=$1 AND state IN ('creating','open')`,
      [enrolment.id],
    );
    let quote: ReservedQuote = existing.rows[0];
    if (quote) {
      if (quote.plan !== plan) throw new ReferralError("close_existing_checkout_first");
      if (new Date(quote.expires_at) <= this.core.now()) {
        if (quote.session_id) {
          const session = await this.stripe.checkout.sessions.retrieve(quote.session_id);
          if (session.status === "expired")
            await this.core.expireSession(userId, quote.id, session.id);
          else if (session.status === "open") {
            await this.stripe.checkout.sessions.expire(session.id);
            await this.core.expireSession(userId, quote.id, session.id);
          } else throw new ReferralError("payment_reconciliation_required");
          throw new ReferralError("checkout_expired_try_again");
        }
        // The provider may have accepted a timed-out create. Never open a new occurrence after key retention.
        throw new ReferralError("checkout_recovery_required");
      }
      if (quote.checkout_url) return { url: quote.checkout_url };
    } else {
      const price = await this.stripe.prices.retrieve(params.line_items[0].price);
      if (!price.active || price.currency !== "eur" || !Number.isSafeInteger(price.unit_amount))
        throw new ReferralError("unsupported_referral_offer");
      let offer = price.unit_amount!;
      if (params.discounts?.length) {
        if (params.discounts.length !== 1 || !params.discounts[0].coupon)
          throw new ReferralError("unsupported_referral_offer");
        const coupon = await this.stripe.coupons.retrieve(params.discounts[0].coupon);
        if (
          !coupon.valid ||
          coupon.duration !== "once" ||
          (coupon.currency && coupon.currency !== price.currency) ||
          (coupon.applies_to?.products?.length &&
            !coupon.applies_to.products.includes(reference(price.product)!))
        )
          throw new ReferralError("unsupported_referral_offer");
        offer -=
          coupon.percent_off != null
            ? Math.round((offer * coupon.percent_off) / 100)
            : (coupon.amount_off ?? 0);
      }
      const createdAt = this.core.now().getTime();
      const expiresAt = new Date(
        Math.min(params.expires_at ? params.expires_at * 1000 : Infinity, createdAt + 60 * 60000),
      );
      const immutable = {
        ...params,
        customer: customerId,
        customer_email: undefined,
        payment_method_types: ["card"],
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      };
      delete immutable.customer_email;
      // Stripe rejects even `false` when discounts is present. Omission uses
      // its disabled default; this checkout has exactly the server coupon.
      delete immutable.allow_promotion_codes;
      quote = await this.core.reserve(userId, plan, {
        priceId: price.id,
        customerId,
        base: price.unit_amount!,
        offer,
        currency: price.currency,
        params: JSON.parse(JSON.stringify(immutable)),
        expiresAt,
      });
    }
    const saved = { ...quote.params } as Stripe.Checkout.SessionCreateParams & {
      referralQuoteId?: string;
    };
    delete saved.referralQuoteId;
    delete saved.allow_promotion_codes;
    const metadata = {
      ...saved.metadata,
      referral_quote: quote.id,
      referral_policy: REFERRAL_VERSION,
    };
    saved.metadata = metadata;
    if (saved.subscription_data)
      saved.subscription_data = {
        ...saved.subscription_data,
        metadata: { ...saved.subscription_data.metadata, ...metadata },
      };
    if (saved.mode === "payment")
      saved.payment_intent_data = {
        ...saved.payment_intent_data,
        metadata: { ...saved.payment_intent_data?.metadata, ...metadata },
      };
    // One combined, once-only coupon preserves existing first-payment offers and ordinary renewals.
    const coupon = await this.stripe.coupons.create(
      {
        id: "ref_" + quote.id,
        amount_off: quote.discount_minor,
        currency: quote.currency,
        duration: "once",
        max_redemptions: 1,
        redeem_by: Math.floor(new Date(quote.expires_at).getTime() / 1000),
        name:
          quote.offer_minor < quote.base_minor
            ? "Offer + referral (extra 10%)"
            : "Referral (10% off)",
        metadata: { referral_quote: quote.id },
      },
      { idempotencyKey: "ref-coupon-" + quote.id },
    );
    saved.discounts = [{ coupon: coupon.id }];
    const session = await this.stripe.checkout.sessions.create(saved, {
      idempotencyKey: "ref-checkout-" + quote.id,
    });
    if (!session.url) throw new ReferralError("checkout_unavailable", 502);
    await this.core.saveSession(quote.id, session.id, session.url);
    return { url: session.url };
  }

  private async inviterCards(userId: number) {
    const { rows } = await this.core.db.query("SELECT stripe_customer_id FROM users WHERE id=$1", [
      userId,
    ]);
    if (!rows[0]?.stripe_customer_id) return [];
    const fingerprints = new Set<string>();
    let count = 0;
    for await (const charge of this.stripe.charges.list({
      customer: rows[0].stripe_customer_id,
      limit: 100,
    })) {
      if (++count > 1000) throw new ReferralError("payer_identity_review_required");
      const fingerprint = charge.payment_method_details?.card?.fingerprint;
      if (charge.paid && fingerprint) fingerprints.add(fingerprint);
    }
    return [...fingerprints];
  }

  /** Reloads the actual charge, invoice and current disputes; event ordering is not an authority. */
  async paymentForQuote(id: string): Promise<VerifiedReferralPayment | null> {
    const accountId = await this.account();
    const quote = await this.core.quote(id);
    if (!quote) return null;
    if (!quote.session_id) {
      let count = 0;
      const matches: Stripe.Checkout.Session[] = [];
      for await (const candidate of this.stripe.checkout.sessions.list({
        customer: quote.customer_id,
        limit: 100,
      })) {
        if (++count > 1000) throw new ReferralError("checkout_recovery_required");
        if (candidate.metadata?.referral_quote === id) matches.push(candidate);
      }
      if (matches.length !== 1) return null;
      const recovered = matches[0];
      if (
        recovered.metadata?.referral_policy !== REFERRAL_VERSION ||
        recovered.metadata?.product !== "pctweaker" ||
        Number(recovered.client_reference_id) !== quote.buyer_id ||
        reference(recovered.customer) !== quote.customer_id
      ) {
        throw new ReferralError("payment_identity_review_required");
      }
      await this.core.db.query(
        `UPDATE referral_quotes SET session_id=$2,state='open' WHERE id=$1
        AND state='creating' AND session_id IS NULL`,
        [id, recovered.id],
      );
      quote.session_id = recovered.id;
    }
    const session = await this.stripe.checkout.sessions.retrieve(quote.session_id, {
      expand: ["line_items"],
    });
    if (session.status === "expired") {
      await this.core.expireSession(quote.buyer_id, quote.id, session.id);
      return null;
    }
    if (
      session.metadata?.referral_quote !== id ||
      session.metadata?.referral_policy !== REFERRAL_VERSION ||
      session.metadata?.product !== "pctweaker" ||
      Number(session.client_reference_id) !== quote.buyer_id ||
      reference(session.customer) !== quote.customer_id ||
      session.status !== "complete" ||
      session.payment_status !== "paid"
    )
      return null;
    let paymentId = reference(session.payment_intent);
    let invoice: Invoice | null = null;
    let priceId = session.line_items?.data[0]?.price?.id;
    let quantity = session.line_items?.data[0]?.quantity;
    let baseMinor = session.amount_subtotal;
    let discountMinor = session.total_details?.amount_discount;
    if (quote.plan !== "lifetime") {
      const subscriptionId = reference(session.subscription);
      if (!subscriptionId) return null;
      const invoices: Invoice[] = [];
      let count = 0;
      for await (const candidate of this.stripe.invoices.list({
        subscription: subscriptionId,
        status: "paid",
        limit: 100,
      })) {
        if (++count > 1000) throw new ReferralError("purchase_history_review_required");
        if (candidate.billing_reason === "subscription_create" && candidate.amount_paid > 0)
          invoices.push(candidate as Invoice);
      }
      invoices.sort((a, b) => a.created - b.created);
      if (!invoices[0]) return null;
      invoice = (await this.stripe.invoices.retrieve(invoices[0].id, {
        expand: ["payments"],
      })) as Invoice;
      const intents =
        invoice.payments?.data.map((p) => reference(p.payment?.payment_intent)).filter(Boolean) ??
        [];
      paymentId = intents.length === 1 ? intents[0]! : reference(invoice.payment_intent);
      if (!paymentId) throw new ReferralError("payment_identity_review_required");
      if (invoice.lines.data.length !== 1) throw new ReferralError("unsupported_referral_invoice");
      const line = invoice.lines.data[0] as Stripe.InvoiceLineItem & {
        pricing?: { price_details?: { price?: string } };
      };
      priceId = line.price?.id ?? line.pricing?.price_details?.price;
      quantity = line.quantity;
      baseMinor = invoice.subtotal;
      discountMinor = invoice.total_discount_amounts?.reduce((n, item) => n + item.amount, 0);
    }
    if (!paymentId || quantity !== 1 || !baseMinor || discountMinor == null)
      throw new ReferralError("payment_identity_review_required");
    const intent = await this.stripe.paymentIntents.retrieve(paymentId, {
      expand: ["latest_charge"],
    });
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (
      intent.status !== "succeeded" ||
      !charge?.paid ||
      !charge.captured ||
      reference(intent.customer) !== quote.customer_id
    )
      return null;
    let state: VerifiedReferralPayment["state"] = "paid";
    let reason: string | undefined;
    if (charge.amount_refunded > 0) {
      state = charge.refunded ? "revoked" : "hold";
      reason = charge.refunded ? "refunded" : "partial_refund_review";
    }
    if (charge.disputed) {
      let count = 0;
      for await (const dispute of this.stripe.disputes.list({ charge: charge.id, limit: 100 })) {
        if (++count > 100) throw new ReferralError("payment_dispute_review_required");
        if (dispute.status === "lost") {
          state = "revoked";
          reason = "dispute_lost";
        } else if (!["won", "warning_closed"].includes(dispute.status) && state !== "revoked") {
          state = "hold";
          reason = "dispute_open";
        }
      }
      if (count === 0 && state !== "revoked") {
        state = "hold";
        reason = "dispute_identity_review";
      }
    }
    return {
      quoteId: id,
      paymentId: paymentId,
      invoiceId: invoice?.id ?? null,
      buyerId: quote.buyer_id,
      customerId: quote.customer_id,
      plan: quote.plan,
      priceId: priceId ?? "",
      currency: intent.currency,
      baseMinor,
      discountMinor,
      cashReceived: intent.amount_received,
      paidAt: new Date((invoice?.status_transitions.paid_at ?? charge.created) * 1000),
      payerFingerprint: charge.payment_method_details?.card?.fingerprint ?? null,
      inviterFingerprints: await this.inviterCards(quote.inviter_id),
      hasPriorPurchase: await this.priorPurchase(quote.customer_id, invoice?.id, paymentId),
      livemode: intent.livemode,
      accountId,
      state,
      reason,
    };
  }

  async reconcileQuote(id: string) {
    const payment = await this.paymentForQuote(id);
    if (!payment) return;
    if (payment.state !== "paid")
      await this.core.blockPayment(
        payment.paymentId,
        payment.state,
        payment.reason ?? "payment_review",
      );
    const rewardId = await this.core.recordPayment(payment);
    if (rewardId) await this.core.mature(rewardId, payment);
  }
  async reconcileReward(userId: number, rewardId: string) {
    const { rows } = await this.core.db.query(
      "SELECT quote_id FROM referral_rewards WHERE id=$1 AND (inviter_id=$2 OR beneficiary_id=$2)",
      [rewardId, userId],
    );
    if (!rows[0]) throw new ReferralError("reward_not_found", 404);
    await this.reconcileQuote(rows[0].quote_id);
  }
}

let adapter: ReferralStripe | null = null;
export function referralStripe(): ReferralStripe | null {
  if (!isConfigured || !process.env.STRIPE_SECRET_KEY) return null;
  return (adapter ??= new ReferralStripe(
    new Referrals(getPool()),
    new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion,
    }),
  ));
}
export async function referralCheckout(
  userId: number,
  plan: unknown,
  params: Stripe.Checkout.SessionCreateParams,
) {
  if (!referralsEnabled() || params.metadata?.product !== "pctweaker") return null;
  if (!isReferralPlan(plan)) throw new ReferralError("invalid_referral_plan", 400);
  const gateway = referralStripe();
  if (!gateway) throw new ReferralError("referral_unavailable", 503);
  return gateway.checkout(userId, plan, params);
}

/** Called after signature verification, not exposed to unauthenticated JSON posts. */
export async function referralWebhook(event: Stripe.Event) {
  const gateway = referralStripe();
  if (!gateway) return;
  if (!gateway.core.enabled() && !process.env.REFERRALS_HASH_KEY) return;
  const expectedMode = !(
    gateway.core.environment.NODE_ENV === "test" &&
    gateway.core.environment.REFERRALS_TEST_MODE === "true"
  );
  if (event.livemode !== expectedMode) return;
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "invoice.paid",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.closed",
    ].includes(event.type)
  )
    return;
  const completed = await gateway.core.db.query(
    "SELECT 1 FROM referral_webhook_receipts WHERE event_id=$1",
    [event.id],
  );
  if (completed.rows.length) return;
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.referral_quote)
      await gateway.reconcileQuote(session.metadata.referral_quote);
  } else if (event.type === "invoice.paid") {
    const invoice = event.data.object as Invoice;
    const subscriptionId = reference(
      invoice.parent?.subscription_details?.subscription ?? invoice.subscription,
    );
    if (!subscriptionId) return;
    const subscription = await gateway.stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.metadata.referral_quote)
      await gateway.reconcileQuote(subscription.metadata.referral_quote);
  } else if (
    ["charge.refunded", "charge.dispute.created", "charge.dispute.closed"].includes(event.type)
  ) {
    const item = event.data.object as Stripe.Charge | Stripe.Dispute;
    const paymentId = reference(item.payment_intent);
    if (!paymentId) return;
    const expectedMode = !(
      gateway.core.environment.NODE_ENV === "test" &&
      gateway.core.environment.REFERRALS_TEST_MODE === "true"
    );
    if (event.livemode !== expectedMode) return;
    await gateway.account();
    const terminal =
      event.type === "charge.refunded"
        ? (item as Stripe.Charge).refunded
        : (item as Stripe.Dispute).status === "lost";
    // Conservative holds also cover a reversal that arrives before the purchase event.
    await gateway.core.blockPayment(paymentId, terminal ? "revoked" : "hold", event.type);
  }
  // Written only after all effects succeed. Concurrent deliveries are also protected by
  // payment/quote uniqueness; a failed attempt remains retryable by the provider.
  await gateway.core.db.query(
    `INSERT INTO referral_webhook_receipts(event_id,event_type,completed_at)
    VALUES($1,$2,$3) ON CONFLICT(event_id) DO NOTHING`,
    [event.id, event.type, gateway.core.now()],
  );
}

export async function runReferralReconciliation(
  gateway: ReferralStripe,
  stopped: () => boolean = () => false,
) {
  const { rows } = await gateway.core.db
    .query(`SELECT q.id FROM referral_quotes q LEFT JOIN referral_rewards r ON r.quote_id=q.id
    WHERE ((q.state IN ('creating','open') AND q.expires_at < now()) OR (r.state='pending' AND r.eligible_at <= now()))
      AND (q.reconcile_after IS NULL OR q.reconcile_after <= now())
    ORDER BY COALESCE(q.reconcile_after,q.expires_at),q.id LIMIT 10`);
  for (const row of rows) {
    if (stopped()) break;
    try {
      await gateway.reconcileQuote(row.id);
    } catch (error) {
      console.error("referral reconciliation incomplete:", (error as Error).name);
    } finally {
      await gateway.core.db.query(
        `UPDATE referral_quotes SET reconcile_after=now()+INTERVAL '30 minutes',
      reconcile_attempts=reconcile_attempts+1 WHERE id=$1`,
        [row.id],
      );
    }
  }
}

export function startReferralWorker(): () => void {
  if (!referralsEnabled()) return () => {};
  let busy = false;
  let stopped = false;
  const run = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const gateway = referralStripe();
      if (!gateway) return;
      await runReferralReconciliation(gateway, () => stopped);
    } catch (error) {
      console.error("referral reconciliation incomplete:", (error as Error).name);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void run(), 60000);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
