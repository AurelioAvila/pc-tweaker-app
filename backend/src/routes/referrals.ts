import express, { type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../auth";
import { referralStripe } from "../referral-stripe";
import { ReferralError } from "../referrals";
import { REFERRAL_MONTHS, REFERRAL_VERSION } from "../referral-policy";

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
    verificationDays: 30,
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
  route(async (req, res) => res.json({ code: await gateway().core.ownCode(req.userId as number) })),
);
referralRoutes.post(
  "/claim",
  route(async (req, res) => {
    const g = gateway();
    await g.account();
    const { rows } = await g.core.db.query("SELECT stripe_customer_id FROM users WHERE id=$1", [
      req.userId,
    ]);
    const prior = await g.priorPurchase(rows[0]?.stripe_customer_id ?? null);
    await g.core.claim(req.userId as number, req.body?.code, prior);
    return res.json({ claimed: true });
  }),
);
referralRoutes.post(
  "/rewards/:id/check",
  proofLimit,
  route(async (req, res) => {
    const g = gateway();
    await g.reconcileReward(req.userId as number, String(req.params.id));
    return res.json(await g.core.summary(req.userId as number));
  }),
);
referralRoutes.post(
  "/rewards/:id/gift",
  proofLimit,
  route(async (req, res) => {
    const g = gateway();
    const userId = req.userId as number;
    const id = String(req.params.id);
    await g.reconcileReward(userId, id);
    return res.json(await g.core.createGift(userId, id, req.body?.recipientEmail));
  }),
);
referralRoutes.post(
  "/rewards/:id/gift/cancel",
  proofLimit,
  route(async (req, res) => {
    await gateway().core.cancelGift(req.userId as number, String(req.params.id));
    return res.json({ cancelled: true });
  }),
);
referralRoutes.post(
  "/gifts/claim",
  proofLimit,
  route(async (req, res) => {
    const g = gateway();
    const userId = req.userId as number;
    const gift = await g.core.giftForRecipient(userId, req.body?.code);
    await g.reconcileQuote(gift.quote_id);
    return res.json(await g.core.claimGift(userId, req.body?.code));
  }),
);
referralRoutes.post(
  "/device/challenge",
  proofLimit,
  route(async (req, res) => {
    const g = gateway();
    const userId = req.userId as number;
    if (typeof req.body?.rewardId !== "string") throw new ReferralError("invalid_challenge", 400);
    await g.reconcileReward(userId, req.body.rewardId);
    return res.json(
      await g.core.challenge(userId, req.body.rewardId, req.body.purpose, req.body.publicKey),
    );
  }),
);
referralRoutes.post(
  "/device/proof",
  proofLimit,
  route(async (req, res) => {
    const g = gateway();
    const userId = req.userId as number;
    const { rows } = await g.core.db.query(
      `SELECT reward_id FROM referral_challenges WHERE id=$1 AND user_id=$2
    AND used_at IS NULL AND expires_at > now()`,
      [String(req.body?.challengeId ?? ""), userId],
    );
    if (!rows[0]) throw new ReferralError("invalid_proof", 403);
    await g.reconcileReward(userId, rows[0].reward_id);
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    return res.json(await g.core.prove(userId, req.body?.challengeId, req.body?.signature, token));
  }),
);
