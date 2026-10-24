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
  referralQuote,
  referralsEnabled,
  type ReferralPlan,
} from "./referral-policy";

/** Below this a referral session is not attempted: Stripe's 30-minute minimum plus margin. */
const MIN_CHECKOUT_MS = 35 * 60000;
/** After a quote's own expiry, a lost creation response with no listed session is released. */
const RECOVERY_GRACE_MS = 15 * 60000;
/** Provider facts that will not change on retry; they go to owner review, not a retry loop. */
const REVIEWABLE = new Set([
  "payment_identity_review_required",
  "unsupported_referral_invoice",
  "checkout_model_changed",
  "purchase_history_review_required",
  "payer_identity_review_required",
  "payment_dispute_review_required",
  "checkout_recovery_required",
]);

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

/** Select the explicitly configured merchant/tax model, never an account default. */
export function referralCheckoutParams(
  params: Stripe.Checkout.SessionCreateParams,
  model: string | undefined,
) {
  if (!["direct", "managed"].includes(model ?? ""))
    throw new ReferralError("unsupported_checkout_model");
  const saved = JSON.parse(JSON.stringify(params)) as Stripe.Checkout.SessionCreateParams & {
    managed_payments?: { enabled: boolean };
  };
  saved.managed_payments = { enabled: model === "managed" };
  delete saved.allow_promotion_codes;
  if (saved.customer) {
    // Stripe accepts only one of customer / customer_creation / customer_email (verified in TEST).
    delete saved.customer_creation;
    delete saved.customer_email;
    // Direct automatic tax on an existing customer without a saved address is rejected
    // (`customer_tax_location_invalid`, verified in TEST) unless Checkout may save it.
    if (model === "direct" && saved.automatic_tax?.enabled)
      saved.customer_update = { ...saved.customer_update, address: "auto" };
  }
  if (model === "managed") {
    // Managed Payments is the tax authority. These direct-Checkout options
    // are unsupported; removing them does not disable Managed Payments tax.
    delete saved.automatic_tax;
    delete saved.tax_id_collection;
    delete saved.payment_method_types;
    delete saved.payment_method_configuration;
    delete saved.invoice_creation;
    if (saved.customer_update) {
      delete saved.customer_update.address;
      delete saved.customer_update.name;
      if (!Object.keys(saved.customer_update).length) delete saved.customer_update;
    }
    if (
      saved.subscription_data?.default_tax_rates?.length ||
      saved.shipping_options?.length ||
      saved.shipping_address_collection ||
      saved.subscription_data?.application_fee_percent ||
      saved.subscription_data?.on_behalf_of ||
      saved.subscription_data?.transfer_data ||
      saved.payment_intent_data?.application_fee_amount ||
      saved.payment_intent_data?.on_behalf_of ||
      saved.payment_intent_data?.transfer_data
    )
      throw new ReferralError("unsupported_referral_offer");
  } else {
    saved.payment_method_types = ["card"];
  }
  return saved;
}

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

  /** Server-side claim. The feature switch is checked before any provider call. */
  async claim(userId: number, code: unknown) {
    if (!this.core.enabled()) throw new ReferralError("referral_unavailable", 503);
    await this.account();
    const { rows } = await this.core.db.query("SELECT stripe_customer_id FROM users WHERE id=$1", [
      userId,
    ]);
    await this.core.claim(
      userId,
      code,
      await this.priorPurchase(rows[0]?.stripe_customer_id ?? null),
    );
  }

  /**
   * Returns a referral checkout URL, or null so the caller opens the ordinary checkout.
   * Only states that could charge twice (an unsettled or paid referral session) are errors;
   * every other reason the referral cannot apply falls back to the regular price.
   */
  async checkout(
    userId: number,
    plan: ReferralPlan,
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<{ url: string } | null> {
    const enrolment = await this.core.enrolment(userId);
    if (!enrolment) return null;
    await this.account();
    const used = await this.core.db.query(
      "SELECT id FROM referral_quotes WHERE enrolment_id=$1 AND state='paid'",
      [enrolment.id],
    );
    if (used.rows[0]) return null;
    if (await this.core.expiredWithoutCheckout(userId, enrolment.id)) return null;
    const ordinary = (reason: string) => this.core.ordinaryCheckout(enrolment.id, reason);
    if (params.subscription_data?.trial_period_days) return ordinary("trial_requested");
    if (
      params.line_items?.length !== 1 ||
      params.line_items[0].quantity !== 1 ||
      !params.line_items[0].price
    )
      return ordinary("unsupported_offer");
    const customerId = await this.customer(userId);
    if (await this.priorPurchase(customerId)) return ordinary("prior_purchase");
    // A saved quote is immutable: retries reuse the same provider parameters and idempotency key.
    const existing = await this.core.db.query(
      `SELECT q.*,e.buyer_id FROM referral_quotes q JOIN referral_enrolments e ON e.id=q.enrolment_id
      WHERE q.enrolment_id=$1 AND q.state IN ('creating','open')`,
      [enrolment.id],
    );
    let quote: ReservedQuote = existing.rows[0];
    if (quote) {
      // Another plan, or past its expiry: close this quote's session at Stripe first (a session
      // already paid throws), then evaluate again: a new quote, or the ordinary price if the
      // invitation expired meanwhile.
      if (quote.plan !== plan || new Date(quote.expires_at) <= this.core.now()) {
        if (!(await this.settleExpired(quote as ReservedQuote & { buyer_id: number })))
          throw new ReferralError(
            quote.plan !== plan ? "close_existing_checkout_first" : "checkout_recovery_required",
          );
        return this.checkout(userId, plan, params);
      }
      if (quote.checkout_url) return { url: quote.checkout_url };
    } else {
      const price = await this.stripe.prices.retrieve(params.line_items[0].price);
      if (!price.active || price.currency !== "eur" || !Number.isSafeInteger(price.unit_amount))
        return ordinary("unsupported_price");
      let offer = price.unit_amount!;
      if (params.discounts?.length) {
        if (params.discounts.length !== 1 || !params.discounts[0].coupon)
          return ordinary("unsupported_offer");
        const coupon = await this.stripe.coupons.retrieve(params.discounts[0].coupon);
        if (
          !coupon.valid ||
          coupon.duration !== "once" ||
          (coupon.currency && coupon.currency !== price.currency) ||
          (coupon.applies_to?.products?.length &&
            !coupon.applies_to.products.includes(reference(price.product)!))
        )
          return ordinary("unsupported_offer");
        offer -=
          coupon.percent_off != null
            ? Math.round((offer * coupon.percent_off) / 100)
            : (coupon.amount_off ?? 0);
      }
      if (!referralQuote(price.unit_amount!, offer, price.currency))
        return ordinary("price_too_small");
      const createdAt = this.core.now().getTime();
      const expiresAt = new Date(
        Math.min(params.expires_at ? params.expires_at * 1000 : Infinity, createdAt + 60 * 60000),
      );
      // Stripe requires 30 minutes measured on its own clock after two more requests; an offer
      // that ends sooner keeps its own ordinary checkout and deadline handling.
      if (expiresAt.getTime() < createdAt + MIN_CHECKOUT_MS) return ordinary("offer_ends_too_soon");
      let immutable: Stripe.Checkout.SessionCreateParams;
      try {
        immutable = referralCheckoutParams(
          { ...params, customer: customerId, expires_at: Math.floor(expiresAt.getTime() / 1000) },
          this.core.environment.REFERRALS_CHECKOUT_MODEL,
        );
      } catch (error) {
        if ((error as ReferralError).code === "unsupported_referral_offer")
          return ordinary("unsupported_offer");
        throw error;
      }
      try {
        quote = await this.core.reserve(userId, plan, {
          priceId: price.id,
          customerId,
          base: price.unit_amount!,
          offer,
          currency: price.currency,
          params: JSON.parse(JSON.stringify(immutable)),
          expiresAt,
        });
      } catch (error) {
        if ((error as ReferralError).code === "invitation_not_eligible")
          return ordinary("not_eligible");
        throw error;
      }
    }
    const saved = { ...quote.params } as Stripe.Checkout.SessionCreateParams & {
      referralQuoteId?: string;
    };
    delete saved.referralQuoteId;
    delete saved.allow_promotion_codes;
    if (
      (saved as { managed_payments?: { enabled: boolean } }).managed_payments?.enabled !==
      (this.core.environment.REFERRALS_CHECKOUT_MODEL === "managed")
    )
      throw new ReferralError("checkout_model_changed");
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
    // A validation rejection is never stored under an idempotency key, and an earlier accepted
    // attempt with the same key would have been replayed instead. So for either request it
    // proves that this quote has no coupon, hence no session: release it for the ordinary
    // price. Network and server errors stay uncertain and keep the reservation for a retry.
    const rejected = async (error: unknown) => {
      if ((error as { type?: string }).type !== "StripeInvalidRequestError") throw error;
      await this.core.expireQuote(quote.id, null, "provider_rejected");
      return null;
    };
    let coupon: Stripe.Coupon;
    try {
      coupon = await this.stripe.coupons.create(
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
    } catch (error) {
      return rejected(error);
    }
    saved.discounts = [{ coupon: coupon.id }];
    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.create(saved, {
        idempotencyKey: "ref-checkout-" + quote.id,
      });
    } catch (error) {
      return rejected(error);
    }
    if (!session.url) throw new ReferralError("checkout_unavailable", 502);
    await this.core.saveSession(quote.id, session.id, session.url);
    return { url: session.url };
  }

  /** Finds the provider session of a quote whose creation response was lost. */
  private async recoverSession(quote: ReservedQuote & { buyer_id: number }) {
    if (quote.session_id) return quote.session_id;
    let count = 0;
    const matches: Stripe.Checkout.Session[] = [];
    for await (const candidate of this.stripe.checkout.sessions.list({
      customer: quote.customer_id,
      limit: 100,
    })) {
      if (++count > 1000) throw new ReferralError("checkout_recovery_required");
      if (candidate.metadata?.referral_quote === quote.id) matches.push(candidate);
    }
    if (!matches.length) return null;
    const recovered = matches[0];
    if (
      matches.length !== 1 ||
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
      [quote.id, recovered.id],
    );
    quote.session_id = recovered.id;
    return recovered.id;
  }

  /**
   * Releases a quote once the provider shows nothing can still be paid: its session is expired
   * (or is expired now, also before the quote's own expiry when the buyer picks another plan),
   * or no session exists past the quote's expiry plus a grace period. Returns false while
   * uncertain; throws if a session completed.
   */
  private async settleExpired(quote: ReservedQuote & { buyer_id: number }) {
    const sessionId = await this.recoverSession(quote);
    if (!sessionId) {
      if (this.core.now().getTime() < new Date(quote.expires_at).getTime() + RECOVERY_GRACE_MS)
        return false;
      await this.core.expireQuote(quote.id, null, "no_provider_session");
      return true;
    }
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "open") await this.stripe.checkout.sessions.expire(session.id);
    else if (session.status !== "expired")
      throw new ReferralError("payment_reconciliation_required");
    await this.core.expireQuote(quote.id, session.id, "provider_expired");
    return true;
  }

  private async inviterCards(userId: number) {
    const { rows } = await this.core.db.query("SELECT stripe_customer_id FROM users WHERE id=$1", [
      userId,
    ]);
    if (!rows[0]?.stripe_customer_id) return [];
    const fingerprints = new Set<string>();
    let count = 0;
    // Any charge, paid or not, and every card saved on the customer: an inviter who is in a
    // trial or whose payment failed has a card here but no paid charge.
    for await (const charge of this.stripe.charges.list({
      customer: rows[0].stripe_customer_id,
      limit: 100,
    })) {
      if (++count > 1000) throw new ReferralError("payer_identity_review_required");
      const fingerprint = charge.payment_method_details?.card?.fingerprint;
      if (fingerprint) fingerprints.add(fingerprint);
    }
    try {
      for await (const method of this.stripe.paymentMethods.list({
        customer: rows[0].stripe_customer_id,
        type: "card",
        limit: 100,
      })) {
        if (++count > 2000) throw new ReferralError("payer_identity_review_required");
        if (method.card?.fingerprint) fingerprints.add(method.card.fingerprint);
      }
    } catch (error) {
      // A key without Payment Methods read must not stop every referral sale: the charges above
      // still count, and the log says what is missing.
      if ((error as { type?: string }).type !== "StripePermissionError") throw error;
      console.error("referral: saved cards unreadable (Stripe key lacks Payment Methods read)");
    }
    return [...fingerprints];
  }

  /** Reloads the actual charge, invoice and current disputes; event ordering is not an authority. */
  async paymentForQuote(id: string): Promise<VerifiedReferralPayment | null> {
    const accountId = await this.account();
    const quote = await this.core.quote(id);
    if (!quote) return null;
    if (!(await this.recoverSession(quote))) {
      if (
        quote.state === "creating" &&
        this.core.now().getTime() >= new Date(quote.expires_at).getTime() + RECOVERY_GRACE_MS
      )
        await this.core.expireQuote(quote.id, null, "no_provider_session");
      return null;
    }
    const session = await this.stripe.checkout.sessions.retrieve(quote.session_id!, {
      expand: ["line_items"],
    });
    const expectedManaged =
      (quote.params.managed_payments as { enabled?: boolean } | undefined)?.enabled === true;
    const actualManaged =
      (session as Stripe.Checkout.Session & { managed_payments?: { enabled?: boolean } })
        .managed_payments?.enabled === true;
    if (expectedManaged !== actualManaged) throw new ReferralError("checkout_model_changed");
    if (session.status === "expired") {
      await this.core.expireQuote(quote.id, session.id, "provider_expired");
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

  /**
   * A dispute closed in the merchant's favour. The stored reason is not evidence (a later
   * event may have overwritten a partial refund or another open dispute), so the payment,
   * refunds and every dispute are read again: only a clean result releases the hold, anything
   * else is recorded as the current block.
   */
  async disputeClosed(paymentId: string) {
    const { rows } = await this.core.db.query(
      "SELECT quote_id FROM referral_rewards WHERE payment_id=$1",
      [paymentId],
    );
    if (!rows[0]) return;
    let payment: VerifiedReferralPayment | null;
    try {
      payment = await this.paymentForQuote(rows[0].quote_id);
    } catch (error) {
      // Unverifiable now: the bonus simply stays on hold for owner review.
      if (error instanceof ReferralError && REVIEWABLE.has(error.code)) return;
      throw error;
    }
    if (!payment || payment.paymentId !== paymentId) return;
    if (payment.state === "paid") await this.core.releaseDisputeHold(payment);
    else await this.core.blockPayment(paymentId, payment.state, payment.reason ?? "payment_review");
  }

  async reconcileQuote(id: string) {
    let payment: VerifiedReferralPayment | null;
    try {
      payment = await this.paymentForQuote(id);
    } catch (error) {
      // Permanent inconsistencies go to owner review instead of failing every retry.
      if (!(error instanceof ReferralError) || !REVIEWABLE.has(error.code)) throw error;
      await this.core.reviewQuote(id, error.code);
      return;
    }
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
export async function referralWebhook(
  event: Stripe.Event,
  gateway: ReferralStripe | null = referralStripe(),
) {
  if (!gateway) return;
  if (!gateway.core.enabled() && !gateway.core.environment.REFERRALS_HASH_KEY) return;
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
    if (!session.metadata?.referral_quote) return;
    await gateway.reconcileQuote(session.metadata.referral_quote);
  } else if (event.type === "invoice.paid") {
    const invoice = event.data.object as Invoice;
    // Only the first invoice can carry a referral; renewals never reach the provider here.
    if (invoice.billing_reason !== "subscription_create") return;
    const subscriptionId = reference(
      invoice.parent?.subscription_details?.subscription ?? invoice.subscription,
    );
    if (!subscriptionId) return;
    const quoteId =
      invoice.parent?.subscription_details?.metadata?.referral_quote ??
      (await gateway.stripe.subscriptions.retrieve(subscriptionId)).metadata.referral_quote;
    if (!quoteId) return;
    await gateway.reconcileQuote(quoteId);
  } else {
    const item = event.data.object as Stripe.Charge | Stripe.Dispute;
    const paymentId = reference(item.payment_intent);
    if (!paymentId || !/^pi_[A-Za-z0-9]+$/.test(paymentId)) return;
    const status = event.type === "charge.dispute.closed" ? (item as Stripe.Dispute).status : null;
    const block =
      (event.type === "charge.refunded" && (item as Stripe.Charge).refunded) || status === "lost"
        ? "revoked"
        : "hold";
    const known = await gateway.core.db.query(
      "SELECT 1 FROM referral_rewards WHERE payment_id=$1",
      [paymentId],
    );
    if (!known.rowCount) {
      // No reward for this payment yet: another product, an ordinary purchase, or a referral sale
      // still being recorded (its payment read as paid a moment ago). The reversal is kept as a
      // block, without a provider call, so that sale is recorded as blocked; unmatched blocks are
      // pruned after 90 days (Referrals.cleanup). A closed dispute adds nothing to keep.
      if (status === null || status === "lost")
        await gateway.core.blockPayment(paymentId, block, event.type);
    } else {
      await gateway.account();
      if (status === "won" || status === "warning_closed") await gateway.disputeClosed(paymentId);
      else await gateway.core.blockPayment(paymentId, block, event.type);
    }
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
  gateway: Pick<ReferralStripe, "core" | "reconcileQuote">,
  stopped: () => boolean = () => false,
) {
  await gateway.core.cleanup();
  // v3 makes a bonus available on payment, so one fresh provider read 15 minutes after the reward
  // was recorded is the backstop for a reversal the webhooks missed (reversals that arrive before
  // the reward are kept as blocks). Once per reward, also for a sale recorded late. It does not
  // delay the bonus.
  const { rows } = await gateway.core.db
    .query(`SELECT q.id,(r.state IN ('ready','active') AND NOT r.post_sale_checked) AS post_sale
    FROM referral_quotes q LEFT JOIN referral_rewards r ON r.quote_id=q.id
    WHERE ((q.state IN ('creating','open') AND q.expires_at < now())
        OR (r.state='pending' AND r.eligible_at <= now())
        OR (r.state IN ('ready','active') AND NOT r.post_sale_checked
          AND r.checked_at < now() - INTERVAL '15 minutes'))
      AND (q.reconcile_after IS NULL OR q.reconcile_after <= now())
    ORDER BY COALESCE(q.reconcile_after,q.expires_at),q.id LIMIT 10`);
  for (const row of rows) {
    if (stopped()) break;
    try {
      await gateway.reconcileQuote(row.id);
      if (row.post_sale)
        await gateway.core.db.query(
          "UPDATE referral_rewards SET post_sale_checked=TRUE WHERE quote_id=$1",
          [row.id],
        );
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
