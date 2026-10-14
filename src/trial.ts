/** Free trial and subscription state, as the account service publishes it
 *  (trial-3-giorni/CONTRATTO.md §1-2). Display only: the signed licence is
 *  still the one thing that unlocks Pro (src-tauri/src/license.rs), and the
 *  server alone decides at checkout whether a trial applies. */

export type BillingProduct = "pctweaker" | "uninstaller";
export type EntitlementState = "none" | "trialing" | "active" | "blocked";
export type BlockedReason = "none" | "payment_failed" | "canceled" | "trial_already_used";

export type ProductBilling = {
  product: BillingProduct;
  state: EntitlementState;
  plan: string | null;
  /** Milliseconds since the epoch; only while trialing. */
  trialEndsAt: number | null;
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  canStartTrial: boolean;
  blockedReason: BlockedReason;
  /** What this account renews at, in cents, when the server says so (a
   *  loyalty price differs from the public list). */
  renewAmount: number | null;
};

export type BillingStatus = {
  trialEnabled: boolean;
  trialDays: number;
  portalAvailable: boolean;
  products: ProductBilling[];
};

/** Public price list: what a plan renews at, in euro cents. */
export type PriceList = {
  trialEnabled: boolean;
  trialDays: number;
  prices: { product: string; plan: string; amount: number }[];
};

const STATES: EntitlementState[] = ["none", "trialing", "active", "blocked"];
const REASONS: BlockedReason[] = ["none", "payment_failed", "canceled", "trial_already_used"];
const PRODUCTS: BillingProduct[] = ["pctweaker", "uninstaller"];

const ms = (v: unknown): number | null => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};
const days = (v: unknown) =>
  Number.isInteger(v) && (v as number) > 0 && (v as number) <= 31 ? (v as number) : 0;

/** Unknown states read as "none" and unknown reasons as "canceled" (§1). */
export function parseBillingStatus(value: unknown): BillingStatus | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== "object" || !Array.isArray(v.products)) return null;
  const products = (v.products as (Record<string, unknown> | null)[]).flatMap(
    (p): ProductBilling[] => {
      if (!p || !PRODUCTS.includes(p.product as BillingProduct)) return [];
      const state = STATES.includes(p.state as EntitlementState)
        ? (p.state as EntitlementState)
        : "none";
      const reason = (p.blocked_reason ?? "none") as BlockedReason;
      const trialEndsAt = state === "trialing" ? ms(p.trial_ends_at) : null;
      return [
        {
          product: p.product as BillingProduct,
          // A trial without an end date cannot be counted down: show it as Pro.
          state: state === "trialing" && trialEndsAt === null ? "active" : state,
          plan: typeof p.plan === "string" ? p.plan : null,
          trialEndsAt,
          periodEnd: ms(p.current_period_end),
          cancelAtPeriodEnd: p.cancel_at_period_end === true,
          canStartTrial: p.can_start_trial === true,
          blockedReason:
            state !== "blocked"
              ? "none"
              : REASONS.includes(reason) && reason !== "none"
                ? reason
                : "canceled",
          renewAmount:
            Number.isInteger(p.renew_amount) && (p.renew_amount as number) > 0
              ? (p.renew_amount as number)
              : null,
        },
      ];
    },
  );
  return {
    trialEnabled: v.trial_enabled === true,
    trialDays: days(v.trial_days),
    portalAvailable: v.portal_available === true,
    products,
  };
}

/** Null for anything malformed: a broken answer must never print a price. */
export function parsePriceList(value: unknown): PriceList | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== "object" || !Array.isArray(v.prices)) return null;
  if (v.currency !== undefined && v.currency !== "eur") return null;
  const prices = (v.prices as (Record<string, unknown> | null)[]).filter(
    (p) =>
      p &&
      typeof p.product === "string" &&
      typeof p.plan === "string" &&
      Number.isInteger(p.amount) &&
      (p.amount as number) > 0,
  ) as PriceList["prices"];
  return { trialEnabled: v.trial_enabled === true, trialDays: days(v.trial_days), prices };
}

/** What the trial button needs: whether to offer it, for how many days, and
 *  the price it turns into. Null keeps today's plain "Go Pro" button, which
 *  is also what happens while the server switch is off. */
export function trialOffer(
  product: BillingProduct,
  plan: string,
  prices: PriceList | null,
  status: BillingStatus | null,
  /** The regular price from a live promotion, when the price list is missing. */
  promoRegular?: number | null,
): { days: number; amount: number } | null {
  const mine = status?.products.find((p) => p.product === product);
  const amount =
    // The Uninstaller sells one plan, so its account price is that plan's.
    (product === "uninstaller" ? mine?.renewAmount : null) ??
    prices?.prices.find((p) => p.product === product && p.plan === plan)?.amount ??
    promoRegular ??
    null;
  if (!amount || (plan !== "monthly" && plan !== "annual")) return null;
  // Signed in: the account's own answer decides. Signed out: the public switch.
  const open = status
    ? status.trialEnabled && mine?.canStartTrial === true
    : prices?.trialEnabled === true;
  const length = (status ? status.trialDays : 0) || prices?.trialDays || 0;
  return open && length ? { days: length, amount } : null;
}

/** True when this account has used its trial for the product and the server
 *  is offering trials: the plans then say why there is no trial button. */
export function trialUsed(product: BillingProduct, status: BillingStatus | null): boolean {
  const mine = status?.products.find((p) => p.product === product);
  if (!status || !mine) return false;
  return (
    (mine.state === "blocked" && mine.blockedReason === "trial_already_used") ||
    (status.trialEnabled && mine.state === "none" && !mine.canStartTrial)
  );
}

/** Time left in a trial, for "2 d 5 h left" and the progress bar. */
export function trialLeft(trialEndsAt: number, trialDays: number, now: number) {
  const left = Math.max(0, trialEndsAt - now);
  const total = Math.max(1, (trialDays || 3) * 86_400_000);
  return {
    days: Math.floor(left / 86_400_000),
    hours: Math.floor((left % 86_400_000) / 3_600_000),
    minutes: Math.floor((left % 3_600_000) / 60_000),
    /** Share of the trial already used, 0..1. */
    used: Math.min(1, Math.max(0, 1 - left / total)),
    over: left === 0,
  };
}

/** The moment worth looking again: the nearest trial end still ahead. */
export function nextTrialEnd(status: BillingStatus | null, now: number): number | null {
  const ends = (status?.products ?? [])
    .map((p) => p.trialEndsAt)
    .filter((t): t is number => t !== null && t > now);
  return ends.length ? Math.min(...ends) : null;
}

/** What changed since the app last looked, for the one notice shown when the
 *  person comes back: Pro that stopped, or a trial that became a subscription.
 *  `seen` is the previous snapshot (product -> state[:reason]). */
export type BillingChange = {
  product: BillingProduct;
  kind: "paused" | "trialEnded" | "ended" | "converted";
};

export function billingSnapshot(status: BillingStatus): Record<string, string> {
  return Object.fromEntries(
    status.products.map((p) => [
      p.product,
      p.state === "blocked" ? `blocked:${p.blockedReason}` : p.state,
    ]),
  );
}

export function billingChanges(
  seen: Record<string, string> | null,
  status: BillingStatus,
): BillingChange[] {
  if (!seen) return [];
  return status.products.flatMap((p): BillingChange[] => {
    const before = seen[p.product];
    if (before !== "trialing" && before !== "active") return [];
    if (p.state === "active" && before === "trialing")
      return [{ product: p.product, kind: "converted" }];
    if (p.state !== "blocked" || p.blockedReason === "trial_already_used") return [];
    const kind =
      p.blockedReason === "payment_failed"
        ? "paused"
        : before === "trialing"
          ? "trialEnded"
          : "ended";
    return [{ product: p.product, kind }];
  });
}
