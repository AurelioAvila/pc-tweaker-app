/**
 * Gives the freshly built installers the file names installed clients accept.
 *
 * Usage:  node scripts/legacy-artifact-names.mjs      (after `tauri build`, before `tauri signer sign`)
 *
 * Tauri names the bundles after productName ("PC Tweaker_<v>_x64-setup.exe"), but every client
 * from 1.14.7 binds an update to the signed file name "pc-tweaker-app_<v>_x64-setup.exe" / ".msi"
 * (src-tauri/src/update_identity.rs) and ignores anything else. Renaming must happen before the
 * updater signature is made, because that signature carries the file name. The .sig files the
 * build wrote for the old names are removed so they cannot be published by mistake.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const bundle = path.join(root, "src-tauri", "target", "release", "bundle");
const targets = [
  ["nsis", `PC Tweaker_${version}_x64-setup.exe`, `pc-tweaker-app_${version}_x64-setup.exe`],
  ["msi", `PC Tweaker_${version}_x64_en-US.msi`, `pc-tweaker-app_${version}_x64_en-US.msi`],
];
for (const [dir, built, legacy] of targets) {
  const from = path.join(bundle, dir, built);
  const to = path.join(bundle, dir, legacy);
  if (!fs.existsSync(from)) {
    if (fs.existsSync(to)) { console.log(`already named: ${legacy}`); continue; }
    throw new Error(`Missing build output ${from}; run the signed tauri build first.`);
  }
  if (fs.existsSync(to)) throw new Error(`Refusing to overwrite ${to}`);
  fs.renameSync(from, to);
  fs.rmSync(from + ".sig", { force: true });
  console.log(`${built} -> ${legacy}`);
}
console.log("Now re-sign both installers with `npx tauri signer sign <installer>`.");
