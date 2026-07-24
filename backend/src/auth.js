const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, isConfigured } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "30d";

function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/** `tokenVersion` must match the user's current `token_version` in the
 * database — bumping that column (on password reset or "log out everywhere")
 * invalidates every token issued before the bump, even though JWTs are
 * otherwise stateless and can't normally be revoked before they expire. */
function signToken(userId, tokenVersion) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured on the server");
  }
  return jwt.sign({ sub: userId, tv: tokenVersion }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/** Express middleware: requires a valid, non-revoked `Authorization: Bearer <token>` header. */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "missing bearer token" });
  }
  if (!JWT_SECRET) {
    return res.status(500).json({ error: "server auth is not configured (JWT_SECRET missing)" });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }

  if (!isConfigured) {
    // Can't check for revocation without a database — fail closed rather
    // than trusting a token we're unable to verify hasn't been revoked.
    return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
  }

  try {
    const result = await pool.query("SELECT token_version FROM users WHERE id = $1", [payload.sub]);
    if (result.rowCount === 0 || result.rows[0].token_version !== payload.tv) {
      return res.status(401).json({ error: "invalid or expired token" });
    }
  } catch (err) {
    console.error("token revocation check failed:", err);
    return res.status(500).json({ error: "auth check failed" });
  }

  req.userId = payload.sub;
  next();
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

module.exports = { hashPassword, verifyPassword, signToken, requireAuth, isValidEmail, isValidPassword };
