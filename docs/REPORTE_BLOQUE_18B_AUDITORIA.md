# Patagonia Wings Web · Bloque 18B · Reporte auditoría economía/ACARS

## Resultado del CSV de auditoría

La auditoría confirmó que el esquema existe, pero la contabilidad real todavía no está viva.

### Datos encontrados

- `airline_ledger_total`: 1 movimiento.
- `flight_economy_snapshots_total`: 0.
- `flight_economy_snapshots_simbrief`: 0.
- `flight_economy_snapshots_actual`: 0.
- `pilot_salary_ledger_total`: 0.
- `monthly_closures_total`: 0.
- `reservas_con_economia`: 70.
- `airlines.balance_usd` cuadra con `airline_ledger`: balance 1.305.000 = ledger 1.305.000.

### RLS detectado

- `airline_ledger`: RLS activo, sin policies.
- `airline_monthly_closures`: RLS activo, sin policies.
- `flight_economy_snapshots`: RLS activo, sin policies.
- `pilot_expense_ledger`: RLS activo, sin policies.
- `pilot_salary_ledger`: RLS activo, policy `pilot_sees_own_salary`.

### Interpretación

La causa probable de que no se generen snapshots, ledger de vuelos ni sueldos es que el código intentaba escribir tablas contables con cliente anon/user sujeto a RLS. El cierre ACARS debe usar cliente server-side con `SUPABASE_SERVICE_ROLE_KEY` para las escrituras contables oficiales.

### Importante

Las reservas detectadas sin snapshot/ledger aparecen mayoritariamente como `cancelled` o `aborted`. No se recomienda backfill contable automático sobre vuelos cancelados/abortados. Primero se debe corregir el flujo futuro y luego evaluar backfill solo para vuelos realmente completados.

## Decisión de diseño

- Al finalizar un vuelo: devengar comisión, registrar costos, registrar ingresos, crear snapshot real y recalcular balance.
- En cada vuelo: NO pagar wallet directamente.
- Último día hábil del mes: liquidar y pagar wallet una sola vez, evitando duplicidad.

## Archivos modificados en este parche

- `src/lib/supabase/server.ts`
- `src/lib/acars-official.ts`
- `docs/MASTER_CHANGELOG.md`
- `sql/2026-04-29-bloque-18b-rls-snapshots-planificados.sql`

## Variable obligatoria en Vercel

Agregar en Vercel y en `.env.local` para desarrollo:

```env
SUPABASE_SERVICE_ROLE_KEY=PEGAR_SERVICE_ROLE_KEY_DE_SUPABASE
```

Nunca exponer esta variable como `NEXT_PUBLIC_*`.
