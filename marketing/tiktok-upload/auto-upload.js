// Watches the SAME queue the YouTube uploader uses (marketing/to-publish/
// and marketing/published/, since the YouTube script moves files there once
// it's done) for <name>.mp4 + <name>.json pairs, and posts each one to
// TikTok too - fully autonomous, no per-video review (see the YouTube
// auto-upload.js for the same standing choice).
//
// Deliberately does NOT move or delete any file itself (the YouTube script
// already owns that lifecycle) - instead keeps its own log
// (uploaded-log.json) of what it has already posted to TikTok, so it can
// safely scan both directories every run without double-posting.
//
// Meant to run periodically (see register-task.ps1 for the YouTube one -
// mirror the same Scheduled Task pattern for this script).

const fs = require("fs");
const path = require("path");
const { uploadVideo, uploadVideoToInbox } = require("./lib");

const ROOT = path.join(__dirname, "..");
const QUEUE_DIRS = [path.join(ROOT, "to-publish"), path.join(ROOT, "published")];
const LOG_PATH = path.join(__dirname, "uploaded-log.json");

// Stays SELF_ONLY until the TikTok "Direct Post" audit is approved for this
// app AND the account is set back to public - flipping this before then
// just makes every call 403 with unaudited_client_can_only_post_to_private_accounts.
const PRIVACY_LEVEL = process.env.TIKTOK_PRIVACY_LEVEL || "SELF_ONLY";

// While the audit is pending, default to sending videos to the account's
// drafts inbox instead of direct publish - it isn't restricted to SELF_ONLY,
// so it works today (no need for the account to stay Private either). Set
// TIKTOK_USE_INBOX=false once the audit is approved to go back to direct
// publish. The inbox endpoint can't carry a caption via API, so we save it
// next to the video for the account owner to paste in when they post it.
const USE_INBOX = process.env.TIKTOK_USE_INBOX !== "false";

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
}

function appendLog(entry) {
  const log = loadLog();
  log.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

// Precise tags are useful context for viewers and the recommendation system.
// Generic reach-bait (#fyp, #viral, etc.) made captions repetitive and is no
// longer appended. Video-specific tags remain the first choice.
const FALLBACK_TAG_SETS = [
  ["pctips", "windows11", "pcperformance", "gamingpc"],
  ["pcsetup", "pcoptimization", "gamingtips", "techtok"],
  ["windowshelp", "pcbuild", "computertips", "pcgaming"],
];
// Captions accorciate 2026-08-13, poi di nuovo il 2026-08-17 (richiesta
// esplicita: "le descrizioni sono ancora troppo lunghe e tags poco
// efficaci"). Misurato sui 33 file *_tiktok_caption.txt reali gia'
// pubblicati: media 178 caratteri, alcuni a 200-212 - hook + comment prompt
// + share prompt + tag erano SEMPRE tutti e quattro insieme. Ora una sola
// riga di CTA (comment O share, non entrambe) invece di due, che da sola
// toglie ~55-90 caratteri, e i tag sono 4 invece di 5 pescati a rotazione
// (vedi pickTags) invece che lo stesso identico set ogni volta.
const COMMENT_PROMPTS = [
  "Which one are you trying first? Comment below.",
  "Is your PC doing this right now? Tell me in the comments.",
  "Did this actually work for you? Comment and let me know.",
  "What's slowing your PC down? Drop it in the comments.",
];
const SHARE_PROMPTS = [
  "Share this with someone whose PC is lagging.",
  "Send this to a friend who needs it.",
  "Share this before you forget it exists.",
];
const BIO_CTA = "PC Tweaker has the full one-click setup. Link in bio.";

// Pescati SEMPRE nello stesso ordine finche' meta.tags aveva solo 5 elementi
// fissi per categoria: normaliseTags dedupava e tagliava a 5, quindi lo
// stesso identico gruppo di hashtag usciva su ogni video della categoria.
// content.py ora fornisce un pool di 10-12 tag per categoria; qui si sceglie
// un sottoinsieme casuale di 4 a ogni chiamata cosi' la combinazione varia
// video per video pur restando pertinente (mai #fyp/#viral generico).
function pickTags(pool, count) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function normaliseTags(tags, fallback) {
  const clean = (tags || []).map((tag) => String(tag)
    .replace(/^#/, "").replace(/[^a-zA-Z0-9_]/g, "").trim())
    .filter(Boolean);
  const pool = [...new Set(clean.concat(fallback))];
  return pickTags(pool, Math.min(4, pool.length)).map((tag) => `#${tag}`).join(" ");
}

function buildCaption(meta) {
  const hook = meta.hook || meta.title;
  const fallback = FALLBACK_TAG_SETS[Math.floor(Math.random() * FALLBACK_TAG_SETS.length)];
  const hashtags = normaliseTags(meta.tiktokTags || meta.tags, fallback);
  const cta = Math.random() < 0.5
    ? COMMENT_PROMPTS[Math.floor(Math.random() * COMMENT_PROMPTS.length)]
    : SHARE_PROMPTS[Math.floor(Math.random() * SHARE_PROMPTS.length)];
  return [hook, cta, BIO_CTA, hashtags].filter(Boolean).join("\n\n").trim();
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

// Quanti video per esecuzione (2026-08-08). Prima non c'era NESSUN limite:
// il task girava una volta sola (03:35) e caricava in un colpo tutti i reel
// accumulati in giornata - una raffica notturna di 3 video a distanza di
// secondi. TikTok fa competere fra loro i post ravvicinati per lo stesso
// pubblico iniziale, quindi la raffica danneggiava proprio i video che
// doveva distribuire. Ora: 1 video per run, 3 run al giorno in fasce
// distinte (vedi PCTweakerTikTokUpload1/2/3).
const MAX_PER_RUN = parseInt(process.env.TIKTOK_MAX_PER_RUN || "1", 10);

async function main() {
  const log = loadLog();
  const doneNames = new Set(log.map((e) => e.baseName));
  const all = findCandidates(doneNames);
  const candidates = all.slice(0, MAX_PER_RUN);

  if (candidates.length === 0) {
    console.log(`[${new Date().toISOString()}] No new videos for TikTok.`);
    return;
  }
  if (all.length > candidates.length) {
    console.log(`[${new Date().toISOString()}] ${all.length} in coda, ne carico ${candidates.length} (limite per run); i restanti al prossimo giro.`);
  }

  for (const { baseName, videoPath, metaPath } of candidates) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      const caption = buildCaption(meta);
      let result;
      if (USE_INBOX) {
        console.log(`[${new Date().toISOString()}] Sending ${baseName} to TikTok drafts inbox...`);
        result = await uploadVideoToInbox({ videoPath, caption });
        // Promemoria sul toggle "AI-generated" TOLTO dal file su richiesta
        // esplicita dell'utente (2026-08-05: "ormai so che devo aggiungere
        // l'etichetta AI"). L'obbligo resta - l'endpoint bozze non accetta
        // post_info, quindi is_aigc non e' impostabile via API per questo
        // flusso (a differenza di uploadVideo/lib.js, usato solo dopo
        // l'audit Direct Post) e la dichiarazione la fa l'utente in app - ma
        // il file torna a contenere solo la caption pura da incollare.
        const captionPath = path.join(path.dirname(videoPath), `${baseName}_tiktok_caption.txt`);
        fs.writeFileSync(captionPath, caption, "utf8");
        console.log(`  > caption ready to paste: ${captionPath}`);
      } else {
        console.log(`[${new Date().toISOString()}] Uploading ${baseName} to TikTok (${PRIVACY_LEVEL})...`);
        result = await uploadVideo({ videoPath, caption, privacyLevel: PRIVACY_LEVEL });
      }
      appendLog({
        baseName,
        publishId: result.publishId,
        status: result.status,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Failed to upload ${baseName} to TikTok:`, err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
