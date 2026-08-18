import { timingSafeEqual } from "crypto";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { getPool, isConfigured } from "../db";
import { isValidEmail } from "../auth";
import { sendMail } from "../mailer";
import { SUPPORT_INBOX } from "../support-inbox";
import { consumeGlobalBudget, singleLine } from "../public-form-guard";
import { asyncRoute } from "../async-route";

const router = express.Router();


/**
 * Feedback collected directly from testers before the site had a review
 * form (53 responses averaging 4.8). Those ratings are real but live outside
 * this database, so they're folded into the published aggregate as a
 * weighted baseline rather than being faked as individual rows. Overridable
 * via env so the numbers stay auditable instead of being buried in code.
 *
 * A malformed override would otherwise propagate NaN into the public average,
 * so each value falls back to the default unless it parses to a sane number.
 */
function baselineNumber(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
}
const BASELINE_COUNT = baselineNumber(process.env.REVIEWS_BASELINE_COUNT, 53, 1_000_000);
const BASELINE_AVG = baselineNumber(process.env.REVIEWS_BASELINE_AVG, 4.8, 5);

/**
 * Only the star rating is public; written feedback is relayed to the team by
 * email and never rendered on the site.
 *
 * That split is what makes it safe to count a submission immediately. The
 * form is anonymous and its per-IP limiter is bypassable (see
 * public-form-guard.ts), so publishing visitor *text* would have been
 * defacement waiting to happen — but a rating is a number between 1 and 5,
 * which cannot carry a payload. `published` therefore no longer gates
 * display (nothing is displayed); it gates whether a rating counts toward
 * the public average, so a bad-faith score can be excluded after the fact.
 */
const MAX_NAME = 60;
const MAX_BODY = 2000;

/** Ceiling no amount of header rotation can raise. */
const GLOBAL_REVIEWS_PER_HOUR = 40;

/**
 * First line of defence, keyed on req.ip. Trivially bypassed by an attacker
 * rotating X-Forwarded-For, which is why the global budget above exists — but
 * it does stop naive scripted floods without touching that shared ceiling.
 */
const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Escapes text before it goes into the notification email's HTML body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ReviewRow = {
  id: number;
  rating: number;
  created_at: Date;
};

/**
 * The public rating: an average and a count, nothing else.
 *
 * No visitor-submitted text is returned by this endpoint at all — not the
 * body, not the reviewer's name, not their email. There is no field here for
 * user content to leak through, by accident or by a future edit.
 */
router.get("/", asyncRoute(async (_req: Request, res: Response) => {
  if (!isConfigured) {
    // With no database there are no stored ratings, but the baseline is still
    // a true statement about collected feedback — serve it rather than 503.
    res.json({ average: Number(BASELINE_AVG.toFixed(1)), count: BASELINE_COUNT });
    return;
  }

  // `confirmed_at IS NOT NULL` marks a row as counted. Ratings count on
  // submission now, so this is set immediately — it survives only to keep out
  // the rows written while a separate email-confirmation step existed, which
  // were never confirmed and so were never part of the published score.
  const { rows: agg } = await getPool().query<{ n: string; total: string | null }>(
    `SELECT COUNT(*)::text AS n, SUM(rating)::text AS total
       FROM reviews
      WHERE published = TRUE AND confirmed_at IS NOT NULL`,
  );
  const storedCount = Number(agg[0]?.n ?? 0);
  const storedTotal = Number(agg[0]?.total ?? 0);

  const count = BASELINE_COUNT + storedCount;
  const average = count === 0 ? 0 : (BASELINE_AVG * BASELINE_COUNT + storedTotal) / count;

  res.json({ average: Number(average.toFixed(1)), count });
}));

router.post("/", writeLimiter, asyncRoute(async (req: Request, res: Response) => {
  if (!isConfigured) {
    res.status(503).json({ error: "Reviews are temporarily unavailable. Please try again later." });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, MAX_NAME) : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const rating = Number(req.body?.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Please choose a rating between 1 and 5 stars." });
    return;
  }
  // The address is optional but, when given, it *is* the vote's identity:
  // one row per address, so the same person clicking submit again replaces
  // their score instead of stacking another one. Accepted only if it's
  // actually an address, since it becomes the notification's Reply-To.
  const contact = isValidEmail(email) ? email : "";
  if (body.length > MAX_BODY) {
    res.status(400).json({ error: `Please keep your feedback under ${MAX_BODY} characters.` });
    return;
  }

  if (!consumeGlobalBudget("reviews", GLOBAL_REVIEWS_PER_HOUR)) {
    res.status(429).json({ error: "We're getting a lot of ratings right now. Please try again later." });
    return;
  }

  // `confirmed_at` is set here rather than by a separate confirmation step:
  // it now just marks a row as counted, and is kept because rows submitted
  // before ratings counted immediately must stay out of the average.
  //
  // Rows without an address can't participate in the one-row-per-address
  // upsert (NULLs don't conflict), so they're inserted plainly.
  const { rows } = contact
    ? await getPool().query<ReviewRow>(
        `INSERT INTO reviews (name, email, rating, body, published, confirmed_at)
         VALUES ($1, $2, $3, $4, TRUE, now())
         ON CONFLICT (lower(email)) DO UPDATE
            SET name = EXCLUDED.name,
                body = EXCLUDED.body,
                rating = EXCLUDED.rating,
                confirmed_at = now()
         RETURNING id, rating, created_at`,
        [singleLine(name), contact, rating, body],
      )
    : await getPool().query<ReviewRow>(
        `INSERT INTO reviews (name, email, rating, body, published, confirmed_at)
         VALUES ($1, NULL, $2, $3, TRUE, now())
         RETURNING id, rating, created_at`,
        [singleLine(name), rating, body],
      );
  const saved = rows[0];

  // Written feedback reaches a human only through this message, so a failure
  // here means it was accepted and then lost — hence the shouty log line.
  const who = name || "Someone";
  void sendMail({
    to: SUPPORT_INBOX,
    subject: singleLine(`New ${rating}★ PC Tweaker rating from ${who}`),
    html: `<p><strong>${escapeHtml(who)}</strong> rated PC Tweaker ${rating}/5.</p>
           ${body ? `<p>They wrote:</p><blockquote style="white-space:pre-wrap">${escapeHtml(body)}</blockquote>` : "<p>They left no written feedback.</p>"}
           <p>Rating id: ${saved.id}${contact ? ` · ${escapeHtml(contact)}` : " · no address given"}</p>
           <p>The score is already counted in the public average. To exclude it, PATCH /api/reviews/${saved.id} with {"published": false}.</p>`,
    ...(contact ? { replyTo: contact } : {}),
  }).catch((err: Error) => console.error("RATING FEEDBACK LOST — notification failed:", err.message));

  res.status(201).json({ rating: saved.rating });
}));

/**
 * Constant-time comparison of the admin token.
 *
 * A plain `!==` leaks how many leading bytes matched through response timing,
 * which is enough to recover a secret byte by byte given enough samples.
 * Lengths are compared first because timingSafeEqual throws on a mismatch,
 * and length alone is not the secret.
 */
function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const provided = req.get("x-admin-token");
  if (!expected || !provided) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Operator view of the ratings currently excluded from the public average.
 * Every rating counts on arrival now, so this lists what has been taken back
 * out — the audit trail for moderation decisions, not a queue to work.
 */
router.get("/pending", asyncRoute(async (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!isConfigured) {
    res.status(503).json({ error: "Database is not configured" });
    return;
  }
  const { rows } = await getPool().query(
    `SELECT id, name, email, rating, body, published, created_at
       FROM reviews
      WHERE published = FALSE
      ORDER BY created_at DESC
      LIMIT 200`,
  );
  res.json({ reviews: rows });
}));

/**
 * Publishes or hides a review. Guarded by ADMIN_TOKEN rather than the normal
 * user auth because it is an operator action, not an account action; when the
 * env var is unset the route stays closed instead of defaulting to open, and
 * it answers 404 rather than 401 so its existence isn't advertised.
 */
router.patch("/:id", asyncRoute(async (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!isConfigured) {
    res.status(503).json({ error: "Database is not configured" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (typeof req.body?.published !== "boolean") {
    res.status(400).json({ error: "Body must be { published: boolean }" });
    return;
  }
  const { rowCount } = await getPool().query(`UPDATE reviews SET published = $1 WHERE id = $2`, [
    req.body.published,
    id,
  ]);
  if (rowCount === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true, id, published: req.body.published });
}));

export default router;
