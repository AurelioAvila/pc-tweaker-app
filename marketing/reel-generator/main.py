"""
Orchestrator: generates N PC Tweaker Reels and drops each one straight into
marketing/to-publish/ as a <name>.mp4 + <name>.json pair - the SAME queue
the existing YouTube/TikTok/Instagram uploaders already watch (see
marketing/youtube-upload, tiktok-upload, instagram-upload). This script
never uploads anything itself; it only produces content, and the three
existing autonomous uploaders each pick it up and publish to their own
platform within their normal polling interval.
"""
import os
import sys
import time
import json
import random
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from content import (
    ALL_CATEGORIES,
    LISTTEASE_CATEGORY,
    CATEGORY_META,
    CAPTION_HOOKS,
    get_random_content_multi,
    get_listtease_content,
    item_footage_query,
    pick_category,
)
from script_writer import build_script_template, build_listtease_script_template
from tts import generate_audio
from footage import download_photo, download_background_video
from render import render_short, render_slideshow

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
TO_PUBLISH_DIR = os.path.join(os.path.dirname(__file__), "..", "to-publish")

# Per-category hook history (2026-08-19): hook = random.choice(CAPTION_HOOKS[category])
# kept no history at all, and with 8 hooks per category "Save this before your
# next gaming session" went out 4 times and "Read this before you download
# anything" 3 times across the most recent published videos - the same bug
# pattern found and fixed the same day on certsprint-youtube-bot and
# kids-shorts-bot (small pool + zero anti-repeat). Window = pool_size-1, so a
# hook cannot repeat until every other one has been used.
HOOK_HISTORY_PATH = os.path.join(OUTPUT_DIR, "hook_history.json")


def _load_hook_history() -> dict:
    if not os.path.exists(HOOK_HISTORY_PATH):
        return {}
    with open(HOOK_HISTORY_PATH, encoding="utf-8") as f:
        return json.load(f)


def _pick_hook(category: str) -> str:
    pool = CAPTION_HOOKS[category]
    history = _load_hook_history()
    recent = history.get(category, [])
    window = max(len(pool) - 1, 1)
    candidates = [h for h in pool if h not in recent[-window:]]
    if not candidates:
        candidates = pool
    hook = random.choice(candidates)
    recent.append(hook)
    history[category] = recent[-window:]
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(HOOK_HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)
    return hook

# Static stock photos were the first visual signal in half the Reels.  Until
# we have genuine screen recordings for each claim, continuous moving footage
# is the safer TikTok/Reels-native default.
SLIDESHOW_PROBABILITY = 0.0
NUM_BACKGROUND_CLIPS = 4
# TRUSTED_DEMO_VIDEOS REMOVED (2026-08-23, explicit request: "no more videos
# with the old versions of pc tweaker... use other formats without using the
# application"). The 3 recordings in producthunt-assets/ were from the Product
# Hunt launch and showed an app UI that is long superseded (confirmed: a frame
# pulled from a video published that day still showed the old Scan screen).
# The original comment rejected generic stock as "irrelevant" for queries as
# broad as a whole category - here the PER-ITEM query is used instead
# (item_footage_query), the same precision already in use in the slideshow
# branch below.


def _resolve_query(footage_query):
    return random.choice(footage_query) if isinstance(footage_query, list) else footage_query


def _resolve_item_queries(footage_query, n: int) -> list:
    pool = footage_query if isinstance(footage_query, list) else [footage_query]
    queries = []
    while len(queries) < n:
        remaining = n - len(queries)
        batch = random.sample(pool, min(remaining, len(pool)))
        queries.extend(batch)
    return queries


def make_one_reel(index: int, category: str = None, preview: bool = False):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if not preview:
        os.makedirs(TO_PUBLISH_DIR, exist_ok=True)

    category = category or pick_category()
    hashtags, footage_query = CATEGORY_META[category]
    hook = _pick_hook(category)

    # Fewer items per script (2026-08-03). Videos were coming out at a
    # measured 26-30s: outside the band that sustains the 70% completion rate
    # 2026 research names as the threshold past which TikTok really opens up
    # distribution. Under ~20s sits in the "good/excellent" band (60-89%);
    # past 30s lands in "average or below". One fact told well beats two facts
    # compressed: the same research says a video wins on completion, not on
    # absolute length.
    if category == LISTTEASE_CATEGORY:
        n = 3
        topic, items = get_listtease_content(n=n)
        script, item_word_starts, spoken_hook, cta_start_word = build_listtease_script_template(topic, items)
    else:
        topic, items = get_random_content_multi(category, n=1)
        script, item_word_starts, spoken_hook, cta_start_word = build_script_template(items, category)

    print(f"[{index}] ({category}) Script: {script}")

    audio_path = os.path.join(OUTPUT_DIR, f"audio_{index}.mp3")
    video_path = os.path.join(OUTPUT_DIR, f"reel_{index}.mp4")
    word_timings = generate_audio(script, audio_path)

    use_slideshow = bool(item_word_starts) and random.random() < SLIDESHOW_PROBABILITY
    if use_slideshow:
        image_starts = [
            word_timings[i][1] if i < len(word_timings) else 0.0
            for i in item_word_starts
        ]
        # PER-ITEM query (2026-08-05): "items" and "item_word_starts" always
        # have the same length and order (one per ranking entry, or the single
        # item for mistakewarning/contrarian/beforeafter), so every image can
        # depict what that specific line is actually saying instead of being
        # drawn at random from the category's generic pool. The fallback is
        # PER SINGLE ITEM (not the whole list) when no concept is mapped, so
        # one unmatched entry does not cost the others their precision.
        queries = [item_footage_query(it) or _resolve_query(footage_query) for it in items]
        image_paths = []
        for i, query in enumerate(queries):
            p = os.path.join(OUTPUT_DIR, f"photo_{index}_{i}.jpg")
            download_photo(p, query=query)
            image_paths.append(p)
        print(f"[{index}] (slideshow, {len(image_paths)} photos) queries: {queries}")
        render_slideshow(image_paths, image_starts, audio_path, word_timings, video_path, hook=spoken_hook, caption_end_word=cta_start_word)
    else:
        # PER-ITEM query in the multi-clip branch too (2026-08-05):
        # SLIDESHOW_PROBABILITY is 0.5, so HALF the videos still landed on the
        # generic category pool even with the fix above, because it was not
        # applied down here. No precise temporal sync (cuts stay every 4-7s,
        # not on word boundaries), but the clips shown are the ones for the
        # topics actually being discussed, in order - "depict it at least
        # approximately", as requested.
        # Real stock (Pexels/Pixabay) instead of app recordings (removed
        # 2026-08-23): per-topic queries via item_footage_query rather than
        # the broad category pool alone - the same precision already proven in
        # the slideshow branch, to avoid the "irrelevant" scenes seen with
        # over-generic queries.
        item_query = item_footage_query(items[0]) if items else None
        queries = _resolve_item_queries(item_query or footage_query, NUM_BACKGROUND_CLIPS)
        background_paths = []
        for i, query in enumerate(queries):
            p = os.path.join(OUTPUT_DIR, f"background_{index}_{i}.mp4")
            download_background_video(p, query=query)
            background_paths.append(p)
        print(f"[{index}] (stock background, {NUM_BACKGROUND_CLIPS} cuts) queries: {queries}")
        # show_captions was False here (captions at the standard CAPTION_Y
        # covered the UI card, which is centred vertically on a taller canvas
        # - see _fit_product_demo/CAPTION_Y_PRODUCT_DEMO in render.py): turned
        # back on 2026-08-15, after render.py learned to move them below the
        # card instead of switching them off. The 2026 data (Opus, Zebracat)
        # credits captions with +20-40% average watch time even with audio on
        # - without them, every product Reel gave that gain up.
        render_short(
            background_paths, audio_path, word_timings, video_path,
            hook=spoken_hook, caption_end_word=cta_start_word,
            caption_text=script, preserve_landscape=True, show_captions=True,
        )

    base_name = f"reel-{category}-{int(time.time())}-{random.randint(1000, 9999)}"
    destination = os.path.join(OUTPUT_DIR, "previews") if preview else TO_PUBLISH_DIR
    os.makedirs(destination, exist_ok=True)
    final_video_path = os.path.join(destination, f"{base_name}.mp4")
    os.replace(video_path, final_video_path)

    # script_writer.py's CTA pool always ends the script with some form of
    # "link in bio" already - no need to append a second one here.
    description = script
    meta = {
        "title": hook,
        "description": description,
        "tags": hashtags,
    }
    with open(os.path.join(destination, f"{base_name}.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    label = "Preview saved" if preview else "Queued for publishing"
    print(f"[{index}] {label}: {base_name}.mp4 / .json")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=1, help="How many Reels to generate in this run")
    parser.add_argument("--category", default=None, choices=ALL_CATEGORIES, help="Force a specific category")
    parser.add_argument("--preview", action="store_true", help="Render locally without adding anything to the publishing queue")
    args = parser.parse_args()

    for i in range(args.count):
        make_one_reel(i, category=args.category, preview=args.preview)


if __name__ == "__main__":
    main()
