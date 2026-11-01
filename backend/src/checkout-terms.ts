import { createHash } from "node:crypto";
import type Stripe from "stripe";

/** Identify server-selected commercial terms without retaining account data. */
export function checkoutTerms(plan: string, trial: boolean, params: Stripe.Checkout.SessionCreateParams): string {
  const terms = {
    mode: params.mode ?? null,
    items: (params.line_items ?? []).map(item => ({ price: item.price ?? null, quantity: item.quantity ?? null })),
    discounts: (params.discounts ?? []).map(item => ({ coupon: item.coupon ?? null, promotion_code: item.promotion_code ?? null })),
    trial, trialDays: params.subscription_data?.trial_period_days ?? null,
    promotion: params.metadata?.promo_id ?? null,
    campaign: params.metadata?.lifetime_campaign_id ?? null,
    campaignEnds: params.metadata?.lifetime_campaign_ends_at ?? null,
    automaticTax: params.automatic_tax?.enabled ?? null,
    // Only crypto sessions set these, so every card reservation keeps its existing hash.
    ...(params.payment_method_types ? {
      methods: params.payment_method_types,
      amounts: (params.line_items ?? []).map(item => item.price_data ? [item.price_data.currency, item.price_data.unit_amount ?? null] : null),
    } : {}),
  };
  return `${plan}:${createHash("sha256").update(JSON.stringify(terms)).digest("hex")}`;
}
