$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or -not $env:RUNNER_TEMP) {
  throw 'Installer execution is restricted to the disposable CI runner.'
}
if ($env:RELEASE_TAG -notmatch '^v\d+\.\d+\.\d+$') { throw 'Invalid release tag' }
$version = (Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json).version
if ($env:RELEASE_TAG -ne "v$version") { throw 'Candidate tag must match checked-out source' }
$root = Join-Path $env:RUNNER_TEMP 'pct-installer-check'
$old = Join-Path $root 'old'
$candidate = Join-Path $root 'candidate'
New-Item -ItemType Directory -Path $old,$candidate -Force | Out-Null
gh release download v1.8.0 --repo $env:GITHUB_REPOSITORY --pattern '*_x64-setup.exe' --pattern '*_x64_en-US.msi' --dir $old
if ($LASTEXITCODE -ne 0) { throw 'Could not download upgrade baseline' }
gh release download $env:RELEASE_TAG --repo $env:GITHUB_REPOSITORY --pattern '*_x64-setup.exe' --pattern '*_x64_en-US.msi' --dir $candidate
if ($LASTEXITCODE -ne 0) { throw 'Could not download candidate installers' }

function Assert-Signed([string]$Path) {
  $sig = Get-AuthenticodeSignature -LiteralPath $Path
  if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Thumbprint -ne '4F8341A74D16077AE1849DC8B8CAC99F22606754' -or -not $sig.TimeStamperCertificate) {
    throw "Invalid signature, publisher or timestamp: $Path"
  }
  Write-Output "Verified signed payload: $([IO.Path]::GetFileName($Path))"
}
function Run-Installer([string]$Path, [string[]]$Arguments) {
  $process = Start-Process -FilePath $Path -ArgumentList $Arguments -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -notin @(0,3010)) { throw "Installer returned $($process.ExitCode): $Path" }
}
function Assert-Payload([string]$Directory, [bool]$RequireLibrary = $false) {
  $exe = Join-Path $Directory 'tauri-app.exe'
  Assert-Signed $exe
  $actual = (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion
  if ($actual -notlike "$version*") { throw "Wrong installed version: $actual" }
  $dll = Join-Path $Directory 'tauri_app_lib.dll'
  # Rust links the application library into the executable. WiX also ships
  # the cdylib build output; NSIS deliberately includes only the executable.
  if ($RequireLibrary -or (Test-Path -LiteralPath $dll)) { Assert-Signed $dll }
  $app = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru
  try {
    if ($app.WaitForExit(5000)) { throw "Installed application exited during startup: $($app.ExitCode)" }
    Write-Output 'Installed application remained running through startup.'
  } finally {
    if (-not $app.HasExited) { Stop-Process -Id $app.Id -Force }
  }
}

foreach ($file in Get-ChildItem -LiteralPath $candidate -File) { Assert-Signed $file.FullName }
$oldExe = @(Get-ChildItem -LiteralPath $old -Filter '*_x64-setup.exe')
$newExe = @(Get-ChildItem -LiteralPath $candidate -Filter '*_x64-setup.exe')
$oldMsi = @(Get-ChildItem -LiteralPath $old -Filter '*.msi')
$newMsi = @(Get-ChildItem -LiteralPath $candidate -Filter '*.msi')
if (@($oldExe.Count,$newExe.Count,$oldMsi.Count,$newMsi.Count | Where-Object { $_ -ne 1 }).Count) { throw 'Expected one installer of each type' }

$nsisDirectory = Join-Path $root 'nsis-app'
Run-Installer $oldExe[0].FullName @('/S',"/D=$nsisDirectory")
Run-Installer $newExe[0].FullName @('/S',"/D=$nsisDirectory")
Assert-Payload $nsisDirectory
$uninstaller = @(Get-ChildItem -LiteralPath $nsisDirectory -Filter '*uninstall*.exe')
if ($uninstaller.Count -ne 1) { throw 'NSIS uninstaller missing' }
Assert-Signed $uninstaller[0].FullName
Run-Installer $uninstaller[0].FullName @('/S',"_?=$nsisDirectory")
if (Test-Path -LiteralPath (Join-Path $nsisDirectory 'tauri-app.exe')) { throw 'NSIS uninstall left the application behind' }

$msiDirectory = Join-Path $root 'msi-app'
Run-Installer 'msiexec.exe' @('/i',$oldMsi[0].FullName,'/qn','/norestart',"INSTALLDIR=$msiDirectory")
Run-Installer 'msiexec.exe' @('/i',$newMsi[0].FullName,'/qn','/norestart',"INSTALLDIR=$msiDirectory")
Assert-Payload $msiDirectory $true
Run-Installer 'msiexec.exe' @('/x',$newMsi[0].FullName,'/qn','/norestart')
if (Test-Path -LiteralPath (Join-Path $msiDirectory 'tauri-app.exe')) { throw 'MSI uninstall left the application behind' }
Write-Output 'PASS: signed EXE/MSI, installed application and shipped DLL, startup, signed NSIS uninstaller, upgrade from 1.8.0 and uninstall for both formats.'
