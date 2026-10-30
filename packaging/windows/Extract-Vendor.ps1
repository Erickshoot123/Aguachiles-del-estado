param([Parameter(Mandatory)][string]$Archive, [Parameter(Mandatory)][string]$Destination, [switch]$Postgres)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$targetRoot = [IO.Path]::GetFullPath($Destination)
[IO.Directory]::CreateDirectory($targetRoot) | Out-Null
$zip = [IO.Compression.ZipFile]::OpenRead($Archive)
try {
  foreach ($entry in $zip.Entries) {
    $entryName = $entry.FullName.Replace('\', '/')
    if ($Postgres) {
      if ($entryName -notmatch '^pgsql/(bin|lib|share|doc)/') { continue }
      $relative = $entryName.Substring(6)
    } else {
      if ($entryName -notmatch '^node-[^/]+/(node.exe|LICENSE)$') { continue }
      $relative = $entryName.Substring($entryName.IndexOf('/') + 1)
    }
    $target = [IO.Path]::GetFullPath([IO.Path]::Combine($targetRoot, $relative.Replace('/', '\')))
    if (-not $target.StartsWith($targetRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta inválida en el archivo descargado' }
    if ($entryName.EndsWith('/')) { [IO.Directory]::CreateDirectory($target) | Out-Null; continue }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
  }
} finally { $zip.Dispose() }
