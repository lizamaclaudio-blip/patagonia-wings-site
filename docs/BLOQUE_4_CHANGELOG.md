# Bloque 4 — Conectar ACARS con resumen Web tipo SUR Air

Base revisada: ZIP Web `public.zip`, ZIP ACARS/SimConnect `PatagoniaWings.Acars.SimConnect.zip`, parche HUD independiente ya aplicado por Claudio y página de resumen Bloque 3 aprobada visualmente.

## Objetivo

Hacer funcional la página de resumen creada en Bloque 3, alimentándola con datos reales de ACARS/caja negra y cierre oficial Web/Supabase.

## Cambios aplicados

### Web — `src/lib/acars-official.ts`

Motivo: el resumen visual ya esperaba campos tipo SUR Air (`PIC False`, `Stall`, `Overspeed`, `G-Force`, `Touchdown`, vientos, peso, combustible, ruta y simulador), pero el cierre oficial solo guardaba parte de esos datos.

Cambios:
- Amplía el contrato `AcarsTelemetrySample` para aceptar datos que ACARS ya lee desde SimConnect: pesos, fuel capacity/tanques, motores 3/4, batería/aviónica, puertas, transponder, COM2, QNH inHg, temperatura, metadata de perfil/addon.
- Agrega `buildSurStyleSummary()` server-side.
- Deriva y guarda en `score_payload` campos top-level consumibles por la página:
  - `departure_wind_summary`, `arrival_wind_summary`
  - `pic_false_count`, `pic_checks_total`
  - `stall_seconds`, `overspeed_seconds`, `pause_seconds`
  - `landing_g_force`, `landing_vs_fpm`
  - `tow_dispatched_kg`, `tow_aircraft_kg`, `takeoff_weight_kg`, `landing_weight_kg`
  - `planned_fuel_kg`, `fuel_start_kg`, `fuel_used_kg`, `fuel_end_kg`
  - `route`, `filed_route`, `simulator`, `aircraft_title`, `addon_provider`
  - `closeout_quality_message`
- Mantiene la regla contable: solo `completed + evaluable` genera economía real, salary mensual y ledger.

No se tocó:
- `/api/acars/finalize` route.
- RLS.
- Wallet mensual.
- Cálculo económico server-side.
- Página Bloque 3, salvo que el usuario quiera un ajuste visual posterior.

### ACARS — `PatagoniaWings.Acars.Core/Services/ApiService.cs`

Motivo: ACARS sí leía varios datos desde SimConnect, pero `SerializeSimData()` no los enviaba todos al backend Web.

Cambios:
- `SerializeSimData()` ahora envía:
  - pesos: `totalWeightKg`, `zeroFuelWeightKg`, `payloadKg`, `emptyWeightKg`
  - combustible extendido: capacidad y tanques
  - motores 3/4 y flags de motor encendido
  - batería/aviónica/puertas
  - transponder code/state
  - COM2, QNH inHg, temperatura exterior
  - metadata completa de detección de aeronave/addon
- `BuildCloseoutPayload().BlackboxSummary` ahora resume:
  - pesos takeoff/landing
  - combustible inicio/fin/usado
  - vientos salida/llegada
  - overspeed/stall/pause samples
  - touchdown VS/G
  - vertical speeds

No se tocó:
- HUD MSFS2020.
- Soporte ACARS.
- Autoupdate/installer.
- Flujo SayIntentions.
- Lógica de envío/finalize/retry.

## Validación realizada

- Parse/transpile TypeScript de `src/lib/acars-official.ts`: OK, 0 diagnósticos sintácticos.
- No se ejecutó build ACARS en sandbox Linux; debe validarse con MSBuild VS2022 x64 en Windows.

## Orden de aplicación

1. Aplicar este parche sobre la base actual.
2. No sobrescribir el parche HUD independiente aplicado antes.
3. Ejecutar build ACARS oficial con MSBuild VS2022 x64.
4. Ejecutar en Web:
   - `npx tsc --noEmit`
   - `npm run build`
5. Ejecutar SQL diagnóstico solo lectura después de una prueba.
