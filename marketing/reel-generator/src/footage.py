"""
Searches and downloads free vertical background video/photos from Pexels.
Requires the PEXELS_API_KEY environment variable (free, sign up at
pexels.com/api). Same logic as the getcertsprint bot's footage.py, with
gaming/tech-themed default queries instead of study-themed ones.
"""
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


def download_background_video(output_path: str, query: str = None) -> str:
    api_key = os.environ["PEXELS_API_KEY"]
    query = query or random.choice(DEFAULT_QUERIES)

    resp = requests.get(
        "https://api.pexels.com/videos/search",
        headers={"Authorization": api_key},
        params={"query": query, "orientation": "portrait", "per_page": 20},
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
    video = random.choice(top_candidates)

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
        params={"query": query, "orientation": "portrait", "per_page": 20},
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
    photo = random.choice(top_candidates)
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
