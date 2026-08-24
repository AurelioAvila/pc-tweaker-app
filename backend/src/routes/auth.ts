import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { getPool, isConfigured } from "../db";
import { hashPassword, verifyPassword, signToken, requireAuth, isValidEmail, isValidPassword } from "../auth";
import { createActionToken, consumeActionToken } from "../tokens";
import { sendMail, MailError } from "../mailer";

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
async function sendVerificationEmail(userId: number, email: string): Promise<boolean> {
  const token = await createActionToken(userId, "email_verify", DAY_MS);
  const link = `${APP_URL.replace(/\/$/, "")}/api/auth/verify-email?token=${token}`;
  const { delivered } = await sendMail({
    to: email,
    subject: "Verify your PC Tweaker account",
    html: `<p>Click to verify your email:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
  });
  return delivered;
}

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, dateOfBirth } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "invalid email" });
  if (!isValidPassword(password)) return res.status(400).json({ error: "password must be at least 8 characters" });
  if (!firstName || !String(firstName).trim()) return res.status(400).json({ error: "first name is required" });
  if (!lastName || !String(lastName).trim()) return res.status(400).json({ error: "last name is required" });
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
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
      verificationEmailSent = await sendVerificationEmail(id, email.toLowerCase());
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

    const delivered = await sendVerificationEmail(req.userId as number, result.rows[0].email);
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
function htmlPage(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — PC Tweaker</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
  font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
  background:radial-gradient(1200px 600px at 50% -10%,#241a3d 0%,#12091f 55%,#0b0616 100%);
  color:#e9e6f5}
.card{width:100%;max-width:400px;background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:32px 28px;
  box-shadow:0 24px 60px rgba(0,0,0,.45)}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.mark{width:34px;height:34px;border-radius:10px;flex:none;
  background:linear-gradient(135deg,#ff8a3d,#ff5c8a);display:grid;place-items:center;
  font-weight:800;color:#1b1030;font-size:17px}
.brand span{font-weight:700;letter-spacing:.2px}
h2{margin:0 0 6px;font-size:21px;font-weight:700}
p.lead{margin:0 0 22px;color:#a79fc4;font-size:14px;line-height:1.55}
label{display:block;font-size:12px;font-weight:600;letter-spacing:.06em;
  text-transform:uppercase;color:#8f86b0;margin:14px 0 6px}
input{width:100%;padding:12px 14px;font-size:15px;color:#f2effc;
  background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.12);border-radius:11px;
  outline:none}
input:focus{border-color:#ff5c8a;box-shadow:0 0 0 3px rgba(255,92,138,.16)}
button{width:100%;margin-top:22px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;
  color:#1b1030;border:0;border-radius:11px;
  background:linear-gradient(135deg,#ff8a3d,#ff5c8a)}
button:hover{filter:brightness(1.07)}
.hint{margin-top:14px;font-size:12.5px;color:#7d749b;line-height:1.5}
.error{margin:16px 0 0;padding:11px 13px;border-radius:10px;font-size:13.5px;
  color:#ffb4b4;background:rgba(239,68,68,.11);border:1px solid rgba(239,68,68,.28)}
.success{margin:16px 0 0;padding:11px 13px;border-radius:10px;font-size:13.5px;
  color:#a7f3d0;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.28)}
</style></head>
<body><div class="card">
<div class="brand"><div class="mark">P</div><span>PC Tweaker</span></div>
<h2>${title}</h2>${bodyHtml}</div></body></html>`;
}

router.get("/verify-email", async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!isConfigured) return res.status(503).send(htmlPage("Error", "<p class=error>Database not configured.</p>"));
  if (typeof token !== "string") return res.status(400).send(htmlPage("Error", "<p class=error>Missing token.</p>"));

  try {
    const userId = await consumeActionToken(token, "email_verify");
    if (!userId) {
      return res
        .status(400)
        .send(htmlPage("Link expired", "<p class=error>This verification link is invalid or has expired. Request a new one from the app.</p>"));
    }
    await getPool().query("UPDATE users SET email_verified = TRUE WHERE id = $1", [userId]);
    res.send(htmlPage("Email verified", "<p class=success>Your email is verified. You can close this window and return to PC Tweaker.</p>"));
  } catch (err) {
    console.error("verify-email failed:", err);
    res.status(500).send(htmlPage("Error", "<p class=error>Something went wrong. Try again later.</p>"));
  }
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "invalid email" });

  // Always respond the same way regardless of whether the account exists,
  // so this endpoint can't be used to enumerate registered emails.
  const genericResponse = { ok: true, message: "If that email is registered, a reset link has been sent." };
  if (!isConfigured) return res.json(genericResponse);

  try {
    const result = await getPool().query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (result.rowCount && result.rowCount > 0) {
      const userId = result.rows[0].id;
      const token = await createActionToken(userId, "password_reset", 60 * 60 * 1000);
      const link = `${APP_URL.replace(/\/$/, "")}/api/auth/reset-password?token=${token}`;
      await sendMail({
        to: email.toLowerCase(),
        subject: "Reset your PC Tweaker password",
        html: `<p>Click to choose a new password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
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
function resetForm(token: string, error?: string): string {
  return htmlPage(
    "Choose a new password",
    `<p class="lead">Pick something you don't use anywhere else. You'll be signed out on your other devices.</p>
     <form method="post" action="/api/auth/reset-password">
       <input type="hidden" name="token" value="${escapeHtml(token)}">
       <label for="pw">New password</label>
       <input id="pw" type="password" name="newPassword" minlength="8" required autofocus
              autocomplete="new-password" placeholder="At least 8 characters">
       <label for="pw2">Confirm password</label>
       <input id="pw2" type="password" name="confirmPassword" minlength="8" required
              autocomplete="new-password" placeholder="Type it again">
       <button type="submit">Update password</button>
     </form>
     ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
     <p class="hint">This link works once and expires an hour after it was sent.</p>`,
  );
}

router.get("/reset-password", (req: Request, res: Response) => {
  const { token } = req.query;
  if (typeof token !== "string" || token.length === 0) {
    return res
      .status(400)
      .send(
        htmlPage(
          "Link not valid",
          `<p class="lead">This page needs the link from your reset email — open that link directly rather than reloading this page.</p>`,
        ),
      );
  }
  res.send(resetForm(token));
});

router.post("/reset-password", async (req: Request, res: Response) => {
  const { token, newPassword, confirmPassword } = req.body || {};

  // The browser form posts url-encoded and expects HTML back; the desktop app
  // posts JSON and expects JSON. One handler serves both, deciding by whether
  // a confirm field came along (only the form sends one) and by Accept.
  const wantsHtml = typeof confirmPassword === "string" || (req.get("accept") || "").includes("text/html");
  const fail = (status: number, message: string) => {
    if (wantsHtml && typeof token === "string" && token.length > 0) {
      return res.status(status).send(resetForm(token, message));
    }
    if (wantsHtml) {
      return res.status(status).send(htmlPage("Link not valid", `<p class="error">${escapeHtml(message)}</p>`));
    }
    return res.status(status).json({ error: message });
  };

  if (typeof token !== "string" || token.length === 0) return fail(400, "missing token");
  if (!isValidPassword(newPassword)) return fail(400, "Password must be at least 8 characters.");
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

    if (wantsHtml) {
      return res.send(
        htmlPage(
          "Password updated",
          `<p class="success">Done. Go back to PC Tweaker and sign in with your new password.</p>
           <p class="hint">You can close this window.</p>`,
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
