import type Stripe from "stripe";

type Session = Stripe.Checkout.Session;
type Sessions = {
  create(params: Stripe.Checkout.SessionCreateParams, options: { idempotencyKey: string }): Promise<Session>;
  retrieve(id: string): Promise<Session>;
  expire(id: string): Promise<Session>;
  list(params: { limit: number; customer?: string; created?: { gte: number } }): AsyncIterable<Session>;
};
/** A bounded search must throw, never return an incomplete empty result. The
 * caller keeps the reservation if recovery cannot establish a unique match. */
export function stripeGuardedProvider(sessions: Sessions, params: Stripe.Checkout.SessionCreateParams, maxScan = 5000, referral?: (params: Stripe.Checkout.SessionCreateParams) => Promise<{ url: string; sessionId: string } | null>, onReferralExpired?: (userId: number, session: Session) => Promise<void>) {
  async function findByReservation(reservationId: string, createdAt?: Date | string) {
    const matches: Session[] = [];
    let examined = 0;
    const createdMs = createdAt ? new Date(createdAt).getTime() : NaN;
    const lowerBound = Number.isFinite(createdMs) ? Math.max(0, Math.floor(createdMs / 1000) - 3600) : undefined;
    for await (const session of sessions.list({ limit: 100, ...(typeof params.customer === "string" ? { customer: params.customer } : {}), ...(lowerBound !== undefined ? { created: { gte: lowerBound } } : {}) })) {
      if (++examined > maxScan) throw new Error("provider_search_incomplete");
      if (session.metadata?.reservation_id === reservationId) matches.push(session);
      if (matches.length > 1) return matches;
    }
    return matches;
  }
  return {
    async create(reservationId: string, idempotencyKey: string) {
      const metadata = { ...params.metadata, reservation_id: reservationId };
      const tagged = { ...params, metadata };
      if (referral) {
        const result = await referral(tagged);
        if (result) {
          const session = await sessions.retrieve(result.sessionId);
          if (session.id !== result.sessionId || session.url !== result.url || session.metadata?.reservation_id !== reservationId) throw new Error("referral_session_unverified");
          return session;
        }
      }
      return sessions.create(tagged, { idempotencyKey });
    },
    retrieve(id: string) { return sessions.retrieve(id); },
    /** Stripe rejected the request itself (4xx invalid request): no session was created, and the idempotency key
     * replays the same refusal. Connection errors, timeouts, 5xx, rate limits and referral errors stay uncertain. */
    refused(error: unknown) {
      const e = error as { type?: string; statusCode?: number } | null;
      return e?.type === "StripeInvalidRequestError" && typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 500 && e.statusCode !== 409 && e.statusCode !== 429;
    },
    expire(id: string) { return sessions.expire(id); },
    findByReservation,
    async onExpired(userId: number, session: Session) {
      if (!session.metadata?.referral_quote) return;
      if (!onReferralExpired) throw new Error("referral_cleanup_unavailable");
      await onReferralExpired(userId, session);
    },
  };
}
