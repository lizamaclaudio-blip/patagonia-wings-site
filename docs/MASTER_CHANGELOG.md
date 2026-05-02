# Patagonia Wings - Registro maestro de cambios

## 2026-04-26 - Economia realista V1

Base tomada: `web patagonia.zip` + fix aprobado `patagonia_web_fix_economia_visible.zip`.

Regla de trabajo:
- No retroceder a ZIPs o commits anteriores.
- Cada ZIP/fix aprobado por Claudio pasa a ser nueva base vigente.
- ACARS registra evidencia operacional; Supabase/Web evalÃºa, calcula economÃ­a y muestra resultados.

Cambios de este bloque:
- Se reemplazÃ³ la economÃ­a simplificada `ingreso = 3x pago piloto` por un modelo realista centralizado.
- El helper `src/lib/pilot-economy.ts` ahora calcula pax, carga, tarifa promedio, ingresos pax/cargo/charter, combustible por paÃ­s/aeropuerto, mantenciÃ³n, tasas, handling, reserva tÃ©cnica, pago piloto, utilidad y margen.
- CatÃ¡logo, Itinerario y Charter consumen el mismo helper/API para evitar fÃ³rmulas duplicadas.
- El cierre ACARS/Web registra ledger separado por concepto y crea snapshot global para mÃ©tricas futuras.
- Se agrega plan SQL para `fuel_price_index`, `flight_economy_snapshots`, gastos/licencias del piloto, valores de flota y columnas econÃ³micas.

No tocar en futuros cambios:
- Flujo PIREP raw/server evaluation.
- Capital inicial aprobado USD 1.305.000.
- EconomÃ­a visible aprobada en Oficina/CatÃ¡logo/Itinerario/Charter.

Pendiente de validaciÃ³n:
- Ejecutar SQL de economÃ­a realista en Supabase.
- Probar cierre real ACARS para confirmar `flight_economy_snapshots` y ledger por conceptos.
- Cuando SimBrief entregue payload real, reemplazar estimaciones de pax/carga por datos OFP.

---

## 2026-04-26 â€” EconomÃ­a realista V2 / Gastos del piloto y pruebas teÃ³ricas

Base tomada: EconomÃ­a Realista V1 aprobada con SQL aplicado correctamente.

Regla de trabajo:
- Mantener un Ãºnico archivo maestro acumulativo: `docs/MASTER_CHANGELOG.md`.
- No crear README nuevo por bloque.
- Cada cambio futuro debe agregarse al final de este mismo log.

Cambios de este bloque:
- Se agrega catÃ¡logo centralizado de gastos del piloto en `src/lib/pilot-economy.ts`.
- Se incluyen costos de traslados, licencias, certificaciones, habilitaciones, entrenamiento, pruebas prÃ¡cticas y pruebas teÃ³ricas.
- Se agregan pruebas teÃ³ricas con costo propio: IFR/IMC, regional, narrowbody, widebody y recurrente.
- Se crea endpoint `src/app/api/economia/pilot-expenses/route.ts` para leer `pilot_expense_catalog` desde Supabase y usar fallback local si la tabla estÃ¡ vacÃ­a o inaccesible.
- Se agrega panel visual en `/economia` para explicar al usuario en quÃ© gastarÃ¡ su billetera virtual.
- El panel muestra totales por categorÃ­a y resalta las pruebas teÃ³ricas como requisito antes de habilitaciones/certificaciones.

SQL asociado:
- Insert/update idempotente en `pilot_expense_catalog`.
- No se modifica saldo ni ledger en este bloque; solo catÃ¡logo/base para futuras compras/descuentos.

Pendiente futuro:
- Crear flujo real de compra/descuento desde billetera del piloto.
- Registrar compras en `pilot_expense_ledger`.
- Conectar habilitaciones/certificaciones reales con estado del piloto.

---

## 2026-04-26 â€” EconomÃ­a realista V3 / Descuento real desde billetera del piloto

Base tomada: EconomÃ­a Realista V2 aprobada con catÃ¡logo de gastos piloto y pruebas teÃ³ricas.

Regla de trabajo:
- Mantener este archivo como log maestro acumulativo.
- No crear README nuevo por cada bloque.
- No tocar ACARS en este bloque: ACARS registra; Web/Supabase administra economÃ­a y gastos.

Cambios de este bloque:
- Se extiende `src/app/api/economia/pilot-expenses/route.ts` para soportar:
  - `GET /api/economia/pilot-expenses` pÃºblico: catÃ¡logo de gastos.
  - `GET /api/economia/pilot-expenses?mine=1` autenticado: catÃ¡logo + saldo billetera + Ãºltimos gastos del piloto.
  - `POST /api/economia/pilot-expenses` autenticado: descuenta gasto desde `pilot_profiles.wallet_balance` y registra movimiento en `pilot_expense_ledger`.
- Se agrega rollback de seguridad: si falla el insert en `pilot_expense_ledger`, se restaura el saldo anterior del piloto.
- Se agrega panel en `/profile?view=economia` para pagar pruebas teÃ³ricas, licencias, certificaciones, habilitaciones y entrenamiento desde la billetera virtual.
- Se muestran Ãºltimos gastos registrados en la vista de economÃ­a del piloto.

SQL asociado:
- Asegura `pilot_profiles.wallet_balance`.
- Asegura columnas de trazabilidad en `pilot_expense_ledger`: `balance_before_usd`, `balance_after_usd`, `status`, `reference_code`.
- Agrega Ã­ndices para consultas por piloto, categorÃ­a y fecha.

Pendiente futuro:
- Vincular cada compra con desbloqueo real de habilitaciones/certificaciones en el perfil del piloto.
- Definir reglas de vigencia y renovaciÃ³n automÃ¡tica para licencias recurrentes.

---

## 2026-04-26 â€” EconomÃ­a realista V4 / Flota, activos y crecimiento

Base tomada: EconomÃ­a Realista V3 aprobada con billetera y gastos reales del piloto.

Regla de trabajo:
- Mantener este archivo como log maestro acumulativo.
- No crear README nuevo por cada bloque.
- No tocar ACARS en este bloque.
- La economÃ­a de flota queda en Web/Supabase para que ACARS solo registre el vuelo y el servidor calcule.

Cambios de este bloque:
- Se agrega endpoint `src/app/api/economia/fleet-assets/route.ts` para calcular inversiÃ³n de flota, valor patrimonial, costo fijo mensual, costo tÃ©cnico por hora, poder de compra y reserva recomendada.
- El endpoint lee `aircraft_asset_values`, `aircraft_fleet`, `aircraft`, `airlines` y `airline_ledger` cuando existen, con fallback seguro al catÃ¡logo base si la flota aÃºn no estÃ¡ poblada o RLS bloquea datos.
- Se agrega panel visual en `/economia` llamado "Flota, inversiÃ³n y crecimiento".
- El panel explica que cada aeronave nueva debe comprarse con caja de la aerolÃ­nea y entregarse al hub asignado desde fÃ¡brica.
- Se muestra valor de flota, costo fijo mensual, poder de compra, reserva recomendada y top de tipos de aeronave por valor.
- Se prepara el modelo para futuras compras reales: `aircraft_purchase` en `airline_ledger` y tabla `aircraft_purchase_requests`.

SQL asociado:
- Asegura `aircraft_asset_values` con valores referenciales por tipo.
- Crea `aircraft_purchase_requests` para futuras compras/aprobaciones de aeronaves.
- Agrega Ã­ndices para lectura rÃ¡pida por estado, hub y tipo.

Pendiente futuro:
- Crear flujo UI/admin para comprar aeronaves y descontar caja real de la aerolÃ­nea.
- Conectar compra aprobada con creaciÃ³n real de aeronave en flota y traslado desde fÃ¡brica al hub.
- Calcular depreciaciÃ³n mensual si Claudio decide activarla mÃ¡s adelante.

---

## 2026-04-26 â€” EconomÃ­a realista V5 / Capacidades por aeronave, rango de catÃ¡logo y ventas a bordo

Base tomada: EconomÃ­a Realista V4 aprobada con flota, activos y crecimiento.

Regla de trabajo:
- Mantener este archivo como log maestro acumulativo.
- No crear README nuevo por bloque.
- No tocar ACARS salvo integraciÃ³n de cierre econÃ³mico server-side en `src/lib/acars-official.ts`.
- La economÃ­a previa usa estimaciones; la economÃ­a final del vuelo se recalcula al cierre con PIREP/OFP/ACARS cuando existan datos reales.

Cambios de este bloque:
- Se recalibra `src/lib/pilot-economy.ts` para que cada aeronave tenga capacidad y costos propios: asientos, carga belly/cargo, consumo estimado por NM, mantenciÃ³n por hora, handling, tasas y capacidad de servicio a bordo.
- Se agregan perfiles para C172, BE58, TBM9, C208, DHC6, B350, ATR, E175/E190, A319/A320/A321, B737/B738/B739/B38M, A330/A339, B787/B789 y B777/B77W.
- En catÃ¡logo de rutas, la economÃ­a ya no usa una sola aeronave: muestra rango desde la aeronave compatible mÃ¡s pequeÃ±a hasta la mÃ¡s grande.
- En itinerario, cuando el piloto elige aeronave, se mantiene estimaciÃ³n exacta para esa aeronave.
- En chÃ¡rter, la estimaciÃ³n se mantiene dinÃ¡mica segÃºn origen, destino y aeronave seleccionada.
- Se agregan ingresos por servicio a bordo para aeronaves con cabina comercial.
- Se agregan ventas a bordo / catÃ¡logo Patagonia Wings solo para vuelos internacionales con aeronaves que tengan servicio a bordo.
- Se agrega costo de servicio a bordo como costo operacional.
- El cierre econÃ³mico en `acars-official.ts` guarda ingresos/costos de servicio y ventas a bordo en `flight_reservations`, `flight_economy_snapshots` y `airline_ledger`.

SQL asociado:
- Agrega columnas econÃ³micas de servicio y ventas a bordo en `flight_reservations` y `flight_economy_snapshots`.
- Crea/actualiza tabla `aircraft_economy_profiles` para dejar trazable la capacidad y costo base por aeronave.
- Crea tabla `onboard_sales_catalog` para futuros productos de venta a bordo.
- Actualiza vista `pw_economy_monthly_metrics` incorporando ingresos/costos de servicio y ventas a bordo.

Pendiente futuro:
- Reemplazar estimaciones por datos reales de SimBrief/OFP cuando estÃ©n disponibles: PAX, cargo, payload, fuel plan y block time.
- Al cierre del vuelo, reemplazar fuel estimado por combustible real ACARS y daÃ±os reales por reporte de daÃ±o/desgaste.
- Crear UI de ventas a bordo detalladas si se decide simular productos por categorÃ­a.

---

## ActualizaciÃ³n 6 â€” Compatibilidad aeronave-ruta, combustible realista y comisiones piloto

**Objetivo:** corregir el rango econÃ³mico para que no use aeronaves incompatibles con la ruta, recalibrar el combustible por gasto real de ruta/aeropuerto de origen y ordenar las comisiones del piloto para que regional/nacional/internacional/long haul tengan jerarquÃ­a lÃ³gica.

### Cambios clave
- La economÃ­a deja de calcular rangos con aeronaves fuera de alcance prÃ¡ctico.
- El catÃ¡logo filtra aeronaves por `practicalRangeNm`, combustible utilizable, capacidad internacional y long haul.
- Long haul/intercontinental queda reservado a aeronaves `longHaulCapable`.
- Combustible estimado = consumo de ruta + taxi + contingencia + reserva, no estanque lleno.
- Precio de combustible se recalibra por aeropuerto/paÃ­s con valores mÃ¡s realistas.
- Las comisiones del piloto se calculan por banda de ruta: local, regional, nacional, internacional, long haul e intercontinental.
- Se eliminan multiplicadores excesivos de `CAREER/ITINERARY`; ahora la base regular usa multiplicador 1.00.
- Charter mantiene multiplicador superior; training/eventos se mantienen reducidos.
- Charter muestra advertencia si la aeronave seleccionada no es apta para la ruta.

### Regla vigente
Una ruta no puede calcular economÃ­a con una aeronave que no puede operarla. El catÃ¡logo muestra rangos solo entre aeronaves compatibles reales. Itinerario y Charter calculan exacto segÃºn aeronave seleccionada. El combustible se calcula por consumo de ruta y precio JetA1 del aeropuerto de origen, con fallback por paÃ­s.

### SQL relacionado
- `aircraft_economy_profiles`: agregar `practical_range_nm`, `usable_fuel_capacity_kg`, `runway_requirement_m`, `international_capable`, `long_haul_capable`.
- `fuel_price_index`: recalibrar precios JetA1 por aeropuerto/paÃ­s.
- `pilot_pay_rules`: tabla opcional/configurable para comisiones por banda de ruta.

---

## ActualizaciÃ³n 7 â€” EstabilizaciÃ³n de Traslados en Central / Dashboard

**Objetivo:** corregir el parpadeo del mÃ³dulo de traslados en el dashboard, donde el bloque aparecÃ­a, quedaba sin datos y volvÃ­a a desaparecer/reaparecer por recargas sucesivas.

### Cambios clave
- Se estabiliza `CentralTransfersSectionWrapper` usando callbacks memorizados con `useCallback`.
- Se evita que `CentralTransfersSectionControlled` dispare consultas repetidas por cambios de identidad en `onEmpty` / `onHasContent`.
- El divisor y el mÃ³dulo de traslados solo se renderizan cuando existen destinos reales o una acciÃ³n confirmada.
- Mientras el endpoint estÃ¡ cargando o retorna cero opciones, el mÃ³dulo se mantiene oculto para evitar parpadeos visuales.
- Si no hay traslados disponibles, no se muestran tarjetas vacÃ­as ni el bloque temporal "Calculando alternativas".

### Regla vigente
El mÃ³dulo de traslados debe mostrarse solo cuando existan datos accionables. Si no existen opciones desde la ubicaciÃ³n actual del piloto, el bloque queda oculto de forma estable, sin aparecer/desaparecer a cada recarga del dashboard.

### Archivos modificados
- `src/app/dashboard/page.tsx`

### SQL relacionado
- No requiere SQL.

### Pendiente futuro
- Si vuelve a existir intermitencia, revisar `/api/pilot/transfer` y confirmar que la respuesta sea determinÃ­stica para el mismo piloto/aeropuerto, especialmente bajo RLS o cambios de sesiÃ³n.


---

## ActualizaciÃ³n 8 â€” ConsolidaciÃ³n tÃ©cnica de base V7

**Objetivo:** reunir en un solo paquete de archivos finales las modificaciones aprobadas desde EconomÃ­a visible hasta la estabilizaciÃ³n de traslados, evitando bajar mÃºltiples ZIP por bloque y dejando una base de trabajo clara para el siguiente bloque.

### Base consolidada incluida
- EconomÃ­a visible en Oficina, CatÃ¡logo, Itinerario y Charter.
- EconomÃ­a Realista V1: combustible por paÃ­s/aeropuerto, snapshots, ledger y mÃ©tricas base.
- V2: catÃ¡logo de gastos del piloto, licencias, habilitaciones y pruebas teÃ³ricas.
- V3: billetera del piloto, descuento real y `pilot_expense_ledger`.
- V4: flota, activos, valor de aeronaves e inversiÃ³n.
- V5: capacidades por aeronave, servicio a bordo y ventas a bordo.
- V6: compatibilidad aeronave-ruta, rango/autonomÃ­a, combustible realista y comisiones por banda.
- V7: estabilidad del mÃ³dulo de traslados en Dashboard/Central.

### Regla vigente
Este archivo `docs/MASTER_CHANGELOG.md` es el log maestro Ãºnico. Cada bloque futuro debe agregar una nueva secciÃ³n aquÃ­, conservando todo lo anterior. No crear README separados por bloque.

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
No se agrega SQL nuevo en esta consolidaciÃ³n. Los SQL V1â€“V7 ya fueron entregados/aplicados por separado cuando correspondÃ­a.

### PrÃ³ximo bloque recomendado
Bloque 8 â€” Filtro maestro piloto/ruta/aeronave, aplicando el orden:
piloto conectado â†’ ubicaciÃ³n actual â†’ ruta â†’ aeronave disponible â†’ autonomÃ­a/rango â†’ combustible Ãºtil â†’ habilitaciones â†’ economÃ­a.


---

## ActualizaciÃ³n 9 â€” Cierre econÃ³mico real idempotente

**Objetivo:** fortalecer el cierre ACARS/PIREP para que la economÃ­a final del vuelo sea real, trazable e idempotente.

**Cambios principales:**
- `src/lib/acars-official.ts` ahora evita duplicar horas, billetera y nÃ³mina si un cierre se reintenta.
- `flight_economy_snapshots` se actualiza por `reservation_id` en vez de crear registros duplicados.
- `airline_ledger` reemplaza los movimientos del mismo `reservation_id` antes de reinsertar el cierre econÃ³mico final.
- La caja de aerolÃ­nea se recalcula desde el ledger completo con `pw_recalculate_airline_balance` si existe, o fallback server-side.
- `score_payload.economy_accounting` guarda marca de aplicaciÃ³n econÃ³mica para trazabilidad.
- Se mantiene la regla: ACARS registra y envÃ­a; Web/Supabase evalÃºa, calcula economÃ­a y persiste mÃ©tricas.

**ValidaciÃ³n sugerida:**
1. Ejecutar SQL del bloque para crear funciÃ³n `pw_recalculate_airline_balance`.
2. Cerrar un vuelo de prueba.
3. Reenviar el mismo PIREP o repetir finalize.
4. Confirmar que no se duplican `airline_ledger`, `flight_economy_snapshots`, horas, billetera ni nÃ³mina.
5. Ejecutar `npx tsc --noEmit` y `npm run build`.

---

## ActualizaciÃ³n 10 â€” SimBrief/OFP econÃ³mico planificado

**Objetivo:** dejar la economÃ­a planificada por OFP como etapa intermedia entre la estimaciÃ³n previa y el cierre real ACARS.

**Cambios principales:**
- `src/lib/pilot-economy.ts`: agrega `estimateSimbriefFlightEconomy()` y `resolveSimbriefPlannedFuelKg()` para usar pax, carga, combustible y block time importados desde SimBrief.
- `src/lib/flight-ops.ts`: al finalizar despacho con OFP, guarda economÃ­a planificada en `flight_reservations` y crea snapshot `flight_economy_snapshots` con `economy_source='simbrief'`.
- `src/app/dashboard/page.tsx`: muestra panel â€œEconomÃ­a planificada OFPâ€� con pago piloto, pax, carga, combustible OFP, ingresos, costos, servicio/ventas y utilidad.

**Regla operativa:**
- Sin OFP: se muestra estimaciÃ³n operacional.
- Con OFP: la planificaciÃ³n usa datos de SimBrief.
- Al cierre ACARS: el servidor recalcula economÃ­a final real con PIREP/telemetrÃ­a.

**SQL:** sin SQL nuevo; usa columnas ya creadas en los bloques V1â€“V9.

**ValidaciÃ³n sugerida:** importar OFP en despacho, confirmar panel econÃ³mico OFP y revisar `flight_economy_snapshots` con `economy_source='simbrief'`.

---

## ActualizaciÃ³n 11 â€” Compra real de aeronaves y crecimiento de flota

**Objetivo:** permitir que la aerolÃ­nea crezca comprando aeronaves con su caja operacional, dejando trazabilidad en ledger y ubicando la aeronave en el hub asignado.

### Cambios principales
- `src/app/api/economia/aircraft-purchase/route.ts`: nuevo endpoint para listar opciones de compra y registrar compras reales.
- La compra valida caja disponible, calcula matrÃ­cula por paÃ­s/hub (`CC-PWG`, `LV-PWG`, etc.), crea solicitud en `aircraft_purchase_requests`, descuenta `airline_ledger` con `entry_type='aircraft_purchase'`, crea registros en `aircraft_fleet` y `aircraft`, inicializa `aircraft_condition` y recalcula la caja de aerolÃ­nea.
- `src/app/api/economia/fleet-assets/route.ts`: agrega `purchaseOptions`, poder de compra, brecha de reserva y opciones sugeridas.
- `src/app/economia/page.tsx`: agrega panel â€œCrecimiento real de flotaâ€� con caja disponible, poder de compra, opciones recomendadas y formulario para registrar compra por aeronave, hub destino y cantidad.

### Regla vigente
Las aeronaves nuevas no aparecen gratis: se compran con caja de la aerolÃ­nea, se registran en `airline_ledger`, se genera matrÃ­cula PWG segÃºn paÃ­s del hub y quedan ubicadas en el hub asignado. Cada compra debe respetar reserva operacional antes de comprometer caja.

### SQL relacionado
Requiere asegurar `aircraft_purchase_requests`, `airline_ledger`, columnas de `airlines`, valores de `aircraft_asset_values` y funciÃ³n opcional `pw_recalculate_airline_balance`.

### ValidaciÃ³n sugerida
1. Ejecutar SQL del Bloque 11.
2. Abrir `/economia` y revisar el panel â€œCrecimiento real de flotaâ€�.
3. Comprar una aeronave pequeÃ±a con caja suficiente hacia un hub de prueba.
4. Validar `airline_ledger`, `aircraft_purchase_requests`, `aircraft_fleet`, `aircraft`, `aircraft_condition` y balance de aerolÃ­nea.
5. Ejecutar `npx tsc --noEmit` y `npm run build`.

---

## ActualizaciÃ³n 12 â€” EconomÃ­a explicativa alineada a V6/V11

**Motivo:** la pÃ¡gina `/economia` conservaba textos antiguos de comisiones y multiplicadores (`CAREER Ã—1.5`, tope USD 500, fÃ³rmula base anterior), lo que no coincide con la economÃ­a realista actual.

**Cambios:**
- Se actualizÃ³ la explicaciÃ³n de pago piloto por banda de ruta, block time, distancia, aeronave y operaciÃ³n.
- Se agregÃ³ explicaciÃ³n clara de combustible por ruta/aeropuerto, no por estanque lleno.
- Se reforzÃ³ el filtro maestro piloto/ruta/aeronave y autonomÃ­a real.
- Se dejÃ³ visible el criterio de compra de flota solo por direcciÃ³n/owner.
- Se agregÃ³ secciÃ³n de costos fijos mensuales de aerolÃ­nea como preparaciÃ³n para el prÃ³ximo bloque.
- Se actualizÃ³ la tabla de ejemplos de comisiÃ³n para local, regional, nacional, internacional, long haul e intercontinental.

**Alcance:** solo documentaciÃ³n/UI de `/economia` y changelog maestro. No modifica ACARS, PIREP, ledger ni SQL.

**ValidaciÃ³n sugerida:** `npx tsc --noEmit`, `npm run build`, abrir `/economia` y confirmar que ya no aparecen textos antiguos de comisiÃ³n.

---

## ActualizaciÃ³n 13 â€” Conteo real de flota y auditorÃ­a de tipos

**Motivo:** el panel de flota podÃ­a mostrar `1000` aeronaves porque la API leÃ­a `aircraft_fleet` y `aircraft` con `limit(1000)`. Ese valor no era una mÃ©trica confiable si la base tenÃ­a mÃ¡s registros o si existÃ­an duplicados entre tablas. AdemÃ¡s, Claudio indicÃ³ que los tipos deberÃ­an ser 33 y era necesario validar contra la base real.

**Cambios principales:**
- `src/app/api/economia/fleet-assets/route.ts`: reemplaza lecturas con lÃ­mite por paginaciÃ³n completa de Supabase.
- Agrega conteos exactos con `count: 'exact'` para `aircraft_fleet`, `aircraft`, `aircraft_types` y `aircraft_economy_profiles`.
- Deduplica flota por matrÃ­cula cuando la misma aeronave aparece en `aircraft_fleet` y `aircraft`.
- Expone auditorÃ­a de tipos: tipos reales en flota, tipos del catÃ¡logo `aircraft_types`, perfiles econÃ³micos, valores patrimoniales faltantes y duplicados detectados.
- `src/app/economia/page.tsx`: muestra mÃ©tricas de fuente real Supabase, tipos BD esperados/actuales, registros por tabla, duplicados y advertencias si faltan perfiles/valores.
- Se conserva la regla de compra de aeronaves solo para owner/direcciÃ³n; usuarios normales ven explicaciÃ³n y opciones, pero no formulario de compra.

**Regla vigente:** la mÃ©trica principal de aeronaves debe venir de Supabase con paginaciÃ³n completa y deduplicaciÃ³n por matrÃ­cula. La pantalla debe distinguir entre flota operacional real, filas brutas de tablas, catÃ¡logo de tipos y perfiles econÃ³micos. No se debe usar `limit(1000)` como total de flota.

**SQL:** sin SQL nuevo. La revisiÃ³n usa tablas existentes: `aircraft_fleet`, `aircraft`, `aircraft_types`, `aircraft_economy_profiles`, `aircraft_asset_values`.

**ValidaciÃ³n sugerida:** abrir `/economia`, revisar que la fuente diga â€œBase real Supabaseâ€�, confirmar conteo real de aeronaves, tipos BD `33/33` si la tabla `aircraft_types` estÃ¡ completa, y ejecutar `npx tsc --noEmit` + `npm run build`.

---

## ActualizaciÃ³n 14 â€” Costos fijos mensuales y cierre operacional

**Objetivo:** comenzar la operaciÃ³n mensual real de la aerolÃ­nea, separando los costos fijos de los costos por vuelo.

### Cambios clave
- Se agrega endpoint `src/app/api/economia/monthly-fixed-costs/route.ts`.
- El endpoint calcula costos mensuales de staff, hubs, flota, seguros, sistemas, administraciÃ³n y reserva tÃ©cnica.
- El cÃ¡lculo usa flota real deduplicada, valores patrimoniales de `aircraft_asset_values`, hubs y caja de `airlines`.
- Se agrega panel visual en `/economia` para explicar costos fijos mensuales, reserva recomendada y caja post cierre.
- Los pilotos pueden ver la explicaciÃ³n; solo owner/direcciÃ³n puede aplicar el cargo mensual.
- Al aplicar cierre, se registran movimientos separados en `airline_ledger` y se recalcula la caja con `pw_recalculate_airline_balance`.
- El cierre es idempotente por aerolÃ­nea/aÃ±o/mes mediante `airline_monthly_closures`.

### Regla vigente
Los vuelos generan ingresos y costos variables; los costos fijos mensuales representan operar la empresa completa. El balance de aerolÃ­nea debe poder reconstruirse desde `airline_ledger`.

### SQL asociado
- Crear `airline_monthly_closures`.
- Asegurar Ã­ndices por aerolÃ­nea, perÃ­odo y estado.
- Reutilizar `airline_ledger` para movimientos mensuales separados.

### Pendiente futuro
- Mostrar histÃ³rico anual de cierres mensuales en el dashboard financiero final.
- Incorporar depreciaciÃ³n formal si Claudio decide activarla.

---

## ActualizaciÃ³n 15 â€” Dashboard financiero histÃ³rico y mÃ©tricas consolidadas

**Objetivo:** convertir `/economia` en un centro de mÃ©tricas histÃ³ricas para revisar operaciÃ³n acumulada sin depender de mÃºltiples consultas visuales dispersas.

### Cambios clave
- Se agrega endpoint `src/app/api/economia/metrics/route.ts`.
- El endpoint consolida datos desde `pw_economy_monthly_metrics`, `flight_economy_snapshots`, `airline_ledger`, `pilot_salary_ledger` y `pilot_expense_ledger`.
- Se agrega panel â€œOperaciÃ³n acumulada Patagonia Wingsâ€� en `/economia`.
- El panel muestra vuelos, pasajeros trasladados, carga, combustible, distancia, horas, ingresos y utilidad.
- Se agrega grÃ¡fico mensual de ingresos, costos y utilidad.
- Se agregan listas de rutas mÃ¡s rentables, rutas con pÃ©rdida, aeronaves productivas, pilotos productivos y gastos de pilotos.
- La secciÃ³n tiene estado vacÃ­o elegante si todavÃ­a no hay cierres ACARS/snapshots.

### Regla vigente
Las mÃ©tricas histÃ³ricas deben leerse desde endpoints server-side y vistas agregadas para evitar parpadeos de datos en la UI. La pÃ¡gina `/economia` debe distinguir entre estimaciones, cierres reales, ledger y snapshots.

### SQL asociado
No requiere SQL nuevo. Usa las tablas y vista creadas en los bloques anteriores:
- `pw_economy_monthly_metrics`
- `flight_economy_snapshots`
- `airline_ledger`
- `pilot_salary_ledger`
- `pilot_expense_ledger`

### ValidaciÃ³n sugerida
Ejecutar `npx tsc --noEmit`, `npm run build`, abrir `/economia` y confirmar que el panel de mÃ©tricas histÃ³ricas carga sin ocultar la pÃ¡gina aunque aÃºn no existan vuelos cerrados.

---

## ActualizaciÃ³n 16 â€” LiquidaciÃ³n mensual real del piloto y PDF definitivo

**Objetivo:** cerrar el flujo de sueldos del piloto con liquidaciÃ³n mensual trazable, descuentos, gastos, historial y documento PDF descargable.

### Cambios principales
- `src/app/api/pilot/salary/monthly/route.ts`: amplÃ­a la liquidaciÃ³n mensual con horas bloque, gastos del piloto desde `pilot_expense_ledger`, historial de liquidaciones, comisiones, sueldo base, daÃ±o/descuentos, bruto y neto.
- `src/app/api/pilot/salary/monthly/pdf/route.ts`: nuevo endpoint que genera un PDF real descargable (`application/pdf`) con el resumen mensual del piloto, vuelos del perÃ­odo y gastos/descuentos.
- `src/app/profile/page.tsx`: la pestaÃ±a `Mi economÃ­a` muestra horas bloque, gastos piloto, historial mensual y usa el endpoint PDF real en lugar de una ventana HTML/print.
- La liquidaciÃ³n considera: vuelos completados, horas, comisiones, sueldo base, descuentos por daÃ±o, gastos del piloto, neto del perÃ­odo, estado pagado/pendiente y Ãºltimos vuelos.

### Regla vigente
La liquidaciÃ³n mensual del piloto debe tomar datos reales de Supabase. Los gastos personales del piloto (traslados, pruebas teÃ³ricas, licencias, habilitaciones, entrenamiento) se descuentan del cÃ¡lculo mensual y quedan trazables en `pilot_expense_ledger`. El PDF se genera desde servidor para evitar depender de `window.print()`.

### SQL asociado
Requiere asegurar columnas adicionales en `pilot_salary_ledger` para `expenses_total_usd` y `gross_total_usd`, ademÃ¡s de `block_hours_total` y `pilot_callsign` si faltan. El SQL se entrega separado en el chat, no dentro del ZIP.

### ValidaciÃ³n sugerida
1. Ejecutar SQL del Bloque 16.
2. Abrir `/profile?view=economia`.
3. Confirmar que aparezcan saldo, vuelos, horas, comisiones, gastos, deducciones, neto e historial mensual.
4. Presionar `Descargar PDF` y confirmar archivo `.pdf` descargado.
5. Ejecutar `npx tsc --noEmit` y `npm run build`.

---

## Fix urgente â€” TypeScript posterior a Bloque 17

**Fecha:** 2026-04-27

**Motivo:** al compilar despuÃ©s del Bloque 17 aparecieron errores TypeScript en mÃ©tricas econÃ³micas, costos fijos mensuales y Dashboard.

**Cambios:**
- `src/app/api/economia/metrics/route.ts`: casting seguro `unknown as AnyRow[]` para respuestas genÃ©ricas de Supabase.
- `src/app/api/economia/monthly-fixed-costs/route.ts`: casting seguro `unknown as AnyRow[]` en paginaciÃ³n.
- `src/app/dashboard/page.tsx`: `buildNewsItems` vuelve a aceptar argumentos opcionales sin reintroducir tarjetas estÃ¡ticas.
- `src/app/dashboard/page.tsx`: llamada antigua a `buildEconomyEstimate(distance, aircraft, mode)` actualizada al formato vigente por objeto, incluyendo origen/destino y paÃ­s.

**Alcance:** fix mÃ­nimo de compilaciÃ³n. No cambia diseÃ±o, PIREP, ACARS, SimBrief ni reglas econÃ³micas.

**ValidaciÃ³n sugerida:** `npx tsc --noEmit` y `npm run build`.

---

## Fix urgente â€” Dashboard economÃ­a itinerario operationCategory

**Motivo:** el build fallaba en `src/app/dashboard/page.tsx` porque se pasaba un objeto `AvailableItineraryOption` a `normalizeItineraryRouteCategory`, funciÃ³n que espera string.

**Cambio:** se usa `getItineraryRouteCategory(row)`, que extrae correctamente la categorÃ­a desde `route_category`, `service_profile`, `route_group`, `service_level` o `flight_mode`.

**Alcance:** fix mÃ­nimo; no cambia diseÃ±o, ACARS, PIREP, economÃ­a base ni flujo SimBrief.

**ValidaciÃ³n sugerida:** ejecutar `npx tsc --noEmit` y `npm run build`.


---

## Fix urgente â€” SimBrief Invalid API Key / modo seguro de dispatch

**Motivo:** SimBrief mostraba `Fatal Exception: Invalid API key` al abrir el generador desde Patagonia Wings. Las URLs de callback Navigraph son para OAuth y no reemplazan la `SIMBRIEF_API_KEY` propia del API antiguo de SimBrief.

**Cambio:** `src/lib/simbrief.ts` y `src/app/api/simbrief/dispatch/route.ts` ahora soportan dos modos:

- `redirect` seguro por defecto: abre `https://dispatch.simbrief.com/options/custom` con origen, destino, tipo, vuelo, matrÃ­cula, pax/carga y `static_id` prellenados, sin usar API key. Evita el error de API key invÃ¡lida.
- `api`: usa `ofp.loader.api.php` solo si `SIMBRIEF_GENERATION_MODE=api` y existe una `SIMBRIEF_API_KEY` vÃ¡lida.

**Regla:** las callbacks Navigraph autorizadas se mantienen para OAuth, pero no deben usarse como API key de SimBrief.

**ValidaciÃ³n sugerida:** abrir Despacho â†’ Generar OFP SimBrief. Debe abrir SimBrief con datos prellenados sin mostrar `Invalid API key`. Luego generar el OFP en SimBrief y cargarlo desde Patagonia Wings por `static_id`.


---

## Fix urgente â€” Export compatible `buildSimbriefRedirectUrl`

**Motivo:** el build de Vercel fallaba porque `src/app/dashboard/page.tsx` importaba `buildSimbriefRedirectUrl` desde `@/lib/simbrief`, pero el helper final disponible se llamaba `buildSimbriefDispatchPrefillUrl`.

**Cambio:** `src/lib/simbrief.ts` exporta `buildSimbriefRedirectUrl` como alias compatible de `buildSimbriefDispatchPrefillUrl`, manteniendo intacto el modo seguro `redirect` y el modo `api` con `SIMBRIEF_API_KEY` real.

**Alcance:** fix mÃ­nimo de compatibilidad TypeScript. No cambia UI, ACARS, PIREP, economÃ­a ni SQL.

**ValidaciÃ³n sugerida:** ejecutar `npx tsc --noEmit` y `npm run build`. En Vercel no debe volver a aparecer `has no exported member named 'buildSimbriefRedirectUrl'`.

---

## ActualizaciÃ³n 17C â€” SimBrief API real con popup de generaciÃ³n y flight number numÃ©rico

**Motivo:** al activar la API de SimBrief, el flujo no debe abrir la pantalla completa de ediciÃ³n como si el piloto tuviera que crear el vuelo manualmente. AdemÃ¡s, SimBrief debe recibir `airline=PWG` y `fltnum` solo numÃ©rico, no `PWG1301`.

**Cambios:**
- `src/lib/simbrief.ts`: agrega `normalizeSimbriefFlightNumber()` y aplica `fltnum` numÃ©rico en URLs API/redirect.
- `src/app/api/simbrief/dispatch/route.ts`: usa `outputpage` interno de Patagonia Wings y responde modo API/redirect de forma explÃ­cita.
- `src/app/api/simbrief/return/route.ts`: nueva ruta de retorno para cerrar la ventana de generaciÃ³n y notificar al Dashboard.
- `src/app/dashboard/page.tsx`: muestra cuadro â€œGenerando OFP SimBrief...â€�, abre popup pequeÃ±o cuando `SIMBRIEF_GENERATION_MODE=api`, escucha retorno automÃ¡tico y carga el OFP por `static_id`.

**Regla:**
- Con API key real: `SIMBRIEF_GENERATION_MODE=api` abre una ventana pequeÃ±a de generaciÃ³n SimBrief, no la pantalla completa de ediciÃ³n.
- Sin API key: se mantiene fallback seguro `redirect` con datos prellenados.
- El nÃºmero de vuelo enviado a SimBrief queda separado: `airline=PWG` + `fltnum=1301`.

**ValidaciÃ³n sugerida:** `npx tsc --noEmit`, `npm run build`, probar â€œGenerar OFP SimBriefâ€� y verificar que la URL use `fltnum=1301`, no `fltnum=PWG1301`.
---

## ActualizaciÃ³n 17C â€” Modal oficial SimBrief seguro

**Objetivo:** dejar el flujo SimBrief integrado sin iframe ni automatizaciÃ³n insegura del DOM externo.

**Cambios:**
- SimBrief se abre como ventana/popup oficial prellenada desde Patagonia Wings cuando se usa modo redirect.
- Patagonia Wings mantiene un estado visual de espera mientras el piloto genera el OFP en SimBrief.
- Al cerrar la ventana, la UI indica cargar el OFP automÃ¡tico con `static_id`.
- El modo API queda preparado para cuando exista una SimBrief API Key real de generaciÃ³n.
- `outputpage` usa `SIMBRIEF_RETURN_BASE_URL`, luego `NEXT_PUBLIC_APP_URL`, y solo como Ãºltimo recurso el origen de la request.

**Regla:** no se usa iframe ni scripts para presionar botones dentro de SimBrief. El piloto debe generar el OFP dentro de SimBrief salvo que exista una API Key de generaciÃ³n vÃ¡lida.

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

## ActualizaciÃ³n 17D â€” IntegraciÃ³n Navigraph/SimBrief movida a portada pÃºblica

**Objetivo:** sacar la vitrina de partners del dashboard y llevar la comunicaciÃ³n de integraciÃ³n a la pÃ¡gina de inicio pÃºblica, antes del login, con mejor presencia visual y mensaje operacional claro.

**Cambios:**
- `src/app/page.tsx`
  - se rehizo el hero pÃºblico con logo grande de Patagonia Wings, tÃ­tulo/slogan mÃ¡s potentes y mejor presencia visual.
  - se agregaron logos transparentes de Navigraph y SimBrief en la portada, integrados al hero y a una secciÃ³n pÃºblica nueva de integraciÃ³n.
  - se aÃ±adiÃ³ secciÃ³n `#integraciones` explicando que Patagonia Wings estÃ¡ integrada con Navigraph y SimBrief.
  - se dejÃ³ explÃ­cito que para usar el flujo completo se requiere suscripciÃ³n activa de Navigraph.
  - se dejÃ³ explÃ­cito que el usuario debe registrar su usuario Navigraph / SimBrief al crear su cuenta.
- `src/app/dashboard/page.tsx`
  - se dejÃ³ de renderizar la vitrina `DashboardPartnersShowcase`, eliminando esa comunicaciÃ³n del dashboard privado.
- `src/app/register/page.tsx`
  - se agregÃ³ campo opcional `Usuario Navigraph / SimBrief` en el registro.
  - ese valor se guarda en metadata como `simbrief_username` para que luego el perfil piloto y el despacho puedan reutilizarlo.
  - se actualizÃ³ el panel visual del registro para remarcar la integraciÃ³n `Navigraph + SimBrief`.

**Regla funcional:**
- La integraciÃ³n se comunica ahora desde la portada pÃºblica.
- El dashboard ya no muestra esa secciÃ³n de publicidad/integraciones.
- El registro ya permite dejar el usuario que alimentarÃ¡ el flujo OFP/dispatch.

**SQL:** no requiere.

**ValidaciÃ³n sugerida:**
1. abrir `/` y verificar hero nuevo + logos Navigraph/SimBrief + secciÃ³n pÃºblica de integraciÃ³n.
2. abrir `/dashboard` y confirmar que ya no aparece la vitrina de partners.
3. abrir `/register` y confirmar el nuevo campo `Usuario Navigraph / SimBrief`.
4. ejecutar `npx tsc --noEmit` y `npm run build`.

### Ajuste visual 17D.1 â€” Hero rehecho estilo referencia
- Se rehÃ­zo nuevamente el hero de `src/app/page.tsx` para acercarlo mucho mÃ¡s a la primera referencia aprobada.
- Se eliminÃ³ el look anterior tipo bloque/chips pequeÃ±os y se reemplazÃ³ por una composiciÃ³n hero mÃ¡s limpia y editorial:
  - isotipo Patagonia Wings grande a la izquierda,
  - tÃ­tulo grande â€œPatagonia Wingsâ€�,
  - slogan destacado,
  - logos Navigraph y SimBrief integrados sin recuadros,
  - mensajes de suscripciÃ³n/usuario con Ã­conos circulares,
  - CTA principal â€œComienza tu viajeâ€�.
- `HomeStatsBar` se moviÃ³ fuera del hero para que la cabecera no se vea comprimida.

---

## ActualizaciÃ³n 17E â€” CorrecciÃ³n visual hero portada estilo referencia

**Objetivo:** corregir el primer rediseÃ±o de portada porque quedÃ³ demasiado centrado, pequeÃ±o y visualmente dÃ©bil. Se ajusta el hero para acercarlo a la referencia aprobada: logo grande, tÃ­tulo elegante, slogan protagonista e integraciÃ³n Navigraph/SimBrief limpia sin recuadros.

**Cambios:**
- `src/app/page.tsx`
  - se reorganizÃ³ el hero para que el contenido vuelva a sentirse grande, premium y hacia el lado izquierdo.
  - se aumentÃ³ el logo principal de Patagonia Wings junto al tÃ­tulo.
  - se cambiÃ³ el tÃ­tulo a estilo serif/elegante y de mayor tamaÃ±o.
  - se recuperÃ³ un slogan visible tipo referencia: `Tu conexiÃ³n aÃ©rea en la Patagonia`.
  - se reemplazaron los logos en recuadros por una marca limpia construida en la UI: `Navigraph | SimBrief`, sin cajas pesadas ni fondos negros.
  - se moviÃ³ la barra de estadÃ­sticas fuera del primer fold para no ensuciar la portada principal.
  - se mantuvo la secciÃ³n pÃºblica de integraciÃ³n y el texto de requisito de suscripciÃ³n Navigraph.

**Regla visual:**
- La portada debe sentirse mÃ¡s como la referencia visual premium, no como un bloque pequeÃ±o centrado.
- Los logos de integraciÃ³n deben verse limpios, sin recuadro pesado ni imagen con fondo.

**SQL:** no requiere.

---

## ActualizaciÃ³n 17F â€” Hero pÃºblico premium con logos oficiales Navigraph / SimBrief

**Objetivo:** corregir la portada pÃºblica para dejarla mucho mÃ¡s cercana a la referencia aprobada, evitando un layout cargado y respetando los logos oficiales de Navigraph y SimBrief sin redibujarlos.

**Cambios:**
- `src/app/page.tsx`
  - se rehÃ­zo el hero pÃºblico completo para darle una composiciÃ³n mÃ¡s limpia, grande y equilibrada en formato landscape.
  - se eliminÃ³ el pseudo-logo dibujado de Navigraph y se reemplazÃ³ por los archivos oficiales reales desde `public/partners/navigraph.png` y `public/branding/Navigraph Logos/simbrief-75dpi-horizontal.png`.
  - se reorganizÃ³ el contenido en un bloque premium mÃ¡s amplio, con mejor jerarquÃ­a visual, logo Patagonia Wings protagonista, tÃ­tulo mÃ¡s grande y mejor distribuciÃ³n del espacio.
  - se simplificÃ³ el mensaje del hero con dos tarjetas informativas en vez de varias lÃ­neas apretadas e iconografÃ­a recargada.
  - se mantuvo la secciÃ³n pÃºblica de integraciÃ³n antes del login, pero con apoyo visual mÃ¡s limpio.
- `src/app/globals.css`
  - se ajustÃ³ el fondo del hero para usar una versiÃ³n mÃ¡s premium (`home-hero-4k.jpg`) con nueva gradiente y mejor balance para pantallas anchas.
- `docs/MASTER_CHANGELOG.md`
  - se agregÃ³ el registro acumulativo de esta iteraciÃ³n.

**Regla aplicada:**
- No se modifican ni reinterpretan los logos oficiales de SimBrief o Navigraph; solo se usan sus assets oficiales y se ajustan tamaÃ±os/composiciÃ³n.

**SQL:** no requiere.

**ValidaciÃ³n sugerida:**
1. abrir `/` y revisar el hero en pantalla completa desktop.
2. verificar que los logos mostrados sean los oficiales.
3. confirmar que el contenido ya no se vea pequeÃ±o ni amontonado al lado izquierdo.
4. ejecutar `npx tsc --noEmit` y `npm run build`.

---

## ActualizaciÃ³n 17G â€” Cuadro de integraciÃ³n mÃ¡s grande con logos subidos por Claudio

**Objetivo:** agrandar el cuadro de integraciÃ³n del hero y usar los logos correctos subidos por Claudio para Navigraph y SimBrief.

**Cambios:**
- `src/app/page.tsx`
  - se reemplazÃ³ el bloque anterior del hero por un cuadro de integraciÃ³n mÃ¡s grande y mejor proporcionado.
  - se usaron los logos oficiales subidos por Claudio para `Navigraph` y `SimBrief by Navigraph`.
  - se reorganizÃ³ el cuadro con dos bloques de logos mÃ¡s visibles y textos descriptivos debajo.
  - se mantuvieron los puntos de â€œSuscripciÃ³n requeridaâ€� y â€œUsuario vinculadoâ€�, ahora con mejor lectura.
- `public/partners/navigraph-official-horizontal.png`
  - nuevo asset oficial subido por Claudio.
- `public/partners/simbrief-by-navigraph-official.png`
  - nuevo asset oficial subido por Claudio.
- `docs/MASTER_CHANGELOG.md`
  - se agregÃ³ esta actualizaciÃ³n al log maestro.

**SQL:** no requiere.

---

## ActualizaciÃ³n 17H â€” Hero sin recuadros + bloque paralelo limpio + logo menÃº solo Ã­cono

**Objetivo:** dejar el hero mÃ¡s limpio y elegante, moviendo la integraciÃ³n en paralelo al tÃ­tulo principal, sin recuadros, con logos mÃ¡s grandes y simplificando el logo del menÃº superior.

**Cambios:**
- `src/app/page.tsx`
  - se eliminÃ³ el logo Patagonia Wings que aparecÃ­a dentro del contenido del hero.
  - se reorganizÃ³ el hero en dos columnas: a la izquierda el tÃ­tulo principal y a la derecha la integraciÃ³n oficial.
  - se eliminÃ³ el cuadro/contenedor del bloque de integraciÃ³n para que todo quede directamente sobre el fondo del hero.
  - se quitaron los recuadros internos de los logos y se dejaron los logos oficiales mucho mÃ¡s grandes y visibles.
  - se mantuvieron los textos clave de Navigraph / SimBrief, suscripciÃ³n requerida y usuario vinculado, pero en un layout mÃ¡s limpio.
- `src/components/site/PublicHeader.tsx`
  - se agrandÃ³ el logo del menÃº superior.
  - se eliminaron las letras del branding del header, dejando solo el Ã­cono de Patagonia Wings.
- `docs/MASTER_CHANGELOG.md`
  - se agregÃ³ esta actualizaciÃ³n al log maestro.

**SQL:** no requiere.

---

## ActualizaciÃ³n 17I â€” Responsive global anti-zoom-out

**Objetivo:** evitar que la web se vea excesivamente pequeÃ±a, centrada y perdida cuando el navegador estÃ¡ con zoom out o cuando se abre en viewports/monitores ultra-wide.

**Cambios:**
- `src/app/globals.css`
  - se agregaron reglas globales progresivas para viewports anchos (`1680px`, `2200px`, `2800px`).
  - se escala el `font-size` base de forma controlada en pantallas muy anchas.
  - se amplÃ­a `.pw-container` para usar mejor el ancho disponible.
  - se refuerza el tamaÃ±o del header pÃºblico, logo, navegaciÃ³n y acciones.
  - se agregan reglas especÃ­ficas del hero para que tÃ­tulo, slogan, bloque de integraciÃ³n y logos no queden microscÃ³picos.
  - se agregan reglas generales para contenedores privados grandes dentro de `.grid-overlay`.
- `src/app/page.tsx`
  - se agregaron clases semÃ¡nticas al hero (`home-hero-grid`, `home-hero-title`, `home-integration-card`, etc.) para controlar el escalado sin hacks ni zoom forzado.
- `src/components/site/PublicHeader.tsx`
  - se agregaron clases semÃ¡nticas al header pÃºblico (`public-site-header`, `public-header-logo`, `public-header-nav`, `public-header-actions`) para permitir escalado responsive global.

**Regla aplicada:**
- No se bloquea el zoom del navegador.
- No se usa `body zoom` ni `transform scale` global.
- La soluciÃ³n respeta accesibilidad y compensa viewports enormes con reglas responsive.

**SQL:** no requiere.

**ValidaciÃ³n sugerida:**
1. abrir `/` en zoom 100%, 80%, 67% y 50%.
2. verificar que el hero, logos y header no queden microscÃ³picos.
3. revisar dashboard y pÃ¡ginas principales para confirmar que los contenedores usen mejor el ancho.
4. ejecutar `npx tsc --noEmit` y `npm run build`.

---

## Bloque 17M â€” Imagen real en cuadro de comunidad / nosotros

**Base oficial respetada:** `public.zip` subida por Claudio.

**Objetivo:**
- reemplazar la ilustraciÃ³n del bloque de comunidad por la imagen real del centro de operaciones enviada por Claudio;
- ajustar el cuadro para que acompaÃ±e mejor la proporciÃ³n horizontal de la nueva imagen.

**Archivos modificados:**
- `src/app/page.tsx`
  - se reemplaza la imagen `/branding/nosotros-ops-room.svg` por la nueva imagen real `nosotros-ops-room-photo.png`;
  - se ajusta el contenedor visual del bloque `Nosotros` usando un marco mÃ¡s limpio y una proporciÃ³n `aspect-video` para que el cuadro se adapte a la imagen.
- `public/branding/nosotros-ops-room-photo.png`
  - nueva imagen real del centro de operaciones Patagonia Wings.

**SQL:** no requiere.

---

## Bloque 17N â€” Servicios landing actualizados

**Base oficial respetada:** `public.zip` subida por Claudio.

**Objetivo:** actualizar la secciÃ³n pÃºblica `Servicios` para reflejar el estado actual de Patagonia Wings: itinerarios, despacho/OFP, economÃ­a operacional y progresiÃ³n del piloto.

**Cambios:**
- `src/app/page.tsx`
  - se cambia el tÃ­tulo de la secciÃ³n por una propuesta mÃ¡s actual y orientada a landing page;
  - se agregan textos cortos explicativos para itinerarios oficiales, despacho SimBrief, economÃ­a operacional y perfil/progresiÃ³n;
  - se incorporan emojis/Ã­conos visuales por card;
  - se ajusta el grid a 4 cards en desktop, 2 en tablet y 1 en mobile.

**SQL:** no requiere.

---

## Bloque 17O â€” IntegraciÃ³n oficial homogÃ©nea y logo Patagonia Wings ampliado

**Base oficial respetada:** `public.zip` subida por Claudio.

**Objetivo:** ajustar la secciÃ³n pÃºblica de IntegraciÃ³n Oficial para que el bloque derecho de ecosistema operativo tenga una presencia visual mÃ¡s homogÃ©nea con el contenido izquierdo.

**Cambios:**
- `src/app/page.tsx`
  - la grilla de IntegraciÃ³n Oficial pasa a dos columnas equivalentes en desktop.
  - el bloque derecho `Ecosistema operativo` queda estirado a la misma altura visual del contenido izquierdo.
  - el logo Patagonia Wings del bloque derecho se amplÃ­a de forma importante para mejorar presencia de marca.
  - se mantiene el flujo y contenido existente sin tocar lÃ³gica ni rutas.

**SQL:** no requiere.

---

## Bloque 17P â€” Logos Navigraph / SimBrief mÃ¡s grandes y apilados

**Base oficial respetada:** Ãºltima base vigente con bloque 17O aplicado.

**Objetivo:**
- agrandar visualmente los logos de Navigraph y SimBrief dentro del panel derecho de integraciÃ³n oficial;
- apilarlos uno sobre otro para llenar mejor la ventana y evitar sensaciÃ³n de vacÃ­o;
- mantener intacto el flujo y la estructura general de la landing.

**Archivos modificados:**
- `src/app/page.tsx`
  - el componente `OfficialIntegrationLogos` en modo `compact` ahora muestra los logos en columna;
  - se aumentÃ³ el tamaÃ±o visual de ambos logos en la tarjeta derecha;
  - se agregÃ³ un ancho mÃ¡ximo controlado para que el bloque de logos quede mÃ¡s presente y equilibrado.

**SQL:** no requiere.

---

## Bloque 17Q â€” SecciÃ³n Flota conectada sin scroll y mejor layout landing

**Base oficial respetada:** Ãºltima base vigente derivada de `public.zip` y bloques posteriores aplicados en esta conversaciÃ³n.

**Objetivo:**
- reorganizar la secciÃ³n de Flota de la landing para que el tÃ­tulo quede arriba de la imagen tipo tablet;
- mover el texto descriptivo bajo la imagen;
- dejar el listado de aeronaves a la derecha, alineado con la altura general del bloque;
- quitar el scroll interno del listado para mostrar todas las aeronaves disponibles;
- mantener conexiÃ³n con Supabase y actualizaciÃ³n automÃ¡tica por realtime.

**Archivos modificados:**
- `src/app/page.tsx`
  - reestructura el bloque `#flota` en dos columnas equilibradas;
  - tÃ­tulo y visual principal quedan a la izquierda;
  - descripciÃ³n queda debajo de la imagen;
  - listado conectado queda a la derecha.
- `src/components/site/HomeFleetShowcase.tsx`
  - deja el componente enfocado en lista de aeronaves conectada;
  - mantiene carga desde `aircraft` y `aircraft_fleet` en Supabase;
  - mantiene realtime para actualizar automÃ¡ticamente;
  - elimina `max-height` y `overflow-y-auto` para no tener scroll interno;
  - mueve los botones debajo de la lista;
  - mejora visual con card premium y separador verde.

**SQL:** no requiere.

---

## Bloque 17R â€” Flota landing en 3 columnas y texto operacional

**Base oficial respetada:** Ãºltima base vigente de Claudio.

**Objetivo:**
- hacer mÃ¡s compacta la lista de aeronaves de la landing;
- evitar que el usuario vea mensajes tÃ©cnicos sobre Supabase;
- reemplazar el contador confuso de modelos por una etiqueta operacional.

**Archivos modificados:**
- `src/components/site/HomeFleetShowcase.tsx`
  - la lista de aeronaves ahora usa 3 columnas en pantallas grandes para reducir altura;
  - se reemplazÃ³ el texto tÃ©cnico sobre Supabase por un texto corto orientado a operaciÃ³n, habilitaciones y liveries oficiales;
  - se cambiÃ³ el indicador `28 modelos` por `Flota en certificaciÃ³n`, evitando mostrar un nÃºmero que puede variar segÃºn catÃ¡logo/base/fallback.
- `docs/MASTER_CHANGELOG.md`
  - se registra esta actualizaciÃ³n.

**Nota:**
El nÃºmero 28 venÃ­a de contar todos los modelos Ãºnicos cargados desde la base operacional o, si no habÃ­a lectura disponible, desde el fallback local de flota.

**SQL:** no requiere.

---

## Bloque 17S â€” Flota certificada desde Supabase + Sukhoi + carga optimizada

**Base oficial respetada:** `public.zip` subida por Claudio.

**Objetivo:**
- tomar como certificados todos los modelos activos que existan en Supabase;
- incluir correctamente el Sukhoi/Sukhoi Superjet 100 cuando exista en catÃ¡logo;
- optimizar la carga de la secciÃ³n de flota para que responda mÃ¡s rÃ¡pido y con menos ambigÃ¼edad.

**Archivos modificados:**
- `src/components/site/HomeFleetShowcase.tsx`
  - la lista principal ahora se arma desde `aircraft_models` activos, usando `aircraft` solo para enriquecer nombres y addons cuando existan;
  - se reemplaza la lectura mezclada de `aircraft_fleet` por una fuente mÃ¡s clara para catÃ¡logo/modelos certificados;
  - se agrega mapeo de `SU95` -> `Sukhoi Superjet 100`;
  - el badge ahora muestra `N modelos certificados` segÃºn lo cargado realmente;
  - se ajusta la suscripciÃ³n realtime para escuchar `aircraft_models` y `aircraft`;
  - se reduce el debounce de refresco para que los cambios entren mÃ¡s rÃ¡pido;
  - se actualiza el fallback incluyendo Sukhoi.

**Nota operativa:**
- si el navegador o el entorno local muestran nÃºmeros antiguos, limpiar `.next` y recargar ayuda a evitar lecturas cacheadas.

**ValidaciÃ³n local:**
- la base subida no trae dependencias instaladas completas para ejecutar `tsc` aquÃ­, asÃ­ que no pude validar compilaciÃ³n completa en el contenedor.

**SQL:** no requiere.

---

## Bloque 17T â€” Flota certificada real desde aircraft_models y carga optimizada

**Base oficial respetada:** Ãºltima base vigente enviada por Claudio y CSV exportado desde Supabase.

**Hallazgo del CSV:**
- `aircraft_models` tiene 33 modelos activos, incluyendo `SU95` / Sukhoi SuperJet 100.
- La columna correcta para nombre visible no es `name`; es `display_name` / `variant_name`.
- La landing estaba consultando tambiÃ©n `aircraft`, tabla que contiene 4.261 filas, lo que hacÃ­a mÃ¡s lenta la carga y podÃ­a mezclar datos operativos con modelos certificados.

**Cambios:**
- `src/components/site/HomeFleetShowcase.tsx`
  - ahora lee la flota certificada directamente desde `public.aircraft_models`.
  - usa `display_name`, `variant_name`, `display_category`, `manufacturer`, `code` e `is_active`.
  - deja de consultar la tabla pesada `aircraft` para la landing.
  - mantiene actualizaciÃ³n automÃ¡tica solo escuchando cambios de `aircraft_models`.
  - el contador queda basado en modelos activos reales.
  - actualiza fallback local a 33 modelos certificados, incluyendo `B736`, `B748`, `B77F`, `C172`, `DHC6`, `E170` y `SU95`.

**SQL:** no requiere.

---

## Bloque 17U â€” Fix runtime HomeFleetShowcase tags undefined

**Base oficial respetada:** `public.zip` + Ãºltimos parches de flota.

**Motivo:**
- En desarrollo apareciÃ³ `Runtime TypeError: Cannot read properties of undefined (reading 'length')` dentro de `HomeFleetShowcase.tsx` al evaluar `entry.tags.length`.
- El componente debe ser tolerante si una fila/fallback llega sin `tags` por cache, datos incompletos o mezcla temporal de versiones.

**Cambio:**
- `src/components/site/HomeFleetShowcase.tsx`
  - se agrega `safeTags = Array.isArray(entry.tags) ? entry.tags.filter(Boolean) : []` antes de renderizar badges;
  - se evita leer `.length` sobre `undefined`;
  - se agrega fallback visual para nombre/cÃ³digo de aeronave.

**SQL:** no requiere.

---

## Bloque 17V â€” Certificaciones landing con foco en checkrides, teÃ³ricas y habilitaciones

**Base oficial respetada:** Ãºltima base vigente con `public.zip` + parches actuales ya trabajados en esta conversaciÃ³n.

**Cambio solicitado:**
- reemplazar el bloque genÃ©rico de certificaciones de la landing por contenido mÃ¡s alineado con la operaciÃ³n real de Patagonia Wings;
- hablar explÃ­citamente de checkrides, teÃ³ricas y habilitaciones;
- usar iconos/emojis y tarjetas mÃ¡s explicativas, pero con texto corto de landing page.

**Archivo modificado:**
- `src/app/page.tsx`
  - se actualiza el tÃ­tulo de la secciÃ³n a un enfoque mÃ¡s operacional;
  - se agrega texto introductorio corto;
  - se reemplazan las tres cards por:
    - `ðŸ›« Checkride prÃ¡ctico`
    - `ðŸ“˜ TeÃ³ricas y habilitaciones`
    - `âœ… Previo al vuelo`
  - cada card ahora incluye icono/emojis, tÃ­tulo y descripciÃ³n breve mÃ¡s clara para el usuario final.

**SQL:** no requiere.


---

## Bloque 17W â€” EliminaciÃ³n CTA final y botÃ³n panel piloto

**Base oficial respetada:** Ãºltima base vigente con `public.zip` + actualizaciones aplicadas hasta el bloque 17V.

**Objetivo:**
- eliminar la secciÃ³n final tipo contacto/CTA que decÃ­a â€œSiguiente paso: llevar este look al resto de la webâ€�;
- eliminar el botÃ³n â€œVer panel de pilotoâ€� de la secciÃ³n Servicios;
- no tocar ni revertir las actualizaciones visuales y funcionales ya aplicadas.

**Archivo modificado:**
- `src/app/page.tsx`
  - se eliminÃ³ el CTA final `#contacto`;
  - se eliminÃ³ solo el botÃ³n de acceso al panel dentro de Servicios;
  - se mantiene intacto el resto del contenido de la landing.

**SQL:** no requiere.

---

## Bloque 17X â€” Traslados mÃ¡s compactos tipo tabla

**Base oficial respetada:** Ãºltima base vigente con `public.zip` + actualizaciones ya aplicadas en esta conversaciÃ³n, sin retroceder cambios previos.

**Cambio solicitado:**
- hacer las ventanas de traslados mÃ¡s pequeÃ±as;
- reducir el tamaÃ±o visual de los botones;
- compactar la presentaciÃ³n para que se vea mÃ¡s como tabla y menos como tarjetas grandes.

**Archivo modificado:**
- `src/app/dashboard/page.tsx`
  - se compacta el bloque `Reposicionamiento`;
  - se reduce padding y altura visual de las tres columnas de traslado;
  - cada alternativa ahora se muestra en filas mÃ¡s compactas tipo tabla;
  - el botÃ³n deja de ocupar todo el ancho y pasa a tamaÃ±o mÃ¡s contenido;
  - se acortan textos de acciÃ³n a `Trasladar` / `Sin saldo` para que el bloque se vea mÃ¡s limpio.

**SQL:** no requiere.

---

## Bloque 18A â€” Central operacional inspirada en SUR Air

**Base oficial respetada:** ZIP vigente entregado en la conversaciÃ³n (`README_BLOQUE_23_DISTANCIA_ACARS.zip`) con los bloques previos de distancia ACARS y cierre automÃ¡tico por crash.

**Objetivo:**
- tomar lo mejor observado en la pÃ¡gina operativa de SUR Air sin copiar cÃ³digo ni estructura legacy;
- reforzar la sensaciÃ³n de â€œsala de despachoâ€� en Patagonia Wings Web;
- mantener el diseÃ±o premium actual, lÃ­neas verdes, cards limpias y estadÃ­sticas horizontales bajo la bienvenida.

**Archivo modificado:**
- `src/app/dashboard/page.tsx`

**Cambios aplicados:**
- Las estadÃ­sticas del piloto dejan de ir en columna lateral y pasan a una franja horizontal bajo la bienvenida.
- Se agrega un boletÃ­n tipo `NOTAM PWG` dentro de la tarjeta del aeropuerto actual, usando el METAR disponible y dejando claro que es un aviso operacional interno.
- Se agrega la secciÃ³n `Actividad del aeropuerto`, separando:
  - partidas desde el aeropuerto actual;
  - arribos hacia el aeropuerto actual;
  - estado de la integraciÃ³n ATC/VATSIM preparada para una futura conexiÃ³n.
- Se reactiva el bloque de comunicados operacionales internos para que la central muestre novedades aunque no exista API de noticias disponible.
- La secciÃ³n de noticias locales queda separada de los comunicados PWG, evitando mezclar NOTAM interno, actualidad local y avisos de operaciÃ³n.
- Se mantiene intacto el flujo principal de despacho, reservas, SimBrief, economÃ­a, ACARS, traslados y oficina.

**SQL:** no requiere.

**Notas:**
- No se copiÃ³ cÃ³digo de SUR Air.
- El bloque queda preparado para una futura tabla Supabase de NOTAMs internos por aeropuerto y para una futura integraciÃ³n VATSIM real.


## Bloque 18B Â· Conector contable economÃ­a/ACARS Â· 2026-04-29

- Se agrega `createSupabaseAdminClient()` en `src/lib/supabase/server.ts` para escrituras contables server-side con `SUPABASE_SERVICE_ROLE_KEY`.
- El cierre `/api/acars/finalize` mantiene validaciÃ³n del piloto con bearer token, pero snapshots, ledger, balance y acumulado salarial pasan a cliente admin server-side.
- Objetivo: corregir el bloqueo detectado por RLS activo sin policies en `flight_economy_snapshots`, `airline_ledger`, `pilot_salary_ledger` y tablas econÃ³micas sensibles.
- Regla contable: al finalizar vuelo se devenga comisiÃ³n/costos; el pago al wallet se deja para liquidaciÃ³n mensual, no por vuelo.
- No se cambia flujo interno de despacho, SimBrief ni ACARS.

## Bloque 18B-18F Â· Ajuste final de implementaciÃ³n Â· 2026-04-29

- `src/lib/acars-official.ts`: se elimina pago vuelo-a-vuelo a `pilot_profiles.wallet_balance` en finalize; la comisiÃ³n queda devengada en `pilot_salary_ledger`.
- `src/app/api/pilot/salary/monthly/route.ts`: liquidaciÃ³n mensual con escritura `service role` para `pilot_salary_ledger` y pago de wallet solo en cierre mensual.
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

## 2026-04-29 - ACARS 7.0.0 parcial (payload extendido + altitud diagnóstica + XPDR)

Cambios aplicados:
- Extensión de telemetría ACARS para separar `indicated_altitude_ft`, `true_altitude_ft`, `pressure_altitude_ft`, `radio_altitude_ft`, `ground_altitude_ft` y `altitude_agl_ft`.
- Se añade `qnh_inhg` además de `qnh_hpa` en telemetría serializada.
- Se incorpora XPDR en payload de muestras (`xpdr_state_raw`, `xpdr_code`, `xpdr_charlie`).
- `closeout_payload` amplía contrato con:
  - `blackbox_summary`
  - `event_summary`
  - `critical_events`
  - `capability_snapshot`
  - `unsupported_signals`
  - `penalty_exclusions`
- Se documenta ejecución en:
  - `docs/ACARS_7_EXECUTION_STATUS.md`
  - `docs/ACARS_7_AIRCRAFT_CAPABILITY_MATRIX.md`

Regla contable preservada:
- No se tocó 18B (ledger/salary/wallet mensual).
- Finalize sigue sin pagar wallet por vuelo.

## 2026-04-29 — ACARS 7.0.0 cierre build + XPDR UI
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


## 2026-04-29 - ACARS 7.0.1 detection confidence hardening
- Se formaliza metadata de deteccion en payload ACARS: type/variant/addon/profile, confidence, reason, source, matched title/pattern, fallback_used, profile_status.
- Se extiende blackbox/event summary/capability snapshot con contexto de deteccion para auditoria operacional.
- Se agrega exclusion conservadora por detection confidence low/fallback/unknown para evitar penalizacion de señales ambiguas.
- Se crea guia de validacion manual por addon y checklist smoke test ready-to-fly.


## 2026-04-29 - HOTFIX ACARS autoupdate obligatorio 7.0.1
- Se restablece autoupdate operativo para instalaciones antiguas (6.x -> 7.0.1).
- channel/acars-update/autoupdater quedan coherentes en 7.0.1 y modo obligatorio.
- Publicacion prioriza instalador oficial para evitar delta incompleto en clientes legacy.

## 2026-04-29 - RELEASE ACARS 7.0.3 final
- Se cierra HUD interno MSFS con paquete `packages/patagoniawings-acars-hud` (panel HTML/CSS/JS).
- ACARS publica telemetria por bridge local seguro `http://127.0.0.1:37677/api/hud/state`.
- Finalize queda bloqueado por confirmacion server-side real (`success`, `reservationId`, `summaryUrl`).
- ACARS abre resumen web tras finalize exitoso y conserva estado pending si no hay confirmacion.
- Feeds web/public (`acars-update.json`, `autoupdater.xml`, `channel.json`) quedan en 7.0.3 con force update legacy.
- Regla contable preservada: sin cambios en wallet mensual y sin duplicar ledger/salary por retry.

## 2026-04-30 - HOTFIX ACARS/Web 7.0.14 cierre oficial no evaluable
- Se endurece validacion server-side de closeout oficial: evidencia minima obligatoria para permitir `completed` y economia.
- Vuelos sin evidencia suficiente quedan en `pending_server_closeout` / `no_evaluable` y no generan salario, comision ni `airline_ledger`.
- `/api/acars/finalize` devuelve flags operativos (`evaluationStatus`, `economyEligible`, `salaryAccrued`, `ledgerWritten`) para evitar falsos positivos de cierre.
- Se ajustan vistas Web (`/flights/[reservationId]`, `/profile`, `/economia`) con mensajes claros de cierre incompleto e historial economico detallado por linea.
- ACARS PostFlight muestra estado de cierre recibido no evaluable y mantiene flujo de resumen sin marcar exito contable.
- Versionado sincronizado a 7.0.14 en AssemblyInfo y feeds (`acars-update`, `channel`, `autoupdater`) para update obligatorio desde versiones legacy.

## 2026-05-01 - BLOQUE FINAL 7.0.14 (UI no evaluable + SQL diagnóstico)
- `/flights/[reservationId]` fuerza presentación de cierre no evaluable cuando aplica (`pending_server_closeout`, `incomplete_closeout`, `no_evaluable` o sin evidencia mínima), con daño 0%, eventos 0 y sin devengo/ledger/wallet.
- Historial mensual del piloto muestra líneas `No evaluable / sin devengo` con monto devengado 0 para reservas no evaluables.
- Economía de aerolínea mantiene trazabilidad de `Cierre no evaluable` pero excluye impacto operacional de utilidad/ingresos/costos válidos.
- Se agrega script no destructivo `sql/2026-05-01-diagnostico-cierres-no-evaluables.sql` con consultas de auditoría y reversa manual comentada por reserva específica.

## 2026-05-01 - BLOQUE TEST PIREP XML (preview seguro)
- Nuevo endpoint `POST /api/acars/finalize/test` (owner/admin) para ejecutar evaluación server-side en `testMode + dryRun` usando el mismo motor de reglaje (`evaluateOfficialCloseout`) sin cierre contable real.
- Respuesta incluye `evaluationPreview`, estado, score, timeline, penalizaciones/eventos y banderas de seguridad (`economyMode=preview`, `salaryAccrued=false`, `ledgerWritten=false`, `walletMovement=false`).
- Se agregan fixtures XML en `test-fixtures/pireps/`:
  - `pirep-valid-sample.xml`
  - `pirep-no-events.xml`
  - `pirep-hard-landing.xml`
  - `pirep-overspeed.xml`
  - `pirep-completed-normal.xml`
- UI mínima en `/flights/[reservationId]` para owner/admin en entorno dev: selector de fixture, XML manual opcional y ejecución de preview de reglaje.
- Persistencia opcional no operativa en `acars_test_evaluations` (si existe); si la tabla no existe, la evaluación sigue funcionando y retorna warning de trazabilidad.

