import crypto from "crypto";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { asyncRoute } from "../async-route";
import { isValidEmail } from "../auth";
import { getPool, isConfigured } from "../db";
import { sendMail, isConfigured as mailIsConfigured } from "../mailer";
import { consumeGlobalBudget } from "../public-form-guard";

const router = express.Router();

/**
 * Hourly ceiling on newsletter signups, independent of any per-IP limit —
 * same reasoning as the support form: per-IP limits are spoofable behind
 * Railway's proxy, and the thing worth bounding is database growth plus the
 * welcome-email send rate, not any single visitor.
 */
const GLOBAL_NEWSLETTER_PER_HOUR = 120;

/** Where a signup came from ("site-footer" today; other products later). */
const SOURCES = new Set(["site-footer", "site-hero", "app"]);

/**
 * Keyed on req.ip — spoofable (see routes/auth.ts), but the failure mode here
 * is list spam, which the global budget and the unique email index already
 * bound. Loose enough that a person mistyping their address twice is fine.
 */
const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signups from this connection. Please try again in an hour." },
});

/**
 * HMAC over the lowercased address, keyed on JWT_SECRET. Lets the unsubscribe
 * link prove it was minted by us without storing a token per subscriber —
 * anyone without the secret can't forge a link to unsubscribe someone else.
 */
function unsubscribeSignature(email: string): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
}

router.post("/", newsletterLimiter, asyncRoute(async (req: Request, res: Response) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const rawSource = typeof req.body?.source === "string" ? req.body.source : "";
  const source = SOURCES.has(rawSource) ? rawSource : "site-footer";
  // Honeypot, same convention as the support form: hidden field, bots fill it,
  // and a 200 keeps them from learning they were filtered.
  const honeypot = typeof req.body?.company === "string" ? req.body.company.trim() : "";

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (honeypot) {
    res.status(200).json({ ok: true });
    return;
  }
  if (!consumeGlobalBudget("newsletter", GLOBAL_NEWSLETTER_PER_HOUR)) {
    console.error("global newsletter budget exhausted — possible abuse");
    res.status(429).json({ error: "We're receiving an unusual number of signups. Please try again later." });
    return;
  }
  if (!isConfigured) {
    res.status(503).json({ error: "Signups are temporarily unavailable. Please try again shortly." });
    return;
  }

  // Existence check + upsert instead of a single `RETURNING (xmax = 0)`:
  // pg-mem (the test database) doesn't implement xmax. The race between the
  // two queries could at worst double-send one welcome email — acceptable.
  //
  // Re-subscribing clears unsubscribed_at: the visitor asked to be back on
  // the list, and keeping the original row preserves the signup date.
  const existing = await getPool().query(
    `SELECT 1 FROM newsletter_subscribers WHERE lower(email) = lower($1)`,
    [email],
  );
  const isNew = existing.rows.length === 0;
  await getPool().query(
    `INSERT INTO newsletter_subscribers (email, source)
     VALUES ($1, $2)
     ON CONFLICT (lower(email)) DO UPDATE SET unsubscribed_at = NULL`,
    [email, source],
  );

  // Welcome email is best-effort and only for genuinely new addresses — a
  // repeat submit must not trigger a repeat email, or the form becomes a way
  // to nag any inbox with our sending domain's reputation behind it.
  const sig = unsubscribeSignature(email);
  if (isNew && mailIsConfigured && sig) {
    const unsubscribeUrl = `${process.env.PUBLIC_API_URL || "https://pc-tweaker-app-production.up.railway.app"}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&sig=${sig}`;
    void sendMail({
      to: email,
      subject: "You're on the PC Tweaker list",
      html: `<p>Thanks for subscribing!</p>
             <p>You'll get occasional emails about new PC Tweaker releases, new tweaks, and new tools from the same developer. No spam, no daily drip.</p>
             <p style="font-size:12px;color:#888">Didn't sign up, or changed your mind? <a href="${unsubscribeUrl}">Unsubscribe with one click</a> — no login needed.</p>`,
    }).catch((err: Error) => console.error("newsletter welcome email failed:", err.message));
  }

  res.status(200).json({ ok: true });
}));

/**
 * One-click unsubscribe from the welcome email. GET because it's a link in an
 * email; the HMAC check means only links we minted work, so a third party
 * can't unsubscribe someone by guessing their address.
 */
router.get("/unsubscribe", asyncRoute(async (req: Request, res: Response) => {
  const email = typeof req.query.email === "string" ? req.query.email : "";
  const sig = typeof req.query.sig === "string" ? req.query.sig : "";
  const expected = unsubscribeSignature(email);

  const valid =
    Boolean(expected) &&
    sig.length === expected!.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected!));

  if (!isValidEmail(email) || !valid) {
    res.status(400).type("html").send("<p>This unsubscribe link is invalid or expired.</p>");
    return;
  }
  if (!isConfigured) {
    res.status(503).type("html").send("<p>Temporarily unavailable — please try again shortly.</p>");
    return;
  }

  await getPool().query(
    `UPDATE newsletter_subscribers SET unsubscribed_at = now() WHERE lower(email) = lower($1)`,
    [email],
  );
  res
    .type("html")
    .send(`<body style="font-family:sans-serif;max-width:520px;margin:80px auto;text-align:center">
             <h2>You're unsubscribed</h2>
             <p>No more newsletter emails will be sent to this address.</p>
           </body>`);
}));

export default router;
