"""
Generates narration audio from a script using edge-tts (free, no API key).
Also captures real per-word timing (WordBoundary events) so captions can be
synced to the actual voice instead of guessing an equal split over the
audio duration.
"""
import asyncio
import time
import edge_tts

DEFAULT_VOICE = "en-US-GuyNeural"
DEFAULT_RATE = "+0%"
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 5

# edge-tts reports offset/duration in 100-nanosecond ticks.
_TICKS_PER_SECOND = 10_000_000


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
