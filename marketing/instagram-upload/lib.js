// Instagram Graph API client (mirrors the getcertsprint bot's
// src/instagram_upload.py). Credentials come from (in order of priority):
// 1. credentials.json in this folder (written by get-token.js)
// 2. env vars PCTWEAKER_IG_ACCESS_TOKEN / PCTWEAKER_IG_USER_ID
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

// The account this uploader MUST publish to. See assertAccount().
const EXPECTED_USERNAME = "pctweaker10";

// PRIORITY INVERTED + PREFIXED NAMES (2026-08-06). The most expensive bug in
// the whole ecosystem lived in these lines: the environment variables were
// called IG_ACCESS_TOKEN/IG_USER_ID, GENERIC names shared with certsprint-bot
// and solofounded-bot, and they won over credentials.json. On this machine
// they exist as Windows user variables and hold @solo_founded's credentials
// (set for a local test of that bot): from 2026-08-01 onward EVERY PC Tweaker
// Reel was published to @solo_founded, with HTTP 200, a valid media_id and an
// "[OK] Published" log line. Confirmed by resolving the "ghost" media_ids with
// the environment token: they were PC Tweaker Reels (#windows11
// #pcoptimization) on the wrong profile.
// credentials.json, which is by definition specific to THIS folder and THIS
// account, now takes precedence; the env vars remain as a fallback but only
// under a name that cannot collide with another bot.
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
  throw new Error(
    "No Instagram credentials found: run get-token.js to write credentials.json, or set PCTWEAKER_IG_ACCESS_TOKEN/PCTWEAKER_IG_USER_ID.",
  );
}

// A safety net independent of the point above: before publishing, ask the API
// WHO the token actually belongs to and stop if it is not the expected
// account. A wrong credential is otherwise indistinguishable from a right one
// - the API answers 200 and happily publishes elsewhere, which is exactly how
// the bug stayed invisible for days. Costs one GET per Reel: nothing, next to
// publishing on somebody else's profile.
async function assertAccount(igUserId, igAccessToken) {
  const resp = await fetch(`${API_BASE}/${igUserId}?fields=username`, {
    headers: authHeaders(igAccessToken),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Impossibile verificare l'account Instagram: ${JSON.stringify(data)}`);
  }
  if (data.username !== EXPECTED_USERNAME) {
    throw new Error(
      `ACCOUNT SBAGLIATO: le credenziali puntano a @${data.username}, non a @${EXPECTED_USERNAME}. ` +
        `Pubblicazione annullata. Controlla credentials.json in ${CREDENTIALS_PATH}.`,
    );
  }
}

// AUTHENTICATION (fixed 2026-08-04): the token goes in the
// "Authorization: Bearer" header, NOT as an access_token field in the body.
//
// The "Instagram API with Instagram Login" flow (host graph.instagram.com,
// IGAA-prefixed token - the one this account uses) wants the Bearer header;
// passing access_token as a parameter is the style of the older
// Facebook-Page-linked flow on graph.facebook.com. READ calls tolerate both,
// which is why the bug stayed invisible: media, insights and even container
// creation all responded correctly.
//
// media_publish does NOT: with legacy-style auth it answered HTTP 200 with a
// valid-looking media_id, but the post was never created - no exception, an
// "[OK] Published" log line, and nothing on the account. Confirmed 2026-08-04:
// 15+ consecutive publishes from 2026-08-01 all ghosts, media_count stuck at
// 11, content_publishing_limit reporting quota_usage 0 (Instagram was not
// even counting an attempt), while publishing by hand from the app worked
// perfectly. certsprint-bot and the Shopify brands, which have always used the
// Bearer header, never had the problem.
function authHeaders(igAccessToken) {
  return { Authorization: `Bearer ${igAccessToken}` };
}

async function createContainer(igUserId, igAccessToken, videoUrl, caption) {
  // is_ai_generated: "true" (2026-08-05): the European AI Act (Article 50) is
  // legally binding from 2026-08-02 (fines up to EUR 15M or 3% of turnover)
  // for unlabelled AI-generated or AI-manipulated content - every Reel here
  // uses a synthetic voice and a generated script. This is Meta's documented
  // NATIVE parameter, not just a hashtag: Instagram applies the visible "AI
  // info" label on the post itself.
  const resp = await fetch(`${API_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: {
      ...authHeaders(igAccessToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    // audio_name (2026-08-06): the algorithm treats audio as a metadata tag
    // with its own page collecting every reel that uses it - a consistent
    // branded name turns that page into a hub for the brand and adds the
    // "Windows" keyword to search. Library music via the API does not exist:
    // it has to be embedded in the video file.
    body: new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      is_ai_generated: "true",
      audio_name: "PC Tweaker Windows Tips",
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
      `${API_BASE}/${creationId}?${new URLSearchParams({ fields: "status_code" })}`,
      { headers: authHeaders(igAccessToken) },
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
    headers: {
      ...authHeaders(igAccessToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ creation_id: creationId }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`media_publish failed (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data.id;
}

// Official pctweaker.app link (2026-08-22, explicitly requested): it used to
// point at the GitHub repo rather than the product's own site - the same fix
// was applied in parallel on YouTube (auto-upload.js) and X (post-to-x.js).
const PINNED_COMMENT_TEXT =
  "Try PC Tweaker for free \u{1F447}\nhttps://pctweaker.app";

// Posts a CTA comment right after publishing (mirrors the
// _pinned_comment/_post_pinned_comment pattern in the Ghostcut YouTube bot).
// Non-blocking: a failure here must never fail a publish that already
// succeeded.
//
// Instagram's Graph API exposes no way to actually PIN a comment to the top
// (no is_pinned field on POST .../comments, no dedicated endpoint as of
// 2026-08) - the same limitation already documented for YouTube Data API v3 in
// publish_ghostcut.py. The comment is posted normally; pinning it stays a
// manual step in the Instagram app.
async function postPinnedComment(mediaId, igAccessToken, text = PINNED_COMMENT_TEXT) {
  try {
    const resp = await fetch(`https://graph.instagram.com/v21.0/${mediaId}/comments`, {
      method: "POST",
      headers: {
        ...authHeaders(igAccessToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ message: text }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.log(`  [commento] non postato (${resp.status}): ${JSON.stringify(data)} - aggiungilo a mano`);
      return false;
    }
    console.log(`  [commento] postato (id=${data.id}) - va fissato a mano dall'app Instagram (l'API non lo permette)`);
    return true;
  } catch (exc) {
    console.log(`  [commento] non postato (${exc}) - aggiungilo a mano`);
    return false;
  }
}

async function uploadReel({ videoUrl, caption }) {
  const { igAccessToken, igUserId } = loadCredentials();
  await assertAccount(igUserId, igAccessToken);

  const creationId = await createContainer(igUserId, igAccessToken, videoUrl, caption);
  const status = await pollContainerStatus(creationId, igAccessToken);
  if (status !== "FINISHED") {
    throw new Error(`Instagram media container did not finish processing (status=${status})`);
  }

  const mediaId = await publish(igUserId, igAccessToken, creationId);
  console.log(`[OK] Published to Instagram: media_id=${mediaId}`);
  await postPinnedComment(mediaId, igAccessToken);
  return { mediaId };
}

async function createStoryContainer(igUserId, igAccessToken, videoUrl) {
  const resp = await fetch(`${API_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { ...authHeaders(igAccessToken), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ media_type: "STORIES", video_url: videoUrl }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Story container creation failed (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data.id;
}

// Story from the same video_url already used for the Reel (2026-08-22: found
// that this account never posted Stories, unlike
// SoloFounded/CertSprint/Ghostcut, which have been doing it for a while).
async function uploadStory(videoUrl) {
  const { igAccessToken, igUserId } = loadCredentials();
  await assertAccount(igUserId, igAccessToken);

  const creationId = await createStoryContainer(igUserId, igAccessToken, videoUrl);
  const status = await pollContainerStatus(creationId, igAccessToken);
  if (status !== "FINISHED") {
    throw new Error(`Instagram Story container did not finish processing (status=${status})`);
  }
  const storyId = await publish(igUserId, igAccessToken, creationId);
  console.log(`[OK] Story shared to Instagram: story_id=${storyId}`);
  return storyId;
}

module.exports = { uploadReel, postPinnedComment, uploadStory };
