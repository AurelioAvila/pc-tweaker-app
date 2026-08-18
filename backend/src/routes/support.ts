import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { isValidEmail } from "../auth";
import { sendMail, isConfigured as mailIsConfigured, MailError } from "../mailer";
import { SUPPORT_INBOX } from "../support-inbox";
import { consumeGlobalBudget, singleLine } from "../public-form-guard";

const router = express.Router();

/**
 * Hourly ceiling on relayed support mail, independent of any per-IP limit.
 *
 * Without it, an attacker rotating X-Forwarded-For can send unbounded mail
 * through this endpoint: that burns the transactional email quota and, worse,
 * gets the sending domain reported as a spam source — which would silently
 * break password resets and email verification for real users.
 */
const GLOBAL_SUPPORT_PER_HOUR = 60;

const MAX_NAME = 80;
const MAX_SUBJECT = 140;
const MAX_MESSAGE = 5000;
const MAX_SYSTEM_INFO = 500;

/** Categories the form offers. Anything else is rejected rather than relayed. */
const CATEGORIES = new Set([
  "installation",
  "activation",
  "tweak-issue",
  "rollback",
  "billing",
  "bug",
  "other",
]);

const CATEGORY_LABELS: Record<string, string> = {
  installation: "Installation / update",
  activation: "Pro activation",
  "tweak-issue": "A tweak isn't working",
  rollback: "Rollback / restore",
  billing: "Billing / refund",
  bug: "Bug report",
  other: "Other",
};

/**
 * Keyed on req.ip. That value is spoofable behind Railway's proxy (see the
 * note in routes/auth.ts), but this endpoint has no account to key on and
 * the downside of a bypass is inbox spam rather than account compromise.
 * The limit is deliberately loose enough that a person retrying a failed
 * send a few times is never blocked.
 */
const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent from this connection. Please try again in an hour." },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Relays a support request to the operator's inbox.
 *
 * The destination address is never included in the response, on success or
 * on failure — the visitor is told their message was sent, not where. The
 * sender's own address goes in Reply-To (not From), so replying works while
 * the message still passes SPF/DKIM for our sending domain.
 */
router.post("/", supportLimiter, async (req: Request, res: Response) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const category = typeof req.body?.category === "string" ? req.body.category : "other";
  const systemInfo = typeof req.body?.systemInfo === "string" ? req.body.systemInfo.trim() : "";
  // Honeypot: a field hidden from real users. Bots fill every input they
  // find, so a non-empty value means automation. Answer 200 anyway so the
  // bot has no signal that it was filtered.
  const honeypot = typeof req.body?.company === "string" ? req.body.company.trim() : "";

  if (!name || name.length > MAX_NAME) {
    res.status(400).json({ error: `Please enter your name (up to ${MAX_NAME} characters).` });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address so we can reply." });
    return;
  }
  if (!subject || subject.length > MAX_SUBJECT) {
    res.status(400).json({ error: `Please enter a subject (up to ${MAX_SUBJECT} characters).` });
    return;
  }
  if (message.length < 20 || message.length > MAX_MESSAGE) {
    res
      .status(400)
      .json({ error: `Please describe the problem in 20 to ${MAX_MESSAGE} characters.` });
    return;
  }
  if (!CATEGORIES.has(category)) {
    res.status(400).json({ error: "Please choose a valid category." });
    return;
  }
  if (systemInfo.length > MAX_SYSTEM_INFO) {
    res.status(400).json({ error: "System details are too long." });
    return;
  }

  if (honeypot) {
    res.status(200).json({ ok: true });
    return;
  }

  if (!consumeGlobalBudget("support", GLOBAL_SUPPORT_PER_HOUR)) {
    console.error("global support relay budget exhausted — possible abuse");
    res.status(429).json({
      error: "We're receiving an unusual number of messages. Please try again later.",
    });
    return;
  }

  if (!mailIsConfigured) {
    // Don't claim delivery that cannot happen. sendMail would log-and-return
    // undelivered, which for a support form means a silently lost message.
    console.error("support form submitted but no email provider is configured");
    res.status(503).json({
      error: "Our support mailbox is temporarily unreachable. Please try again shortly.",
    });
    return;
  }

  const html = `
    <h2>New support request</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
      <tr><td><strong>Category</strong></td><td>${escapeHtml(CATEGORY_LABELS[category])}</td></tr>
      <tr><td><strong>Subject</strong></td><td>${escapeHtml(subject)}</td></tr>
      ${systemInfo ? `<tr><td><strong>System</strong></td><td>${escapeHtml(systemInfo)}</td></tr>` : ""}
    </table>
    <h3>Message</h3>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `;

  try {
    await sendMail({
      to: SUPPORT_INBOX,
      subject: singleLine(`[PC Tweaker support] ${subject}`),
      html,
      replyTo: email,
    });
  } catch (err) {
    // A MailError blaming the recipient here means *our* inbox was rejected,
    // not the visitor's address — never tell them to check their own email.
    console.error("support relay failed:", err instanceof MailError ? err.message : err);
    res.status(502).json({
      error: "We couldn't deliver your message right now. Please try again in a few minutes.",
    });
    return;
  }

  // Best-effort acknowledgement to the visitor. Their message is already
  // relayed at this point, so a failure here must not turn into an error.
  //
  // Deliberately does NOT echo the message back. The recipient address is
  // attacker-controlled, so quoting 5000 characters of their text would turn
  // this endpoint into a way to deliver abuse to any inbox with our domain's
  // reputation behind it. The subject line is enough for the sender to
  // recognise their own request.
  void sendMail({
    to: email,
    subject: "We received your PC Tweaker support request",
    html: `<p>Hi ${escapeHtml(name)},</p>
           <p>Thanks for getting in touch. Your message about "<strong>${escapeHtml(subject)}</strong>" has reached our support team and we'll reply to this address, usually within one business day.</p>
           <p>If you didn't send this, you can ignore this email — nothing else will follow.</p>
           <p>— The PC Tweaker team</p>`,
  }).catch((err: Error) => console.error("support acknowledgement failed:", err.message));

  res.status(200).json({ ok: true });
});

export default router;
