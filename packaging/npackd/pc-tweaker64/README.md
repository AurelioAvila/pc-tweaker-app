# PC Tweaker Npackd package

This package references the publisher-signed PC Tweaker NSIS installers. The current candidate is 1.20.3, with its versioned download URL and SHA-256 pinned in `1.20.3.xml`. The 1.19.0 and 1.20.0 packages remain for version history. The install, removal and guard scripts are unchanged between these versions.

The install script checks registered PC Tweaker and legacy `pc-tweaker-app` installations before starting the installer. An existing installation causes it to stop without replacing that installation. An earlier installation must be removed before installing this package; side-by-side installation and automatic takeover are not supported.

The removal script requires the registered installation directory to match the package directory. It uses the publisher's `uninstall.exe` and preserves nonzero error results. Registry inspection errors stop the operation. No registry values or execution-policy settings are changed by the guard.

## Verification

Native package verification of 1.20.3 is pending. The earlier version results below do not establish installation or removal results for this candidate.

[The 1.20.0 native package verification](https://github.com/AurelioAvila/pc-tweaker-app/actions/runs/41735334917) passed on Microsoft Windows Server 2025 Datacenter x64. It downloaded the exact public 1.20.0 installer, checked its pinned SHA-256 and verified the publisher signatures and timestamps of the installer, installed payload and uninstaller. Installation, existing-install rejection, mismatched-directory rejection, removal and preservation of the synthetic AppData marker all passed. No application startup, hardware scan, real entitlement or customer data was used. The Npackd GUI/CLI orchestration and Windows 10/11 client behavior were not exercised by this test.

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
