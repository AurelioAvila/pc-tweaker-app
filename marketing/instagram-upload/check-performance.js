// Checks the insights (views/likes/comments/shares/saved/watch time) of the
// most recently published Instagram Reels and reports every REGRESSION
// against the last saved check.
//
// Added 2026-08-15: before this script PC Tweaker had NO visibility at all
// into Instagram performance. Same shape as
// solofounded-bot/check_ig_performance.py (Python), written in JS here to stay
// consistent with the rest of this folder. Same credential priority as lib.js:
// credentials.json first, then PCTWEAKER_IG_ACCESS_TOKEN/IG_USER_ID.
//
// Usage: node check-performance.js

const fs = require("fs");
const path = require("path");

const API_BASE = "https://graph.instagram.com/v21.0";
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const LOG_PATH = path.join(__dirname, "ig_performance_log.json");
const METRICS = "views,reach,likes,comments,shares,saved,total_interactions";
// Watch time: the #1 ranking signal, and it exists ONLY for Reels - asking for
// it on any other media type fails the whole insights call, so we try the
// reels metrics and fall back to the basic ones rather than losing the post
// (the same fix already in solofounded-bot).
const REELS_METRICS = "ig_reels_avg_watch_time,ig_reels_video_view_total_time";

function loadCredentials() {
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  }
  if (process.env.PCTWEAKER_IG_ACCESS_TOKEN && process.env.PCTWEAKER_IG_USER_ID) {
    return {
      igAccessToken: process.env.PCTWEAKER_IG_ACCESS_TOKEN,
      igUserId: process.env.PCTWEAKER_IG_USER_ID,
    };
  }
  throw new Error("No Instagram credentials found: credentials.json o PCTWEAKER_IG_ACCESS_TOKEN/IG_USER_ID.");
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return {};
  return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
}

function saveLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

async function fetchRecentMedia(token, igUserId, limit = 15) {
  const url = `${API_BASE}/${igUserId}/media?fields=id,caption,timestamp&limit=${limit}`;
  const resp = await fetch(url, { headers: authHeaders(token) });
  const data = await resp.json();
  return data.data || [];
}

async function insightsCall(token, mediaId, metrics) {
  const url = `${API_BASE}/${mediaId}/insights?metric=${metrics}`;
  const resp = await fetch(url, { headers: authHeaders(token) });
  if (!resp.ok) return null;
  const data = await resp.json();
  const out = {};
  for (const item of data.data || []) {
    out[item.name] = (item.values && item.values[0] && item.values[0].value) || 0;
  }
  return out;
}

async function fetchInsights(token, mediaId) {
  const combined = await insightsCall(token, mediaId, `${METRICS},${REELS_METRICS}`);
  if (combined !== null) return combined;
  return (await insightsCall(token, mediaId, METRICS)) || {};
}

async function run() {
  const { igAccessToken: token, igUserId } = loadCredentials();
  const log = loadLog();
  const regressions = [];
  const now = new Date().toISOString();

  const watchSamples = [];
  const mediaList = await fetchRecentMedia(token, igUserId);
  for (const media of mediaList) {
    const mid = media.id;
    const insights = await fetchInsights(token, mid);
    if (!insights || Object.keys(insights).length === 0) continue;
    if (insights.ig_reels_avg_watch_time) watchSamples.push(insights.ig_reels_avg_watch_time);

    const prev = (log[mid] && log[mid].insights) || {};
    const captionPreview = ((media.caption || "").split("\n")[0] || "").slice(0, 50);

    for (const metric of ["views", "likes", "comments", "shares", "saved"]) {
      const curV = insights[metric] || 0;
      const prevV = prev[metric] || 0;
      if (prevV && curV < prevV) {
        regressions.push(`${mid} (${captionPreview}): ${metric} ${prevV} -> ${curV}`);
      }
    }

    console.log(`[${media.timestamp.slice(0, 10)}] ${captionPreview}:`, insights);
    log[mid] = { caption: captionPreview, timestamp: media.timestamp, insights, checked_at: now };
  }
  saveLog(log);

  if (watchSamples.length) {
    watchSamples.sort((a, b) => a - b);
    const medianMs = watchSamples[Math.floor(watchSamples.length / 2)];
    console.log(`\n--> watch time mediano: ${(medianMs / 1000).toFixed(1)}s su ${watchSamples.length} reel`);
    if (medianMs < 5000) {
      console.log("    ATTENZIONE: sotto i 5s - e' il segnale di ranking #1, la distribuzione non si espande.");
    }
  }

  if (regressions.length) {
    console.log(`\n[WARN] ${regressions.length} regressione/i rilevate:`);
    for (const r of regressions) console.log(`  - ${r}`);
  } else {
    console.log("\nNessuna regressione rilevata.");
  }
}

run().catch((err) => {
  console.error("Errore:", err);
  process.exit(1);
});
