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


def search_pixabay_videos(query: str, per_page: int = 20) -> list:
    """Free second source alongside Pexels, via Pixabay's free API. Returns
    a list of dicts in the SAME shape as Pexels results ("id", "url",
    "width", "height", "video_files": [{"link","height"}]) so it drops
    into the existing selection/dedup logic below unchanged.

    Returns [] with no network call if PIXABAY_API_KEY is unset - Pexels
    stays the only source until a key is added, no behavior change.
    """
    api_key = os.getenv("PIXABAY_API_KEY")
    if not api_key:
        return []
    try:
        resp = requests.get(
            "https://pixabay.com/api/videos/",
            params={"key": api_key, "q": query, "per_page": per_page},
            timeout=30,
        )
        resp.raise_for_status()
        hits = resp.json().get("hits", [])
    except Exception as exc:
        print(f"[pixabay] video search failed for '{query}': {exc}")
        return []

    results = []
    for hit in hits:
        variants = hit.get("videos", {})
        video_files = [
            {"link": v["url"], "height": v.get("height") or 0}
            for v in variants.values() if v.get("url")
        ]
        if not video_files:
            continue
        large = variants.get("large") or next(iter(variants.values()), {})
        results.append({
            # Prefixed so a Pixabay id never collides with a Pexels id in
            # the shared _USED_IDS_PATH dedup memory.
            "id": f"pixabay_{hit.get('id')}",
            "url": hit.get("pageURL", ""),
            "width": large.get("width") or 0,
            "height": large.get("height") or 0,
            "video_files": video_files,
        })
    return results


def search_pixabay_photos(query: str, per_page: int = 20) -> list:
    """Same as search_pixabay_videos but for still photos, Pexels-shaped
    ("id", "url", "width", "height", "src": {"large2x"})."""
    api_key = os.getenv("PIXABAY_API_KEY")
    if not api_key:
        return []
    try:
        resp = requests.get(
            "https://pixabay.com/api/",
            params={"key": api_key, "q": query, "per_page": per_page},
            timeout=30,
        )
        resp.raise_for_status()
        hits = resp.json().get("hits", [])
    except Exception as exc:
        print(f"[pixabay] photo search failed for '{query}': {exc}")
        return []

    results = []
    for hit in hits:
        url = hit.get("largeImageURL") or hit.get("webformatURL")
        if not url:
            continue
        results.append({
            "id": f"pixabay_{hit.get('id')}",
            "url": hit.get("pageURL", ""),
            "width": hit.get("imageWidth") or 0,
            "height": hit.get("imageHeight") or 0,
            "src": {"large2x": url},
        })
    return results


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
    results = results + search_pixabay_videos(query)
    if not results:
        raise RuntimeError(f"No Pexels/Pixabay videos found for query '{query}'")

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
    results = results + search_pixabay_photos(query)
    if not results:
        raise RuntimeError(f"No Pexels/Pixabay photos found for query '{query}'")

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
