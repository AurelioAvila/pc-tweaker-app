// Manual one-off upload.
// Usage:
//   node upload.js <videoPath> <title> <description> [--tags a,b,c] [--privacy public|unlisted|private]

const fs = require("fs");
const { uploadVideo } = require("./lib");
const { validateUpload } = require("./quality-gate");

function parseArgs(argv) {
  const [videoPath, title, description] = argv;
  let tags = [];
  let privacyStatus = "private";
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--tags") tags = argv[++i].split(",").map((t) => t.trim());
    if (argv[i] === "--privacy") privacyStatus = argv[++i];
  }
  if (!videoPath || !title || !description) {
    console.error("Usage: node upload.js <videoPath> <title> <description> [--tags a,b,c] [--privacy public|unlisted|private]");
    process.exit(1);
  }
  if (!fs.existsSync(videoPath)) {
    console.error(`Video file not found: ${videoPath}`);
    process.exit(1);
  }
  return { videoPath, title, description, tags, privacyStatus };
}

async function main() {
  const { videoPath, title, description, tags, privacyStatus } = parseArgs(process.argv.slice(2));
  validateUpload({ videoPath, title, description });
  console.log(`Uploading "${title}" (${privacyStatus})...`);
  const result = await uploadVideo({ videoPath, title, description, tags, privacyStatus });
  console.log("Done. Video ID:", result.id);
  console.log("URL:", result.url);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
