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
  };
  return `${plan}:${createHash("sha256").update(JSON.stringify(terms)).digest("hex")}`;
}
