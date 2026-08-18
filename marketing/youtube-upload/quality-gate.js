"use strict";

// Ultima barriera prima della chiamata a YouTube: evita pubblicazioni mute o
// con metadati che l'API troncherebbe senza renderlo evidente.
const fs = require("fs");
const { execFileSync } = require("child_process");

const YT_TITLE_MAX = 100;
const MIN_VIDEO_BYTES = 50 * 1024;

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Quality gate: ${label} is required.`);
  }
}

function defaultProbe(videoPath) {
  return execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", videoPath],
    { encoding: "utf8" }
  ).trim();
}

function validateUpload({ videoPath, title, description }, probe = defaultProbe) {
  if (typeof videoPath !== "string" || !videoPath.toLowerCase().endsWith(".mp4")) {
    throw new Error("Quality gate: the upload must be an MP4 video.");
  }
  if (!fs.existsSync(videoPath)) throw new Error(`Quality gate: video file not found: ${videoPath}`);
  if (fs.statSync(videoPath).size < MIN_VIDEO_BYTES) {
    throw new Error("Quality gate: video file is unexpectedly small.");
  }

  requireText(title, "title");
  requireText(description, "description");
  if (title.length > YT_TITLE_MAX) {
    throw new Error(`Quality gate: title exceeds YouTube's ${YT_TITLE_MAX}-character limit.`);
  }

  let audio;
  try {
    audio = probe(videoPath);
  } catch (error) {
    throw new Error(`Quality gate: cannot verify the audio stream (${error.message}).`);
  }
  if (!String(audio).includes("audio")) {
    throw new Error("Quality gate: no audio stream detected; upload blocked.");
  }
}

module.exports = { MIN_VIDEO_BYTES, validateUpload };
