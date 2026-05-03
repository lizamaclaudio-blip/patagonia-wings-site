# WEB D8 — C0-C8 Readiness Endpoint

## Objetivo
Agregar endpoint diagnóstico protegido para validar que Web/Supabase están preparados para recibir cierres ACARS con evidencia C0-C8 antes de activar score por fases.

## Archivos
- `src/app/api/acars/audit/readiness/route.ts`

## Cambios
- Nuevo endpoint: `GET /api/acars/audit/readiness?token=...&limit=5`.
- Valida `ACARS_AUDIT_TOKEN`.
- Revisa disponibilidad de `SUPABASE_SERVICE_ROLE_KEY` sin exponer secretos.
- Cuenta tablas clave: `flight_reservations`, `pw_flight_score_reports`, `pw_pilot_score_ledger`, `pw_pilot_scores`, `pw_scoring_rules`, `acars_penalty_catalog`.
- Resume últimos cierres y detecta evidencia C0-C8 en `score_payload`.
- Mantiene `phaseScoreEligible=false` como criterio hasta prueba real.

## No toca
- Scoring final.
- Supabase schema.
- Economía, wallet, salary, airline_ledger.
- HUD, SayIntentions, SimBrief, Route Finder.
