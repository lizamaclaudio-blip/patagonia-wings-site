# Patagonia Wings Web · Plan ordenado Bloques 18B–18F

## Estado actual
El esquema económico ya existe, pero no se están generando registros históricos suficientes:

- No hay snapshots económicos.
- No hay liquidaciones piloto.
- No hay cierres mensuales.
- La vista mensual queda vacía porque depende de snapshots.

## Prioridad
Primero asegurar la contabilidad real. Después mejorar visual y reducir clics.

## Bloque 18B
Conector contable garantizado entre SimBrief, ACARS, Supabase y Web.

Resultado esperado:
- Snapshot SimBrief al preparar vuelo.
- Snapshot ACARS al cerrar vuelo.
- Ledger por ingresos/costos.
- Sueldo pendiente acumulado.
- Balance recalculado.

## Bloque 18C
Manifiesto de salida antes de ACARS.

Resultado esperado:
- Resumen visual completo de ruta, carga, pasajeros, combustible y economía.
- El piloto entiende cuánto gana y cuánto gana/pierde la aerolínea.

## Bloque 18D
Comparación planificado vs real.

Resultado esperado:
- Fuel, block time, costos, ingresos y utilidad comparados.
- Impacto económico del vuelo visible.

## Bloque 18E
Liquidación mensual último día hábil.

Resultado esperado:
- Pago al wallet solo al cierre mensual.
- PDF de liquidación.
- Bloqueo de doble pago.

## Bloque 18F
UX premium inspirada en SUR Air.

Resultado esperado:
- Menos clics.
- Menos redundancia.
- Centro operacional más claro.
- Ganancia piloto visible antes y después del vuelo.
