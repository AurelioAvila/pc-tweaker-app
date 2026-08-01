const nodemailer = require("nodemailer");

const { RESEND_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

const useResend = Boolean(RESEND_API_KEY);
const useSmtp = !useResend && Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
const isConfigured = useResend || useSmtp;

// SMTP over a raw socket (port 587/465) is blocked outbound on some hosts
// (Railway included) — connections just hang until the OS/nodemailer
// timeout instead of failing fast. Resend's HTTP API sends mail over normal
// HTTPS, so it isn't affected by that. Prefer Resend when configured; keep
// SMTP as a fallback for local development against providers that do allow it.
const transporter = useSmtp
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      family: 4,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    })
  : null;

async function sendViaResend({ to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: MAIL_FROM || "PC Tweaker <onboarding@resend.dev>", to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API ${res.status}: ${body}`);
  }
}

/**
 * Sends an email, or — when neither Resend nor SMTP is configured — logs it
 * to the console instead. This is what makes email verification / password
 * reset usable in local development without real credentials, without ever
 * pretending an email went out when it didn't.
 */
async function sendMail({ to, subject, html }) {
  if (useResend) {
    await sendViaResend({ to, subject, html });
    return { delivered: true };
  }
  if (transporter) {
    await transporter.sendMail({ from: MAIL_FROM || SMTP_USER, to, subject, html });
    return { delivered: true };
  }
  console.log(`\n[mailer] No email provider configured — would have sent to ${to}:\nSubject: ${subject}\n${html}\n`);
  return { delivered: false };
}

module.exports = { sendMail, isConfigured };
