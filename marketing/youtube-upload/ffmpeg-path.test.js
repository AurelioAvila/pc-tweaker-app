"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { escFfmpegPath } = require("./ffmpeg-path");

test("normalizes Windows paths without reprocessing inserted escapes", () => {
  assert.equal(escFfmpegPath("C:\\Users\\Example User\\font.ttf"), "C\\:/Users/Example User/font.ttf");
  assert.equal(escFfmpegPath("/tmp/title.txt"), "/tmp/title.txt");
  assert.equal(escFfmpegPath("D:\\a:b.txt"), "D\\:/a\\:b.txt");
});

test("rejects characters that break a single-quoted filter value", () => {
  for (const value of ["a'b", "a\nb", "a\rb", "a\0b", null]) {
    assert.throws(() => escFfmpegPath(value), /Unsupported character/);
  }
});
