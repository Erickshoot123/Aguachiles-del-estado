param([Parameter(Mandatory)][string]$Archive, [Parameter(Mandatory)][string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Directory]::CreateDirectory($Destination) | Out-Null
$zip = [IO.Compression.ZipFile]::OpenRead($Archive)
try {
  foreach ($name in @('lib/net462/Microsoft.Web.WebView2.Core.dll', 'lib/net462/Microsoft.Web.WebView2.WinForms.dll', 'runtimes/win-x64/native/WebView2Loader.dll', 'LICENSE.txt')) {
    $entry = $zip.GetEntry($name)
    if (-not $entry) { throw "No se encontró $name en el SDK oficial" }
    $fileName = if ($name -eq 'LICENSE.txt') { 'WebView2-LICENSE.txt' } else { [IO.Path]::GetFileName($name) }
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, [IO.Path]::Combine($Destination, $fileName), $true)
  }
} finally { $zip.Dispose() }
