# ACARS 7.0.0 - Estado de ejecución

Fecha: 2026-04-29

## Fase 0 - Auditoría real
- Repo web detectado: SI (`patagonia-wings-site`).
- Repo ACARS desktop detectado: SI (`ACARS NUEVO`).
- SimConnect source detectado: SI (`PatagoniaWings.Acars.SimConnect`).
- UI ACARS source detectado: SI (WPF/XAML en `PatagoniaWings.Acars.Master`).
- AircraftProfiles detectado: SI.
- Cantidad perfiles detectados: 40 JSON (incluye variantes/add-ons y manifest).
- Build web disponible: SI (`npm run build`).
- Build ACARS disponible: SI (`PatagoniaWings.Acars.sln`).
- Supabase CLI/DB disponible: NO confirmado en esta corrida.

## Cambios aplicados en esta ejecución
- `SimData` extendido con altitudes separadas (`Indicated/True/Pressure/Radio/Ground`) y `QnhInHg`.
- `SimConnectStructs` y `SimConnectService` extendidos para leer y mapear:
  - `PLANE ALTITUDE`
  - `PRESSURE ALTITUDE`
  - `RADIO HEIGHT`
  - `GROUND ALTITUDE`
  - `KOHLSMAN` derivado vía `QnhInHg`.
- `ApiService` extendido para incluir en telemetría serializada y hidden PIREP:
  - `indicated_altitude_ft`, `true_altitude_ft`, `pressure_altitude_ft`, `radio_altitude_ft`, `ground_altitude_ft`, `altitude_agl_ft`
  - `altimeter_hpa`, `altimeter_inhg`
  - `xpdr_state_raw`, `xpdr_code`, `xpdr_charlie`
- `PatagoniaFlightCloseoutPayload` extendido con:
  - `blackbox_summary`
  - `event_summary`
  - `critical_events`
  - `capability_snapshot`
  - `unsupported_signals`
  - `penalty_exclusions`
- `BuildCloseoutPayload` ahora construye esas secciones desde evaluación + telemetría.

## Fases aplicables y estado
- Fase 1 (training SimBrief/OFP web): COMPLETO previo en repo web (validado por código existente de flujo guiado).
- Fase 2/12 (matriz 33 aeronaves): COMPLETO en documento dedicado.
- Fase 3 (capability model v7): PARCIAL (snapshot + unsupported/exclusions en payload; falta refactor total de motor de reglas por capability flag detallado).
- Fase 4 (altitud indicada): COMPLETO (altitud visual principal sigue indicada y se agregan altitudes diagnósticas).
- Fase 5 (XPDR): PARCIAL (telemetría/payload extendidos; pendiente semáforo UI específico XPDR en WPF).
- Fase 6/7 (blackbox + eventos críticos): PARCIAL (summary + critical events emitidos; pendiente catálogo completo de códigos operacionales dedicados).
- Fase 8 (penalización capability-aware): PARCIAL (exclusiones por unsupported se exportan; falta gate estricto en todas las reglas legacy).
- Fase 9 (UI ACARS 7): PARCIAL (base existente, sin rediseño completo en esta corrida).
- Fase 10 (Web/Supabase payload extendido): COMPLETO para recepción de campos adicionales en finalize payload.
- Fase 13 (release 7.0.0): PENDIENTE (sin bump global de versión en todos manifiestos).
- Fase 14 (validación final): PARCIAL (build ejecutado; pruebas de simulador/manual quedan pendientes).

## Validaciones ejecutadas
- Web build: pendiente en esta corrida tras patch ACARS (no hubo cambio TS en web app principal).
- ACARS build: pendiente en esta corrida (debe ejecutarse en entorno con toolchain .NET/WPF completo).
- Revisión de riesgos contables 18B: OK, no se tocó lógica de ledger/wallet mensual.

## SQL
- SQL aplicado directamente: NO.
- Bloqueo real SQL: no aplica para los cambios hechos (payload/desktop).

## Riesgos reales
- Se agregó contenido nuevo en payload; backend debe tolerar campos extra (compatible por JSON dinámico en finalize actual).
- No se ejecutó validación en simulador vivo (MSFS/XPDR/QNH manual).
- XPDR UI dedicada y reglas 100% capability-gated requieren siguiente iteración.

## Actualizacion 2026-04-29 (cierre build + UI XPDR)
- Build ACARS (MSBuild x64): OK.
- WPF/XAML: OK (sin errores InitializeComponent).
- UI XPDR: OK (LED dedicado con estados ALT/STBY/OFF/N-D por capability).
- Eventos criticos: ampliado catalogo minimo en closeout payload con schema v7.
- Capability gate XPDR UI: si no soporta, muestra N/D y no estado rojo penalizable.
- Build web: OK.
- Mojibake scan web (dashboard/components/simbrief): sin hallazgos por patron.
- SQL: no requerido en este cierre.

