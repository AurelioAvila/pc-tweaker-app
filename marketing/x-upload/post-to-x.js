// Automated X (Twitter) posting - FREE tier, text-only.
//
// Why text-only: the X API v2 free tier allows posting tweets (500/month,
// 100/day per app) but media upload (images/video) requires the paid
// Basic tier ($100/mo). generate-captions.js already proved the
// browser-automation route is blocked by anti-bot detection. So this
// posts a plain tweet: hook/description + CTA link, no attached media.
// Watches the same to-publish/ and published/ queue as the other
// uploaders, tracks what's already been tweeted in .x-posted.json so
// nothing gets posted twice.
//
// Requires env vars (create an X Developer app, "Read and Write" perms,
// OAuth 1.0a User Context keys - free tier does support posting with
// these, just not media upload):
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const QUEUE_DIRS = [path.join(ROOT, "to-publish"), path.join(ROOT, "published")];
const POSTED_LOG = path.join(__dirname, ".x-posted.json");

// Official pctweaker.app link (2026-08-22, explicitly requested): it used to
// point at the GitHub repo rather than the product's own site.
const CTA = "Try PC Tweaker for free \u{1F447}\nhttps://pctweaker.app";
const MAX_HASHTAGS = 2;
const MAX_TWEET_LENGTH = 280;

function loadPosted() {
  if (!fs.existsSync(POSTED_LOG)) return {};
  return JSON.parse(fs.readFileSync(POSTED_LOG, "utf8"));
}

function savePosted(posted) {
  fs.writeFileSync(POSTED_LOG, JSON.stringify(posted, null, 2));
}

// Plain token check instead of a nested-quantifier regex (`(#\S+\s*)+`),
// which is vulnerable to catastrophic backtracking on adversarial input.
function isHashtagOnlyLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => t.startsWith("#"));
}

function buildTweet(meta) {
  const rawDescription = (meta.description || meta.title || "").trim();
  const lines = rawDescription.split("\n");
  while (lines.length && isHashtagOnlyLine(lines[lines.length - 1])) {
    lines.pop();
  }
  const body = lines.join("\n").trim() || meta.title || "";
  const hashtags = (meta.tags || []).slice(0, MAX_HASHTAGS).map((t) => "#" + t.replace(/\s+/g, "")).join(" ");

  const suffix = `\n\n${CTA}${hashtags ? "\n" + hashtags : ""}`;
  const bodyBudget = MAX_TWEET_LENGTH - suffix.length;
  const trimmedBody = body.length > bodyBudget ? body.slice(0, Math.max(0, bodyBudget - 1)).trimEnd() + "…" : body;

  return `${trimmedBody}${suffix}`.trim();
}

function findCandidates(posted) {
  const candidates = [];
  for (const dir of QUEUE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".mp4")) continue;
      const baseName = f.replace(/\.mp4$/, "");
      if (posted[baseName]) continue;
      const metaPath = path.join(dir, `${baseName}.json`);
      if (!fs.existsSync(metaPath)) continue;
      candidates.push({ baseName, metaPath });
    }
  }
  return candidates;
}

// --- Minimal OAuth 1.0a signing (no extra dependency) ---
function oauthHeader(url, method, params, creds) {
  const oauthParams = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const allParams = { ...oauthParams, ...params };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join("&");
  const baseString = ["POST", encodeURIComponent(url), encodeURIComponent(paramString)].join("&");
  const signingKey = `${encodeURIComponent(creds.apiSecret)}&${encodeURIComponent(creds.accessTokenSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  const headerParams = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(headerParams[k])}"`)
      .join(", ")
  );
}

function postTweet(text, creds) {
  const url = "https://api.twitter.com/2/tweets";
  const body = JSON.stringify({ text });
  const authHeader = oauthHeader(url, "POST", {}, creds);

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
          else reject(new Error(`X API ${res.statusCode}: ${data}`));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const creds = {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  };
  if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessTokenSecret) {
    console.error("Missing X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET env vars.");
    process.exit(1);
  }

  const posted = loadPosted();
  const candidates = findCandidates(posted);
  if (candidates.length === 0) {
    console.log(`[${new Date().toISOString()}] Nothing new to post on X.`);
    return;
  }

  for (const { baseName, metaPath } of candidates) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const text = buildTweet(meta);
    try {
      const result = await postTweet(text, creds);
      posted[baseName] = { postedAt: new Date().toISOString(), tweetId: result.data && result.data.id };
      savePosted(posted);
      console.log(`[${new Date().toISOString()}] Posted: ${baseName} -> tweet ${result.data && result.data.id}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Failed to post ${baseName}: ${err.message}`);
    }
  }
}

main();
