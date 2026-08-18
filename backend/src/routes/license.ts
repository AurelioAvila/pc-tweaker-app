import express, { Request, Response } from "express";
import { getPool, isConfigured as dbConfigured } from "../db";
import { requireAuth } from "../auth";
import { isEntitled } from "../entitlement";
import { signLicense, isConfigured as signingConfigured } from "../license";
import { asyncRoute } from "../async-route";

const router = express.Router();

/**
 * Issues a freshly signed, short-lived Pro entitlement for the desktop app.
 *
 * Reuses `isEntitled` rather than trusting the raw `is_pro` column directly —
 * same reasoning as `routes/account.ts`: a lapsed billing period has to
 * revoke access even if the cancellation webhook never arrived.
 */
router.get(
  "/",
  requireAuth,
  asyncRoute(async (req: Request, res: Response) => {
    if (!dbConfigured) {
      res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
      return;
    }
    if (!signingConfigured) {
      // Fails closed: an unconfigured signer must not silently hand out an
      // unsigned "trust me" response that the client would have no way to
      // verify anyway.
      res.status(503).json({ error: "license signing is not configured on the server" });
      return;
    }

    const { rows } = await getPool().query(
      "SELECT is_pro, plan, pro_expires_at FROM users WHERE id = $1",
      [req.userId],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "account not found" });
      return;
    }

    const row = rows[0];
    const license = signLicense({
      userId: String(req.userId),
      isPro: isEntitled(row),
      plan: row.plan ?? null,
      issuedAt: Math.floor(Date.now() / 1000),
    });

    res.json(license);
  }),
);

export default router;
