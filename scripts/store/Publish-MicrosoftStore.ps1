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

With -ListingDir the same submission also replaces the Store listing in every language
(short description, description, features, keywords, release notes) from
<dir>/<language>.json; with -Screenshots it replaces the screenshots with
<dir>/<two-letter language>/<file> and their captions. -ListingOnly submits the listing
without a new package. -SetLanguages makes the Store listing languages match the files
(for example pt to pt-pt); -CertificationNotes leaves notes for the certification testers.

.EXAMPLE
pwsh scripts/store/Publish-MicrosoftStore.ps1 -SaveCredential
pwsh scripts/store/Publish-MicrosoftStore.ps1 -Version 1.15.8 -DryRun
pwsh scripts/store/Publish-MicrosoftStore.ps1 -Version 1.15.8
pwsh scripts/store/Publish-MicrosoftStore.ps1 -ListingOnly -ListingDir scripts/store/listing -Screenshots <dir> -DryRun
pwsh scripts/store/Publish-MicrosoftStore.ps1 -ExportListing <dir>
#>
[CmdletBinding(DefaultParameterSetName = 'Publish')]
param(
    [Parameter(ParameterSetName = 'Credential', Mandatory)][switch]$SaveCredential,
    [Parameter(ParameterSetName = 'Credential')][string]$TenantId,
    [Parameter(ParameterSetName = 'Credential')][string]$ClientId,
    # Read the client secret from the clipboard instead of prompting, then clear the clipboard.
    [Parameter(ParameterSetName = 'Credential')][switch]$SecretFromClipboard,
    # Only report the app's current submission state.
    [Parameter(ParameterSetName = 'Status', Mandatory)][switch]$Status,
    # Write the published listing of every language to <dir>/<language>.json (read only).
    [Parameter(ParameterSetName = 'Export', Mandatory)][string]$ExportListing,
    [Parameter(ParameterSetName = 'Publish', Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
    [Parameter(ParameterSetName = 'Publish')][string]$Exe = "$PSScriptRoot/../../src-tauri/target/release/PC Tweaker.shipped.exe",
    [Parameter(ParameterSetName = 'Publish')][Parameter(ParameterSetName = 'Status')][Parameter(ParameterSetName = 'Export')][Parameter(ParameterSetName = 'Listing')][string]$AppId = '9NH3C6DT1G87',
    [Parameter(ParameterSetName = 'Publish')][string]$ReleaseNotes,
    # Listing texts (<dir>/<language>.json) and screenshots (<dir>/<two-letter language>/<file>).
    [Parameter(ParameterSetName = 'Publish')][Parameter(ParameterSetName = 'Listing', Mandatory)][string]$ListingDir,
    [Parameter(ParameterSetName = 'Publish')][Parameter(ParameterSetName = 'Listing')][string]$Screenshots,
    # Submit the listing without a new package.
    [Parameter(ParameterSetName = 'Listing', Mandatory)][switch]$ListingOnly,
    # Make the Store listing languages match the files: add the missing ones (new languages
    # need -Screenshots) and remove the others. Without it a difference stops the run.
    [Parameter(ParameterSetName = 'Publish')][Parameter(ParameterSetName = 'Listing')][switch]$SetLanguages,
    # Notes for the certification testers, saved on the submission (up to 2000 characters).
    [Parameter(ParameterSetName = 'Publish')][Parameter(ParameterSetName = 'Listing')][ValidateLength(1, 2000)][string]$CertificationNotes,
    # A draft left open in Partner Center blocks new submissions; this deletes it first.
    [Parameter(ParameterSetName = 'Publish')][Parameter(ParameterSetName = 'Listing')][switch]$ReplacePending,
    # Build and verify the MSIX (and check the listing files) without contacting the Store.
    [Parameter(ParameterSetName = 'Publish')][Parameter(ParameterSetName = 'Listing')][switch]$DryRun
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$credentialPath = Join-Path $env:APPDATA 'PCTweaker-Store/msstore.json'
$api = 'https://manage.devcenter.microsoft.com/v1.0/my/applications'

if ($SaveCredential) {
    $tenant = if ($TenantId) { $TenantId } else { Read-Host 'Tenant ID' }
    $client = if ($ClientId) { $ClientId } else { Read-Host 'Client ID' }
    if ($SecretFromClipboard) {
        $clip = (Get-Clipboard -Raw).Trim()
        if (-not $clip -or $clip -match '^[0-9a-f-]{36}$') { throw 'The clipboard does not hold a client secret value (a key ID is a GUID).' }
        $secret = ConvertTo-SecureString $clip -AsPlainText -Force
        Set-Clipboard -Value $null
    } else { $secret = Read-Host 'Client secret' -AsSecureString }
    New-Item -ItemType Directory -Force (Split-Path $credentialPath) | Out-Null
    [ordered]@{ tenantId = $tenant.Trim(); clientId = $client.Trim(); clientSecret = ConvertFrom-SecureString $secret } |
        ConvertTo-Json | Set-Content -LiteralPath $credentialPath -Encoding utf8
    Write-Host "Saved to $credentialPath (secret protected with DPAPI)."
    return
}

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
    $params = @{ Method = $Method; Uri = "$api/$AppId$Path"; Headers = $headers; ContentType = 'application/json' }
    if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 50) }
    Invoke-RestMethod @params
}

if ($Status) {
    $app = Invoke-Store Get ''
    [ordered]@{
        lastPublished = $app.lastPublishedApplicationSubmission
        pending       = $app.PSObject.Properties['pendingApplicationSubmission']?.Value
    } | ConvertTo-Json -Depth 5
    $open = $app.PSObject.Properties['pendingApplicationSubmission']?.Value
    if ($open) { Invoke-Store Get "/submissions/$($open.id)/status" | ConvertTo-Json -Depth 10 }
    return
}

if ($ExportListing) {
    $app = Invoke-Store Get ''
    $published = Invoke-Store Get "/submissions/$($app.lastPublishedApplicationSubmission.id)"
    New-Item -ItemType Directory -Force $ExportListing | Out-Null
    foreach ($language in $published.listings.PSObject.Properties) {
        $language.Value.baseListing | ConvertTo-Json -Depth 20 |
            Set-Content -LiteralPath (Join-Path $ExportListing "$($language.Name).json") -Encoding utf8
    }
    Write-Host "Exported $(@($published.listings.PSObject.Properties).Count) listings from submission $($published.id)."
    return
}

# Listing texts and screenshots are checked before anything is packed or sent.
$listingTexts = @{}
if ($ListingDir) {
    $field = { param($text, $name) $text.PSObject.Properties[$name]?.Value }
    foreach ($file in Get-ChildItem -LiteralPath $ListingDir -Filter *.json) {
        $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8 | ConvertFrom-Json
        foreach ($limit in @(@('shortDescription', 1000), @('description', 10000), @('releaseNotes', 1500))) {
            if ((& $field $text $limit[0])?.Length -gt $limit[1]) { throw "$($file.Name): $($limit[0]) is over $($limit[1]) characters." }
        }
        $features = @(& $field $text 'features')
        if ($features.Count -gt 20 -or @($features | Where-Object { $_.Length -gt 200 }).Count) { throw "$($file.Name): features exceed 20 items or 200 characters." }
        if (@(& $field $text 'keywords').Count -gt 7) { throw "$($file.Name): more than 7 keywords." }
        if ($Screenshots) {
            $shots = @(& $field $text 'screenshots')
            if ($shots.Count -lt 1 -or $shots.Count -gt 10) { throw "$($file.Name): 1 to 10 screenshots are needed." }
            foreach ($shot in $shots) {
                $path = Join-Path $Screenshots "$(($file.BaseName -split '-')[0])/$($shot.file)"
                if (-not (Test-Path -LiteralPath $path)) { throw "Missing screenshot $path" }
                if ($shot.caption.Length -gt 200) { throw "$($file.Name): caption over 200 characters for $($shot.file)." }
            }
        }
        $listingTexts[$file.BaseName] = $text
    }
    Write-Host "Listing texts checked: $(($listingTexts.Keys | Sort-Object) -join ', ')"
    # The listing languages are chosen in Partner Center; the files must match them exactly.
    $published = Invoke-Store Get "/submissions/$((Invoke-Store Get '').lastPublishedApplicationSubmission.id)"
    $storeLanguages = @($published.listings.PSObject.Properties.Name | Sort-Object)
    $fileLanguages = @($listingTexts.Keys | Sort-Object)
    if (Compare-Object $storeLanguages $fileLanguages) {
        if (-not $SetLanguages) {
            throw "Store listing languages ($($storeLanguages -join ', ')) differ from $ListingDir ($($fileLanguages -join ', ')). Change the languages in Partner Center (app overview, Add/remove languages) or the files first, or pass -SetLanguages."
        }
        $added = @($fileLanguages | Where-Object { $_ -notin $storeLanguages })
        if ($added -and -not $Screenshots) { throw "New listing languages ($($added -join ', ')) need screenshots: pass -Screenshots." }
        Write-Host "Listing languages change from $($storeLanguages -join ', ') to $($fileLanguages -join ', ')."
    }
}
$work = Join-Path ([IO.Path]::GetTempPath()) "pctweaker-store-$(if ($ListingOnly) { 'listing' } else { $Version })"
Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $work | Out-Null
if ($ListingOnly -and $DryRun) { Write-Host 'Dry run: nothing sent.'; return }

if (-not $ListingOnly) {
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
$stage = New-Item -ItemType Directory -Force (Join-Path $work 'stage')
Copy-Item -LiteralPath "$PSScriptRoot/msix/Assets" -Destination $stage -Recurse
(Get-Content -LiteralPath "$PSScriptRoot/msix/AppxManifest.xml" -Raw).Replace('{{VERSION}}', "$Version.0") |
    Set-Content -LiteralPath (Join-Path $stage 'AppxManifest.xml') -Encoding utf8 -NoNewline
Copy-Item -LiteralPath $Exe -Destination (Join-Path $stage 'PC Tweaker.exe')
$msixName = "PCTweaker_$($Version).0_x64.msix"
$msix = Join-Path $work $msixName
& $makeAppx pack /d $stage /p $msix /o | Out-Null
if ($LASTEXITCODE) { throw "MakeAppx failed with exit code $LASTEXITCODE." }
$msixHash = (Get-FileHash -LiteralPath $msix -Algorithm SHA256).Hash
Write-Host "MSIX $msixName  SHA256 $msixHash"
if ($DryRun) { Write-Host "Dry run: nothing sent. Package at $msix"; return }
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
$uploads = @()
if (-not $ListingOnly) {
    foreach ($package in $submission.applicationPackages) { $package.fileStatus = 'PendingDelete' }
    $submission.applicationPackages += [pscustomobject]@{
        fileName = $msixName; fileStatus = 'PendingUpload'; minimumDirectXVersion = 'None'; minimumSystemRam = 'None'
    }
    $uploads += $msix
}
if ($ReleaseNotes) {
    foreach ($listing in $submission.listings.PSObject.Properties.Value) { $listing.baseListing | Add-Member -NotePropertyName releaseNotes -NotePropertyValue $ReleaseNotes -Force }
}
if ($CertificationNotes) { $submission.notesForCertification = $CertificationNotes }
if ($ListingDir -and $SetLanguages) {
    # Keep the listings whose language has a file, drop the others, and start each new language
    # from the listing of the same base language (pt for pt-pt), else en-us: title, links and
    # contact carry over, images do not (the screenshots below replace them).
    $listings = [ordered]@{}
    foreach ($name in $listingTexts.Keys | Sort-Object) {
        $listing = $submission.listings.PSObject.Properties[$name]?.Value
        if (-not $listing) {
            $source = @($submission.listings.PSObject.Properties | Where-Object { ($_.Name -split '-')[0] -eq ($name -split '-')[0] })[0]
            if (-not $source) { $source = $submission.listings.PSObject.Properties['en-us'] }
            $listing = $source.Value | ConvertTo-Json -Depth 30 | ConvertFrom-Json
            $listing.baseListing | Add-Member -NotePropertyName images -NotePropertyValue @() -Force
        }
        $listings[$name] = $listing
    }
    $submission.listings = [pscustomobject]$listings
}
if ($ListingDir) {
    foreach ($language in $submission.listings.PSObject.Properties) {
        $text = $listingTexts[$language.Name]
        if (-not $text) { throw "No listing text for $($language.Name) in $ListingDir." }
        $base = $language.Value.baseListing
        foreach ($name in 'shortDescription', 'description', 'features', 'keywords', 'releaseNotes') {
            $value = $text.PSObject.Properties[$name]?.Value
            if ($null -ne $value) { $base | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force }
        }
        if ($Screenshots) {
            $short = ($language.Name -split '-')[0]
            $images = @($base.images | Where-Object { $_.imageType -ne 'Screenshot' })
            foreach ($old in @($base.images | Where-Object { $_.imageType -eq 'Screenshot' })) { $old.fileStatus = 'PendingDelete'; $images += $old }
            foreach ($shot in $text.screenshots) {
                $name = "$short-$($shot.file)"
                Copy-Item -LiteralPath (Join-Path $Screenshots "$short/$($shot.file)") -Destination (Join-Path $work $name) -Force
                $uploads += Join-Path $work $name
                $images += [pscustomobject]@{ fileName = $name; fileStatus = 'PendingUpload'; imageType = 'Screenshot'; description = $shot.caption }
            }
            $base | Add-Member -NotePropertyName images -NotePropertyValue $images -Force
        }
    }
}
if ($uploads) {
    $zip = Join-Path $work 'upload.zip'
    Compress-Archive -LiteralPath $uploads -DestinationPath $zip -Force
    Invoke-RestMethod -Method Put -Uri $submission.fileUploadUrl -InFile $zip -Headers @{ 'x-ms-blob-type' = 'BlockBlob' } | Out-Null
}
Invoke-Store Put "/submissions/$($submission.id)" $submission | Out-Null
if ($ListingDir -and $SetLanguages) {
    $saved = @((Invoke-Store Get "/submissions/$($submission.id)").listings.PSObject.Properties.Name | Sort-Object)
    if (Compare-Object $saved @($listingTexts.Keys | Sort-Object)) {
        throw "The Store kept the listing languages $($saved -join ', '). Submission $($submission.id) is left as an uncommitted draft: set the languages on it in Partner Center (Store listings, Add/remove languages) and submit it there."
    }
}
Invoke-Store Post "/submissions/$($submission.id)/commit" | Out-Null

do {
    Start-Sleep -Seconds 30
    $state = Invoke-Store Get "/submissions/$($submission.id)/status"
    Write-Host "Submission $($submission.id): $($state.status)"
} while ($state.status -eq 'CommitStarted')
if ($state.status -like '*Failed') {
    throw "Submission $($submission.id) failed: $($state.statusDetails | ConvertTo-Json -Depth 10 -Compress)"
}
if ($ListingOnly) { Write-Host "Submitted the listing update $($submission.id). Microsoft certifies it; the Store page changes when that finishes."; return }
Write-Host "Submitted $msixName (SHA256 $msixHash). Microsoft now certifies and publishes it; the listing updates when that finishes."
