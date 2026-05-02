# Patagonia Wings — Bloque 2 ACARS/Web full-flow test

Fecha: 2026-05-01  
Base revisada: `public.zip` + `PatagoniaWings.Acars.SimConnect.zip` subidos por Claudio.  
Objetivo: dejar lista la primera prueba completa despacho → ACARS → caja negra/telemetría → Supabase → resumen web, sin romper HUD ni economía mensual.

## Cambios aplicados

### 1. `src/lib/acars-version.ts`
- Motivo: la web seguía mostrando `7.0.13` aunque el paquete/manifests estaban en línea 7.0.14.
- Cambio: `ACARS_VERSION` actualizado a `7.0.14`.
- Cambio: release notes alineadas con cierre no evaluable, tester owner, salary mensual por periodo y HUD independiente Patagonia Wings.
- Flujo afectado: descargas/versionado visible ACARS en web.
- No se tocó: URLs de descarga ni manifests.

### 2. `src/app/flights/[reservationId]/page.tsx`
- Motivo: el resumen consultaba `pilot_salary_ledger` por `reservation_id`, pero el salary real es mensual por `pilot_id + period_year + period_month`.
- Cambio: la consulta de salary ahora busca el ledger mensual del piloto autenticado para el periodo del vuelo.
- Cambio: etiqueta visual cambiada a `Salary mensual del periodo` para no confundirlo con ledger por vuelo.
- Cambio: tester PIREP XML queda disponible para owner/admin también en producción, protegido por identidad owner y endpoint bearer.
- Flujo afectado: resumen de vuelo y prueba owner de evaluación XML.
- No se tocó: cálculo oficial, wallet, airline ledger, salary mensual backend ni `/api/acars/finalize`.

### 3. `sql/2026-05-01-bloque-2-acars-full-flow-test.sql`
- Motivo: `/api/acars/finalize/test` podía advertir `acars_test_evaluations_table_missing`.
- Cambio: crea tabla `acars_test_evaluations` con RLS e índices.
- Cambio: agrega consultas de auditoría para validar reserva, dispatch, score, snapshots, ledger, salary mensual y pruebas XML.
- Flujo afectado: trazabilidad de pruebas owner/dry-run.
- No se tocó: datos reales existentes.

## Validación esperada

- `npx tsc --noEmit`: debe compilar.
- `npm run build`: debe compilar.
- Supabase SQL: debe ejecutar sin borrar ni modificar vuelos existentes.
- Tester XML owner: debe correr en modo preview/dry-run sin mover wallet ni ledger real.

## ACARS/HUD

No se reemplazan archivos ACARS en este bloque para no pisar el hotfix HUD independiente que Claudio ya aplicó y compiló con 0 errores. La revisión del ZIP ACARS confirmó que la base subida todavía contenía referencias SayIntentions antiguas en Soporte, pero esas ya fueron corregidas en el bloque HUD anterior. Este bloque no debe sobrescribir esos archivos.
