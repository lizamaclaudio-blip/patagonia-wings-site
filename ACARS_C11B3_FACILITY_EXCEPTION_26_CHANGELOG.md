# ACARS C11B3 — Facility exception 26 benign handling

Base: C10 + C11A/A2/A3 + C11B + C11B2 local.

## Motivo
Durante prueba real MSFS, el bridge C11 mostró `facility_exception_after_request:dwException=26` después de solicitar Facilities por ICAO (`SCTB,SCEL`). En SimConnect, el código 26 corresponde a `SIMCONNECT_EXCEPTION_ALREADY_SUBSCRIBED`, por lo que no debe tratarse como fallo de RequestFacilityData.

## Cambios
- `PatagoniaWings.Acars.SimConnect/SimConnectService.cs`
  - `OnRecvException` ahora clasifica `dwException == 26` como señal benigna de suscripción ya activa.
  - Mantiene `FacilityBridgeAvailable=true` y `FacilityBridgeSubscribed=true`.
  - Conserva el estado de espera de `RequestFacilityData` para los ICAO pendientes.
  - Evita reemplazar la UI por error duro cuando aún estamos esperando respuesta.

## No toca
- Web
- Supabase
- economía
- wallet
- score oficial
- publicación/versionado

## Validación esperada
Build Release x64 debe quedar en 0 errores. En UI C11 ya no debería aparecer `facility_exception_after_request:dwException=26`; debería mostrarse `facility_subscription_already_active_waiting:SCTB,SCEL` o avanzar a `facility_data_received`/timeout real.
