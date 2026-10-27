import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import type { Pool, PoolClient } from "pg";
import { signReferralLicense } from "./referral-license";
import {
  addCalendarMonths,
  canonicalEmail,
  CAP_WINDOW_MS,
  challengePayload,
  CHALLENGE_MS,
  createInvitationCode,
  deviceKey,
  INVITATION_DAYS,
  INVITER_CAP,
  isReferralPlan,
  normalizeInvitationCode,
  REFERRAL_MONTHS,
  REFERRAL_PLAN,
  REFERRAL_VERSION,
  referralsEnabled,
  referralQuote,
  sharesPrivateDomain,
  UUID_PATTERN,
  verifyDeviceProof,
  type ReferralPlan,
} from "./referral-policy";

/** How far Stripe's payment time may run ahead of this server's clock. */
const PAID_AT_SKEW_MS = 5 * 60000;

export class ReferralError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}

/** Foreign keys to users and what deleting an account does to them (24 Oct 2026): the account's
 *  own rows go, the other party's rows stay with the erased side set to NULL. */
const USER_FOREIGN_KEYS = `('referral_accounts','user_id','CASCADE'),('referral_challenges','user_id','CASCADE'),
  ('referral_enrolments','buyer_id','SET NULL'),('referral_enrolments','inviter_id','SET NULL'),
  ('referral_rewards','buyer_id','SET NULL'),('referral_rewards','inviter_id','SET NULL')`;

export async function initReferralSchema(db: Pick<Pool, "query">): Promise<void> {
  // One query string runs as one transaction: the migration at the end applies whole or not at all.
  await db.query(`
    CREATE TABLE IF NOT EXISTS referral_accounts (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS referral_enrolments (
      id TEXT PRIMARY KEY, buyer_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      inviter_id INTEGER REFERENCES users(id) ON DELETE SET NULL, buyer_email_hash TEXT NOT NULL UNIQUE,
      policy_version TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
      checkout_locked BOOLEAN NOT NULL DEFAULT FALSE, CHECK (buyer_id <> inviter_id)
    );
    CREATE TABLE IF NOT EXISTS referral_quotes (
      id TEXT PRIMARY KEY, enrolment_id TEXT NOT NULL REFERENCES referral_enrolments(id),
      plan TEXT NOT NULL CHECK (plan IN ('monthly','annual','lifetime')),
      state TEXT NOT NULL CHECK (state IN ('creating','open','paid','expired')),
      price_id TEXT NOT NULL, base_minor INTEGER NOT NULL CHECK(base_minor > 0),
      offer_minor INTEGER NOT NULL CHECK(offer_minor > 0), discount_minor INTEGER NOT NULL CHECK(discount_minor > 0),
      subtotal_minor INTEGER NOT NULL CHECK(subtotal_minor > 0), currency TEXT NOT NULL CHECK(currency = 'eur'),
      customer_id TEXT NOT NULL, params JSONB NOT NULL, session_id TEXT UNIQUE, checkout_url TEXT,
      created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS referral_quote_active_idx ON referral_quotes(enrolment_id)
      WHERE state IN ('creating','open','paid');
    CREATE TABLE IF NOT EXISTS referral_rewards (
      id TEXT PRIMARY KEY, quote_id TEXT NOT NULL UNIQUE REFERENCES referral_quotes(id),
      payment_id TEXT NOT NULL UNIQUE, invoice_id TEXT UNIQUE, buyer_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      inviter_id INTEGER REFERENCES users(id) ON DELETE SET NULL, payer_hash TEXT NOT NULL UNIQUE,
      months INTEGER NOT NULL CHECK(months IN (6,12)), state TEXT NOT NULL
        CHECK(state IN ('pending','ready','active','hold','revoked')),
      paid_at TIMESTAMPTZ NOT NULL, eligible_at TIMESTAMPTZ NOT NULL, checked_at TIMESTAMPTZ NOT NULL,
      device_public_key TEXT, device_key_hash TEXT, activated_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
      reason TEXT, CHECK((activated_at IS NULL AND expires_at IS NULL AND device_key_hash IS NULL)
        OR (activated_at IS NOT NULL AND expires_at IS NOT NULL AND device_key_hash IS NOT NULL))
    );
    CREATE TABLE IF NOT EXISTS referral_payment_blocks (
      payment_id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('hold','revoked')),
      reason TEXT NOT NULL, checked_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS referral_challenges (
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, reward_id TEXT NOT NULL REFERENCES referral_rewards(id),
      purpose TEXT NOT NULL CHECK(purpose IN ('activate','license')), public_key TEXT NOT NULL,
      key_hash TEXT NOT NULL, payload TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS referral_audit (
      id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, action TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS referral_webhook_receipts (
      event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL
    );
    -- 24 Oct 2026, additive. Rollback: DROP TABLE referral_machines;
    -- ALTER TABLE referral_rewards DROP COLUMN post_sale_checked (older code reads neither).
    CREATE TABLE IF NOT EXISTS referral_machines (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, machine_hash TEXT NOT NULL,
      last_seen TIMESTAMPTZ NOT NULL, PRIMARY KEY(user_id, machine_hash)
    );
    CREATE INDEX IF NOT EXISTS referral_machines_hash_idx ON referral_machines(machine_hash);
    ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS post_sale_checked BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE referral_quotes ADD COLUMN IF NOT EXISTS reconcile_after TIMESTAMPTZ;
    ALTER TABLE referral_quotes ADD COLUMN IF NOT EXISTS reconcile_attempts INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS referral_rewards_inviter_idx ON referral_rewards(inviter_id,paid_at DESC);
    CREATE INDEX IF NOT EXISTS referral_challenges_expiry_idx ON referral_challenges(expires_at);
    -- 24 Oct 2026, account erasure: tables created before had these keys without ON DELETE, so
    -- deleting an account that took part failed (23503). Each key still on another rule is
    -- dropped and added again under its own name; once converted this finds nothing.
    -- Rollback: not needed to run older code, which works with either rule.
    DO $$
    DECLARE fk record;
    BEGIN
      FOR fk IN
        SELECT c.conname, c.conrelid::regclass AS tbl, w.col, w.rule
        FROM (VALUES ${USER_FOREIGN_KEYS}) AS w(tbl, col, rule)
        JOIN pg_attribute a ON a.attrelid = w.tbl::regclass AND a.attname = w.col
        JOIN pg_constraint c ON c.conrelid = a.attrelid AND c.contype = 'f'
          AND c.confrelid = 'users'::regclass AND c.conkey = ARRAY[a.attnum]
        WHERE c.confdeltype::text <> CASE w.rule WHEN 'CASCADE' THEN 'c' ELSE 'n' END
          OR (w.rule = 'SET NULL' AND a.attnotnull)
      LOOP
        IF fk.rule = 'SET NULL' THEN
          EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', fk.tbl, fk.col);
        END IF;
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE %s',
          fk.tbl, fk.conname, fk.conname, fk.col, fk.rule);
        RAISE NOTICE 'referral schema: % % now ON DELETE %', fk.tbl, fk.col, fk.rule;
      END LOOP;
    END $$;
  `);
}

/** Kept unlinked after an erasure, then replaced (Referrals.cleanup), per PRIVACY.md. */
export const ERASED_HASH_MONTHS = 24;

/**
 * The referral side of an account erasure, inside the caller's transaction and before the users
 * row is deleted (its foreign keys then remove the invitation code, device challenges and PC
 * hashes, and set the remaining links to NULL). The other party keeps what is theirs: a bonus
 * earned from the erased buyer's purchase stays valid; bonuses the erased inviter earned are
 * withdrawn and a friend's unused invitation from them ends. Kept without the link: the keyed
 * email and card hashes and the payment reference, so the same person or card cannot earn a
 * bonus again and a refund or dispute still withdraws the inviter's bonus.
 */
export async function eraseUserReferralData(tx: Pick<PoolClient, "query">, userId: number, now: Date) {
  // A checkout not yet settled with Stripe (still payable, or an asynchronous payment of a session
  // completed in time) would complete for an account that no longer exists. The reconciliation
  // worker settles it within about an hour of its expiry.
  const open = await tx.query(
    `SELECT 1 FROM referral_quotes q JOIN referral_enrolments e ON e.id=q.enrolment_id
    WHERE e.buyer_id=$1 AND q.state IN ('creating','open')`,
    [userId],
  );
  if (open.rowCount) throw new ReferralError("open_referral_checkout");
  // As the invited friend: unpaid checkouts and an invitation never used to buy, with their audit.
  const quotes = await tx.query(
    `DELETE FROM referral_quotes q USING referral_enrolments e
    WHERE e.id=q.enrolment_id AND e.buyer_id=$1 AND q.state<>'paid' RETURNING q.id`,
    [userId],
  );
  const invitations = await tx.query(
    `DELETE FROM referral_enrolments e WHERE e.buyer_id=$1
    AND NOT EXISTS(SELECT 1 FROM referral_quotes q WHERE q.enrolment_id=e.id) RETURNING e.id`,
    [userId],
  );
  await tx.query("DELETE FROM referral_audit WHERE subject_id = ANY($1::text[])", [
    [...quotes.rows, ...invitations.rows].map((row) => row.id),
  ]);
  // The paid checkout stays as the record behind the inviter's bonus, without the Stripe
  // customer, session or parameters. Nothing can be re-verified against an erased buyer, so a
  // bonus still waiting for verification goes to owner review.
  await tx.query(
    `UPDATE referral_quotes q SET customer_id='erased',session_id=NULL,checkout_url=NULL,params='{}'
    FROM referral_enrolments e WHERE e.id=q.enrolment_id AND e.buyer_id=$1`,
    [userId],
  );
  await tx.query("UPDATE referral_enrolments SET buyer_id=NULL WHERE buyer_id=$1", [userId]);
  await tx.query(
    `UPDATE referral_rewards SET buyer_id=NULL,invoice_id=NULL,post_sale_checked=TRUE,
    reason=CASE WHEN state='pending' THEN 'buyer_erased_review' ELSE reason END,
    state=CASE WHEN state='pending' THEN 'hold' ELSE state END WHERE buyer_id=$1`,
    [userId],
  );
  // As the inviter.
  const bonuses = await tx.query(
    `UPDATE referral_rewards SET inviter_id=NULL,state='revoked',reason='account_erased',checked_at=$2,
    device_public_key=NULL,device_key_hash=NULL,activated_at=NULL,expires_at=NULL WHERE inviter_id=$1`,
    [userId, now],
  );
  await tx.query(
    "UPDATE referral_enrolments SET inviter_id=NULL,expires_at=LEAST(expires_at,$2) WHERE inviter_id=$1",
    [userId, now],
  );
  return {
    referralCheckoutsDeleted: quotes.rowCount ?? 0,
    referralInvitationsDeleted: invitations.rowCount ?? 0,
    referralBonusesWithdrawn: bonuses.rowCount ?? 0,
  };
}

export type VerifiedReferralPayment = {
  quoteId: string;
  paymentId: string;
  invoiceId: string | null;
  buyerId: number;
  customerId: string;
  plan: ReferralPlan;
  priceId: string;
  currency: string;
  baseMinor: number;
  discountMinor: number;
  cashReceived: number;
  paidAt: Date;
  payerFingerprint: string | null;
  inviterFingerprints: string[];
  hasPriorPurchase: boolean;
  livemode: boolean;
  accountId: string;
  state: "paid" | "hold" | "revoked";
  reason?: string;
};

export type ReservedQuote = {
  id: string;
  plan: ReferralPlan;
  price_id: string;
  base_minor: number;
  offer_minor: number;
  discount_minor: number;
  subtotal_minor: number;
  currency: string;
  customer_id: string;
  params: Record<string, unknown>;
  session_id: string | null;
  checkout_url: string | null;
  created_at: Date;
  expires_at: Date;
  state: string;
};

export class Referrals {
  constructor(
    readonly db: Pool,
    readonly environment: NodeJS.ProcessEnv = process.env,
    readonly now: () => Date = () => new Date(),
  ) {}

  /** Replaceable only so tests can force a collision; production uses the CSPRNG generator. */
  newCode: () => string = createInvitationCode;

  enabled() {
    return referralsEnabled(this.environment);
  }
  private hash(value: string) {
    const key = this.environment.REFERRALS_HASH_KEY;
    if (!/^[a-f0-9]{64}$/i.test(key ?? "")) throw new ReferralError("referral_unavailable", 503);
    return createHmac("sha256", Buffer.from(key!, "hex")).update(value).digest("hex");
  }
  private async transaction<T>(work: (tx: PoolClient) => Promise<T>): Promise<T> {
    const tx = await this.db.connect();
    try {
      await tx.query("BEGIN");
      const result = await work(tx);
      await tx.query("COMMIT");
      return result;
    } catch (error) {
      await tx.query("ROLLBACK");
      throw error;
    } finally {
      tx.release();
    }
  }
  private requireEnabled() {
    if (!this.enabled()) throw new ReferralError("referral_unavailable", 503);
  }
  private async user(tx: Pick<PoolClient, "query">, id: number, lock = false) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new ReferralError("invalid_account", 400);
    const { rows } = await tx.query(
      `SELECT id,email,email_verified,is_pro,plan,stripe_customer_id,
      stripe_subscription_id FROM users WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
      [id],
    );
    if (!rows[0]?.email_verified) throw new ReferralError("verify_email_first", 403);
    return rows[0];
  }
  async audit(tx: Pick<PoolClient, "query">, subject: string, action: string) {
    await tx.query(
      "INSERT INTO referral_audit(id,subject_id,action,created_at) VALUES($1,$2,$3,$4)",
      [randomUUID(), subject, action, this.now()],
    );
  }

  /** Both accounts signed in from the same app installation (the id the app keeps per PC).
   *  Network-only sign-ins are too coarse to compare and are ignored. */
  private async sharedDevice(tx: Pick<PoolClient, "query">, inviterId: number, buyerId: number) {
    const { rows } = await tx.query(
      `SELECT 1 FROM sign_in_devices a JOIN sign_in_devices b ON b.fingerprint=a.fingerprint
      WHERE a.user_id=$1 AND b.user_id=$2 AND a.kind='device' AND b.kind='device' LIMIT 1`,
      [inviterId, buyerId],
    );
    return rows.length > 0;
  }

  /** Both accounts asked for a licence on the same Windows installation (the MachineGuid hash
   *  licences are bound to). It survives reinstalling and clearing the app's data, unlike the
   *  installation id, but two people sharing one PC also match: a hold for review, not a refusal. */
  private async sharedMachine(tx: Pick<PoolClient, "query">, inviterId: number, buyerId: number) {
    const { rows } = await tx.query(
      `SELECT 1 FROM referral_machines a JOIN referral_machines b ON b.machine_hash=a.machine_hash
      WHERE a.user_id=$1 AND b.user_id=$2 LIMIT 1`,
      [inviterId, buyerId],
    );
    return rows.length > 0;
  }

  /** Called on each licence refresh with the app's PC hash; kept only for accounts that take
   *  part in the programme (an invitation code or an accepted invitation), keyed, for 12 months. */
  async recordMachine(userId: number, deviceHash: string): Promise<boolean> {
    if (!/^[0-9a-f]{64}$/.test(deviceHash) || !Number.isSafeInteger(userId)) return false;
    const { rowCount } = await this.db.query(
      `INSERT INTO referral_machines(user_id,machine_hash,last_seen)
      SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM referral_accounts WHERE user_id=$1)
        OR EXISTS(SELECT 1 FROM referral_enrolments WHERE buyer_id=$1)
      ON CONFLICT(user_id,machine_hash) DO UPDATE SET last_seen=EXCLUDED.last_seen`,
      [userId, this.hash("machine:" + deviceHash), this.now()],
    );
    return (rowCount ?? 0) > 0;
  }

  /** The reward rules that do not depend on the payment itself, under the inviter lock taken by
   *  the caller: a refusal (Lifetime inviter, same app installation, yearly cap) or a review
   *  (same PC). `rewardId` is a reward already counted towards the cap. */
  private async eligibility(
    tx: Pick<PoolClient, "query">,
    inviterId: number | null,
    buyerId: number,
    rewardId: string | null = null,
  ) {
    // The inviter's account was erased: a sale through their old invitation earns nobody a bonus.
    if (inviterId === null) return { refused: "inviter_erased", review: null };
    const { rows } = await tx.query(
      `SELECT u.is_pro,u.plan,(SELECT count(*)::int FROM referral_rewards r
        WHERE r.inviter_id=u.id AND r.state<>'revoked' AND r.paid_at > $2 AND r.id IS DISTINCT FROM $3) AS recognised
      FROM users u WHERE u.id=$1`,
      [inviterId, new Date(this.now().getTime() - CAP_WINDOW_MS), rewardId],
    );
    const inviter = rows[0];
    // Lifetime owners still invite (the friend saves 10%) but receive nothing they could resell.
    // The buyer may have signed in on the inviter's PC after confirming the code.
    const refused =
      inviter?.is_pro === true && inviter.plan === "lifetime"
        ? "inviter_lifetime"
        : (await this.sharedDevice(tx, inviterId, buyerId))
          ? "shared_device"
          : (inviter?.recognised ?? 0) >= INVITER_CAP
            ? "inviter_cap"
            : null;
    const review =
      !refused && (await this.sharedMachine(tx, inviterId, buyerId)) ? "shared_pc_review" : null;
    return { refused, review };
  }
  /** Recording a sale and recording its refund or dispute are serialised per payment, so a
   *  reversal can never land between the block check and the reward insert. */
  private lockPayment(tx: Pick<PoolClient, "query">, paymentId: string) {
    return tx.query("SELECT pg_advisory_xact_lock(hashtext('referral-payment:' || $1::text))", [
      paymentId,
    ]);
  }
  /** Serialise this inviter's awards so concurrent purchases cannot both pass the yearly cap. */
  private lockInviter(tx: Pick<PoolClient, "query">, inviterId: number) {
    return tx.query("SELECT pg_advisory_xact_lock(hashtext('referral-inviter:' || $1::text))", [
      inviterId,
    ]);
  }

  async ownCode(userId: number): Promise<string> {
    this.requireEnabled();
    return this.transaction(async (tx) => {
      await this.user(tx, userId, true);
      const { rows } = await tx.query(
        "SELECT code FROM referral_accounts WHERE user_id=$1 AND enabled=TRUE",
        [userId],
      );
      if (rows[0]) return rows[0].code;
      const disabled = await tx.query("SELECT user_id FROM referral_accounts WHERE user_id=$1", [
        userId,
      ]);
      if (disabled.rows[0]) throw new ReferralError("referral_unavailable", 403);
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = this.newCode();
        const inserted = await tx.query(
          `INSERT INTO referral_accounts(user_id,code) VALUES($1,$2)
          ON CONFLICT(code) DO NOTHING RETURNING code`,
          [userId, code],
        );
        if (inserted.rows[0]) return inserted.rows[0].code;
      }
      throw new ReferralError("referral_unavailable", 503);
    });
  }

  async codeExists(code: string): Promise<boolean> {
    const normalized = normalizeInvitationCode(code);
    if (!this.enabled() || !normalized) return false;
    const { rows } = await this.db.query(
      "SELECT user_id FROM referral_accounts WHERE code=$1 AND enabled=TRUE",
      [normalized],
    );
    return rows.length === 1;
  }

  /** Caller must check provider history first; the account row serialises claims and checkout. */
  async claim(userId: number, code: unknown, hasPriorPurchase: boolean): Promise<void> {
    this.requireEnabled();
    const normalized = normalizeInvitationCode(code);
    if (!normalized) throw new ReferralError("invalid_invitation", 400);
    await this.transaction(async (tx) => {
      const buyer = await this.user(tx, userId, true);
      const { rows: inviters } = await tx.query(
        `SELECT a.user_id,u.email FROM referral_accounts a JOIN users u ON u.id=a.user_id
        WHERE a.code=$1 AND a.enabled=TRUE`,
        [normalized],
      );
      const inviter = inviters[0]?.user_id;
      // Current state, not history: a trial cancelled before any payment leaves a
      // subscription id behind but is not a purchase (paid history is checked separately).
      // A second account on an alias of the inviter's own address, on the same private
      // domain or signed in from the same app installation is a self-invitation.
      if (
        !inviter ||
        inviter === userId ||
        canonicalEmail(inviters[0].email) === canonicalEmail(buyer.email) ||
        sharesPrivateDomain(inviters[0].email, buyer.email) ||
        hasPriorPurchase ||
        buyer.is_pro ||
        (await this.sharedDevice(tx, inviter, userId))
      ) {
        throw new ReferralError("invitation_not_eligible");
      }
      const { rows: previous } = await tx.query(
        "SELECT inviter_id FROM referral_enrolments WHERE buyer_id=$1",
        [userId],
      );
      if (previous[0]) {
        if (previous[0].inviter_id !== inviter) throw new ReferralError("invitation_already_bound");
        return;
      }
      // Do not attach an invitation after an ordinary checkout has already
      // fixed its price. The buyer row lock also serializes a concurrent
      // reservation insert through its foreign key to users.
      const guardTable = await tx.query("SELECT to_regclass('public.web_checkout_reservations') AS name");
      if (guardTable.rows[0]?.name) {
        const checkout = await tx.query("SELECT 1 FROM web_checkout_reservations WHERE user_id=$1 AND product='pctweaker' LIMIT 1", [userId]);
        if (checkout.rowCount) throw new ReferralError("close_existing_checkout_first");
      }
      const id = randomUUID();
      try {
        await tx.query(
          `INSERT INTO referral_enrolments(id,buyer_id,inviter_id,buyer_email_hash,policy_version,created_at,expires_at)
          VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            id,
            userId,
            inviter,
            this.hash("email:" + canonicalEmail(buyer.email)),
            REFERRAL_VERSION,
            this.now(),
            new Date(this.now().getTime() + INVITATION_DAYS * 86400000),
          ],
        );
      } catch (error) {
        if ((error as { code?: string }).code === "23505")
          throw new ReferralError("invitation_not_eligible");
        throw error;
      }
      await this.audit(tx, id, "claimed");
    });
  }

  async enrolment(userId: number) {
    const { rows } = await this.db.query("SELECT * FROM referral_enrolments WHERE buyer_id=$1", [
      userId,
    ]);
    return rows[0] ?? null;
  }

  /** An expired invitation must not prevent buying without a referral discount. */
  async expiredWithoutCheckout(userId: number, enrolmentId: string): Promise<boolean> {
    return this.transaction(async (tx) => {
      // Match reserve's lock order so an in-flight referral checkout cannot be missed.
      await this.user(tx, userId, true);
      const { rows } = await tx.query(
        "SELECT expires_at FROM referral_enrolments WHERE id=$1 AND buyer_id=$2 FOR UPDATE",
        [enrolmentId, userId],
      );
      if (!rows[0] || new Date(rows[0].expires_at) > this.now()) return false;
      const active = await tx.query(
        "SELECT id FROM referral_quotes WHERE enrolment_id=$1 AND state <> 'expired' LIMIT 1",
        [enrolmentId],
      );
      return active.rowCount === 0;
    });
  }

  async reserve(
    userId: number,
    plan: ReferralPlan,
    input: {
      priceId: string;
      customerId: string;
      base: number;
      offer: number;
      currency: string;
      params: Record<string, unknown>;
      expiresAt: Date;
    },
  ): Promise<ReservedQuote> {
    this.requireEnabled();
    const price = referralQuote(input.base, input.offer, input.currency);
    if (
      !price ||
      !isReferralPlan(plan) ||
      !input.customerId.startsWith("cus_") ||
      !input.priceId.startsWith("price_") ||
      input.expiresAt.getTime() < this.now().getTime() + 30 * 60000 ||
      input.expiresAt.getTime() > this.now().getTime() + 24 * 3600000
    )
      throw new ReferralError("invalid_offer", 400);
    return this.transaction(async (tx) => {
      const buyer = await this.user(tx, userId, true);
      const { rows } = await tx.query(
        "SELECT * FROM referral_enrolments WHERE buyer_id=$1 FOR UPDATE",
        [userId],
      );
      const enrolment = rows[0];
      if (
        !enrolment ||
        new Date(enrolment.expires_at) <= this.now() ||
        enrolment.policy_version !== REFERRAL_VERSION ||
        buyer.is_pro
      ) {
        throw new ReferralError("invitation_not_eligible");
      }
      const { rows: active } = await tx.query(
        "SELECT * FROM referral_quotes WHERE enrolment_id=$1 AND state <> 'expired'",
        [enrolment.id],
      );
      if (active[0]) {
        if (active[0].state === "paid") throw new ReferralError("invitation_already_used");
        if (active[0].plan !== plan || new Date(active[0].expires_at) <= this.now())
          throw new ReferralError("close_existing_checkout_first");
        return active[0];
      }
      const id = randomUUID();
      const params = { ...input.params, referralQuoteId: id };
      const { rows: inserted } = await tx.query(
        `INSERT INTO referral_quotes(id,enrolment_id,plan,state,price_id,
        base_minor,offer_minor,discount_minor,subtotal_minor,currency,customer_id,params,created_at,expires_at)
        VALUES($1,$2,$3,'creating',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          id,
          enrolment.id,
          plan,
          input.priceId,
          price.base,
          price.offer,
          price.totalDiscount,
          price.subtotal,
          price.currency,
          input.customerId,
          JSON.stringify(params),
          this.now(),
          input.expiresAt,
        ],
      );
      await tx.query("UPDATE referral_enrolments SET checkout_locked=TRUE WHERE id=$1", [
        enrolment.id,
      ]);
      await this.audit(tx, id, "checkout_reserved");
      return inserted[0];
    });
  }

  async saveSession(quoteId: string, sessionId: string, url: string) {
    const destination = new URL(url);
    if (
      destination.protocol !== "https:" ||
      destination.hostname !== "checkout.stripe.com" ||
      destination.username ||
      destination.password ||
      !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)
    )
      throw new ReferralError("invalid_checkout", 502);
    const { rowCount } = await this.db.query(
      `UPDATE referral_quotes SET session_id=$2,checkout_url=$3,state='open'
      WHERE id=$1 AND state IN ('creating','open') AND (session_id IS NULL OR session_id=$2)`,
      [quoteId, sessionId, url],
    );
    if (rowCount !== 1) throw new ReferralError("checkout_changed");
  }

  /** Only after the provider has confirmed that no payable session exists for this quote:
   *  a session it reports expired, or none at all (`null`) once the quote is past its expiry. */
  async expireQuote(quoteId: string, providerSessionId: string | null, reason: string) {
    const { rowCount } = await this.db.query(
      `UPDATE referral_quotes SET state='expired',session_id=COALESCE(session_id,$2)
      WHERE id=$1 AND state IN ('creating','open') AND (session_id IS NULL OR session_id=$2)`,
      [quoteId, providerSessionId],
    );
    if (rowCount) await this.audit(this.db, quoteId, "checkout_expired:" + reason);
  }

  /** The buyer pays the ordinary price; the reason stays in the private audit log. */
  async ordinaryCheckout(enrolmentId: string, reason: string) {
    await this.audit(this.db, enrolmentId, "ordinary_checkout:" + reason);
    return null;
  }

  /** A paid or provider-inconsistent quote that cannot be verified automatically: release the
   *  buyer (no further referral checkout) and keep any bonus under owner review. */
  async reviewQuote(quoteId: string, code: string) {
    await this.transaction(async (tx) => {
      const { rowCount } = await tx.query(
        "UPDATE referral_quotes SET state='paid' WHERE id=$1 AND state IN ('creating','open')",
        [quoteId],
      );
      if (rowCount) await this.audit(tx, quoteId, "review:" + code);
    });
  }

  async quote(
    id: string,
  ): Promise<(ReservedQuote & { buyer_id: number; inviter_id: number }) | null> {
    if (!UUID_PATTERN.test(id)) return null;
    const { rows } = await this.db.query(
      `SELECT q.*,e.buyer_id,e.inviter_id FROM referral_quotes q
      JOIN referral_enrolments e ON e.id=q.enrolment_id WHERE q.id=$1`,
      [id],
    );
    return rows[0] ?? null;
  }

  private expectedMode() {
    return !(
      this.environment.NODE_ENV === "test" && this.environment.REFERRALS_TEST_MODE === "true"
    );
  }

  /** Internal provider adapter only. No HTTP endpoint accepts this object from a client. */
  async recordPayment(payment: VerifiedReferralPayment): Promise<string | null> {
    if (
      payment.accountId !== this.environment.REFERRALS_STRIPE_ACCOUNT ||
      payment.livemode !== this.expectedMode()
    ) {
      throw new ReferralError("payment_environment_mismatch", 400);
    }
    return this.transaction(async (tx) => {
      const { rows } = await tx.query(
        `SELECT q.*,e.buyer_id,e.inviter_id FROM referral_quotes q
        JOIN referral_enrolments e ON e.id=q.enrolment_id WHERE q.id=$1 FOR UPDATE OF q`,
        [payment.quoteId],
      );
      const quote = rows[0];
      if (!quote) return null;
      const matches = this.quoteMatches(quote, payment);
      // A successful purchase that does not match its quote (async payment after expiry, other
      // currency, changed invoice shape) never retries forever: the buyer is released, the
      // inviter's bonus waits for owner review, and the webhook is acknowledged.
      if (!matches) {
        await tx.query("UPDATE referral_quotes SET state='paid' WHERE id=$1", [quote.id]);
        await tx.query(
          `UPDATE referral_rewards SET state='hold',reason='payment_mismatch_review',checked_at=$2
          WHERE quote_id=$1 AND state IN ('pending','ready')`,
          [quote.id, this.now()],
        );
        await this.audit(tx, quote.id, "review:payment_does_not_match_quote");
        if (!/^pi_[A-Za-z0-9]+$/.test(payment.paymentId)) return null;
        const paidAt = Number.isFinite(payment.paidAt.getTime()) ? payment.paidAt : this.now();
        await tx.query(
          `INSERT INTO referral_rewards(id,quote_id,payment_id,invoice_id,buyer_id,inviter_id,payer_hash,
          months,state,paid_at,eligible_at,checked_at,reason)
          VALUES($1,$2,$3,NULL,$4,$5,$6,$7,'hold',$8,$9,$10,'payment_mismatch_review') ON CONFLICT DO NOTHING`,
          [
            randomUUID(),
            quote.id,
            payment.paymentId,
            quote.buyer_id,
            quote.inviter_id,
            this.hash("unverified-payment:" + payment.paymentId),
            REFERRAL_MONTHS[quote.plan as ReferralPlan],
            paidAt,
            paidAt,
            this.now(),
          ],
        );
        return null;
      }
      const { rows: previous } = await tx.query(
        "SELECT id,payment_id FROM referral_rewards WHERE quote_id=$1",
        [quote.id],
      );
      if (previous[0]) {
        if (previous[0].payment_id === payment.paymentId) return previous[0].id;
        await this.audit(tx, quote.id, "review:duplicate_purchase");
        return null;
      }
      const payer = payment.payerFingerprint
        ? this.hash("payer:" + payment.payerFingerprint)
        : null;
      // Missing identity evidence is not a free pass. The payment remains paid; only its bonus is withheld.
      if (
        payment.hasPriorPurchase ||
        (payer && payment.inviterFingerprints.includes(payment.payerFingerprint!))
      ) {
        await this.audit(tx, quote.id, "purchase_ineligible");
        await tx.query("UPDATE referral_quotes SET state='paid' WHERE id=$1", [quote.id]);
        return null;
      }
      await this.lockPayment(tx, payment.paymentId);
      // A refund or dispute recorded before the sale, even one that arrived while this payment
      // was being read from Stripe, is a block row by now.
      const { rows: blocks } = await tx.query(
        "SELECT state FROM referral_payment_blocks WHERE payment_id=$1",
        [payment.paymentId],
      );
      await this.lockInviter(tx, quote.inviter_id);
      const { refused: ineligible, review } = await this.eligibility(
        tx,
        quote.inviter_id,
        quote.buyer_id,
      );
      // v3: a verified successful payment makes the bonus available at once. Refund and
      // dispute webhooks (payment blocks) withdraw it later, even after activation. Only a
      // payment without payer evidence (no card fingerprint to deduplicate), or one whose two
      // accounts used the same PC, waits for review.
      const state = ineligible
        ? "revoked"
        : (blocks[0]?.state ??
          (payment.state === "paid" ? (payer && !review ? "ready" : "hold") : payment.state));
      const id = randomUUID();
      const inserted = await tx.query(
        `INSERT INTO referral_rewards(id,quote_id,payment_id,invoice_id,buyer_id,inviter_id,payer_hash,
          months,state,paid_at,eligible_at,checked_at,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT DO NOTHING RETURNING id`,
        [
          id,
          quote.id,
          payment.paymentId,
          payment.invoiceId,
          quote.buyer_id,
          quote.inviter_id,
          payer ?? this.hash("unverified-payment:" + payment.paymentId),
          REFERRAL_MONTHS[payment.plan],
          state,
          payment.paidAt,
          payment.paidAt,
          this.now(),
          ineligible ??
            payment.reason ??
            (state === "hold" ? (!payer ? "payer_identity_review" : review) : null),
        ],
      );
      await tx.query("UPDATE referral_quotes SET state='paid' WHERE id=$1", [quote.id]);
      if (!inserted.rowCount) {
        await this.audit(tx, quote.id, "purchase_duplicate_ineligible");
        return null;
      }
      await this.audit(tx, id, "payment_" + state);
      return id;
    });
  }

  private quoteMatches(
    quote: ReservedQuote & { buyer_id: number },
    payment: VerifiedReferralPayment,
  ): boolean {
    return !(
      quote.buyer_id !== payment.buyerId ||
      quote.customer_id !== payment.customerId ||
      quote.plan !== payment.plan ||
      quote.price_id !== payment.priceId ||
      quote.currency !== payment.currency ||
      quote.base_minor !== payment.baseMinor ||
      quote.discount_minor !== payment.discountMinor ||
      payment.cashReceived < quote.subtotal_minor ||
      !Number.isSafeInteger(payment.cashReceived) ||
      !Number.isFinite(payment.paidAt.getTime()) ||
      // Stripe's clock and ours differ by seconds, so a sale recorded at once can look a moment
      // ahead. No bound at the quote's expiry: Stripe completes no session after it, while an
      // asynchronous payment of a session completed in time can succeed days later.
      payment.paidAt.getTime() > this.now().getTime() + PAID_AT_SKEW_MS ||
      payment.paidAt.getTime() < Math.floor(new Date(quote.created_at).getTime() / 1000) * 1000 ||
      !/^pi_[A-Za-z0-9]+$/.test(payment.paymentId)
    );
  }

  /** A durable tombstone also protects refunds that arrive before the sale event. */
  async blockPayment(paymentId: string, state: "hold" | "revoked", reason: string) {
    if (!/^pi_[A-Za-z0-9]+$/.test(paymentId)) throw new ReferralError("invalid_payment", 400);
    await this.transaction(async (tx) => {
      await this.lockPayment(tx, paymentId);
      await tx.query(
        `INSERT INTO referral_payment_blocks(payment_id,state,reason,checked_at) VALUES($1,$2,$3,$4)
        ON CONFLICT(payment_id) DO UPDATE SET state=CASE WHEN referral_payment_blocks.state='revoked' THEN 'revoked' ELSE EXCLUDED.state END,
        reason=EXCLUDED.reason,checked_at=EXCLUDED.checked_at`,
        [paymentId, state, reason, this.now()],
      );
      await tx.query(
        `UPDATE referral_rewards SET state=CASE WHEN state='revoked' THEN 'revoked' ELSE $2 END,
        reason=$3,checked_at=$4 WHERE payment_id=$1`,
        [paymentId, state, reason, this.now()],
      );
      await this.audit(tx, paymentId, "payment_" + state);
    });
  }

  /** Called only with freshly re-read provider facts, right after the payment is recorded. A hold
   *  requires recorded review, not an old success event. (Before v3 this also matured bonuses.) */
  async mature(rewardId: string, payment: VerifiedReferralPayment) {
    await this.transaction(async (tx) => {
      const { rows } = await tx.query("SELECT * FROM referral_rewards WHERE id=$1 FOR UPDATE", [
        rewardId,
      ]);
      const reward = rows[0];
      if (
        !reward ||
        reward.payment_id !== payment.paymentId ||
        reward.quote_id !== payment.quoteId ||
        payment.accountId !== this.environment.REFERRALS_STRIPE_ACCOUNT ||
        payment.livemode !== this.expectedMode()
      ) {
        throw new ReferralError("reward_not_found", 404);
      }
      if (payment.state !== "paid") {
        await tx.query(
          "UPDATE referral_rewards SET state=$2,reason=$3,checked_at=$4 WHERE id=$1 AND state <> 'revoked'",
          [rewardId, payment.state, payment.reason ?? "payment_review", this.now()],
        );
        return;
      }
      await tx.query(
        `UPDATE referral_rewards SET state='ready',checked_at=$2 WHERE id=$1 AND state='pending'
        AND eligible_at <= $2 AND NOT EXISTS(SELECT 1 FROM referral_payment_blocks b WHERE b.payment_id=referral_rewards.payment_id)`,
        [rewardId, this.now()],
      );
      await tx.query(
        `UPDATE referral_rewards SET checked_at=$2 WHERE id=$1 AND state IN ('ready','active')
        AND NOT EXISTS(SELECT 1 FROM referral_payment_blocks b WHERE b.payment_id=referral_rewards.payment_id)`,
        [rewardId, this.now()],
      );
    });
  }

  /**
   * After a dispute closed in the merchant's favour, called only with freshly re-read provider
   * facts showing nothing outstanding (no refund, no other open or lost dispute). The bonus
   * returns to ready (or active, if already activated) only if the purchase would still
   * qualify: same quote facts and usable payer evidence; otherwise it stays held for review.
   */
  async releaseDisputeHold(payment: VerifiedReferralPayment) {
    if (
      payment.state !== "paid" ||
      payment.accountId !== this.environment.REFERRALS_STRIPE_ACCOUNT ||
      payment.livemode !== this.expectedMode()
    )
      throw new ReferralError("payment_review_required");
    await this.transaction(async (tx) => {
      const { rows } = await tx.query(
        "SELECT * FROM referral_rewards WHERE payment_id=$1 FOR UPDATE",
        [payment.paymentId],
      );
      const reward = rows[0];
      if (!reward || reward.state !== "hold" || reward.quote_id !== payment.quoteId) return;
      const { rows: quotes } = await tx.query(
        `SELECT q.*,e.buyer_id FROM referral_quotes q JOIN referral_enrolments e
        ON e.id=q.enrolment_id WHERE q.id=$1`,
        [reward.quote_id],
      );
      const identity =
        payment.payerFingerprint &&
        !payment.inviterFingerprints.includes(payment.payerFingerprint) &&
        !payment.hasPriorPurchase;
      // The same rules as when a sale is recorded: a hold must not release a bonus they refuse.
      await this.lockInviter(tx, reward.inviter_id);
      const rules = await this.eligibility(tx, reward.inviter_id, reward.buyer_id, reward.id);
      const review =
        !quotes[0] || !this.quoteMatches(quotes[0], payment)
          ? "payment_mismatch_review"
          : !identity
            ? "payer_identity_review"
            : rules.review;
      await tx.query("DELETE FROM referral_payment_blocks WHERE payment_id=$1 AND state='hold'", [
        payment.paymentId,
      ]);
      await tx.query(`UPDATE referral_rewards SET state=$2,reason=$3,checked_at=$4 WHERE id=$1`, [
        reward.id,
        rules.refused ? "revoked" : review ? "hold" : reward.activated_at ? "active" : "ready",
        rules.refused ?? review,
        this.now(),
      ]);
      await this.audit(tx, payment.paymentId, review ? "dispute_won_" + review : "dispute_won");
    });
  }

  /** The inviter sees only an aggregate state of each friend's purchase: no plan, payment
   *  date, refund or dispute. Duration and dates appear only for a bonus that is theirs to use. */
  async summary(userId: number) {
    await this.user(this.db, userId);
    const { rows } = await this.db.query(
      `SELECT id,months,state,expires_at,device_key_hash FROM referral_rewards
      WHERE inviter_id=$1 ORDER BY paid_at DESC LIMIT 100`,
      [userId],
    );
    return {
      enabled: this.enabled(),
      policyVersion: REFERRAL_VERSION,
      discountPercent: 10,
      rewardsPerYear: INVITER_CAP,
      invitationDays: INVITATION_DAYS,
      rewards: rows.map((reward) => publicReward(reward)),
    };
  }

  /** Retention (PRIVACY.md, Invite a friend): run by the reconciliation worker every minute. */
  async cleanup() {
    await this.db.query("DELETE FROM referral_challenges WHERE expires_at < $1", [
      new Date(this.now().getTime() - 86400000),
    ]);
    await this.db.query("DELETE FROM referral_webhook_receipts WHERE completed_at < $1", [
      new Date(this.now().getTime() - 90 * 86400000),
    ]);
    // A refund or dispute of a payment that never became a referral sale (other products,
    // ordinary purchases) is kept only while a late sale record could still need it.
    await this.db.query(
      `DELETE FROM referral_payment_blocks b WHERE b.checked_at < $1
      AND NOT EXISTS(SELECT 1 FROM referral_rewards r WHERE r.payment_id=b.payment_id)`,
      [new Date(this.now().getTime() - 90 * 86400000)],
    );
    await this.db.query("DELETE FROM referral_machines WHERE last_seen < $1", [
      new Date(this.now().getTime() - CAP_WINDOW_MS),
    ]);
    // A referral checkout that was never paid: 30 days after it expired. An invitation that
    // expired without a purchase: 90 days after. Their audit rows go with them.
    for (const [sql, days] of [
      [`DELETE FROM referral_quotes q WHERE q.state='expired' AND q.expires_at < $1
        AND NOT EXISTS(SELECT 1 FROM referral_rewards r WHERE r.quote_id=q.id)`, 30],
      [`DELETE FROM referral_enrolments e WHERE e.expires_at < $1
        AND NOT EXISTS(SELECT 1 FROM referral_quotes q WHERE q.enrolment_id=e.id)`, 90],
    ] as const) {
      await this.db.query(
        `WITH gone AS (${sql} RETURNING id) DELETE FROM referral_audit WHERE subject_id IN (SELECT id FROM gone)`,
        [new Date(this.now().getTime() - days * 86400000)],
      );
    }
    // After an erasure the email and card hashes and the payment reference are kept unlinked for
    // 24 months after the purchase, then replaced; the audit log is kept 24 months for everyone.
    const cutoff = new Date(this.now());
    cutoff.setUTCMonth(cutoff.getUTCMonth() - ERASED_HASH_MONTHS);
    await this.db.query(
      `UPDATE referral_rewards SET payer_hash='erased:'||id,payment_id='erased:'||id
      WHERE buyer_id IS NULL AND paid_at < $1 AND payment_id NOT LIKE 'erased:%'`,
      [cutoff],
    );
    await this.db.query(
      `UPDATE referral_enrolments SET buyer_email_hash='erased:'||id
      WHERE buyer_id IS NULL AND created_at < $1 AND buyer_email_hash NOT LIKE 'erased:%'`,
      [cutoff],
    );
    await this.db.query("DELETE FROM referral_audit WHERE created_at < $1", [cutoff]);
  }

  async challenge(userId: number, rewardId: unknown, purpose: unknown, publicKey: unknown) {
    if (
      typeof rewardId !== "string" ||
      !UUID_PATTERN.test(rewardId) ||
      !["activate", "license"].includes(String(purpose))
    ) {
      throw new ReferralError("invalid_challenge", 400);
    }
    const key = deviceKey(publicKey);
    await this.user(this.db, userId);
    const { rows } = await this.db.query(
      "SELECT * FROM referral_rewards WHERE id=$1 AND inviter_id=$2",
      [rewardId, userId],
    );
    const reward = rows[0];
    if (
      !reward ||
      !["ready", "active"].includes(reward.state) ||
      (purpose === "license" && reward.state !== "active") ||
      (reward.device_key_hash && reward.device_key_hash !== key.hash)
    )
      throw new ReferralError("bonus_unavailable", 403);
    const id = randomUUID();
    const nonce = randomBytes(32).toString("base64url");
    const payload = challengePayload(
      userId,
      purpose as "activate" | "license",
      rewardId,
      id,
      nonce,
      key.hash,
    );
    const expiresAt = new Date(this.now().getTime() + CHALLENGE_MS);
    await this.db.query(
      `INSERT INTO referral_challenges(id,user_id,reward_id,purpose,public_key,key_hash,payload,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, userId, rewardId, purpose, key.publicKey, key.hash, payload, expiresAt],
    );
    // Informational only: the app compares it with the PC clock before proving, so a badly
    // set clock is explained before activation changes any state.
    return {
      id,
      payload,
      expiresAt: expiresAt.toISOString(),
      serverTime: Math.floor(this.now().getTime() / 1000),
    };
  }

  async prove(userId: number, challengeId: unknown, signature: unknown, bearerToken: string) {
    if (typeof challengeId !== "string" || !UUID_PATTERN.test(challengeId) || !bearerToken)
      throw new ReferralError("invalid_proof", 400);
    return this.transaction(async (tx) => {
      await this.user(tx, userId);
      const { rows } = await tx.query(
        "SELECT * FROM referral_challenges WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [challengeId, userId],
      );
      const challenge = rows[0];
      if (
        !challenge ||
        challenge.used_at ||
        new Date(challenge.expires_at) <= this.now() ||
        !verifyDeviceProof(challenge.public_key, challenge.payload, signature)
      )
        throw new ReferralError("invalid_proof", 403);
      const { rows: rewards } = await tx.query(
        "SELECT * FROM referral_rewards WHERE id=$1 AND inviter_id=$2 FOR UPDATE",
        [challenge.reward_id, userId],
      );
      const reward = rewards[0];
      if (
        !reward ||
        !["ready", "active"].includes(reward.state) ||
        (reward.device_key_hash && reward.device_key_hash !== challenge.key_hash) ||
        (challenge.purpose === "license" && reward.state !== "active")
      )
        throw new ReferralError("bonus_unavailable", 403);
      const blocked = await tx.query("SELECT 1 FROM referral_payment_blocks WHERE payment_id=$1", [
        reward.payment_id,
      ]);
      if (blocked.rows.length) throw new ReferralError("bonus_unavailable", 403);
      if (reward.state === "ready") {
        this.requireEnabled();
        const expiry = addCalendarMonths(this.now(), reward.months);
        await tx.query(
          `UPDATE referral_rewards SET state='active',device_public_key=$2,device_key_hash=$3,
          activated_at=$4,expires_at=$5 WHERE id=$1`,
          [reward.id, challenge.public_key, challenge.key_hash, this.now(), expiry],
        );
        reward.expires_at = expiry;
        await this.audit(tx, reward.id, "activated");
      }
      if (new Date(reward.expires_at) <= this.now()) throw new ReferralError("bonus_expired", 403);
      // No provider call per refresh: the state above already reflects every stored refund and
      // dispute webhook (payment blocks), and the payment was re-read from the provider before 'ready'.
      await tx.query("UPDATE referral_challenges SET used_at=$2 WHERE id=$1", [
        challenge.id,
        this.now(),
      ]);
      return signReferralLicense(
        {
          userId: String(userId),
          isPro: true,
          product: "pctweaker",
          plan: REFERRAL_PLAN,
          issuedAt: Math.floor(this.now().getTime() / 1000),
          expiresAt: Math.floor(new Date(reward.expires_at).getTime() / 1000),
          schemaVersion: 2,
          grantId: reward.id,
          deviceKeyHash: challenge.key_hash,
          sessionHash: createHash("sha256").update(bearerToken).digest("hex"),
        },
        this.environment,
      );
    });
  }
}

type RewardRow = {
  id: string;
  months: number;
  state: string;
  expires_at: Date | null;
  device_key_hash: string | null;
};
/** pending = still being verified (includes owner review), active = a bonus the inviter can
 *  use or is using, not_eligible = revoked, refunded, disputed and lost, capped or Lifetime. */
export function publicReward(reward: RewardRow) {
  const status =
    reward.state === "revoked"
      ? "not_eligible"
      : reward.state === "ready" || reward.state === "active"
        ? "active"
        : "pending";
  return {
    id: reward.id,
    status,
    ...(status === "active"
      ? {
          months: reward.months,
          activatedUntil: reward.state === "active" ? reward.expires_at : null,
          deviceKeyHash: reward.state === "active" ? reward.device_key_hash : null,
        }
      : {}),
  };
}
