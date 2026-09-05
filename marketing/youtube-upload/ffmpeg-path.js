"use strict";

// For paths inside single-quoted drawtext options, not shell arguments.
function escFfmpegPath(value) {
  if (typeof value !== "string" || /['\r\n\0]/.test(value)) {
    throw new Error("Unsupported character in FFmpeg filter path");
  }
  // Normalize Windows separators and escape option colons in one pass.
  return value.replace(/[\\:]/g, (character) => character === "\\" ? "/" : "\\:");
}

module.exports = { escFfmpegPath };
