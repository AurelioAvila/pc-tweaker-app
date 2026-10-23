import express, { Request, Response } from "express";
import { isConfigured as dbConfigured } from "../db";
import { requireAuth } from "../auth";
import { deviceHashFrom, keyConfigured, signLicense, signingKeyVersionFrom } from "../license";
import { isKnownProduct, productEntitlement } from "../products";
import { asyncRoute } from "../async-route";
import { recordInstall } from "../install-count";

const router = express.Router();

/**
 * Issues a freshly signed, short-lived entitlement for a desktop app.
 *
 * `?product=` names which ecosystem product is asking; it defaults to
 * "pctweaker" so every deployed PC Tweaker client keeps working unchanged.
 * Resolution goes through `productEntitlement`, which for pctweaker applies
 * the same lapsed-period logic as before (a missed cancellation webhook must
 * not keep granting access) and for newer products reads the entitlements
 * table with fail-closed semantics. `?sig=2` asks for the rotated signing key.
 */
router.get(
  "/",
  requireAuth,
  asyncRoute(async (req: Request, res: Response) => {
    if (!dbConfigured) {
      res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
      return;
    }
    const keyVersion = signingKeyVersionFrom(req.query.sig);
    if (!keyConfigured(keyVersion)) {
      // Fails closed: an unconfigured signer must not silently hand out an
      // unsigned "trust me" response that the client would have no way to
      // verify anyway, nor fall back to a key the asking app does not trust.
      res.status(503).json({ error: "license signing is not configured on the server" });
      return;
    }

    const product = req.query.product ?? "pctweaker";
    if (!isKnownProduct(product)) {
      res.status(400).json({ error: "unknown product" });
      return;
    }

    const entitlement = await productEntitlement(req.userId as number, product, product === "uninstaller");
    const license = signLicense({
      userId: String(req.userId),
      isPro: entitlement.active,
      plan: entitlement.plan,
      product,
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: entitlement.expiresAt ? Math.floor(new Date(entitlement.expiresAt).getTime() / 1000) : null,
      trialEndsAt: entitlement.active && entitlement.status === "trialing" && entitlement.trialEndsAt
        ? Math.floor(new Date(entitlement.trialEndsAt).getTime() / 1000) : null,
      ...deviceHashFrom(req.get("x-device-hash")),
    }, keyVersion);

    // Counted, never enforced: the licence above is issued either way.
    await recordInstall(req.userId as number, product, req.get("x-install-id"));
    res.json(license);
  }),
);

export default router;
