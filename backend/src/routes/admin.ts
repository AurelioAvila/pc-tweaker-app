import express, { Request, Response } from "express";
import { asyncRoute } from "../async-route";
import { eraseAccount } from "../account-erasure";
import { getPool, isConfigured } from "../db";
import { ReferralError } from "../referrals";
import { isAdmin } from "./reviews";

const router = express.Router();

/**
 * A verified erasure request (PRIVACY.md, "Your choices and rights"). Operator only, with the
 * x-admin-token of rating moderation; 404 otherwise, so the route is not advertised.
 * `{"email": "..."}` alone is a dry run: it reports what would be deleted and changes nothing.
 * `{"email": "...", "erase": true}` deletes. 409 `active_subscription`: cancel it in Stripe
 * first; 409 `open_referral_checkout`: a referral checkout is not settled yet, retry later (the
 * worker settles it within about an hour of its expiry).
 */
router.post(
  "/erase-account",
  asyncRoute(async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!isConfigured) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }
    const email = req.body?.email;
    if (typeof email !== "string" || !email.includes("@") || email.length > 320) {
      res.status(400).json({ error: "Body must be { email, erase? }" });
      return;
    }
    try {
      const result = await eraseAccount(getPool(), email, { erase: req.body.erase === true });
      if (result.erased) console.log(`account erasure done (account ${result.userId ?? "none"})`);
      res.json(result);
    } catch (error) {
      if (!(error instanceof ReferralError)) throw error;
      res.status(409).json({ error: error.code });
    }
  }),
);

export default router;
