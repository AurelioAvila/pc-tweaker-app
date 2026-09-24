// Run on Windows: node scripts/test-dns-powershell.mjs
// Compile the actual helper with only base64, offline; never build Tauri or call DNS APIs.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

assert.equal(process.platform, "win32", "This regression requires Windows PowerShell");
const source = fs.readFileSync(new URL("../src-tauri/src/dns.rs", import.meta.url), "utf8");
const helper = source.match(/^fn ps_quote\(value: &str\) -> String \{\r?\n[\s\S]*?^\}/m)?.[0];
assert.ok(helper, "Could not extract the production helper");
const payloads = [
  "Ethernet",
  "",
  "Réseau 日本語",
  ...["'", "\u2018", "\u2019", "\u201a", "\u201b"].map(
    quote => `Ethernet${quote}; Write-Output INJECTED; #`,
  ),
  'Ethernet"; $(Write-Output INJECTED); `\r\n#',
];
const temporaryRoot = fs.realpathSync(os.tmpdir());
const directory = fs.mkdtempSync(path.join(temporaryRoot, "pct-dns-test-"));
try {
  fs.writeFileSync(path.join(directory, "Cargo.toml"),
    '[package]\nname="dns-helper-test"\nversion="0.0.0"\nedition="2021"\n' +
    '[dependencies]\nbase64="=0.22.1"\n[[bin]]\nname="dns-helper-test"\npath="main.rs"\n');
  fs.writeFileSync(path.join(directory, "main.rs"), helper +
    '\nfn main() { for value in std::env::args().skip(1) { println!("{}", ps_quote(&value)); } }\n');
  const expressions = execFileSync("cargo", [
    "run", "--quiet", "--offline", "--manifest-path", path.join(directory, "Cargo.toml"),
    "--target-dir", path.join(directory, "target"), "--", ...payloads,
  ], { encoding: "utf8", cwd: directory }).trim().split(/\r?\n/);
  assert.equal(expressions.length, payloads.length);
  const powershell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
  for (const [i, expression] of expressions.entries()) {
    const encoded = Buffer.from(expression).toString("base64");
    const script = `
$ErrorActionPreference = 'Stop'
$expression = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($expression, [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw 'Expression failed to parse' }
$commands = @($ast.FindAll({param($n) $n -is [Management.Automation.Language.CommandAst]}, $true))
if ($commands.Count -ne 0) { throw 'Value became a command' }
$value = & ([scriptblock]::Create($expression))
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$value))
`;
    const result = execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64")], { encoding: "utf8" }).trim();
    assert.equal(result, Buffer.from(payloads[i]).toString("base64"), "Value must round-trip unchanged");
  }
  console.log(`PASS: ${payloads.length} production-helper outputs remain data in Windows PowerShell; no DNS/network commands executed.`);
} finally {
  assert.equal(path.dirname(fs.realpathSync(directory)), temporaryRoot);
  assert.match(path.basename(directory), /^pct-dns-test-[A-Za-z0-9]+$/);
  fs.rmSync(directory, { recursive: true, force: true });
}
