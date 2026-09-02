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

// CTA di default se il .json non specifica "ctaComment" - richiesto
// 2026-07-29: funnel diretto verso lo strumento/link in un commento (non
// "fissato", la API non lo permette - vedi nota in lib.js::postComment).
// Link ufficiale pctweaker.app (2026-08-22, richiesta esplicita utente):
// prima puntava al repo GitHub, non al sito ufficiale del prodotto - stesso
// fix applicato in parallelo su Instagram (instagram-upload/lib.js) e X.
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

// Questi video sono verticali e brevi, cioe' Shorts: senza "#shorts" nel
// titolo o nella descrizione YouTube deve indovinare la classificazione dal
// solo formato. Bug reale trovato 2026-08-02: i .json generati non
// contenevano "#shorts" da nessuna parte (ne' titolo, ne' descrizione, ne'
// tags), a differenza di tutti gli altri canali.
//
// Il tag si aggiunge QUI e non in lib.js perche' lib.js e' condiviso con
// compile-longform.js, dove "#shorts" sarebbe sbagliato: quello e' un video
// lungo e taggarlo cosi' confonde la classificazione e delude chi clicca.
const YT_TITLE_MAX = 100;
const SHORTS_TAG = "#shorts";

function withShortsTag(title, description) {
  const hasTag = (s) => (s || "").toLowerCase().includes(SHORTS_TAG);
  if (hasTag(title) || hasTag(description)) return { title, description };

  // Preferenza al titolo, ma solo se ci sta: YouTube tronca a 100 caratteri
  // senza errore, quindi un suffisso che non entra sparirebbe in silenzio
  // (e' esattamente cosi' che il tag si e' perso sui video Shopify).
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
