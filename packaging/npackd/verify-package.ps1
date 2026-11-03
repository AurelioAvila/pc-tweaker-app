$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or -not $env:RUNNER_TEMP) {
    throw 'Native package execution is restricted to the disposable CI runner.'
}
$reviewedReleases = @{
    'v1.19.0' = 'd7a5e6f6418501fd815b739066e507f9e1690a2d5771e0ee8962a2da94add370'
    'v1.20.0' = '84edd3545ee92c50696f02416a676e71e584617f09930b79089755007ddb63dc'
}
if (-not $reviewedReleases.ContainsKey($env:RELEASE_TAG)) {
    throw 'This package check requires an explicitly reviewed public release and pinned hash.'
}
$version = $env:RELEASE_TAG.Substring(1)
$expectedHash = $reviewedReleases[$env:RELEASE_TAG]
$packageSource = Join-Path $PSScriptRoot 'pc-tweaker64'
$work = Join-Path $env:RUNNER_TEMP 'Npackd PC Tweaker verification'
$package = Join-Path $work ('PC Tweaker ' + $version)
$other = Join-Path $work 'Other package directory'
New-Item -ItemType Directory -Path (Join-Path $package '.Npackd'), (Join-Path $other '.Npackd') -Force | Out-Null
foreach ($directory in @($package, $other)) {
    Copy-Item -LiteralPath (Join-Path $packageSource 'Install.bat'), (Join-Path $packageSource 'Uninstall.bat'), (Join-Path $packageSource 'Guard.ps1') -Destination (Join-Path $directory '.Npackd')
}
$assetName = 'pc-tweaker-app_' + $version + '_x64-setup.exe'
gh release download $env:RELEASE_TAG --repo $env:GITHUB_REPOSITORY --pattern $assetName --dir $package
if ($LASTEXITCODE -ne 0) { throw 'Signed release download failed.' }
$installer = Join-Path $package $assetName
if ((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
    throw 'The downloaded installer differs from the reviewed final artifact.'
}
function Assert-Signed([string]$Path) {
    $sig = Get-AuthenticodeSignature -LiteralPath $Path
    if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Thumbprint -ne '4F8341A74D16077AE1849DC8B8CAC99F22606754' -or -not $sig.TimeStamperCertificate) {
        throw ('Invalid publisher signature or timestamp: ' + [IO.Path]::GetFileName($Path))
    }
}
function Run-PackageScript([string]$Directory, [string]$Name, [int]$ExpectedExit) {
    $log = Join-Path $work ([Guid]::NewGuid().ToString('N'))
    $process = Start-Process -FilePath $env:ComSpec -WorkingDirectory $Directory -ArgumentList @('/d', '/c', ('.Npackd\' + $Name + '.bat')) -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput ($log + '.out.txt') -RedirectStandardError ($log + '.err.txt')
    if ($process.ExitCode -ne $ExpectedExit) {
        Get-Content -LiteralPath ($log + '.out.txt'), ($log + '.err.txt')
        throw ('Unexpected package result for ' + $Name + ': ' + $process.ExitCode + ', expected ' + $ExpectedExit)
    }
    Write-Output ('PASS: ' + $Name + ' returned ' + $ExpectedExit)
}
Assert-Signed $installer
$env:NPACKD_PACKAGE_BINARY = $installer
Run-PackageScript $package 'Install' 0
$main = Join-Path $package 'PC Tweaker.exe'
$uninstaller = Join-Path $package 'uninstall.exe'
Assert-Signed $main
Assert-Signed $uninstaller
if ((Get-Item -LiteralPath $main).VersionInfo.ProductVersion -notlike ($version + '*')) { throw 'Installed payload has the wrong version.' }
$mainHash = (Get-FileHash -LiteralPath $main -Algorithm SHA256).Hash
$dataDirectory = Join-Path $env:APPDATA 'com.aurel.pc-tweaker-app'
New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
$marker = Join-Path $dataDirectory 'npackd-verification-marker.txt'
Set-Content -LiteralPath $marker -Value 'Synthetic preservation marker; no license or customer data.' -Encoding UTF8
$markerHash = (Get-FileHash -LiteralPath $marker -Algorithm SHA256).Hash

Run-PackageScript $package 'Install' 10
if ((Get-FileHash -LiteralPath $main -Algorithm SHA256).Hash -ne $mainHash) { throw 'Rejected reinstall changed the existing program.' }
Copy-Item -LiteralPath $uninstaller -Destination (Join-Path $other 'uninstall.exe')
Run-PackageScript $other 'Uninstall' 12
if ((Get-FileHash -LiteralPath $main -Algorithm SHA256).Hash -ne $mainHash) { throw 'Mismatched-directory removal changed the real program.' }
Run-PackageScript $package 'Uninstall' 0
if (Test-Path -LiteralPath $main) { throw 'The package removal left its main executable behind.' }
if (-not (Test-Path -LiteralPath $marker) -or (Get-FileHash -LiteralPath $marker -Algorithm SHA256).Hash -ne $markerHash) {
    throw 'Silent removal did not preserve the synthetic application-data marker.'
}
$scriptHashes = @{}
foreach ($name in @('Install.bat', 'Uninstall.bat', 'Guard.ps1')) {
    $normalized = (Get-Content -LiteralPath (Join-Path $packageSource $name) -Raw).Replace("`r`n", "`n")
    $scriptHashes[$name] = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($normalized))).ToLowerInvariant()
}
$result = [ordered]@{
    version = $version
    installer_sha256 = $expectedHash
    os = (Get-CimInstance Win32_OperatingSystem).Caption
    architecture = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    package_path_contains_spaces = $package.Contains(' ')
    signed_installer_payload_and_uninstaller = $true
    clean_install = $true
    existing_install_rejected_before_replacement = $true
    mismatched_uninstall_directory_rejected = $true
    package_uninstall = $true
    synthetic_appdata_marker_preserved = $true
    normalized_script_hashes = $scriptHashes
    app_startup_or_hardware_scan_performed = $false
    real_license_or_customer_data_used = $false
}
Write-Output ('NPACKD_RESULT=' + ($result | ConvertTo-Json -Depth 4 -Compress))
@('## Npackd package verification', '', '- Signed release, payload and uninstaller verified.', '- Installation into a directory containing spaces passed.', '- Existing-install and mismatched-uninstall guards passed.', '- Package removal preserved a synthetic application-data marker.', '- No hardware scan, real entitlement or customer data used.') | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY
