# WEB D5 — Operational Diagnostics C0-C8

Fecha: 2026-05-03

## Objetivo
Agregar un panel de diagnóstico operativo en el resumen del vuelo para revisar si la Web recibió y normalizó correctamente la evidencia ACARS C0-C8 antes de activar scoring por fases.

## Archivos tocados
- `src/app/flights/[reservationId]/page.tsx`

## Cambios
- Agrega lectura visual de `pirep_perfect_normalized` / `pirep_perfect_c0_c8` desde `score_payload`.
- Muestra estado D5 `READY/WARN/WAIT/REVIEW` sin modificar score.
- Muestra bloques C0-C8 detectados: altitud, fases, checklist, transiciones, auditoría, contrato, prevalidación, matriz y manifest.
- Muestra resumen operativo: fases observadas, acceptance matrix, eventos, unsupported, ALT MSL máxima, AGL máxima y acción pendiente.
- Mantiene `phaseScoreEligible` bloqueado hasta validación real en simulador.

## No toca
- SQL / Supabase schema.
- Economía, wallet, salary, airline_ledger.
- HUD, SayIntentions, SimBrief o Route Finder.
- Cálculo oficial de score.

## Validación requerida
- `npm run build`
- Abrir un resumen con PIREP C0-C8 y verificar el panel `Diagnóstico operativo D5`.
