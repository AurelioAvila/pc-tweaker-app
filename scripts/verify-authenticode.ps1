[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string[]]$Path,
    [string]$ExpectedPublisher = 'Aurelio Avila',
    [string]$SignToolPath = $env:SIGNTOOL_PATH
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $SignToolPath) {
    $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($command) { $SignToolPath = $command.Source }
    else {
        $sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
        $SignToolPath = Get-ChildItem -LiteralPath $sdk -Filter signtool.exe -Recurse |
            Where-Object { $_.Directory.Name -eq 'x64' } |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
    }
}
if (-not $SignToolPath -or -not (Test-Path -LiteralPath $SignToolPath -PathType Leaf)) {
    throw 'Windows SDK SignTool is required. Set SIGNTOOL_PATH to its full path.'
}
foreach ($item in $Path) {
    $file = Get-Item -LiteralPath $item
    if ($file.PSIsContainer -or $file.Extension -notin @('.exe', '.msi', '.dll')) {
        throw "Expected an EXE, MSI or DLL: $item"
    }
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
    if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate) {
        throw "Authenticode verification failed ($($signature.Status)): $item"
    }
    $publisher = $signature.SignerCertificate.GetNameInfo(
        [System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
    if ($publisher -cne $ExpectedPublisher) { throw "Unexpected publisher '$publisher': $item" }
    if (-not $signature.TimeStamperCertificate) { throw "Missing trusted timestamp: $item" }
    & $SignToolPath verify /pa /all /v /tw $file.FullName | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "SignTool failed or warned for: $item" }
    if ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne $hash) {
        throw "File changed during verification: $item"
    }
    [pscustomobject]@{
        File = $file.Name
        SHA256 = $hash.ToLowerInvariant()
        Status = 'Valid'
        Publisher = $publisher
        SignerThumbprint = $signature.SignerCertificate.Thumbprint
        TimestampSubject = $signature.TimeStamperCertificate.Subject
    }
}
