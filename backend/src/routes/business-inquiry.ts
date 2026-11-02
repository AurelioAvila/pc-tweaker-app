import express, { Request, Response } from "express";
import { isValidEmail } from "../auth";
import { sendMail, isConfigured as mailIsConfigured, MailError } from "../mailer";
import { SUPPORT_INBOX } from "../support-inbox";
import { consumeGlobalBudget, consumeKeyedBudget, singleLine } from "../public-form-guard";

const router = express.Router();

const MAX_COMPANY = 120;
const MAX_NAME = 80;
const MAX_MESSAGE = 3000;
const MAX_FLEET = 1_000_000;
const PER_IP_PER_HOUR = 5;
const GLOBAL_PER_HOUR = 40;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * "PC Tweaker for Business" quote request. Relayed to the support inbox with
 * the sender in Reply-To, like /api/support. Nothing from the request is
 * logged: the body is a company contact, so only the mail error is printed.
 */
router.post("/", async (req: Request, res: Response) => {
  const company = str(req.body?.company);
  const name = str(req.body?.name);
  const email = str(req.body?.email);
  const message = str(req.body?.message);
  const fleet = Number(req.body?.pcs);
  // Honeypot: hidden from people, filled by bots. Answer 200 so they learn nothing.
  const honeypot = str(req.body?.website);

  if (!company || company.length > MAX_COMPANY) {
    res.status(400).json({ error: `Please enter your company name (up to ${MAX_COMPANY} characters).` });
    return;
  }
  if (!name || name.length > MAX_NAME) {
    res.status(400).json({ error: `Please enter your name (up to ${MAX_NAME} characters).` });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid work email address so we can reply." });
    return;
  }
  if (!Number.isInteger(fleet) || fleet < 1 || fleet > MAX_FLEET) {
    res.status(400).json({ error: "Please enter how many PCs you manage, as a whole number." });
    return;
  }
  if (message.length > MAX_MESSAGE) {
    res.status(400).json({ error: `Please keep the message under ${MAX_MESSAGE} characters.` });
    return;
  }
  if (req.body?.consent !== true) {
    res.status(400).json({ error: "Please confirm that we may use these details to reply to you." });
    return;
  }

  if (honeypot) {
    res.status(200).json({ ok: true });
    return;
  }

  if (!consumeKeyedBudget("business-inquiry", `ip:${req.ip}`, PER_IP_PER_HOUR) || !consumeGlobalBudget("business-inquiry", GLOBAL_PER_HOUR)) {
    res.status(429).json({ error: "We're receiving an unusual number of messages. Please try again later." });
    return;
  }

  if (!mailIsConfigured) {
    console.error("business inquiry submitted but no email provider is configured");
    res.status(503).json({ error: "Our mailbox is temporarily unreachable. Please try again shortly." });
    return;
  }

  const rows: [string, string][] = [
    ["Company", company],
    ["Name", name],
    ["Email", email],
    ["PCs", String(fleet)],
  ];
  const html = `
    <h2>New PC Tweaker for Business request</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v)}</td></tr>`).join("")}
    </table>
    ${message ? `<h3>Message</h3><p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ""}
  `;

  try {
    await sendMail({
      to: SUPPORT_INBOX,
      subject: singleLine(`[PC Tweaker Business] Quote request (${fleet} PCs)`),
      html,
      text: `New PC Tweaker for Business request\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${message || "(no message)"}`,
      replyTo: email,
    });
  } catch (err) {
    console.error("business inquiry relay failed:", err instanceof MailError ? err.message : "send error");
    res.status(502).json({ error: "We couldn't deliver your message right now. Please try again in a few minutes." });
    return;
  }

  res.status(200).json({ ok: true });
});

export default router;
