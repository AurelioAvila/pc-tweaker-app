// Manual one-off upload.
// Usage:
//   node upload.js <videoPath> <caption> [--privacy SELF_ONLY|PUBLIC_TO_EVERYONE]

const fs = require("fs");
const { uploadVideo } = require("./lib");

function parseArgs(argv) {
  const [videoPath, caption] = argv;
  let privacyLevel = "SELF_ONLY";
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--privacy") privacyLevel = argv[++i];
  }
  if (!videoPath || !caption) {
    console.error("Usage: node upload.js <videoPath> <caption> [--privacy SELF_ONLY|PUBLIC_TO_EVERYONE]");
    process.exit(1);
  }
  if (!fs.existsSync(videoPath)) {
    console.error(`Video file not found: ${videoPath}`);
    process.exit(1);
  }
  return { videoPath, caption, privacyLevel };
}

async function main() {
  const { videoPath, caption, privacyLevel } = parseArgs(process.argv.slice(2));
  console.log(`Uploading "${caption.slice(0, 60)}..." (${privacyLevel})...`);
  await uploadVideo({ videoPath, caption, privacyLevel });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
