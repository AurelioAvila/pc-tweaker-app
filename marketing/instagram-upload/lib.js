// Instagram Graph API client (mirrors the getcertsprint bot's
// src/instagram_upload.py). Credentials come from (in order of priority):
// 1. env vars IG_ACCESS_TOKEN / IG_USER_ID
// 2. credentials.json in this folder (written by get-token.js)
//
// Flow: create media container (video_url + caption) -> poll status ->
// publish. video_url must be a publicly reachable URL - see github-host.js
// for how a local mp4 gets one.

const fs = require("fs");
const path = require("path");

// This bot uses the Instagram API with Instagram Login (Instagram Business
// Login) rather than the older Facebook-Login-for-Business flow - the
// account was added as an "Instagram tester" on the Meta app and its token
// was generated directly from the app's API Setup panel, bypassing the
// Page-to-Instagram linking step entirely (that link kept failing with a
// persistent Meta-side "collegamento non disponibile" error unrelated to
// permissions). Tokens from this flow are scoped to graph.instagram.com,
// NOT graph.facebook.com, and use an app-scoped IG user ID that differs
// from the legacy Facebook-linked Instagram Business Account ID.
const API_BASE = "https://graph.instagram.com/v21.0";
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const POLL_INTERVAL_MS = 10000;
const POLL_TIMEOUT_MS = 300000;

function loadCredentials() {
  if (process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID) {
    return { igAccessToken: process.env.IG_ACCESS_TOKEN, igUserId: process.env.IG_USER_ID };
  }
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  }
  throw new Error("No Instagram credentials found: set IG_ACCESS_TOKEN/IG_USER_ID env vars, or run get-token.js first.");
}

async function createContainer(igUserId, igAccessToken, videoUrl, caption) {
  const resp = await fetch(`${API_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: igAccessToken,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Media container creation failed (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data.id;
}

async function pollContainerStatus(creationId, igAccessToken) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const resp = await fetch(
      `${API_BASE}/${creationId}?${new URLSearchParams({ fields: "status_code", access_token: igAccessToken })}`,
    );
    const data = await resp.json();
    if (data.status_code === "FINISHED" || data.status_code === "ERROR") return data.status_code;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return "TIMEOUT";
}

async function publish(igUserId, igAccessToken, creationId) {
  const resp = await fetch(`${API_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: igAccessToken }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`media_publish failed (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data.id;
}

async function uploadReel({ videoUrl, caption }) {
  const { igAccessToken, igUserId } = loadCredentials();

  const creationId = await createContainer(igUserId, igAccessToken, videoUrl, caption);
  const status = await pollContainerStatus(creationId, igAccessToken);
  if (status !== "FINISHED") {
    throw new Error(`Instagram media container did not finish processing (status=${status})`);
  }

  const mediaId = await publish(igUserId, igAccessToken, creationId);
  console.log(`[OK] Published to Instagram: media_id=${mediaId}`);
  return { mediaId };
}

module.exports = { uploadReel };
