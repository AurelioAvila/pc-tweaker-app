const nodemailer = require("nodemailer");

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Railway's network doesn't route IPv6 egress, but Node's DNS lookup
      // for smtp.gmail.com can still return an AAAA (IPv6) record first,
      // causing connect ENETUNREACH. Forcing IPv4 here fixes it regardless
      // of what order the OS resolver returns addresses in.
      family: 4,
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
