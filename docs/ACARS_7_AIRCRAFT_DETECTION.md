# ACARS 7.0.0 - Deteccion de aeronave y addon

Fecha: 2026-04-29

## Objetivo
Separar el modelo operativo web del modelo tecnico ACARS sin tocar el selector web.

## Regla de separacion
- Web decide: `aircraftTypeCode` (ej. C208) + matricula (ej. CC-AEG).
- ACARS detecta internamente: variante tecnica real (ej. `C208_BLACKSQUARE`) para lectura y reglas.

## Fuentes de datos
1. Datos despacho web (`PreparedDispatch`): `AircraftTypeCode`, `AircraftVariantCode` (si existe), `AddonProvider`.
2. Datos simulador (SimConnect): `TITLE` y metadatos de aeronave cargada.
3. Catalogo de perfiles ACARS (`AircraftProfiles/*.json`).

## Prioridad de matching actual
1. Match por `ExactTitles` del perfil.
2. Match por `Matches` (contains) del perfil.
3. Heuristicas concretas (ejemplo familia LVFR Airbus).
4. Fallback seguro: `MSFS_NATIVE`.

## Comportamiento operativo
- Si web dice C208 y sim carga C208 Black Square, ACARS usa perfil variante para telemetria.
- Si no hay certeza de soporte de una senal: queda `unsupported` o `unreliable`, UI en N/D y sin penalizacion.
- Si el titulo no coincide con ningun perfil, se usa fallback conservador.

## Campos tecnicos relevantes ya presentes
- `aircraft_type_code`
- `aircraft_variant_code`
- `addon_provider` / `addon_source`
- `detected_profile_code`

## Recomendacion ready-to-fly
Estandarizar en siguiente iteracion campos dedicados:
- `detection_confidence`: exact|high|medium|low|fallback
- `detection_reason`: texto corto auditable

## Como agregar nuevas variantes
1. Crear perfil JSON nuevo en `PatagoniaWings.Acars.SimConnect/AircraftProfiles`.
2. Definir `ExactTitles`/`Matches` y capabilities por senal.
3. Marcar no confirmado como `unsupported/unreliable`.
4. Validar en simulador real y actualizar matriz de capacidades.
