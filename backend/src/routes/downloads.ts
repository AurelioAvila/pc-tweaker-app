import express, { Request, Response } from "express";
import { asyncRoute } from "../async-route";
import { getPool, isConfigured } from "../db";
import { consumeGlobalBudget } from "../public-form-guard";
import { utmMetadata } from "../stripe-policy";
import { isAdmin } from "./reviews";

const router = express.Router();

/** Real download clicks from social posts are a handful an hour; this only
 *  bounds table growth if someone scripts the beacon. */
const GLOBAL_DOWNLOADS_PER_HOUR = 600;

/**
 * Sent by the website (navigator.sendBeacon) when a visitor who landed from a
 * tagged social post clicks the installer download. The installer URL itself
 * is unchanged; this only counts the click against the post's labels. The
 * labels arrive in the query string, which keeps the beacon a CORS-simple
 * request, and are filtered by the same allowlist as Checkout metadata.
 */
router.post("/", asyncRoute(async (req: Request, res: Response) => {
  const utm = utmMetadata(req.query);
  if (utm.utm_source && isConfigured && consumeGlobalBudget("download", GLOBAL_DOWNLOADS_PER_HOUR)) {
    await getPool().query(
      `INSERT INTO download_attributions (utm_source, utm_medium, utm_campaign, utm_content) VALUES ($1, $2, $3, $4)`,
      [utm.utm_source, utm.utm_medium ?? null, utm.utm_campaign ?? null, utm.utm_content ?? null],
    );
  }
  res.status(204).end();
}));

/** Operator view for the local attribution report: counts per label set. */
router.get("/stats", asyncRoute(async (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!isConfigured) {
    res.status(503).json({ error: "Database is not configured" });
    return;
  }
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const { rows } = await getPool().query(
    `SELECT utm_source, utm_medium, utm_campaign, utm_content, COUNT(*)::int AS downloads
       FROM download_attributions
      WHERE created_at >= $1
      GROUP BY utm_source, utm_medium, utm_campaign, utm_content
      ORDER BY downloads DESC`,
    [new Date(Date.now() - days * 86_400_000)],
  );
  res.json({ days, rows });
}));

export default router;
