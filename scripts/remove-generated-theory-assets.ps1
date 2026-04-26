$target = Join-Path (Get-Location) "public\training\theory-1"
if (Test-Path $target) {
  Remove-Item -Recurse -Force $target
  Write-Host "Eliminada carpeta generada: $target"
} else {
  Write-Host "No existe carpeta generada de teóricas: $target"
}
