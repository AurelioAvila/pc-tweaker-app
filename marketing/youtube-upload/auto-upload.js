// Watches marketing/to-publish/ for <name>.mp4 + <name>.json pairs and
// uploads each one to YouTube as Public immediately — fully autonomous, no
// human review step (explicit user choice 2026-07-25: full automation, no
// per-video confirmation). Successfully uploaded pairs are moved to
// marketing/published/ so they're never re-uploaded. Meant to be run
// periodically (see register-task.ps1).

const fs = require("fs");
const path = require("path");
const { uploadVideo, postComment } = require("./lib");

// CTA di default se il .json non specifica "ctaComment" - richiesto
// 2026-07-29: funnel diretto verso lo strumento/link in un commento (non
// "fissato", la API non lo permette - vedi nota in lib.js::postComment).
const DEFAULT_CTA_COMMENT =
  "Try PC Tweaker for free \u{1F447}\nhttps://github.com/AurelioAvila/pc-tweaker-app/releases";

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

async function processOne(baseName) {
  const videoPath = path.join(QUEUE_DIR, `${baseName}.mp4`);
  const metaPath = path.join(QUEUE_DIR, `${baseName}.json`);
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

  console.log(`[${new Date().toISOString()}] Uploading ${baseName}.mp4 as public...`);
  const result = await uploadVideo({
    videoPath,
    title: meta.title,
    description: meta.description,
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
    // Un commento fallito non deve far sembrare fallito l'intero upload -
    // il video e' comunque live, il commento e' solo un bonus per il funnel.
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
