"""
Renders the final Reel: vertical (1080x1920) background video, voice audio,
timed captions, and a persistent "PC Tweaker" watermark (no plain website
domain to show - the app is distributed via winget/GitHub Releases, so the
watermark reinforces the name to search instead of a URL).
"""
import glob
import os
import random
import shutil

# moviepy 1.0.3's resize code still references Image.ANTIALIAS, which
# Pillow removed in 10.0. Rather than pin an old Pillow (no prebuilt wheel
# for newer Python versions - see requirements.txt), restore the constant
# as an alias for its replacement before moviepy is imported.
from PIL import Image
if not hasattr(Image, "ANTIALIAS"):
    Image.ANTIALIAS = Image.LANCZOS

# This pipeline runs locally (Windows Scheduled Task), not in a fresh CI
# container. Two local-only quirks to work around:
# 1. A newly-run terminal session may not have picked up ImageMagick's PATH
#    entry yet even right after installing it.
# 2. ImageMagick 7's Windows installer only ships magick.exe, not the
#    legacy convert.exe moviepy's own auto-detection assumes/caches - so
#    auto-detect silently resolves to a binary that doesn't exist. Set
#    IMAGEMAGICK_BINARY explicitly instead of trusting auto-detect.
if not os.environ.get("IMAGEMAGICK_BINARY"):
    magick_path = shutil.which("magick")
    if not magick_path:
        candidates = sorted(glob.glob(r"C:\Program Files\ImageMagick-*\magick.exe"), reverse=True)
        magick_path = candidates[0] if candidates else None
    if magick_path:
        os.environ["IMAGEMAGICK_BINARY"] = magick_path
        os.environ["PATH"] = os.path.dirname(magick_path) + os.pathsep + os.environ.get("PATH", "")

import subprocess

from moviepy.editor import (
    VideoFileClip,
    ImageClip,
    AudioFileClip,
    TextClip,
    ColorClip,
    CompositeAudioClip,
    CompositeVideoClip,
    concatenate_videoclips,
    concatenate_audioclips,
)

def _ensure_rgb_jpeg(image_path: str) -> str:
    """Pexels photos (footage.download_photo) are usually plain RGB JPEGs,
    but some source images are grayscale ("L" mode, black & white stock
    photography) or CMYK - moviepy/numpy then hands ffmpeg a frame with
    shape != (h, w, 3), breaking caption compositing on top (same class of
    bug fixed live 2026-08-19 in power-ledger-bot/src/render.py for
    Wikimedia/LoC archive scans). Normalize to RGB, caching the converted
    copy next to the original so repeat runs skip the reconversion."""
    converted_path = os.path.splitext(image_path)[0] + ".converted.jpg"
    if os.path.exists(converted_path):
        return converted_path
    with Image.open(image_path) as img:
        if img.mode == "RGB":
            return image_path
        img.convert("RGB").save(converted_path, "JPEG", quality=92)
    return converted_path


TARGET_W, TARGET_H = 1080, 1920

# Bitrate espliciti e normalizzazione loudness: aggiunti il 2026-08-04 per
# omologare questo generatore a solofounded-bot e shopify-dropship-bot, che
# li avevano gia'. Qui mancavano entrambi, quindi moviepy usava i suoi
# default silenziosi.
#
# Misurato prima della correzione su video REALI gia' pubblicati
# (reel-beforeafter-1785775480-5021, reel-beforeafter-1785692772-2458):
# -19.6 / -19.7 LUFS integrati, contro i -14.1 LUFS di solofounded. Circa 6 dB
# sotto ogni altro account: nel feed, dove i video si susseguono uno dopo
# l'altro, un audio piu' basso di 6 dB suona "debole" e spinge allo scroll.
# Lo standard di riferimento per streaming/social e' -14 LUFS.
VIDEO_BITRATE = "12000k"
AUDIO_BITRATE = "192k"
LOUDNORM_FILTER = "loudnorm=I=-14:TP=-1.5:LRA=11"

# Colori "sbiaditi" segnalati su Instagram (2026-08-14): nessun tag esplicito
# di range/colorspace nei metadati - Instagram puo' indovinare male in
# ricodifica lato server, sintomo tipico contrasto/saturazione ridotti,
# invisibile sul file locale. Stesso fix in parallelo su solofounded-bot/
# shopify-dropship-bot/certsprint-reels-bot.
_COLOR_TAGS = ["-pix_fmt", "yuv420p", "-color_range", "tv",
               "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]


def _normalize_loudness(path: str) -> None:
    """Porta l'audio del video gia' renderizzato a -14 LUFS.

    Portata da solofounded-bot/src/render.py: NON si puo' fare passando
    ffmpeg_params=["-af", ...] a write_videofile, perche' moviepy muxa
    l'audio in "codec copy" e ffmpeg rifiuta filtro + streamcopy insieme
    ("Filtering and streamcopy cannot be used together").

    Il video e' copiato bit-per-bit (-c:v copy): nessuna ricompressione
    video, si ricodifica solo l'audio. Se ffmpeg fallisce il file originale
    resta intatto - un audio non normalizzato e' molto meglio di nessun
    video, quindi l'eccezione non deve mai far fallire la generazione.
    """
    import subprocess

    tmp_path = path + ".norm.mp4"
    cmd = [
        "ffmpeg", "-y", "-i", path,
        "-c:v", "copy",
        "-af", LOUDNORM_FILTER,
        # -ar 48000 esplicito (2026-08-06): loudnorm lavora internamente a
        # 192 kHz e senza sample rate imposto trascinava l'encoder a 96 kHz
        # (misurato sui video reali). 48 kHz e' lo standard per il video.
        "-c:a", "aac", "-b:a", AUDIO_BITRATE, "-ar", "48000",
        # Questa passata rimuxa: senza ri-specificare +faststart il moov atom
        # tornerebbe in fondo, riportando il bug del "primo tap non parte".
        "-movflags", "+faststart",
        tmp_path,
    ]
    try:
        # Rendering must remain bounded: if ffmpeg stalls on a malformed
        # asset, keep the already-rendered video and let the next scheduled
        # job run instead of blocking the generator indefinitely.
        subprocess.run(cmd, check=True, capture_output=True, timeout=120)
        shutil.move(tmp_path, path)
        print(f"[render] audio normalizzato a -14 LUFS: {os.path.basename(path)}", flush=True)
    except Exception as exc:
        print(f"[render] normalizzazione audio saltata ({exc}) - video invariato", flush=True)
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# Shared, org-wide pool of real royalty-free (no-attribution) tracks - not
# specific to this repo, so it lives one level above every brand's own
# marketing folder (Desktop/Youtube/shared-assets/music/<vibe>/). This
# generator's vibe is upbeat. Picking from real tracks instead of the old
# synthesized sine-wave bed (2026-08-19): the synth chord was serviceable as
# a stopgap but reads as an obvious placeholder next to any Reel with a real
# soundtrack, and a shared pool means one download batch serves every bot.
MUSIC_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "..", "Youtube", "shared-assets", "music", "upbeat"
)


def _pick_real_track() -> str | None:
    """Returns a random real track path from MUSIC_DIR, or None if the
    folder is missing/empty (keeps the synthesized bed as a documented
    fallback so rendering never breaks if the shared pool moves/empties)."""
    if not os.path.isdir(MUSIC_DIR):
        return None
    tracks = [
        os.path.join(MUSIC_DIR, f)
        for f in os.listdir(MUSIC_DIR)
        if f.lower().endswith((".mp3", ".wav", ".m4a"))
    ]
    return random.choice(tracks) if tracks else None


def _real_bg_music(duration: float) -> AudioFileClip | None:
    """Loops/trims a real track from MUSIC_DIR to exactly `duration`,
    quiet under the narration (0.12, same level as power-ledger-bot's
    _mix_audio - the reference this pattern is modeled on). Returns None
    if no real track is available, so the caller can fall back to the
    synthesized bed."""
    track_path = _pick_real_track()
    if not track_path:
        return None
    print(f"[render] real bg music selected: {os.path.basename(track_path)}", flush=True)
    clip = AudioFileClip(track_path)
    if clip.duration < duration:
        loops = int(duration // clip.duration) + 1
        clip = concatenate_audioclips([clip] * loops)
    # FIX (2026-08-21, measured): 0.12 on real tracks from the shared
    # "upbeat" pool gave only 14.1-19.7 dB under a real voice clip
    # (output/audio_0.mp3, -20.2 dB mean) depending on which track was
    # picked - one case landed just under the 15-25 dB standard. 0.07
    # keeps both pool tracks comfortably inside the range.
    clip = clip.subclip(0, duration).volumex(0.07)
    print(f"[render] real bg music mixed, trimmed to {duration:.2f}s", flush=True)
    return clip


def _generate_bg_music(path: str, duration: float) -> None:
    """Synthesized ambient bed (no external sample - avoids any copyright
    risk), same pattern already used for CertSprint/Groomlyco/Magdock. Very
    low volume under the narration, slow crescendo. These Reels previously
    had zero background music, only the voice.

    FALLBACK ONLY (2026-08-19): superseded by _real_bg_music, which pulls a
    real royalty-free track from MUSIC_DIR. This stays as the safety net
    for when that shared folder is missing or empty."""
    fade_in = min(duration * 0.4, 6.0)
    fade_out = min(duration * 0.15, 2.0)
    fade_out_start = max(duration - fade_out, 0.0)
    notes = [130.81, 164.81, 196.00]  # soft C major chord (C-E-G)
    cmd = ["ffmpeg", "-y"]
    for freq in notes:
        cmd += ["-f", "lavfi", "-i", f"sine=frequency={freq}:duration={duration}"]
    cmd += [
        "-filter_complex",
        f"amix=inputs={len(notes)}:duration=longest,"
        f"volume=0.05,"
        f"afade=t=in:st=0:d={fade_in:.3f},"
        f"afade=t=out:st={fade_out_start:.3f}:d={fade_out:.3f}",
        str(path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def _generate_whoosh(path: str, duration: float = 0.3) -> None:
    """Synthesized whoosh marking scene cuts. The previous wide band
    (800-6000Hz) at volume 0.35 let both the low "rumble" and the high hiss
    of the raw pink noise through - without a frequency sweep (real whooshes
    use a moving filter, not a fixed band) it read as a harsh scrape/rub
    instead of a soft transition (user report 2026-08-02, same bug found on
    the sibling Groomlyco/Magdock pipeline). Narrower/centered band, much
    lower volume, longer softer fades."""
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", f"anoisesrc=color=pink:duration={duration}:sample_rate=44100",
        "-af", (
            "highpass=f=2500,lowpass=f=4500,"
            "afade=t=in:st=0:d=0.1,"
            f"afade=t=out:st={duration - 0.12:.3f}:d=0.12,"
            "volume=0.12"
        ),
        str(path),
    ], check=True, capture_output=True)


def _build_full_audio(voice_audio: AudioFileClip, duration: float, cut_times: list, tmp_path: str) -> CompositeAudioClip:
    """Layers a quiet ambient bed plus a short whoosh on every scene cut
    under the narration - narration itself is never touched/attenuated."""
    bg_music = _real_bg_music(duration)
    if bg_music is None:
        print("[render] no real track in MUSIC_DIR - falling back to synthesized bed", flush=True)
        bg_music_path = tmp_path + "_bgmusic.mp3"
        _generate_bg_music(bg_music_path, duration)
        bg_music = AudioFileClip(bg_music_path)

    whoosh_path = tmp_path + "_whoosh.wav"
    _generate_whoosh(whoosh_path)
    whoosh_layers = [AudioFileClip(whoosh_path).set_start(t) for t in cut_times]

    return CompositeAudioClip([bg_music, voice_audio, *whoosh_layers])

# Bundled font instead of a generic system font (DejaVu Sans) - Poppins
# ExtraBold (OFL-licensed, assets/fonts/) is the same rounded-bold style
# used by the majority of high-retention TikTok/Reels caption overlays,
# and bundling it as a file means rendering doesn't depend on whatever
# fonts happen to be installed on the machine/CI runner.
# ImageMagick's Windows build silently falls back to a default/thin font
# (no error) when given a font path with backslashes - confirmed by
# comparing the raw ImageMagick command with forward vs back slashes
# (2026-07-30, this pipeline runs on Windows). Always use forward slashes.
FONT_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "Poppins-ExtraBold.ttf").replace(os.sep, "/")

# 4 parole per blocco (era 2, allineato 2026-08-04). Ultimo dei quattro
# generatori a passare a 4: certsprint, solofounded e shopify erano gia'
# stati corretti in giornata. I frammenti da 2 parole non compongono mai
# una frase leggibile - verificato estraendo i fotogrammi di Reel reali
# ("watchable Throw" / "room before"), lo spettatore deve ricostruire il
# senso mentre lo sfondo cambia sotto.
CAPTION_CHUNK_SIZE = 4
CAPTION_FONTSIZE = 80
CAPTION_Y = int(TARGET_H * 0.62)
CAPTION_BAND_Y = int(TARGET_H * 0.56)
CAPTION_BAND_HEIGHT = int(TARGET_H * 0.22)
CAPTION_POP_SECONDS = 0.12  # quick scale-up on each chunk's entrance, not a static cut

# Quando preserve_landscape=True lo sfondo e' il ritaglio della UI reale
# (vedi _fit_product_demo): un canvas 1080x1920 con la card dell'app
# ridimensionata a larghezza piena e centrata VERTICALMENTE, quindi occupa
# solo la fascia centrale (circa il 34%-66% dell'altezza), non l'intero
# fotogramma. CAPTION_Y standard (62%) cade dentro quella fascia e
# coprirebbe la UI appena mostrata - per questo main.py aveva
# show_captions=False in questo ramo, spegnendo le didascalie invece di
# spostarle. Ma i dati 2026 sono netti: le didascalie alzano il watch time
# medio del 20-40% ANCHE con audio attivo (Opus, "Instagram Reels Caption
# & Subtitle Best Practices in 2026",
# https://www.opus.pro/blog/instagram-reels-caption-subtitle-best-practices;
# Zebracat, "100+ Instagram Reels Statistics for 2026",
# https://www.zebracat.ai/post/instagram-reels-statistics) - spegnerle del
# tutto scarta quel guadagno invece di risolvere la sovrapposizione.
# Le si sposta piu' in basso, nello spazio di canvas libero sotto la card,
# cosi' restano leggibili senza coprire la demo.
CAPTION_Y_PRODUCT_DEMO = int(TARGET_H * 0.74)

WATERMARK_TEXT = "PC Tweaker"
WATERMARK_FONTSIZE = 52  # was 34 - too small to read at a glance (user feedback 2026-08-02)
WATERMARK_Y = int(TARGET_H * 0.10)  # was 0.06 - too close to the very top edge/status bar; still clear of the Reels/TikTok bottom UI overlay

SLIDESHOW_ZOOM_PER_SECOND = 0.03

# Background video cuts to a different clip every 4-7s (randomized so it
# doesn't feel mechanical) - 2026 Reels retention research points to
# "pattern interrupts" (cuts/zooms/visual changes every few seconds) as a
# real retention driver, and video-scripts.md's own research says the same
# for this niche (movement + hook + text simultaneously in the first 3s).
# A fresh visual beat every ~2 seconds prevents the stock-footage loop from
# reading as a static explainer before the viewer has received the payoff.
SCENE_MIN_SECONDS = 1.4
SCENE_MAX_SECONDS = 2.4


def _fit_vertical(clip: VideoFileClip) -> VideoFileClip:
    target_ratio = TARGET_W / TARGET_H
    if clip.w / clip.h > target_ratio:
        clip = clip.resize(height=TARGET_H)
    else:
        clip = clip.resize(width=TARGET_W)
    return clip.crop(
        x_center=clip.w / 2,
        y_center=clip.h / 2,
        width=TARGET_W,
        height=TARGET_H,
    )


def _fit_product_demo(clip: VideoFileClip) -> CompositeVideoClip:
    """Frames the useful UI cleanly in a vertical canvas.

    The desktop walkthrough contains unrelated desktop chrome and baked
    lower-third titles. Crop those edges before fitting the actual app as a
    readable 16:9 card.  Use a single branded canvas behind it: duplicating
    a full-HD moving background for every scene exhausted memory during a
    preview and is not safe for a scheduled job.
    """
    ui = clip.crop(x1=190, y1=90, x2=1540, y2=850).resize(width=TARGET_W)
    canvas = ColorClip((TARGET_W, TARGET_H), color=(18, 11, 35), duration=clip.duration)
    return CompositeVideoClip(
        [canvas, ui.set_position(("center", "center"))],
        size=(TARGET_W, TARGET_H),
    ).set_duration(clip.duration)


def _loop_to_duration(clip: VideoFileClip, duration: float) -> VideoFileClip:
    if clip.duration >= duration:
        return clip.subclip(0, duration)
    n_loops = int(duration // clip.duration) + 1
    return concatenate_videoclips([clip] * n_loops).subclip(0, duration)


def _caption_clips_from_words(word_timings: list, duration: float, skip_before: float = 0.0, caption_end_word: int | None = None, caption_text: str | None = None, caption_y: int = CAPTION_Y):
    """Builds caption chunks positioned at the REAL spoken time of each word
    (from edge-tts's WordBoundary events) instead of guessing an equal
    split over the audio duration.

    skip_before: quando c'e' l'hook card, le didascalie dei primi secondi
    ripetono il testo gia' mostrato per intero dalla card - due riquadri
    sovrapposti che dicono la stessa cosa. Si saltano."""
    if not word_timings:
        return []

    # The spoken CTA is retained for conversion and the full CTA remains in
    # the post caption, but it is not rendered as fragmented subtitles.
    if caption_end_word is not None:
        word_timings = word_timings[:max(0, caption_end_word)]

    if caption_text:
        text_words = caption_text.split()[:len(word_timings)]
        chunks, current = [], []
        for i, timed_word in enumerate(word_timings):
            current.append(timed_word)
            source_word = text_words[i] if i < len(text_words) else timed_word[0]
            # Close on real sentence punctuation after a useful phrase, or
            # at five words. This prevents orphaned fragments such as
            # "off makes every flick" from appearing as a subtitle.
            if (len(current) >= 3 and source_word.rstrip('”\"').endswith(('.', '!', '?'))) or len(current) >= 5:
                chunks.append(current)
                current = []
        if current:
            chunks.append(current)
    else:
        chunks = [
            word_timings[i:i + CAPTION_CHUNK_SIZE]
            for i in range(0, len(word_timings), CAPTION_CHUNK_SIZE)
        ]

    clips = []
    for i, chunk in enumerate(chunks):
        text = " ".join(w for w, _, _ in chunk)
        start = chunk[0][1]
        if i + 1 < len(chunks):
            end = chunks[i + 1][0][1]
        else:
            last_word, last_start, last_dur = chunk[-1]
            end = min(last_start + last_dur + 0.3, duration)
        chunk_duration = max(end - start, 0.05)
        if start < skip_before:
            continue

        # Quick scale pop-in (0.85x -> 1.0x over CAPTION_POP_SECONDS) instead
        # of a static hard cut - makes each new chunk feel like a "hit" in
        # sync with the word landing, the caption-motion style that reads as
        # produced/edited rather than a flat subtitle track.
        pop = min(CAPTION_POP_SECONDS, chunk_duration / 2)

        def _pop_scale(t, pop=pop):
            if t >= pop:
                return 1.0
            return 0.85 + 0.15 * (t / pop)

        txt = TextClip(
            text,
            fontsize=CAPTION_FONTSIZE,
            color="white",
            stroke_color="black",
            stroke_width=4,
            method="caption",
            size=(TARGET_W - 100, None),
            font=FONT_PATH,
        ).set_duration(chunk_duration)

        # Sfondo ADERENTE al testo invece della vecchia fascia larga
        # (2026-08-05). La banda copriva il 22% del fotogramma al 35% di
        # opacita' per tutta la durata del video: non abbastanza da far
        # risaltare il testo, abbastanza da annebbiare un quinto
        # dell'immagine anche senza didascalie a schermo - la causa dei
        # "video sbiaditi" segnalati dall'utente. 0.78 e' lo stesso valore
        # della hook card, che si legge nitida.
        text_w, text_h = txt.size
        backdrop = (
            ColorClip(size=(text_w + 40, text_h + 28), color=(0, 0, 0))
            .set_opacity(0.78)
            .set_duration(chunk_duration)
        )

        # Il pop d'ingresso va applicato SOLO al testo: un .resize() animato
        # sul composito che contiene lo sfondo ne distrugge la maschera di
        # trasparenza e il riquadro sparisce (verificato in isolamento il
        # 2026-08-05 sul progetto gemello, rendendo la stessa didascalia con
        # e senza resize). E' un difetto di moviepy nel propagare la mask
        # attraverso un resize animato.
        txt_clip = (
            CompositeVideoClip(
                [backdrop, txt.resize(_pop_scale).set_position(("center", "center"))],
                size=(text_w + 40, text_h + 28),
            )
            .set_start(start)
            .set_duration(chunk_duration)
            .set_position(("center", caption_y))
            # Cheap opacity fade-in on top of the existing scale pop-in
            # (2026-08-19): the pop alone is a size "hit", but the chunk was
            # still fully opaque on frame 1, a harder edge than most produced
            # caption styles use. fadein() is a plain per-frame alpha ramp -
            # no mask-through-resize issue like the pop scale above, since it
            # is applied to the whole composite, not animated during the
            # resize.
            .fadein(min(0.15, chunk_duration / 3))
        )
        clips.append(txt_clip)
    return clips


def _ken_burns_image_clip(image_path: str, duration: float):
    img = ImageClip(_ensure_rgb_jpeg(image_path)).set_duration(duration)
    img = _fit_vertical(img)
    zoomed = img.resize(lambda t: 1 + SLIDESHOW_ZOOM_PER_SECOND * t).set_position("center")
    return CompositeVideoClip([zoomed], size=(TARGET_W, TARGET_H)).set_duration(duration)


def _slideshow_background(image_paths: list, image_starts: list, total_duration: float):
    starts = list(image_starts)
    starts[0] = 0.0
    ends = starts[1:] + [total_duration]

    clips = []
    for image_path, start, end in zip(image_paths, starts, ends):
        duration = max(end - start, 0.3)
        clip = _ken_burns_image_clip(image_path, duration).set_start(start)
        clips.append(clip)
    return CompositeVideoClip(clips, size=(TARGET_W, TARGET_H)).set_duration(total_duration)


def _multi_clip_background(video_paths: list, total_duration: float, preserve_landscape: bool = False):
    """Cuts between several background clips every 4-7s instead of looping
    one clip for the whole Reel. Returns (composite_clip, cut_times) - the
    cut times feed the whoosh sound design on each scene change."""
    clips = []
    cut_times = []
    t = 0.0
    i = 0
    while t < total_duration:
        segment_duration = min(random.uniform(SCENE_MIN_SECONDS, SCENE_MAX_SECONDS), total_duration - t)
        path = video_paths[i % len(video_paths)]
        source = VideoFileClip(path)
        if source.duration > segment_duration:
            start_at = random.uniform(0, max(source.duration - segment_duration, 0))
            clip = source.subclip(start_at, start_at + segment_duration)
        else:
            clip = _loop_to_duration(source, segment_duration)
        fit = _fit_product_demo if preserve_landscape else _fit_vertical
        clip = fit(clip).set_start(t).set_duration(segment_duration)
        clips.append(clip)
        if t > 0:
            cut_times.append(t)
        t += segment_duration
        i += 1
    return CompositeVideoClip(clips, size=(TARGET_W, TARGET_H)).set_duration(total_duration), cut_times


def _caption_band(duration: float, start: float = 0.0):
    # start > 0 quando c'e' l'hook card: durante l'apertura l'unico elemento
    # grafico deve essere la card, altrimenti si vedono due riquadri scuri
    # sovrapposti.
    return (
        ColorClip(size=(TARGET_W, CAPTION_BAND_HEIGHT), color=(0, 0, 0))
        .set_opacity(0.35)
        .set_start(start)
        .set_duration(max(duration - start, 0.1))
        .set_position(("center", CAPTION_BAND_Y))
    )


# HOOK CARD (aggiunto 2026-08-02) - la leva piu' importante emersa
# dall'audit sulle view basse. Le didascalie sono sincronizzate a 2 parole
# per volta, quindi al fotogramma 0 si leggeva solo un frammento senza
# significato ("This is") proprio nei 3 secondi in cui lo spettatore decide
# se restare. La ricerca 2026 (Hansen Insights, Aibrify, HypeNest) e' netta:
# sotto l'80% di retention nei primi 3 secondi il video muore nel cold start
# e non viene mai distribuito. Ora la promessa COMPLETA e' leggibile subito.
HOOK_CARD_SECONDS = 2.8
HOOK_CARD_FONTSIZE = 66
HOOK_CARD_Y = int(TARGET_H * 0.16)


def _hook_card_clip(hook_text: str, duration: float, max_chars: int = 130):
    """Compact headline over live footage, never a static centre card.

    QC 2026-08-16: this used to hard-cut to the first 6 words with no
    ellipsis ("THIS TOOK ELEVEN SECONDS AND I" for a hook that continued
    "...wish I'd done it a year ago"), silently dropping the punchline in
    frame 0 - the exact regression the 2026-08-02 hook-card fix (comment
    above) was meant to prevent. xn0time/SoloFounded/Shopify all show the
    full first sentence instead; do the same here, only clipping on length
    (with an ellipsis) if it would otherwise overflow the card.
    """
    text = " ".join((hook_text or "").split())
    if not text:
        return []

    if len(text) > max_chars:
        text = text[:max_chars].rsplit(" ", 1)[0].rstrip(",;:") + "..."
    text = text.upper()

    txt = TextClip(
        text,
        fontsize=HOOK_CARD_FONTSIZE,
        color="#D8FF3E",
        stroke_color="black",
        stroke_width=5,
        method="caption",
        size=(TARGET_W - 100, None),
        font=FONT_PATH,
        align="center",
    ).set_duration(duration)
    return [txt.set_start(0).set_position(("center", HOOK_CARD_Y))]


def _watermark_clip(duration: float):
    return (
        TextClip(
            WATERMARK_TEXT,
            fontsize=WATERMARK_FONTSIZE,
            color="white",
            stroke_color="black",
            stroke_width=2,
            method="caption",
            size=(TARGET_W - 100, None),
            font=FONT_PATH,
        )
        .set_duration(duration)
        .set_position(("center", WATERMARK_Y))
        .set_opacity(0.85)
    )


def render_short(background_video_paths, audio_path: str, word_timings: list, output_path: str, hook: str = None, caption_end_word: int | None = None, caption_text: str | None = None, preserve_landscape: bool = False, show_captions: bool = True):
    if isinstance(background_video_paths, str):
        background_video_paths = [background_video_paths]

    audio = AudioFileClip(audio_path)
    background, cut_times = _multi_clip_background(background_video_paths, audio.duration, preserve_landscape=preserve_landscape)
    full_audio = _build_full_audio(audio, audio.duration, cut_times, output_path.replace(".mp4", ""))
    background = background.set_audio(full_audio)

    hook_seconds = min(HOOK_CARD_SECONDS, audio.duration) if hook else 0.0
    # Niente piu' _caption_band: ogni didascalia porta il proprio riquadro
    # aderente al testo (vedi _caption_clips_from_words). Quando
    # preserve_landscape=True la card dell'app occupa solo la fascia
    # centrale del canvas (vedi _fit_product_demo/CAPTION_Y_PRODUCT_DEMO
    # sopra): le didascalie vanno piu' in basso, nello spazio libero, invece
    # di essere spente.
    caption_y = CAPTION_Y_PRODUCT_DEMO if preserve_landscape else CAPTION_Y
    captions = _caption_clips_from_words(word_timings, audio.duration, skip_before=hook_seconds, caption_end_word=caption_end_word, caption_text=caption_text, caption_y=caption_y) if show_captions else []
    watermark = [] if preserve_landscape else [_watermark_clip(audio.duration)]
    hook_card = _hook_card_clip(hook, hook_seconds) if hook else []
    final = CompositeVideoClip([background] + watermark + captions + hook_card, size=(TARGET_W, TARGET_H))
    final = final.set_duration(audio.duration)

    final.write_videofile(
        output_path,
        fps=30,
        codec="libx264",
        audio_codec="aac",
        threads=4,
        preset="medium",
        bitrate=VIDEO_BITRATE,
        audio_bitrate=AUDIO_BITRATE,
        # moov atom in testa al file invece che in fondo - senza questo il
        # player deve scaricare l'intero file prima di poter leggere i
        # metadati, causando il classico 'primo tap non parte, secondo si'
        # (segnalato dall'utente 2026-08-02, moviepy non lo aggiunge di default).
        ffmpeg_params=["-movflags", "+faststart"] + _COLOR_TAGS,
    )
    _normalize_loudness(output_path)
    return output_path


def render_slideshow(image_paths: list, image_starts: list, audio_path: str, word_timings: list, output_path: str, hook: str = None, caption_end_word: int | None = None):
    audio = AudioFileClip(audio_path)
    background = _slideshow_background(image_paths, image_starts, audio.duration)
    cut_times = [t for t in image_starts if t > 0]
    full_audio = _build_full_audio(audio, audio.duration, cut_times, output_path.replace(".mp4", ""))
    background = background.set_audio(full_audio)

    hook_seconds = min(HOOK_CARD_SECONDS, audio.duration) if hook else 0.0
    # Niente piu' _caption_band: ogni didascalia porta il proprio riquadro
    # aderente al testo (vedi _caption_clips_from_words).
    captions = _caption_clips_from_words(word_timings, audio.duration, skip_before=hook_seconds, caption_end_word=caption_end_word)
    watermark = _watermark_clip(audio.duration)
    hook_card = _hook_card_clip(hook, hook_seconds) if hook else []
    final = CompositeVideoClip([background, watermark] + captions + hook_card, size=(TARGET_W, TARGET_H))
    final = final.set_duration(audio.duration)

    final.write_videofile(
        output_path,
        fps=30,
        codec="libx264",
        audio_codec="aac",
        threads=4,
        preset="medium",
        bitrate=VIDEO_BITRATE,
        audio_bitrate=AUDIO_BITRATE,
        # moov atom in testa al file invece che in fondo - senza questo il
        # player deve scaricare l'intero file prima di poter leggere i
        # metadati, causando il classico 'primo tap non parte, secondo si'
        # (segnalato dall'utente 2026-08-02, moviepy non lo aggiunge di default).
        ffmpeg_params=["-movflags", "+faststart"] + _COLOR_TAGS,
    )
    _normalize_loudness(output_path)
    return output_path
