# ACARS 7.0.1 - Estado de ejecucion

Fecha: 2026-04-29

## Estado por bloque
- Detection confidence payload: COMPLETO.
- Detection reason/profile status payload: COMPLETO.
- Diagnostico addon/variante (payload/log): COMPLETO.
- Guia de validacion manual addon: COMPLETO.
- Matriz 33 aeronaves con estado manual: COMPLETO.
- Capability gates hardening por confidence: COMPLETO OPERATIVO en closeout exclusions.
- Ready-to-fly smoke checklist: COMPLETO.
- Versionado 7.0.1: COMPLETO (ACARS binario y manifests locales).

## Cambios tecnicos
- `SimData` agrega: type/variant/addon/profile + confidence/reason/source + matched_title/pattern + fallback_used + profile_status.
- `SimConnectService` calcula metadata de deteccion por muestra desde title/perfil.
- `ApiService` propaga detection metadata a:
  - `lastSimData` serializado,
  - `blackbox_summary`,
  - `event_summary`,
  - `capability_snapshot`.
- `ApiService` agrega `penalty_exclusions` por confidence low/fallback/unknown para evitar penalizacion de señales ambiguas.

## Validaciones
- Build ACARS oficial MSBuild VS2022 x64: PENDIENTE en esta corrida (ejecutar al final).
- Build web: NO APLICA (sin cambios funcionales web).
- SQL: NO REQUERIDO.
