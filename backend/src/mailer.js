const nodemailer = require("nodemailer");

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

/**
 * Sends an email, or — when SMTP isn't configured — logs it to the console
 * instead. This is what makes email verification / password reset usable in
 * local development without real SMTP credentials, without ever pretending
 * an email went out when it didn't.
 */
async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log(`\n[mailer] SMTP not configured — would have sent to ${to}:\nSubject: ${subject}\n${html}\n`);
    return { delivered: false };
  }
  await transporter.sendMail({ from: MAIL_FROM || SMTP_USER, to, subject, html });
  return { delivered: true };
}

module.exports = { sendMail, isConfigured };
