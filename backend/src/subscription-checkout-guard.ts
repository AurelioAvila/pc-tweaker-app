/** A local entitlement can lag a provider payment or renewal. An existing
 * subscription must be checked directly before a new Checkout is created. */
export class SubscriptionCheckoutGuardError extends Error {
  constructor(readonly code: "existing_subscription" | "subscription_review_required") { super(code); }
}
type Subscription = { status: string; metadata: Record<string, string> | null; items: { data: Array<{ price?: { id?: string } | null }>; has_more?: boolean } };
export async function assertNoUnsettledSubscription(
  subscriptions: AsyncIterable<Subscription>,
  product: string,
  identify: (metadata: Record<string, string> | null, priceIds: string[]) => string | null,
  maxScan = 1000,
  upgradeUserId?: string,
): Promise<void> {
  let scanned = 0;
  let upgradeMatches = 0;
  for await (const subscription of subscriptions) {
    if (++scanned > maxScan) throw new SubscriptionCheckoutGuardError("subscription_review_required");
    // Only terminal statuses can be ignored. Treat new or unknown statuses as
    // unsettled so a provider API change never silently permits a second sale.
    if (subscription.status === "canceled" || subscription.status === "incomplete_expired") continue;
    if (!subscription.items || subscription.items.has_more) throw new SubscriptionCheckoutGuardError("subscription_review_required");
    const priceIds = subscription.items.data.flatMap(item => item.price?.id ? [item.price.id] : []);
    const owner = identify(subscription.metadata, priceIds);
    if (!owner) throw new SubscriptionCheckoutGuardError("subscription_review_required");
    if (owner === product) {
      if (!upgradeUserId || subscription.metadata?.userId !== upgradeUserId ||
          !["active", "trialing"].includes(subscription.status) || ++upgradeMatches > 1)
        throw new SubscriptionCheckoutGuardError("existing_subscription");
    }
  }
  if (upgradeUserId && upgradeMatches !== 1) throw new SubscriptionCheckoutGuardError("subscription_review_required");
}
