$ErrorActionPreference = 'Stop'

# Same signed NSIS installer and switch as the winget manifest (AurelioAvila.PCTweaker); the in-app
# updater also uses it, so an update never creates a second installation.
$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/AurelioAvila/pc-tweaker-app/releases/download/v1.18.14/pc-tweaker-app_1.18.14_x64-setup.exe'
  checksum64     = '68490636C03536AF2A788DAD5A1C6C0A9BEC0651A65C9DA48C219452BB680BD4'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
  softwareName   = 'PC Tweaker'
}

Install-ChocolateyPackage @packageArgs
