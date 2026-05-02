# Patagonia Wings Web — Hotfix reglaje oficial Web/Supabase 7.0.14

## Objetivo
Consolidar el cierre ACARS para que la autoridad de scoring sea Web/Supabase, no ACARS.

## Archivo modificado
- `src/lib/acars-official.ts`

## Cambios
- `/api/acars/finalize` mantiene el cierre oficial server-side mediante `persistOfficialCloseout`.
- Se agrega lectura server-side de tablas de reglaje Supabase:
  - `pw_scoring_rules`
  - `pw_scoring_rule_overrides`
  - `acars_penalty_catalog`
  - `acars_rule_overrides`
  - `aircraft_damage_rule_catalog`
  - `aircraft_type_operation_rules`
- Se guarda snapshot de reglaje en `flight_reservations.score_payload.official_scoring_reglaje`.
- Se marca explícitamente `official_scoring_authority = web_supabase`.
- Se marca `acars_client_score_ignored = true` para dejar claro que ACARS no es autoridad de score.
- Si el vuelo queda `completed + evaluable`, se llama a `pw_apply_completed_flight_score` para alimentar:
  - `pw_pilot_score_ledger`
  - `pw_pilot_scores`
- La llamada a progresión es idempotente por prechequeo de `source_ref = reservationId`.
- Errores de lectura de reglaje o progresión quedan como warnings y no bloquean el cierre oficial.

## No tocado
- ACARS desktop
- HUD
- Economía wallet/salary/ledger de aerolínea
- Route Finder
- SimBrief
- Supabase RLS

## Validación sugerida
1. Reemplazar `src/lib/acars-official.ts`.
2. Ejecutar `npx tsc --noEmit`.
3. Ejecutar `npm run build`.
4. Hacer vuelo de prueba con cierre en gate.
5. Verificar que `score_payload` contenga:
   - `official_scoring_authority = web_supabase`
   - `official_scoring_reglaje`
   - `acars_client_score_ignored = true`
   - `official_closeout.scoring_status = scored`
6. Verificar que `pw_pilot_scores` y `pw_pilot_score_ledger` tengan movimiento para el callsign.
