import { randomUUID } from "crypto";
import { getPool } from "./db";

export type Receipt = {
  userId: string;
  plan: string | null;
  expiresAt: string | null;
  product: string;
  chargedLabel: string | null;
};

/** Commit receipt delivery before acknowledging the paid event. Access is
 * granted separately, so a mail-provider outage never withholds the license. */
export async function queueReceipt(key: string, receipt: Receipt): Promise<void> {
  if (!key || key.length > 255) throw new Error("Invalid receipt identity");
  await getPool().query(
    `INSERT INTO billing_receipts (receipt_key, user_id, payload)
     VALUES ($1, $2, $3) ON CONFLICT (receipt_key) DO NOTHING`,
    [key, receipt.userId, JSON.stringify(receipt)],
  );
}

/** A lease prevents competing API instances from sending the same row.
 * Delivery is at-least-once: a crash after provider acceptance can duplicate
 * a receipt, but cannot duplicate a charge or grant a different entitlement. */
export async function deliverReceipts(send: (receipt: Receipt) => Promise<void>, now = new Date()): Promise<number> {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT receipt_key FROM billing_receipts WHERE delivered_at IS NULL
     AND next_attempt_at <= $1 AND (locked_until IS NULL OR locked_until < $1)
     ORDER BY next_attempt_at LIMIT 5`, [now],
  );
  let delivered = 0;
  for (const row of rows) {
    const token = randomUUID();
    const lease = new Date(now.getTime() + 10 * 60_000);
    const claimed = await db.query(
      `UPDATE billing_receipts SET lock_token = $2, locked_until = $3, attempts = attempts + 1
       WHERE receipt_key = $1 AND delivered_at IS NULL
       AND next_attempt_at <= $4
       AND (locked_until IS NULL OR locked_until < $4) RETURNING payload, attempts`,
      [row.receipt_key, token, lease, now],
    );
    if (!claimed.rows.length) continue;
    const receipt = claimed.rows[0];
    try {
      await send(receipt.payload as Receipt);
      await db.query(
        `UPDATE billing_receipts SET delivered_at = $3, locked_until = NULL, lock_token = NULL
         WHERE receipt_key = $1 AND lock_token = $2`, [row.receipt_key, token, new Date()],
      );
      delivered++;
    } catch {
      const delay = Math.min(6 * 60 * 60_000, 30_000 * 2 ** Math.min(receipt.attempts, 10));
      await db.query(
        `UPDATE billing_receipts SET next_attempt_at = $3, locked_until = NULL, lock_token = NULL
         WHERE receipt_key = $1 AND lock_token = $2`,
        [row.receipt_key, token, new Date(now.getTime() + delay)],
      );
      console.error("Billing receipt delivery failed; durable retry scheduled");
    }
  }
  return delivered;
}

export function startReceiptWorker(send: (receipt: Receipt) => Promise<void>): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await deliverReceipts(send); }
    catch { console.error("Billing receipt worker failed; will retry"); }
    finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, 30_000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
