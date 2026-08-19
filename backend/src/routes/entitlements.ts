import { timingSafeEqual } from "crypto";
import express, { Request, Response } from "express";
import { asyncRoute } from "../async-route";
import { requireAuth, isValidEmail } from "../auth";
import { getPool, isConfigured } from "../db";
import { allEntitlements } from "../products";
import { consumeGlobalBudget } from "../public-form-guard";

const router = express.Router();

/**
 * GET /api/entitlements — the signed-in user's per-product entitlement map,
 * for the desktop apps' account panels and for loyalty-price display. This is
 * informational: actual enforcement stays in the signed license
 * (routes/license.ts) and in server-side checkout price selection
 * (routes/stripe.ts) — nothing here grants anything.
 */
router.get(
  "/",
  requireAuth,
  asyncRoute(async (req: Request, res: Response) => {
    if (!isConfigured) {
      res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
      return;
    }
    const entitlements = await allEntitlements(req.userId as number);
    res.json({ products: entitlements });
  }),
);

/**
 * Hourly ceiling on ecosystem lookups. The endpoint is secret-gated, so this
 * exists to bound the damage of a leaked key (mass email-probing) until the
 * key is rotated, not to throttle the legitimate caller.
 */
const GLOBAL_ECOSYSTEM_CHECKS_PER_HOUR = 600;

/**
 * Constant-time comparison, mirroring the reviews route's admin check: a
 * plain !== leaks matching-prefix length through response timing.
 */
function isEcosystemCaller(req: Request): boolean {
  const expected = process.env.ECOSYSTEM_API_KEY;
  const header = req.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET /api/entitlements/check?email= — server-to-server only.
 *
 * PromptShield's backend (Vercel/Supabase — a separate trust domain) calls
 * this to decide whether a sign-up qualifies for the ecosystem loyalty price.
 * Response is the minimum that decision needs: a boolean and the product
 * names — never account details, never payment data.
 *
 * Answers 404 (not 401) when the key is absent or wrong, so the route's
 * existence isn't advertised to probes — same convention as the reviews
 * admin routes. When ECOSYSTEM_API_KEY is unset the route stays closed.
 */
router.get(
  "/check",
  asyncRoute(async (req: Request, res: Response) => {
    if (!isEcosystemCaller(req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!isConfigured) {
      res.status(503).json({ error: "database not configured" });
      return;
    }
    if (!consumeGlobalBudget("ecosystem-check", GLOBAL_ECOSYSTEM_CHECKS_PER_HOUR)) {
      console.error("ecosystem check budget exhausted — possible leaked ECOSYSTEM_API_KEY");
      res.status(429).json({ error: "Too many lookups." });
      return;
    }
    const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
    if (!isValidEmail(email)) {
      res.status(400).json({ error: "invalid email" });
      return;
    }
    const { rows } = await getPool().query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (rows.length === 0) {
      res.json({ anyActive: false, products: [] });
      return;
    }
    const entitlements = await allEntitlements(rows[0].id);
    const active = entitlements.filter((entitlement) => entitlement.active);
    res.json({ anyActive: active.length > 0, products: active.map((entitlement) => entitlement.product) });
  }),
);

export default router;
