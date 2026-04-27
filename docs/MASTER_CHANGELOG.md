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
