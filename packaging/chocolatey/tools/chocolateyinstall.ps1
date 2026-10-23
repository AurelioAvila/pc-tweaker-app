$ErrorActionPreference = 'Stop'

# Same signed NSIS installer and switch as the winget manifest (AurelioAvila.PCTweaker); the in-app
# updater also uses it, so an update never creates a second installation.
$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/AurelioAvila/pc-tweaker-app/releases/download/v1.18.12/pc-tweaker-app_1.18.12_x64-setup.exe'
  checksum64     = 'DA860963F55846235BDCDB70CB35E65D7B5873D672F304026EB48B637F0240BB'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
  softwareName   = 'PC Tweaker'
}

Install-ChocolateyPackage @packageArgs
