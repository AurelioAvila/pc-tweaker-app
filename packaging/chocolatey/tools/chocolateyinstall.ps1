$ErrorActionPreference = 'Stop'

# Same signed NSIS installer and switch as the winget manifest (AurelioAvila.PCTweaker); the in-app
# updater also uses it, so an update never creates a second installation.
$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/AurelioAvila/pc-tweaker-app/releases/download/v1.18.16/pc-tweaker-app_1.18.16_x64-setup.exe'
  checksum64     = 'D87A62CC4E624496F2F0BB07DBCE5E34F96A52AEFD09EC1953138A23912FECAE'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
  softwareName   = 'PC Tweaker'
}

Install-ChocolateyPackage @packageArgs
