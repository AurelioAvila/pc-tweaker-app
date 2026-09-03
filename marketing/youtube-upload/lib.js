const fs = require("fs");
const path = require("path");
const http = require("http");
const { exec, execFileSync } = require("child_process");
const { google } = require("googleapis");

const DIR = __dirname;
const TOKEN_PATH = path.join(DIR, "token.json");
const PORT = 51789;
const REDIRECT_URI = `http://localhost:${PORT}`;
// yt-analytics.readonly added 2026-08-04: the "youtube" scope above grants
// Data API upload/read but not the YouTube Analytics API (per-video
// retention/watch time, the metric that decides whether a video is pushed
// beyond its initial test pool - see project_growth_algorithm_research_2026_08_04
// in memory). "YouTube Analytics API" must also be enabled in the same Google
// Cloud project, otherwise the calls fail with "API not enabled" even with the
// right scope on the token.
const SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

function findClientSecretFile() {
  const file = fs.readdirSync(DIR).find((f) => f.startsWith("client_secret") && f.endsWith(".json"));
  if (!file) {
    throw new Error("No client_secret_*.json found in this folder. Download it from Google Cloud Console.");
  }
  return path.join(DIR, file);
}

function loadOAuthClient() {
  const raw = JSON.parse(fs.readFileSync(findClientSecretFile(), "utf8"));
  const creds = raw.installed || raw.web;
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT_URI);
}

function getNewToken(oauth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });

    const server = http.createServer(async (req, res) => {
      if (!req.url.startsWith("/")) return;
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      if (!code) return;
      res.end("Login completed — you can close this tab and go back to the terminal.");
      server.close();
      try {
        const { tokens } = await oauth2Client.getToken(code);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        oauth2Client.setCredentials(tokens);
        resolve(oauth2Client);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(PORT, () => {
      console.log("Opening browser for one-time Google login...");
      console.log(authUrl);
      const opener = process.platform === "win32" ? `start "" "${authUrl}"` : `open "${authUrl}"`;
      exec(opener);
    });
  });
}

async function getAuthorizedClient() {
  const oauth2Client = loadOAuthClient();
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  }
  return getNewToken(oauth2Client);
}

/**
 * A 1280x720 cover built from the Short's FIRST frame (ours open with the hook
 * card full screen, so frame zero already carries the readable hook and has no
 * subtitles over it yet).
 *
 * Composition: the sharp frame in the central 9:16 column - the only area that
 * survives both the 16:9 view and the vertical crop of the Shorts grid - with
 * the same frame enlarged and blurred to fill the sides. Actually tried:
 * uploading the 1080x1920 vertical directly makes YouTube wedge it into a 16:9
 * with two large black bars.
 *
 * Returns null (without throwing) if ffmpeg is missing or fails: the automatic
 * cover is better than a missed publish.
 */
function buildShortThumbnail(videoPath) {
  const out = path.join(path.dirname(videoPath), "short_thumbnail.jpg");
  const filter =
    "[0:v]scale=1280:-2,crop=1280:720,boxblur=24:2,eq=brightness=-0.22[bg];" +
    "[0:v]scale=-2:720,crop=405:720[fg];[bg][fg]overlay=(W-w)/2:0";
  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-ss", "0", "-i", videoPath, "-frames:v", "1",
       "-filter_complex", filter, "-q:v", "2", out],
      { stdio: "pipe" }
    );
    return fs.existsSync(out) ? out : null;
  } catch (err) {
    console.warn(`[thumbnail] not generated (${err.message}) - keeping the automatic one`);
    return null;
  }
}

async function uploadVideo({ videoPath, title, description, tags = [], privacyStatus = "unlisted", thumbnailPath = null }) {
  const auth = await getAuthorizedClient();
  const youtube = google.youtube({ version: "v3", auth });
  // AI transparency (2026-08-05): EU AI Act art. 50, applicable from 2 August
  // 2026 - AI-generated content must be made identifiable with machine-readable
  // marking. These videos are generated (script + TTS voice):
  // containsSyntheticMedia is the field the API exposes for exactly this, and
  // "#ai" is the part a reader can see.
  if (!tags.some((t) => t.toLowerCase() === "ai")) tags = [...tags, "ai"];
  if (!description.toLowerCase().includes("#ai")) description = `${description.trimEnd()}\n\n#ai`;
  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      // Language declared explicitly (2026-08-06): without it YouTube detects
      // the language itself (and can get it wrong), and the detected language
      // is what auto-dubbing works from. The content is English by project
      // rule.
      snippet: { title, description, tags, categoryId: "28", defaultLanguage: "en", defaultAudioLanguage: "en" },
      status: { privacyStatus, selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
    },
    media: { body: fs.createReadStream(videoPath) },
  });

  // A cover for SHORTS too (2026-08-06): it is not visible in the feed, but it
  // is visible in the channel grid and in search, which is where people decide
  // whether to subscribe. Without one, YouTube picked a random frame, often
  // with a subtitle cut off mid-word across it.
  if (!thumbnailPath) {
    thumbnailPath = buildShortThumbnail(videoPath);
  }

  // This must NEVER fail a publish that already succeeded: channels without a
  // verified phone number cannot set one and the API refuses.
  if (thumbnailPath) {
    try {
      await youtube.thumbnails.set({
        videoId: res.data.id,
        media: { body: fs.createReadStream(thumbnailPath) },
      });
      console.log(`[thumbnail] miniatura personalizzata impostata su ${res.data.id}`);
    } catch (err) {
      console.warn(`[thumbnail] not set (${err.message}) - keeping the automatic one`);
    }
  }

  return { id: res.data.id, url: `https://youtube.com/shorts/${res.data.id}` };
}

async function postComment({ videoId, text }) {
  // NOTE: YouTube Data API v3 exposes no way to PIN a comment to the top -
  // that stays a manual step in YouTube Studio (open the video -> Comments ->
  // Pin on the comment just posted). Here we can only publish it, not pin it.
  const auth = await getAuthorizedClient();
  const youtube = google.youtube({ version: "v3", auth });
  // commentThreads.insert also requires the channel that owns the video.
  // Without this field the API can refuse the comment even though it has just
  // accepted the upload of that same video.
  const mine = await youtube.channels.list({ part: ["id"], mine: true });
  const channelId = mine.data.items?.[0]?.id;
  if (!channelId) throw new Error("Cannot determine the authenticated YouTube channel for the CTA comment.");
  const res = await youtube.commentThreads.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        channelId,
        videoId,
        topLevelComment: { snippet: { textOriginal: text } },
      },
    },
  });
  return res.data.id;
}

module.exports = { getAuthorizedClient, uploadVideo, postComment };
