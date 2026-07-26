require("dotenv").config();

const fs = require("fs");
const path = require("path");
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

// Pagina di callback per il login OAuth di TikTok (usata solo una volta in
// locale da marketing/tiktok-upload/get-token.js per ottenere un refresh
// token) - mostra il "code" a schermo cosi' l'utente puo' copiarlo a mano nel
// terminale. TikTok non accetta redirect URI su localhost, serve un dominio
// HTTPS reale - stesso schema gia' usato per getcertsprint.com.
app.get("/tiktok-callback", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html>
<head><title>TikTok callback</title></head>
<body style="font-family: monospace; padding: 40px;">
  <h2>Copy the "code" value below and paste it into the terminal:</h2>
  <p id="code" style="font-size: 18px; word-break: break-all; background:#eee; padding:12px;"></p>
  <script>
    const params = new URLSearchParams(window.location.search);
    document.getElementById("code").textContent = params.get("code") || "(no code found in URL)";
  </script>
</body>
</html>`);
});

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function serveMarkdownAsHtml(routePath, mdFilePath, title) {
  app.get(routePath, (_req, res) => {
    const md = fs.readFileSync(mdFilePath, "utf8");
    res.type("html").send(`<!DOCTYPE html>
<html>
<head><title>${title}</title></head>
<body style="font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6;">
<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(md)}</pre>
</body>
</html>`);
  });
}

// Terms of Service / Privacy Policy, served from the source-of-truth
// markdown files at the repo root - needed as real, our-own-domain URLs for
// the TikTok developer app review (github.com URLs can't be domain-verified
// since we don't control that domain).
serveMarkdownAsHtml("/terms", path.join(__dirname, "..", "..", "TERMS.md"), "PC Tweaker - Terms of Service");
serveMarkdownAsHtml("/privacy", path.join(__dirname, "..", "..", "PRIVACY.md"), "PC Tweaker - Privacy Policy");

// TikTok Developer Portal domain/URL-prefix verification file (one-off,
// content dictated by TikTok when verifying app_basic_info URLs - safe to
// leave in place afterward, it's just a static token file).
app.get("/tiktokpEKDQseFFOg1tBMQ9QvfIZ64fDNQkDLt.txt", (_req, res) => {
  res.type("text/plain").send("tiktok-developers-site-verification=pEKDQseFFOg1tBMQ9QvfIZ64fDNQkDLt");
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
