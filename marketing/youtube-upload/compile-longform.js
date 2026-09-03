// Builds a "normal" (non-Shorts) video for PC Tweaker by concatenating
// several Reels already published individually from marketing/published/ -
// unlike the other channels (xn0time, SoloFounded, etc), there is no pool of
// facts here to generate new content from: the material is already
// everything that exists (the Reels produced by marketing/reel-generator).
// No reinventing content, just a remix in a longer format - the same
// principle as Groomlyco/Magdock's "buying guide" countdown.
//
// Usage: node compile-longform.js [--count 6]

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { uploadVideo } = require("./lib");

// ffmpeg's concat demuxer maps streams automatically from the FIRST file in
// the list: if that one has no audio track, the whole concatenated output
// loses the audio of EVERY clip, including the ones that have it (real bug
// found 2026-08-01: myth-bust-rollback.mp4 is video-only, and a silent video
// went out by mistake - deleted, and fixed here: clips without audio are now
// discarded up front).
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
  // Prefer the clips used least often in previous compilations, so that over
  // time they rotate instead of repeating the same ones (the pool is small
  // today - 9 clips - but grows as new Reels are published).
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

// The drive letter's colon ("C:/...") has to be protected: in ffmpeg filter
// syntax ':' separates options, so an unescaped Windows path breaks the whole
// filterchain even inside quotes (observed: "Error parsing filterchain"
// immediately after the first drawtext).
const THUMB_FONT = path
  .join(ROOT, "reel-generator", "assets", "fonts", "Poppins-ExtraBold.ttf")
  .replace(/\\/g, "/")
  .replace(/:/g, "\\:");

/**
 * A 1280x720 thumbnail: a frame of the video, blurred and darkened, plus the
 * TITLE set large. Done with ffmpeg (drawtext) rather than an image library so
 * as not to add npm dependencies to this package.
 *
 * The background is blurred and darkened, otherwise white becomes illegible
 * over the light areas - which is exactly what makes YouTube's automatic
 * thumbnails useless.
 */
// Colons carry meaning in ffmpeg filter syntax, so a PATH still has to be
// escaped (see THUMB_FONT above). TEXT no longer goes through the inline
// text='...' option at all: an apostrophe inside a single-quoted value has no
// reliable escape in that syntax.
//
// The apostrophe used to be stripped outright, which was verified by actually
// burning a title containing one into a video: "Here's What Happened" came
// out as "HERES WHAT HAPPENED", a permanent grammatical error that cannot be
// corrected after publishing. The 'It'\''s' form was then tried live
// (2026-08-03) and broke parsing of the entire filterchain, printing the next
// drawtext's parameters on screen as literal text - worse than the original
// defect.
//
// The robust fix: write the text to a file and use the textfile= option,
// which reads the content as-is without parsing escapes inside it - an
// apostrophe in the file is just a character, not syntax.
function escFfmpegPath(p) {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

/**
 * The ffmpeg drawtext filter for the title, at ANY size (width x height) -
 * shared by buildThumbnail (always 1280x720, the format the API requires) and
 * bakeThumbnailCard (the video's REAL dimensions, 2026-08-03, for the bake-in
 * - see below for why that exists).
 *
 * charsPerLine/fontSize/lineH scale with the width: a font fixed at 76px, which
 * reads well at 1280px wide, would be tiny on a much wider frame and out of
 * proportion on a narrower one.
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

// Rotating accent-bar colour (2026-08-13): before this it was the same blue
// on every cover, one of the reasons the videos all looked alike in a grid.
// High contrast against the darkened/blurred background, the same reasoning
// already supported by the Studio research (winning thumbnails in this niche
// use high-contrast colours, not one fixed accent).
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
 * Reads the video's REAL resolution with ffprobe - it is not assumed, because
 * although this compilation is always vertical (a concat of 1080x1920 Reels),
 * assuming that up front would be fragile if the source format ever changed.
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
 * Overlays a card carrying the title, set large, over the first CARD_SECONDS
 * of the video, IN PLACE - working around the block on custom thumbnails for a
 * channel with no verified phone number.
 *
 * Why it exists (2026-08-03): confirmed live that this channel has no verified
 * phone number (403 "insufficient permissions" on thumbnails.set, every time),
 * so the API attempt in uploadVideo (lib.js) always fails. YouTube then picks a
 * random frame of the video as the cover - with no relation to the title. By
 * burning the design into the first seconds of the video itself, whatever frame
 * YouTube picks inside that window IS the intended design, with no permission
 * needed.
 *
 * The background is extracted from the SAME video being modified, so it always
 * shares its resolution and aspect ratio: unlike the API thumbnail (always
 * 1280x720 landscape, whatever the video's orientation) no crop is needed here,
 * only a scale=W:H that is safe because source and destination share the aspect
 * ratio.
 *
 * Never throws: if any step fails the video is left as the original, unchanged -
 * a video without the fix is far better than no video.
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
      // cleaning up the temp file must never mask the real error above
    }
    return false;
  } finally {
    // Real bug found 2026-08-03: on Windows a file ffmpeg has just written
    // can stay briefly "in use" (indexing, antivirus), and unlinkSync throws
    // EBUSY - inside a finally that REPLACED the try's return value with an
    // unhandled exception, crashing the whole script BEFORE it ever reached
    // uploadVideo(). A 50KB temp file left on disk is not a problem; failing
    // to publish the video is.
    try {
      if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
    } catch (_) {
      // see the comment above
    }
    try {
      cleanupDrawtextFiles(OUTPUT_DIR);
    } catch (_) {
      // see the comment above
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
  // Explicit -map (rather than leaving stream selection to the first file)
  // so it fails loudly when audio is missing, instead of silently producing a
  // silent video the way it did the first time.
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", concatListPath, "-map", "0:v:0", "-map", "0:a:0", "-c", "copy", outputPath],
    { stdio: "inherit" }
  );

  // Title pool widened 2026-08-13 (explicit complaint: the channel's videos
  // "always turn up with the same stuff") - all 5 original templates were the
  // same listicle formula, "N Windows Tweaks...", merely reworded: the words
  // varied, the angle did not. Added variants following the winning patterns
  // YouTube Studio's AI research found for this channel (2026-08-12, see
  // TEAM_LOG/memory): "why X is secretly ruining/draining Y" instead of a
  // count, plus the real search phrases with the most demand ("how to
  // optimize pc for gaming", "what to do when you get a new pc", "how to
  // stress test your new pc").
  //
  // Capitalised emphasis on ONE word in half the templates (2026-08-19,
  // CTR/title-formula research 2026: humbleandbrag.com and ytzolo.com both
  // agree that capitalising a single keyword - not the whole title, which
  // reads as spam - is a CTR lever independent of the title formula itself).
  // Applied to 5 of the 10 templates, not all: the same variety argument that
  // motivated widening the pool on 2026-08-13 (see above) applies here too, a
  // uniform pattern on every title would again be "always the same stuff",
  // just with capitals instead of words.
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
  // Wider API tags: the field holds ~500 characters and tags are a different
  // channel from the visible hashtags, so it is worth using rather than
  // stopping at 5.
  const tags = [
    "windows tweak", "pc optimizer", "windows 11 tips", "free software", "open source",
    "speed up pc", "windows 11 performance", "debloat windows", "pc maintenance",
    "windows settings", "gaming pc optimization", "pc tweaker",
  ];

  // Accent colour drawn ONCE per video (2026-08-13) and passed to both
  // functions below, so the API thumbnail (if it is ever enabled) and the
  // card burned into the video stay consistent with each other.
  const thumbnailAccent = THUMBNAIL_ACCENT_COLORS[Math.floor(Math.random() * THUMBNAIL_ACCENT_COLORS.length)];

  // Thumbnail with the title set large: on a long-form video this is THE
  // click lever, and without one YouTube picks a random frame (typically half
  // a word of the subtitles). If it fails, publish anyway.
  let thumbnailPath = null;
  try {
    thumbnailPath = buildThumbnail(outputPath, title, thumbnailAccent);
  } catch (err) {
    console.warn(`Thumbnail not generated (${err.message}) - continuing without it`);
  }

  // This channel has no verified phone number (confirmed 2026-08-03, the API
  // always rejects thumbnails.set) - the API attempt above stays in place
  // (free, and starts working on its own if the channel is ever verified),
  // but meanwhile the same design is burned into the first seconds of the
  // video itself. This must run AFTER buildThumbnail: that one extracts its
  // frame from the still-original video, before this modifies it.
  try {
    bakeThumbnailCard(outputPath, title, 4, thumbnailAccent);
  } catch (err) {
    // Defence in depth: bakeThumbnailCard should no longer throw (see its
    // own internal try/catch), but a problem with the cover must NEVER block
    // publishing a video that has already been rendered.
    console.warn(`[thumbnail] opening card skipped (${err.message}) - continuing without it`);
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
