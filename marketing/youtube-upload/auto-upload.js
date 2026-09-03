// Watches marketing/to-publish/ for <name>.mp4 + <name>.json pairs and
// uploads each one to YouTube as Public immediately — fully autonomous, no
// human review step (explicit user choice 2026-07-25: full automation, no
// per-video confirmation). Successfully uploaded pairs are moved to
// marketing/published/ so they're never re-uploaded. Meant to be run
// periodically (see register-task.ps1).

const fs = require("fs");
const path = require("path");
const { uploadVideo, postComment } = require("./lib");
const { validateUpload } = require("./quality-gate");

// Default CTA when the .json does not specify "ctaComment" - requested
// 2026-07-29: a direct funnel to the tool/link in a comment (not "pinned",
// the API does not allow that - see the note in lib.js::postComment).
// Official pctweaker.app link (2026-08-22, explicitly requested): it used to
// point at the GitHub repo rather than the product's own site - the same fix
// was applied in parallel on Instagram (instagram-upload/lib.js) and X.
const DEFAULT_CTA_COMMENT =
  "Try PC Tweaker for free \u{1F447}\nhttps://pctweaker.app";

const ROOT = path.join(__dirname, "..");
const QUEUE_DIR = path.join(ROOT, "to-publish");
const DONE_DIR = path.join(ROOT, "published");
const LOG_PATH = path.join(__dirname, "uploaded-log.json");

function ensureDirs() {
  for (const dir of [QUEUE_DIR, DONE_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
}

function appendLog(entry) {
  const log = loadLog();
  log.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

// These videos are vertical and short, which makes them Shorts: without
// "#shorts" in the title or the description, YouTube has to guess the
// classification from the format alone. Real bug found 2026-08-02: the
// generated .json files contained "#shorts" nowhere at all (not in the title,
// not in the description, not in the tags), unlike every other channel.
//
// The tag is added HERE and not in lib.js because lib.js is shared with
// compile-longform.js, where "#shorts" would be wrong: that is a long video,
// and tagging it this way confuses the classification and disappoints whoever
// clicks.
const YT_TITLE_MAX = 100;
const SHORTS_TAG = "#shorts";

function withShortsTag(title, description) {
  const hasTag = (s) => (s || "").toLowerCase().includes(SHORTS_TAG);
  if (hasTag(title) || hasTag(description)) return { title, description };

  // Prefer the title, but only if it fits: YouTube truncates at 100
  // characters without an error, so a suffix that does not fit would vanish
  // silently (which is exactly how the tag got lost on the Shopify videos).
  const suffixed = `${title} ${SHORTS_TAG}`;
  if (suffixed.length <= YT_TITLE_MAX) return { title: suffixed, description };
  return { title, description: `${description}\n\n${SHORTS_TAG}` };
}

async function processOne(baseName) {
  const videoPath = path.join(QUEUE_DIR, `${baseName}.mp4`);
  const metaPath = path.join(QUEUE_DIR, `${baseName}.json`);
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

  const { title, description } = withShortsTag(meta.title, meta.description);
  validateUpload({ videoPath, title, description });

  console.log(`[${new Date().toISOString()}] Uploading ${baseName}.mp4 as public...`);
  const result = await uploadVideo({
    videoPath,
    title,
    description,
    tags: meta.tags || [],
    privacyStatus: "public",
  });

  fs.renameSync(videoPath, path.join(DONE_DIR, `${baseName}.mp4`));
  fs.renameSync(metaPath, path.join(DONE_DIR, `${baseName}.json`));

  let commentPosted = false;
  try {
    await postComment({ videoId: result.id, text: meta.ctaComment || DEFAULT_CTA_COMMENT });
    commentPosted = true;
  } catch (err) {
    // A failed comment must not make the whole upload look failed - the video
    // is live either way, the comment is only a bonus for the funnel.
    console.error(`Comment failed for ${baseName} (video still live):`, err.message);
  }

  appendLog({ baseName, videoId: result.id, url: result.url, uploadedAt: new Date().toISOString(), commentPosted });
  console.log(`Done: ${result.url} (live now)${commentPosted ? ", CTA comment posted (remember to pin it manually in YouTube Studio)" : ""}`);
}

async function main() {
  ensureDirs();
  const files = fs.readdirSync(QUEUE_DIR);
  const baseNames = files.filter((f) => f.endsWith(".mp4")).map((f) => f.replace(/\.mp4$/, ""));
  const ready = baseNames.filter((name) => files.includes(`${name}.json`));

  if (ready.length === 0) {
    console.log(`[${new Date().toISOString()}] No new videos in to-publish/.`);
    return;
  }

  for (const baseName of ready) {
    try {
      await processOne(baseName);
    } catch (err) {
      console.error(`Failed to upload ${baseName}:`, err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
