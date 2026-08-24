import "dotenv/config";

import fs from "fs";
import path from "path";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";

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
import { router as stripeRoutes, webhookHandler } from "./routes/stripe";

const app = express();

// Railway (like Heroku) puts the app behind a reverse proxy that sets
// X-Forwarded-For. Without this, express-rate-limit v7 throws at request
// time instead of silently misbehaving — which would otherwise take down
// /api/auth/register and /api/auth/login as soon as this is deployed there.
app.set("trust proxy", 1);

app.use(helmet());

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

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, databaseConfigured: isConfigured });
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

// Screenshots/icon for the landing page below (2026-08-05). CSP (helmet
// defaults, verified live: "img-src 'self' data:") only allows same-origin
// images, so these have to be served from this app instead of embedded as
// external URLs or base64 (which would have bloated the route file).
app.use(express.static(path.join(__dirname, "..", "public")));

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

// Landing page for the TikTok app review's "Website URL" field.
//
// V1 (2026-08-04) was a bare single-paragraph page - it got the *first*
// review pass, but TikTok rejected the app again on 2026-08-05 for the
// website itself: "must be fully developed and cannot be a landing or login
// page." Compared side by side with getcertsprint.com (never once flagged
// on the website field across 2 TikTok reviews): that site has nav, a
// features section, screenshots, pricing and a footer - this one had a
// title, a paragraph and a button. This version closes that gap with real
// content only (everything below is pulled from README.md/CHANGELOG.md,
// nothing invented): the actual 5-category tweak table, the real Free/Pro
// pricing, the real safety guarantees. Screenshots are the real app UI,
// cropped to cut the sidebar (it showed the developer's own account email
// in the Pro badge - not something to publish on a public marketing page).
//
// Still same-file inline HTML (no template engine in this Express app) and
// still zero <script> tags / inline event handlers - confirmed live via
// `curl -I` that helmet's CSP here is "script-src 'self'; script-src-attr
// 'none'", so any inline script would just silently fail to run.
app.get("/", async (_req: Request, res: Response) => {
  const { downloadUrl, version } = await latestWindowsInstaller();
  const releasesUrl = `https://github.com/${GITHUB_REPO}/releases/latest`;
  const primaryHref = downloadUrl || releasesUrl;
  const versionLabel = version ? ` ${version}` : "";

  const features: { title: string; items: string[] }[] = [
    {
      title: "Performance",
      items: [
        "Optimize CPU priority for background services",
        "High-performance power plan",
        "Disable Xbox Game Bar / Game DVR",
        "Remove the ~10s startup-app delay",
        "Instant menu response",
        "Disable CPU power throttling",
      ],
    },
    {
      title: "Gaming",
      items: [
        "Hardware-accelerated GPU scheduling (HAGS)",
        "Reduced mouse and keyboard input lag",
        "CPU Turbo Boost",
        "Higher GPU priority for games",
        "\"Turbo Gaming\" one-tap preset",
        "Game Sessions - auto-applies the preset when a game launches, reverts when it closes",
      ],
    },
    {
      title: "Privacy",
      items: [
        "Disable advertising ID and location tracking",
        "Disable tailored experiences, activity history, app-launch tracking",
        "Reduced telemetry",
        "Private DNS (Cloudflare)",
        "Password breach check via Have I Been Pwned (k-anonymity, only a hash fragment is ever sent)",
      ],
    },
    {
      title: "Maintenance",
      items: [
        "Clean temp files and the Windows Update cache",
        "Files go to the Recycle Bin - nothing is permanently deleted",
        "Duplicate file finder by content hash, with manual review before deletion",
        "Disable the search indexing service",
      ],
    },
    {
      title: "Interface",
      items: [
        "Dark mode, 10 color themes",
        "Show hidden files and file extensions",
        "Left-aligned taskbar",
        "Hide Chat / Widgets / search box",
        "Disable transparency effects",
      ],
    },
  ];

  const featuresHtml = features
    .map(
      (section) => `
      <div style="background:#12101d;border:1px solid #232032;border-radius:14px;padding:24px;">
        <h3 style="margin:0 0 14px;font-size:17px;color:#c9b6ff;">${section.title}</h3>
        <ul style="margin:0;padding-left:18px;color:#b7b3c9;font-size:14px;line-height:1.7;">
          ${section.items.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>`,
    )
    .join("");

  const screenshots = [
    { file: "image.webp", alt: "Scan screen: live CPU, memory and disk usage, one-click optimization scan" },
    { file: "image3.webp", alt: "Performance tweaks: CPU priority, Game Bar, power plan, each individually toggled" },
    { file: "image4.webp", alt: "Gaming tab: Turbo Boost preset and Game Sessions, auto-applied per game" },
    { file: "image2.webp", alt: "Privacy tab: password breach check, advertising ID, location tracking" },
  ];
  const screenshotsHtml = screenshots
    .map(
      (s) => `<img src="/screenshots/${s.file}" alt="${s.alt}" loading="lazy" style="width:100%;height:auto;display:block;border-radius:12px;border:1px solid #232032;">`,
    )
    .join("");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PC Tweaker — Windows optimization with one-click rollback</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="PC Tweaker applies real Windows performance, gaming, privacy and maintenance tweaks — every change is snapshotted first, so it's always reversible with one click.">
<link rel="icon" type="image/png" href="/favicon.png">
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background:#0a0912; color:#e7e4f0; line-height:1.6; }
  a { color: inherit; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
  nav.wrap { display:flex; align-items:center; justify-content:space-between; padding-top:22px; padding-bottom:22px; }
  nav a.navlink { color:#b7b3c9; text-decoration:none; font-size:14px; margin-left:28px; }
  nav a.navlink:hover { color:#fff; }
  .brand { display:flex; align-items:center; gap:10px; font-weight:700; font-size:17px; }
  .brand img { width:28px; height:28px; border-radius:7px; }
  .btn-primary { display:inline-block; background:linear-gradient(135deg,#8b5cf6,#d946ef); color:#fff; text-decoration:none; font-weight:600; padding:14px 30px; border-radius:10px; }
  section { padding: 56px 0; }
  h1 { font-size: 42px; line-height:1.15; margin: 0 0 18px; }
  h2 { font-size: 26px; margin: 0 0 8px; }
  .eyebrow { color:#c084fc; font-weight:700; letter-spacing:0.08em; font-size:12px; text-transform:uppercase; }
  .sub { color:#b7b3c9; font-size:17px; max-width: 640px; }
  .grid5 { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:16px; margin-top:28px; }
  .grid2 { display:grid; grid-template-columns: repeat(auto-fit, minmax(280px,1fr)); gap:16px; margin-top:28px; }
  .shots { display:grid; grid-template-columns: repeat(2, 1fr); gap:16px; margin-top:28px; }
  @media (max-width: 640px) { .shots { grid-template-columns: 1fr; } h1 { font-size:32px; } nav a.navlink { margin-left:16px; font-size:13px; } }
  .pill { display:inline-block; background:#1c1830; color:#c9b6ff; border-radius:999px; padding:4px 12px; font-size:12px; margin-right:8px; }
  .price-card { background:#12101d; border:1px solid #232032; border-radius:16px; padding:28px; }
  .price-card.pro { border-color:#7c3aed; }
  .price { font-size:32px; font-weight:800; margin: 10px 0; }
  footer { border-top:1px solid #232032; padding: 32px 0 48px; color:#8b87a0; font-size:14px; }
  footer a { text-decoration: underline; }
</style>
</head>
<body>
<nav class="wrap">
  <div class="brand"><img src="/icon.png" alt=""> PC Tweaker</div>
  <div>
    <a class="navlink" href="#features">Features</a>
    <a class="navlink" href="#screenshots">Screenshots</a>
    <a class="navlink" href="#pricing">Pricing</a>
    <a class="navlink" href="https://github.com/${GITHUB_REPO}#readme">Docs</a>
    <a class="navlink" href="${primaryHref}">Download</a>
  </div>
</nav>

<section class="wrap" style="padding-top:24px;">
  <div class="eyebrow">Free Windows optimization tool</div>
  <h1>Tune Windows for performance and privacy — undo any of it with one click.</h1>
  <p class="sub">50 real tweaks across performance, gaming, privacy, maintenance and interface. Every change snapshots the original value first, so nothing is a one-way door.</p>
  <p style="margin-top:28px;">
    <a class="btn-primary" href="${primaryHref}">&#8681; Download for Windows${versionLabel}</a>
  </p>
  <p style="color:#8b87a0; font-size:14px;">Windows 10/11, 64-bit &middot; 33 tweaks free forever &middot; also on <a href="https://winstall.app/apps/AurelioAvila.PCTweaker">winget</a></p>
</section>

<section class="wrap" id="features">
  <div class="eyebrow">What it does</div>
  <h2>Nothing here is a placeholder</h2>
  <p class="sub">Every tweak reads and writes the real Windows registry, power plan, network DNS, services or files. One-click Scan checks the machine and lists what isn't optimized yet; "Fix all" applies everything selected behind a single UAC prompt, not one per tweak.</p>
  <div class="grid5">${featuresHtml}</div>
</section>

<section class="wrap" id="screenshots">
  <div class="eyebrow">See it running</div>
  <h2>The actual app, not mockups</h2>
  <div class="shots">${screenshotsHtml}</div>
</section>

<section class="wrap">
  <div class="eyebrow">Safety</div>
  <h2>Reversible by design</h2>
  <div class="grid2">
    <div class="price-card"><strong>Snapshotted first</strong><p style="color:#b7b3c9;font-size:14px;">Every change saves the original value before it's applied — revertible individually or all at once via Restore all.</p></div>
    <div class="price-card"><strong>Nothing permanently deleted</strong><p style="color:#b7b3c9;font-size:14px;">Cleanup moves files to the Recycle Bin, never a permanent delete.</p></div>
    <div class="price-card"><strong>No telemetry from the tweaks</strong><p style="color:#b7b3c9;font-size:14px;">The tweaks themselves never send data anywhere; the optional account only syncs Pro status across installs.</p></div>
    <div class="price-card"><strong>5 languages, 10 themes</strong><p style="color:#b7b3c9;font-size:14px;">English, Italian, French, Spanish, German — always starts in English, changed only by explicit choice.</p></div>
  </div>
</section>

<section class="wrap" id="pricing">
  <div class="eyebrow">Free / Pro</div>
  <h2>33 tweaks free, forever</h2>
  <p class="sub">Pro unlocks the advanced tweaks and presets (Turbo Gaming, Game Sessions, diagnostic-data reduction, and more). Payments go through Stripe Checkout — this app never sees your card details.</p>
  <div class="grid2" style="margin-top:28px;grid-template-columns: repeat(auto-fit, minmax(240px,1fr));">
    <div class="price-card"><span class="pill">Free</span><div class="price">&euro;0</div><p style="color:#b7b3c9;font-size:14px;">33 tweaks, forever. No account required.</p></div>
    <div class="price-card pro"><span class="pill">Monthly</span><div class="price">&euro;9.99<span style="font-size:14px;font-weight:400;color:#8b87a0;">/mo</span></div><p style="color:#b7b3c9;font-size:14px;">All 50 tweaks and presets.</p></div>
    <div class="price-card pro"><span class="pill">Annual — 51% off</span><div class="price">&euro;59<span style="font-size:14px;font-weight:400;color:#8b87a0;">/yr</span></div><p style="color:#b7b3c9;font-size:14px;">&euro;4.92/month, billed yearly.</p></div>
  </div>
</section>

<footer class="wrap">
  <a href="${releasesUrl}">All releases &amp; release notes</a> &middot;
  <a href="https://github.com/${GITHUB_REPO}#readme">Source &amp; documentation</a> &middot;
  <a href="/terms">Terms of Service</a> &middot;
  <a href="/privacy">Privacy Policy</a>
  <p>PC Tweaker is not affiliated with Microsoft or Windows. &copy; ${new Date().getFullYear()} PC Tweaker.</p>
</footer>
</body>
</html>`);
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

initSchema()
  .catch((err) => {
    console.error("failed to initialize database schema:", err);
  })
  .finally(() => {
    app.listen(port, () => {
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
  });
