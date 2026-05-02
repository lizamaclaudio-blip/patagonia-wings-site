# Checklist primera prueba completa — Patagonia Wings ACARS/Web

## A. Antes de despegar

1. Aplicar SQL `sql/2026-05-01-bloque-2-acars-full-flow-test.sql` en Supabase.
2. Publicar/build web con el parche del Bloque 2.
3. Confirmar que en `/flights/[reservationId]` el owner ve el bloque `Probar PIREP XML`.
4. Ejecutar fixture `pirep-no-events.xml`.
   - Esperado: `evaluationStatus=no_evaluable`, `economyEligible=false`, `salaryAccrued=false`, `ledgerWritten=false`.
5. Ejecutar fixture `pirep-completed-normal.xml`.
   - Esperado: `evaluationStatus=evaluable`, score calculado, pero economía en `preview` y sin wallet/ledger real.
6. Ejecutar fixture `pirep-hard-landing.xml`.
   - Esperado: penalización/evento detectado y score castigado.

## B. Despacho web

1. Crear o seleccionar vuelo.
2. Generar OFP.
3. Cargar OFP.
4. Validar OFP.
5. Continuar a manifiesto.
6. Enviar a ACARS.
7. Confirmar que el ACARS recibe `reservationId`, origen, destino, aeronave, combustible, payload y distancia.

## C. Inicio en ACARS

1. Presionar iniciar vuelo en ACARS.
2. Supabase debe reflejar reserva `in_progress` o equivalente.
3. Confirmar que se están generando muestras de telemetría.
4. En oficina web, revisar live log/luces si están disponibles.

## D. HUD MSFS2020

1. En ACARS Soporte, probar bridge.
2. Deben responder:
   - `http://127.0.0.1:37677/api/hud/health`
   - `http://127.0.0.1:37677/api/hud/state`
3. Instalar HUD en Community.
4. Abrir MSFS2020 y confirmar toolbar `Patagonia Wings ACARS HUD`.
5. Confirmar que no aparece SayIntentions ni `flight.json`.

## E. Finalización ACARS

1. Finalizar vuelo desde ACARS en destino/gate.
2. ACARS debe recibir del backend:
   - `success=true`
   - `persisted=true`
   - `reservationClosed=true`
   - `summaryUrl` válido
3. ACARS debe abrir resumen web.
4. Si faltó evidencia, la web debe mostrar cierre no evaluable y no pagar.
5. Si hubo evidencia suficiente, la web debe mostrar completed/scored, snapshots reales, ledger aerolínea y salary mensual.

## F. Auditoría Supabase

Usar las consultas comentadas dentro del SQL del bloque y reemplazar `__RESERVATION_ID__` por el uuid real.
