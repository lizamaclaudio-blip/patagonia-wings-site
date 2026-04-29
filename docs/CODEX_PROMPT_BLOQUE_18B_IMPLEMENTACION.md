# Prompt para Codex · Patagonia Wings Web · Bloque 18B

Trabaja sobre la última base vigente:

1. `README_BLOQUE_23_DISTANCIA_ACARS.zip`
2. aplicar `patagonia_web_bloque_18A_PATCH.zip`
3. aplicar este parche `patagonia_web_bloque_18B_contabilidad_acars_patch.zip`

## Objetivo

Corregir el bloqueo de economía/ACARS detectado por auditoría: las tablas contables tienen RLS activo y no se están llenando snapshots, ledger ni sueldo mensual.

## Reglas obligatorias

- No cambiar el flujo interno ACARS/SimBrief.
- No rediseñar todavía la UI.
- No pagar wallet al finalizar cada vuelo.
- Al finalizar vuelo solo se debe devengar comisión y registrar costos/ingresos.
- El pago al wallet queda para el Bloque 18E: liquidación mensual último día hábil.
- Optimizar tokens: reportar solo por bloque, no enviar explicaciones largas innecesarias.
- Al terminar, entregar reporte de archivos modificados, SQL aplicado y resultado de build.

## Cambios esperados

### 1. Server client

Verificar que `src/lib/supabase/server.ts` tenga:

- `createSupabaseServerClient(accessToken?)` con anon + bearer para validar usuario.
- `createSupabaseAdminClient()` con `SUPABASE_SERVICE_ROLE_KEY`, solo server-side.

### 2. Cierre ACARS

En `src/lib/acars-official.ts`:

- Mantener validación del piloto con bearer token.
- Usar cliente admin para:
  - `flight_economy_snapshots`
  - `airline_ledger`
  - `airlines` balance
  - `pilot_salary_ledger`
- No duplicar ledger si el cierre se reintenta desde cola local ACARS.
- Mantener `rewardsAlreadyApplied` o mecanismo equivalente de idempotencia.

### 3. SQL

Aplicar `sql/2026-04-29-bloque-18b-rls-snapshots-planificados.sql` en Supabase.

No abrir escritura cliente para:

- `airline_ledger`
- `pilot_salary_ledger`
- `airline_monthly_closures`

Esas tablas deben quedar para server/service-role o funciones SECURITY DEFINER.

### 4. Validación

Después de aplicar, hacer:

- `npm run build`
- cerrar un vuelo real de prueba con ACARS
- ejecutar nuevamente la auditoría 18B

Esperado después de un cierre real:

- `flight_economy_snapshots_actual` > 0
- `airline_ledger_total` > 1
- `pilot_salary_ledger_total` > 0
- `LEDGER_BALANCE` = `CUADRA`

## Entrega final de Codex

Reportar en este formato:

```txt
BLOQUE 18B COMPLETADO
Archivos modificados:
- ...
SQL aplicado:
- ...
Build:
- OK / error exacto
Prueba funcional:
- pendiente / realizada
Observaciones:
- ...
```
