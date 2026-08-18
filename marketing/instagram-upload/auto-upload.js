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

// Riga di offerta a fine caption (2026-08-06). Ricerca 2026: una CTA con
// un NUMERO specifico misura +27% di click sul link rispetto alla frase
// vaga (FastLinkIt/Korli). I numeri sono quelli VERI del README dell'app:
// 36 tweak totali, 28 gratis per sempre.
const CAPTION_OFFER = "PC Tweaker: 36 one-click Windows tweaks, 28 free forever. Link in bio.";

function buildCaption(meta) {
  const rawTags = (meta.instagramTags || meta.tags || []).slice(0, MAX_HASHTAGS);
  const hashtags = rawTags.map((t) => "#" + t.replace(/\s+/g, "")).join(" ");
  // title (l'hook con la keyword, vedi CAPTION_HOOKS del generatore) come
  // PRIMA riga: Instagram pesa le keyword nei primi 60-80 caratteri della
  // caption (SEO 2026), e prima la caption apriva direttamente col corpo
  // dello script. La description resta per intero: e' testo ricercabile.
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
    } catch (err) {
      console.error(`Failed to upload ${baseName} to Instagram:`, err.message);
    } finally {
      // 2026-08-04: NON si cancella piu' la release subito dopo un publish
      // riuscito. Ogni singolo Reel pubblicato dal 2026-08-01 in poi (15 di
      // fila) e' sparito nel giro di ore/giorni pur risultando "pubblicato"
      // dall'API - stesso schema visto su certsprint-reels-bot PRIMA che
      // quel progetto smettesse di cancellare le sue release
      // (src/github_asset_host.py::keep_for_x, che non le cancella mai) e
      // su groomlyco/magdock, che non usano affatto GitHub come host (CDN
      // Shopify) e non hanno mai avuto questo problema. Ipotesi piu'
      // probabile: Instagram ri-accede al video_url per un processo dopo il
      // publish (scansione copyright/audio o ranking di distribuzione), lo
      // trova morto quasi subito, e rimuove il post come contenuto
      // sospetto. Si cancella la release SOLO se il publish e' fallito
      // (release orfana, nessun post reale a cui serve) - se e' riuscito
      // resta su per sempre, come gia' fa certsprint.
      if (releaseId && !published) await deleteRelease(releaseId);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
