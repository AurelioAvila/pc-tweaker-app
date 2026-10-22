import express, { type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../auth";
import { referralStripe } from "../referral-stripe";
import { ReferralError } from "../referrals";
import {
  INVITER_CAP,
  REFERRAL_MONTHS,
  REFERRAL_VERSION,
  referralClientReady,
} from "../referral-policy";

export const referralRoutes = express.Router();
const publicLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const accountLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => "referral-user:" + req.userId,
});
const proofLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => "referral-proof:" + req.userId,
});

referralRoutes.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
referralRoutes.get("/config", publicLimit, (_req, res) => {
  const gateway = referralStripe();
  res.json({
    enabled: gateway?.core.enabled() ?? false,
    policyVersion: REFERRAL_VERSION,
    extraDiscountPercent: 10,
    discountScope: "first_payment",
    rewardMonths: REFERRAL_MONTHS,
    rewardDevices: 1,
    rewardOnPayment: true,
    rewardsPerYear: INVITER_CAP,
    lifetimeInviterReward: false,
    transferable: false,
    paidPlansOnly: true,
  });
});

function route(work: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void work(req, res).catch((error) => {
      if (error instanceof ReferralError) {
        res.status(error.status).json({ error: error.code, code: error.code });
        return;
      }
      if (error instanceof Error && error.message === "Invalid device key") {
        res.status(400).json({ error: "invalid_device_key", code: "invalid_device_key" });
        return;
      }
      next(error);
    });
  };
}
function gateway() {
  const value = referralStripe();
  if (!value) throw new ReferralError("referral_unavailable", 503);
  return value;
}
/** Builds that cannot verify bonus grants (see referralClientReady) get the programme as off. */
function clientReady(req: Request) {
  return referralClientReady(req.get("x-pct-referral-issuer"));
}
function requireReadyClient(req: Request) {
  if (!clientReady(req)) throw new ReferralError("update_required", 403);
}

referralRoutes.get(
  "/codes/:code",
  publicLimit,
  route(async (req, res) => {
    const valid = await gateway().core.codeExists(String(req.params.code));
    return res.status(valid ? 200 : 404).json({ valid });
  }),
);
referralRoutes.use(requireAuth, accountLimit);
referralRoutes.get(
  "/status",
  route(async (req, res) => {
    const g = gateway();
    const userId = req.userId as number;
    const summary = await g.core.summary(userId);
    const { rows } = await g.core.db.query(
      "SELECT code FROM referral_accounts WHERE user_id=$1 AND enabled=TRUE",
      [userId],
    );
    const incoming = await g.core.enrolment(userId);
    return res.json({
      ...summary,
      enabled: summary.enabled && clientReady(req),
      accountId: String(userId),
      code: rows[0]?.code ?? null,
      incoming: incoming
        ? {
            claimed: true,
            expiresAt: incoming.expires_at,
            expired: new Date(incoming.expires_at) <= g.core.now(),
            locked: incoming.checkout_locked,
          }
        : null,
    });
  }),
);
referralRoutes.post(
  "/code",
  route(async (req, res) => {
    requireReadyClient(req);
    return res.json({ code: await gateway().core.ownCode(req.userId as number) });
  }),
);
referralRoutes.post(
  "/claim",
  route(async (req, res) => {
    requireReadyClient(req);
    await gateway().claim(req.userId as number, req.body?.code);
    return res.json({ claimed: true });
  }),
);
// Device challenge and proof read only the stored reward state (kept current by refund and
// dispute webhooks); a licence refresh never calls the payment provider.
referralRoutes.post(
  "/device/challenge",
  proofLimit,
  route(async (req, res) => {
    requireReadyClient(req);
    const userId = req.userId as number;
    return res.json(
      await gateway().core.challenge(
        userId,
        req.body?.rewardId,
        req.body?.purpose,
        req.body?.publicKey,
      ),
    );
  }),
);
referralRoutes.post(
  "/device/proof",
  proofLimit,
  route(async (req, res) => {
    requireReadyClient(req);
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    return res.json(
      await gateway().core.prove(
        req.userId as number,
        req.body?.challengeId,
        req.body?.signature,
        token,
      ),
    );
  }),
);
