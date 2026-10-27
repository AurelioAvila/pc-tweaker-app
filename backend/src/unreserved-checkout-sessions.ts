import type Stripe from "stripe";

type Session = Pick<Stripe.Checkout.Session, "id" | "status" | "payment_status" | "client_reference_id" | "metadata">;
type List = (params: { status: "open" | "complete"; limit: number; created: { gte: number } }) => AsyncIterable<Session>;
/** A delayed method (SEPA Direct Debit) can take up to 14 business days to confirm a completed checkout. */
const PENDING_PAYMENT_DAYS = 20;

/** Checkout Sessions this account started without a guard reservation (legacy code before the cutover, or an
 * old instance still serving during a deploy) that can still charge it: open ones, which Stripe keeps for at
 * most 24 hours, and completed ones whose delayed payment has not settled. A search that reaches its limit
 * throws instead of reporting none. Sessions of this account without a product label count as the same
 * product: uncertainty never permits a second payable session. Tips carry no account and are never matched. */
export async function unreservedPayableSessions(list: List, userId: number, product: string, nowMs = Date.now(), maxScan = 2000): Promise<Session[]> {
  const found: Session[] = [];
  const now = Math.floor(nowMs / 1000);
  let scanned = 0;
  for (const [status, since] of [["open", 25 * 3600], ["complete", PENDING_PAYMENT_DAYS * 86400]] as const) {
    for await (const session of list({ status, limit: 100, created: { gte: now - since } })) {
      if (++scanned > maxScan) throw new Error("open_session_search_incomplete");
      if (status === "complete" && session.payment_status !== "unpaid") continue;
      if (session.metadata?.reservation_id) continue;
      if ((session.client_reference_id ?? session.metadata?.userId ?? null) !== String(userId)) continue;
      if (session.metadata?.product && session.metadata.product !== product) continue;
      found.push(session);
    }
  }
  return found;
}

type Sessions = { retrieve(id: string): Promise<Session>; expire(id: string): Promise<Session> };

/** Closes one unreserved session of this account, only while Stripe still reports it open and unpaid.
 * Anything else (completed, paid, someone else's) is left untouched and reported as needing recovery. */
export async function expireUnreservedSession(sessions: Sessions, userId: number, sessionId: string,
  onExpired: (session: Session) => Promise<void>): Promise<boolean> {
  const current = await sessions.retrieve(sessionId);
  const owner = current.client_reference_id ?? current.metadata?.userId ?? null;
  if (current.id !== sessionId || owner !== String(userId) || current.metadata?.reservation_id) return false;
  if (current.status === "expired" && current.payment_status === "unpaid") { await onExpired(current); return true; }
  if (current.status !== "open" || current.payment_status !== "unpaid") return false;
  const expired = await sessions.expire(sessionId);
  if (expired.id !== sessionId || expired.status !== "expired" || expired.payment_status !== "unpaid") return false;
  await onExpired(expired);
  return true;
}
