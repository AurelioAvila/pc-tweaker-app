function Assert-ReleaseTag {
    param([AllowNull()][AllowEmptyString()][string]$Tag)
    # Stable releases only. Absolute anchors also reject a trailing newline.
    if ($Tag -cnotmatch '\Av(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\z') {
        throw 'Invalid release tag: expected vMAJOR.MINOR.PATCH with no whitespace or newlines.'
    }
}

function Assert-TemporaryDirectory {
    param([string]$ResolvedDirectory, [string]$ExpectedDirectory, [string]$TempRoot)
    $comparison = [StringComparison]::OrdinalIgnoreCase
    $root = [IO.Path]::GetFullPath($TempRoot).TrimEnd('\', '/')
    $candidate = [IO.Path]::GetFullPath($ResolvedDirectory).TrimEnd('\', '/')
    $expected = [IO.Path]::GetFullPath($ExpectedDirectory).TrimEnd('\', '/')
    if (-not [IO.Path]::IsPathFullyQualified($ResolvedDirectory) -or
        -not $candidate.Equals($expected, $comparison) -or
        -not $candidate.StartsWith($root + [IO.Path]::DirectorySeparatorChar, $comparison) -or
        -not ([IO.Path]::GetDirectoryName($candidate)).Equals($root, $comparison) -or
        [IO.Path]::GetFileName($candidate) -cnotmatch '\Apctweaker-release-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\z') {
        throw 'Unsafe temporary cleanup target: expected the exact absolute directory created under the temporary root.'
    }
    $item = Get-Item -LiteralPath $candidate -Force
    if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Unsafe temporary cleanup target: directory links and non-directories are not allowed.'
    }
}
