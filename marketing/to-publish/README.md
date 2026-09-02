# How to publish a new video

Put two files with the same name in this folder:

- `video-name.mp4`
- `video-name.json`

Example `video-name.json`:

```json
{
  "title": "PC Tweaker - real tweaks for Windows",
  "description": "Every tweak has automatic rollback.\n\nSearch 'PC Tweaker' - link in bio.\n\n#Shorts #Windows #PCOptimization",
  "tags": ["windows tweak", "pc optimizer", "windows optimization", "gaming performance"]
}
```

Every 30 minutes a Windows scheduled task ("PCTweakerYouTubeUpload") checks
this folder. When it finds a matching `.mp4`+`.json` pair, it uploads the
video to YouTube as **public immediately** (no manual review — an explicit
choice for full automation), then moves both files to `marketing/published/`
so it never gets re-uploaded.

The same file is also read by `marketing/tiktok-upload/` and (once the
Instagram setup is complete — see `marketing/instagram-upload/`) by
`marketing/instagram-upload/`: each keeps its own log and publishes
independently, without moving/deleting the files (only the YouTube script
owns that lifecycle).

To trigger a check manually at any time, without waiting:

```bash
cd marketing/youtube-upload
node auto-upload.js
```

Log of every upload (video ID, URL, date): `marketing/youtube-upload/uploaded-log.json`.
