param([Parameter(Mandatory = $true)][ValidateSet('Install', 'Uninstall')][string]$Operation)
$ErrorActionPreference = 'Stop'

function Get-ProductRegistrations {
    foreach ($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryHive]::LocalMachine)) {
        foreach ($view in @([Microsoft.Win32.RegistryView]::Registry32, [Microsoft.Win32.RegistryView]::Registry64)) {
            $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
            try {
                $root = $base.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Uninstall', $false)
                if ($null -eq $root) { continue }
                try {
                    foreach ($name in $root.GetSubKeyNames()) {
                        $item = $root.OpenSubKey($name, $false)
                        if ($null -eq $item) { continue }
                        try {
                            $displayName = [string]$item.GetValue('DisplayName', '')
                            if ($displayName -in @('PC Tweaker', 'pc-tweaker-app')) {
                                [pscustomobject]@{ Name = $displayName; Directory = [string]$item.GetValue('InstallLocation', '') }
                            }
                        } finally { $item.Dispose() }
                    }
                } finally { $root.Dispose() }
            } finally { $base.Dispose() }
        }
    }
}

try {
    $registrations = @(Get-ProductRegistrations)
    if ($Operation -eq 'Install') {
        if ($registrations.Count -gt 0) {
            Write-Output 'An existing PC Tweaker installation was found. It has not been changed.'
            exit 10
        }
    } else {
        if ($registrations.Count -eq 0) { exit 12 }
        $expected = [IO.Path]::GetFullPath((Get-Location).Path).TrimEnd([IO.Path]::DirectorySeparatorChar)
        foreach ($registration in $registrations) {
            if ([string]::IsNullOrWhiteSpace($registration.Directory)) { exit 12 }
            $directory = $registration.Directory
            # The installer writes InstallLocation surrounded by double quotes.
            if ($directory.Length -ge 2 -and $directory[0] -eq '"' -and $directory[$directory.Length - 1] -eq '"') {
                $directory = $directory.Substring(1, $directory.Length - 2)
            }
            $actual = [IO.Path]::GetFullPath($directory).TrimEnd([IO.Path]::DirectorySeparatorChar)
            if (-not [string]::Equals($actual, $expected, [StringComparison]::OrdinalIgnoreCase)) {
                Write-Output 'The registered installation does not belong to this package directory.'
                exit 12
            }
        }
    }
    exit 0
} catch {
    Write-Error -ErrorAction Continue ('Cannot verify the existing installation: ' + $_.Exception.Message)
    exit 11
}
