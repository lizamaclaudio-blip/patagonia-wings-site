# Patagonia Wings Web · Instrucciones para Codex · Bloques 18B a 18F

## Base vigente obligatoria
Trabajar SIEMPRE sobre la última base aprobada por Claudio:

1. `README_BLOQUE_23_DISTANCIA_ACARS.zip`
2. Parche aplicado: `patagonia_web_bloque_18A_PATCH.zip`

No revertir ni pisar cambios del Bloque 18A. Mantener la central operacional inspirada en SUR Air.

## Regla de trabajo
Avanzar por bloques, con reporte breve por bloque. No gastar mensajes innecesarios. Al terminar cada bloque, informar:

- Archivos modificados.
- SQL requerido, si aplica, directo para copiar/pegar.
- Qué flujo se probó.
- Qué queda pendiente.
- Riesgos o supuestos.

No cambiar el flujo interno existente de despacho, SimBrief, ACARS, economía ni traslados salvo donde el bloque lo solicite explícitamente. Reducir clics y mejorar claridad visual sin romper lógica.

## Hallazgo actual
El esquema económico existe, pero los datos aún no están cerrando:

- `flight_economy_snapshots` = 0.
- Snapshots SimBrief = 0.
- Snapshots ACARS reales = 0.
- `pilot_salary_ledger` = 0.
- `airline_monthly_closures` = 0.
- `pw_economy_monthly_metrics` = 0.
- Sí existe capital inicial en `airline_ledger`.
- Sí existen valores de aeronaves y catálogo de gastos.
- Hay reservas con economía en `flight_reservations`, pero no se están transformando en snapshots/ledger/sueldo.

## Regla contable oficial
Al finalizar un vuelo:

1. Se devenga comisión del piloto.
2. Se calculan ingresos y costos reales.
3. Se descuenta/ajusta balance de aerolínea vía `airline_ledger`.
4. Se crea snapshot real `economy_source = 'actual'`.
5. Se acumula en `pilot_salary_ledger` como pendiente.

NO pagar directamente el wallet por cada vuelo. El wallet se acredita solo con la liquidación mensual, idealmente el último día hábil del mes, evitando duplicidad.

---

# Bloque 18B · Conector contable garantizado + auditoría economía/ACARS

## Objetivo
Asegurar que SimBrief y ACARS creen datos contables reales y auditables.

## Revisar

- `src/lib/flight-ops.ts`
- `src/lib/acars-official.ts`
- `src/app/api/acars/finalize/route.ts`
- `src/app/api/acars/closeout/route.ts`
- `src/app/api/economia/*`
- Supabase client usado en servidor: debe tener permisos para escribir tablas contables.

## Cambios esperados

1. Crear endpoint o helper server-side seguro para registrar contabilidad de vuelo.
2. Garantizar snapshot SimBrief al preparar OFP.
3. Garantizar snapshot ACARS real al cerrar vuelo.
4. Garantizar movimientos `airline_ledger` por vuelo.
5. Garantizar acumulación `pilot_salary_ledger` pendiente.
6. Registrar auditoría si falla alguna escritura.
7. No duplicar movimientos si el cierre se reintenta desde la cola local de ACARS.
8. Mantener idempotencia por `reservation_id` y `economy_source`.

## SQL
Entregar cualquier SQL requerido como archivo `.sql` y también pegado en el reporte. Si se requieren RPC `SECURITY DEFINER`, incluirlas explícitamente y explicar qué hace cada una.

## Validación mínima

- Preparar un vuelo con SimBrief debe crear snapshot `simbrief`.
- Finalizar un vuelo desde ACARS debe crear snapshot `actual`.
- `airline_ledger` debe tener ingresos/costos por reserva.
- `pilot_salary_ledger` debe quedar en `pending`.
- `airlines.balance_usd` debe cuadrar con suma del ledger.

---

# Bloque 18C · Manifiesto de salida pre-ACARS

## Objetivo
Después de traer datos de SimBrief y antes de enviar a ACARS, mostrar una página/panel de manifiesto inmersivo y claro.

## Requisitos visuales
Nombre sugerido: `Manifiesto de salida Patagonia Wings`.

Debe mostrar:

- Origen, destino, alternativo.
- Ruta OFP, nivel de crucero, distancia, ETE/block.
- Avión, matrícula, compatibilidad, estado de mantenimiento.
- Pasajeros.
- Peso estimado pasajeros.
- Equipaje estimado.
- Cargo kg.
- Payload total.
- ZFW.
- Taxi fuel, trip fuel, reserve fuel, block fuel.
- Ingreso pasajeros.
- Ingreso carga.
- Servicio a bordo.
- Ventas a bordo.
- Costo combustible.
- Costo mantenimiento.
- Tasas.
- Handling.
- Pago piloto estimado.
- Utilidad esperada.

## Regla UX
Reducir clics. El flujo visible debe quedar:

1. Preparar OFP.
2. Revisar manifiesto.
3. Enviar a ACARS.

No agregar pasos innecesarios. Si ya están los datos mínimos, autollenar todo.

---

# Bloque 18D · Planificado vs real

## Objetivo
En el resultado del vuelo y/o página de detalle mostrar comparación:

- Plan SimBrief.
- Real ACARS.
- Diferencias.
- Impacto económico.

## Mostrar

- Fuel planificado vs fuel real.
- Block planificado vs block real.
- Pax/carga planificados vs real si disponible.
- Ingreso planificado vs real.
- Costos planificados vs reales.
- Utilidad planificada vs real.
- Pago piloto.
- Estado de sueldo: acumulado para liquidación mensual.

---

# Bloque 18E · Liquidación mensual último día hábil

## Objetivo
Crear flujo de cierre de sueldos:

1. Acumular vuelos del mes en `pilot_salary_ledger`.
2. Calcular sueldo base si corresponde.
3. Restar daños, traslados o gastos si aplica.
4. Pagar al wallet solo en liquidación.
5. Evitar doble pago con estado `paid` + `paid_at` + restricción por periodo.
6. Permitir PDF de liquidación.
7. Preparar endpoint owner/admin para ejecutar cierre mensual.

## Requisito
Incluir SQL si falta columna, función RPC o policy.

---

# Bloque 18F · Simplificación visual inspirada en SUR Air

## Objetivo
Tomar lo bueno de SUR Air sin copiar código:

- HUB Center / Centro operacional.
- NOTAM por aeropuerto.
- Actividad del aeropuerto.
- Ranking compacto.
- Estado de flota/mantenimiento.
- Últimos movimientos.
- Ganancia piloto clara por vuelo.

## Reglas

- Menos tablas largas.
- Más tarjetas ejecutivas.
- Menos clics.
- CTA principal único por etapa.
- Mantener diseño premium Patagonia Wings.
- No duplicar información entre Dashboard, Oficina y Economía.
- Si hay redundancia, consolidar visualmente sin borrar datos.

---

# Entrega final
Al terminar 18B–18F:

1. Ejecutar build/lint si el proyecto lo permite.
2. Entregar reporte final acumulado.
3. Actualizar `docs/MASTER_CHANGELOG.md`.
4. Hacer commit con mensaje claro.
5. Hacer push.
6. Publicar en Vercel solo cuando build esté correcto.

Mensaje sugerido de commit:

`feat: consolidate Patagonia Wings economy, dispatch manifest and ACARS accounting`
