const express = require("express");
const rateLimit = require("express-rate-limit");
const { pool, isConfigured } = require("../db");
const { hashPassword, verifyPassword, signToken, isValidEmail, isValidPassword } = require("../auth");

const router = express.Router();

// Slows down credential-stuffing / brute-force attempts against these two
// endpoints specifically, without throttling the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(authLimiter);

router.post("/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "invalid email" });
  if (!isValidPassword(password)) return res.status(400).json({ error: "password must be at least 8 characters" });
  if (!isConfigured) return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "an account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
      [email.toLowerCase(), passwordHash],
    );
    const token = signToken(result.rows[0].id);
    res.status(201).json({ token });
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
    const result = await pool.query("SELECT id, password_hash FROM users WHERE email = $1", [email.toLowerCase()]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: "invalid email or password" });
    }
    const user = result.rows[0];
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "invalid email or password" });
    }
    const token = signToken(user.id);
    res.json({ token });
  } catch (err) {
    console.error("login failed:", err);
    res.status(500).json({ error: "login failed" });
  }
});

module.exports = router;
