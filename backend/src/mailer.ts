import nodemailer, { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { readyProviders, sendEmail, type Mail } from "./email-relay";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

// HTTPS providers in EMAIL_PROVIDERS order (default resend,smtp2go,mailjet),
// each used only once its key is set: RESEND_API_KEY, SMTP2GO_API_KEY,
// MAILJET_API_KEY + MAILJET_API_SECRET. The next one takes a message only when
// the previous one did not (quota, refusal, 5xx, timeout); see email-relay.ts.
const useRelay = Boolean(readyProviders().length && MAIL_FROM);
const useSmtp = !useRelay && Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && MAIL_FROM);
const isConfigured = useRelay || useSmtp;
/** EMAIL_SINK=1: nothing leaves the process, the HTML lands in EMAIL_SINK_DIR for previews. */
const sinkOn = ["1", "true", "yes", "dry-run"].includes(String(process.env.EMAIL_SINK || "").toLowerCase());

// SMTP over a raw socket (port 587/465) is blocked outbound on some hosts
// (Railway included) — connections just hang until the OS/nodemailer
// timeout instead of failing fast. The HTTP providers send mail over normal
// HTTPS, so they aren't affected by that. Prefer them when configured; keep
// SMTP as a fallback for local development against providers that do allow it.
// `family` (force IPv4) is a real nodemailer/Node `net.connect` option that
// @types/nodemailer doesn't declare — the intersection adds it back without
// loosening the rest of the type checking on this object.
const transporter: Transporter | null = useSmtp
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      family: 4,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    } as SMTPTransport.Options & { family: number })
  : null;

/**
 * Thrown when the email provider refuses to send. `rejectedAddress` is true
 * when the provider blamed the recipient (a 4xx: typo'd domain, blocked
 * address, unverified test domain) rather than itself — the caller needs that
 * distinction to tell the user "check your address" instead of "try later".
 */
class MailError extends Error {
  rejectedAddress: boolean;

  constructor(message: string, { rejectedAddress }: { rejectedAddress: boolean }) {
    super(message);
    this.name = "MailError";
    this.rejectedAddress = rejectedAddress;
  }
}

/**
 * `replyTo` lets a relayed message (the support form) be answered by simply
 * hitting reply, without the sender ever becoming the From address — which
 * would fail SPF/DKIM for a domain we don't own and land the mail in spam.
 */
type MailInput = {
  to: string; subject: string; html: string; text?: string; replyTo?: string;
  /** Extra MIME headers, e.g. List-Unsubscribe on list mail. */
  headers?: Record<string, string>;
  /** Stable per message (receipt key, token) so a retry can never mail twice; random when absent. */
  idempotencyKey?: string;
  /** Another display name on a verified address, e.g. "Redaxa <noreply@pctweaker.app>"; MAIL_FROM when absent. */
  from?: string;
};

async function sendViaRelay(mail: MailInput): Promise<void> {
  const result = await sendEmail({ ...mail, from: mail.from || MAIL_FROM || "" } satisfies Mail, { timeoutMs: 15_000 });
  if (!result.ok) {
    // Only blame the recipient when the first provider refused the address
    // itself (a 4xx other than 401/403/429). Credentials, quota and outages
    // are ours: telling the user to "check your address" for those would send
    // them chasing a problem that isn't theirs. Provider bodies are never
    // repeated here: they can echo the recipient.
    const tried = result.attempts.map((a) => `${a.provider} ${a.outcome}${a.status ? ` ${a.status}` : ""}${a.code ? ` ${a.code}` : ""}`);
    throw new MailError(`email not sent (${result.error}): ${tried.join(", ")}`, { rejectedAddress: result.rejectedAddress });
  }
}

/**
 * Sends an email. Local development records only recipient and subject when
 * no provider is configured; production never writes action links or message
 * bodies to logs because they can contain password-reset tokens or personal
 * support content.
 */
async function sendMail({ to, subject, html, text, replyTo = "support@pctweaker.app", headers, idempotencyKey, from }: MailInput): Promise<{ delivered: boolean }> {
  if (useRelay || sinkOn) {
    await sendViaRelay({ to, subject, html, text, replyTo, headers, idempotencyKey, from });
    return { delivered: true };
  }
  if (transporter) {
    await transporter.sendMail({
      from: from || MAIL_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(headers ? { headers } : {}),
    });
    return { delivered: true };
  }
  const productionRuntime =
    process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT_ID);
  if (productionRuntime) {
    throw new MailError("No email provider is configured", { rejectedAddress: false });
  }
  console.log(`[mailer] No provider configured — skipped email to ${to}; subject: ${subject}`);
  return { delivered: false };
}

export { sendMail, isConfigured, MailError };
