FIX LOCAL 1 — DESPACHO WEB

Ruta a tocar:
- src/lib/flight-ops.ts

Qué corrige:
1. Ya no cambia la reserva a `dispatched` antes de crear el `dispatch_package`.
2. `dispatch_packages` ahora recibe `aircraft_id`.
3. Primero crea/prepara el package y recién después deja la reserva en estado listo para ACARS.

Cómo pegarlo:
1. Abre `src/lib/flight-ops.ts`
2. Busca la función `saveFlightOperation(...)` y reemplázala completa por el archivo:
   - `saveFlightOperation.fixed.ts`
3. Busca la función `markDispatchPrepared(...)` y reemplázala completa por el archivo:
   - `markDispatchPrepared.fixed.ts`
4. Guarda
5. Prueba en local el flujo:
   - Tipo de vuelo
   - Aeronave
   - Itinerario
   - Despacho
   - Resumen
   - Despachar vuelo

Resultado esperado:
- ya no debe aparecer:
  - “La reserva ... no está en estado reserved. Estado actual=dispatched”
  - ni “null value in column aircraft_id of relation dispatch_packages”
