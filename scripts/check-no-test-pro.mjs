// The Cargo feature "test-pro" unlocks Pro controls without a licence for VM
// verification builds. It must never reach anything a user can download.
//
//   node scripts/check-no-test-pro.mjs                 configuration checks
//   node scripts/check-no-test-pro.mjs --self-test     the above, plus a check of the binary scan itself
//   node scripts/check-no-test-pro.mjs --binary <path> refuse release binaries that carry the unlock
//
// Three layers: lib.rs refuses to compile the feature outside the debug
// profile; no release configuration may enable it; and a built binary that
// contains the unlock's marker strings is refused before it is shipped.
import { readFileSync, readdirSync, statSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const MARKERS = ["PCT-TEST-PRO-BUILD", "--test-apply", "--test-rollback"];
const problems = [];

function configuration() {
  const cargo = readFileSync(join(root, "src-tauri", "Cargo.toml"), "utf8");
  if (!/^test-pro = \[\]$/m.test(cargo))
    problems.push("Cargo.toml: test-pro must be an empty feature");
  if (/^default\s*=.*test-pro/m.test(cargo))
    problems.push("Cargo.toml: test-pro must not be a default feature");
  if (/features\s*=\s*\[[^\]]*"test-pro"/.test(cargo))
    problems.push("Cargo.toml: no dependency may enable test-pro");
  const lib = readFileSync(join(root, "src-tauri", "src", "lib.rs"), "utf8");
  if (
    !/#\[cfg\(all\(feature = "test-pro", not\(debug_assertions\)\)\)\]\s*compile_error!/.test(lib)
  )
    problems.push("lib.rs: the compile_error guard for release builds is missing");
  // Anything that builds or ships the app must not turn the feature on.
  const shipping = [
    "package.json",
    "src-tauri/tauri.conf.json",
    "RELEASING.md",
    "scripts/release-safety.ps1",
    "scripts/legacy-artifact-names.mjs",
    "scripts/make-latest-json.mjs",
    ...readdirSync(join(root, ".github", "workflows")).map((f) => `.github/workflows/${f}`),
    ...readdirSync(join(root, "scripts", "store"))
      .filter((f) => f.endsWith(".ps1"))
      .map((f) => `scripts/store/${f}`),
  ];
  for (const file of shipping) {
    const text = readFileSync(join(root, file), "utf8");
    for (const line of text.split("\n")) {
      if (/(?<![\w-])test-pro(?![\w-])/.test(line))
        problems.push(`${file}: mentions test-pro outside the check: ${line.trim()}`);
    }
  }
}

function filesUnder(path) {
  const info = statSync(path);
  if (!info.isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory()
      ? name === "deps" || name === "build" || name === "incremental"
        ? []
        : filesUnder(child)
      : /\.(exe|msi|dll|msix|appx)$/i.test(name)
        ? [child]
        : [];
  });
}

/** Markers as ASCII and as UTF-16LE, the two ways a Windows binary stores text. */
export function carriesUnlock(bytes) {
  return MARKERS.some(
    (m) => bytes.includes(Buffer.from(m, "latin1")) || bytes.includes(Buffer.from(m, "utf16le")),
  );
}

function binaries(paths) {
  const files = paths.flatMap(filesUnder);
  if (files.length === 0) problems.push(`no binaries found under ${paths.join(", ")}`);
  for (const file of files) {
    if (carriesUnlock(readFileSync(file))) problems.push(`${file}: built with the test-pro unlock`);
  }
  return files.length;
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), "pct-test-pro-"));
  try {
    const clean = join(dir, "clean.exe");
    const ascii = join(dir, "ascii.exe");
    const wide = join(dir, "wide.exe");
    writeFileSync(clean, Buffer.from("MZ ordinary release build"));
    writeFileSync(ascii, Buffer.from("MZ ... PCT-TEST-PRO-BUILD ..."));
    writeFileSync(wide, Buffer.concat([Buffer.from("MZ"), Buffer.from("--test-apply", "utf16le")]));
    const ok =
      !carriesUnlock(readFileSync(clean)) &&
      carriesUnlock(readFileSync(ascii)) &&
      carriesUnlock(readFileSync(wide));
    if (!ok) problems.push("self-test: the binary scan does not tell a test build from a release");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const binaryAt = args.indexOf("--binary");
if (binaryAt >= 0) {
  const scanned = binaries(args.slice(binaryAt + 1));
  if (problems.length === 0) console.log(`no test-pro unlock in ${scanned} release binaries`);
} else {
  configuration();
  if (args.includes("--self-test")) selfTest();
  if (problems.length === 0)
    console.log("test-pro unlock: debug-only guard present, no release configuration enables it");
}
if (problems.length > 0) {
  console.error("test-pro check FAILED:\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
