<#
.SYNOPSIS
  Automated apply -> verify -> revert of the 1.18 controls and the starter
  profiles with a VM test build.

.DESCRIPTION
  Needs a debug test build made with the Cargo feature that unlocks Pro for
  tests (see README.md); a release build has no such option. Run it in the
  VM, in an elevated PowerShell, as the user being tested:

    .\run-auto.ps1 -TestBuild 'C:\test\PC Tweaker.exe'

  The build applies and restores every control itself and, on restore, reads
  back every registry value it recorded before applying. verify-tweaks.ps1
  independently checks the registry and the service before, after applying
  and after restoring. The exit code is the number of failed checks.
#>
param(
    [Parameter(Mandatory)][string]$TestBuild,
    [string]$Results = (Join-Path $PSScriptRoot 'results')
)

$ErrorActionPreference = 'Stop'
# Machine-wide controls need a full administrator token; without one they
# would all read as refused and the run would prove nothing.
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error 'Run this from an elevated PowerShell (Run as administrator).'
    exit 99
}
$verify = Join-Path $PSScriptRoot 'verify-tweaks.ps1'
$matrix = Get-Content -Raw -Path (Join-Path $PSScriptRoot 'tweak-matrix.json') | ConvertFrom-Json
$log = Join-Path $env:APPDATA 'com.aurel.pc-tweaker-app\test-pro-cli.log'

# Returns the build's exit code: refused controls on apply (unsupported ones
# are expected), real failures on restore (restore errors or values that did
# not read back identical).
function Invoke-Build([string]$Action, [string]$Ids, [string]$Tag) {
    $p = Start-Process -FilePath $TestBuild -ArgumentList $Action, $Ids -Wait -PassThru
    if (Test-Path $log) { Copy-Item $log (Join-Path $Results "$env:COMPUTERNAME-$Tag$($Action.Replace('--test', '')).log") -Force }
    Write-Host "$Tag $Action exit code $($p.ExitCode)"
    $p.ExitCode
}

New-Item -ItemType Directory -Force -Path $Results | Out-Null
$ids = (@($matrix.settings.id) + @($matrix.services.id)) -join ','
& $verify -Phase Baseline -Results $Results
$null = Invoke-Build '--test-apply' $ids 'controls'
& $verify -Phase Applied -Results $Results
$appliedFailures = $LASTEXITCODE
$restoreFailures = Invoke-Build '--test-rollback' $ids 'controls'
& $verify -Phase Reverted -Results $Results
$revertedFailures = $LASTEXITCODE
Write-Host "Controls - applied: $appliedFailures failed check(s); reverted: $revertedFailures failed check(s); build restore check: $restoreFailures failure(s)."

# Starter profiles: each one applied and restored on its own, with the
# build's read-back of every registry value it touched.
$profileFailures = 0
$presets = Join-Path $PSScriptRoot 'starter-presets.mjs'
if (Test-Path $presets) {
    $text = Get-Content -Raw -Path $presets
    foreach ($m in [regex]::Matches($text, '(?s)id: "(\w+)",\s*icon: "\w+",\s*tweaks: \[(.*?)\]')) {
        $name = $m.Groups[1].Value
        $profileIds = ([regex]::Matches($m.Groups[2].Value, '\{ id: "(\w+)"') | ForEach-Object { $_.Groups[1].Value }) -join ','
        $null = Invoke-Build '--test-apply' $profileIds "profile-$name"
        $profileFailures += Invoke-Build '--test-rollback' $profileIds "profile-$name"
    }
    Write-Host "Profiles: $profileFailures restore failure(s); details in the *-profile-*.log files."
}
exit ($appliedFailures + $revertedFailures + $restoreFailures + $profileFailures)
