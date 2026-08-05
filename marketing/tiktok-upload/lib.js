// TikTok Content Posting API client (mirrors the Python one built for the
// getcertsprint TikTok bot). Credentials come from (in order of priority):
// 1. env vars TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REFRESH_TOKEN
// 2. credentials.json in this folder (written by get-token.js) - used so the
//    Windows Scheduled Task (run.bat -> auto-upload.js) has something to read
//    without needing system-wide env vars, mirroring youtube-upload/token.json.
//
// Flow: refresh access token -> query creator_info (privacy_level options)
// -> init publish (FILE_UPLOAD) -> PUT video bytes -> poll status.
//
// NB: until the app passes TikTok's "Direct Post" audit, privacy_level stays
// SELF_ONLY regardless of what's requested here, and the *account itself*
// must be set to Private in the TikTok app or every call 403s with
// "unaudited_client_can_only_post_to_private_accounts".

const fs = require("fs");
const path = require("path");

const API_BASE = "https://open.tiktokapis.com/v2";
const TITLE_MAX_LEN = 2200; // real limit of the Content Posting API "title" field

const COUNTER_PATH = path.join(__dirname, "telegram_notify_counter.json");

// Sequential counter so the Telegram label (e.g. "PC Tweaker #7") can be
// matched in order to the notifications arriving in TikTok's Inbox.
function nextCounter() {
  let n = 0;
  if (fs.existsSync(COUNTER_PATH)) {
    n = JSON.parse(fs.readFileSync(COUNTER_PATH, "utf8")).n || 0;
  }
  n += 1;
  fs.writeFileSync(COUNTER_PATH, JSON.stringify({ n }));
  return n;
}

// Sends the ready-to-paste caption to Telegram as soon as a video lands in
// drafts - the inbox endpoint can't attach a caption via API, so without
// this it would have to be hunted down on the PC while publishing from the
// phone. Silent no-op if not configured - must never fail the upload.
async function notifyTelegram(videoPath, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const videoName = path.basename(videoPath);
  const n = nextCounter();
  try {
    // Two separate messages: a label first (with a sequential number), then
    // the pure caption so it can be selected and pasted without stripping.
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ chat_id: chatId, text: `🎬 PC Tweaker #${n} — ${videoName}` }),
    });
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ chat_id: chatId, text: caption }),
    });
  } catch (err) {
    console.log(`[WARN] Telegram notification failed for ${videoName}: ${err.message}`);
  }
}
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");

function loadCredentials() {
  if (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REFRESH_TOKEN) {
    return {
      clientKey: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
      refreshToken: process.env.TIKTOK_REFRESH_TOKEN,
    };
  }
  if (fs.existsSync(CREDENTIALS_PATH)) {
    const c = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
    return { clientKey: c.clientKey, clientSecret: c.clientSecret, refreshToken: c.refreshToken };
  }
  throw new Error(
    "No TikTok credentials found: set TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET/TIKTOK_REFRESH_TOKEN env vars, or run get-token.js first.",
  );
}

function safeTruncate(text, limit) {
  // Truncate on a word boundary so a hashtag never gets cut in half.
  if (text.length <= limit) return text;
  return text.slice(0, limit).split(" ").slice(0, -1).join(" ");
}

async function getAccessToken() {
  const creds = loadCredentials();
  const resp = await fetch(`${API_BASE}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: creds.clientKey,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
      refresh_token: creds.refreshToken,
    }),
  });
  const data = await resp.json();
  // TikTok returns 200 even on errors (e.g. expired refresh token), with an
  // {"error": ...} body instead of access_token - check explicitly instead
  // of getting an unclear "undefined" access token later.
  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function getAvailablePrivacyLevels(accessToken) {
  const resp = await fetch(`${API_BASE}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (!data.data) {
    throw new Error(`creator_info query failed: ${JSON.stringify(data)}`);
  }
  return data.data.privacy_level_options;
}

async function pollPublishStatus(accessToken, publishId, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const resp = await fetch(`${API_BASE}/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = await resp.json();
    const status = data.data && data.data.status;
    if (status === "PUBLISH_COMPLETE" || status === "FAILED") return status;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return "TIMEOUT";
}

async function uploadVideo({ videoPath, caption, privacyLevel = "SELF_ONLY" }) {
  const accessToken = await getAccessToken();

  const available = await getAvailablePrivacyLevels(accessToken);
  console.log(`[INFO] privacy_level available for this account: ${available}`);
  if (!available.includes(privacyLevel)) {
    console.log(
      `[WARN] '${privacyLevel}' not available for this account (options: ${available}); TikTok will assign a valid one anyway.`,
    );
  }

  const videoSize = fs.statSync(videoPath).size;

  const initResp = await fetch(`${API_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: {
        title: safeTruncate(caption, TITLE_MAX_LEN),
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        // is_aigc: true (2026-08-05): l'AI Act europeo (Articolo 50) e'
        // legalmente vincolante dal 2026-08-02 - ogni video qui usa voce
        // sintetica e script generati. Campo NATIVO dell'API TikTok, non
        // solo un hashtag: applica l'etichetta "Creator labeled as
        // AI-generated" sul video.
        is_aigc: true,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  });
  const initData = await initResp.json();
  if (!initData.data) {
    throw new Error(`init publish failed (${initResp.status}): ${JSON.stringify(initData)}`);
  }
  const { publish_id: publishId, upload_url: uploadUrl } = initData.data;

  const videoBytes = fs.readFileSync(videoPath);
  const putResp = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: videoBytes,
  });
  if (!putResp.ok) {
    throw new Error(`Video upload PUT failed: ${putResp.status} ${await putResp.text()}`);
  }

  const status = await pollPublishStatus(accessToken, publishId);
  console.log(`[OK] Published to TikTok: publish_id=${publishId}, status=${status}`);
  return { publishId, status };
}

async function uploadVideoToInbox({ videoPath, caption }) {
  // Sends the video to the account's "Upload to TikTok" drafts inbox instead
  // of publishing directly - unlike /video/init/, this isn't restricted to
  // SELF_ONLY pre-audit, so it works today. Trade-off: the inbox endpoint
  // doesn't accept a post_info, so no caption can be attached via API - the
  // account owner has to paste it in manually when they open the draft.
  const accessToken = await getAccessToken();
  const videoSize = fs.statSync(videoPath).size;

  const initResp = await fetch(`${API_BASE}/post/publish/inbox/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  });
  const initData = await initResp.json();
  if (!initData.data) {
    throw new Error(`init inbox failed (${initResp.status}): ${JSON.stringify(initData)}`);
  }
  const { publish_id: publishId, upload_url: uploadUrl } = initData.data;

  const videoBytes = fs.readFileSync(videoPath);
  const putResp = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: videoBytes,
  });
  if (!putResp.ok) {
    throw new Error(`Video upload PUT failed: ${putResp.status} ${await putResp.text()}`);
  }

  const status = await pollPublishStatus(accessToken, publishId);
  console.log(`[OK] Sent to TikTok drafts inbox: publish_id=${publishId}, status=${status}`);
  if (caption) {
    await notifyTelegram(videoPath, caption);
  }
  return { publishId, status };
}

module.exports = { uploadVideo, uploadVideoToInbox };
