import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../auth";
import { getPool, isConfigured } from "../db";
import { GATE_DAYS, secretMatches, telegram, type Telegram } from "../telegram";

/** Telegram gate and bot referral (src/telegram.ts). Everything answers 404 while it is off. */
export function telegramRoutes(service: () => Telegram | null = () => (isConfigured ? telegram(getPool) : null)) {
  const router = express.Router();
  const appLimit = rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => "telegram-user:" + req.userId });
  const hookLimit = rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false });
  const on = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    if (!service()) return void res.status(404).json({ error: "telegram_unavailable" });
    next();
  };

  router.get("/config", on, (_req, res) => {
    const t = service()!;
    res.json({ enabled: true, channel: t.config.channel, bot: t.config.bot, gateDays: GATE_DAYS });
  });

  // Telegram retries anything that is not 2xx: errors are logged and still answered 200.
  router.post("/webhook", hookLimit, on, async (req, res) => {
    const t = service()!;
    if (!secretMatches(t.config, req.get("x-telegram-bot-api-secret-token"))) return void res.status(401).end();
    try {
      await t.handleUpdate(req.body);
    } catch (error) {
      console.error("telegram update failed:", (error as Error).message);
    }
    res.status(200).json({ ok: true });
  });

  router.post("/intents", on, requireAuth, appLimit, async (req, res, next) => {
    try {
      res.json(await service()!.createIntent(req.userId as number));
    } catch (error) {
      next(error);
    }
  });

  router.get("/intents/:id", on, requireAuth, appLimit, async (req, res, next) => {
    try {
      const status = await service()!.intentStatus(req.userId as number, String(req.params.id));
      if (!status) return void res.status(404).json({ error: "not_found" });
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
