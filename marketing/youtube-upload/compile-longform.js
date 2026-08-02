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

// I due punti della lettera di unita' ("C:/...") vanno protetti: nella
// sintassi dei filtri ffmpeg ':' separa le opzioni, quindi un percorso
// Windows non escapato rompe l'intera filterchain anche se e' tra apici
// (verificato: "Error parsing filterchain" subito dopo il primo drawtext).
const THUMB_FONT = path
  .join(ROOT, "reel-generator", "assets", "fonts", "Poppins-ExtraBold.ttf")
  .replace(/\\/g, "/")
  .replace(/:/g, "\\:");

/**
 * Miniatura 1280x720: fotogramma del video sfocato e scurito + TITOLO in
 * grande. Fatta con ffmpeg (drawtext) invece che con una libreria immagini
 * per non aggiungere dipendenze npm a questo pacchetto.
 *
 * Lo sfondo va sfocato e scurito, altrimenti il bianco diventa illeggibile
 * sulle zone chiare - ed e' esattamente cio' che rende inutili le miniature
 * automatiche di YouTube.
 */
function buildThumbnail(videoPath, title) {
  const out = path.join(OUTPUT_DIR, "thumbnail.jpg");

  // drawtext non manda a capo da solo: spezziamo il titolo in righe da ~22
  // caratteri su confine di parola, cosi' resta leggibile anche
  // nell'anteprima piccola del feed mobile.
  const words = title.toUpperCase().split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > 22 && current) {
      lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current);

  // ':' e '\' hanno significato nella sintassi dei filtri ffmpeg.
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "");
  const lineH = 96;
  const startY = Math.round((720 - lines.length * lineH) / 2);
  const drawtexts = lines
    .map((line, i) =>
      `drawtext=fontfile='${THUMB_FONT}':text='${esc(line)}':fontcolor=white:fontsize=76:` +
      `borderw=7:bordercolor=black:x=(w-text_w)/2:y=${startY + i * lineH}`
    )
    .join(",");

  const filter =
    `scale=1280:720,boxblur=12:1,eq=brightness=-0.22,${drawtexts},` +
    `drawbox=x=0:y=704:w=1280:h=16:color=0x00B0FF@1:t=fill`;

  execFileSync(
    "ffmpeg",
    ["-y", "-ss", "3", "-i", videoPath, "-frames:v", "1", "-vf", filter, "-q:v", "2", out],
    { stdio: "pipe" }
  );
  return out;
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

  // Pool di titoli invece di una stringa fissa: prima ogni compilation usciva
  // con lo stesso identico schema, e su un canale YouTube titoli quasi
  // duplicati si cannibalizzano nella ricerca e non danno a chi scorre nessun
  // motivo per cliccare il nuovo invece del vecchio.
  const TITLE_TEMPLATES = [
    (n) => `${n} Windows Tweaks You Need To Know (2026)`,
    (n) => `${n} Windows Settings You Should Change Today (2026)`,
    (n) => `I Changed ${n} Windows Settings. Here's What Happened (2026)`,
    (n) => `${n} Things Windows Turns On Without Asking You (2026)`,
    (n) => `${n} Windows Tweaks That Actually Made a Difference (2026)`,
  ];
  const title = TITLE_TEMPLATES[Math.floor(Math.random() * TITLE_TEMPLATES.length)](bases.length);
  const description = buildDescription(clipMetas);
  // Tag API piu' ampi: il campo regge ~500 caratteri e i tag sono un canale
  // diverso dagli hashtag visibili, conviene sfruttarlo invece di fermarsi a 5.
  const tags = [
    "windows tweak", "pc optimizer", "windows 11 tips", "free software", "open source",
    "speed up pc", "windows 11 performance", "debloat windows", "pc maintenance",
    "windows settings", "gaming pc optimization", "pc tweaker",
  ];

  // Miniatura col titolo in grande: su un long-form e' LA leva del click, e
  // senza YouTube ne sceglie una da un fotogramma a caso (tipicamente meta'
  // di una parola dei sottotitoli). Se fallisce si pubblica lo stesso.
  let thumbnailPath = null;
  try {
    thumbnailPath = buildThumbnail(outputPath, title);
  } catch (err) {
    console.warn(`Miniatura non generata (${err.message}) - si prosegue senza`);
  }

  console.log("Upload in corso...");
  const result = await uploadVideo({ videoPath: outputPath, title, description, tags, privacyStatus: "public", thumbnailPath });
  console.log(`[OK] Compilation pubblicata: video id=${result.id}`);

  appendLog({ date: new Date().toISOString(), videoId: result.id, clips: bases });
}

main().catch((err) => {
  console.error("Errore:", err);
  process.exit(1);
});
