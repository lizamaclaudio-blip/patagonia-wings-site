# Mojibake Clean Restore Audit

Comando ejecutado:

`rg -n "�|Ã|Â|â" src public docs`

Resultado:

- Se detectaron coincidencias en contenido de UI (`src/app/routes/page.tsx`) y otras rutas/strings.
- No se detectaron caracteres de reemplazo `�` en `src` al restaurar base limpia.
- Si aparecen secuencias `Ã`, `Â` o `â`, corresponden al estado textual presente en la base estable `86c1db9`.

Decision durante el restore:

- Prioridad: recuperar version estable sin mezclar codigo roto.
- No se aplico reemplazo masivo ni reescritura de encoding para evitar reintroducir errores de runtime/sintaxis.
- Se conserva exactamente la base estable desde commit `86c1db9fd3965b99a4cfeeb24d0e03449af1cbd1`.

Nota:

- Cualquier saneamiento de mojibake debe abordarse como bloque dedicado posterior, con validacion visual y de build por lotes pequenos para no romper la estabilidad recuperada.
