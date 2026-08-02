"""
Searches and downloads free vertical background video/photos from Pexels.
Requires the PEXELS_API_KEY environment variable (free, sign up at
pexels.com/api). Same logic as the getcertsprint bot's footage.py, with
gaming/tech-themed default queries instead of study-themed ones.
"""
import json
import os
import random
import requests

DEFAULT_QUERIES = [
    "gaming setup",
    "computer screen close up",
    "keyboard typing gaming",
    "desk setup tech",
]

TARGET_RATIO = 9 / 16

# Remembers which Pexels asset IDs were used recently so the same clip/photo
# doesn't get picked again and again (this is what was making video covers
# look repeated across posts - user feedback 2026-08-02). Capped so it
# doesn't grow forever and eventually allows a clip to recirculate once the
# small per-query result pool has been fully cycled through.
_USED_IDS_PATH = os.path.join(os.path.dirname(__file__), "..", "used_backgrounds.json")
_MAX_REMEMBERED = 200


def _load_used_ids() -> set:
    if not os.path.exists(_USED_IDS_PATH):
        return set()
    with open(_USED_IDS_PATH) as f:
        return set(json.load(f))


def _remember_used_id(asset_id) -> None:
    ids = list(_load_used_ids())
    ids.append(asset_id)
    ids = ids[-_MAX_REMEMBERED:]
    with open(_USED_IDS_PATH, "w") as f:
        json.dump(ids, f)


def download_background_video(output_path: str, query: str = None) -> str:
    api_key = os.environ["PEXELS_API_KEY"]
    query = query or random.choice(DEFAULT_QUERIES)

    resp = requests.get(
        "https://api.pexels.com/videos/search",
        headers={"Authorization": api_key},
        # Pagina casuale invece della sola pagina 1 (fix 2026-08-02): prima
        # si pescava sempre dai 20 risultati piu' popolari per quella query,
        # cioe' esattamente i clip che usano migliaia di altri creator. La
        # ricerca 2026 e' esplicita: riusare lo stesso stock footage diffuso
        # fa declassare il video come "Low Value Content", e a noi causava
        # anche clip ripetuti tra un video e l'altro. Bacino da 20 a 100.
        params={"query": query, "orientation": "portrait", "per_page": 20, "page": random.randint(1, 5)},
        timeout=30,
    )
    resp.raise_for_status()
    results = resp.json().get("videos", [])
    if not results:
        raise RuntimeError(f"No Pexels videos found for query '{query}'")

    def _aspect_diff(v):
        w, h = v.get("width") or 1, v.get("height") or 1
        return abs((w / h) - TARGET_RATIO)

    results.sort(key=_aspect_diff)
    top_candidates = results[: max(1, len(results) // 3)]

    used_ids = _load_used_ids()
    fresh_candidates = [v for v in top_candidates if v.get("id") not in used_ids]
    # If every top candidate has already been used recently (small query
    # pool fully cycled), fall back to the full top-third rather than
    # erroring out - better an occasional repeat than a failed run.
    video = random.choice(fresh_candidates or top_candidates)
    _remember_used_id(video.get("id"))

    files = sorted(
        video["video_files"],
        key=lambda f: abs((f.get("height") or 0) - 1920),
    )
    video_url = files[0]["link"]

    video_resp = requests.get(video_url, timeout=60, stream=True)
    video_resp.raise_for_status()
    with open(output_path, "wb") as f:
        for chunk in video_resp.iter_content(chunk_size=8192):
            f.write(chunk)

    return output_path


def download_photo(output_path: str, query: str = None) -> str:
    """Downloads a free vertical photo from Pexels - used by the photo
    slideshow render style (render.render_slideshow)."""
    api_key = os.environ["PEXELS_API_KEY"]
    query = query or random.choice(DEFAULT_QUERIES)

    resp = requests.get(
        "https://api.pexels.com/v1/search",
        headers={"Authorization": api_key},
        # Pagina casuale invece della sola pagina 1 (fix 2026-08-02): prima
        # si pescava sempre dai 20 risultati piu' popolari per quella query,
        # cioe' esattamente i clip che usano migliaia di altri creator. La
        # ricerca 2026 e' esplicita: riusare lo stesso stock footage diffuso
        # fa declassare il video come "Low Value Content", e a noi causava
        # anche clip ripetuti tra un video e l'altro. Bacino da 20 a 100.
        params={"query": query, "orientation": "portrait", "per_page": 20, "page": random.randint(1, 5)},
        timeout=30,
    )
    resp.raise_for_status()
    results = resp.json().get("photos", [])
    if not results:
        raise RuntimeError(f"No Pexels photos found for query '{query}'")

    def _aspect_diff(p):
        w, h = p.get("width") or 1, p.get("height") or 1
        return abs((w / h) - TARGET_RATIO)

    results.sort(key=_aspect_diff)
    top_candidates = results[: max(1, len(results) // 3)]

    used_ids = _load_used_ids()
    fresh_candidates = [p for p in top_candidates if p.get("id") not in used_ids]
    photo = random.choice(fresh_candidates or top_candidates)
    _remember_used_id(photo.get("id"))
    photo_url = photo["src"]["large2x"]

    photo_resp = requests.get(photo_url, timeout=30, stream=True)
    photo_resp.raise_for_status()
    with open(output_path, "wb") as f:
        for chunk in photo_resp.iter_content(chunk_size=8192):
            f.write(chunk)

    return output_path


if __name__ == "__main__":
    download_background_video("test_background.mp4")
    print("Video saved to test_background.mp4")
