import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { getPool, isConfigured } from "../db";
import { hashPassword, verifyPassword, signToken, requireAuth, isValidEmail, isValidPassword } from "../auth";
import { createActionToken, consumeActionToken, confirmsVerifiedAddress, invalidatePasswordResets } from "../tokens";
import { sendMail, MailError } from "../mailer";
import {
  accountWelcomeText,
  passwordChangedText,
  passwordResetText,
  verificationText,
  accountWelcomeHtml,
  accountWelcomeSubject,
  passwordChangedHtml,
  passwordChangedSubject,
  passwordResetHtml,
  passwordResetSubject,
  verificationHtml,
  verificationSubject,
} from "../emails/account";
import { EMAIL_BRANDS, type EmailBrand } from "../emails/layout";

/** What the free tier includes, quoted in the welcome email. Kept beside the
 *  one place that sends it rather than hidden in the template, so a change to
 *  what is free is a change here. scripts/check-public-counts.mjs fails the
 *  build when it differs from the catalogue the app ships. */
const FREE_TWEAK_COUNT = 46;

/** The account is shared by the family; mail is branded for the app that
 *  asked. Only a known product changes anything, so a forged value costs
 *  nothing but the logo. Tweaky Driver mails from its own service. */
function brandOf(product: unknown): EmailBrand {
  return product === "uninstaller" ? EMAIL_BRANDS.uninstaller : EMAIL_BRANDS.pctweaker;
}
function productQuery(brand: EmailBrand): string {
  return brand === EMAIL_BRANDS.uninstaller ? "&product=uninstaller" : "";
}

const router = express.Router();

// Slows down credential-stuffing / brute-force attempts against these
// endpoints specifically, without throttling the rest of the API.
//
// Keyed on the submitted email/target account rather than req.ip: Railway
// sits in front as a single proxy hop but does not strip an inbound
// X-Forwarded-For before appending its own, so with `trust proxy: 1` the
// attacker-supplied value survives as req.ip — confirmed live, rotating the
// header on every request bypassed a 20-req/15min IP-keyed limiter entirely
// (0 blocks across 25 failed logins). The email is the actual asset being
// protected here (one account's password), and it can't be rotated for
// free the way a header can, so keying on it closes the bypass regardless
// of how many IPs an attacker claims to have. Requests with no email in the
// body (malformed JSON, wrong content-type) fall back to req.ip, which is
// still meaningful for blanket abuse even if spoofable per-target.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // JSON like every other error here, so the apps can read it and show
  // their own translated message instead of a raw status code.
  message: { error: "Too many attempts. Please wait 15 minutes and try again." },
  keyGenerator: (req) => {
    const email = req.body?.email;
    return typeof email === "string" && email ? `email:${email.toLowerCase()}` : `ip:${req.ip}`;
  },
});
router.use(authLimiter);

const APP_URL =
  process.env.APP_URL ||
  (process.env.NODE_ENV === "production" ? "https://api.pctweaker.app" : "http://localhost:3000");
const DAY_MS = 24 * 60 * 60 * 1000;

/** Resolves to false when no email provider is configured, so callers can
 * tell the user the truth instead of pointing them at an inbox that is never
 * going to receive anything. `sendMail` only *throws* when a configured
 * provider refuses; with no provider at all it logs and reports undelivered,
 * and that distinction used to be dropped on the floor here. */
async function sendVerificationEmail(userId: number, email: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): Promise<boolean> {
  const token = await createActionToken(userId, "email_verify", DAY_MS);
  const link = `${APP_URL.replace(/\/$/, "")}/api/auth/verify-email?token=${token}${productQuery(brand)}`;
  const { rows } = await getPool().query("SELECT first_name FROM users WHERE id = $1", [userId]);
  const { delivered } = await sendMail({
    to: email,
    subject: verificationSubject(brand),
    html: verificationHtml(rows[0]?.first_name ?? "", link, brand),
    text: verificationText(link, brand),
  });
  return delivered;
}

/**
 * Welcomes someone whose address is now confirmed.
 *
 * The free tweak count is read from the same place the app reads it, so the
 * email cannot quietly promise a number that stopped being true.
 */
async function sendAccountWelcome(userId: number, brand: EmailBrand = EMAIL_BRANDS.pctweaker): Promise<void> {
  const { rows } = await getPool().query(
    "SELECT email, first_name FROM users WHERE id = $1",
    [userId],
  );
  const user = rows[0];
  if (!user?.email) return;
  await sendMail({
    to: user.email,
    subject: accountWelcomeSubject(brand),
    html: accountWelcomeHtml(user.first_name ?? "", FREE_TWEAK_COUNT, brand),
    text: accountWelcomeText(FREE_TWEAK_COUNT, brand),
  });
}

/**
 * Tells the account owner that the password changed.
 *
 * The reset flow proves control of the inbox before it will change anything,
 * so this is not a second authorization step — it is the only way the person
 * who owns the account finds out, if the reset was not theirs. Sent from the
 * one place that writes a new password_hash, so a second way to change one
 * cannot quietly ship without it.
 */
async function sendPasswordChangedNotice(userId: number, changedAt: Date, brand: EmailBrand = EMAIL_BRANDS.pctweaker): Promise<void> {
  const { rows } = await getPool().query(
    "SELECT email, first_name FROM users WHERE id = $1",
    [userId],
  );
  const user = rows[0];
  if (!user?.email) return;
  await sendMail({
    to: user.email,
    subject: passwordChangedSubject(brand),
    html: passwordChangedHtml(user.first_name ?? "", changedAt.toUTCString(), brand),
    text: passwordChangedText(changedAt.toUTCString(), brand),
  });
}

/** Names reach every email we send; nobody's first or last name is longer. */
const MAX_NAME = 100;

/** A real calendar date in the past. "2026-02-31" used to pass the pattern
 *  check and then fail in PostgreSQL as a 500 instead of a 400. */
export function isValidDateOfBirth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value
    && date.getUTCFullYear() >= 1900
    && date.getTime() <= Date.now();
}

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, dateOfBirth, product } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "invalid email" });
  if (!isValidPassword(password)) return res.status(400).json({ error: "Password must be at least 8 characters and no more than 72 UTF-8 bytes." });
  if (!firstName || !String(firstName).trim()) return res.status(400).json({ error: "first name is required" });
  if (!lastName || !String(lastName).trim()) return res.status(400).json({ error: "last name is required" });
  if (String(firstName).trim().length > MAX_NAME || String(lastName).trim().length > MAX_NAME) {
    return res.status(400).json({ error: `names can be up to ${MAX_NAME} characters` });
  }
  if (!isValidDateOfBirth(dateOfBirth)) {
    return res.status(400).json({ error: "date of birth is required (YYYY-MM-DD)" });
  }
  if (!isConfigured) return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });

  try {
    const pool = getPool();
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(409).json({ error: "an account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth) VALUES ($1, $2, $3, $4, $5) RETURNING id, token_version",
      [email.toLowerCase(), passwordHash, String(firstName).trim(), String(lastName).trim(), dateOfBirth],
    );
    const { id, token_version } = result.rows[0];
    const token = signToken(id, token_version);

    let verificationEmailSent = false;
    try {
      verificationEmailSent = await sendVerificationEmail(id, email.toLowerCase(), brandOf(product));
    } catch (err) {
      // Registration itself succeeded; don't fail the whole request just
      // because the verification email couldn't be sent. But do report it:
      // silently swallowing this left users waiting for a message that was
      // never going to arrive, with nothing on screen to explain why.
      console.error("failed to send verification email:", err);
      verificationEmailSent = false;
    }

    res.status(201).json({ token, verificationEmailSent });
  } catch (err: any) {
    // Two concurrent registrations for the same email both pass the SELECT
    // check above before either INSERTs; the second hits the unique
    // constraint here instead. Report it the same way as the normal case.
    if (err?.code === "23505") {
      return res.status(409).json({ error: "an account with this email already exists" });
    }
    console.error("register failed:", err);
    res.status(500).json({ error: "registration failed" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== "string") {
    return res.status(400).json({ error: "invalid email or password" });
  }
  if (!isConfigured) return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });

  try {
    const result = await getPool().query(
      "SELECT id, password_hash, token_version FROM users WHERE email = $1",
      [email.toLowerCase()],
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: "invalid email or password" });
    }
    const user = result.rows[0];
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "invalid email or password" });
    }
    const token = signToken(user.id, user.token_version);
    res.json({ token });
  } catch (err) {
    console.error("login failed:", err);
    res.status(500).json({ error: "login failed" });
  }
});

router.post("/logout-all", requireAuth, async (req: Request, res: Response) => {
  try {
    await getPool().query("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error("logout-all failed:", err);
    res.status(500).json({ error: "logout failed" });
  }
});

router.post("/resend-verification", requireAuth, async (req: Request, res: Response) => {
  if (!isConfigured) return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
  try {
    const result = await getPool().query("SELECT email, email_verified FROM users WHERE id = $1", [req.userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: "account not found" });
    if (result.rows[0].email_verified) return res.json({ ok: true, alreadyVerified: true });

    const delivered = await sendVerificationEmail(req.userId as number, result.rows[0].email, brandOf(req.body?.product));
    if (!delivered) {
      // No provider configured at all — a server-side misconfiguration, not
      // anything the user can act on. Saying "sent" would leave them
      // refreshing an inbox forever.
      return res.status(503).json({ error: "email delivery is not configured on the server" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("resend-verification failed:", err);
    // A 500 here told the user nothing actionable. The two causes need
    // different answers: an address the provider won't deliver to is something
    // only they can fix, while a provider outage is ours and worth retrying.
    if (err instanceof MailError && err.rejectedAddress) {
      return res
        .status(400)
        .json({ error: "we could not send to that email address — please check it is correct" });
    }
    res.status(502).json({ error: "the email service is unavailable right now, please try again shortly" });
  }
});

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The shell for every page this server renders in a browser.
 *
 * All styling is a single inline <style> block: helmet's CSP here is
 * `default-src 'self'`, so a linked stylesheet would need a real route, and
 * `style-src` allows 'unsafe-inline' while `script-src` does not — which is
 * precisely why these pages carry no JavaScript at all.
 */
export function htmlPage(title: string, bodyHtml: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker): string {
  const initial = escapeHtml(brand.name.replace(/^PC Tweaker /, "").charAt(0));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title} — ${escapeHtml(brand.name)}</title>
<style>
:root{color-scheme:light dark;--page:#f3f4f6;--card:#fff;--line:#e5e7eb;--h:#111827;--t:#374151;--m:#6b7280;
  --field:#fff;--accent:${brand.accent};--on-accent:${brand.buttonText};--acc-text:${brand.accentText}}
@media (prefers-color-scheme:dark){:root{--page:#0b0c0f;--card:#16181d;--line:#2a2e36;--h:#f3f4f6;--t:#d1d5db;--m:#9ca3af;
  --field:#1d2027;--acc-text:${brand.accentTextDark}}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--page);color:var(--t);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.card{width:100%;max-width:420px;background:var(--card);border:1px solid var(--line);border-top:4px solid var(--accent);
  border-radius:16px;padding:28px 28px 30px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:24px;color:var(--h);font-weight:700}
.mark{width:36px;height:36px;border-radius:10px;flex:none;background:var(--accent);color:var(--on-accent);
  display:grid;place-items:center;font-weight:800;font-size:17px}
h2{margin:0 0 8px;font-size:22px;font-weight:800;color:var(--h);letter-spacing:-.3px}
p.lead{margin:0 0 20px;color:var(--t);font-size:15px;line-height:1.6}
label{display:block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--m);margin:16px 0 6px}
input{width:100%;padding:12px 14px;font-size:15px;color:var(--h);background:var(--field);border:1px solid var(--line);
  border-radius:10px;outline:none}
input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent)}
button{width:100%;margin-top:22px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;color:var(--on-accent);
  border:0;border-radius:10px;background:var(--accent)}
button:hover{filter:brightness(1.06)}
.hint{margin-top:14px;font-size:13px;color:var(--m);line-height:1.55}
.error,.success{margin:16px 0 0;padding:12px 14px;border-radius:10px;font-size:14px;line-height:1.5}
.error{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca}
.success{color:#047857;background:#ecfdf5;border:1px solid #a7f3d0}
@media (prefers-color-scheme:dark){.error{color:#fca5a5;background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.3)}
  .success{color:#6ee7b7;background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.3)}}
footer{margin-top:22px;font-size:12px;color:var(--m)}
footer a{color:var(--m)}
</style></head>
<body><div class="card">
<div class="brand"><div class="mark" aria-hidden="true">${initial}</div><span>${escapeHtml(brand.name)}</span></div>
<h2>${title}</h2>${bodyHtml}
<footer>One account for PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver. <a href="https://pctweaker.app/support">Support</a> · <a href="https://pctweaker.app/privacy">Privacy</a></footer>
</div></body></html>`;
}

router.get("/verify-email", async (req: Request, res: Response) => {
  const { token } = req.query;
  const brand = brandOf(req.query.product);
  const page = (title: string, body: string) => htmlPage(title, body, brand);
  if (!isConfigured) return res.status(503).send(page("Error", "<p class=error>Database not configured.</p>"));
  if (typeof token !== "string") return res.status(400).send(page("Error", "<p class=error>Missing token.</p>"));

  try {
    const userId = await consumeActionToken(token, "email_verify");
    if (!userId && (await confirmsVerifiedAddress(token))) {
      return res.send(page("Email verified", `<p class=success>Your email is already verified. You can close this window and return to ${escapeHtml(brand.name)}.</p>`));
    }
    if (!userId) {
      return res
        .status(400)
        .send(page("Link expired", "<p class=error>This verification link is invalid or has expired. Request a new one from the app.</p>"));
    }
    await getPool().query("UPDATE users SET email_verified = TRUE WHERE id = $1", [userId]);
    // The welcome waits until here rather than going out at registration,
    // where it would have arrived alongside the message asking the person to
    // confirm — two at once makes the one that needs acting on easier to
    // miss. Best-effort: a failed send must not make a confirmed address look
    // unconfirmed.
    void sendAccountWelcome(userId, brand).catch((err) =>
      console.error("failed to send the account welcome:", err),
    );
    res.send(page("Email verified", `<p class=success>Your email is verified. You can close this window and return to ${escapeHtml(brand.name)}.</p>`));
  } catch (err) {
    console.error("verify-email failed:", err);
    res.status(500).send(page("Error", "<p class=error>Something went wrong. Try again later.</p>"));
  }
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email, product } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "invalid email" });

  // Always respond the same way regardless of whether the account exists,
  // so this endpoint can't be used to enumerate registered emails.
  const genericResponse = { ok: true, message: "If that email is registered, a reset link has been sent." };
  if (!isConfigured) return res.json(genericResponse);

  try {
    const result = await getPool().query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (result.rowCount && result.rowCount > 0) {
      const brand = brandOf(product);
      const userId = result.rows[0].id;
      const token = await createActionToken(userId, "password_reset", 60 * 60 * 1000);
      const link = `${APP_URL.replace(/\/$/, "")}/api/auth/reset-password?token=${token}${productQuery(brand)}`;
      await sendMail({
        to: email.toLowerCase(),
        subject: passwordResetSubject(brand),
        html: passwordResetHtml(link, brand),
        text: passwordResetText(link, brand),
      }).catch((err) => console.error("failed to send reset email:", err));
    }
  } catch (err) {
    console.error("forgot-password failed:", err);
  }

  res.json(genericResponse);
});

/**
 * Renders the reset form.
 *
 * Deliberately a plain <form method="post"> with no JavaScript. The previous
 * version serialized the fields with an inline script, which this server's own
 * CSP (`script-src 'self'`) blocked — so the script never ran, the browser
 * submitted the form natively as a GET, and because the inputs carried only
 * `id` and no `name` it sent nothing at all. Every visitor landed on "Missing
 * token" and password reset was impossible in production.
 *
 * `error` re-renders the form with a message instead of throwing the user back
 * to a dead end, keeping the token in the hidden field so they can retry.
 */
function resetForm(token: string, brand: EmailBrand, error?: string): string {
  const product = brand === EMAIL_BRANDS.uninstaller ? `<input type="hidden" name="product" value="uninstaller">` : "";
  return htmlPage(
    "Choose a new password",
    `<p class="lead">Pick something you don't use anywhere else. It applies to PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver, and you'll be signed out on your other devices.</p>
     <form method="post" action="/api/auth/reset-password">
       <input type="hidden" name="token" value="${escapeHtml(token)}">${product}
       <label for="pw">New password</label>
       <input id="pw" type="password" name="newPassword" minlength="8" required autofocus
              autocomplete="new-password" placeholder="At least 8 characters" aria-describedby="password-limit">
       <p id="password-limit" class="hint">Use at least 8 characters and no more than 72 UTF-8 bytes. Accented characters and emoji may use multiple bytes.</p>
       <label for="pw2">Confirm password</label>
       <input id="pw2" type="password" name="confirmPassword" minlength="8" required
              autocomplete="new-password" placeholder="Type it again">
       <button type="submit">Update password</button>
     </form>
     ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
     <p class="hint">This link works once and expires an hour after it was sent.</p>`,
    brand,
  );
}

router.get("/reset-password", (req: Request, res: Response) => {
  const { token } = req.query;
  const brand = brandOf(req.query.product);
  if (typeof token !== "string" || token.length === 0) {
    return res
      .status(400)
      .send(
        htmlPage(
          "Link not valid",
          `<p class="lead">This page needs the link from your reset email — open that link directly rather than reloading this page.</p>`,
          brand,
        ),
      );
  }
  res.send(resetForm(token, brand));
});

router.post("/reset-password", async (req: Request, res: Response) => {
  const { token, newPassword, confirmPassword, product } = req.body || {};
  const brand = brandOf(product);

  // The browser form posts url-encoded and expects HTML back; the desktop app
  // posts JSON and expects JSON. One handler serves both, deciding by whether
  // a confirm field came along (only the form sends one) and by Accept.
  const wantsHtml = typeof confirmPassword === "string" || (req.get("accept") || "").includes("text/html");
  const fail = (status: number, message: string) => {
    if (wantsHtml && typeof token === "string" && token.length > 0) {
      return res.status(status).send(resetForm(token, brand, message));
    }
    if (wantsHtml) {
      return res.status(status).send(htmlPage("Link not valid", `<p class="error">${escapeHtml(message)}</p>`, brand));
    }
    return res.status(status).json({ error: message });
  };

  if (typeof token !== "string" || token.length === 0) return fail(400, "missing token");
  if (!isValidPassword(newPassword)) return fail(400, "Password must be at least 8 characters and no more than 72 UTF-8 bytes.");
  // Only enforced for the form, which is the only caller that collects it.
  if (typeof confirmPassword === "string" && confirmPassword !== newPassword) {
    return fail(400, "The two passwords don't match.");
  }
  if (!isConfigured) return fail(503, "database not configured (DATABASE_URL missing)");

  try {
    const userId = await consumeActionToken(token, "password_reset");
    if (!userId) {
      return fail(400, "This reset link is invalid, already used, or has expired.");
    }
    const passwordHash = await hashPassword(newPassword);
    // Bumping token_version signs out every session that used the old
    // password — important since a stolen old token shouldn't survive a
    // password reset that was presumably triggered because of a compromise.
    await getPool().query(
      "UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2",
      [passwordHash, userId],
    );
    // Any other reset link still in an inbox would let whoever holds it
    // change the password again for up to an hour. The one that was used
    // just proved control of the account; the rest are now stale.
    await invalidatePasswordResets(userId);

    // Best-effort, like the welcome: the password has already changed by now,
    // and failing the request would tell the user their reset did not work
    // when it did. A missing notice is worth a log line, not a dead end.
    void sendPasswordChangedNotice(userId, new Date(), brand).catch((err) =>
      console.error("failed to send the password changed notice:", err),
    );

    if (wantsHtml) {
      return res.send(
        htmlPage(
          "Password updated",
          `<p class="success">Done. Go back to ${escapeHtml(brand.name)} and sign in with your new password.</p>
           <p class="hint">You can close this window.</p>`,
          brand,
        ),
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("reset-password failed:", err);
    return fail(500, "Could not reset the password. Please try again.");
  }
});

export default router;
