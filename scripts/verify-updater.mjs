import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Tauri wraps the standard minisign public key and detached signature in base64.
// Verification never accesses a private key or opens a signing session.
export function verifyUpdater(file, encodedPublicKey) {
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "pctweaker-verify-"));
  try {
    const signature = fs.readFileSync(file + ".sig", "utf8").trim();
    for (const value of [signature, encodedPublicKey]) {
      if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        throw new Error("Missing or malformed Tauri updater signature/public key.");
      }
    }
    const signaturePath = path.join(directory, "signature.minisig");
    const publicKeyPath = path.join(directory, "public.key");
    fs.writeFileSync(signaturePath, Buffer.from(signature, "base64"));
    fs.writeFileSync(publicKeyPath, Buffer.from(encodedPublicKey, "base64"));
    execFileSync(
      process.env.MINISIGN_PATH || "minisign",
      ["-V", "-m", file, "-x", signaturePath, "-p", publicKeyPath],
      { stdio: "inherit" },
    );
    return signature;
  } finally {
    removeVerificationDirectory(directory, temporaryRoot);
  }
}

/**
 * The installer name a signature's trusted comment binds, or null unless the
 * comment is exactly `timestamp:<digits>\tfile:<name>`. Installed clients from
 * 1.14.7 to 1.15.0 accept nothing else (src-tauri/src/update_identity.rs):
 * `tauri build` from CLI 2.12 appends `\tversion:<v>`, which they read as part
 * of the filename, and they silently report that no update exists.
 */
export function signedFileName(signature) {
  // As strict as the clients: canonical base64 and valid UTF-8, or nothing.
  const bytes = Buffer.from(signature, "base64");
  if (bytes.toString("base64") !== signature) return null;
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  const comment = text.split("\n")[2] ?? "";
  return comment.match(/^trusted comment: timestamp:\d+\tfile:([^\t]+)$/)?.[1] ?? null;
}

export function removeVerificationDirectory(directory, temporaryRoot) {
  const resolved = fs.realpathSync(directory);
  const root = fs.realpathSync(temporaryRoot);
  if (
    !path.isAbsolute(directory) ||
    fs.lstatSync(directory).isSymbolicLink() ||
    !fs.lstatSync(directory).isDirectory() ||
    resolved !== path.resolve(directory) ||
    path.dirname(resolved) !== root ||
    !/^pctweaker-verify-[A-Za-z0-9]{6}$/.test(path.basename(resolved))
  ) {
    throw new Error("Unsafe updater verification cleanup target.");
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
