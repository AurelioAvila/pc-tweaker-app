import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { getPool, isConfigured } from "../db";
import { hashPassword, verifyPassword, signToken, requireAuth, isValidEmail, isValidPassword } from "../auth";
import {
  createActionToken,
  consumeActionToken,
  confirmsVerifiedAddress,
  invalidatePasswordResets,
  peekEmailChange,
  consumeEmailChange,
  invalidateActionTokens,
} from "../tokens";
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
  emailChangeMail,
  emailChangedNotice,
  newSignInMail,
} from "../emails/account";
import { EMAIL_BRANDS, type EmailBrand } from "../emails/layout";
import { copyFor, formatMoment, fromAcceptLanguage, isLocale, type Copy, type Locale } from "../emails/copy";
import { consumeGlobalBudget } from "../public-form-guard";

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

/**
 * The language a message to this person is written in: the one the app sent
 * with this request, else the one saved on the account, else the language the
 * browser or Windows asked for, else English.
 */
function languageOf(req: Request, saved?: unknown): Locale {
  const sent = req.body?.locale ?? req.query?.lang;
  if (isLocale(sent)) return sent;
  if (isLocale(saved)) return saved;
  return fromAcceptLanguage(req.get("accept-language")) ?? "en";
}

/** Saves the language the app sent, so mail that is not a reply to a request
 *  (receipts, notices) uses it too. Nothing is saved when the app sent none. */
async function rememberLanguage(req: Request, userId: number): Promise<void> {
  if (isLocale(req.body?.locale)) await getPool().query("UPDATE users SET locale = $1 WHERE id = $2", [req.body.locale, userId]);
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
const API = () => APP_URL.replace(/\/$/, "");
const DAY_MS = 24 * 60 * 60 * 1000;

/** Resolves to false when no email provider is configured, so callers can
 * tell the user the truth instead of pointing them at an inbox that is never
 * going to receive anything. `sendMail` only *throws* when a configured
 * provider refuses; with no provider at all it logs and reports undelivered,
 * and that distinction used to be dropped on the floor here. */
async function sendVerificationEmail(userId: number, email: string, brand: EmailBrand, lang: Locale): Promise<boolean> {
  const token = await createActionToken(userId, "email_verify", DAY_MS);
  const link = `${API()}/api/auth/verify-email?token=${token}${productQuery(brand)}&lang=${lang}`;
  const { rows } = await getPool().query("SELECT first_name FROM users WHERE id = $1", [userId]);
  const c = copyFor(lang);
  const { delivered } = await sendMail({
    to: email,
    subject: verificationSubject(brand, c),
    html: verificationHtml(rows[0]?.first_name ?? "", link, brand, c),
    text: verificationText(link, brand, c),
  });
  return delivered;
}

/**
 * Welcomes someone whose address is now confirmed.
 *
 * The free tweak count is read from the same place the app reads it, so the
 * email cannot quietly promise a number that stopped being true.
 */
async function sendAccountWelcome(userId: number, brand: EmailBrand, lang: Locale): Promise<void> {
  const { rows } = await getPool().query("SELECT email, first_name FROM users WHERE id = $1", [userId]);
  const user = rows[0];
  if (!user?.email) return;
  const c = copyFor(lang);
  await sendMail({
    to: user.email,
    subject: accountWelcomeSubject(brand, c),
    html: accountWelcomeHtml(user.first_name ?? "", FREE_TWEAK_COUNT, brand, c),
    text: accountWelcomeText(FREE_TWEAK_COUNT, brand, c),
  });
}

/**
 * Tells the account owner that the password changed.
 *
 * The reset flow proves control of the inbox before it will change anything,
 * so this is not a second authorization step — it is the only way the person
 * who owns the account finds out, if the change was not theirs. Sent from
 * both places that write a new password_hash (reset and change), so a third
 * way to change one cannot quietly ship without it.
 */
async function sendPasswordChangedNotice(userId: number, changedAt: Date, brand: EmailBrand, lang?: Locale): Promise<void> {
  const { rows } = await getPool().query("SELECT email, first_name, locale FROM users WHERE id = $1", [userId]);
  const user = rows[0];
  if (!user?.email) return;
  const c = copyFor(lang ?? user.locale);
  const when = formatMoment(c, changedAt);
  await sendMail({
    to: user.email,
    subject: passwordChangedSubject(brand, c),
    html: passwordChangedHtml(user.first_name ?? "", when, brand, c),
    text: passwordChangedText(when, brand, c),
  });
}

// ---------------------------------------------------------------- sign-in alerts

/** A PC the app identifies itself (a random id it keeps), or else the
 *  network and browser engine: coarse on purpose, so a dynamic address does
 *  not look like a new PC every day. Stored only as a keyed hash. */
function signInFingerprint(req: Request): string {
  const deviceId = req.body?.deviceId;
  let source: string;
  if (typeof deviceId === "string" && /^[A-Za-z0-9-]{16,64}$/.test(deviceId)) {
    source = `device:${deviceId}`;
  } else {
    const ip = (req.ip ?? "").replace(/^::ffff:/, "");
    const network = ip.includes(":") ? ip.split(":").slice(0, 3).join(":") : ip.split(".").slice(0, 2).join(".");
    const engine = /Edg\//.test(req.get("user-agent") ?? "") ? "edge" : "other";
    source = `network:${network}|${engine}`;
  }
  return crypto.createHmac("sha256", process.env.JWT_SECRET ?? "").update(source).digest("hex");
}

/** The computer name the app sent, made safe to print, or null. */
function deviceName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().slice(0, 64);
  return name && !/[\u0000-\u001f\u007f-\u009f<>]/.test(name) ? name : null;
}

/**
 * Records where an account signed in from and, the first time a new PC or
 * network appears on an account that already had one, tells the owner.
 * The first sign-in after this shipped only records: every existing account
 * would otherwise get an alert at once. At most one alert per six hours.
 */
// ponytail: rows are never pruned; add a cap per account if networks churn.
async function noticeSignIn(req: Request, user: { id: number; email: string; locale: string | null }): Promise<void> {
  const fingerprint = signInFingerprint(req);
  const db = getPool();
  const { rows } = await db.query("SELECT fingerprint, alerted, first_seen FROM sign_in_devices WHERE user_id = $1", [user.id]);
  if (rows.some((row) => row.fingerprint === fingerprint)) {
    await db.query("UPDATE sign_in_devices SET last_seen = now() WHERE user_id = $1 AND fingerprint = $2", [user.id, fingerprint]);
    return;
  }
  const recent = rows.some((row) => row.alerted && Date.now() - new Date(row.first_seen).getTime() < 6 * 60 * 60 * 1000);
  const alert = rows.length > 0 && !recent;
  await db.query(
    "INSERT INTO sign_in_devices (user_id, fingerprint, alerted) VALUES ($1, $2, $3) ON CONFLICT (user_id, fingerprint) DO NOTHING",
    [user.id, fingerprint, alert],
  );
  if (!alert) return;
  const c = copyFor(languageOf(req, user.locale));
  const mail = newSignInMail(user.email, deviceName(req.body?.deviceName), formatMoment(c, new Date()), brandOf(req.body?.product), c);
  await sendMail({ to: user.email, ...mail });
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
  // Each registration mails an address the caller chose. The per-email
  // limiter cannot stop one sender walking a list of victims; a global hourly
  // ceiling (far above real sign-ups) keeps our domain from becoming a relay.
  if (!consumeGlobalBudget("register", 120)) {
    return res.status(429).json({ error: "Too many sign-ups right now. Please try again later." });
  }

  const lang = languageOf(req);
  try {
    const pool = getPool();
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(409).json({ error: "an account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, locale) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, token_version",
      [email.toLowerCase(), passwordHash, String(firstName).trim(), String(lastName).trim(), dateOfBirth, lang],
    );
    const { id, token_version } = result.rows[0];
    const token = signToken(id, token_version);
    // The PC that registered is the account's first: it never triggers a
    // new-sign-in alert, and later ones are compared against it.
    await noticeSignIn(req, { id, email: email.toLowerCase(), locale: lang }).catch(() => undefined);

    let verificationEmailSent = false;
    try {
      verificationEmailSent = await sendVerificationEmail(id, email.toLowerCase(), brandOf(product), lang);
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
      "SELECT id, email, password_hash, token_version, locale FROM users WHERE email = $1",
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
    await rememberLanguage(req, user.id).catch(() => undefined);
    // Best-effort: an alert that cannot be sent must not block the sign-in.
    void noticeSignIn(req, user).catch((err) => console.error("sign-in notice failed:", err));
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
    const result = await getPool().query("SELECT email, email_verified, locale FROM users WHERE id = $1", [req.userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: "account not found" });
    if (result.rows[0].email_verified) return res.json({ ok: true, alreadyVerified: true });

    await rememberLanguage(req, req.userId as number);
    const delivered = await sendVerificationEmail(
      req.userId as number,
      result.rows[0].email,
      brandOf(req.body?.product),
      languageOf(req, result.rows[0].locale),
    );
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

/**
 * Changes the password of the signed-in account. The current password is
 * required: a session left open on someone else's PC must not be enough.
 * Every other session ends; this one gets a fresh token.
 */
router.post("/change-password", requireAuth, async (req: Request, res: Response) => {
  const { currentPassword, newPassword, product } = req.body || {};
  if (typeof currentPassword !== "string" || !isValidPassword(newPassword)) {
    return res.status(400).json({ error: "Password must be at least 8 characters and no more than 72 UTF-8 bytes." });
  }
  try {
    const { rows } = await getPool().query("SELECT password_hash FROM users WHERE id = $1", [req.userId]);
    if (!rows.length || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ error: "the current password is not correct" });
    }
    const passwordHash = await hashPassword(newPassword);
    const updated = await getPool().query(
      "UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING token_version",
      [passwordHash, req.userId],
    );
    await invalidatePasswordResets(req.userId as number);
    await rememberLanguage(req, req.userId as number);
    void sendPasswordChangedNotice(req.userId as number, new Date(), brandOf(product), isLocale(req.body?.locale) ? req.body.locale : undefined).catch(
      (err) => console.error("failed to send the password changed notice:", err),
    );
    res.json({ token: signToken(req.userId as number, updated.rows[0].token_version) });
  } catch (err) {
    console.error("change-password failed:", err);
    res.status(500).json({ error: "Could not change the password. Please try again." });
  }
});

/**
 * Starts moving the account to another address: the password is required,
 * and nothing changes until a link sent to the new address is confirmed.
 * The answer is the same whether or not that address is free, so this cannot
 * be used to find out which addresses have accounts.
 */
router.post("/change-email", requireAuth, async (req: Request, res: Response) => {
  const { password, newEmail, product } = req.body || {};
  if (!isValidEmail(newEmail) || typeof password !== "string") return res.status(400).json({ error: "invalid email" });
  const target = newEmail.toLowerCase();
  const generic = { ok: true, message: "If that address can be used, a confirmation link has been sent to it." };
  try {
    const { rows } = await getPool().query("SELECT email, password_hash, first_name, locale FROM users WHERE id = $1", [req.userId]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: "the current password is not correct" });
    }
    if (target === user.email) return res.status(400).json({ error: "that is already the address of this account" });
    const taken = await getPool().query("SELECT 1 FROM users WHERE email = $1", [target]);
    await rememberLanguage(req, req.userId as number);
    if (taken.rows.length || !consumeGlobalBudget("email-change-mail", 60)) return res.json(generic);
    const brand = brandOf(product);
    const lang = languageOf(req, user.locale);
    await invalidateActionTokens(req.userId as number, "email_change");
    const token = await createActionToken(req.userId as number, "email_change", DAY_MS, target);
    const link = `${API()}/api/auth/confirm-email-change?token=${token}${productQuery(brand)}&lang=${lang}`;
    const mail = emailChangeMail(user.first_name ?? "", link, brand, copyFor(lang));
    await sendMail({ to: target, ...mail });
    res.json(generic);
  } catch (err) {
    console.error("change-email failed:", err);
    res.status(500).json({ error: "Could not start the change. Please try again." });
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
export function htmlPage(title: string, bodyHtml: string, brand: EmailBrand = EMAIL_BRANDS.pctweaker, c: Copy = copyFor("en")): string {
  const initial = escapeHtml(brand.name.replace(/^PC Tweaker /, "").charAt(0));
  return `<!doctype html><html lang="${c.tag}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title} · ${escapeHtml(brand.name)}</title>
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
<footer>${escapeHtml(c.shell.family)} <a href="https://pctweaker.app/support">${escapeHtml(c.shell.support)}</a> · <a href="https://pctweaker.app/privacy">${escapeHtml(c.shell.privacy)}</a></footer>
</div></body></html>`;
}

router.get("/verify-email", async (req: Request, res: Response) => {
  const { token } = req.query;
  const brand = brandOf(req.query.product);
  const lang = languageOf(req);
  const c = copyFor(lang);
  const g = c.pages;
  const page = (title: string, body: string) => htmlPage(escapeHtml(title), body, brand, c);
  if (!isConfigured) return res.status(503).send(page(g.error, `<p class=error>${escapeHtml(g.unavailable)}</p>`));
  if (typeof token !== "string") return res.status(400).send(page(g.error, `<p class=error>${escapeHtml(g.missingToken)}</p>`));

  try {
    const userId = await consumeActionToken(token, "email_verify");
    if (!userId && (await confirmsVerifiedAddress(token))) {
      return res.send(page(g.verifiedTitle, `<p class=success>${escapeHtml(g.alreadyVerified(brand.name))}</p>`));
    }
    if (!userId) {
      return res.status(400).send(page(g.expiredTitle, `<p class=error>${escapeHtml(g.verifyExpired)}</p>`));
    }
    await getPool().query("UPDATE users SET email_verified = TRUE WHERE id = $1", [userId]);
    // The welcome waits until here rather than going out at registration,
    // where it would have arrived alongside the message asking the person to
    // confirm — two at once makes the one that needs acting on easier to
    // miss. Best-effort: a failed send must not make a confirmed address look
    // unconfirmed.
    void sendAccountWelcome(userId, brand, lang).catch((err) => console.error("failed to send the account welcome:", err));
    res.send(page(g.verifiedTitle, `<p class=success>${escapeHtml(g.verified(brand.name))}</p>`));
  } catch (err) {
    console.error("verify-email failed:", err);
    res.status(500).send(page(g.error, `<p class=error>${escapeHtml(g.failed)}</p>`));
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
    const result = await getPool().query("SELECT id, locale FROM users WHERE email = $1", [email.toLowerCase()]);
    // Same reasoning as registration: bound how much reset mail anyone can
    // trigger. The answer stays generic either way.
    if (result.rowCount && result.rowCount > 0 && consumeGlobalBudget("password-reset-mail", 120)) {
      const brand = brandOf(product);
      const userId = result.rows[0].id;
      const lang = languageOf(req, result.rows[0].locale);
      const c = copyFor(lang);
      const token = await createActionToken(userId, "password_reset", 60 * 60 * 1000);
      const link = `${API()}/api/auth/reset-password?token=${token}${productQuery(brand)}&lang=${lang}`;
      await sendMail({
        to: email.toLowerCase(),
        subject: passwordResetSubject(brand, c),
        html: passwordResetHtml(link, brand, c),
        text: passwordResetText(link, brand, c),
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
function resetForm(token: string, brand: EmailBrand, c: Copy, error?: string): string {
  const g = c.pages;
  const product = brand === EMAIL_BRANDS.uninstaller ? `<input type="hidden" name="product" value="uninstaller">` : "";
  return htmlPage(
    escapeHtml(g.resetTitle),
    `<p class="lead">${escapeHtml(g.resetLead)}</p>
     <form method="post" action="/api/auth/reset-password">
       <input type="hidden" name="token" value="${escapeHtml(token)}">${product}
       <input type="hidden" name="lang" value="${c.tag}">
       <label for="pw">${escapeHtml(g.newPassword)}</label>
       <input id="pw" type="password" name="newPassword" minlength="8" required autofocus
              autocomplete="new-password" placeholder="${escapeHtml(g.newPasswordPlaceholder)}" aria-describedby="password-limit">
       <p id="password-limit" class="hint">${escapeHtml(g.passwordHint)}</p>
       <label for="pw2">${escapeHtml(g.confirmPassword)}</label>
       <input id="pw2" type="password" name="confirmPassword" minlength="8" required
              autocomplete="new-password" placeholder="${escapeHtml(g.confirmPlaceholder)}">
       <button type="submit">${escapeHtml(g.update)}</button>
     </form>
     ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
     <p class="hint">${escapeHtml(g.resetHint)}</p>`,
    brand,
    c,
  );
}

router.get("/reset-password", (req: Request, res: Response) => {
  const { token } = req.query;
  const brand = brandOf(req.query.product);
  const c = copyFor(languageOf(req));
  if (typeof token !== "string" || token.length === 0) {
    return res
      .status(400)
      .send(htmlPage(escapeHtml(c.pages.notValidTitle), `<p class="lead">${escapeHtml(c.pages.notValidLead)}</p>`, brand, c));
  }
  res.send(resetForm(token, brand, c));
});

router.post("/reset-password", async (req: Request, res: Response) => {
  const { token, newPassword, confirmPassword, product } = req.body || {};
  const brand = brandOf(product);
  const lang = isLocale(req.body?.lang) ? req.body.lang : languageOf(req);
  const c = copyFor(lang);
  const g = c.pages;

  // The browser form posts url-encoded and expects HTML back; the desktop app
  // posts JSON and expects JSON. One handler serves both, deciding by whether
  // a confirm field came along (only the form sends one) and by Accept.
  const wantsHtml = typeof confirmPassword === "string" || (req.get("accept") || "").includes("text/html");
  const fail = (status: number, message: string, pageMessage = message) => {
    if (wantsHtml && typeof token === "string" && token.length > 0) {
      return res.status(status).send(resetForm(token, brand, c, pageMessage));
    }
    if (wantsHtml) {
      return res.status(status).send(htmlPage(escapeHtml(g.notValidTitle), `<p class="error">${escapeHtml(pageMessage)}</p>`, brand, c));
    }
    return res.status(status).json({ error: message });
  };

  if (typeof token !== "string" || token.length === 0) return fail(400, "missing token", g.notValidLead);
  if (!isValidPassword(newPassword)) return fail(400, "Password must be at least 8 characters and no more than 72 UTF-8 bytes.", g.passwordRule);
  // Only enforced for the form, which is the only caller that collects it.
  if (typeof confirmPassword === "string" && confirmPassword !== newPassword) {
    return fail(400, "The two passwords don't match.", g.mismatch);
  }
  if (!isConfigured) return fail(503, "database not configured (DATABASE_URL missing)", g.unavailable);

  try {
    const userId = await consumeActionToken(token, "password_reset");
    if (!userId) {
      return fail(400, "This reset link is invalid, already used, or has expired.", g.resetInvalid);
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
    void sendPasswordChangedNotice(userId, new Date(), brand, lang).catch((err) =>
      console.error("failed to send the password changed notice:", err),
    );

    if (wantsHtml) {
      return res.send(
        htmlPage(
          escapeHtml(g.updatedTitle),
          `<p class="success">${escapeHtml(g.updated(brand.name))}</p>
           <p class="hint">${escapeHtml(g.closeHint)}</p>`,
          brand,
          c,
        ),
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("reset-password failed:", err);
    return fail(500, "Could not reset the password. Please try again.", g.resetFailed);
  }
});

/**
 * The page behind the link sent to a new address. Opening it changes
 * nothing: mail scanners open links before people do, and an address typed
 * by mistake must not receive the account because a scanner followed the
 * link. The move happens on the button.
 */
router.get("/confirm-email-change", async (req: Request, res: Response) => {
  const brand = brandOf(req.query.product);
  const c = copyFor(languageOf(req));
  const g = c.pages;
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const pending = token ? await peekEmailChange(token).catch(() => null) : null;
  if (!pending) {
    return res.status(400).send(htmlPage(escapeHtml(g.notValidTitle), `<p class="error">${escapeHtml(g.emailChangeInvalid)}</p>`, brand, c));
  }
  const product = brand === EMAIL_BRANDS.uninstaller ? `<input type="hidden" name="product" value="uninstaller">` : "";
  res.send(
    htmlPage(
      escapeHtml(c.emailChange.eyebrow),
      `<p class="lead">${escapeHtml(c.emailChange.intro)}</p>
       <p class="lead"><strong>${escapeHtml(pending.email)}</strong></p>
       <form method="post" action="/api/auth/confirm-email-change">
         <input type="hidden" name="token" value="${escapeHtml(token)}">${product}
         <input type="hidden" name="lang" value="${c.tag}">
         <button type="submit">${escapeHtml(c.emailChange.button)}</button>
       </form>`,
      brand,
      c,
    ),
  );
});

router.post("/confirm-email-change", async (req: Request, res: Response) => {
  const brand = brandOf(req.body?.product);
  const lang = isLocale(req.body?.lang) ? req.body.lang : languageOf(req);
  const c = copyFor(lang);
  const g = c.pages;
  const page = (title: string, body: string, status = 200) => res.status(status).send(htmlPage(escapeHtml(title), body, brand, c));
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  try {
    const change = token ? await consumeEmailChange(token) : null;
    if (!change) return page(g.notValidTitle, `<p class="error">${escapeHtml(g.emailChangeInvalid)}</p>`, 400);
    const before = await getPool().query("SELECT email, first_name, locale FROM users WHERE id = $1", [change.userId]);
    const previous = before.rows[0];
    if (!previous) return page(g.notValidTitle, `<p class="error">${escapeHtml(g.emailChangeInvalid)}</p>`, 400);
    try {
      // The unique index decides a race with a registration for the same
      // address. Every session ends: the old address no longer signs in.
      await getPool().query(
        "UPDATE users SET email = $1, email_verified = TRUE, token_version = token_version + 1 WHERE id = $2",
        [change.email, change.userId],
      );
    } catch (err: any) {
      if (err?.code === "23505") return page(g.error, `<p class="error">${escapeHtml(g.emailTaken)}</p>`, 409);
      throw err;
    }
    await invalidatePasswordResets(change.userId);
    await invalidateActionTokens(change.userId, "email_change");
    const cOld = copyFor(previous.locale ?? lang);
    const notice = emailChangedNotice(previous.first_name ?? "", change.email, formatMoment(cOld, new Date()), brand, cOld);
    void sendMail({ to: previous.email, ...notice }).catch((err) => console.error("failed to send the email changed notice:", err));
    page(g.emailChangedTitle, `<p class="success">${escapeHtml(g.emailChanged(brand.name, change.email))}</p><p class="hint">${escapeHtml(g.closeHint)}</p>`);
  } catch (err) {
    console.error("confirm-email-change failed:", err);
    page(g.error, `<p class="error">${escapeHtml(g.failed)}</p>`, 500);
  }
});

export default router;
