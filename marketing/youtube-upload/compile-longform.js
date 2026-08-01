// Costruisce un video "normale" (non-Shorts) per PC Tweaker concatenando
// piu' Reel gia' pubblicati singolarmente da marketing/published/ - a
// differenza degli altri canali (xn0time, SoloFounded, ecc), qui non c'e'
// un pool di fatti da cui generare contenuto nuovo: il materiale e' gia'
// tutto quello che esiste (i Reel prodotti da marketing/reel-generator).
// Nessuna reinvenzione di contenuto, solo un remix in formato piu' lungo -
// stesso principio della countdown "buying guide" di Groomlyco/Magdock.
//
// Uso: node compile-longform.js [--count 6]

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { uploadVideo } = require("./lib");

// Il concat demuxer di ffmpeg mappa i flussi in automatico in base al PRIMO
// file della lista: se quello non ha una traccia audio, l'intero output
// concatenato perde l'audio di TUTTE le clip, anche quelle che ce l'hanno
// (bug reale trovato 2026-08-01: myth-bust-rollback.mp4 e' video-only,
// pubblicato per errore un video muto - eliminato e corretto qui, ora si
// scartano le clip senza audio a monte).
function hasAudioStream(videoPath) {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-select_streams", "a",
    "-show_entries", "stream=index",
    "-of", "csv=p=0",
    videoPath,
  ]).toString().trim();
  return out.length > 0;
}

const ROOT = path.join(__dirname, "..");
const PUBLISHED_DIR = path.join(ROOT, "published");
const OUTPUT_DIR = path.join(__dirname, "longform_output");
const LOG_PATH = path.join(__dirname, "longform-log.json");

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return { compilations: [] };
  return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
}

function appendLog(entry) {
  const log = loadLog();
  log.compilations.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function listAvailableClips() {
  return fs
    .readdirSync(PUBLISHED_DIR)
    .filter((f) => f.endsWith(".mp4"))
    .map((f) => f.slice(0, -".mp4".length))
    .filter((base) => fs.existsSync(path.join(PUBLISHED_DIR, `${base}.json`)))
    .filter((base) => {
      const ok = hasAudioStream(path.join(PUBLISHED_DIR, `${base}.mp4`));
      if (!ok) console.log(`  ! ${base}: nessuna traccia audio, escluso dalla compilation`);
      return ok;
    });
}

function pickClips(count) {
  const log = loadLog();
  const usedCounts = {};
  for (const c of log.compilations) {
    for (const base of c.clips) usedCounts[base] = (usedCounts[base] || 0) + 1;
  }
  const all = listAvailableClips();
  // Preferisci le clip usate meno volte nelle compilation precedenti, cosi'
  // col tempo si alternano invece di ripetere sempre le stesse (il pool e'
  // piccolo oggi - 9 clip - ma crescera' con nuovi Reel pubblicati).
  const sorted = [...all].sort((a, b) => (usedCounts[a] || 0) - (usedCounts[b] || 0));
  return sorted.slice(0, Math.min(count, sorted.length));
}

function buildDescription(clipMetas) {
  const bullets = clipMetas.map((m) => `- ${m.title}`).join("\n");
  return (
    `${clipMetas.length} quick Windows tweaks you can apply right now, back to back:\n\n${bullets}\n\n` +
    "Install: winget install AurelioAvila.PCTweaker\n" +
    "Source (MIT): github.com/AurelioAvila/pc-tweaker-app\n\n" +
    "#Windows #PCOptimization #WindowsTips"
  );
}

async function main() {
  const countArgIdx = process.argv.indexOf("--count");
  const count = countArgIdx !== -1 ? parseInt(process.argv[countArgIdx + 1], 10) : 6;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const bases = pickClips(count);
  if (bases.length < 3) {
    console.log(`Solo ${bases.length} clip disponibili in marketing/published/, servono almeno 3 - salto.`);
    return;
  }

  const clipMetas = bases.map((base) => JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, `${base}.json`), "utf8")));

  const concatListPath = path.join(OUTPUT_DIR, "_concat.txt");
  const listContent = bases.map((base) => `file '${path.join(PUBLISHED_DIR, `${base}.mp4`).replace(/'/g, "'\\''")}'`).join("\n");
  fs.writeFileSync(concatListPath, listContent);

  const outputPath = path.join(OUTPUT_DIR, `longform_${Date.now()}.mp4`);
  console.log(`Concateno ${bases.length} clip in ${outputPath}...`);
  // -map esplicito (invece di lasciare la selezione automatica al primo
  // file) cosi' fallisce rumorosamente se manca l'audio invece di produrre
  // in silenzio un video muto come successo la prima volta.
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", concatListPath, "-map", "0:v:0", "-map", "0:a:0", "-c", "copy", outputPath],
    { stdio: "inherit" }
  );

  const title = `${bases.length} Windows Tweaks You Need To Know (2026)`;
  const description = buildDescription(clipMetas);
  const tags = ["windows tweak", "pc optimizer", "windows 11 tips", "free software", "open source"];

  console.log("Upload in corso...");
  const result = await uploadVideo({ videoPath: outputPath, title, description, tags, privacyStatus: "public" });
  console.log(`[OK] Compilation pubblicata: video id=${result.id}`);

  appendLog({ date: new Date().toISOString(), videoId: result.id, clips: bases });
}

main().catch((err) => {
  console.error("Errore:", err);
  process.exit(1);
});
