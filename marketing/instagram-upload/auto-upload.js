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
const { uploadReel, uploadStory } = require("./lib");
const { uploadVideo: hostVideo, deleteRelease } = require("./github-host");

const ROOT = path.join(__dirname, "..");
const QUEUE_DIRS = [path.join(ROOT, "to-publish"), path.join(ROOT, "published")];
const LOG_PATH = path.join(__dirname, "uploaded-log.json");
// Stories (2026-08-22): this account never posted any, unlike the org's other
// bots - same cap of 2/day already used there.
const STORY_LOG_PATH = path.join(__dirname, "story-log.json");
const MAX_STORIES_PER_DAY = 2;

function loadStoryLog() {
  if (!fs.existsSync(STORY_LOG_PATH)) return [];
  return JSON.parse(fs.readFileSync(STORY_LOG_PATH, "utf8"));
}

function appendStoryLog(entry) {
  const log = loadStoryLog();
  log.push(entry);
  fs.writeFileSync(STORY_LOG_PATH, JSON.stringify(log, null, 2));
}

function canPublishStory() {
  const today = new Date().toISOString().slice(0, 10);
  const todayStories = loadStoryLog().filter((e) => (e.publishedAt || "").startsWith(today));
  return todayStories.length < MAX_STORIES_PER_DAY;
}

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

// Offer line at the end of the caption (2026-08-06). 2026 research: a CTA
// carrying a specific NUMBER measures +27% link clicks against the vague
// phrasing (FastLinkIt/Korli). The numbers are the REAL ones from the app's
// README: 36 tweaks total, 28 free forever.
const CAPTION_OFFER = "PC Tweaker: 36 one-click Windows tweaks, 28 free forever. Link in bio.";

function buildCaption(meta) {
  const rawTags = (meta.instagramTags || meta.tags || []).slice(0, MAX_HASHTAGS);
  const hashtags = rawTags.map((t) => "#" + t.replace(/\s+/g, "")).join(" ");
  // title (the keyword hook, see the generator's CAPTION_HOOKS) as the FIRST
  // line: Instagram weighs keywords in the caption's first 60-80 characters
  // (2026 SEO), and the caption used to open straight into the body of the
  // script. The description stays in full: it is searchable text.
  const body = meta.description || meta.title;
  const first = meta.title && meta.description ? `${meta.title}\n\n` : "";
  return `${first}${body}\n\n${CAPTION_OFFER}\n\n${hashtags}`.trim();
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
    let published = false;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      const caption = buildCaption(meta);

      console.log(`[${new Date().toISOString()}] Hosting ${baseName} for Instagram...`);
      const hosted = await hostVideo(videoPath);
      releaseId = hosted.releaseId;

      console.log(`[${new Date().toISOString()}] Uploading ${baseName} to Instagram...`);
      const result = await uploadReel({ videoUrl: hosted.url, caption });
      appendLog({ baseName, mediaId: result.mediaId, uploadedAt: new Date().toISOString() });
      published = true;

      if (canPublishStory()) {
        try {
          const storyId = await uploadStory(hosted.url);
          appendStoryLog({ baseName, mediaId: result.mediaId, storyId, publishedAt: new Date().toISOString() });
        } catch (storyErr) {
          // The Reel already succeeded: a failed Story is optional extra
          // distribution and must not fail the main publish.
          console.error(`  ! Story fallita per ${baseName}:`, storyErr.message);
        }
      }
    } catch (err) {
      console.error(`Failed to upload ${baseName} to Instagram:`, err.message);
    } finally {
      // 2026-08-04: the release is NO LONGER deleted right after a successful
      // publish. Every single Reel published from 2026-08-01 onward (15 in a
      // row) disappeared within hours or days despite the API reporting it as
      // published - the same pattern seen on certsprint-reels-bot BEFORE that
      // project stopped deleting its releases
      // (src/github_asset_host.py::keep_for_x, which never deletes them), and
      // on groomlyco/magdock, which do not use GitHub as a host at all
      // (Shopify CDN) and never had the problem. Most likely explanation:
      // Instagram re-fetches video_url for some post-publish process
      // (copyright/audio scanning, or distribution ranking), finds it dead
      // almost immediately, and removes the post as suspicious content. The
      // release is deleted ONLY when the publish failed (an orphan release,
      // with no real post that needs it) - when it succeeded it stays up
      // forever, as certsprint already does.
      if (releaseId && !published) await deleteRelease(releaseId);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
