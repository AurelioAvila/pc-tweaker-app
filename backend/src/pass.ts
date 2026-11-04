import { getPool } from "./db";

/**
 * The 7-day Pro pass (owner decision, 4 Nov 2026): €4.99 once, no
 * subscription and no renewal, for people who use the tools now and then.
 *
 * Sold only while PASS_7D_ENABLED=1 and STRIPE_PRICE_PASS_7D names its Price.
 * A paid pass is always honoured, switch or not: the switch only stops new
 * checkouts. Its access lives in `users.pass_expires_at`, apart from the
 * subscription/Lifetime columns, so neither side can shorten the other; the
 * licence takes whichever grants access (products.ts).
 */
export const PASS_PLAN = "pass_7d";
export const PASS_DAYS = 7;
const DAY_MS = 86_400_000;

export function passEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.PASS_7D_ENABLED === "1" && Boolean(environment.STRIPE_PRICE_PASS_7D);
}

type Purchase = { days: number; granted_at: Date | string };

/** Where an account's passes end, replayed in the order they were granted:
 *  each starts at the later of its own grant and the end of the ones before,
 *  so a pass bought while another runs adds its days on top. */
export function passEnd(purchases: Purchase[]): Date | null {
  let end: number | null = null;
  for (const p of purchases) {
    const granted = new Date(p.granted_at).getTime();
    end = Math.max(end ?? granted, granted) + p.days * DAY_MS;
  }
  return end === null ? null : new Date(end);
}

type Client = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>; release: () => void };

async function inTransaction<T>(userId: string, work: (client: Client) => Promise<T>): Promise<T | null> {
  const client = (await getPool().connect()) as unknown as Client;
  try {
    await client.query("BEGIN");
    // One writer per account: two passes paid at once still stack.
    const owner = await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!owner.rows[0]) { await client.query("ROLLBACK"); return null; }
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function recompute(client: Client, userId: string): Promise<Date | null> {
  const { rows } = await client.query(
    `SELECT days, granted_at FROM billing_pass_purchases
      WHERE user_id = $1 AND granted_at IS NOT NULL AND reversed_at IS NULL
      ORDER BY granted_at, checkout_id`, [userId]);
  const end = passEnd(rows);
  await client.query("UPDATE users SET pass_expires_at = $2 WHERE id = $1", [userId, end]);
  return end;
}

async function recorded(client: Client, checkoutId: string, userId: string) {
  const { rows } = await client.query("SELECT user_id, granted_at, reversed_at FROM billing_pass_purchases WHERE checkout_id = $1", [checkoutId]);
  if (rows[0] && String(rows[0].user_id) !== String(userId)) throw new Error("Pass checkout belongs to a different account");
  return rows[0] ?? null;
}

/** Grants one paid pass Checkout, once: a replayed or second event for the
 *  same session, or one already refunded, changes nothing. Returns the new
 *  end of access when this call granted it, else null. `now` is server time. */
export async function grantPass(userId: string, checkoutId: string, now: Date = new Date()): Promise<Date | null> {
  return inTransaction(userId, async (client) => {
    if (await recorded(client, checkoutId, userId)) return null;
    await client.query("INSERT INTO billing_pass_purchases (checkout_id, user_id, days, granted_at) VALUES ($1, $2, $3, $4)",
      [checkoutId, userId, PASS_DAYS, now]);
    return recompute(client, userId);
  });
}

/** A fully refunded or lost-dispute pass: its days come off, the others stay
 *  (a later pass moves up to where the reversed one started). Recorded even
 *  before the grant, so a late checkout event cannot grant it. Returns
 *  whether access that was running got shorter. */
export async function reversePass(userId: string, checkoutId: string, now: Date = new Date()): Promise<boolean> {
  const changed = await inTransaction(userId, async (client) => {
    const row = await recorded(client, checkoutId, userId);
    if (row?.reversed_at) return false;
    if (row) await client.query("UPDATE billing_pass_purchases SET reversed_at = $2 WHERE checkout_id = $1", [checkoutId, now]);
    else await client.query("INSERT INTO billing_pass_purchases (checkout_id, user_id, days, reversed_at) VALUES ($1, $2, $3, $4)",
      [checkoutId, userId, PASS_DAYS, now]);
    const { rows } = await client.query("SELECT pass_expires_at FROM users WHERE id = $1", [userId]);
    const before = rows[0]?.pass_expires_at ? new Date(rows[0].pass_expires_at).getTime() : 0;
    const after = (await recompute(client, userId))?.getTime() ?? 0;
    return before > now.getTime() && after < before;
  });
  return changed === true;
}

/** Whether the webhook has settled this pass Checkout (granted or reversed),
 *  so its web checkout reservation can be released for the next purchase. */
export async function passRecorded(checkoutId: string): Promise<boolean> {
  const { rowCount } = await getPool().query("SELECT 1 FROM billing_pass_purchases WHERE checkout_id = $1", [checkoutId]);
  return Boolean(rowCount);
}
