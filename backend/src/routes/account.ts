import express from "express";
import rateLimit from "express-rate-limit";
import { getPool, isConfigured } from "../db";
import { requireAuth } from "../auth";
import { isEntitled, PERPETUAL_PLANS } from "../entitlement";
import { redeemLicenceCode, RedeemFailure } from "../licence-codes";
import { asyncRoute } from "../async-route";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  if (!isConfigured) {
    return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
  }
  try {
    const result = await getPool().query(
      "SELECT email, is_pro, plan, pro_expires_at, legacy_pro_grant, email_verified, stripe_customer_id FROM users WHERE id = $1",
      [req.userId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "account not found" });
    }
    const row = result.rows[0];
    // Deliberately not `row.is_pro`: the stored flag is only half the answer,
    // and a lapsed billing period has to revoke access even if no webhook
    // ever told us to clear the flag. See entitlement.ts.
    // `plan` and `hasBilling` are what the pricing screen needs to decide
    // which call to action to offer. Without them it showed every Pro account
    // a Manage subscription button, including accounts granted Pro by hand,
    // which have no Stripe customer and so could only ever be answered with
    // an error. The customer id itself stays on the server; the client only
    // needs to know whether one exists.
    res.json({
      email: row.email,
      isPro: isEntitled(row),
      emailVerified: row.email_verified,
      plan: row.plan ?? null,
      hasBilling: Boolean(row.stripe_customer_id),
      // When access ends on its own, so the app can say "Pro until ...".
      // Null for Lifetime and for any account that is not Pro.
      proExpiresAt:
        isEntitled(row) && row.pro_expires_at && !(row.plan && PERPETUAL_PLANS.has(row.plan))
          ? new Date(row.pro_expires_at).toISOString()
          : null,
    });
  } catch (err) {
    console.error("account lookup failed:", err);
    res.status(500).json({ error: "account lookup failed" });
  }
});

/** The app shows its own translated text per `code`; `error` is the English
 *  fallback for any other client. */
const REDEEM_ERRORS: Record<RedeemFailure, { status: number; error: string }> = {
  invalid: { status: 404, error: "This licence code is not valid." },
  not_started: { status: 409, error: "This licence code is not active yet." },
  ended: { status: 410, error: "This licence code has expired." },
  already_redeemed: { status: 409, error: "This licence code is already active on your account." },
  duplicate: { status: 409, error: "This licence code has already been activated for this person or connection." },
  verify_email: { status: 403, error: "Verify your email address before activating a licence code." },
  already_pro: { status: 409, error: "Your account already has Pro." },
};

// Codes are short and shared publicly, so guessing is limited per address on
// top of the app-wide limit.
const redeemLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later.", code: "rate_limited" },
});

router.post(
  "/redeem",
  redeemLimit,
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!isConfigured) {
      res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
      return;
    }
    const result = await redeemLicenceCode(req.userId as number, req.body?.code, new Date(), req.ip);
    if (!result.ok) {
      const failure = REDEEM_ERRORS[result.reason];
      res.status(failure.status).json({ error: failure.error, code: result.reason });
      return;
    }
    res.json({ plan: "promo", proExpiresAt: result.expiresAt.toISOString() });
  }),
);

export default router;
