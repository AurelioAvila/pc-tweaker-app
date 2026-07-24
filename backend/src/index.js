require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { initSchema, isConfigured } = require("./db");
const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/account");
const { router: stripeRoutes, webhookHandler } = require("./routes/stripe");

const app = express();

// Railway (like Heroku) puts the app behind a reverse proxy that sets
// X-Forwarded-For. Without this, express-rate-limit v7 throws at request
// time instead of silently misbehaving — which would otherwise take down
// /api/auth/register and /api/auth/login as soon as this is deployed there.
app.set("trust proxy", 1);

app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  }),
);

// Stripe needs the raw, unparsed body to verify the webhook signature, so
// this route is registered before the global express.json() middleware.
app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), webhookHandler);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, databaseConfigured: isConfigured });
});

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api", stripeRoutes);

app.use((err, _req, res, _next) => {
  console.error("unhandled error:", err);
  res.status(500).json({ error: "internal server error" });
});

const port = process.env.PORT || 3000;

initSchema()
  .catch((err) => {
    console.error("failed to initialize database schema:", err);
  })
  .finally(() => {
    app.listen(port, () => {
      console.log(`pc-tweaker-backend listening on :${port} (database ${isConfigured ? "configured" : "NOT configured"})`);
    });
  });
