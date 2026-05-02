# BLOQUE 7 — Persistencia forense de finalize ACARS

## Base usada
- Web base entregada por Claudio en `public.zip`.
- `src/lib/acars-official.ts` tomado desde Bloque 6 para conservar alineación COM1/COM2, PIC y G-Force.
- No se tocó HUD MSFS2020 ni ACARS desktop en este bloque.

## Problema diagnosticado
Supabase mostraba reservas con:
- `has_acars_live = true`
- `has_raw_pirep_xml = false`
- `has_official_closeout = false`
- `has_sur_style_summary = false`

Conclusión: la telemetría viva llegaba, pero el cierre final `/api/acars/finalize` no dejaba evidencia persistida para alimentar resumen, puntaje ni reglaje.

## Archivos modificados

### `src/app/api/acars/finalize/route.ts`
Motivo: guardar evidencia forense del intento de cierre antes de ejecutar la evaluación oficial.

Cambios:
- Agrega persistencia previa de `acars_finalize_attempt`.
- Agrega historial corto `acars_finalize_attempts`.
- Agrega `raw_finalize_payload` truncado para no saturar DB.
- Guarda `raw_pirep_xml` cuando venga en `closeoutPayload.pirepXmlContent`.
- Construye `blackboxSummary` forense desde XML, `telemetryLog`, `lastSimData`, `report`, `activeFlight` y `preparedDispatch`.
- Construye `sur_style_summary` forense para que el resumen web tenga datos aun si la evaluación oficial falla.
- En errores de finalize, deja `acars_finalize_error` y `official_closeout` con estado `finalize_failed`.

### `src/app/api/acars/live/route.ts`
Motivo: evitar errores por columnas inexistentes y dejar más historial vivo.

Cambios:
- Cambia selects directos por `select("*")` schema-safe.
- No depende de columnas como `pilot_id`, `origin_icao` o `aircraft_type_code`.
- Guarda `samples_tail` con las últimas 30 muestras.
- Guarda `sample_count`, `first_sample_at` y `last_sample_at`.

### `src/app/api/acars/telemetry/route.ts`
Motivo: igualar persistencia live/telemetry y mantener cola breve de muestras.

Cambios:
- Mantiene `acars_live.last_sample`.
- Agrega `samples_tail`, `sample_count`, `first_sample_at`, `last_sample_at`.
- Evita perder contexto entre muestras.

### `src/lib/acars-official.ts`
Motivo: conservar la última base de Bloque 6.

Cambios conservados:
- COM1/COM2 para PIC.
- G-Force / landingG.
- `sur_style_summary` oficial.
- PIC OK/Failed en scoring.

## Qué NO se tocó
- HUD MSFS2020.
- SayIntentions.
- Wallet.
- Salary mensual.
- Ledger aerolínea.
- Economía server-side.
- UI visual del resumen.
- Autoupdate / installer ACARS.
- RLS / migraciones destructivas.

## Validación local realizada
- Parse TypeScript sin errores sintácticos en:
  - `finalize/route.ts`
  - `live/route.ts`
  - `telemetry/route.ts`
  - `acars-official.ts`

Pendiente en máquina de Claudio:
- `npx tsc --noEmit`
- `npm run build`
- prueba finalize real.
