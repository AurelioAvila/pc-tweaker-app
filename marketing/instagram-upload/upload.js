// Manual one-off upload.
// Usage:
//   node upload.js <videoUrl> <caption>
//
// Note: unlike TikTok/YouTube, Instagram needs a PUBLIC video_url, not a
// local file path - run auto-upload.js (which hosts the file via
// github-host.js automatically) for the normal flow. This script is only
// useful if you already have a public URL for the video.

const { uploadReel } = require("./lib");

async function main() {
  const [videoUrl, caption] = process.argv.slice(2);
  if (!videoUrl || !caption) {
    console.error("Usage: node upload.js <videoUrl> <caption>");
    process.exit(1);
  }
  console.log(`Uploading "${caption.slice(0, 60)}..."`);
  await uploadReel({ videoUrl, caption });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
