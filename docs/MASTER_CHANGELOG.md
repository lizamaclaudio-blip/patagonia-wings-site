# Patagonia Wings — Registro maestro de cambios

## 2026-04-26 — Economía realista V1

Base tomada: `web patagonia.zip` + fix aprobado `patagonia_web_fix_economia_visible.zip`.

Regla de trabajo:
- No retroceder a ZIPs o commits anteriores.
- Cada ZIP/fix aprobado por Claudio pasa a ser nueva base vigente.
- ACARS registra evidencia operacional; Supabase/Web evalúa, calcula economía y muestra resultados.

Cambios de este bloque:
- Se reemplazó la economía simplificada `ingreso = 3x pago piloto` por un modelo realista centralizado.
- El helper `src/lib/pilot-economy.ts` ahora calcula pax, carga, tarifa promedio, ingresos pax/cargo/charter, combustible por país/aeropuerto, mantención, tasas, handling, reserva técnica, pago piloto, utilidad y margen.
- Catálogo, Itinerario y Charter consumen el mismo helper/API para evitar fórmulas duplicadas.
- El cierre ACARS/Web registra ledger separado por concepto y crea snapshot global para métricas futuras.
- Se agrega plan SQL para `fuel_price_index`, `flight_economy_snapshots`, gastos/licencias del piloto, valores de flota y columnas económicas.

No tocar en futuros cambios:
- Flujo PIREP raw/server evaluation.
- Capital inicial aprobado USD 1.305.000.
- Economía visible aprobada en Oficina/Catálogo/Itinerario/Charter.

Pendiente de validación:
- Ejecutar SQL de economía realista en Supabase.
- Probar cierre real ACARS para confirmar `flight_economy_snapshots` y ledger por conceptos.
- Cuando SimBrief entregue payload real, reemplazar estimaciones de pax/carga por datos OFP.

---

## 2026-04-26 — Economía realista V2 / Gastos del piloto y pruebas teóricas

Base tomada: Economía Realista V1 aprobada con SQL aplicado correctamente.

Regla de trabajo:
- Mantener un único archivo maestro acumulativo: `docs/MASTER_CHANGELOG.md`.
- No crear README nuevo por bloque.
- Cada cambio futuro debe agregarse al final de este mismo log.

Cambios de este bloque:
- Se agrega catálogo centralizado de gastos del piloto en `src/lib/pilot-economy.ts`.
- Se incluyen costos de traslados, licencias, certificaciones, habilitaciones, entrenamiento, pruebas prácticas y pruebas teóricas.
- Se agregan pruebas teóricas con costo propio: IFR/IMC, regional, narrowbody, widebody y recurrente.
- Se crea endpoint `src/app/api/economia/pilot-expenses/route.ts` para leer `pilot_expense_catalog` desde Supabase y usar fallback local si la tabla está vacía o inaccesible.
- Se agrega panel visual en `/economia` para explicar al usuario en qué gastará su billetera virtual.
- El panel muestra totales por categoría y resalta las pruebas teóricas como requisito antes de habilitaciones/certificaciones.

SQL asociado:
- Insert/update idempotente en `pilot_expense_catalog`.
- No se modifica saldo ni ledger en este bloque; solo catálogo/base para futuras compras/descuentos.

Pendiente futuro:
- Crear flujo real de compra/descuento desde billetera del piloto.
- Registrar compras en `pilot_expense_ledger`.
- Conectar habilitaciones/certificaciones reales con estado del piloto.

---

## 2026-04-26 — Economía realista V3 / Descuento real desde billetera del piloto

Base tomada: Economía Realista V2 aprobada con catálogo de gastos piloto y pruebas teóricas.

Regla de trabajo:
- Mantener este archivo como log maestro acumulativo.
- No crear README nuevo por cada bloque.
- No tocar ACARS en este bloque: ACARS registra; Web/Supabase administra economía y gastos.

Cambios de este bloque:
- Se extiende `src/app/api/economia/pilot-expenses/route.ts` para soportar:
  - `GET /api/economia/pilot-expenses` público: catálogo de gastos.
  - `GET /api/economia/pilot-expenses?mine=1` autenticado: catálogo + saldo billetera + últimos gastos del piloto.
  - `POST /api/economia/pilot-expenses` autenticado: descuenta gasto desde `pilot_profiles.wallet_balance` y registra movimiento en `pilot_expense_ledger`.
- Se agrega rollback de seguridad: si falla el insert en `pilot_expense_ledger`, se restaura el saldo anterior del piloto.
- Se agrega panel en `/profile?view=economia` para pagar pruebas teóricas, licencias, certificaciones, habilitaciones y entrenamiento desde la billetera virtual.
- Se muestran últimos gastos registrados en la vista de economía del piloto.

SQL asociado:
- Asegura `pilot_profiles.wallet_balance`.
- Asegura columnas de trazabilidad en `pilot_expense_ledger`: `balance_before_usd`, `balance_after_usd`, `status`, `reference_code`.
- Agrega índices para consultas por piloto, categoría y fecha.

Pendiente futuro:
- Vincular cada compra con desbloqueo real de habilitaciones/certificaciones en el perfil del piloto.
- Definir reglas de vigencia y renovación automática para licencias recurrentes.

---

## 2026-04-26 — Economía realista V4 / Flota, activos y crecimiento

Base tomada: Economía Realista V3 aprobada con billetera y gastos reales del piloto.

Regla de trabajo:
- Mantener este archivo como log maestro acumulativo.
- No crear README nuevo por cada bloque.
- No tocar ACARS en este bloque.
- La economía de flota queda en Web/Supabase para que ACARS solo registre el vuelo y el servidor calcule.

Cambios de este bloque:
- Se agrega endpoint `src/app/api/economia/fleet-assets/route.ts` para calcular inversión de flota, valor patrimonial, costo fijo mensual, costo técnico por hora, poder de compra y reserva recomendada.
- El endpoint lee `aircraft_asset_values`, `aircraft_fleet`, `aircraft`, `airlines` y `airline_ledger` cuando existen, con fallback seguro al catálogo base si la flota aún no está poblada o RLS bloquea datos.
- Se agrega panel visual en `/economia` llamado "Flota, inversión y crecimiento".
- El panel explica que cada aeronave nueva debe comprarse con caja de la aerolínea y entregarse al hub asignado desde fábrica.
- Se muestra valor de flota, costo fijo mensual, poder de compra, reserva recomendada y top de tipos de aeronave por valor.
- Se prepara el modelo para futuras compras reales: `aircraft_purchase` en `airline_ledger` y tabla `aircraft_purchase_requests`.

SQL asociado:
- Asegura `aircraft_asset_values` con valores referenciales por tipo.
- Crea `aircraft_purchase_requests` para futuras compras/aprobaciones de aeronaves.
- Agrega índices para lectura rápida por estado, hub y tipo.

Pendiente futuro:
- Crear flujo UI/admin para comprar aeronaves y descontar caja real de la aerolínea.
- Conectar compra aprobada con creación real de aeronave en flota y traslado desde fábrica al hub.
- Calcular depreciación mensual si Claudio decide activarla más adelante.

---

## 2026-04-26 — Economía realista V5 / Capacidades por aeronave, rango de catálogo y ventas a bordo

Base tomada: Economía Realista V4 aprobada con flota, activos y crecimiento.

Regla de trabajo:
- Mantener este archivo como log maestro acumulativo.
- No crear README nuevo por bloque.
- No tocar ACARS salvo integración de cierre económico server-side en `src/lib/acars-official.ts`.
- La economía previa usa estimaciones; la economía final del vuelo se recalcula al cierre con PIREP/OFP/ACARS cuando existan datos reales.

Cambios de este bloque:
- Se recalibra `src/lib/pilot-economy.ts` para que cada aeronave tenga capacidad y costos propios: asientos, carga belly/cargo, consumo estimado por NM, mantención por hora, handling, tasas y capacidad de servicio a bordo.
- Se agregan perfiles para C172, BE58, TBM9, C208, DHC6, B350, ATR, E175/E190, A319/A320/A321, B737/B738/B739/B38M, A330/A339, B787/B789 y B777/B77W.
- En catálogo de rutas, la economía ya no usa una sola aeronave: muestra rango desde la aeronave compatible más pequeña hasta la más grande.
- En itinerario, cuando el piloto elige aeronave, se mantiene estimación exacta para esa aeronave.
- En chárter, la estimación se mantiene dinámica según origen, destino y aeronave seleccionada.
- Se agregan ingresos por servicio a bordo para aeronaves con cabina comercial.
- Se agregan ventas a bordo / catálogo Patagonia Wings solo para vuelos internacionales con aeronaves que tengan servicio a bordo.
- Se agrega costo de servicio a bordo como costo operacional.
- El cierre económico en `acars-official.ts` guarda ingresos/costos de servicio y ventas a bordo en `flight_reservations`, `flight_economy_snapshots` y `airline_ledger`.

SQL asociado:
- Agrega columnas económicas de servicio y ventas a bordo en `flight_reservations` y `flight_economy_snapshots`.
- Crea/actualiza tabla `aircraft_economy_profiles` para dejar trazable la capacidad y costo base por aeronave.
- Crea tabla `onboard_sales_catalog` para futuros productos de venta a bordo.
- Actualiza vista `pw_economy_monthly_metrics` incorporando ingresos/costos de servicio y ventas a bordo.

Pendiente futuro:
- Reemplazar estimaciones por datos reales de SimBrief/OFP cuando estén disponibles: PAX, cargo, payload, fuel plan y block time.
- Al cierre del vuelo, reemplazar fuel estimado por combustible real ACARS y daños reales por reporte de daño/desgaste.
- Crear UI de ventas a bordo detalladas si se decide simular productos por categoría.

---

## Actualización 6 — Compatibilidad aeronave-ruta, combustible realista y comisiones piloto

**Objetivo:** corregir el rango económico para que no use aeronaves incompatibles con la ruta, recalibrar el combustible por gasto real de ruta/aeropuerto de origen y ordenar las comisiones del piloto para que regional/nacional/internacional/long haul tengan jerarquía lógica.

### Cambios clave
- La economía deja de calcular rangos con aeronaves fuera de alcance práctico.
- El catálogo filtra aeronaves por `practicalRangeNm`, combustible utilizable, capacidad internacional y long haul.
- Long haul/intercontinental queda reservado a aeronaves `longHaulCapable`.
- Combustible estimado = consumo de ruta + taxi + contingencia + reserva, no estanque lleno.
- Precio de combustible se recalibra por aeropuerto/país con valores más realistas.
- Las comisiones del piloto se calculan por banda de ruta: local, regional, nacional, internacional, long haul e intercontinental.
- Se eliminan multiplicadores excesivos de `CAREER/ITINERARY`; ahora la base regular usa multiplicador 1.00.
- Charter mantiene multiplicador superior; training/eventos se mantienen reducidos.
- Charter muestra advertencia si la aeronave seleccionada no es apta para la ruta.

### Regla vigente
Una ruta no puede calcular economía con una aeronave que no puede operarla. El catálogo muestra rangos solo entre aeronaves compatibles reales. Itinerario y Charter calculan exacto según aeronave seleccionada. El combustible se calcula por consumo de ruta y precio JetA1 del aeropuerto de origen, con fallback por país.

### SQL relacionado
- `aircraft_economy_profiles`: agregar `practical_range_nm`, `usable_fuel_capacity_kg`, `runway_requirement_m`, `international_capable`, `long_haul_capable`.
- `fuel_price_index`: recalibrar precios JetA1 por aeropuerto/país.
- `pilot_pay_rules`: tabla opcional/configurable para comisiones por banda de ruta.

---

## Actualización 7 — Estabilización de Traslados en Central / Dashboard

**Objetivo:** corregir el parpadeo del módulo de traslados en el dashboard, donde el bloque aparecía, quedaba sin datos y volvía a desaparecer/reaparecer por recargas sucesivas.

### Cambios clave
- Se estabiliza `CentralTransfersSectionWrapper` usando callbacks memorizados con `useCallback`.
- Se evita que `CentralTransfersSectionControlled` dispare consultas repetidas por cambios de identidad en `onEmpty` / `onHasContent`.
- El divisor y el módulo de traslados solo se renderizan cuando existen destinos reales o una acción confirmada.
- Mientras el endpoint está cargando o retorna cero opciones, el módulo se mantiene oculto para evitar parpadeos visuales.
- Si no hay traslados disponibles, no se muestran tarjetas vacías ni el bloque temporal "Calculando alternativas".

### Regla vigente
El módulo de traslados debe mostrarse solo cuando existan datos accionables. Si no existen opciones desde la ubicación actual del piloto, el bloque queda oculto de forma estable, sin aparecer/desaparecer a cada recarga del dashboard.

### Archivos modificados
- `src/app/dashboard/page.tsx`

### SQL relacionado
- No requiere SQL.

### Pendiente futuro
- Si vuelve a existir intermitencia, revisar `/api/pilot/transfer` y confirmar que la respuesta sea determinística para el mismo piloto/aeropuerto, especialmente bajo RLS o cambios de sesión.


---

## Actualización 8 — Consolidación técnica de base V7

**Objetivo:** reunir en un solo paquete de archivos finales las modificaciones aprobadas desde Economía visible hasta la estabilización de traslados, evitando bajar múltiples ZIP por bloque y dejando una base de trabajo clara para el siguiente bloque.

### Base consolidada incluida
- Economía visible en Oficina, Catálogo, Itinerario y Charter.
- Economía Realista V1: combustible por país/aeropuerto, snapshots, ledger y métricas base.
- V2: catálogo de gastos del piloto, licencias, habilitaciones y pruebas teóricas.
- V3: billetera del piloto, descuento real y `pilot_expense_ledger`.
- V4: flota, activos, valor de aeronaves e inversión.
- V5: capacidades por aeronave, servicio a bordo y ventas a bordo.
- V6: compatibilidad aeronave-ruta, rango/autonomía, combustible realista y comisiones por banda.
- V7: estabilidad del módulo de traslados en Dashboard/Central.

### Regla vigente
Este archivo `docs/MASTER_CHANGELOG.md` es el log maestro único. Cada bloque futuro debe agregar una nueva sección aquí, conservando todo lo anterior. No crear README separados por bloque.

### Archivos consolidados
- `src/lib/pilot-economy.ts`
- `src/lib/acars-official.ts`
- `src/app/dashboard/page.tsx`
- `src/app/routes/page.tsx`
- `src/app/economia/page.tsx`
- `src/app/profile/page.tsx`
- `src/components/dashboard/CharterOriginDestinationStep.tsx`
- `src/app/api/economia/stats/route.ts`
- `src/app/api/economia/estimate-flight/route.ts`
- `src/app/api/economia/pilot-expenses/route.ts`
- `src/app/api/economia/fleet-assets/route.ts`
- `docs/MASTER_CHANGELOG.md`

### SQL relacionado
No se agrega SQL nuevo en esta consolidación. Los SQL V1–V7 ya fueron entregados/aplicados por separado cuando correspondía.

### Próximo bloque recomendado
Bloque 8 — Filtro maestro piloto/ruta/aeronave, aplicando el orden:
piloto conectado → ubicación actual → ruta → aeronave disponible → autonomía/rango → combustible útil → habilitaciones → economía.


---

## Actualización 9 — Cierre económico real idempotente

**Objetivo:** fortalecer el cierre ACARS/PIREP para que la economía final del vuelo sea real, trazable e idempotente.

**Cambios principales:**
- `src/lib/acars-official.ts` ahora evita duplicar horas, billetera y nómina si un cierre se reintenta.
- `flight_economy_snapshots` se actualiza por `reservation_id` en vez de crear registros duplicados.
- `airline_ledger` reemplaza los movimientos del mismo `reservation_id` antes de reinsertar el cierre económico final.
- La caja de aerolínea se recalcula desde el ledger completo con `pw_recalculate_airline_balance` si existe, o fallback server-side.
- `score_payload.economy_accounting` guarda marca de aplicación económica para trazabilidad.
- Se mantiene la regla: ACARS registra y envía; Web/Supabase evalúa, calcula economía y persiste métricas.

**Validación sugerida:**
1. Ejecutar SQL del bloque para crear función `pw_recalculate_airline_balance`.
2. Cerrar un vuelo de prueba.
3. Reenviar el mismo PIREP o repetir finalize.
4. Confirmar que no se duplican `airline_ledger`, `flight_economy_snapshots`, horas, billetera ni nómina.
5. Ejecutar `npx tsc --noEmit` y `npm run build`.

---

## Actualización 10 — SimBrief/OFP económico planificado

**Objetivo:** dejar la economía planificada por OFP como etapa intermedia entre la estimación previa y el cierre real ACARS.

**Cambios principales:**
- `src/lib/pilot-economy.ts`: agrega `estimateSimbriefFlightEconomy()` y `resolveSimbriefPlannedFuelKg()` para usar pax, carga, combustible y block time importados desde SimBrief.
- `src/lib/flight-ops.ts`: al finalizar despacho con OFP, guarda economía planificada en `flight_reservations` y crea snapshot `flight_economy_snapshots` con `economy_source='simbrief'`.
- `src/app/dashboard/page.tsx`: muestra panel “Economía planificada OFP” con pago piloto, pax, carga, combustible OFP, ingresos, costos, servicio/ventas y utilidad.

**Regla operativa:**
- Sin OFP: se muestra estimación operacional.
- Con OFP: la planificación usa datos de SimBrief.
- Al cierre ACARS: el servidor recalcula economía final real con PIREP/telemetría.

**SQL:** sin SQL nuevo; usa columnas ya creadas en los bloques V1–V9.

**Validación sugerida:** importar OFP en despacho, confirmar panel económico OFP y revisar `flight_economy_snapshots` con `economy_source='simbrief'`.

---

## Actualización 11 — Compra real de aeronaves y crecimiento de flota

**Objetivo:** permitir que la aerolínea crezca comprando aeronaves con su caja operacional, dejando trazabilidad en ledger y ubicando la aeronave en el hub asignado.

### Cambios principales
- `src/app/api/economia/aircraft-purchase/route.ts`: nuevo endpoint para listar opciones de compra y registrar compras reales.
- La compra valida caja disponible, calcula matrícula por país/hub (`CC-PWG`, `LV-PWG`, etc.), crea solicitud en `aircraft_purchase_requests`, descuenta `airline_ledger` con `entry_type='aircraft_purchase'`, crea registros en `aircraft_fleet` y `aircraft`, inicializa `aircraft_condition` y recalcula la caja de aerolínea.
- `src/app/api/economia/fleet-assets/route.ts`: agrega `purchaseOptions`, poder de compra, brecha de reserva y opciones sugeridas.
- `src/app/economia/page.tsx`: agrega panel “Crecimiento real de flota” con caja disponible, poder de compra, opciones recomendadas y formulario para registrar compra por aeronave, hub destino y cantidad.

### Regla vigente
Las aeronaves nuevas no aparecen gratis: se compran con caja de la aerolínea, se registran en `airline_ledger`, se genera matrícula PWG según país del hub y quedan ubicadas en el hub asignado. Cada compra debe respetar reserva operacional antes de comprometer caja.

### SQL relacionado
Requiere asegurar `aircraft_purchase_requests`, `airline_ledger`, columnas de `airlines`, valores de `aircraft_asset_values` y función opcional `pw_recalculate_airline_balance`.

### Validación sugerida
1. Ejecutar SQL del Bloque 11.
2. Abrir `/economia` y revisar el panel “Crecimiento real de flota”.
3. Comprar una aeronave pequeña con caja suficiente hacia un hub de prueba.
4. Validar `airline_ledger`, `aircraft_purchase_requests`, `aircraft_fleet`, `aircraft`, `aircraft_condition` y balance de aerolínea.
5. Ejecutar `npx tsc --noEmit` y `npm run build`.

---

## Actualización 12 — Economía explicativa alineada a V6/V11

**Motivo:** la página `/economia` conservaba textos antiguos de comisiones y multiplicadores (`CAREER ×1.5`, tope USD 500, fórmula base anterior), lo que no coincide con la economía realista actual.

**Cambios:**
- Se actualizó la explicación de pago piloto por banda de ruta, block time, distancia, aeronave y operación.
- Se agregó explicación clara de combustible por ruta/aeropuerto, no por estanque lleno.
- Se reforzó el filtro maestro piloto/ruta/aeronave y autonomía real.
- Se dejó visible el criterio de compra de flota solo por dirección/owner.
- Se agregó sección de costos fijos mensuales de aerolínea como preparación para el próximo bloque.
- Se actualizó la tabla de ejemplos de comisión para local, regional, nacional, internacional, long haul e intercontinental.

**Alcance:** solo documentación/UI de `/economia` y changelog maestro. No modifica ACARS, PIREP, ledger ni SQL.

**Validación sugerida:** `npx tsc --noEmit`, `npm run build`, abrir `/economia` y confirmar que ya no aparecen textos antiguos de comisión.

---

## Actualización 13 — Conteo real de flota y auditoría de tipos

**Motivo:** el panel de flota podía mostrar `1000` aeronaves porque la API leía `aircraft_fleet` y `aircraft` con `limit(1000)`. Ese valor no era una métrica confiable si la base tenía más registros o si existían duplicados entre tablas. Además, Claudio indicó que los tipos deberían ser 33 y era necesario validar contra la base real.

**Cambios principales:**
- `src/app/api/economia/fleet-assets/route.ts`: reemplaza lecturas con límite por paginación completa de Supabase.
- Agrega conteos exactos con `count: 'exact'` para `aircraft_fleet`, `aircraft`, `aircraft_types` y `aircraft_economy_profiles`.
- Deduplica flota por matrícula cuando la misma aeronave aparece en `aircraft_fleet` y `aircraft`.
- Expone auditoría de tipos: tipos reales en flota, tipos del catálogo `aircraft_types`, perfiles económicos, valores patrimoniales faltantes y duplicados detectados.
- `src/app/economia/page.tsx`: muestra métricas de fuente real Supabase, tipos BD esperados/actuales, registros por tabla, duplicados y advertencias si faltan perfiles/valores.
- Se conserva la regla de compra de aeronaves solo para owner/dirección; usuarios normales ven explicación y opciones, pero no formulario de compra.

**Regla vigente:** la métrica principal de aeronaves debe venir de Supabase con paginación completa y deduplicación por matrícula. La pantalla debe distinguir entre flota operacional real, filas brutas de tablas, catálogo de tipos y perfiles económicos. No se debe usar `limit(1000)` como total de flota.

**SQL:** sin SQL nuevo. La revisión usa tablas existentes: `aircraft_fleet`, `aircraft`, `aircraft_types`, `aircraft_economy_profiles`, `aircraft_asset_values`.

**Validación sugerida:** abrir `/economia`, revisar que la fuente diga “Base real Supabase”, confirmar conteo real de aeronaves, tipos BD `33/33` si la tabla `aircraft_types` está completa, y ejecutar `npx tsc --noEmit` + `npm run build`.

---

## Actualización 14 — Costos fijos mensuales y cierre operacional

**Objetivo:** comenzar la operación mensual real de la aerolínea, separando los costos fijos de los costos por vuelo.

### Cambios clave
- Se agrega endpoint `src/app/api/economia/monthly-fixed-costs/route.ts`.
- El endpoint calcula costos mensuales de staff, hubs, flota, seguros, sistemas, administración y reserva técnica.
- El cálculo usa flota real deduplicada, valores patrimoniales de `aircraft_asset_values`, hubs y caja de `airlines`.
- Se agrega panel visual en `/economia` para explicar costos fijos mensuales, reserva recomendada y caja post cierre.
- Los pilotos pueden ver la explicación; solo owner/dirección puede aplicar el cargo mensual.
- Al aplicar cierre, se registran movimientos separados en `airline_ledger` y se recalcula la caja con `pw_recalculate_airline_balance`.
- El cierre es idempotente por aerolínea/año/mes mediante `airline_monthly_closures`.

### Regla vigente
Los vuelos generan ingresos y costos variables; los costos fijos mensuales representan operar la empresa completa. El balance de aerolínea debe poder reconstruirse desde `airline_ledger`.

### SQL asociado
- Crear `airline_monthly_closures`.
- Asegurar índices por aerolínea, período y estado.
- Reutilizar `airline_ledger` para movimientos mensuales separados.

### Pendiente futuro
- Mostrar histórico anual de cierres mensuales en el dashboard financiero final.
- Incorporar depreciación formal si Claudio decide activarla.

---

## Actualización 15 — Dashboard financiero histórico y métricas consolidadas

**Objetivo:** convertir `/economia` en un centro de métricas históricas para revisar operación acumulada sin depender de múltiples consultas visuales dispersas.

### Cambios clave
- Se agrega endpoint `src/app/api/economia/metrics/route.ts`.
- El endpoint consolida datos desde `pw_economy_monthly_metrics`, `flight_economy_snapshots`, `airline_ledger`, `pilot_salary_ledger` y `pilot_expense_ledger`.
- Se agrega panel “Operación acumulada Patagonia Wings” en `/economia`.
- El panel muestra vuelos, pasajeros trasladados, carga, combustible, distancia, horas, ingresos y utilidad.
- Se agrega gráfico mensual de ingresos, costos y utilidad.
- Se agregan listas de rutas más rentables, rutas con pérdida, aeronaves productivas, pilotos productivos y gastos de pilotos.
- La sección tiene estado vacío elegante si todavía no hay cierres ACARS/snapshots.

### Regla vigente
Las métricas históricas deben leerse desde endpoints server-side y vistas agregadas para evitar parpadeos de datos en la UI. La página `/economia` debe distinguir entre estimaciones, cierres reales, ledger y snapshots.

### SQL asociado
No requiere SQL nuevo. Usa las tablas y vista creadas en los bloques anteriores:
- `pw_economy_monthly_metrics`
- `flight_economy_snapshots`
- `airline_ledger`
- `pilot_salary_ledger`
- `pilot_expense_ledger`

### Validación sugerida
Ejecutar `npx tsc --noEmit`, `npm run build`, abrir `/economia` y confirmar que el panel de métricas históricas carga sin ocultar la página aunque aún no existan vuelos cerrados.

---

## Actualización 16 — Liquidación mensual real del piloto y PDF definitivo

**Objetivo:** cerrar el flujo de sueldos del piloto con liquidación mensual trazable, descuentos, gastos, historial y documento PDF descargable.

### Cambios principales
- `src/app/api/pilot/salary/monthly/route.ts`: amplía la liquidación mensual con horas bloque, gastos del piloto desde `pilot_expense_ledger`, historial de liquidaciones, comisiones, sueldo base, daño/descuentos, bruto y neto.
- `src/app/api/pilot/salary/monthly/pdf/route.ts`: nuevo endpoint que genera un PDF real descargable (`application/pdf`) con el resumen mensual del piloto, vuelos del período y gastos/descuentos.
- `src/app/profile/page.tsx`: la pestaña `Mi economía` muestra horas bloque, gastos piloto, historial mensual y usa el endpoint PDF real en lugar de una ventana HTML/print.
- La liquidación considera: vuelos completados, horas, comisiones, sueldo base, descuentos por daño, gastos del piloto, neto del período, estado pagado/pendiente y últimos vuelos.

### Regla vigente
La liquidación mensual del piloto debe tomar datos reales de Supabase. Los gastos personales del piloto (traslados, pruebas teóricas, licencias, habilitaciones, entrenamiento) se descuentan del cálculo mensual y quedan trazables en `pilot_expense_ledger`. El PDF se genera desde servidor para evitar depender de `window.print()`.

### SQL asociado
Requiere asegurar columnas adicionales en `pilot_salary_ledger` para `expenses_total_usd` y `gross_total_usd`, además de `block_hours_total` y `pilot_callsign` si faltan. El SQL se entrega separado en el chat, no dentro del ZIP.

### Validación sugerida
1. Ejecutar SQL del Bloque 16.
2. Abrir `/profile?view=economia`.
3. Confirmar que aparezcan saldo, vuelos, horas, comisiones, gastos, deducciones, neto e historial mensual.
4. Presionar `Descargar PDF` y confirmar archivo `.pdf` descargado.
5. Ejecutar `npx tsc --noEmit` y `npm run build`.

---

## Fix urgente — TypeScript posterior a Bloque 17

**Fecha:** 2026-04-27

**Motivo:** al compilar después del Bloque 17 aparecieron errores TypeScript en métricas económicas, costos fijos mensuales y Dashboard.

**Cambios:**
- `src/app/api/economia/metrics/route.ts`: casting seguro `unknown as AnyRow[]` para respuestas genéricas de Supabase.
- `src/app/api/economia/monthly-fixed-costs/route.ts`: casting seguro `unknown as AnyRow[]` en paginación.
- `src/app/dashboard/page.tsx`: `buildNewsItems` vuelve a aceptar argumentos opcionales sin reintroducir tarjetas estáticas.
- `src/app/dashboard/page.tsx`: llamada antigua a `buildEconomyEstimate(distance, aircraft, mode)` actualizada al formato vigente por objeto, incluyendo origen/destino y país.

**Alcance:** fix mínimo de compilación. No cambia diseño, PIREP, ACARS, SimBrief ni reglas económicas.

**Validación sugerida:** `npx tsc --noEmit` y `npm run build`.

---

## Fix urgente — Dashboard economía itinerario operationCategory

**Motivo:** el build fallaba en `src/app/dashboard/page.tsx` porque se pasaba un objeto `AvailableItineraryOption` a `normalizeItineraryRouteCategory`, función que espera string.

**Cambio:** se usa `getItineraryRouteCategory(row)`, que extrae correctamente la categoría desde `route_category`, `service_profile`, `route_group`, `service_level` o `flight_mode`.

**Alcance:** fix mínimo; no cambia diseño, ACARS, PIREP, economía base ni flujo SimBrief.

**Validación sugerida:** ejecutar `npx tsc --noEmit` y `npm run build`.


---

## Fix urgente — SimBrief Invalid API Key / modo seguro de dispatch

**Motivo:** SimBrief mostraba `Fatal Exception: Invalid API key` al abrir el generador desde Patagonia Wings. Las URLs de callback Navigraph son para OAuth y no reemplazan la `SIMBRIEF_API_KEY` propia del API antiguo de SimBrief.

**Cambio:** `src/lib/simbrief.ts` y `src/app/api/simbrief/dispatch/route.ts` ahora soportan dos modos:

- `redirect` seguro por defecto: abre `https://dispatch.simbrief.com/options/custom` con origen, destino, tipo, vuelo, matrícula, pax/carga y `static_id` prellenados, sin usar API key. Evita el error de API key inválida.
- `api`: usa `ofp.loader.api.php` solo si `SIMBRIEF_GENERATION_MODE=api` y existe una `SIMBRIEF_API_KEY` válida.

**Regla:** las callbacks Navigraph autorizadas se mantienen para OAuth, pero no deben usarse como API key de SimBrief.

**Validación sugerida:** abrir Despacho → Generar OFP SimBrief. Debe abrir SimBrief con datos prellenados sin mostrar `Invalid API key`. Luego generar el OFP en SimBrief y cargarlo desde Patagonia Wings por `static_id`.


---

## Fix urgente — Export compatible `buildSimbriefRedirectUrl`

**Motivo:** el build de Vercel fallaba porque `src/app/dashboard/page.tsx` importaba `buildSimbriefRedirectUrl` desde `@/lib/simbrief`, pero el helper final disponible se llamaba `buildSimbriefDispatchPrefillUrl`.

**Cambio:** `src/lib/simbrief.ts` exporta `buildSimbriefRedirectUrl` como alias compatible de `buildSimbriefDispatchPrefillUrl`, manteniendo intacto el modo seguro `redirect` y el modo `api` con `SIMBRIEF_API_KEY` real.

**Alcance:** fix mínimo de compatibilidad TypeScript. No cambia UI, ACARS, PIREP, economía ni SQL.

**Validación sugerida:** ejecutar `npx tsc --noEmit` y `npm run build`. En Vercel no debe volver a aparecer `has no exported member named 'buildSimbriefRedirectUrl'`.

---

## Actualización 17C — SimBrief API real con popup de generación y flight number numérico

**Motivo:** al activar la API de SimBrief, el flujo no debe abrir la pantalla completa de edición como si el piloto tuviera que crear el vuelo manualmente. Además, SimBrief debe recibir `airline=PWG` y `fltnum` solo numérico, no `PWG1301`.

**Cambios:**
- `src/lib/simbrief.ts`: agrega `normalizeSimbriefFlightNumber()` y aplica `fltnum` numérico en URLs API/redirect.
- `src/app/api/simbrief/dispatch/route.ts`: usa `outputpage` interno de Patagonia Wings y responde modo API/redirect de forma explícita.
- `src/app/api/simbrief/return/route.ts`: nueva ruta de retorno para cerrar la ventana de generación y notificar al Dashboard.
- `src/app/dashboard/page.tsx`: muestra cuadro “Generando OFP SimBrief...”, abre popup pequeño cuando `SIMBRIEF_GENERATION_MODE=api`, escucha retorno automático y carga el OFP por `static_id`.

**Regla:**
- Con API key real: `SIMBRIEF_GENERATION_MODE=api` abre una ventana pequeña de generación SimBrief, no la pantalla completa de edición.
- Sin API key: se mantiene fallback seguro `redirect` con datos prellenados.
- El número de vuelo enviado a SimBrief queda separado: `airline=PWG` + `fltnum=1301`.

**Validación sugerida:** `npx tsc --noEmit`, `npm run build`, probar “Generar OFP SimBrief” y verificar que la URL use `fltnum=1301`, no `fltnum=PWG1301`.
---

## Actualización 17C — Modal oficial SimBrief seguro

**Objetivo:** dejar el flujo SimBrief integrado sin iframe ni automatización insegura del DOM externo.

**Cambios:**
- SimBrief se abre como ventana/popup oficial prellenada desde Patagonia Wings cuando se usa modo redirect.
- Patagonia Wings mantiene un estado visual de espera mientras el piloto genera el OFP en SimBrief.
- Al cerrar la ventana, la UI indica cargar el OFP automático con `static_id`.
- El modo API queda preparado para cuando exista una SimBrief API Key real de generación.
- `outputpage` usa `SIMBRIEF_RETURN_BASE_URL`, luego `NEXT_PUBLIC_APP_URL`, y solo como último recurso el origen de la request.

**Regla:** no se usa iframe ni scripts para presionar botones dentro de SimBrief. El piloto debe generar el OFP dentro de SimBrief salvo que exista una API Key de generación válida.

**SQL:** no requiere.

---

## Bloque 21 - Fix dashboard keys y cierre ACARS caja negra

**Cambio:**
- Web: `DispatchItineraryTable` usa key compuesta por itinerario, vuelo, aeronave, origen/destino e indice fallback para evitar keys duplicadas.
- ACARS: avatar local color para piloto sin foto, insignia de rango preservada en dashboard/perfil, stats Horas/PW Score centrados y LEDs de telemetria con verde/rojo.
- ACARS: cierre de vuelo queda como PIREP RAW para evaluacion server-side; se desactiva scoring local final.
- ACARS: version local actualizada a `6.0.3` / revision `2026.4.28.21` y manifest local `Web/autoupdater.xml` alineado.

**Validacion:**
- Web: `npm run build` OK.
- ACARS: MSBuild `Release|x64` OK, con warnings nullable existentes.

**SQL:** no requiere.

---

## Bloque 20 - Auditoria operacional despacho por rango, aeronave y autonomia

**Base oficial respetada:** ultima base local vigente, sin push, commit ni remoto Git.

**Cambio:**
- `src/lib/flight-ops.ts`
  - se fuerza el filtro local por ubicacion, rango y permisos tambien sobre `pw_list_dispatch_aircraft`;
  - los itinerarios de `pw_list_dispatch_itineraries` dejan de saltarse permisos locales salvo que vengan marcados explicitamente como `server_rank_filtered`;
  - se mantiene el filtro de autonomia/capacidad ya existente via economia por `distance_nm`.
- `src/lib/charter-ops.ts`
  - charter puede reutilizar `listAvailableAircraft(profile)` para respetar rango/habilitaciones antes de validar origen/destino.
- `src/components/dashboard/CharterDispatchPanel.tsx`
  - se pasa el perfil al selector charter.
- `src/components/dashboard/CharterOriginDestinationStep.tsx`
  - la lista charter queda filtrada por perfil y autonomia;
  - se agrega diagnostico `[dispatch-filter]` solo en desarrollo;
  - se ajusta mensaje cuando no hay aeronaves habilitadas.
- `src/app/dashboard/page.tsx`
  - se agrega diagnostico no productivo del filtro operacional;
  - se ajustan mensajes de aeronaves/rutas incompatibles.

**SQL:** no se aplico SQL nuevo; no hay `DATABASE_URL`, service role, `psql` ni Supabase CLI configurados en la maquina para ejecutar DDL remoto.

---

## Bloque 20B - SQL server-side despacho, charter, rango y autonomia

**Base oficial respetada:** ultima base local vigente, sin push, commit ni remoto Git.

**Auditoria:**
- Se auditaron firmas RPC expuestas por PostgREST:
  - `pw_list_dispatch_aircraft(p_origin_icao text)`
  - `pw_list_charter_aircraft(p_origin_icao text)`
  - `pw_list_dispatch_itineraries(p_origin_icao text)`
- Se revisaron columnas reales expuestas en:
  - `pilot_profiles`
  - `aircraft`
  - `aircraft_models`
  - `aircraft_economy_profiles`
  - `network_routes`
  - `network_route_aircraft`
  - `pilot_rank_aircraft_permissions`
  - `pw_pilot_rank_aircraft_families`
  - `pw_aircraft_family_variants`
  - `flight_reservations`
- El CSV entregado de funciones publicas no contiene RPC administrativa para ejecutar DDL/SQL remoto.

**Archivo creado:**
- `supabase/migrations/202604281717_bloque_20b_dispatch_server_side_filters.sql`

**Contenido de migracion:**
- Helpers SQL `pw_20b_*` para normalizar codigos, resolver piloto autenticado, permisos por rango, distancia entre aeropuertos y compatibilidad por tipo.
- `create or replace function` para:
  - `pw_list_dispatch_aircraft`
  - `pw_list_charter_aircraft`
  - `pw_list_charter_aircraft_for_route`
  - `pw_list_dispatch_itineraries`
- Indices `if not exists` para filtros de flota, rutas, perfiles economia y permisos.
- Validaciones SQL comentadas dentro de la migracion.

**SQL:** aplicado desde Codex con `pw_admin_exec_sql(sql_text text)`.
- Primer intento rechazado por PostgreSQL al cambiar `RETURNS TABLE` de RPC existente; se ajusto migracion para dropear/recrear solo wrappers RPC por firma, sin datos.
- Aplicacion exitosa auditada: `3db3baa6-a97e-427c-bed5-31a4efceb09c`.
- Validacion server-side exitosa auditada: `6087c336-85fb-41a1-b188-5d68ed8c864c`.
- Se validaron permisos `CADET`, bloqueo de long-haul/heavy para piloto bajo, distancia SCEL-KMIA y bloqueo C208 por autonomia en charter/itinerario.
- RPC temporal `pw_admin_exec_sql` eliminada despues de aplicar; `pw_admin_drop_exec_sql` queda expuesta.

---

## Actualización 17D — Integración Navigraph/SimBrief movida a portada pública

**Objetivo:** sacar la vitrina de partners del dashboard y llevar la comunicación de integración a la página de inicio pública, antes del login, con mejor presencia visual y mensaje operacional claro.

**Cambios:**
- `src/app/page.tsx`
  - se rehizo el hero público con logo grande de Patagonia Wings, título/slogan más potentes y mejor presencia visual.
  - se agregaron logos transparentes de Navigraph y SimBrief en la portada, integrados al hero y a una sección pública nueva de integración.
  - se añadió sección `#integraciones` explicando que Patagonia Wings está integrada con Navigraph y SimBrief.
  - se dejó explícito que para usar el flujo completo se requiere suscripción activa de Navigraph.
  - se dejó explícito que el usuario debe registrar su usuario Navigraph / SimBrief al crear su cuenta.
- `src/app/dashboard/page.tsx`
  - se dejó de renderizar la vitrina `DashboardPartnersShowcase`, eliminando esa comunicación del dashboard privado.
- `src/app/register/page.tsx`
  - se agregó campo opcional `Usuario Navigraph / SimBrief` en el registro.
  - ese valor se guarda en metadata como `simbrief_username` para que luego el perfil piloto y el despacho puedan reutilizarlo.
  - se actualizó el panel visual del registro para remarcar la integración `Navigraph + SimBrief`.

**Regla funcional:**
- La integración se comunica ahora desde la portada pública.
- El dashboard ya no muestra esa sección de publicidad/integraciones.
- El registro ya permite dejar el usuario que alimentará el flujo OFP/dispatch.

**SQL:** no requiere.

**Validación sugerida:**
1. abrir `/` y verificar hero nuevo + logos Navigraph/SimBrief + sección pública de integración.
2. abrir `/dashboard` y confirmar que ya no aparece la vitrina de partners.
3. abrir `/register` y confirmar el nuevo campo `Usuario Navigraph / SimBrief`.
4. ejecutar `npx tsc --noEmit` y `npm run build`.

### Ajuste visual 17D.1 — Hero rehecho estilo referencia
- Se rehízo nuevamente el hero de `src/app/page.tsx` para acercarlo mucho más a la primera referencia aprobada.
- Se eliminó el look anterior tipo bloque/chips pequeños y se reemplazó por una composición hero más limpia y editorial:
  - isotipo Patagonia Wings grande a la izquierda,
  - título grande “Patagonia Wings”,
  - slogan destacado,
  - logos Navigraph y SimBrief integrados sin recuadros,
  - mensajes de suscripción/usuario con íconos circulares,
  - CTA principal “Comienza tu viaje”.
- `HomeStatsBar` se movió fuera del hero para que la cabecera no se vea comprimida.

---

## Actualización 17E — Corrección visual hero portada estilo referencia

**Objetivo:** corregir el primer rediseño de portada porque quedó demasiado centrado, pequeño y visualmente débil. Se ajusta el hero para acercarlo a la referencia aprobada: logo grande, título elegante, slogan protagonista e integración Navigraph/SimBrief limpia sin recuadros.

**Cambios:**
- `src/app/page.tsx`
  - se reorganizó el hero para que el contenido vuelva a sentirse grande, premium y hacia el lado izquierdo.
  - se aumentó el logo principal de Patagonia Wings junto al título.
  - se cambió el título a estilo serif/elegante y de mayor tamaño.
  - se recuperó un slogan visible tipo referencia: `Tu conexión aérea en la Patagonia`.
  - se reemplazaron los logos en recuadros por una marca limpia construida en la UI: `Navigraph | SimBrief`, sin cajas pesadas ni fondos negros.
  - se movió la barra de estadísticas fuera del primer fold para no ensuciar la portada principal.
  - se mantuvo la sección pública de integración y el texto de requisito de suscripción Navigraph.

**Regla visual:**
- La portada debe sentirse más como la referencia visual premium, no como un bloque pequeño centrado.
- Los logos de integración deben verse limpios, sin recuadro pesado ni imagen con fondo.

**SQL:** no requiere.

---

## Actualización 17F — Hero público premium con logos oficiales Navigraph / SimBrief

**Objetivo:** corregir la portada pública para dejarla mucho más cercana a la referencia aprobada, evitando un layout cargado y respetando los logos oficiales de Navigraph y SimBrief sin redibujarlos.

**Cambios:**
- `src/app/page.tsx`
  - se rehízo el hero público completo para darle una composición más limpia, grande y equilibrada en formato landscape.
  - se eliminó el pseudo-logo dibujado de Navigraph y se reemplazó por los archivos oficiales reales desde `public/partners/navigraph.png` y `public/branding/Navigraph Logos/simbrief-75dpi-horizontal.png`.
  - se reorganizó el contenido en un bloque premium más amplio, con mejor jerarquía visual, logo Patagonia Wings protagonista, título más grande y mejor distribución del espacio.
  - se simplificó el mensaje del hero con dos tarjetas informativas en vez de varias líneas apretadas e iconografía recargada.
  - se mantuvo la sección pública de integración antes del login, pero con apoyo visual más limpio.
- `src/app/globals.css`
  - se ajustó el fondo del hero para usar una versión más premium (`home-hero-4k.jpg`) con nueva gradiente y mejor balance para pantallas anchas.
- `docs/MASTER_CHANGELOG.md`
  - se agregó el registro acumulativo de esta iteración.

**Regla aplicada:**
- No se modifican ni reinterpretan los logos oficiales de SimBrief o Navigraph; solo se usan sus assets oficiales y se ajustan tamaños/composición.

**SQL:** no requiere.

**Validación sugerida:**
1. abrir `/` y revisar el hero en pantalla completa desktop.
2. verificar que los logos mostrados sean los oficiales.
3. confirmar que el contenido ya no se vea pequeño ni amontonado al lado izquierdo.
4. ejecutar `npx tsc --noEmit` y `npm run build`.

---

## Actualización 17G — Cuadro de integración más grande con logos subidos por Claudio

**Objetivo:** agrandar el cuadro de integración del hero y usar los logos correctos subidos por Claudio para Navigraph y SimBrief.

**Cambios:**
- `src/app/page.tsx`
  - se reemplazó el bloque anterior del hero por un cuadro de integración más grande y mejor proporcionado.
  - se usaron los logos oficiales subidos por Claudio para `Navigraph` y `SimBrief by Navigraph`.
  - se reorganizó el cuadro con dos bloques de logos más visibles y textos descriptivos debajo.
  - se mantuvieron los puntos de “Suscripción requerida” y “Usuario vinculado”, ahora con mejor lectura.
- `public/partners/navigraph-official-horizontal.png`
  - nuevo asset oficial subido por Claudio.
- `public/partners/simbrief-by-navigraph-official.png`
  - nuevo asset oficial subido por Claudio.
- `docs/MASTER_CHANGELOG.md`
  - se agregó esta actualización al log maestro.

**SQL:** no requiere.

---

## Actualización 17H — Hero sin recuadros + bloque paralelo limpio + logo menú solo ícono

**Objetivo:** dejar el hero más limpio y elegante, moviendo la integración en paralelo al título principal, sin recuadros, con logos más grandes y simplificando el logo del menú superior.

**Cambios:**
- `src/app/page.tsx`
  - se eliminó el logo Patagonia Wings que aparecía dentro del contenido del hero.
  - se reorganizó el hero en dos columnas: a la izquierda el título principal y a la derecha la integración oficial.
  - se eliminó el cuadro/contenedor del bloque de integración para que todo quede directamente sobre el fondo del hero.
  - se quitaron los recuadros internos de los logos y se dejaron los logos oficiales mucho más grandes y visibles.
  - se mantuvieron los textos clave de Navigraph / SimBrief, suscripción requerida y usuario vinculado, pero en un layout más limpio.
- `src/components/site/PublicHeader.tsx`
  - se agrandó el logo del menú superior.
  - se eliminaron las letras del branding del header, dejando solo el ícono de Patagonia Wings.
- `docs/MASTER_CHANGELOG.md`
  - se agregó esta actualización al log maestro.

**SQL:** no requiere.

---

## Actualización 17I — Responsive global anti-zoom-out

**Objetivo:** evitar que la web se vea excesivamente pequeña, centrada y perdida cuando el navegador está con zoom out o cuando se abre en viewports/monitores ultra-wide.

**Cambios:**
- `src/app/globals.css`
  - se agregaron reglas globales progresivas para viewports anchos (`1680px`, `2200px`, `2800px`).
  - se escala el `font-size` base de forma controlada en pantallas muy anchas.
  - se amplía `.pw-container` para usar mejor el ancho disponible.
  - se refuerza el tamaño del header público, logo, navegación y acciones.
  - se agregan reglas específicas del hero para que título, slogan, bloque de integración y logos no queden microscópicos.
  - se agregan reglas generales para contenedores privados grandes dentro de `.grid-overlay`.
- `src/app/page.tsx`
  - se agregaron clases semánticas al hero (`home-hero-grid`, `home-hero-title`, `home-integration-card`, etc.) para controlar el escalado sin hacks ni zoom forzado.
- `src/components/site/PublicHeader.tsx`
  - se agregaron clases semánticas al header público (`public-site-header`, `public-header-logo`, `public-header-nav`, `public-header-actions`) para permitir escalado responsive global.

**Regla aplicada:**
- No se bloquea el zoom del navegador.
- No se usa `body zoom` ni `transform scale` global.
- La solución respeta accesibilidad y compensa viewports enormes con reglas responsive.

**SQL:** no requiere.

**Validación sugerida:**
1. abrir `/` en zoom 100%, 80%, 67% y 50%.
2. verificar que el hero, logos y header no queden microscópicos.
3. revisar dashboard y páginas principales para confirmar que los contenedores usen mejor el ancho.
4. ejecutar `npx tsc --noEmit` y `npm run build`.

---

## Bloque 17M — Imagen real en cuadro de comunidad / nosotros

**Base oficial respetada:** `public.zip` subida por Claudio.

**Objetivo:**
- reemplazar la ilustración del bloque de comunidad por la imagen real del centro de operaciones enviada por Claudio;
- ajustar el cuadro para que acompañe mejor la proporción horizontal de la nueva imagen.

**Archivos modificados:**
- `src/app/page.tsx`
  - se reemplaza la imagen `/branding/nosotros-ops-room.svg` por la nueva imagen real `nosotros-ops-room-photo.png`;
  - se ajusta el contenedor visual del bloque `Nosotros` usando un marco más limpio y una proporción `aspect-video` para que el cuadro se adapte a la imagen.
- `public/branding/nosotros-ops-room-photo.png`
  - nueva imagen real del centro de operaciones Patagonia Wings.

**SQL:** no requiere.

---

## Bloque 17N — Servicios landing actualizados

**Base oficial respetada:** `public.zip` subida por Claudio.

**Objetivo:** actualizar la sección pública `Servicios` para reflejar el estado actual de Patagonia Wings: itinerarios, despacho/OFP, economía operacional y progresión del piloto.

**Cambios:**
- `src/app/page.tsx`
  - se cambia el título de la sección por una propuesta más actual y orientada a landing page;
  - se agregan textos cortos explicativos para itinerarios oficiales, despacho SimBrief, economía operacional y perfil/progresión;
  - se incorporan emojis/íconos visuales por card;
  - se ajusta el grid a 4 cards en desktop, 2 en tablet y 1 en mobile.

**SQL:** no requiere.

---

## Bloque 17O — Integración oficial homogénea y logo Patagonia Wings ampliado

**Base oficial respetada:** `public.zip` subida por Claudio.

**Objetivo:** ajustar la sección pública de Integración Oficial para que el bloque derecho de ecosistema operativo tenga una presencia visual más homogénea con el contenido izquierdo.

**Cambios:**
- `src/app/page.tsx`
  - la grilla de Integración Oficial pasa a dos columnas equivalentes en desktop.
  - el bloque derecho `Ecosistema operativo` queda estirado a la misma altura visual del contenido izquierdo.
  - el logo Patagonia Wings del bloque derecho se amplía de forma importante para mejorar presencia de marca.
  - se mantiene el flujo y contenido existente sin tocar lógica ni rutas.

**SQL:** no requiere.

---

## Bloque 17P — Logos Navigraph / SimBrief más grandes y apilados

**Base oficial respetada:** última base vigente con bloque 17O aplicado.

**Objetivo:**
- agrandar visualmente los logos de Navigraph y SimBrief dentro del panel derecho de integración oficial;
- apilarlos uno sobre otro para llenar mejor la ventana y evitar sensación de vacío;
- mantener intacto el flujo y la estructura general de la landing.

**Archivos modificados:**
- `src/app/page.tsx`
  - el componente `OfficialIntegrationLogos` en modo `compact` ahora muestra los logos en columna;
  - se aumentó el tamaño visual de ambos logos en la tarjeta derecha;
  - se agregó un ancho máximo controlado para que el bloque de logos quede más presente y equilibrado.

**SQL:** no requiere.

---

## Bloque 17Q — Sección Flota conectada sin scroll y mejor layout landing

**Base oficial respetada:** última base vigente derivada de `public.zip` y bloques posteriores aplicados en esta conversación.

**Objetivo:**
- reorganizar la sección de Flota de la landing para que el título quede arriba de la imagen tipo tablet;
- mover el texto descriptivo bajo la imagen;
- dejar el listado de aeronaves a la derecha, alineado con la altura general del bloque;
- quitar el scroll interno del listado para mostrar todas las aeronaves disponibles;
- mantener conexión con Supabase y actualización automática por realtime.

**Archivos modificados:**
- `src/app/page.tsx`
  - reestructura el bloque `#flota` en dos columnas equilibradas;
  - título y visual principal quedan a la izquierda;
  - descripción queda debajo de la imagen;
  - listado conectado queda a la derecha.
- `src/components/site/HomeFleetShowcase.tsx`
  - deja el componente enfocado en lista de aeronaves conectada;
  - mantiene carga desde `aircraft` y `aircraft_fleet` en Supabase;
  - mantiene realtime para actualizar automáticamente;
  - elimina `max-height` y `overflow-y-auto` para no tener scroll interno;
  - mueve los botones debajo de la lista;
  - mejora visual con card premium y separador verde.

**SQL:** no requiere.

---

## Bloque 17R — Flota landing en 3 columnas y texto operacional

**Base oficial respetada:** última base vigente de Claudio.

**Objetivo:**
- hacer más compacta la lista de aeronaves de la landing;
- evitar que el usuario vea mensajes técnicos sobre Supabase;
- reemplazar el contador confuso de modelos por una etiqueta operacional.

**Archivos modificados:**
- `src/components/site/HomeFleetShowcase.tsx`
  - la lista de aeronaves ahora usa 3 columnas en pantallas grandes para reducir altura;
  - se reemplazó el texto técnico sobre Supabase por un texto corto orientado a operación, habilitaciones y liveries oficiales;
  - se cambió el indicador `28 modelos` por `Flota en certificación`, evitando mostrar un número que puede variar según catálogo/base/fallback.
- `docs/MASTER_CHANGELOG.md`
  - se registra esta actualización.

**Nota:**
El número 28 venía de contar todos los modelos únicos cargados desde la base operacional o, si no había lectura disponible, desde el fallback local de flota.

**SQL:** no requiere.

---

## Bloque 17S — Flota certificada desde Supabase + Sukhoi + carga optimizada

**Base oficial respetada:** `public.zip` subida por Claudio.

**Objetivo:**
- tomar como certificados todos los modelos activos que existan en Supabase;
- incluir correctamente el Sukhoi/Sukhoi Superjet 100 cuando exista en catálogo;
- optimizar la carga de la sección de flota para que responda más rápido y con menos ambigüedad.

**Archivos modificados:**
- `src/components/site/HomeFleetShowcase.tsx`
  - la lista principal ahora se arma desde `aircraft_models` activos, usando `aircraft` solo para enriquecer nombres y addons cuando existan;
  - se reemplaza la lectura mezclada de `aircraft_fleet` por una fuente más clara para catálogo/modelos certificados;
  - se agrega mapeo de `SU95` -> `Sukhoi Superjet 100`;
  - el badge ahora muestra `N modelos certificados` según lo cargado realmente;
  - se ajusta la suscripción realtime para escuchar `aircraft_models` y `aircraft`;
  - se reduce el debounce de refresco para que los cambios entren más rápido;
  - se actualiza el fallback incluyendo Sukhoi.

**Nota operativa:**
- si el navegador o el entorno local muestran números antiguos, limpiar `.next` y recargar ayuda a evitar lecturas cacheadas.

**Validación local:**
- la base subida no trae dependencias instaladas completas para ejecutar `tsc` aquí, así que no pude validar compilación completa en el contenedor.

**SQL:** no requiere.

---

## Bloque 17T — Flota certificada real desde aircraft_models y carga optimizada

**Base oficial respetada:** última base vigente enviada por Claudio y CSV exportado desde Supabase.

**Hallazgo del CSV:**
- `aircraft_models` tiene 33 modelos activos, incluyendo `SU95` / Sukhoi SuperJet 100.
- La columna correcta para nombre visible no es `name`; es `display_name` / `variant_name`.
- La landing estaba consultando también `aircraft`, tabla que contiene 4.261 filas, lo que hacía más lenta la carga y podía mezclar datos operativos con modelos certificados.

**Cambios:**
- `src/components/site/HomeFleetShowcase.tsx`
  - ahora lee la flota certificada directamente desde `public.aircraft_models`.
  - usa `display_name`, `variant_name`, `display_category`, `manufacturer`, `code` e `is_active`.
  - deja de consultar la tabla pesada `aircraft` para la landing.
  - mantiene actualización automática solo escuchando cambios de `aircraft_models`.
  - el contador queda basado en modelos activos reales.
  - actualiza fallback local a 33 modelos certificados, incluyendo `B736`, `B748`, `B77F`, `C172`, `DHC6`, `E170` y `SU95`.

**SQL:** no requiere.

---

## Bloque 17U — Fix runtime HomeFleetShowcase tags undefined

**Base oficial respetada:** `public.zip` + últimos parches de flota.

**Motivo:**
- En desarrollo apareció `Runtime TypeError: Cannot read properties of undefined (reading 'length')` dentro de `HomeFleetShowcase.tsx` al evaluar `entry.tags.length`.
- El componente debe ser tolerante si una fila/fallback llega sin `tags` por cache, datos incompletos o mezcla temporal de versiones.

**Cambio:**
- `src/components/site/HomeFleetShowcase.tsx`
  - se agrega `safeTags = Array.isArray(entry.tags) ? entry.tags.filter(Boolean) : []` antes de renderizar badges;
  - se evita leer `.length` sobre `undefined`;
  - se agrega fallback visual para nombre/código de aeronave.

**SQL:** no requiere.

---

## Bloque 17V — Certificaciones landing con foco en checkrides, teóricas y habilitaciones

**Base oficial respetada:** última base vigente con `public.zip` + parches actuales ya trabajados en esta conversación.

**Cambio solicitado:**
- reemplazar el bloque genérico de certificaciones de la landing por contenido más alineado con la operación real de Patagonia Wings;
- hablar explícitamente de checkrides, teóricas y habilitaciones;
- usar iconos/emojis y tarjetas más explicativas, pero con texto corto de landing page.

**Archivo modificado:**
- `src/app/page.tsx`
  - se actualiza el título de la sección a un enfoque más operacional;
  - se agrega texto introductorio corto;
  - se reemplazan las tres cards por:
    - `🛫 Checkride práctico`
    - `📘 Teóricas y habilitaciones`
    - `✅ Previo al vuelo`
  - cada card ahora incluye icono/emojis, título y descripción breve más clara para el usuario final.

**SQL:** no requiere.


---

## Bloque 17W — Eliminación CTA final y botón panel piloto

**Base oficial respetada:** última base vigente con `public.zip` + actualizaciones aplicadas hasta el bloque 17V.

**Objetivo:**
- eliminar la sección final tipo contacto/CTA que decía “Siguiente paso: llevar este look al resto de la web”;
- eliminar el botón “Ver panel de piloto” de la sección Servicios;
- no tocar ni revertir las actualizaciones visuales y funcionales ya aplicadas.

**Archivo modificado:**
- `src/app/page.tsx`
  - se eliminó el CTA final `#contacto`;
  - se eliminó solo el botón de acceso al panel dentro de Servicios;
  - se mantiene intacto el resto del contenido de la landing.

**SQL:** no requiere.

---

## Bloque 17X — Traslados más compactos tipo tabla

**Base oficial respetada:** última base vigente con `public.zip` + actualizaciones ya aplicadas en esta conversación, sin retroceder cambios previos.

**Cambio solicitado:**
- hacer las ventanas de traslados más pequeñas;
- reducir el tamaño visual de los botones;
- compactar la presentación para que se vea más como tabla y menos como tarjetas grandes.

**Archivo modificado:**
- `src/app/dashboard/page.tsx`
  - se compacta el bloque `Reposicionamiento`;
  - se reduce padding y altura visual de las tres columnas de traslado;
  - cada alternativa ahora se muestra en filas más compactas tipo tabla;
  - el botón deja de ocupar todo el ancho y pasa a tamaño más contenido;
  - se acortan textos de acción a `Trasladar` / `Sin saldo` para que el bloque se vea más limpio.

**SQL:** no requiere.

---

## Bloque 18A — Central operacional inspirada en SUR Air

**Base oficial respetada:** ZIP vigente entregado en la conversación (`README_BLOQUE_23_DISTANCIA_ACARS.zip`) con los bloques previos de distancia ACARS y cierre automático por crash.

**Objetivo:**
- tomar lo mejor observado en la página operativa de SUR Air sin copiar código ni estructura legacy;
- reforzar la sensación de “sala de despacho” en Patagonia Wings Web;
- mantener el diseño premium actual, líneas verdes, cards limpias y estadísticas horizontales bajo la bienvenida.

**Archivo modificado:**
- `src/app/dashboard/page.tsx`

**Cambios aplicados:**
- Las estadísticas del piloto dejan de ir en columna lateral y pasan a una franja horizontal bajo la bienvenida.
- Se agrega un boletín tipo `NOTAM PWG` dentro de la tarjeta del aeropuerto actual, usando el METAR disponible y dejando claro que es un aviso operacional interno.
- Se agrega la sección `Actividad del aeropuerto`, separando:
  - partidas desde el aeropuerto actual;
  - arribos hacia el aeropuerto actual;
  - estado de la integración ATC/VATSIM preparada para una futura conexión.
- Se reactiva el bloque de comunicados operacionales internos para que la central muestre novedades aunque no exista API de noticias disponible.
- La sección de noticias locales queda separada de los comunicados PWG, evitando mezclar NOTAM interno, actualidad local y avisos de operación.
- Se mantiene intacto el flujo principal de despacho, reservas, SimBrief, economía, ACARS, traslados y oficina.

**SQL:** no requiere.

**Notas:**
- No se copió código de SUR Air.
- El bloque queda preparado para una futura tabla Supabase de NOTAMs internos por aeropuerto y para una futura integración VATSIM real.


## Bloque 18B · Conector contable economía/ACARS · 2026-04-29

- Se agrega `createSupabaseAdminClient()` en `src/lib/supabase/server.ts` para escrituras contables server-side con `SUPABASE_SERVICE_ROLE_KEY`.
- El cierre `/api/acars/finalize` mantiene validación del piloto con bearer token, pero snapshots, ledger, balance y acumulado salarial pasan a cliente admin server-side.
- Objetivo: corregir el bloqueo detectado por RLS activo sin policies en `flight_economy_snapshots`, `airline_ledger`, `pilot_salary_ledger` y tablas económicas sensibles.
- Regla contable: al finalizar vuelo se devenga comisión/costos; el pago al wallet se deja para liquidación mensual, no por vuelo.
- No se cambia flujo interno de despacho, SimBrief ni ACARS.

## Bloque 18B-18F · Ajuste final de implementación · 2026-04-29

- `src/lib/acars-official.ts`: se elimina pago vuelo-a-vuelo a `pilot_profiles.wallet_balance` en finalize; la comisión queda devengada en `pilot_salary_ledger`.
- `src/app/api/pilot/salary/monthly/route.ts`: liquidación mensual con escritura `service role` para `pilot_salary_ledger` y pago de wallet solo en cierre mensual.
- Migraciones SQL nuevas en `supabase/migrations`:
  - `20260429_18b_rls_accounting_guard.sql`
  - `20260429_18b_post_audit.sql`
- Build validado con `npm run build` sin errores TypeScript.

---

## 2026-04-30 - Fases A y 6 parcial (route learning + planned vs real)

Cambios:
- Route learning activo: nueva API `POST /api/dispatch/route-learning` para guardar rutas limpias por origen/destino/nivel/tipo y aumentar `usage_count`.
- Route Finder prioriza coincidencias por tipo/nivel/categoria y devuelve metadata de uso.
- Dashboard: al usar ruta o validar OFP se persiste aprendizaje de ruta; se muestra tarjeta de sugerencia con fuente/uso.
- Cierre real ACARS: factores deterministas de ventas/servicio a bordo por calidad operacional (seed por reserva) para evitar variacion en reintentos.
- Detalle de vuelo: nueva seccion Planificado vs Real con fuel, block, ingresos, costos, utilidad, comision y estado contable (snapshot/ledger/salary).
- Nueva migracion: `supabase/migrations/20260430_pilot_progression_catalog_and_ledger_columns.sql` para columnas de trazabilidad y catalogo minimo de progresion piloto (idempotente).

Notas:
- No se modifico bloque 18B contable.
- `npm run build` OK.

## 2026-04-30 - Cierre 18E admin payout + fix migracion progresion

Cambios:
- Corregida migracion `20260430_pilot_progression_catalog_and_ledger_columns.sql`: agrega `created_at` y `updated_at` en `pilot_expense_catalog` antes del upsert.
- Nuevo endpoint owner/admin `GET|POST /api/pilot/salary/monthly/admin` para preview y ejecucion manual de liquidacion mensual.
- Proteccion de doble pago por piloto/mes: si el periodo ya esta `paid`, se omite.
- Pago de wallet solo en liquidacion mensual admin; el cierre ACARS sigue solo devengando comision.
- Nueva tarjeta owner en `/economia` para ejecutar preview/pago mensual y documentar cron futuro (ultimo dia habil).

Estado:
- ACARS/SIM no tocado.
- Build OK.

## 2026-04-30 - Cierre final 18F + validacion label catalog + ACARS/SIM alcance

Cambios:
- Validado bloque de progresion piloto: `pilot_expense_catalog` usa `label` (no `name`) en migracion, APIs y UI.
- `CharterOriginDestinationStep` ajustado para 18F multitype: selector de tipo mantiene `codigo + nombre`; selector de matricula muestra solo matricula; resumen muestra `matricula + tipo + nombre`.
- Limpieza de textos corruptos/UTF-8 en componentes de despacho charter.
- Se mantiene OFP guiado bloqueante, Route Finder, SimBrief limpio, manifiesto pre-ACARS y planificado vs real sin regresion.
- ACARS/SIM desktop: no aplicable en este repo web (no se detecto proyecto de cliente ACARS/Electron/SimConnect para patch directo).

Validaciones:
- `npm run build` OK.
- Scan mojibake en dashboard/components/simbrief OK.

## 2026-04-29 - ACARS 7.0.0 parcial (payload extendido + altitud diagn�stica + XPDR)

Cambios aplicados:
- Extensi�n de telemetr�a ACARS para separar `indicated_altitude_ft`, `true_altitude_ft`, `pressure_altitude_ft`, `radio_altitude_ft`, `ground_altitude_ft` y `altitude_agl_ft`.
- Se a�ade `qnh_inhg` adem�s de `qnh_hpa` en telemetr�a serializada.
- Se incorpora XPDR en payload de muestras (`xpdr_state_raw`, `xpdr_code`, `xpdr_charlie`).
- `closeout_payload` ampl�a contrato con:
  - `blackbox_summary`
  - `event_summary`
  - `critical_events`
  - `capability_snapshot`
  - `unsupported_signals`
  - `penalty_exclusions`
- Se documenta ejecuci�n en:
  - `docs/ACARS_7_EXECUTION_STATUS.md`
  - `docs/ACARS_7_AIRCRAFT_CAPABILITY_MATRIX.md`

Regla contable preservada:
- No se toc� 18B (ledger/salary/wallet mensual).
- Finalize sigue sin pagar wallet por vuelo.

## 2026-04-29 � ACARS 7.0.0 cierre build + XPDR UI
- Se repara compilacion ACARS en toolchain WPF (.NET Framework) y queda build OK con MSBuild x64.
- Se agrega semaforo XPDR dedicado en UI ACARS (ALT verde, STBY amarillo, OFF/N-D gris).
- Se endurece closeout payload con event log v7 (code/phase/timestamp/severity/supported/reliable/penalty_applied/reason/evidence).
- Se mantiene compatibilidad con finalize web y economia 18B sin cambios contables.

## 2026-04-29 - HOTFIX ACARS/Web 7.0.0
- ACARS ahora muestra version visual enlazada a version real (UpdateService/AppVersion).
- Actualizados App.config, AssemblyInfo y manifests locales a 7.0.0.
- PostFlight ACARS reetiquetado como caja negra: evaluacion final oficial en Patagonia Wings Web.
- Cierre operacional diferencia completed vs cancelled desde ACARS.
- Habilitaciones en cierre con fallback "No disponible" y sin duplicados.
- Oficina web: se agregan LEDs visuales de despacho alimentados por telemetria ACARS.

## 2026-04-29 - ACARS 7.0.0 Ready To Fly (deteccion y build oficial)
- Se documenta build oficial ACARS WPF legacy con MSBuild VS2022 x64 (Debug|x64) como validacion final.
- Se consolida documentacion de deteccion aeronave/addon con separacion Web (tipo/matricula) vs ACARS (variante tecnica interna).
- Se actualiza matriz de 33 aeronaves con variante, addon source, metodo de lectura y exclusions no penalizables por capacidad.
- Se publica checklist ready-to-fly para pruebas operacionales de ACARS 7.0.0.
- Se mantiene sin cambios el selector web de aeronaves y sin impacto en 18B contable.

