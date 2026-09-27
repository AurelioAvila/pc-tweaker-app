import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { signedFileName, verifyUpdater, removeVerificationDirectory } from "./verify-updater.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const conf = JSON.parse(fs.readFileSync(path.join(root, "src-tauri/tauri.conf.json")));

test("updater cleanup rejects the temporary root and unrelated directories", () => {
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  assert.throws(() => removeVerificationDirectory(temporaryRoot, temporaryRoot), /Unsafe/);
  assert.throws(() => removeVerificationDirectory(root, temporaryRoot), /Unsafe/);
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "pctweaker-verify-"));
  assert.throws(() => removeVerificationDirectory(directory, root), /Unsafe/);
  assert.ok(fs.existsSync(directory));
  removeVerificationDirectory(directory, temporaryRoot);
  assert.equal(fs.existsSync(directory), false);
});

test("only the trusted comment installed clients accept yields a file name", () => {
  const sig = (comment) =>
    Buffer.from(
      `untrusted comment: fixture\nfixture\ntrusted comment: ${comment}\nfixture\n`,
    ).toString("base64");
  const name = "pc-tweaker-app_1.15.0_x64-setup.exe";
  assert.equal(signedFileName(sig(`timestamp:1790526360\tfile:${name}`)), name);
  // What `tauri build` from CLI 2.12 writes; 1.14.7 to 1.15.0 never offer it.
  assert.equal(signedFileName(sig(`timestamp:1790508346\tfile:${name}\tversion:1.15.0`)), null);
  assert.equal(signedFileName(sig(`timestamp:\tfile:${name}`)), null);
  assert.equal(signedFileName("not base64 at all"), null);
  // Clients decode canonical base64 and strict UTF-8; the gate must not be looser.
  const padded = sig(`timestamp:1\tfile:${name}`);
  assert.match(padded, /=$/);
  assert.equal(signedFileName(padded.replace(/=+$/, "")), null);
  const invalidUtf8 = Buffer.from(
    `untrusted comment: \xff\nfixture\ntrusted comment: timestamp:1\tfile:${name}\n`,
    "latin1",
  ).toString("base64");
  assert.equal(signedFileName(invalidUtf8), null);
});

test("missing and empty updater signatures fail closed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pctweaker-verify-"));
  try {
    const file = path.join(dir, "setup.exe");
    fs.writeFileSync(file, "unsigned fixture");
    assert.throws(() => verifyUpdater(file, conf.plugins.updater.pubkey), /ENOENT/);
    fs.writeFileSync(file + ".sig", "");
    assert.throws(() => verifyUpdater(file, conf.plugins.updater.pubkey), /malformed/);
  } finally {
    removeVerificationDirectory(dir, fs.realpathSync(os.tmpdir()));
  }
});

test(
  "unsigned bundles do not produce a manifest or stable alias",
  { skip: process.platform !== "win32" },
  () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pctweaker-verify-"));
    try {
      fs.cpSync(path.join(root, "scripts"), path.join(dir, "scripts"), { recursive: true });
      const release = path.join(dir, "src-tauri/target/release");
      const nsis = path.join(release, "bundle/nsis");
      const msi = path.join(release, "bundle/msi");
      fs.mkdirSync(nsis, { recursive: true });
      fs.mkdirSync(msi, { recursive: true });
      fs.writeFileSync(path.join(dir, "src-tauri/tauri.conf.json"), JSON.stringify(conf));
      fs.writeFileSync(path.join(dir, "notes.md"), "Verification fixture.");
      fs.writeFileSync(path.join(release, "tauri-app.exe"), "unsigned");
      fs.writeFileSync(path.join(nsis, `Test_${conf.version}_x64-setup.exe`), "unsigned");
      fs.writeFileSync(
        path.join(nsis, `Test_${conf.version}_x64-setup.exe.sig`),
        "present but invalid",
      );
      fs.writeFileSync(path.join(msi, `Test_${conf.version}_x64_en-US.msi`), "unsigned");
      const result = spawnSync(
        process.execPath,
        [path.join(dir, "scripts/make-latest-json.mjs"), path.join(dir, "notes.md")],
        { encoding: "utf8" },
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /Authenticode verification failed/);
      assert.equal(fs.existsSync(path.join(nsis, "latest.json")), false);
      assert.equal(fs.existsSync(path.join(nsis, "PCTweaker-Setup.exe")), false);
    } finally {
      removeVerificationDirectory(dir, fs.realpathSync(os.tmpdir()));
    }
  },
);

test(
  "real updater signature verifies and changed bytes are rejected",
  { skip: !process.env.PCTWEAKER_TEST_ASSET },
  () => {
    const file = process.env.PCTWEAKER_TEST_ASSET;
    assert.ok(verifyUpdater(file, conf.plugins.updater.pubkey));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pctweaker-verify-"));
    try {
      const changed = path.join(dir, "changed.exe");
      fs.copyFileSync(file, changed);
      fs.copyFileSync(file + ".sig", changed + ".sig");
      fs.appendFileSync(changed, "modified");
      assert.throws(() => verifyUpdater(changed, conf.plugins.updater.pubkey));
    } finally {
      removeVerificationDirectory(dir, fs.realpathSync(os.tmpdir()));
    }
  },
);
