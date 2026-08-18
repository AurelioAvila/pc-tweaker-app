"""
Generates narration audio from a script using edge-tts (free, no API key).
Also captures real per-word timing (WordBoundary events) so captions can be
synced to the actual voice instead of guessing an equal split over the
audio duration.
"""
import asyncio
import base64
import os
import random
import subprocess
import time
import edge_tts
import requests

DEFAULT_VOICE = "en-US-GuyNeural"
DEFAULT_RATE = "+0%"
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 5

# edge-tts reports offset/duration in 100-nanosecond ticks.
_TICKS_PER_SECOND = 10_000_000

# Optional local Kokoro TTS voice (2026-08-16): when KOKORO_TTS_URL is set and
# reachable, a random share of narrations use it instead of edge-tts, for a
# 60/40 male/female voice split per the explicit standing instruction (updated
# from the original 50/50 across all platforms). Kokoro is entirely optional
# and env-var gated: if the URL isn't set, or the request fails for any reason
# (service offline, timeout, bad response), we fall back to edge-tts so a video
# is never lost to a local service being unreachable.
KOKORO_TTS_URL = os.environ.get("KOKORO_TTS_URL")
KOKORO_VOICE = os.environ.get("KOKORO_VOICE", "af_heart")
KOKORO_SPEED = float(os.environ.get("KOKORO_SPEED", "0.85"))
KOKORO_VOICE_SHARE = float(os.environ.get("KOKORO_VOICE_SHARE", "0.4"))  # 60/40 male/female split
KOKORO_TIMEOUT_SECONDS = 60


def _generate_kokoro_with_timing(text: str, output_path: str) -> list:
    """Generates narration via the local Kokoro TTS service and returns
    per-word timing as (word, start_seconds, duration_seconds) tuples, matching
    the shape _generate_with_timing() returns for edge-tts, so render.py can
    consume either source identically."""
    resp = requests.post(
        KOKORO_TTS_URL.rstrip("/") + "/tts",
        json={"text": text, "voice": KOKORO_VOICE, "speed": KOKORO_SPEED},
        timeout=KOKORO_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    data = resp.json()

    wav_path = output_path + ".kokoro_tmp.wav"
    with open(wav_path, "wb") as f:
        f.write(base64.b64decode(data["audio_b64"]))
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-qscale:a", "2", output_path],
            check=True, capture_output=True,
        )
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)

    # Kokoro returns word timings as dicts {"text","offset","duration"};
    # remap to the (word, start, duration) tuple shape render.py expects.
    return [(w["text"], w["offset"], w["duration"]) for w in data.get("word_timings", [])]


async def _generate_with_timing(text: str, output_path: str, voice: str, rate: str) -> list:
    communicate = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    word_timings = []
    with open(output_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / _TICKS_PER_SECOND
                duration = chunk["duration"] / _TICKS_PER_SECOND
                word_timings.append((chunk["text"], start, duration))
    return word_timings


def generate_audio(
    text: str, output_path: str, voice: str = DEFAULT_VOICE, rate: str = DEFAULT_RATE
) -> list:
    """Generates the narration mp3 and returns per-word timing as a list of
    (word, start_seconds, duration_seconds) tuples, in the order spoken -
    this is what render.py uses to sync captions to the voice."""
    if KOKORO_TTS_URL and random.random() < KOKORO_VOICE_SHARE:
        try:
            return _generate_kokoro_with_timing(text, output_path)
        except Exception as e:
            print(f"[tts] kokoro unreachable or failed ({e}) - falling back to edge-tts")

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return asyncio.run(_generate_with_timing(text, output_path, voice, rate))
        except Exception as e:
            last_error = e
            print(f"[tts] attempt {attempt}/{MAX_RETRIES} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
    raise last_error


if __name__ == "__main__":
    timings = generate_audio("This is a test of the audio generation.", "test_audio.mp3")
    print("Audio saved to test_audio.mp3")
    print(timings)
