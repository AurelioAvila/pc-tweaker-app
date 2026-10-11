<#
.SYNOPSIS
  Verifies the 1.18 controls on a test machine: apply -> verify -> revert.

.DESCRIPTION
  Read-only. It never writes the registry or touches a service: PC Tweaker
  applies and restores, this script only checks what PC Tweaker did against
  tweak-matrix.json, which is generated from the app's own catalogue.

  Run it as the same Windows user who uses PC Tweaker (the HKCU values belong
  to that user), in a normal, non-elevated PowerShell:

    1. .\verify-tweaks.ps1 -Phase Baseline   # before touching anything
    2. Apply every control in PC Tweaker (see README.md)
    3. .\verify-tweaks.ps1 -Phase Applied
    4. Change history > Restore active tweaks
    5. .\verify-tweaks.ps1 -Phase Reverted

  Results go to .\results\<computer>-<phase>.json and a summary table is
  printed. The exit code is the number of failed checks.
#>
param(
    [Parameter(Mandatory)]
    [ValidateSet('Plan', 'Baseline', 'Applied', 'Reverted')]
    [string]$Phase,
    [string]$Results = (Join-Path $PSScriptRoot 'results')
)

$ErrorActionPreference = 'Stop'
$matrix = Get-Content -Raw -Path (Join-Path $PSScriptRoot 'tweak-matrix.json') | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $Results | Out-Null
$baselineFile = Join-Path $Results "$env:COMPUTERNAME-baseline.json"

# --- This machine, read the way PC Tweaker reads it --------------------------
$cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$build = [int]$cv.CurrentBuild
$editionId = [string]$cv.EditionID

# The same three rules as settings_tweaks::availability.
function Get-Availability($tweak) {
    if ($build -lt $tweak.minBuild) { return 'windows_version' }
    $id = $editionId.ToLowerInvariant()
    if ($tweak.edition -eq 'ProOrHigher' -and $id.StartsWith('core')) { return 'windows_edition' }
    if ($tweak.edition -eq 'EnterpriseOrEducation') {
        $families = 'enterprise', 'education', 'iotenterprise', 'serverrdsh', 'cloudedition', 'professionaleducation'
        if (-not ($families | Where-Object { $id.StartsWith($_) })) { return 'windows_edition_enterprise' }
    }
    'applies'
}

function Read-Value($hive, $path, $name) {
    $root = if ($hive -eq 'HKCU') { 'HKCU:' } else { 'HKLM:' }
    $key = Get-Item -LiteralPath "$root\$path" -ErrorAction SilentlyContinue
    if (-not $key -or ($key.GetValueNames() -notcontains $name)) { return [pscustomobject]@{ exists = $false; kind = $null; data = $null } }
    [pscustomobject]@{
        exists = $true
        kind   = [string]$key.GetValueKind($name)
        data   = $key.GetValue($name, $null, 'DoNotExpandEnvironmentNames')
    }
}

function Read-Service($name) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (-not $svc) { return [pscustomobject]@{ installed = $false; startType = $null; running = $false } }
    $start = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\$name").Start
    $delayed = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\$name" -ErrorAction SilentlyContinue).DelayedAutostart
    $type = switch ($start) { 2 { if ($delayed -eq 1) { 'AUTO_START (DELAYED)' } else { 'AUTO_START' } } 3 { 'DEMAND_START' } 4 { 'DISABLED' } default { "START_$start" } }
    [pscustomobject]@{ installed = $true; startType = $type; running = ($svc.Status -eq 'Running') }
}

function Read-All {
    [pscustomobject]@{
        settings = @($matrix.settings | ForEach-Object {
                $t = $_
                [pscustomobject]@{
                    id     = $t.id
                    values = @($t.writes | ForEach-Object { Read-Value $t.hive $_.path $_.name })
                }
            })
        services = @($matrix.services | ForEach-Object { [pscustomobject]@{ id = $_.id; state = Read-Service $_.service } })
    }
}

Write-Host "Windows build $build, edition $editionId ($env:COMPUTERNAME)"

if ($Phase -eq 'Plan') {
    $matrix.settings | ForEach-Object {
        [pscustomobject]@{ Control = $_.id; Here = Get-Availability $_; Values = $_.writes.Count; Hive = $_.hive }
    } | Format-Table -AutoSize
    $matrix.services | ForEach-Object {
        $s = Read-Service $_.service
        [pscustomobject]@{ Control = $_.id; Here = if ($s.installed) { 'applies' } else { 'not_present' }; Values = 1; Hive = 'service' }
    } | Format-Table -AutoSize
    exit 0
}

$now = Read-All
$rows = New-Object System.Collections.Generic.List[object]
$failures = 0

if ($Phase -eq 'Baseline') {
    [pscustomobject]@{ build = $build; editionId = $editionId; takenAt = (Get-Date).ToString('o'); state = $now } |
        ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -Path $baselineFile
    Write-Host "Baseline saved to $baselineFile"
    exit 0
}

if (-not (Test-Path $baselineFile)) { throw "Run -Phase Baseline first: $baselineFile is missing." }
$base = (Get-Content -Raw $baselineFile | ConvertFrom-Json).state

function Same($a, $b) { $a.exists -eq $b.exists -and $a.kind -eq $b.kind -and "$($a.data)" -eq "$($b.data)" }
function Show($v) { if ($v.exists) { "$($v.kind) $($v.data)" } else { 'missing' } }

for ($i = 0; $i -lt $matrix.settings.Count; $i++) {
    $t = $matrix.settings[$i]
    $here = Get-Availability $t
    $problems = @()
    for ($j = 0; $j -lt $t.writes.Count; $j++) {
        $w = $t.writes[$j]
        $was = $base.settings[$i].values[$j]
        $is = $now.settings[$i].values[$j]
        $label = "$($t.hive)\$($w.path)\$($w.name)"
        if ($Phase -eq 'Applied' -and $here -eq 'applies') {
            if (-not ($is.exists -and $is.kind -eq 'DWord' -and [uint32]$is.data -eq [uint32]$w.value)) {
                $problems += "$label is $(Show $is), expected DWord $($w.value)"
            }
        }
        elseif (-not (Same $is $was)) {
            # Reverted, or a control this PC does not support: nothing may differ.
            $problems += "$label changed from $(Show $was) to $(Show $is)"
        }
    }
    $result = if ($problems) { 'FAIL' } elseif ($Phase -eq 'Applied' -and $here -ne 'applies') { "N/A ($here, untouched)" } else { 'PASS' }
    if ($problems) { $failures += $problems.Count }
    $rows.Add([pscustomobject]@{ Control = $t.id; Result = $result; Detail = ($problems -join '; ') })
}

for ($i = 0; $i -lt $matrix.services.Count; $i++) {
    $svc = $matrix.services[$i]
    $was = $base.services[$i].state
    $is = $now.services[$i].state
    $problems = @()
    if (-not $is.installed) {
        $result = 'N/A (not_present)'
    }
    elseif ($Phase -eq 'Applied') {
        if ($is.startType -ne $svc.startTypeWhenApplied) { $problems += "start type $($is.startType), expected $($svc.startTypeWhenApplied)" }
        $result = if ($problems) { 'FAIL' } else { 'PASS' }
    }
    else {
        if ($is.startType -ne $was.startType) { $problems += "start type $($is.startType), was $($was.startType)" }
        if ($is.running -ne $was.running) { $problems += "running $($is.running), was $($was.running)" }
        $result = if ($problems) { 'FAIL' } else { 'PASS' }
    }
    if ($problems) { $failures += $problems.Count }
    $rows.Add([pscustomobject]@{ Control = $svc.id; Result = $result; Detail = ($problems -join '; ') })
}

$rows | Format-Table -AutoSize -Wrap
[pscustomobject]@{ build = $build; editionId = $editionId; phase = $Phase; at = (Get-Date).ToString('o'); rows = $rows; state = $now } |
    ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -Path (Join-Path $Results "$env:COMPUTERNAME-$($Phase.ToLowerInvariant()).json")
Write-Host "$Phase on build $build ($editionId): $failures failed check(s)."
exit $failures
