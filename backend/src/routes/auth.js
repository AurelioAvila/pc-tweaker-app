const express = require("express");
const rateLimit = require("express-rate-limit");
const { pool, isConfigured } = require("../db");
const { hashPassword, verifyPassword, signToken, requireAuth, isValidEmail, isValidPassword } = require("../auth");
const { createActionToken, consumeActionToken } = require("../tokens");
const { sendMail, MailError } = require("../mailer");

const router = express.Router();

// Slows down credential-stuffing / brute-force attempts against these
// endpoints specifically, without throttling the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(authLimiter);

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const DAY_MS = 24 * 60 * 60 * 1000;

async function sendVerificationEmail(userId, email) {
  const token = await createActionToken(userId, "email_verify", DAY_MS);
  const link = `${APP_URL.replace(/\/$/, "")}/api/auth/verify-email?token=${token}`;
  await sendMail({
    to: email,
    subject: "Verify your PC Tweaker account",
    html: `<p>Click to verify your email:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
  });
}

router.post("/register", async (req, res) => {
  const { email, password, firstName, lastName, dateOfBirth } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "invalid email" });
  if (!isValidPassword(password)) return res.status(400).json({ error: "password must be at least 8 characters" });
  if (!firstName || !firstName.trim()) return res.status(400).json({ error: "first name is required" });
  if (!lastName || !lastName.trim()) return res.status(400).json({ error: "last name is required" });
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return res.status(400).json({ error: "date of birth is required (YYYY-MM-DD)" });
  }
  if (!isConfigured) return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "an account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth) VALUES ($1, $2, $3, $4, $5) RETURNING id, token_version",
      [email.toLowerCase(), passwordHash, firstName.trim(), lastName.trim(), dateOfBirth],
    );
    const { id, token_version } = result.rows[0];
    const token = signToken(id, token_version);

    let verificationEmailSent = true;
    try {
      await sendVerificationEmail(id, email.toLowerCase());
    } catch (err) {
      // Registration itself succeeded; don't fail the whole request just
      // because the verification email couldn't be sent. But do report it:
      // silently swallowing this left users waiting for a message that was
      // never going to arrive, with nothing on screen to explain why.
      console.error("failed to send verification email:", err);
      verificationEmailSent = false;
    }

    res.status(201).json({ token, verificationEmailSent });
  } catch (err) {
    // Two concurrent registrations for the same email both pass the SELECT
    // check above before either INSERTs; the second hits the unique
    // constraint here instead. Report it the same way as the normal case.
    if (err.code === "23505") {
      return res.status(409).json({ error: "an account with this email already exists" });
    }
    console.error("register failed:", err);
    res.status(500).json({ error: "registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== "string") {
    return res.status(400).json({ error: "invalid email or password" });
  }
  if (!isConfigured) return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });

  try {
    const result = await pool.query(
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

router.post("/logout-all", requireAuth, async (req, res) => {
  try {
    await pool.query("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error("logout-all failed:", err);
    res.status(500).json({ error: "logout failed" });
  }
});

router.post("/resend-verification", requireAuth, async (req, res) => {
  if (!isConfigured) return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
  try {
    const result = await pool.query("SELECT email, email_verified FROM users WHERE id = $1", [req.userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: "account not found" });
    if (result.rows[0].email_verified) return res.json({ ok: true, alreadyVerified: true });

    await sendVerificationEmail(req.userId, result.rows[0].email);
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlPage(title, bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:80px auto;padding:0 20px;color:#1e1b2e}
input{width:100%;padding:10px;margin:8px 0;box-sizing:border-box;font-size:16px}
button{width:100%;padding:10px;font-size:16px;cursor:pointer}
.error{color:#b91c1c}.success{color:#15803d}</style></head>
<body><h2>${title}</h2>${bodyHtml}</body></html>`;
}

router.get("/verify-email", async (req, res) => {
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
    await pool.query("UPDATE users SET email_verified = TRUE WHERE id = $1", [userId]);
    res.send(htmlPage("Email verified", "<p class=success>Your email is verified. You can close this window and return to PC Tweaker.</p>"));
  } catch (err) {
    console.error("verify-email failed:", err);
    res.status(500).send(htmlPage("Error", "<p class=error>Something went wrong. Try again later.</p>"));
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "invalid email" });

  // Always respond the same way regardless of whether the account exists,
  // so this endpoint can't be used to enumerate registered emails.
  const genericResponse = { ok: true, message: "If that email is registered, a reset link has been sent." };
  if (!isConfigured) return res.json(genericResponse);

  try {
    const result = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (result.rowCount > 0) {
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

router.get("/reset-password", (req, res) => {
  const { token } = req.query;
  if (typeof token !== "string") {
    return res.status(400).send(htmlPage("Error", "<p class=error>Missing token.</p>"));
  }
  // The token is rendered only as an HTML attribute value (properly
  // escaped) and read back via the DOM in the script below — never
  // interpolated directly into the script text, which would let a crafted
  // token (e.g. containing "</script><script>...") break out and execute.
  res.send(
    htmlPage(
      "Reset your password",
      `<form id="f">
       <input type="hidden" id="token" value="${escapeHtml(token)}">
       <input type="password" id="pw" placeholder="New password (min 8 characters)" minlength="8" required>
       <button type="submit">Reset password</button></form><p id="msg"></p>
       <script>
         document.getElementById('f').addEventListener('submit', async (e) => {
           e.preventDefault();
           const password = document.getElementById('pw').value;
           const token = document.getElementById('token').value;
           const res = await fetch('/api/auth/reset-password', {
             method: 'POST', headers: {'Content-Type':'application/json'},
             body: JSON.stringify({ token, newPassword: password })
           });
           const body = await res.json();
           document.getElementById('msg').textContent = res.ok
             ? 'Password updated — you can close this window and log in again in the app.'
             : (body.error || 'Something went wrong.');
           document.getElementById('msg').className = res.ok ? 'success' : 'error';
         });
       </script>`,
    ),
  );
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== "string") return res.status(400).json({ error: "missing token" });
  if (!isValidPassword(newPassword)) return res.status(400).json({ error: "password must be at least 8 characters" });
  if (!isConfigured) return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });

  try {
    const userId = await consumeActionToken(token, "password_reset");
    if (!userId) {
      return res.status(400).json({ error: "this reset link is invalid or has expired" });
    }
    const passwordHash = await hashPassword(newPassword);
    // Bumping token_version signs out every session that used the old
    // password — important since a stolen old token shouldn't survive a
    // password reset that was presumably triggered because of a compromise.
    await pool.query(
      "UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2",
      [passwordHash, userId],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("reset-password failed:", err);
    res.status(500).json({ error: "could not reset password" });
  }
});

module.exports = router;
