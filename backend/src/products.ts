import { getPool } from "./db";
import { isEntitled, PERPETUAL_PLANS } from "./entitlement";

/**
 * The ecosystem's product catalogue, and the data access for the per-product
 * `entitlements` table.
 *
 * Product "pctweaker" is special: its entitlement predates this module and
 * lives on the `users` row itself (`is_pro` + `pro_expires_at`), so reads for
 * it go through the original columns and the original `isEntitled` logic.
 * Every other product reads and writes `entitlements` rows. Callers never
 * need to know which storage backs which product — `productEntitlement`
 * hides the split.
 */

/** Every product the backend will sign licenses or sell checkouts for.
 *  A request naming anything else is rejected before touching the database. */
export const PRODUCTS = ["pctweaker", "uninstaller"] as const;
export type Product = (typeof PRODUCTS)[number];

export function isKnownProduct(value: unknown): value is Product {
  return typeof value === "string" && (PRODUCTS as readonly string[]).includes(value);
}

export type ProductEntitlement = {
  product: Product;
  active: boolean;
  plan: string | null;
};

type EntitlementTableRow = {
  plan: string | null;
  expires_at: Date | string | null;
};

/**
 * Entitlement logic for `entitlements` rows. Unlike the legacy `isEntitled`
 * (which grandfathers a NULL expiry because pre-column subscribers exist),
 * rows in this table have no legacy: a NULL expiry grants access only for
 * explicitly perpetual plans. Everything else fails closed.
 */
export function isProductRowEntitled(row: EntitlementTableRow | null | undefined, now: Date = new Date()): boolean {
  if (!row) return false;
  if (row.plan && PERPETUAL_PLANS.has(row.plan)) return true;
  if (row.expires_at == null) return false;
  const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() > now.getTime();
}

/** Resolves one product's entitlement for a user, whichever store backs it. */
export async function productEntitlement(userId: number | string, product: Product): Promise<ProductEntitlement> {
  if (product === "pctweaker") {
    const { rows } = await getPool().query(
      "SELECT is_pro, plan, pro_expires_at FROM users WHERE id = $1",
      [userId],
    );
    const row = rows[0];
    return { product, active: isEntitled(row), plan: row?.plan ?? null };
  }
  const { rows } = await getPool().query(
    "SELECT plan, expires_at FROM entitlements WHERE user_id = $1 AND product = $2",
    [userId, product],
  );
  const row = rows[0];
  return { product, active: isProductRowEntitled(row), plan: row?.plan ?? null };
}

/** All products' entitlements for a user, for account UIs and loyalty pricing. */
export async function allEntitlements(userId: number | string): Promise<ProductEntitlement[]> {
  return Promise.all(PRODUCTS.map((product) => productEntitlement(userId, product)));
}

/** True when the user holds at least one active entitlement on any product —
 *  the ecosystem's definition of "existing customer" for loyalty pricing. */
export async function hasAnyActiveEntitlement(userId: number | string): Promise<boolean> {
  const all = await allEntitlements(userId);
  return all.some((entitlement) => entitlement.active);
}

/** Grants or refreshes a non-pctweaker product entitlement (webhook path). */
export async function upsertEntitlement(
  userId: number | string,
  product: Product,
  { plan, expiresAt, stripeSubscriptionId }: { plan: string | null; expiresAt: Date | null; stripeSubscriptionId?: string | null },
): Promise<void> {
  await getPool().query(
    `INSERT INTO entitlements (user_id, product, plan, expires_at, stripe_subscription_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id, product) DO UPDATE
        SET plan = EXCLUDED.plan,
            expires_at = EXCLUDED.expires_at,
            stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, entitlements.stripe_subscription_id),
            updated_at = now()`,
    [userId, product, plan, expiresAt, stripeSubscriptionId ?? null],
  );
}

/** Ends a non-pctweaker entitlement immediately (cancellation/refund path).
 *  The row is kept — history matters for support — but the expiry is now. */
export async function revokeEntitlement(userId: number | string, product: Product): Promise<void> {
  await getPool().query(
    "UPDATE entitlements SET expires_at = now(), updated_at = now() WHERE user_id = $1 AND product = $2",
    [userId, product],
  );
}
