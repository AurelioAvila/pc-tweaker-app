# X (Twitter) — manual posting with auto-generated captions

**Not automated end-to-end.** Two routes were tried and ruled out:

- Official X API: requires the paid Basic tier ($100/mo minimum) just to
  post content with media.
- Free browser automation (Playwright driving a real logged-in session):
  blocked by both Google's sign-in ("this browser may not be safe") and
  X's own login flow, which silently reject Playwright-controlled browsers
  regardless of which Chrome build is used. Going further would require
  stealth/fingerprint-spoofing techniques to evade that detection, which
  this project deliberately does not do.

## What this actually does

`generate-captions.js` watches the same `marketing/to-publish/` /
`marketing/published/` queue the other uploaders watch. For every video
that doesn't have one yet, it writes a ready-to-paste
`<name>.x-caption.txt` next to it (title + up to 3 hashtags, capped to
X's 280-char limit).

Wired into `run.bat` / the `PCTweakerXUpload` Scheduled Task - safe to run
unattended since it only reads/writes text files, no browser, no login.

## Posting

Open the video + its matching `.x-caption.txt`, copy the caption into X,
attach the video, post. A couple minutes per video.
