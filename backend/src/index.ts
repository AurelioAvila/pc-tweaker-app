import "dotenv/config";

import fs from "fs";
import path from "path";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { getPool, initSchema, isConfigured } from "./db";
import { isConfigured as mailIsConfigured } from "./mailer";
import authRoutes from "./routes/auth";
import accountRoutes from "./routes/account";
import licenseRoutes from "./routes/license";
import reviewRoutes from "./routes/reviews";
import entitlementsRoutes from "./routes/entitlements";
import errorReportRoutes from "./routes/error-reports";
import newsletterRoutes from "./routes/newsletter";
import supportRoutes from "./routes/support";
import offerRoutes from "./routes/offers";
import { router as stripeRoutes, webhookHandler, deliverProReceipt } from "./routes/stripe";
import { startReceiptWorker } from "./receipt-outbox";

const app = express();

// Railway (like Heroku) puts the app behind a reverse proxy that sets
// X-Forwarded-For. Without this, express-rate-limit v7 throws at request
// time instead of silently misbehaving — which would otherwise take down
// /api/auth/register and /api/auth/login as soon as this is deployed there.
app.set("trust proxy", 1);

app.use(helmet());

// helmet() does not set Cache-Control (its noCache() option was dropped in
// v4+), so every /api response was leaving that decision to whatever sits
// in front — including endpoints returning account, entitlement, and signed
// license data. Scoped to /api so the static marketing/legal pages served
// below keep their own caching behavior.
app.use("/api", (_req: Request, res: Response, next: express.NextFunction) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// A generous service-wide ceiling protects every route, including cheap
// reads and static legal pages that do not warrant a dedicated limiter.
// Sensitive write endpoints keep their stricter route-specific limits.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1_200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
}));

// Allow-list the origins our own clients run from instead of falling back to
// "any origin". No cookies are involved — auth is a bearer header — so a
// wide-open CORS was never exploitable for session theft, but there is no
// reason to let arbitrary websites read API responses either.
//
// These are the first-party origins: Tauri's webview origin on each platform,
// the two dev servers, and the marketing site, whose review and support forms
// post here from the browser.
const firstPartyOrigins = [
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
  "http://localhost:1420",
  "http://localhost:5173",
  "https://pctweaker.app",
  "https://www.pctweaker.app",
];

// CORS_ORIGINS *adds* to that list rather than replacing it. It used to
// replace it, which turned a deploy-time env var into a silent kill switch
// for first-party clients: CORS_ORIGINS was set on Railway before the site
// had any API calls, so when the review and support forms shipped the browser
// blocked them with an opaque network error and nothing in the logs. An env
// var should let an operator allow something extra (a staging domain, a
// preview deploy) — it should not be able to lock our own site out of our own
// API by omission.
const extraOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const allowedOrigins = [...new Set([...firstPartyOrigins, ...extraOrigins])];
app.use(cors({ origin: allowedOrigins }));

// Stripe needs the raw, unparsed body to verify the webhook signature, so
// this route is registered before the global express.json() middleware.
app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), webhookHandler);

app.use(express.json());
// The password-reset page is a plain HTML form posting back to this server:
// helmet's CSP is `script-src 'self'`, so an inline script to serialize it
// into JSON would never run. Without this the form body arrives empty.
app.use(express.urlencoded({ extended: false }));

// Liveness only: "this process is up and answering". Whether the database
// is wired is real operational detail, and /ready below already proves it by
// running a query — reporting it here as well told any anonymous visitor
// something about the infrastructure while telling an operator nothing they
// could not get from the endpoint built for the purpose.
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Railway uses this endpoint as a deploy readiness gate. Liveness stays
// intentionally cheap at /health; readiness proves the service can actually
// reach PostgreSQL before a new deployment receives production traffic.
app.get("/ready", async (_req: Request, res: Response) => {
  if (!isConfigured) {
    res.status(503).json({ ok: false, database: "not configured" });
    return;
  }
  try {
    await getPool().query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    console.error("readiness database check failed:", err);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

// Keep existing asset URLs available to integrations and older links.
app.use(express.static(path.join(__dirname, "..", "public")));

// Consolidate the retired marketing page into the official website. Match
// only GET/HEAD /; callbacks, legal pages and API routes stay on this service.
// Do not forward query parameters: they may contain OAuth or other secrets.
app.get("/", (_req: Request, res: Response) => {
  res.redirect(301, "https://pctweaker.app/");
});

// Callback page for TikTok's OAuth login (used once, locally, by
// marketing/tiktok-upload/get-token.js to obtain a refresh token) - it shows
// the "code" on screen so it can be copied by hand into the terminal. TikTok
// does not accept localhost redirect URIs, a real HTTPS domain is required -
// same scheme already used for getcertsprint.com.
app.get("/tiktok-callback", (_req: Request, res: Response) => {
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function serveMarkdownAsHtml(routePath: string, mdFilePath: string, title: string): void {
  app.get(routePath, (_req: Request, res: Response) => {
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

// Terms of Service / Privacy Policy - copies kept in backend/legal/ (not the
// repo-root ones) because Railway's deploy root is /backend, so anything
// outside this folder never reaches the running server. Keep these two in
// sync with the root TERMS.md/PRIVACY.md if those are ever edited. Needed as
// real, our-own-domain URLs for the TikTok developer app review (github.com
// URLs can't be domain-verified since we don't control that domain).
serveMarkdownAsHtml("/terms", path.join(__dirname, "..", "legal", "TERMS.md"), "PC Tweaker - Terms of Service");
serveMarkdownAsHtml("/privacy", path.join(__dirname, "..", "legal", "PRIVACY.md"), "PC Tweaker - Privacy Policy");

/**
 * Stripe Checkout's success_url/cancel_url — the desktop app opens Checkout
 * in the system browser (Stripe Checkout can't run inside the app's webview,
 * see routes/stripe.ts), so this is where that browser tab lands afterward.
 *
 * These used to both point at the GitHub repo — a redirect that "worked"
 * (valid URL, no error) but left a paying customer looking at source code
 * with no confirmation their payment went through, and no way to tell a
 * completed purchase apart from a cancelled one. Pro status itself is
 * granted by the Stripe webhook independently of this page, so a closed tab
 * here never blocks entitlement — this is purely the human-facing receipt.
 */
function checkoutResultPage(kind: "success" | "cancel"): string {
  const isSuccess = kind === "success";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${isSuccess ? "You're Pro" : "Checkout cancelled"} — PC Tweaker</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<style>
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    background:#0a0912; color:#e7e4f0; line-height:1.6; }
  .card { width:100%; max-width:440px; text-align:center; background:#12101d;
    border:1px solid #232032; border-radius:16px; padding:40px 32px; }
  .badge { width:56px; height:56px; margin:0 auto 20px; border-radius:16px; display:grid; place-items:center;
    font-size:28px; background:${isSuccess ? "linear-gradient(135deg,#8b5cf6,#d946ef)" : "#232032"}; }
  h1 { font-size:22px; margin:0 0 10px; }
  p { color:#b7b3c9; font-size:14.5px; margin:0 0 24px; }
</style>
</head>
<body>
<div class="card">
  <div class="badge">${isSuccess ? "&#10003;" : "&#10005;"}</div>
  <h1>${isSuccess ? "Payment successful" : "Checkout cancelled"}</h1>
  <p>${
    isSuccess
      ? "Your Pro tweaks and presets are unlocked. Switch back to PC Tweaker — the app picks up your new plan automatically the next time it checks your license."
      : "No charge was made. You can restart checkout from the app whenever you're ready."
  }</p>
  <p style="color:#8b87a0; font-size:13px; margin:0;">You can close this tab.</p>
</div>
</body>
</html>`;
}

app.get("/checkout-success", (_req: Request, res: Response) => {
  res.type("html").send(checkoutResultPage("success"));
});
app.get("/checkout-cancel", (_req: Request, res: Response) => {
  res.type("html").send(checkoutResultPage("cancel"));
});

// TikTok Developer Portal domain/URL-prefix verification file (one-off,
// content dictated by TikTok when verifying app_basic_info URLs - safe to
// leave in place afterward, it's just a static token file).
app.get("/tiktokpEKDQseFFOg1tBMQ9QvfIZ64fDNQkDLt.txt", (_req: Request, res: Response) => {
  res.type("text/plain").send("tiktok-developers-site-verification=pEKDQseFFOg1tBMQ9QvfIZ64fDNQkDLt");
});
// TikTok issues a fresh token each time verification is (re)requested - the
// old one above becomes stale but is left in place (harmless) rather than
// removed, in case of another retry cycle.
app.get("/tiktokHeKend3CcpkNmGCjEs2zET0AjYqOWn71.txt", (_req: Request, res: Response) => {
  res.type("text/plain").send("tiktok-developers-site-verification=HeKend3CcpkNmGCjEs2zET0AjYqOWn71");
});

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/license", licenseRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/entitlements", entitlementsRoutes);
app.use("/api/error-reports", errorReportRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api", stripeRoutes);

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error("unhandled error:", err);
  res.status(500).json({ error: "internal server error" });
});

/**
 * Last-resort backstop for a promise that rejected outside any route.
 *
 * Route handlers go through `asyncRoute`, which hands rejections to the
 * middleware above — but fire-and-forget work does not: the `void sendMail(...)`
 * notifications, and anything a future edit adds in the same shape. Node's
 * default for an unhandled rejection is to kill the process, which would take
 * logins and Stripe webhooks down because a notification email failed to send.
 *
 * Logging and staying up is the right trade for a single-instance API: a
 * failed side effect should degrade one feature, not the whole service. It is
 * deliberately loud so these show up in the deploy log rather than being
 * quietly absorbed.
 */
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION (process kept alive):", reason);
});

const port = process.env.PORT || 3000;

/**
 * Railway restarts a container by sending SIGTERM and waiting a short grace
 * period before SIGKILL. Without a handler, Node's default is to exit the
 * moment the signal arrives: every request still in flight is cut mid-write,
 * which on a deploy means the unlucky few get a connection reset instead of
 * an answer — including a Stripe webhook, which would then be retried.
 *
 * So: stop accepting new connections, let the ones already running finish,
 * release the database pool, exit cleanly. The timeout exists because a
 * wedged connection must not hold the deploy open forever — at that point a
 * hard exit is the better outcome, and it is logged as such rather than
 * looking like a clean shutdown.
 */
const SHUTDOWN_GRACE_MS = 10_000;
let shuttingDown = false;
let stopReceiptWorker = () => {};

function shutdown(signal: string, server: import("http").Server): void {
  if (shuttingDown) return; // a second SIGTERM must not restart the sequence
  shuttingDown = true;
  stopReceiptWorker();
  console.log(`${signal} received: refusing new connections, draining in-flight requests`);

  const forceExit = setTimeout(() => {
    console.error(`shutdown timed out after ${SHUTDOWN_GRACE_MS}ms: exiting anyway`);
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  // Do not let the timer itself keep the process alive once draining is done.
  forceExit.unref();

  server.close(async (err) => {
    if (err) console.error("error while closing the HTTP server:", err);
    try {
      if (isConfigured) await getPool().end();
    } catch (poolErr) {
      console.error("error while closing the database pool:", poolErr);
    }
    clearTimeout(forceExit);
    console.log("shutdown complete");
    process.exit(0);
  });
}

initSchema()
  .catch((err) => {
    console.error("failed to initialize database schema:", err);
  })
  .finally(() => {
    if (isConfigured) stopReceiptWorker = startReceiptWorker(deliverProReceipt);
    const server = app.listen(port, () => {
      console.log(
        `pc-tweaker-backend listening on :${port} (database ${isConfigured ? "configured" : "NOT configured"}, email ${mailIsConfigured ? "configured" : "NOT configured"})`,
      );
      if (!mailIsConfigured) {
        // Worth shouting about: without a provider, nobody can verify an
        // address or recover a forgotten password, and the only symptom is
        // silence. Better to find this in the deploy log than in a support
        // email from a customer already locked out.
        console.warn(
          "WARNING: no email provider configured (set RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS). Email verification and password reset will not work.",
        );
      }
    });

    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      process.on(signal, () => shutdown(signal, server));
    }
  });
