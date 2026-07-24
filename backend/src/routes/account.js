const express = require("express");
const { pool, isConfigured } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  if (!isConfigured) {
    return res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
  }
  try {
    const result = await pool.query("SELECT email, is_pro FROM users WHERE id = $1", [req.userId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "account not found" });
    }
    const { email, is_pro } = result.rows[0];
    res.json({ email, isPro: is_pro });
  } catch (err) {
    console.error("account lookup failed:", err);
    res.status(500).json({ error: "account lookup failed" });
  }
});

module.exports = router;
