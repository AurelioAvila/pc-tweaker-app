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
from footage import download_photo
from render import render_short, render_slideshow

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
TO_PUBLISH_DIR = os.path.join(os.path.dirname(__file__), "..", "to-publish")

# Static stock photos were the first visual signal in half the Reels.  Until
# we have genuine screen recordings for each claim, continuous moving footage
# is the safer TikTok/Reels-native default.
SLIDESHOW_PROBABILITY = 0.0
NUM_BACKGROUND_CLIPS = 4
# The short Product Hunt cut burns large captions into the lower third. The
# walkthrough gives us clean product footage that can be framed safely.
# POOL, non un singolo file (2026-08-13, richiesta esplicita: "basta
# riciclare la solita clip"): SLIDESHOW_PROBABILITY=0.0 significa che il
# 100% dei video passava sempre dallo stesso identico file, coi soli tagli
# temporali a variare. pc-tweaker-demo.mp4 esisteva gia' in
# producthunt-assets ma non era mai stato collegato qui. Resta SOLO footage
# reale del prodotto (niente ritorno allo stock generico, gia' scartato
# perche' irrilevante - vedi commento su render_short piu' sotto).
TRUSTED_DEMO_VIDEOS = [
    os.path.join(os.path.dirname(__file__), "..", "producthunt-assets", "pc-tweaker-youtube.mp4"),
    os.path.join(os.path.dirname(__file__), "..", "producthunt-assets", "pc-tweaker-demo.mp4"),
    # Registrazione Valorant del 14/8 (richiesta esplicita 15/8: "usa più
    # inventiva", non solo gli spezzoni dell'app). ~5:43, tanti momenti
    # diversi per far pescare a render_short() tagli sempre nuovi.
    os.path.join(os.path.dirname(__file__), "..", "producthunt-assets", "pc-tweaker-valorant-gameplay.mp4"),
]


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
        # Query PER-VOCE (2026-08-05): "items" e "item_word_starts" hanno
        # sempre la stessa lunghezza/ordine (uno per punto della classifica,
        # o l'unico item per mistakewarning/contrarian/beforeafter), quindi
        # ogni immagine puo' raffigurare cio' che quella specifica voce sta
        # dicendo invece di pescare a caso dal pool generico della
        # categoria. Ripiego SUL SINGOLO ITEM (non su tutta la lista) quando
        # non c'e' un concetto mappato, cosi' un solo punto senza match non
        # fa perdere la precisione degli altri.
        queries = [item_footage_query(it) or _resolve_query(footage_query) for it in items]
        image_paths = []
        for i, query in enumerate(queries):
            p = os.path.join(OUTPUT_DIR, f"photo_{index}_{i}.jpg")
            download_photo(p, query=query)
            image_paths.append(p)
        print(f"[{index}] (slideshow, {len(image_paths)} photos) queries: {queries}")
        render_slideshow(image_paths, image_starts, audio_path, word_timings, video_path, hook=spoken_hook, caption_end_word=cta_start_word)
    else:
        # Query PER-VOCE anche nel ramo multi-clip (2026-08-05): SLIDESHOW_PROBABILITY
        # e' 0.5, quindi META' dei video finiva comunque sul pool generico di
        # categoria anche con la correzione sopra, dato che qui sotto non veniva
        # applicata. Niente sincronizzazione temporale precisa (i tagli restano
        # ogni 4-7s, non ai bordi delle parole), ma i clip mostrati sono quelli
        # degli argomenti realmente trattati, in sequenza - "raffigurare almeno
        # in modo approssimativo" come richiesto.
        # Stock search returned unrelated scenes despite narrow keywords (an
        # agenda and a party in the visual audit).  Use the actual product
        # demo only; the renderer chooses different moments from it, so every
        # cut still shows the genuine PC Tweaker interface.
        missing = [p for p in TRUSTED_DEMO_VIDEOS if not os.path.exists(p)]
        if missing:
            raise RuntimeError(f"Missing verified PC Tweaker demo: {missing}")
        # Ogni taglio pesca a caso fra i demo reali disponibili (prima erano
        # tutti dallo stesso file): un video puo' ora mescolare momenti da
        # entrambe le registrazioni, oltre al momento gia' casuale dentro
        # ciascuna (vedi render_short/_loop_to_duration).
        background_paths = [random.choice(TRUSTED_DEMO_VIDEOS) for _ in range(NUM_BACKGROUND_CLIPS)]
        print(f"[{index}] (verified product-demo background, {NUM_BACKGROUND_CLIPS} cuts, {len(TRUSTED_DEMO_VIDEOS)} source videos)")
        # show_captions era False qui (le didascalie a CAPTION_Y standard
        # coprivano la card della UI, centrata in verticale su un canvas piu'
        # alto - vedi _fit_product_demo/CAPTION_Y_PRODUCT_DEMO in render.py):
        # riattivate il 2026-08-15 dopo che render.py ha imparato a spostarle
        # sotto la card invece di spegnerle. I dati 2026 (Opus, Zebracat)
        # danno alle didascalie +20-40% di watch time medio anche con audio
        # attivo - senza, ogni Reel del prodotto rinunciava a quel guadagno.
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
