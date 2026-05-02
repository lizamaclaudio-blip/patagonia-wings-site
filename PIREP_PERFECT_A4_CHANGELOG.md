# PIREP PERFECT A4 — Score oficial + historial piloto

Base: Web 7.0.14 con Bloque Reglaje Web/Supabase y A3 Parser Web.

## Archivos
- `src/lib/pirep-perfect-official.ts` nuevo parser server-side del XML PIREP Perfect A2.
- `src/lib/acars-official.ts` actualizado para usar métricas XML como evidencia oficial Web/Supabase.
- `sql/2026-05-02-pirep-perfect-a4-verificacion.sql` verificación post-vuelo.

## Cambios funcionales
- ACARS sigue sin ser autoridad de score: solo envía XML/RAW.
- Web/Supabase parsea `<Capabilities>`, `<FlightPhaseSummary>` y `<EventTimeline>` server-side.
- Variables unsupported como XPDR/Doors/Gear quedan protegidas: se registran como N/D y no penalizan.
- El cierre puede ser evaluable usando evidencia XML aunque `telemetryLog` venga corto.
- `score_payload` guarda `pirep_perfect_scoring`, `officialScores` y `score_progression`.
- `pw_flight_score_reports` recibe puntos por fase.
- `pw_pilot_score_ledger` y `pw_pilot_scores` se alimentan mediante RPC; si el RPC no crea ledger, aplica fallback manual idempotente.

## No toca
- ACARS desktop.
- HUD.
- SimBrief / Route Finder.
- Wallet, salary mensual ni airline ledger.
- Supabase schema destructivo.

## Validación requerida
```powershell
npm run build
```
Luego cerrar un vuelo y ejecutar `sql/2026-05-02-pirep-perfect-a4-verificacion.sql`.
