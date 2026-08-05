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

function buildCaption(meta) {
  const rawTags = meta.tiktokTags || meta.tags || [];
  const hashtags = rawTags.map((t) => "#" + t.replace(/\s+/g, "")).join(" ");
  return `${meta.title}\n\n${hashtags}`.trim();
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
    console.log(`[${new Date().toISOString()}] No new videos for TikTok.`);
    return;
  }

  for (const { baseName, videoPath, metaPath } of candidates) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      const caption = buildCaption(meta);
      let result;
      if (USE_INBOX) {
        console.log(`[${new Date().toISOString()}] Sending ${baseName} to TikTok drafts inbox...`);
        result = await uploadVideoToInbox({ videoPath, caption });
        // Promemoria sul toggle "AI-generated" incluso nel file (2026-08-05):
        // l'endpoint bozze non accetta post_info, quindi is_aigc non e'
        // impostabile via API per questo flusso (a differenza di
        // uploadVideo/lib.js, usato solo dopo l'audit Direct Post). L'AI Act
        // europeo (Articolo 50) e' legalmente vincolante dal 2026-08-02: la
        // dichiarazione la puo' fare solo un umano in app al momento della
        // pubblicazione dalla bozza.
        const captionPath = path.join(path.dirname(videoPath), `${baseName}_tiktok_caption.txt`);
        fs.writeFileSync(
          captionPath,
          `${caption}\n\n[Ricorda: attiva "Etichetta come generato da IA" prima di pubblicare - obbligo di legge UE dal 2/8/2026]`,
          "utf8",
        );
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
