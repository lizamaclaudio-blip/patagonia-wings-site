# WEB D4 — Finalize response C0-C8 contract

## Base
- Web local con D1/D2/D3 aplicado sobre `96dad9b release: publish acars downloads 7.0.15`.

## Cambios
- Agrega `buildPirepPerfectFinalizeResponse()` en `src/app/api/acars/finalize/route.ts`.
- Devuelve al ACARS un contrato compacto de trazabilidad C0-C8 en la respuesta de `/api/acars/finalize`.
- Incluye `pirepPerfectFinalizeResponse`, `pirepPerfectC0C8`, `altitudeSummary`, `phaseSequenceSummary`, `phaseAuditReady` y `phaseScoreEligible`.
- Mantiene `phaseScoreEligible=false` hasta validación real en simulador.
- No cambia score final, economía, wallet, salary, ledger ni Supabase schema.

## Validación esperada
- `npm run build` debe compilar sin errores.
- ACARS puede recibir trazabilidad C0-C8 sin usarla como score oficial.
