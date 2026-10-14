#!/usr/bin/env node
// Release trust record: SHA-256 and Authenticode status of a published installer,
// read from the real release asset (GitHub API + a fresh download), never typed by hand.
//
//   node scripts/release-trust.mjs --repo AurelioAvila/pc-tweaker-app --key pc-tweaker \
//        --asset "^pc-tweaker-app_.*_x64-setup\.exe$" --out site/src/generated/release-trust.json \
//        [--tag v1.18.3] [--url https://dl.pctweaker.app/pc-tweaker/v1.18.3/<file>]
//
// Needs: gh (logged in, public repos only), Windows PowerShell 5+ (Get-AuthenticodeSignature).
// Merges its entry into --out (one JSON file, one key per product). Fails, and writes nothing,
// when the downloaded bytes do not match the GitHub digest or the signature is not Valid.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, createWriteStream, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith("--") ? [...acc, [v.slice(2), all[i + 1]]] : acc), []),
);
for (const k of ["repo", "key", "asset", "out"]) if (!args[k]) throw new Error(`missing --${k}`);

const gh = (path) => JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8" }));
const release = gh(`repos/${args.repo}/releases/${args.tag ? `tags/${args.tag}` : "latest"}`);
if (release.draft || release.prerelease) throw new Error(`${release.tag_name} is a draft or pre-release`);
const asset = release.assets.find((a) => new RegExp(args.asset).test(a.name));
if (!asset) throw new Error(`no asset matches ${args.asset} in ${release.tag_name}`);
const digest = (asset.digest || "").replace(/^sha256:/, "");
if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`GitHub reports no sha256 digest for ${asset.name}`);

const source = args.url || asset.browser_download_url;
const work = mkdtempSync(join(tmpdir(), "release-trust-"));
try {
  const file = join(work, asset.name);
  const res = await fetch(source, { redirect: "follow" });
  if (!res.ok) throw new Error(`${source} answered ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
  const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (sha256 !== digest) throw new Error(`downloaded ${sha256} but GitHub digest is ${digest}`);

  const ps = `$s = Get-AuthenticodeSignature -LiteralPath $env:RT_FILE; [pscustomobject]@{ status = [string]$s.Status; subject = $s.SignerCertificate.Subject; thumbprint = $s.SignerCertificate.Thumbprint; timestamped = [bool]$s.TimeStamperCertificate; timestamper = $s.TimeStamperCertificate.Subject } | ConvertTo-Json -Compress`;
  const sig = JSON.parse(
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
      encoding: "utf8",
      env: { ...process.env, RT_FILE: file },
    }),
  );
  if (sig.status !== "Valid") throw new Error(`Authenticode status is ${sig.status}, not Valid`);
  const signer = (sig.subject.match(/CN=("[^"]+"|[^,]+)/)?.[1] ?? sig.subject).replace(/"/g, "");

  const entry = {
    version: release.tag_name.replace(/^v/, ""),
    tag: release.tag_name,
    published: release.published_at,
    file: asset.name,
    size: asset.size,
    sha256,
    download: source,
    releasePage: release.html_url,
    signature: { status: sig.status, signer, thumbprint: sig.thumbprint, timestamped: sig.timestamped },
  };
  const out = args.out;
  const all = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  all[args.key] = entry;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(Object.fromEntries(Object.entries(all).sort()), null, 2) + "\n");
  console.log(`${args.key} ${entry.version}: ${sha256} signed by ${signer} (${sig.status}, timestamp ${sig.timestamped})`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
