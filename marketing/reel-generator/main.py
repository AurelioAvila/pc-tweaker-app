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
    pick_category,
)
from script_writer import build_script_template, build_listtease_script_template
from tts import generate_audio
from footage import download_background_video, download_photo
from render import render_short, render_slideshow

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
TO_PUBLISH_DIR = os.path.join(os.path.dirname(__file__), "..", "to-publish")

SLIDESHOW_PROBABILITY = 0.5
NUM_BACKGROUND_CLIPS = 4


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


def make_one_reel(index: int, category: str = None):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(TO_PUBLISH_DIR, exist_ok=True)

    category = category or pick_category()
    hashtags, footage_query = CATEGORY_META[category]
    hook = random.choice(CAPTION_HOOKS[category])

    # Meno elementi per script (2026-08-03). I video uscivano a 26-30s reali,
    # misurati: fuori dalla fascia che regge il 70% di completion rate che la
    # ricerca 2026 indica come soglia oltre la quale TikTok apre davvero la
    # distribuzione. Sotto i ~20s si sta nella fascia "buona/ottima" (60-89%),
    # oltre i 30s si finisce in "media o sotto". Un fatto solo, raccontato
    # bene, batte due fatti compressi: la stessa ricerca dice che il video
    # vince sul completion, non sulla lunghezza assoluta.
    if category == LISTTEASE_CATEGORY:
        n = 3
        topic, items = get_listtease_content(n=n)
        script, item_word_starts, spoken_hook = build_listtease_script_template(topic, items)
    else:
        topic, items = get_random_content_multi(category, n=1)
        script, item_word_starts, spoken_hook = build_script_template(items, category)

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
        queries = _resolve_item_queries(footage_query, len(item_word_starts))
        image_paths = []
        for i, query in enumerate(queries):
            p = os.path.join(OUTPUT_DIR, f"photo_{index}_{i}.jpg")
            download_photo(p, query=query)
            image_paths.append(p)
        print(f"[{index}] (slideshow, {len(image_paths)} photos) queries: {queries}")
        render_slideshow(image_paths, image_starts, audio_path, word_timings, video_path, hook=spoken_hook)
    else:
        queries = _resolve_item_queries(footage_query, NUM_BACKGROUND_CLIPS)
        background_paths = []
        for i, query in enumerate(queries):
            p = os.path.join(OUTPUT_DIR, f"background_{index}_{i}.mp4")
            download_background_video(p, query=query)
            background_paths.append(p)
        print(f"[{index}] (multi-clip background, {len(background_paths)} clips) queries: {queries}")
        render_short(background_paths, audio_path, word_timings, video_path, hook=spoken_hook)

    base_name = f"reel-{category}-{int(time.time())}-{random.randint(1000, 9999)}"
    final_video_path = os.path.join(TO_PUBLISH_DIR, f"{base_name}.mp4")
    os.replace(video_path, final_video_path)

    # script_writer.py's CTA pool always ends the script with some form of
    # "link in bio" already - no need to append a second one here.
    description = script
    meta = {
        "title": hook,
        "description": description,
        "tags": hashtags,
    }
    with open(os.path.join(TO_PUBLISH_DIR, f"{base_name}.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"[{index}] Queued for publishing: {base_name}.mp4 / .json")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=1, help="How many Reels to generate in this run")
    parser.add_argument("--category", default=None, choices=ALL_CATEGORIES, help="Force a specific category")
    args = parser.parse_args()

    for i in range(args.count):
        make_one_reel(i, category=args.category)


if __name__ == "__main__":
    main()
