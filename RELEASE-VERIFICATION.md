# Windows release verification

CI compilation is a verification step, not a download channel: unsigned build
artifacts are not uploaded. Build and sign releases on the authorized release
workstation using the existing publisher certificate and updater key.

Before preparing `latest.json`, `scripts/make-latest-json.mjs` requires the
application, EXE installer and MSI installer to pass Windows Authenticode,
publisher identity (**Aurelio Avila**) and trusted timestamp verification.
Both installers must also have valid Tauri updater signatures for the public
key installed in the application. The helper rejects changed bytes.

PowerShell 7, Windows SDK SignTool and minisign must be available locally.
`SIGNTOOL_PATH` and `MINISIGN_PATH` may identify installed verification tools;
they are paths, not signing credentials. Missing tools stop preparation.

The stable-download workflow verifies the downloaded installers and final
aliases before uploading. WinGet submission first verifies published installers
against GitHub API SHA-256 digests and Windows trust, and uses the checked tag.
These checks do not sign files, rotate keys or require a new certificate.

Do not change verified assets after publication. A new build needs a new
release and fresh signatures. Manual uploads outside these helpers still
require independent verification of the final installers and packaged payloads.
Code signing identifies a publisher; it does not guarantee an absence of
SmartScreen warnings or application vulnerabilities.
