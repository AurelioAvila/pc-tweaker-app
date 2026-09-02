"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { MIN_VIDEO_BYTES, validateUpload } = require("./quality-gate");

const temp = path.join(os.tmpdir(), `pctweaker-quality-${process.pid}.mp4`);
fs.writeFileSync(temp, Buffer.alloc(MIN_VIDEO_BYTES, 1));
try {
  validateUpload({ videoPath: temp, title: "A valid title", description: "A valid description" }, () => "audio");
  assert.throws(() => validateUpload({ videoPath: temp, title: "A valid title", description: "A valid description" }, () => ""), /no audio stream/);
  assert.throws(() => validateUpload({ videoPath: temp, title: "x".repeat(101), description: "A valid description" }, () => "audio"), /title exceeds/);
  console.log("Quality-gate tests passed.");
} finally {
  fs.unlinkSync(temp);
}
