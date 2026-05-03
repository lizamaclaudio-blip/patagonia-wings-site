# WEB D5 Build Fix — acars-official C0-C8 scope

## Motivo
`npm run build` fallaba porque `evaluateOfficialCloseout()` referenciaba `pirepPerfectC0C8` y `pirepPerfectFlags` antes de que existieran en ese scope.

## Cambio
Se agrega resumen C0-C8 local dentro de `evaluateOfficialCloseout()` usando el `pirepPerfect` ya construido, manteniendo `phaseScoreEligible=false`.

## Archivos
- `src/lib/acars-official.ts`

## Sin cambios en
- SQL/Supabase schema
- economía/wallet/salary/ledger
- HUD/SayIntentions
- SimBrief/Route Finder
