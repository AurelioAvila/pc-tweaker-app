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
    "Try it: https://pctweaker.app\n" +
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
// ':' e '\' hanno significato nella sintassi dei filtri ffmpeg. L'apice
// veniva prima eliminato del tutto (verificato bruciando davvero un
// titolo con apostrofo: "Here's What Happened" usciva come "HERES WHAT
// HAPPENED", un errore grammaticale permanente nel video, non correggibile
// dopo la pubblicazione). All'interno di un valore tra apici singoli, la
// I due punti hanno significato nella sintassi dei filtri ffmpeg, quindi un
// PERCORSO va comunque escapato (vedi THUMB_FONT sopra). Il TESTO invece non
// passa piu' per l'opzione inline text='...': un apostrofo dentro un valore
// tra apici singoli non ha un escape affidabile nella sintassi dei filtri
// ffmpeg. Il tentativo con 'It'\''s' verificato live (2026-08-03) ha rotto
// il parsing dell'intera filterchain, facendo comparire i parametri del
// drawtext successivo come testo letterale sullo schermo - peggio del difetto
// originale (che comunque toglieva l'apostrofo, "HERES" invece di "Here's").
// Fix robusto: si scrive il testo su un file e si usa l'opzione textfile=,
// che legge il contenuto cosi' com'e' senza fare parsing di escape sul
// contenuto - un apostrofo nel file e' solo un carattere, non sintassi.
function escFfmpegPath(p) {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

/**
 * Filtro ffmpeg drawtext per il titolo, a QUALUNQUE dimensione (width x
 * height) - condiviso da buildThumbnail (sempre 1280x720, il formato
 * richiesto dall'API) e bakeThumbnailCard (dimensioni REALI del video,
 * 2026-08-03, per il bake-in - vedi sotto perche' esiste).
 *
 * charsPerLine/fontSize/lineH scalano con la larghezza: un font fisso a
 * 76px letto bene a 1280px di larghezza sarebbe minuscolo su un frame molto
 * piu' largo o sproporzionato su uno piu' stretto.
 */
function drawTextFilter(title, width, height, accentColor, tmpDir) {
  const fontSize = Math.round(width * 0.059);
  const charsPerLine = Math.max(10, Math.round(width / (fontSize * 0.6)));

  const words = title.toUpperCase().split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > charsPerLine && current) {
      lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current);
  lines.splice(4); // max 4 righe, come le controparti Python

  const lineH = Math.round(fontSize * 1.26);
  const startY = Math.round((height - lines.length * lineH) / 2);
  const drawtexts = lines
    .map((line, i) => {
      const txtPath = path.join(tmpDir, `_dt_line_${i}.txt`);
      fs.writeFileSync(txtPath, line, "utf8");
      return `drawtext=fontfile='${THUMB_FONT}':textfile='${escFfmpegPath(txtPath)}':fontcolor=white:fontsize=${fontSize}:` +
        `borderw=${Math.max(4, Math.round(fontSize * 0.09))}:bordercolor=black:x=(w-text_w)/2:y=${startY + i * lineH}`;
    })
    .join(",");

  const barH = Math.max(8, Math.round(height * 0.011));
  return (
    `scale=${width}:${height},boxblur=12:1,eq=brightness=-0.22,${drawtexts},` +
    `drawbox=x=0:y=${height - barH}:w=${width}:h=${barH}:color=${accentColor}@1:t=fill`
  );
}

function cleanupDrawtextFiles(tmpDir) {
  for (let i = 0; i < 4; i++) {
    const p = path.join(tmpDir, `_dt_line_${i}.txt`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

// Colore della barra d'accento a rotazione (2026-08-13): prima sempre lo
// stesso blu su ogni copertina, uno dei motivi per cui i video sembravano
// tutti uguali in griglia. Alto contrasto su sfondo scurito/sfocato, stessa
// logica gia' validata dalla ricerca Studio (thumbnail vincenti nella
// nicchia: colori ad alto contrasto, non un unico accento fisso).
const THUMBNAIL_ACCENT_COLORS = ["0x00B0FF", "0xFF3B30", "0xFFD60A", "0x34C759"];

function buildThumbnail(videoPath, title, accent = THUMBNAIL_ACCENT_COLORS[0]) {
  const out = path.join(OUTPUT_DIR, "thumbnail.jpg");
  const filter = drawTextFilter(title, 1280, 720, accent, OUTPUT_DIR);
  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-ss", "3", "-i", videoPath, "-frames:v", "1", "-vf", filter, "-q:v", "2", out],
      { stdio: "pipe" }
    );
  } finally {
    cleanupDrawtextFiles(OUTPUT_DIR);
  }
  return out;
}

/**
 * Legge la risoluzione REALE del video con ffprobe - non si assume, perche'
 * questo compilato e' sempre verticale (concat di Reel 1080x1920) ma
 * assumerlo a priori sarebbe fragile se il formato sorgente cambiasse.
 */
function probeDimensions(videoPath) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0",
    videoPath,
  ]).toString().trim();
  const [width, height] = out.split(",").map(Number);
  return { width, height };
}

/**
 * Sovrappone una card col titolo in grande nei primi CARD_SECONDS secondi
 * del video, IN PLACE - aggira il blocco delle miniature personalizzate su
 * un canale senza telefono verificato.
 *
 * Perche' esiste (2026-08-03): confermato live che questo canale non ha il
 * telefono verificato (403 "insufficient permissions" su thumbnails.set,
 * sempre), quindi il tentativo via API in uploadVideo (lib.js) fallisce
 * sempre. YouTube sceglie allora un fotogramma a caso del video come
 * copertina - senza alcun rapporto col titolo. Bruciando il design nei
 * primi secondi del video stesso, qualunque fotogramma YouTube scelga in
 * quella finestra E' il design voluto, senza bisogno di alcun permesso.
 *
 * Lo sfondo viene estratto dallo STESSO video che si sta modificando, quindi
 * ha sempre la sua stessa risoluzione/aspect ratio: a differenza della
 * miniatura API (sempre 1280x720 landscape, indipendentemente
 * dall'orientamento del video) qui non serve alcun ritaglio, solo uno
 * scale=W:H sicuro perche' sorgente e destinazione condividono l'aspect
 * ratio.
 *
 * Non solleva mai: se qualunque passaggio fallisce il video resta quello
 * originale, invariato - un video senza il fix e' molto meglio di nessun
 * video.
 */
function probeDuration(videoPath) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", videoPath,
  ]).toString().trim();
  return parseFloat(out);
}

/**
 * Sovrappone la card in TRE punti del video (inizio, meta', quasi-fine),
 * non solo all'inizio.
 *
 * STORIA DEL FIX (2026-08-03, importante, non ripetere l'errore): la prima
 * versione bruciava la card SOLO nei primi 4 secondi, sull'assunto che
 * YouTube scegliesse un fotogramma iniziale come copertina automatica.
 * Verificato FALSO sul video realmente pubblicato pyJE_gTUuO4: la copertina
 * mostrava un fotogramma a caso da ~t=170s (quasi la fine di un video di
 * 174s), non la card - trovato ispezionando fotogrammi campione lungo tutto
 * il video e confrontandoli con la copertina reale. Bruciarla in tre
 * finestre (inizio/meta'/quasi-fine) copre molte piu' posizioni possibili
 * per lo stesso costo proporzionale (~12s su un video di alcuni minuti).
 * Non e' una garanzia (l'algoritmo di selezione di YouTube non e'
 * documentato pubblicamente), ma una copertura molto piu' ampia della
 * singola finestra gia' dimostrata insufficiente.
 */
function bakeThumbnailCard(videoPath, title, cardSeconds = 4, accent = THUMBNAIL_ACCENT_COLORS[0]) {
  const cardPath = path.join(OUTPUT_DIR, "_card.jpg");
  const tmpOut = videoPath + ".card.mp4";
  try {
    const { width, height } = probeDimensions(videoPath);
    const filter = drawTextFilter(title, width, height, accent, OUTPUT_DIR);
    execFileSync(
      "ffmpeg",
      ["-y", "-ss", "1", "-i", videoPath, "-frames:v", "1", "-vf", filter, "-q:v", "2", cardPath],
      { stdio: "pipe" }
    );

    const duration = probeDuration(videoPath);
    let windows;
    if (!duration || duration <= cardSeconds * 2) {
      windows = [0];
    } else {
      windows = [0, duration * 0.5, Math.max(0, duration - cardSeconds - 2)];
    }
    const enableExpr = windows
      .map((w) => `between(t,${w.toFixed(2)},${(w + cardSeconds).toFixed(2)})`)
      .join("+");

    execFileSync(
      "ffmpeg",
      [
        "-y", "-i", videoPath, "-i", cardPath,
        "-filter_complex", `[0:v][1:v]overlay=0:0:enable='${enableExpr}'[v]`,
        "-map", "[v]", "-map", "0:a",
        "-c:v", "libx264", "-preset", "medium", "-b:v", "10000k",
        "-c:a", "copy",
        "-movflags", "+faststart",
        tmpOut,
      ],
      { stdio: "pipe" }
    );
    fs.renameSync(tmpOut, videoPath);
    console.log(`[thumbnail] card iniziale bruciata nei primi ${cardSeconds}s`);
    return true;
  } catch (err) {
    console.warn(`[thumbnail] card iniziale saltata (${err.message}) - video invariato`);
    try {
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    } catch (_) {
      // pulizia del temporaneo, non deve mai mascherare l'errore vero sopra
    }
    return false;
  } finally {
    // Bug reale trovato 2026-08-03: su Windows il file appena scritto da
    // ffmpeg puo' restare brevemente "in uso" (indicizzazione, antivirus),
    // e unlinkSync lancia EBUSY - dentro un finally questo SOSTITUIVA il
    // valore di ritorno del try con un'eccezione non gestita, facendo
    // crashare l'intero script PRIMA di arrivare a uploadVideo(). Un file
    // temporaneo da 50KB rimasto su disco non e' un problema; pubblicare
    // il video lo e'.
    try {
      if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
    } catch (_) {
      // vedi commento sopra
    }
    try {
      cleanupDrawtextFiles(OUTPUT_DIR);
    } catch (_) {
      // vedi commento sopra
    }
  }
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

  // Pool di titoli ampliato 2026-08-13 (richiesta esplicita: i video del
  // canale "spuntano sempre con le stesse cose") - i 5 template originali
  // erano TUTTI la stessa formula listicle "N Windows Tweaks...", solo
  // riformulata: variavano le parole, non l'angolo. Aggiunte varianti che
  // seguono i pattern vincenti trovati dalla ricerca AI di YouTube Studio
  // per questo canale (2026-08-12, vedi TEAM_LOG/memoria): "why X is
  // secretly ruining/draining Y" al posto del conteggio, piu' le frasi di
  // ricerca reali con piu' domanda ("how to optimize pc for gaming", "what
  // to do when you get a new pc", "how to stress test your new pc").
  // Enfasi maiuscola su UNA parola per meta' dei template (2026-08-19,
  // ricerca CTR/title-formula 2026: humbleandbrag.com e ytzolo.com
  // concordano entrambi che maiuscolare una singola parola chiave - non
  // l'intero titolo, che legge come spam - e' una leva CTR indipendente
  // dalla formula del titolo stessa). Applicata solo a 5 dei 10 template,
  // non a tutti: la stessa logica di varieta' che ha motivato l'ampliamento
  // del pool il 2026-08-13 (vedi commento sopra) vale anche qui, un pattern
  // uniforme su ogni titolo sarebbe di nuovo "spuntano sempre con le stesse
  // cose" solo con le maiuscole al posto delle parole.
  const TITLE_TEMPLATES = [
    (n) => `${n} Windows Tweaks You NEED To Know (2026)`,
    (n) => `${n} Windows Settings You Should Change Today (2026)`,
    (n) => `I Changed ${n} Windows Settings. Here's What Happened (2026)`,
    (n) => `${n} Things Windows Turns On Without Asking You (2026)`,
    (n) => `${n} Windows Tweaks That ACTUALLY Made a Difference (2026)`,
    () => `The Windows Setting That's SECRETLY Draining Your FPS (2026)`,
    () => `Why Your New PC STILL Feels Slow (2026)`,
    () => `How To Optimize Your PC For Gaming In Under 5 Minutes (2026)`,
    () => `What To Do The Day You Get A New PC (2026)`,
    () => `I Stress-Tested My PC. Windows Was The BOTTLENECK (2026)`,
    (n) => `${n} Default Windows Settings That Are Secretly Ruining Your PC (2026)`,
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

  // Colore d'accento sorteggiato UNA VOLTA per video (2026-08-13) e passato
  // a entrambe le funzioni sotto, cosi' la miniatura API (se mai attiva) e
  // la card bruciata nel video restano coerenti tra loro.
  const thumbnailAccent = THUMBNAIL_ACCENT_COLORS[Math.floor(Math.random() * THUMBNAIL_ACCENT_COLORS.length)];

  // Miniatura col titolo in grande: su un long-form e' LA leva del click, e
  // senza YouTube ne sceglie una da un fotogramma a caso (tipicamente meta'
  // di una parola dei sottotitoli). Se fallisce si pubblica lo stesso.
  let thumbnailPath = null;
  try {
    thumbnailPath = buildThumbnail(outputPath, title, thumbnailAccent);
  } catch (err) {
    console.warn(`Miniatura non generata (${err.message}) - si prosegue senza`);
  }

  // Questo canale non ha il telefono verificato (confermato 2026-08-03,
  // l'API rifiuta sempre thumbnails.set) - il tentativo via API sopra resta
  // attivo (gratis, funziona da solo se il canale viene verificato in
  // futuro), ma nel frattempo brucia lo stesso design nei primi secondi del
  // video stesso. Va DOPO buildThumbnail: quella estrae il proprio
  // fotogramma dal video ancora originale, prima che questa lo modifichi.
  try {
    bakeThumbnailCard(outputPath, title, 4, thumbnailAccent);
  } catch (err) {
    // Difesa in profondita': bakeThumbnailCard non dovrebbe piu' lanciare
    // (vedi i suoi try/catch interni), ma un problema sulla copertina non
    // deve MAI bloccare la pubblicazione di un video gia' renderizzato.
    console.warn(`[thumbnail] card iniziale saltata (${err.message}) - si prosegue senza`);
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
