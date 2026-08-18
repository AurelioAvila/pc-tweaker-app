// Manual-posting workflow for X (Twitter): the automated-API route needs a
// paid Basic tier ($100/mo) and the free browser-automation route got
// blocked by Google's and X's own anti-automation detection (confirmed
// 2026-07-30 - not solvable without stealth/detection-evasion techniques,
// which this project deliberately does not use). So instead: this script
// watches the SAME queue the other uploaders watch (marketing/to-publish/
// and marketing/published/) and, for any video that doesn't have one yet,
// writes a ready-to-paste "<name>.x-caption.txt" file next to it.
//
// You post manually: open the video file + its .x-caption.txt, copy the
// text into X, attach the video, post. No account risk, no API cost.
//
// Safe to run unattended (Scheduled Task) - it only reads/writes text
// files, no browser, no login, nothing that touches X at all.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const QUEUE_DIRS = [path.join(ROOT, "to-publish"), path.join(ROOT, "published")];

// X-specific, not copied from Instagram's rules: widely-cited social
// research on X specifically shows 1-2 hashtags outperforms crowding the
// post with more (unlike IG, where up to 5 is fine) - engagement drops
// past that on this platform.
const MAX_HASHTAGS = 2;
const MAX_CAPTION_LENGTH = 280;

function buildCaption(meta) {
  // meta.description carries the actually persuasive content (what the
  // tweak does, the install command, the repo link) - meta.title alone is
  // just the hook, throwing away everything that makes someone act. Strip
  // the trailing hashtag-only line meant for YouTube (#Shorts #Windows...)
  // before reusing the description, then add X-appropriate hashtags fresh.
  const rawDescription = (meta.description || meta.title || "").trim();
  const lines = rawDescription.split("\n");
  while (lines.length && /^(#\S+\s*)+$/.test(lines[lines.length - 1].trim())) {
    lines.pop();
  }
  const body = lines.join("\n").trim() || meta.title || "";

  const rawTags = (meta.tags || []).slice(0, MAX_HASHTAGS);
  const hashtags = rawTags.map((t) => "#" + t.replace(/\s+/g, "")).join(" ");

  // Build backwards from the hashtags so they never get cut off by
  // truncation - the body loses characters first, not the tags.
  const suffix = hashtags ? `\n\n${hashtags}` : "";
  const bodyBudget = MAX_CAPTION_LENGTH - suffix.length;
  const trimmedBody = body.length > bodyBudget ? body.slice(0, bodyBudget - 1).trimEnd() + "…" : body;

  return `${trimmedBody}${suffix}`.trim();
}

function findCandidates() {
  const candidates = [];
  for (const dir of QUEUE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (!f.endsWith(".mp4")) continue;
      const baseName = f.replace(/\.mp4$/, "");
      const metaPath = path.join(dir, `${baseName}.json`);
      const captionPath = path.join(dir, `${baseName}.x-caption.txt`);
      if (!fs.existsSync(metaPath)) continue;
      if (fs.existsSync(captionPath)) continue; // already generated
      candidates.push({ baseName, dir, metaPath, captionPath, videoPath: path.join(dir, f) });
    }
  }
  return candidates;
}

function main() {
  const candidates = findCandidates();
  if (candidates.length === 0) {
    console.log(`[${new Date().toISOString()}] No new videos need an X caption.`);
    return;
  }

  for (const { baseName, dir, metaPath, captionPath, videoPath } of candidates) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const caption = buildCaption(meta);
    fs.writeFileSync(captionPath, caption);
    console.log(`[${new Date().toISOString()}] Ready to post manually: ${videoPath}`);
    console.log(`  caption saved to: ${captionPath}`);
  }
}

main();
