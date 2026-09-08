[CmdletBinding()]
param([string]$Tag)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. "$PSScriptRoot/release-safety.ps1"
if ($Tag) { Assert-ReleaseTag -Tag $Tag }
$endpoint = 'repos/AurelioAvila/pc-tweaker-app/releases/latest'
if ($Tag) { $endpoint = 'repos/AurelioAvila/pc-tweaker-app/releases/tags/' + [uri]::EscapeDataString($Tag) }
$json = & gh api $endpoint
if ($LASTEXITCODE -ne 0) { throw 'Could not retrieve release metadata.' }
$release = $json | ConvertFrom-Json
Assert-ReleaseTag -Tag $release.tag_name
if ($release.draft -or $release.prerelease) { throw 'Only stable, published releases may reach WinGet.' }
$installers = @($release.assets | Where-Object { $_.name -match '\.(exe|msi)$' })
if (@($installers | Where-Object { $_.name -match '_x64-setup\.exe$' }).Count -ne 1 -or
    @($installers | Where-Object { $_.name -match '\.msi$' }).Count -lt 1) {
    throw 'Expected one versioned x64 setup and at least one MSI.'
}
$tempRoot = (Resolve-Path -LiteralPath ([IO.Path]::GetTempPath())).ProviderPath
$directory = [IO.Path]::GetFullPath((Join-Path $tempRoot ('pctweaker-release-' + [guid]::NewGuid())))
New-Item -ItemType Directory -Path $directory | Out-Null
try {
    foreach ($asset in $installers) {
        if ($asset.name -notmatch '^[A-Za-z0-9._-]+$' -or $asset.digest -notmatch '^sha256:[a-fA-F0-9]{64}$') {
            throw 'Unsafe asset name or missing GitHub SHA-256 digest.'
        }
        $file = Join-Path $directory $asset.name
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $file
        $digest = 'sha256:' + (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($digest -ne $asset.digest) { throw "GitHub digest mismatch: $($asset.name)" }
        & "$PSScriptRoot/verify-authenticode.ps1" -Path $file | Out-Host
    }
    Assert-ReleaseTag -Tag $release.tag_name
    if ($env:GITHUB_OUTPUT) { "tag=$($release.tag_name)" | Out-File -LiteralPath $env:GITHUB_OUTPUT -Append -Encoding utf8 }
    Write-Output "Verified release: $($release.tag_name)"
} finally {
    # Resolve again immediately before deletion; reject root, siblings and links.
    $resolvedDirectory = (Resolve-Path -LiteralPath $directory).ProviderPath
    Assert-TemporaryDirectory -ResolvedDirectory $resolvedDirectory -ExpectedDirectory $directory -TempRoot $tempRoot
    Remove-Item -LiteralPath $resolvedDirectory -Recurse -Force
}
