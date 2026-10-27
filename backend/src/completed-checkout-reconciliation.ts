/** Only a settled subscription checkout whose exact subscription is now
 * terminal can be retired. Unknown or asynchronous payment states stay held. */
type Ref = string | { id: string } | null | undefined;
const ref = (value: Ref): string | null => typeof value === "string" ? value : value?.id ?? null;
export function canRetireCompletedCheckout(input: {
  userId: number; product: string; customerId: string; reservationId: string; sessionId: string;
  allowActiveUpgrade?: boolean;
  session: { id: string; status: string | null; payment_status: string; mode: string | null; customer: Ref; subscription: Ref; client_reference_id: string | null; metadata: Record<string, string> | null };
  subscription: { id: string; status: string; customer: Ref; metadata: Record<string, string> | null };
  identifyProduct: (subscription: { id: string; status: string; customer: Ref; metadata: Record<string, string> | null }) => string | null;
}): boolean {
  const { session, subscription } = input;
  return session.id === input.sessionId && session.status === "complete" &&
    (session.payment_status === "paid" || session.payment_status === "no_payment_required") &&
    session.mode === "subscription" && session.metadata?.reservation_id === input.reservationId &&
    session.metadata?.product === input.product && session.metadata?.userId === String(input.userId) &&
    session.client_reference_id === String(input.userId) && ref(session.customer) === input.customerId &&
    ref(session.subscription) === subscription.id && ref(subscription.customer) === input.customerId &&
    subscription.metadata?.userId === String(input.userId) && input.identifyProduct(subscription) === input.product &&
    (subscription.status === "canceled" || subscription.status === "incomplete_expired" ||
      (input.allowActiveUpgrade === true && (subscription.status === "active" || subscription.status === "trialing")));
}

/** A canceled one-time PaymentIntent cannot receive a later charge. Keep
 * referral sessions on hold until their separate quote is reconciled. */
export function canRetireCanceledPayment(input: {
  userId: number; product: string; customerId: string; reservationId: string; sessionId: string;
  session: { id: string; status: string | null; payment_status: string; mode: string | null; customer: Ref; payment_intent: Ref; client_reference_id: string | null; metadata: Record<string, string> | null };
  payment: { id: string; status: string; customer: Ref; amount_received: number };
}): boolean {
  const { session, payment } = input;
  return session.id === input.sessionId && session.status === "complete" && session.payment_status === "unpaid" &&
    session.mode === "payment" && !session.metadata?.referral_quote &&
    session.metadata?.reservation_id === input.reservationId && session.metadata?.product === input.product &&
    session.metadata?.userId === String(input.userId) && session.client_reference_id === String(input.userId) &&
    ref(session.customer) === input.customerId && ref(session.payment_intent) === payment.id &&
    ref(payment.customer) === input.customerId && payment.status === "canceled" && payment.amount_received === 0;
}
