# Safe local update for lib/ozon-shipment-method.ts
# Changes only:
# 1) dropoff search type: pvz -> sort_center
# 2) pagination: removes invalid empty cursor
# It does NOT change the return-point search type or the viewport.

$ErrorActionPreference = 'Stop'
$path = Join-Path (Get-Location) 'lib\ozon-shipment-method.ts'

if (-not (Test-Path -LiteralPath $path)) {
  throw "File not found: $path. Run this script from the repository root."
}

$content = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))
$original = $content

# Restrict this replacement to the ternary branch containing is_bulky: false,
# i.e. the dropoff search. The return-point branch remains unchanged.
$dropoffPattern = '(?s)(\?\s*\{.*?is_bulky\s*:\s*false\s*,.*?types\s*:\s*\[\s*")[^"]+("\s*\])'
if ([regex]::Matches($content, $dropoffPattern).Count -ne 1) {
  throw 'Could not uniquely find the dropoff types filter. No changes were made.'
}
$content = [regex]::Replace($content, $dropoffPattern, '${1}sort_center${2}', 1)

$cursorPattern = 'pagination\s*:\s*\{\s*cursor\s*:\s*""\s*,\s*limit\s*:\s*100\s*\}'
if ([regex]::Matches($content, $cursorPattern).Count -ne 1) {
  throw 'Could not uniquely find pagination with an empty cursor. No changes were made.'
}
$content = [regex]::Replace($content, $cursorPattern, 'pagination: { limit: 100 }', 1)

if ($content -eq $original) {
  throw 'No changes were required; no file was written.'
}

$backup = "$path.bak-before-ozon-sort-center-fix"
[System.IO.File]::WriteAllText($backup, $original, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host 'Update applied.' -ForegroundColor Green
Write-Host "Backup created: $backup"
Write-Host 'Review with: git diff -- lib/ozon-shipment-method.ts'
