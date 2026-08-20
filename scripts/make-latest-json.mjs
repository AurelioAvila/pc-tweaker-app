/**
 * Builds the updater manifest (latest.json) for a GitHub release from the
 * locally built, signed NSIS bundle.
 *
 * Usage:  node scripts/make-latest-json.mjs <notes-file>
 *
 * Reads the version from src-tauri/tauri.conf.json, the signature from the
 * .exe.sig next to the setup bundle, and the release notes from the given
 * file (first paragraph). Refuses to run if the .sig is missing — an
 * unsigned manifest would strand every existing install on the old version.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const conf = JSON.parse(fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const version = conf.version;
const repoUrl = conf.plugins?.updater?.endpoints?.[0]?.match(/https:\/\/github\.com\/[^/]+\/[^/]+/)?.[0];
if (!repoUrl) {
  console.error("Could not derive the repo URL from the updater endpoint.");
  process.exit(1);
}

const nsisDir = path.join(root, "src-tauri", "target", "release", "bundle", "nsis");
const setup = fs.readdirSync(nsisDir).find((f) => f.includes(`_${version}_`) && f.endsWith("-setup.exe"));
if (!setup) {
  console.error(`No v${version} -setup.exe found in ${nsisDir}. Run the signed build first.`);
  process.exit(1);
}
const sigPath = path.join(nsisDir, setup + ".sig");
if (!fs.existsSync(sigPath)) {
  console.error(`${setup} has no .sig — the build was NOT signed. Refusing to write latest.json.`);
  process.exit(1);
}

const notesFile = process.argv[2];
if (!notesFile) {
  console.error("Usage: node scripts/make-latest-json.mjs <notes-file>");
  process.exit(1);
}
// First paragraph of the notes file, flattened to one line.
const notes = fs
  .readFileSync(notesFile, "utf8")
  .split(/\n\s*\n/)
  .map((p) => p.replace(/^#.*$/gm, "").replace(/\s+/g, " ").trim())
  .filter(Boolean)[0];

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  platforms: {
    "windows-x86_64": {
      signature: fs.readFileSync(sigPath, "utf8").trim(),
      url: `${repoUrl}/releases/download/v${version}/${encodeURIComponent(setup)}`,
    },
  },
};

const out = path.join(nsisDir, "latest.json");
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
console.log(`latest.json written for v${version}\n  bundle: ${setup}\n  out:    ${out}`);
