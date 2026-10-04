<#
.SYNOPSIS
Packages the signed PC Tweaker binary as an MSIX and submits it to the Microsoft Store.

.DESCRIPTION
One-time setup: run with -SaveCredential and enter the Partner Center Entra application's
tenant ID, client ID and client secret. The secret is stored with Windows DPAPI under
%APPDATA%\PCTweaker-Store and can only be read by this Windows user.

A release run verifies the binary's Authenticode signature, packs the MSIX, uploads it
through the Microsoft Store submission API and commits the submission. Certification and
publication then happen on Microsoft's side; the script reports the state it reached.

.EXAMPLE
pwsh scripts/store/Publish-MicrosoftStore.ps1 -SaveCredential
pwsh scripts/store/Publish-MicrosoftStore.ps1 -Version 1.15.8 -DryRun
pwsh scripts/store/Publish-MicrosoftStore.ps1 -Version 1.15.8
#>
[CmdletBinding(DefaultParameterSetName = 'Publish')]
param(
    [Parameter(ParameterSetName = 'Credential', Mandatory)][switch]$SaveCredential,
    [Parameter(ParameterSetName = 'Publish', Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
    [Parameter(ParameterSetName = 'Publish')][string]$Exe = "$PSScriptRoot/../../src-tauri/target/release/tauri-app.shipped.exe",
    [Parameter(ParameterSetName = 'Publish')][string]$AppId = '9NH3C6DT1G87',
    [Parameter(ParameterSetName = 'Publish')][string]$ReleaseNotes,
    # A draft left open in Partner Center blocks new submissions; this deletes it first.
    [Parameter(ParameterSetName = 'Publish')][switch]$ReplacePending,
    # Build and verify the MSIX without contacting the Store.
    [Parameter(ParameterSetName = 'Publish')][switch]$DryRun
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$credentialPath = Join-Path $env:APPDATA 'PCTweaker-Store/msstore.json'
$api = 'https://manage.devcenter.microsoft.com/v1.0/my/applications'

if ($SaveCredential) {
    $tenant = Read-Host 'Tenant ID'
    $client = Read-Host 'Client ID'
    $secret = Read-Host 'Client secret' -AsSecureString
    New-Item -ItemType Directory -Force (Split-Path $credentialPath) | Out-Null
    [ordered]@{ tenantId = $tenant.Trim(); clientId = $client.Trim(); clientSecret = ConvertFrom-SecureString $secret } |
        ConvertTo-Json | Set-Content -LiteralPath $credentialPath -Encoding utf8
    Write-Host "Saved to $credentialPath (secret protected with DPAPI)."
    return
}

# 1. The Store package must carry the exact binary that was signed for this release.
$Exe = (Resolve-Path -LiteralPath $Exe).Path
& "$PSScriptRoot/../verify-authenticode.ps1" -Path $Exe | Out-Null
$productVersion = (Get-Item -LiteralPath $Exe).VersionInfo.ProductVersion
if ($productVersion -notmatch "^$([regex]::Escape($Version))(\D|$)") {
    throw "Binary ProductVersion is '$productVersion', expected $Version."
}

# 2. Pack the MSIX from the committed manifest template and logos.
$makeAppx = Get-ChildItem -LiteralPath (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin') -Filter makeappx.exe -Recurse |
    Where-Object { $_.Directory.Name -eq 'x64' } | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $makeAppx) { throw 'Windows SDK MakeAppx is required.' }
$work = Join-Path ([IO.Path]::GetTempPath()) "pctweaker-store-$Version"
Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
$stage = New-Item -ItemType Directory -Force (Join-Path $work 'stage')
Copy-Item -LiteralPath "$PSScriptRoot/msix/Assets" -Destination $stage -Recurse
(Get-Content -LiteralPath "$PSScriptRoot/msix/AppxManifest.xml" -Raw).Replace('{{VERSION}}', "$Version.0") |
    Set-Content -LiteralPath (Join-Path $stage 'AppxManifest.xml') -Encoding utf8 -NoNewline
Copy-Item -LiteralPath $Exe -Destination (Join-Path $stage 'tauri-app.exe')
$msixName = "PCTweaker_$($Version).0_x64.msix"
$msix = Join-Path $work $msixName
& $makeAppx pack /d $stage /p $msix /o | Out-Null
if ($LASTEXITCODE) { throw "MakeAppx failed with exit code $LASTEXITCODE." }
$msixHash = (Get-FileHash -LiteralPath $msix -Algorithm SHA256).Hash
Write-Host "MSIX $msixName  SHA256 $msixHash"
if ($DryRun) { Write-Host "Dry run: nothing sent. Package at $msix"; return }

# 3. Authenticate as the Partner Center Entra application.
if (-not (Test-Path -LiteralPath $credentialPath)) { throw 'No Store credential. Run with -SaveCredential first.' }
$cred = Get-Content -LiteralPath $credentialPath -Raw | ConvertFrom-Json
$secret = [Net.NetworkCredential]::new('', (ConvertTo-SecureString $cred.clientSecret)).Password
$token = (Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$($cred.tenantId)/oauth2/token" -Body @{
        grant_type = 'client_credentials'; client_id = $cred.clientId; client_secret = $secret
        resource = 'https://manage.devcenter.microsoft.com'
    }).access_token
$headers = @{ Authorization = "Bearer $token" }
function Invoke-Store($Method, $Path, $Body) {
    $params = @{ Method = $Method; Uri = "$api/$AppId$Path"; Headers = $headers }
    if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 50); $params.ContentType = 'application/json' }
    Invoke-RestMethod @params
}

# 4. Only one submission can be open at a time.
$app = Invoke-Store Get ''
$pending = $app.PSObject.Properties['pendingApplicationSubmission']
if ($pending -and $pending.Value) {
    if (-not $ReplacePending) { throw "Submission $($pending.Value.id) is already open in Partner Center. Re-run with -ReplacePending to delete it." }
    Invoke-Store Delete "/submissions/$($pending.Value.id)" | Out-Null
}

# 5. Clone the published submission, swap the package, upload and commit.
$submission = Invoke-Store Post '/submissions'
foreach ($package in $submission.applicationPackages) { $package.fileStatus = 'PendingDelete' }
$submission.applicationPackages += [pscustomobject]@{
    fileName = $msixName; fileStatus = 'PendingUpload'; minimumDirectXVersion = 'None'; minimumSystemRam = 'None'
}
if ($ReleaseNotes) {
    foreach ($listing in $submission.listings.PSObject.Properties.Value) { $listing.baseListing | Add-Member -NotePropertyName releaseNotes -NotePropertyValue $ReleaseNotes -Force }
}
$zip = Join-Path $work 'upload.zip'
Compress-Archive -LiteralPath $msix -DestinationPath $zip -Force
Invoke-RestMethod -Method Put -Uri $submission.fileUploadUrl -InFile $zip -Headers @{ 'x-ms-blob-type' = 'BlockBlob' } | Out-Null
Invoke-Store Put "/submissions/$($submission.id)" $submission | Out-Null
Invoke-Store Post "/submissions/$($submission.id)/commit" | Out-Null

do {
    Start-Sleep -Seconds 30
    $status = Invoke-Store Get "/submissions/$($submission.id)/status"
    Write-Host "Submission $($submission.id): $($status.status)"
} while ($status.status -eq 'CommitStarted')
if ($status.status -like '*Failed') {
    throw "Submission $($submission.id) failed: $($status.statusDetails | ConvertTo-Json -Depth 10 -Compress)"
}
Write-Host "Submitted $msixName (SHA256 $msixHash). Microsoft now certifies and publishes it; the listing updates when that finishes."
