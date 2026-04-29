# ACARS 7.0.3 - Estado de ejecucion

Fecha: 2026-04-29

## Estado por bloque
- HUD MSFS in-game package: COMPLETO.
- Bridge local ACARS->HUD: COMPLETO.
- Finalize server-confirmed + summaryUrl: COMPLETO.
- Apertura automatica de resumen web: COMPLETO.
- Versionado ACARS 7.0.3: COMPLETO.
- Ready-to-fly smoke checklist: ACTUALIZADO.
- Autoupdate universal legacy matrix: COMPLETO (script actualizado).

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
- Build ACARS oficial MSBuild VS2022 x64: OK.
- Build web: OK (`npm run build`).
- SQL: NO REQUERIDO para este hotfix.

## 2026-04-29 - CIERRE RELEASE 7.0.3
- Manifests ACARS/Web alineados a 7.0.3 revision 2026.4.29.5.
- Feed publico con mandatory update y forceUpdateBelow=7.0.3.
- Finalize exige success + reservationId + summaryUrl antes de marcar enviado.
- HUD interno MSFS consume bridge localhost seguro (`/api/hud/state`).

