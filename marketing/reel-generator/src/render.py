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

from moviepy.editor import (
    VideoFileClip,
    ImageClip,
    AudioFileClip,
    TextClip,
    ColorClip,
    CompositeVideoClip,
    concatenate_videoclips,
)

TARGET_W, TARGET_H = 1080, 1920

CAPTION_CHUNK_SIZE = 3
CAPTION_FONTSIZE = 76
CAPTION_Y = int(TARGET_H * 0.62)
CAPTION_BAND_Y = int(TARGET_H * 0.56)
CAPTION_BAND_HEIGHT = int(TARGET_H * 0.22)

WATERMARK_TEXT = "PC Tweaker"
WATERMARK_FONTSIZE = 34
WATERMARK_Y = int(TARGET_H * 0.06)  # near the top, clear of the Reels/TikTok bottom UI overlay

SLIDESHOW_ZOOM_PER_SECOND = 0.03

# Background video cuts to a different clip every 4-7s (randomized so it
# doesn't feel mechanical) - 2026 Reels retention research points to
# "pattern interrupts" (cuts/zooms/visual changes every few seconds) as a
# real retention driver, and video-scripts.md's own research says the same
# for this niche (movement + hook + text simultaneously in the first 3s).
SCENE_MIN_SECONDS = 4.0
SCENE_MAX_SECONDS = 7.0


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


def _loop_to_duration(clip: VideoFileClip, duration: float) -> VideoFileClip:
    if clip.duration >= duration:
        return clip.subclip(0, duration)
    n_loops = int(duration // clip.duration) + 1
    return concatenate_videoclips([clip] * n_loops).subclip(0, duration)


def _caption_clips_from_words(word_timings: list, duration: float):
    """Builds caption chunks positioned at the REAL spoken time of each word
    (from edge-tts's WordBoundary events) instead of guessing an equal
    split over the audio duration."""
    if not word_timings:
        return []

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

        txt_clip = (
            TextClip(
                text,
                fontsize=CAPTION_FONTSIZE,
                color="white",
                stroke_color="black",
                stroke_width=4,
                method="caption",
                size=(TARGET_W - 100, None),
                font="DejaVu-Sans-Bold",
            )
            .set_start(start)
            .set_duration(chunk_duration)
            .set_position(("center", CAPTION_Y))
        )
        clips.append(txt_clip)
    return clips


def _ken_burns_image_clip(image_path: str, duration: float):
    img = ImageClip(image_path).set_duration(duration)
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


def _multi_clip_background(video_paths: list, total_duration: float):
    """Cuts between several background clips every 4-7s instead of looping
    one clip for the whole Reel."""
    clips = []
    t = 0.0
    i = 0
    while t < total_duration:
        segment_duration = min(random.uniform(SCENE_MIN_SECONDS, SCENE_MAX_SECONDS), total_duration - t)
        path = video_paths[i % len(video_paths)]
        clip = _fit_vertical(VideoFileClip(path))
        clip = _loop_to_duration(clip, segment_duration).set_start(t).set_duration(segment_duration)
        clips.append(clip)
        t += segment_duration
        i += 1
    return CompositeVideoClip(clips, size=(TARGET_W, TARGET_H)).set_duration(total_duration)


def _caption_band(duration: float):
    return (
        ColorClip(size=(TARGET_W, CAPTION_BAND_HEIGHT), color=(0, 0, 0))
        .set_opacity(0.35)
        .set_duration(duration)
        .set_position(("center", CAPTION_BAND_Y))
    )


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
            font="DejaVu-Sans-Bold",
        )
        .set_duration(duration)
        .set_position(("center", WATERMARK_Y))
        .set_opacity(0.85)
    )


def render_short(background_video_paths, audio_path: str, word_timings: list, output_path: str):
    if isinstance(background_video_paths, str):
        background_video_paths = [background_video_paths]

    audio = AudioFileClip(audio_path)
    background = _multi_clip_background(background_video_paths, audio.duration).set_audio(audio)

    band = _caption_band(audio.duration)
    captions = _caption_clips_from_words(word_timings, audio.duration)
    watermark = _watermark_clip(audio.duration)
    final = CompositeVideoClip([background, band, watermark] + captions, size=(TARGET_W, TARGET_H))
    final = final.set_duration(audio.duration)

    final.write_videofile(
        output_path,
        fps=30,
        codec="libx264",
        audio_codec="aac",
        threads=4,
        preset="medium",
    )
    return output_path


def render_slideshow(image_paths: list, image_starts: list, audio_path: str, word_timings: list, output_path: str):
    audio = AudioFileClip(audio_path)
    background = _slideshow_background(image_paths, image_starts, audio.duration).set_audio(audio)

    band = _caption_band(audio.duration)
    captions = _caption_clips_from_words(word_timings, audio.duration)
    watermark = _watermark_clip(audio.duration)
    final = CompositeVideoClip([background, band, watermark] + captions, size=(TARGET_W, TARGET_H))
    final = final.set_duration(audio.duration)

    final.write_videofile(
        output_path,
        fps=30,
        codec="libx264",
        audio_codec="aac",
        threads=4,
        preset="medium",
    )
    return output_path
