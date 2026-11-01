$ErrorActionPreference = 'Stop'

# Same signed NSIS installer and switch as the winget manifest (AurelioAvila.PCTweaker); the in-app
# updater also uses it, so an update never creates a second installation.
$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/AurelioAvila/pc-tweaker-app/releases/download/v1.18.28/pc-tweaker-app_1.18.28_x64-setup.exe'
  checksum64     = '11A0D7F9493D0496C6A322B1992634AB93F9ED324A457DA0A0942758AD6C4A17'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
  softwareName   = 'PC Tweaker'
}

Install-ChocolateyPackage @packageArgs
