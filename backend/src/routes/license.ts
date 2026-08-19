import express, { Request, Response } from "express";
import { isConfigured as dbConfigured } from "../db";
import { requireAuth } from "../auth";
import { signLicense, isConfigured as signingConfigured } from "../license";
import { isKnownProduct, productEntitlement } from "../products";
import { asyncRoute } from "../async-route";

const router = express.Router();

/**
 * Issues a freshly signed, short-lived entitlement for a desktop app.
 *
 * `?product=` names which ecosystem product is asking; it defaults to
 * "pctweaker" so every deployed PC Tweaker client keeps working unchanged.
 * Resolution goes through `productEntitlement`, which for pctweaker applies
 * the same lapsed-period logic as before (a missed cancellation webhook must
 * not keep granting access) and for newer products reads the entitlements
 * table with fail-closed semantics.
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

    const product = req.query.product ?? "pctweaker";
    if (!isKnownProduct(product)) {
      res.status(400).json({ error: "unknown product" });
      return;
    }

    const entitlement = await productEntitlement(req.userId as number, product);
    const license = signLicense({
      userId: String(req.userId),
      isPro: entitlement.active,
      plan: entitlement.plan,
      product,
      issuedAt: Math.floor(Date.now() / 1000),
    });

    res.json(license);
  }),
);

export default router;
