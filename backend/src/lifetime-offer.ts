/** A campaign is one absolute server-side window, shared by every visitor.
 * No first-visit timestamp, cookie, or process start time can extend it. */
export const LIFETIME_CAMPAIGN_DURATION_MS = 48 * 60 * 60 * 1000;
// Stripe requires at least 30 minutes from creation. The extra minute gives
// the request time to arrive without extending checkout indefinitely.
export const LIFETIME_CHECKOUT_GRACE_SECONDS = 31 * 60;

export type LifetimeOfferStatus = "disabled" | "scheduled" | "active" | "expired" | "invalid";
export type LifetimeOffer = {
  serverTime: string;
  id: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: LifetimeOfferStatus;
  available: boolean;
  product: "pctweaker";
  plan: "lifetime";
  checkoutGraceSeconds: number;
};

function utcTimestamp(raw: string | undefined): number | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  // Date.parse normalizes some impossible calendar dates; do not accept them.
  const normalized = raw.includes(".") ? raw : raw.replace("Z", ".000Z");
  return new Date(parsed).toISOString() === normalized ? parsed : null;
}

export function lifetimeOffer(
  environment: NodeJS.ProcessEnv = process.env,
  nowMs: number = Date.now(),
): LifetimeOffer {
  const rawId = environment.LIFETIME_CAMPAIGN_ID;
  const rawStart = environment.LIFETIME_CAMPAIGN_STARTS_AT;
  const rawEnd = environment.LIFETIME_CAMPAIGN_ENDS_AT;
  const configured = [rawId, rawStart, rawEnd].some((value) => value !== undefined);
  const checkoutConfigured = Boolean(environment.STRIPE_SECRET_KEY && environment.STRIPE_PRICE_LIFETIME);
  const base: LifetimeOffer = {
    serverTime: new Date(nowMs).toISOString(),
    id: null,
    startsAt: null,
    endsAt: null,
    status: "disabled",
    available: checkoutConfigured,
    product: "pctweaker",
    plan: "lifetime",
    checkoutGraceSeconds: LIFETIME_CHECKOUT_GRACE_SECONDS,
  };
  if (!configured) return base;

  const start = utcTimestamp(rawStart);
  const end = utcTimestamp(rawEnd);
  if (!rawId || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(rawId) || start === null || end === null ||
      end - start !== LIFETIME_CAMPAIGN_DURATION_MS) {
    return { ...base, status: "invalid", available: false };
  }
  const status = nowMs < start ? "scheduled" : nowMs >= end ? "expired" : "active";
  return {
    ...base,
    id: rawId,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    status,
    available: status === "active" && checkoutConfigured,
  };
}

type CheckoutDecision =
  | { allowed: false; status: number; code: string; error: string }
  | { allowed: true; expiresAt?: number; metadata?: Record<string, string> };

/** Called immediately before creating a session. The client cannot supply
 * the campaign ID, deadline, availability, or lifetime-ownership decision. */
export function lifetimeCheckoutDecision(offer: LifetimeOffer, alreadyOwnsLifetime: boolean): CheckoutDecision {
  if (alreadyOwnsLifetime) {
    return { allowed: false, status: 409, code: "LIFETIME_ALREADY_OWNED", error: "Your account already has Lifetime access." };
  }
  if (offer.status === "invalid") {
    return { allowed: false, status: 503, code: "LIFETIME_OFFER_UNAVAILABLE", error: "Lifetime checkout is temporarily unavailable." };
  }
  if (offer.status === "scheduled") {
    return { allowed: false, status: 409, code: "LIFETIME_OFFER_NOT_STARTED", error: "The Lifetime offer has not started yet." };
  }
  if (offer.status === "expired") {
    return { allowed: false, status: 409, code: "LIFETIME_OFFER_ENDED", error: "This Lifetime offer has ended. Existing Lifetime access remains valid." };
  }
  if (!offer.available) {
    return { allowed: false, status: 503, code: "LIFETIME_OFFER_UNAVAILABLE", error: "Lifetime checkout is temporarily unavailable." };
  }
  if (offer.status === "disabled") return { allowed: true };

  const nowSeconds = Math.floor(Date.parse(offer.serverTime) / 1000);
  const endSeconds = Math.floor(Date.parse(offer.endsAt!) / 1000);
  const expiresAt = Math.min(nowSeconds + 24 * 60 * 60, Math.max(endSeconds, nowSeconds + LIFETIME_CHECKOUT_GRACE_SECONDS));
  return {
    allowed: true,
    expiresAt,
    metadata: {
      lifetime_campaign_id: offer.id!,
      lifetime_campaign_starts_at: offer.startsAt!,
      lifetime_campaign_ends_at: offer.endsAt!,
      lifetime_checkout_expires_at: String(expiresAt),
    },
  };
}
