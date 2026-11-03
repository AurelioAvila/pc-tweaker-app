$ErrorActionPreference = 'Stop'

# Same signed NSIS installer and switch as the winget manifest (AurelioAvila.PCTweaker); the in-app
# updater also uses it, so an update never creates a second installation.
$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/AurelioAvila/pc-tweaker-app/releases/download/v1.20.0/pc-tweaker-app_1.20.0_x64-setup.exe'
  checksum64     = '84EDD3545EE92C50696F02416A676E71E584617F09930B79089755007DDB63DC'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
  softwareName   = 'PC Tweaker'
}

Install-ChocolateyPackage @packageArgs
