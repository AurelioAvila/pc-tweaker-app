const express = require("express");
const Stripe = require("stripe");
const { pool, isConfigured } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

function requireStripe(req, res, next) {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured (STRIPE_SECRET_KEY missing)" });
  }
  next();
}

// Creates a one-time Checkout Session for the logged-in user. The desktop
// app should open the returned URL in the system browser (Stripe Checkout
// can't run inside the app's webview) via @tauri-apps/plugin-opener.
router.post("/checkout", requireAuth, requireStripe, async (req, res) => {
  if (!process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: "STRIPE_PRICE_ID is not configured" });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: process.env.CHECKOUT_SUCCESS_URL || "https://example.com/checkout-success",
      cancel_url: process.env.CHECKOUT_CANCEL_URL || "https://example.com/checkout-cancel",
      client_reference_id: String(req.userId),
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("checkout session creation failed:", err);
    res.status(500).json({ error: "could not start checkout" });
  }
});

// Mounted with express.raw() in index.js — Stripe's signature check needs
// the exact raw request body, not the JSON-parsed one.
async function webhookHandler(req, res) {
  if (!stripe) {
    return res.status(503).send("Stripe is not configured");
  }
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(503).send("STRIPE_WEBHOOK_SECRET is not configured");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error("webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;
    if (userId && isConfigured) {
      try {
        await pool.query("UPDATE users SET is_pro = TRUE WHERE id = $1", [userId]);
      } catch (err) {
        console.error("failed to mark user as pro after payment:", err);
      }
    }
  }

  res.json({ received: true });
}

module.exports = { router, webhookHandler };
