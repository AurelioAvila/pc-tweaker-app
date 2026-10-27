import type { Reservation } from "./web-checkout-reservations";
type Repository = { reserve(userId: number, product: string, plan: string): Promise<{ created: boolean; reservation: Reservation }>; attach(id: string, session: string): Promise<boolean>; complete(id: string, session: string): Promise<boolean>; releaseVerifiedExpired(id: string, session: string): Promise<boolean>; find?(userId: number, product: string): Promise<Reservation | null>; releaseStaleCreating?(id: string): Promise<boolean>; releaseRefusedCreating?(id: string): Promise<boolean> };
/** `unreservedSessionOpen` reports a payable session this account opened outside the guard (legacy code, or an
 * old instance during a deploy). It is checked again after creation, so either side of a race sees the other. */
type Options = { unreservedSessionOpen?: () => Promise<boolean> };
type ProviderSession = { id: string; url: string | null; status: "open" | "complete" | "expired" | null; payment_status: "paid" | "unpaid" | "no_payment_required"; metadata: { reservation_id?: string; referral_quote?: string } | null };
type Provider = { create(id: string, key: string): Promise<ProviderSession>; retrieve(id: string): Promise<ProviderSession>; findByReservation(id: string, createdAt?: Date | string): Promise<ProviderSession[]>; onExpired(userId: number, session: ProviderSession): Promise<void>; expire?(id: string): Promise<ProviderSession>; refused?(error: unknown): boolean };
export class GuardedCheckoutError extends Error { constructor(readonly code: string) { super(code); } }
/** Experimental coordinator. An unknown creation result stays reserved. */
export async function guardedCheckout(repo: Repository, provider: Provider, userId: number, product: string, plan: string, replaceDifferentTerms = false, options: Options = {}, recovered = false): Promise<{ url: string }> {
  const { created, reservation } = await repo.reserve(userId, product, plan);
  const { reservation_id: id } = reservation;
  if (!created && reservation.state === "complete") throw new GuardedCheckoutError("payment_processing");
  let session: ProviderSession;
  if (created) {
    try { session = await provider.create(id, `guarded-checkout:${id}`); }
    catch (error) {
      // Only a definite refusal (the provider rejected the request, so no session exists) frees the account at
      // once; a timeout or lost response keeps the reservation, since that session may exist.
      if (provider.refused?.(error) && repo.releaseRefusedCreating) await repo.releaseRefusedCreating(id);
      throw error;
    }
    if (!session.id || session.metadata?.reservation_id !== id) throw new GuardedCheckoutError("provider_mismatch");
    if (!await repo.attach(id, session.id)) throw new GuardedCheckoutError("checkout_recovery_required");
    if (options.unreservedSessionOpen && await options.unreservedSessionOpen()) {
      // A legacy session appeared while this one was being created: withdraw the new one, never both payable.
      await cancelGuardedCheckout(repo as Repository & { find(userId: number, product: string): Promise<Reservation | null> }, provider as Provider & { expire(id: string): Promise<ProviderSession> }, userId, product, id);
      throw new GuardedCheckoutError("other_checkout_pending");
    }
  } else if (reservation.state === "creating") {
    // The provider lookup must be exhaustive. No match or several matches is
    // uncertain, never permission to create another payable session.
    const matches = await provider.findByReservation(id, reservation.created_at);
    // No session after the stale window (far beyond any request timeout and Stripe's list delay): the
    // creation never happened, so the reservation is released instead of blocking this account forever.
    if (matches.length === 0 && !recovered && repo.releaseStaleCreating && await repo.releaseStaleCreating(id))
      return guardedCheckout(repo, provider, userId, product, plan, replaceDifferentTerms, options, true);
    if (matches.length !== 1 || !matches[0].id || matches[0].metadata?.reservation_id !== id) throw new GuardedCheckoutError("checkout_recovery_required");
    session = matches[0];
    if (!await repo.attach(id, session.id)) throw new GuardedCheckoutError("checkout_recovery_required");
  } else {
    if (!reservation.session_id) throw new GuardedCheckoutError("checkout_recovery_required");
    session = await provider.retrieve(reservation.session_id);
    if (session.id !== reservation.session_id || session.metadata?.reservation_id !== id) throw new GuardedCheckoutError("provider_mismatch");
  }
  if (session.status === "complete") { await repo.complete(id, session.id); throw new GuardedCheckoutError("payment_processing"); }
  if (session.status === "expired" && session.payment_status === "unpaid") { await provider.onExpired(userId, session); await repo.releaseVerifiedExpired(id, session.id); throw new GuardedCheckoutError("checkout_expired_retry"); }
  if (session.status !== "open" || session.payment_status !== "unpaid" || !session.url) throw new GuardedCheckoutError("checkout_recovery_required");
  if (reservation.plan !== plan) {
    if (!replaceDifferentTerms || !repo.find || !provider.expire) throw new GuardedCheckoutError("other_checkout_pending");
    await cancelGuardedCheckout(repo as Repository & { find(userId: number, product: string): Promise<Reservation | null> }, provider as Provider & { expire(id: string): Promise<ProviderSession> }, userId, product, id);
    return guardedCheckout(repo, provider, userId, product, plan, false, options);
  }
  let parsed: URL;
  try { parsed = new URL(session.url); } catch { throw new GuardedCheckoutError("provider_mismatch"); }
  if (parsed.protocol !== "https:" || parsed.hostname !== "checkout.stripe.com" || parsed.username || parsed.password || parsed.port) throw new GuardedCheckoutError("provider_mismatch");
  return { url: parsed.href };
}

/** A customer may close their own open session before choosing another plan.
 * Never trusts a client-supplied session id; uncertain outcomes remain locked. */
export async function cancelGuardedCheckout(repo: Repository & { find(userId: number, product: string): Promise<Reservation | null> }, provider: Provider & { expire(id: string): Promise<ProviderSession> }, userId: number, product: string, expectedReservationId?: string): Promise<void> {
  const reservation = await repo.find(userId, product);
  if (!reservation) { if (expectedReservationId) throw new GuardedCheckoutError("checkout_recovery_required"); return; }
  if (expectedReservationId && reservation.reservation_id !== expectedReservationId) throw new GuardedCheckoutError("checkout_recovery_required");
  if (reservation.state === "creating" || !reservation.session_id) throw new GuardedCheckoutError("checkout_recovery_required");
  if (reservation.state === "complete") throw new GuardedCheckoutError("payment_processing");
  const id = reservation.reservation_id;
  const sessionId = reservation.session_id;
  let session = await provider.retrieve(sessionId);
  function verify(value: ProviderSession) {
    if (value.id !== sessionId || value.metadata?.reservation_id !== id) throw new GuardedCheckoutError("provider_mismatch");
  }
  verify(session);
  if (session.status === "complete") { await repo.complete(id, sessionId); throw new GuardedCheckoutError("payment_processing"); }
  if (session.status === "open" && session.payment_status === "unpaid") { session = await provider.expire(sessionId); verify(session); }
  if (session.status !== "expired" || session.payment_status !== "unpaid") throw new GuardedCheckoutError("checkout_recovery_required");
  await provider.onExpired(userId, session);
  if (!await repo.releaseVerifiedExpired(id, sessionId)) throw new GuardedCheckoutError("checkout_recovery_required");
}
