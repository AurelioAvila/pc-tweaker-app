import "dotenv/config";

import fs from "fs";
import path from "path";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";

import { initSchema, isConfigured } from "./db";
import authRoutes from "./routes/auth";
import accountRoutes from "./routes/account";
import { router as stripeRoutes, webhookHandler } from "./routes/stripe";

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

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, databaseConfigured: isConfigured });
});

// Resolves the latest GitHub release's Windows installer (.exe) so the
// landing page can offer a single one-click download button instead of
// sending people to the GitHub Releases page to pick between the .exe and
// the .msi themselves. Cached in memory for a few minutes: GitHub's
// unauthenticated API is rate-limited to 60 req/hour, which a few concurrent
// visitors could otherwise burn through in minutes.
const GITHUB_REPO = "AurelioAvila/pc-tweaker-app";
const RELEASE_CACHE_TTL_MS = 10 * 60 * 1000;

type ReleaseCache = { checkedAt: number; downloadUrl: string | null; version: string | null };
let releaseCache: ReleaseCache = { checkedAt: 0, downloadUrl: null, version: null };

async function latestWindowsInstaller(): Promise<ReleaseCache> {
  if (Date.now() - releaseCache.checkedAt < RELEASE_CACHE_TTL_MS) {
    return releaseCache;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "pc-tweaker-backend" },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const release = (await res.json()) as {
      assets?: { name: string; browser_download_url: string }[];
      tag_name?: string;
    };
    const asset = (release.assets || []).find((a) => a.name.endsWith("-setup.exe"));
    releaseCache = {
      checkedAt: Date.now(),
      downloadUrl: asset?.browser_download_url || null,
      version: release.tag_name || null,
    };
  } catch (err: any) {
    console.error("failed to resolve latest release:", err.message);
    // Keep serving the previous good value (if any) rather than clearing it,
    // so a transient GitHub API hiccup doesn't take the download button down.
    releaseCache = { ...releaseCache, checkedAt: Date.now() };
  }
  return releaseCache;
}

// Landing page for the TikTok app review's "Website URL" field - there was
// no route at all here before, so hitting the root just 404'd ("Cannot GET
// /"), which is what got the app flagged with "Website error". This backend
// is API-only (Railway), there's no separate marketing site, so serve a
// minimal real page describing the app instead of leaving the root empty.
app.get("/", async (_req: Request, res: Response) => {
  const { downloadUrl, version } = await latestWindowsInstaller();
  const releasesUrl = `https://github.com/${GITHUB_REPO}/releases/latest`;
  const primaryHref = downloadUrl || releasesUrl;

  res.type("html").send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>PC Tweaker</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: sans-serif; max-width: 700px; margin: 60px auto; padding: 0 20px; line-height: 1.6; color: #222;">
<h1>PC Tweaker</h1>
<p>A desktop app for Windows that applies system tweaks — performance,
privacy, gaming, and maintenance — with automatic rollback: every change
saves the original value before it's applied, so you can always revert it
with one click.</p>
<p>
<a href="${primaryHref}" style="display: inline-block; background: #4f46e5; color: #fff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 8px;">&#8681; Download for Windows${version ? ` (${version})` : ""}</a>
</p>
<p style="color: #666; font-size: 14px;">Windows 10/11, 64-bit. Free, with an optional Pro upgrade inside the app.</p>
<p>
<a href="${releasesUrl}">All releases &amp; release notes</a><br>
<a href="https://github.com/AurelioAvila/pc-tweaker-app#readme">Source &amp; documentation</a><br>
<a href="/terms">Terms of Service</a><br>
<a href="/privacy">Privacy Policy</a>
</p>
</body>
</html>`);
});

// Pagina di callback per il login OAuth di TikTok (usata solo una volta in
// locale da marketing/tiktok-upload/get-token.js per ottenere un refresh
// token) - mostra il "code" a schermo cosi' l'utente puo' copiarlo a mano nel
// terminale. TikTok non accetta redirect URI su localhost, serve un dominio
// HTTPS reale - stesso schema gia' usato per getcertsprint.com.
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
app.use("/api", stripeRoutes);

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
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
