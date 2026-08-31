import express from "express";
import { getPool, isConfigured } from "../db";
import { requireAuth } from "../auth";
import { isEntitled } from "../entitlement";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  if (!isConfigured) {
    return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
  }
  try {
    const result = await getPool().query(
      "SELECT email, is_pro, plan, pro_expires_at, email_verified, stripe_customer_id FROM users WHERE id = $1",
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
    });
  } catch (err) {
    console.error("account lookup failed:", err);
    res.status(500).json({ error: "account lookup failed" });
  }
});

export default router;
