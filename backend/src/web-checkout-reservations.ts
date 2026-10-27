import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

/** An unfinished reservation is deliberately not cleared on timeout. A provider
 * request can succeed even when its response is lost; clearing on a timer could
 * allow a second independently payable session. This module is not wired to
 * production checkout yet. */
export async function initWebCheckoutReservations(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS web_checkout_reservations (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product TEXT NOT NULL,
    plan TEXT NOT NULL,
    reservation_id UUID NOT NULL UNIQUE,
    state TEXT NOT NULL CHECK (state IN ('creating', 'open', 'complete')),
    session_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product),
    CHECK ((state = 'creating' AND session_id IS NULL) OR (state IN ('open', 'complete') AND session_id IS NOT NULL))
  )`);
}
export type Reservation = { user_id: number; product: string; plan: string; reservation_id: string; state: "creating" | "open" | "complete"; session_id: string | null; created_at?: Date | string };
export class WebCheckoutReservations {
  constructor(private readonly pool: Pool) {}
  /** Atomic across processes and plan choices. Never overwrites an open intent. */
  async reserve(userId: number, product: string, plan: string): Promise<{ created: boolean; reservation: Reservation }> {
    const reservationId = randomUUID();
    const inserted = await this.pool.query<Reservation>(`INSERT INTO web_checkout_reservations (user_id, product, plan, reservation_id, state)
      VALUES ($1, $2, $3, $4, 'creating') ON CONFLICT (user_id, product) DO NOTHING RETURNING *`, [userId, product, plan, reservationId]);
    if (inserted.rows[0]) return { created: true, reservation: inserted.rows[0] };
    const existing = await this.pool.query<Reservation>(`SELECT * FROM web_checkout_reservations WHERE user_id = $1 AND product = $2`, [userId, product]);
    if (!existing.rows[0]) throw new Error("Reservation changed; retry safely.");
    return { created: false, reservation: existing.rows[0] };
  }
  async find(userId: number, product: string): Promise<Reservation | null> {
    const result = await this.pool.query<Reservation>(`SELECT * FROM web_checkout_reservations WHERE user_id = $1 AND product = $2`, [userId, product]);
    return result.rows[0] ?? null;
  }
  /** Save the provider ID only for the exact reservation that created it. */
  async attach(reservationId: string, sessionId: string): Promise<boolean> {
    const r = await this.pool.query(`UPDATE web_checkout_reservations SET session_id = $2, state = 'open'
      WHERE reservation_id = $1 AND state = 'creating' AND session_id IS NULL`, [reservationId, sessionId]);
    return r.rowCount === 1;
  }
  /** A signed webhook or server-side provider read must confirm completion. */
  async complete(reservationId: string, sessionId: string): Promise<boolean> {
    const r = await this.pool.query(`UPDATE web_checkout_reservations SET state = 'complete'
      WHERE reservation_id = $1 AND session_id = $2 AND state IN ('open', 'complete')`, [reservationId, sessionId]);
    return r.rowCount === 1;
  }
  /** Only the caller that has independently verified this exact Stripe session
   * is expired and unpaid may release it; creating/complete cannot be cleared. */
  async releaseVerifiedExpired(reservationId: string, sessionId: string): Promise<boolean> {
    const r = await this.pool.query(`DELETE FROM web_checkout_reservations
      WHERE reservation_id = $1 AND session_id = $2 AND state = 'open'`, [reservationId, sessionId]);
    return r.rowCount === 1;
  }
  /** Only after an exhaustive provider search found no session for it. The age uses the database clock and is
   * far beyond any provider request timeout, so an in-flight creation cannot still succeed afterwards. */
  async releaseStaleCreating(reservationId: string, minutes = 15): Promise<boolean> {
    const r = await this.pool.query(`DELETE FROM web_checkout_reservations
      WHERE reservation_id = $1 AND state = 'creating' AND session_id IS NULL
        AND created_at < now() - make_interval(mins => $2)`, [reservationId, minutes]);
    return r.rowCount === 1;
  }
  /** Only when the provider definitely refused the creation request (no session can exist for it). */
  async releaseRefusedCreating(reservationId: string): Promise<boolean> {
    const r = await this.pool.query(`DELETE FROM web_checkout_reservations
      WHERE reservation_id = $1 AND state = 'creating' AND session_id IS NULL`, [reservationId]);
    return r.rowCount === 1;
  }
  /** Caller verifies the exact settled session and terminal subscription with Stripe first. */
  async releaseReconciledCompleted(reservationId: string, sessionId: string): Promise<boolean> {
    const r = await this.pool.query(`DELETE FROM web_checkout_reservations
      WHERE reservation_id = $1 AND session_id = $2 AND state = 'complete'`, [reservationId, sessionId]);
    return r.rowCount === 1;
  }
}
