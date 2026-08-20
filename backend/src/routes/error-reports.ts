import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { asyncRoute } from "../async-route";
import { getPool, isConfigured } from "../db";
import { consumeGlobalBudget } from "../public-form-guard";

const router = express.Router();

/**
 * Anonymous, opt-in error reports from the desktop apps. Deliberately the
 * thinnest possible pipe: no auth, no email, no identifiers — just enough to
 * know that something broke, in which app and version, and what the error
 * message said. The apps only send when the user has switched the setting on
 * (default off), and the payload is validated to shapes a human wrote, not a
 * dumping ground.
 */

/** Products allowed to report. Anything else is dropped without a hint. */
const APPS = new Set(["pctweaker", "uninstaller"]);

const MAX_MESSAGE_LEN = 500;
const MAX_CONTEXT_LEN = 100;
const MAX_VERSION_LEN = 20;

/**
 * Hourly global ceiling — same reasoning as the other anonymous endpoints:
 * per-IP limits are spoofable behind Railway's proxy, and what actually needs
 * bounding is database growth. 300/h is ~50x any plausible organic rate today
 * while still capping a flood at a size a human can delete.
 */
const GLOBAL_ERROR_REPORTS_PER_HOUR = 300;

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // A failed error report must never bother the user; the app fire-and-forgets.
  message: { error: "Too many reports from this connection." },
});

/** Version strings look like "0.5.0" (numbers and dots only). */
export function isPlausibleVersion(v: string): boolean {
  return v.length > 0 && v.length <= MAX_VERSION_LEN && /^[0-9]+(\.[0-9]+)*$/.test(v);
}

/**
 * Truncation rather than rejection for the free-text fields: a long error
 * message is still a real error message, and the cap is what protects the
 * database. Control characters are stripped so log/DB tooling stays sane.
 */
export function clean(s: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

router.post("/", reportLimiter, asyncRoute(async (req: Request, res: Response) => {
  const app = typeof req.body?.app === "string" ? req.body.app : "";
  const appVersion = typeof req.body?.appVersion === "string" ? req.body.appVersion.trim() : "";
  const rawMessage = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const rawContext = typeof req.body?.context === "string" ? req.body.context.trim() : "";

  if (!APPS.has(app) || !isPlausibleVersion(appVersion) || rawMessage.length === 0) {
    res.status(400).json({ error: "Invalid report." });
    return;
  }
  if (!consumeGlobalBudget("error-reports", GLOBAL_ERROR_REPORTS_PER_HOUR)) {
    // Deliberately a 200: the sender fire-and-forgets, and telling an abuser
    // the budget is exhausted only helps them time the flood.
    res.status(200).json({ ok: true });
    return;
  }
  if (!isConfigured) {
    res.status(503).json({ error: "Temporarily unavailable." });
    return;
  }

  await getPool().query(
    `INSERT INTO error_reports (app, app_version, context, message)
     VALUES ($1, $2, $3, $4)`,
    [app, appVersion, clean(rawContext, MAX_CONTEXT_LEN) || null, clean(rawMessage, MAX_MESSAGE_LEN)],
  );

  res.status(200).json({ ok: true });
}));

export default router;
