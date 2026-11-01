import crypto from "crypto";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { asyncRoute } from "../async-route";
import { isValidEmail } from "../auth";
import { getPool, isConfigured } from "../db";
import { button, emailShell, escapeHtml, mutedLink, smallPrint, textFooter } from "../emails/layout";
import { sendMail, isConfigured as mailIsConfigured } from "../mailer";
import { consumeGlobalBudget } from "../public-form-guard";
import { htmlPage } from "./auth";

const router = express.Router();

/**
 * Hourly ceiling on newsletter signups, independent of any per-IP limit —
 * same reasoning as the support form: per-IP limits are spoofable behind
 * Railway's proxy, and the thing worth bounding is database growth plus the
 * welcome-email send rate, not any single visitor.
 */
const GLOBAL_NEWSLETTER_PER_HOUR = 120;

/** Where a signup came from ("site-footer" today; other products later). */
const SOURCES = new Set(["site-footer", "site-hero", "site-mobile", "app", "linux-check", "redaxa-linux"]);

/**
 * The welcome a new address gets, by source. Waitlist sources are also
 * recorded in newsletter_waitlists (an address already on the list keeps its
 * original source), and their welcome says what was joined and when we write.
 */
type Welcome = {
  subject: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  intro: string;
  button: { label: string; url: string };
  help: { title: string; text: string };
  why: string;
};
const LIST_WELCOME: Welcome = {
  subject: "You're on the PC Tweaker list",
  preheader: "Occasional news about releases and new tools. No daily emails, and you can leave in one click.",
  eyebrow: "Subscribed",
  headline: "You're on the list.",
  intro:
    "You'll get occasional emails about new PC Tweaker releases, new tweaks and new tools from the same developer. No spam and no daily drip.",
  button: { label: "Open PC Tweaker", url: "https://pctweaker.app" },
  help: { title: "Something you want to see?", text: "Tell us which tweak or tool you would like next." },
  why: "You received this email because this address joined the PC Tweaker list.",
};
const WAITLISTS: Record<string, Welcome> = {
  "linux-check": {
    subject: "You're on the “Ready for Linux?” waitlist",
    preheader: "We'll email you when the free check is ready in PC Tweaker. You can leave in one click.",
    eyebrow: "Waitlist",
    headline: "You're on the waitlist.",
    intro:
      "We'll email you when the free “Ready for Linux?” check is ready in PC Tweaker. Until then you'll only get occasional news about PC Tweaker and other tools from the same developer. No spam and no daily drip.",
    button: { label: "Read the Linux checklist", url: "https://pctweaker.app/will-my-games-work-on-linux/" },
    help: { title: "Which games matter most?", text: "Reply with the games you would check first." },
    why: "You received this email because this address joined the “Ready for Linux?” waitlist on pctweaker.app.",
  },
  "redaxa-linux": {
    subject: "You're on the Redaxa for Linux waitlist",
    preheader: "We'll email you when Redaxa for Linux is ready to download. You can leave in one click.",
    eyebrow: "Waitlist",
    headline: "You're on the waitlist.",
    intro:
      "We'll email you when Redaxa for Linux is ready to download. Redaxa and PC Tweaker are made by the same developer and share one mailing list, so you may also get occasional news about our other tools. No spam and no daily drip.",
    button: { label: "Open Redaxa", url: "https://redaxa.getcertsprint.com/" },
    help: { title: "Which distribution do you use?", text: "Reply and tell us, so the first builds cover it." },
    why: "You received this email because this address joined the Redaxa for Linux waitlist on redaxa.getcertsprint.com.",
  },
};

/**
 * Phone visitors can't run a Windows installer, so the mobile hero offers to
 * email them the download link instead. Same list and same isNew guard as the
 * welcome email: a repeat submit sends nothing, so the form can't be used to
 * nag an inbox.
 * ponytail: someone already subscribed gets no link; add a per-address
 * cooldown column if that case shows up.
 */
const DOWNLOAD_PAGE = "https://pctweaker.app/?utm_source=email&utm_medium=send-to-pc";

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

/**
 * Same HMAC with its own prefix, so an unsubscribe link (which every list
 * email carries) can never be replayed to put someone back on the list.
 */
function resubscribeSignature(email: string): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(`resubscribe:${email.toLowerCase()}`).digest("hex");
}

function resubscribeUrl(email: string): string | null {
  const sig = resubscribeSignature(email);
  if (!sig) return null;
  return `${process.env.PUBLIC_API_URL || "https://api.pctweaker.app"}/api/newsletter/resubscribe?email=${encodeURIComponent(email)}&sig=${sig}`;
}

/**
 * One confirmation mail per address per day: the form must not become a way
 * to fill a stranger's inbox. In memory, like the other abuse budgets.
 */
const RESUBSCRIBE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const resubscribeSentAt = new Map<string, number>();

function mayAskToResubscribe(email: string): boolean {
  const now = Date.now();
  for (const [address, at] of resubscribeSentAt) if (now - at >= RESUBSCRIBE_COOLDOWN_MS) resubscribeSentAt.delete(address);
  const key = email.toLowerCase();
  if (resubscribeSentAt.has(key)) return false;
  resubscribeSentAt.set(key, now);
  return true;
}

/** Signed one-click link; also used by account emails such as checkout reminders. */
export function unsubscribeUrl(email: string): string | null {
  const sig = unsubscribeSignature(email);
  if (!sig) return null;
  return `${process.env.PUBLIC_API_URL || "https://api.pctweaker.app"}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&sig=${sig}`;
}

/** RFC 8058 headers: Gmail and Yahoo show their own Unsubscribe button and
 *  POST to the link, which the route below accepts without a second click. */
export function listUnsubscribeHeaders(link: string): Record<string, string> {
  return { "List-Unsubscribe": `<${link}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
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

  // Existence check + insert instead of a single `RETURNING (xmax = 0)`:
  // pg-mem (the test database) doesn't implement xmax. The race between the
  // two queries could at worst double-send one welcome email — acceptable.
  //
  // The form never clears an opt-out: anyone can type any address into it.
  // An address that unsubscribed gets a confirmation link instead, and only
  // opening that link puts it back on the list. The answer is the same in
  // every case, so the form doesn't reveal who is or was subscribed.
  const existing = await getPool().query(
    `SELECT unsubscribed_at FROM newsletter_subscribers WHERE lower(email) = lower($1)`,
    [email],
  );
  const isNew = existing.rows.length === 0;
  await getPool().query(
    `INSERT INTO newsletter_subscribers (email, source)
     VALUES ($1, $2)
     ON CONFLICT (lower(email)) DO NOTHING`,
    [email, source],
  );
  if (source in WAITLISTS) {
    await getPool().query(
      `INSERT INTO newsletter_waitlists (email, waitlist)
       VALUES ($1, $2)
       ON CONFLICT (lower(email), waitlist) DO NOTHING`,
      [email, source],
    );
  }
  const optedOut = !isNew && Boolean(existing.rows[0].unsubscribed_at);
  const confirmLink = optedOut ? resubscribeUrl(email) : null;
  if (confirmLink && mailIsConfigured && mayAskToResubscribe(email)) {
    void sendMail({
      to: email,
      subject: "Confirm: rejoin the PC Tweaker list?",
      html: emailShell({
        preheader: "This address unsubscribed earlier. Nothing changes unless you confirm.",
        eyebrow: "Confirm",
        headline: "Rejoin the list?",
        intro:
          "Someone asked to add this address to the PC Tweaker list, which it left earlier. Nothing changes unless you confirm. If it wasn't you, ignore this email.",
        blocks: [button({ label: "Yes, send me PC Tweaker news", url: confirmLink })],
        help: { title: "Questions?", text: "Reply to ask us anything about PC Tweaker." },
        why: "You received this email because this address was entered in the newsletter form on pctweaker.app.",
      }),
      text: `Rejoin the PC Tweaker list?

Someone asked to add this address to the PC Tweaker list, which it left earlier. Nothing changes unless you confirm. If it wasn't you, ignore this email.

Confirm here:
${confirmLink}${textFooter()}`,
    }).catch((err: Error) => console.error("newsletter re-subscribe email failed:", err.message));
  }

  // Welcome email is best-effort and only for genuinely new addresses — a
  // repeat submit must not trigger a repeat email, or the form becomes a way
  // to nag any inbox with our sending domain's reputation behind it.
  const link = unsubscribeUrl(email);
  if (isNew && mailIsConfigured && link && source === "site-mobile") {
    void sendMail({
      to: email,
      subject: "Your PC Tweaker download link",
      headers: listUnsubscribeHeaders(link),
      html: emailShell({
        preheader: "Open this on your Windows 10 or 11 PC to download PC Tweaker.",
        eyebrow: "For your PC",
        headline: "Open this on your Windows PC.",
        intro:
          "Here's the link you asked for. Open it on the Windows 10 or 11 PC you want to tune and download PC Tweaker from there. You'll also get occasional emails about new releases. No spam and no daily drip.",
        blocks: [
          button({ label: "Download PC Tweaker", url: DOWNLOAD_PAGE }),
          smallPrint(`Didn't ask for this? ${mutedLink(link, "Unsubscribe with one click")}, no sign-in needed.`),
        ],
        help: { title: "Questions before you install?", text: "Ask us anything about what PC Tweaker changes." },
        why: "You received this email because you asked pctweaker.app to send the download link to this address.",
      }),
      text: `Open this on your Windows PC.

Here's the link you asked for. Open it on the Windows 10 or 11 PC you want to tune and download PC Tweaker from there:
${DOWNLOAD_PAGE}

You'll also get occasional emails about new releases. No spam and no daily drip.

Didn't ask for this? Unsubscribe with one click, no sign-in needed:
${link}${textFooter()}`,
    }).catch((err: Error) => console.error("send-to-pc email failed:", err.message));
  } else if (isNew && mailIsConfigured && link) {
    const w = WAITLISTS[source] ?? LIST_WELCOME;
    void sendMail({
      to: email,
      subject: w.subject,
      headers: listUnsubscribeHeaders(link),
      html: emailShell({
        preheader: w.preheader,
        eyebrow: w.eyebrow,
        headline: w.headline,
        intro: w.intro,
        blocks: [
          button(w.button),
          smallPrint(`Didn't sign up, or changed your mind? ${mutedLink(link, "Unsubscribe with one click")}, no sign-in needed.`),
        ],
        help: w.help,
        why: w.why,
      }),
      text: `${w.headline}

${w.intro}

${w.button.label}: ${w.button.url}

Didn't sign up, or changed your mind? Unsubscribe with one click, no sign-in needed:
${link}${textFooter()}`,
    }).catch((err: Error) => console.error("newsletter welcome email failed:", err.message));
  }

  res.status(200).json({ ok: true });
}));

/**
 * The address a link was minted for, or null. The HMAC check means only links
 * we minted work, so a third party can't unsubscribe someone by guessing
 * their address.
 */
function signedAddress(req: Request, signature = unsubscribeSignature): string | null {
  const email = typeof req.query.email === "string" ? req.query.email : "";
  const sig = typeof req.query.sig === "string" ? req.query.sig : "";
  const expected = signature(email);

  // Compare byte lengths, not string lengths: a non-ASCII signature of the
  // right character count encodes to more bytes, and timingSafeEqual throws
  // on a length mismatch, which turned a bad link into a 500.
  const given = Buffer.from(sig);
  const valid =
    Boolean(expected) &&
    given.length === Buffer.byteLength(expected!) &&
    crypto.timingSafeEqual(given, Buffer.from(expected!));
  return isValidEmail(email) && valid ? email : null;
}

const INVALID_LINK = htmlPage(
  "Link not valid",
  `<p class="error">This unsubscribe link is incomplete. Open it again from the email.</p>`,
);
const STILL_SENT = "Account emails such as password resets and receipts still arrive.";

/**
 * The link in the email only asks. Mail filters open every URL they scan,
 * and a GET that unsubscribed would quietly drop readers who never clicked.
 */
router.get("/unsubscribe", (req: Request, res: Response) => {
  const email = signedAddress(req);
  if (!email) {
    res.status(400).type("html").send(INVALID_LINK);
    return;
  }
  res.type("html").send(htmlPage(
    "Unsubscribe",
    `<p class="lead">Stop PC Tweaker news and reminder emails to ${escapeHtml(email)}? ${STILL_SENT}</p>
     <form method="post" action="${escapeHtml(req.originalUrl)}"><button type="submit">Unsubscribe</button></form>`,
  ));
});

/** The confirm button, and RFC 8058 one-click POSTs from mailbox providers. */
router.post("/unsubscribe", asyncRoute(async (req: Request, res: Response) => {
  const email = signedAddress(req);
  if (!email) {
    res.status(400).type("html").send(INVALID_LINK);
    return;
  }
  if (!isConfigured) {
    res.status(503).type("html").send(htmlPage("Try again shortly", `<p class="error">Temporarily unavailable. Please try again in a moment.</p>`));
    return;
  }

  await getPool().query(
    `INSERT INTO newsletter_subscribers (email, source, unsubscribed_at) VALUES ($1, 'unsubscribe', now())
     ON CONFLICT (lower(email)) DO UPDATE SET unsubscribed_at = now()`,
    [email],
  );
  res.type("html").send(htmlPage(
    "You're unsubscribed",
    `<p class="success">No more PC Tweaker news or reminder emails will be sent to this address. ${STILL_SENT}</p>`,
  ));
}));

const INVALID_RESUBSCRIBE_LINK = htmlPage(
  "Link not valid",
  `<p class="error">This confirmation link is incomplete. Open it again from the email.</p>`,
);

/** Like unsubscribe, the link only asks: mail scanners open every URL. */
router.get("/resubscribe", (req: Request, res: Response) => {
  const email = signedAddress(req, resubscribeSignature);
  if (!email) {
    res.status(400).type("html").send(INVALID_RESUBSCRIBE_LINK);
    return;
  }
  res.type("html").send(htmlPage(
    "Rejoin the list",
    `<p class="lead">Send occasional PC Tweaker news to ${escapeHtml(email)} again?</p>
     <form method="post" action="${escapeHtml(req.originalUrl)}"><button type="submit">Yes, rejoin</button></form>`,
  ));
});

router.post("/resubscribe", asyncRoute(async (req: Request, res: Response) => {
  const email = signedAddress(req, resubscribeSignature);
  if (!email) {
    res.status(400).type("html").send(INVALID_RESUBSCRIBE_LINK);
    return;
  }
  if (!isConfigured) {
    res.status(503).type("html").send(htmlPage("Try again shortly", `<p class="error">Temporarily unavailable. Please try again in a moment.</p>`));
    return;
  }
  await getPool().query(`UPDATE newsletter_subscribers SET unsubscribed_at = NULL WHERE lower(email) = lower($1)`, [email]);
  res.type("html").send(htmlPage(
    "You're back on the list",
    `<p class="success">PC Tweaker news will be sent to this address again. Every email has a one-click unsubscribe link.</p>`,
  ));
}));

export default router;
