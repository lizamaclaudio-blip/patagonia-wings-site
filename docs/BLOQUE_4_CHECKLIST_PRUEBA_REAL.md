# Checklist prueba real — Despacho → ACARS → Supabase → Resumen

## Antes del vuelo

- Web publicada con Bloque 3 + Bloque 4.
- ACARS compilado con Bloque HUD independiente + Bloque 4.
- HUD MSFS instalado como `patagoniawings-acars-hud`, sin SayIntentions.
- Piloto logueado en ACARS con token vigente.
- Vuelo despachado desde web con OFP validado y enviado a ACARS.

## Durante el vuelo

Validar en ACARS:
- Reserva correcta.
- Origen/destino correctos.
- Matrícula y aeronave correcta.
- Fuel actual visible.
- Timer operativo.
- Telemetría viva.
- No aparecen referencias SayIntentions en HUD.

Validar en Web/Supabase:
- `/api/acars/start` marca vuelo en progreso.
- `/api/acars/live` recibe muestras.
- `score_payload.acars_live` muestra fase, fuel, altitud, rumbo, luces.

## Cierre

Al finalizar vuelo:
- ACARS envía `/api/acars/finalize`.
- Respuesta debe traer:
  - `success = true`
  - `persisted = true`
  - `reservationClosed = true`
  - `summaryUrl` válida

## Resultado esperado en Web

En `/flights/[reservationId]` deben aparecer datos reales:
- Vuelo programado.
- Vuelo realizado.
- Puntaje.
- Vientos salida/llegada.
- PIC False.
- Stall.
- Overspeed.
- G-Force.
- Touchdown VS.
- Procedimientos.
- Performance.
- Economía/coins.
- Peso y combustible.
- Plan de vuelo.
- Parámetros de simulador.
- Trazabilidad.

## Si queda no evaluable

Revisar en SQL:
- `closeout_warnings`
- `closeout_evidence.telemetry_samples`
- `closeout_evidence.elapsed_seconds`
- `closeout_evidence.distance_nm`
- `raw_pirep_xml`
- `raw_telemetry_summary`

Causas esperables:
- Menos de 4 muestras.
- Menos de 120 segundos.
- Sin evidencia airborne/movimiento.
- Sin closeout payload.
- Closeout status incompatible.
