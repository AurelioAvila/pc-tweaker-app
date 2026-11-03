# PC Tweaker Npackd package

This package references the publisher-signed PC Tweaker 1.19.0 NSIS installer. The download URL is versioned and its SHA-256 is pinned in `1.19.0.xml`.

The install script checks registered PC Tweaker and legacy `pc-tweaker-app` installations before starting the installer. An existing installation causes it to stop without replacing that installation. An earlier installation must be removed before installing this package; side-by-side installation and automatic takeover are not supported.

The removal script requires the registered installation directory to match the package directory. It uses the publisher's `uninstall.exe` and preserves nonzero error results. Registry inspection errors stop the operation. No registry values or execution-policy settings are changed by the guard.

## Verification

[Native package verification](https://github.com/AurelioAvila/pc-tweaker-app/actions/runs/41681160019) passed on Microsoft Windows Server 2025 Datacenter x64 with the final signed 1.19.0 installer:

- Installation into a directory containing spaces.
- Valid publisher signatures and timestamps for installer, main executable and uninstaller.
- Rejection of an existing installation before replacement.
- Rejection of removal from a different directory.
- Successful removal from the correct package directory.
- Preservation of a synthetic application-data marker.

The test records the normalized hashes of all three package scripts. Its scope is package installation and removal on the recorded CI host. It does not establish hardware-performance results, real entitlement behavior or full Windows 10/11 client testing. The Npackd GUI/CLI orchestration itself was not exercised.

The catalog's administrator review remains separate. Keep `not-reviewed` until the catalog administrators complete their review.

## Licensing

PC Tweaker remains proprietary/freemium. Package metadata is submitted under Npackd's GPLv3 metadata terms; the application binaries and icons are excluded from that metadata license.
