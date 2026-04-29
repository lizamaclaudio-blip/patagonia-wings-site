# Entrega inicial Bloque 18B

Este paquete contiene:

- `supabase/2026-04-29-bloque-18b-economia-acars-auditoria.sql`
- `docs/CODEX_PROMPT_BLOQUES_18B_18F.md`
- `docs/BLOQUE_18B_18F_PLAN.md`

El SQL no modifica datos. Solo diagnostica:

- RLS y policies.
- Snapshots faltantes.
- Reservas con economía sin snapshot.
- Reservas con economía sin ledger.
- Balance vs ledger.
- Sueldos/liquidaciones existentes.

Después de ejecutar el SQL, pegar el resultado para decidir si el Bloque 18B requiere RPC `SECURITY DEFINER`, service role server-side, backfill, o reparación de RLS.
