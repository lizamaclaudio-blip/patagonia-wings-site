# WEB D3 — Score Payload C0–C8 Normalization

Base: Web 7.0.15 + D1/D2 local.

## Objetivo
Normalizar en `score_payload` la evidencia ACARS C0–C8 sin cambiar todavía el scoring final ni la economía.

## Archivos modificados
- `src/lib/acars-official.ts`

## Cambios
- Agrega `pirep_perfect_c0_c8` y `pirep_perfect_normalized` al `score_payload`.
- Expone banderas directas:
  - `pirepPerfectC0C8Detected`
  - `altitudeReliable`
  - `phaseAuditReady`
  - `phaseScoreEligible=false`
- Normaliza:
  - `parser_versions_detected`
  - `altitude_summary`
  - `phase_sequence_summary`
  - `phase_audit_report`
  - `phase_prevalidation_package`
  - `phase_acceptance_matrix`
  - `phase_test_run_manifest`
- También duplica estos bloques dentro de `closeout_evidence` para auditoría rápida.

## Regla de seguridad
`phaseScoreEligible` queda explícitamente en `false` hasta validar C0–C8 en simulador real. Este bloque solo ordena trazabilidad.

## No toca
- Supabase schema / SQL
- Economía, wallet, salary, ledger
- HUD, SayIntentions, SimBrief, Route Finder
