// Watches the SAME queue the YouTube/TikTok uploaders use
// (marketing/to-publish/ and marketing/published/) for <name>.mp4 +
// <name>.json pairs, and posts each one to Instagram too - fully
// autonomous, no per-video review (same standing choice as the other two).
//
// Does NOT move or delete any file itself (the YouTube script owns that
// lifecycle) - keeps its own log (uploaded-log.json) so it can safely scan
// both directories every run without double-posting.
//
// Every video first gets hosted as a public GitHub Release asset
// (github-host.js) since Instagram's Graph API requires a public
// video_url, then the release is deleted right after a successful
// publish.

const fs = require("fs");
const path = require("path");
const { uploadReel } = require("./lib");
const { uploadVideo: hostVideo, deleteRelease } = require("./github-host");

const ROOT = path.join(__dirname, "..");
const QUEUE_DIRS = [path.join(ROOT, "to-publish"), path.join(ROOT, "published")];
const LOG_PATH = path.join(__dirname, "uploaded-log.json");

// Instagram capped Reels/posts to 5 hashtags in December 2025 (was 30) -
// more than 5 is invalid now, not just excessive.
const MAX_HASHTAGS = 5;

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
}

function appendLog(entry) {
  const log = loadLog();
  log.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function buildCaption(meta) {
  const rawTags = (meta.instagramTags || meta.tags || []).slice(0, MAX_HASHTAGS);
  const hashtags = rawTags.map((t) => "#" + t.replace(/\s+/g, "")).join(" ");
  const body = meta.description || meta.title;
  return `${body}\n\n${hashtags}`.trim();
}

function findCandidates(doneNames) {
  const candidates = [];
  for (const dir of QUEUE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (!f.endsWith(".mp4")) continue;
      const baseName = f.replace(/\.mp4$/, "");
      if (doneNames.has(baseName)) continue;
      const metaPath = path.join(dir, `${baseName}.json`);
      if (!fs.existsSync(metaPath)) continue;
      candidates.push({ baseName, videoPath: path.join(dir, f), metaPath });
    }
  }
  return candidates;
}

async function main() {
  const log = loadLog();
  const doneNames = new Set(log.map((e) => e.baseName));
  const candidates = findCandidates(doneNames);

  if (candidates.length === 0) {
    console.log(`[${new Date().toISOString()}] No new videos for Instagram.`);
    return;
  }

  for (const { baseName, videoPath, metaPath } of candidates) {
    let releaseId = null;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      const caption = buildCaption(meta);

      console.log(`[${new Date().toISOString()}] Hosting ${baseName} for Instagram...`);
      const hosted = await hostVideo(videoPath);
      releaseId = hosted.releaseId;

      console.log(`[${new Date().toISOString()}] Uploading ${baseName} to Instagram...`);
      const result = await uploadReel({ videoUrl: hosted.url, caption });
      appendLog({ baseName, mediaId: result.mediaId, uploadedAt: new Date().toISOString() });
    } catch (err) {
      console.error(`Failed to upload ${baseName} to Instagram:`, err.message);
    } finally {
      if (releaseId) await deleteRelease(releaseId);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
