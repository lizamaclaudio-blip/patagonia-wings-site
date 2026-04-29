# ACARS 7.0.0 - Estado de ejecucion

Fecha: 2026-04-29

## Resumen de alcance
- Repo ACARS desktop detectado: SI (`ACARS NUEVO`).
- Repo web detectado: SI (`patagonia-wings-site`).
- Foco de esta ejecucion: ACARS ready-to-fly (deteccion aeronave/addon, perfiles/capabilities, build oficial).
- Selector web de aeronaves: NO MODIFICADO.

## Estado por fase
- Fase 0 (build oficial documentado): COMPLETO.
- Fase 1 (auditoria deteccion real): COMPLETO.
- Fase 2 (modelo variante interna): PARCIAL ALTO (campos base ya existen: type/variant/addon/profile).
- Fase 3 (matriz variante -> lectura): PARCIAL ALTO (documentado y capability-aware existente).
- Fase 4 (deteccion addon/simulador): PARCIAL ALTO (matching por title/matches/perfil; confidence formal pendiente).
- Fase 5 (matriz 33 aeronaves): COMPLETO (actualizada).
- Fase 6 (capability gates por variante): COMPLETO OPERATIVO (unsupported/reliable evita penalizacion injusta).
- Fase 7 (readiness SimConnect/LVAR/FSUIPC): COMPLETO DOCUMENTAL (arquitectura actual + pendiente addon-specific).
- Fase 8 (4 LED ACARS/start gate): COMPLETO (misma fuente logica `_startGateResult`).
- Fase 9 (postflight/caja negra/estados): PARCIAL ALTO (completed/cancelled diferenciados y semantica caja negra preservada).
- Fase 10 (ready checklist): COMPLETO.
- Fase 11 (build final): COMPLETO.

## Archivos de codigo base auditados (ACARS)
- `PatagoniaWings.Acars.Core/Services/AircraftNormalizationService.cs`
- `PatagoniaWings.Acars.Core/Services/AircraftTelemetryProfileService.cs`
- `PatagoniaWings.Acars.SimConnect/SimConnectService.cs`
- `PatagoniaWings.Acars.Core/Models/PreparedDispatch.cs`
- `PatagoniaWings.Acars.Core/Models/AcarsReadyFlight.cs`
- `PatagoniaWings.Acars.Core/Models/Flight.cs`

## Validaciones realizadas
- Build oficial ACARS (MSBuild VS2022 x64 Debug|x64): OK.
- Web build: NO APLICA en esta corrida (sin cambios web funcionales).
- SQL/Supabase: NO REQUERIDO.

## Riesgos reales pendientes
- Detection confidence formal (`exact/high/medium/low/fallback`) aun no serializada como campo dedicado en todo el payload.
- Variantes addon con lectura LVAR/HVAR no confirmada manualmente quedan en modo conservador (N/D, no penalizable).
