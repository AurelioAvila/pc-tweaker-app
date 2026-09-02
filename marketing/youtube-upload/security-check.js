"use strict";

// Scans only tracked source files: credentials must never reach a commit.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const files = execFileSync("git", ["-c", `safe.directory=${root}`, "-C", root, "ls-files"], { encoding: "utf8" })
  .split(/\r?\n/).filter(Boolean);
const forbiddenName = /(^|\/)(client_secret[^/]*|token[^/]*\.json[^/]*|credentials\.json|.*\.(pem|p12|pfx))$/i;
const secretValue = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{30,}/;
const violations = [];

for (const file of files) {
  if (forbiddenName.test(file)) violations.push(`${file}: credential-like file tracked`);
  const fullPath = path.join(root, ...file.split("/"));
  if (fs.statSync(fullPath).size < 1024 * 1024 && secretValue.test(fs.readFileSync(fullPath, "utf8"))) {
    violations.push(`${file}: secret-like value tracked`);
  }
}

if (violations.length) {
  console.error("Security check failed:\n" + violations.join("\n"));
  process.exit(1);
}
console.log(`Security check passed (${files.length} tracked files scanned).`);
