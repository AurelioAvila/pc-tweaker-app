<#
.SYNOPSIS
  Removes a few Debloat catalogue apps with a VM test build and checks they
  are gone. Run in a NORMAL (not elevated) PowerShell as the test user: the
  app removes apps for the signed-in user only and refuses to from an
  administrator session. Take a VM snapshot first; reinstalling is a Store
  action and is not automated.

    .\run-debloat.ps1 -TestBuild 'C:\test\PC Tweaker.exe'
#>
param(
    [Parameter(Mandatory)][string]$TestBuild,
    [string]$Apps = 'solitaire,news,feedback',
    [string]$Results = (Join-Path $PSScriptRoot 'results')
)

$ErrorActionPreference = 'Stop'
if (([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error 'Run this from a normal PowerShell, not as administrator.'
    exit 98
}
New-Item -ItemType Directory -Force -Path $Results | Out-Null
$before = Get-AppxPackage | Select-Object -ExpandProperty Name
$p = Start-Process -FilePath $TestBuild -ArgumentList '--test-debloat', $Apps -Wait -PassThru
$log = Join-Path $env:APPDATA 'com.aurel.pc-tweaker-app\test-pro-debloat.log'
if (Test-Path $log) { Copy-Item $log (Join-Path $Results "$env:COMPUTERNAME-debloat.log") -Force }
$after = Get-AppxPackage | Select-Object -ExpandProperty Name
$gone = $before | Where-Object { $_ -notin $after }
"Removed packages (seen by Get-AppxPackage): $($gone -join ', ')" | Tee-Object -FilePath (Join-Path $Results "$env:COMPUTERNAME-debloat-packages.txt")
Write-Host "Build exit code $($p.ExitCode) (apps still installed that were asked to go)."
exit $p.ExitCode
