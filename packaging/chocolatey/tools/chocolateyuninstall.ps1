$ErrorActionPreference = 'Stop'

# Exact name: 'PC Tweaker*' would also match the separate "PC Tweaker Uninstaller" app.
[array]$key = Get-UninstallRegistryKey -SoftwareName 'PC Tweaker'
if ($key.Count -eq 1) {
  $packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    fileType       = 'exe'
    silentArgs     = '/S'
    validExitCodes = @(0)
    file           = ($key[0].UninstallString -replace '"', '')
  }
  Uninstall-ChocolateyPackage @packageArgs
} elseif ($key.Count -eq 0) {
  Write-Warning "$env:ChocolateyPackageName has already been uninstalled by other means."
} else {
  Write-Warning "$($key.Count) matches found; nothing was uninstalled. Remove PC Tweaker from Installed apps."
  $key | ForEach-Object { Write-Warning "- $($_.DisplayName)" }
}
