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
  HOLD_DAYS,
  HOLD_MS,
  INVITATION_DAYS,
  INVITER_CAP,
  isReferralPlan,
  normalizeInvitationCode,
  REFERRAL_MONTHS,
  REFERRAL_PLAN,
  REFERRAL_VERSION,
  referralsEnabled,
  referralQuote,
  UUID_PATTERN,
  verifyDeviceProof,
  type ReferralPlan,
} from "./referral-policy";

export class ReferralError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}

export async function initReferralSchema(db: Pick<Pool, "query">): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS referral_accounts (
      user_id INTEGER PRIMARY KEY REFERENCES users(id), code TEXT NOT NULL UNIQUE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS referral_enrolments (
      id TEXT PRIMARY KEY, buyer_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      inviter_id INTEGER NOT NULL REFERENCES users(id), buyer_email_hash TEXT NOT NULL UNIQUE,
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
      payment_id TEXT NOT NULL UNIQUE, invoice_id TEXT UNIQUE, buyer_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      inviter_id INTEGER NOT NULL REFERENCES users(id), payer_hash TEXT NOT NULL UNIQUE,
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
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), reward_id TEXT NOT NULL REFERENCES referral_rewards(id),
      purpose TEXT NOT NULL CHECK(purpose IN ('activate','license')), public_key TEXT NOT NULL,
      key_hash TEXT NOT NULL, payload TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS referral_audit (
      id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, action TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS referral_webhook_receipts (
      event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE referral_quotes ADD COLUMN IF NOT EXISTS reconcile_after TIMESTAMPTZ;
    ALTER TABLE referral_quotes ADD COLUMN IF NOT EXISTS reconcile_attempts INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS referral_rewards_inviter_idx ON referral_rewards(inviter_id,paid_at DESC);
    CREATE INDEX IF NOT EXISTS referral_challenges_expiry_idx ON referral_challenges(expires_at);
  `);
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
        const code = createInvitationCode();
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
      // A second account on an alias of the inviter's own address is a self-invitation.
      if (
        !inviter ||
        inviter === userId ||
        canonicalEmail(inviters[0].email) === canonicalEmail(buyer.email) ||
        hasPriorPurchase ||
        buyer.is_pro
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
            new Date(paidAt.getTime() + HOLD_MS),
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
      const { rows: blocks } = await tx.query(
        "SELECT state FROM referral_payment_blocks WHERE payment_id=$1",
        [payment.paymentId],
      );
      // Serialise this inviter's awards so concurrent purchases cannot both pass the yearly cap.
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('referral-inviter:' || $1::text))", [
        quote.inviter_id,
      ]);
      const { rows: inviterRows } = await tx.query(
        `SELECT u.is_pro,u.plan,(SELECT count(*)::int FROM referral_rewards r
          WHERE r.inviter_id=u.id AND r.state<>'revoked' AND r.paid_at > $2) AS recognised
        FROM users u WHERE u.id=$1`,
        [quote.inviter_id, new Date(this.now().getTime() - CAP_WINDOW_MS)],
      );
      const inviter = inviterRows[0];
      // Lifetime owners still invite (the friend saves 10%) but receive nothing they could resell.
      const ineligible =
        inviter?.is_pro === true && inviter.plan === "lifetime"
          ? "inviter_lifetime"
          : (inviter?.recognised ?? 0) >= INVITER_CAP
            ? "inviter_cap"
            : null;
      const state = ineligible
        ? "revoked"
        : (blocks[0]?.state ??
          (payment.state === "paid"
            ? payer && payment.inviterFingerprints.length
              ? "pending"
              : "hold"
            : payment.state));
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
          new Date(payment.paidAt.getTime() + HOLD_MS),
          this.now(),
          ineligible ??
            payment.reason ??
            (state === "hold" && !payer
              ? "payer_identity_review"
              : state === "hold" && !payment.inviterFingerprints.length
                ? "inviter_identity_review"
                : null),
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
      payment.paidAt > this.now() ||
      payment.paidAt.getTime() < Math.floor(new Date(quote.created_at).getTime() / 1000) * 1000 ||
      payment.paidAt > new Date(quote.expires_at) ||
      !/^pi_[A-Za-z0-9]+$/.test(payment.paymentId)
    );
  }

  /** A durable tombstone also protects refunds that arrive before the sale event. */
  async blockPayment(paymentId: string, state: "hold" | "revoked", reason: string) {
    if (!/^pi_[A-Za-z0-9]+$/.test(paymentId)) throw new ReferralError("invalid_payment", 400);
    await this.transaction(async (tx) => {
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

  /** Called only with freshly re-read provider facts. A hold requires recorded review, not an old success event. */
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
   * returns to pending (or active, if already activated) only if the purchase would still
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
        payment.inviterFingerprints.length &&
        !payment.inviterFingerprints.includes(payment.payerFingerprint) &&
        !payment.hasPriorPurchase;
      const review =
        !quotes[0] || !this.quoteMatches(quotes[0], payment)
          ? "payment_mismatch_review"
          : !identity
            ? "payer_identity_review"
            : null;
      await tx.query("DELETE FROM referral_payment_blocks WHERE payment_id=$1 AND state='hold'", [
        payment.paymentId,
      ]);
      await tx.query(`UPDATE referral_rewards SET state=$2,reason=$3,checked_at=$4 WHERE id=$1`, [
        reward.id,
        review ? "hold" : reward.activated_at ? "active" : "pending",
        review,
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
      verificationDays: HOLD_DAYS,
      rewardsPerYear: INVITER_CAP,
      invitationDays: INVITATION_DAYS,
      rewards: rows.map((reward) => publicReward(reward)),
    };
  }

  /** Expired device challenges and old webhook receipts are not kept indefinitely. */
  async cleanup() {
    await this.db.query("DELETE FROM referral_challenges WHERE expires_at < $1", [
      new Date(this.now().getTime() - 86400000),
    ]);
    await this.db.query("DELETE FROM referral_webhook_receipts WHERE completed_at < $1", [
      new Date(this.now().getTime() - 90 * 86400000),
    ]);
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
      // dispute webhook (payment blocks), and maturity re-read the provider before 'ready'.
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
