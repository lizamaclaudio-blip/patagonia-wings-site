# Patagonia Wings Web - Limpieza de carpetas temporales de parches
# Ejecutar desde la raiz del repo Web.

$root = Get-Location
Write-Host "Patagonia Wings Web - Clean temporary patch folders"
Write-Host "Root: $root"

$patterns = @(
  "_WEB_*",
  "ACARS_*",
  "patch_*",
  "*_patch",
  "*_PATCH",
  "patagonia_*_patch"
)

foreach ($pattern in $patterns) {
  Get-ChildItem -Path $root -Directory -Filter $pattern -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Removing:" $_.FullName
    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Done. Temporary folders removed if they existed."
