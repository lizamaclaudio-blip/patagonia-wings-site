# Patagonia Wings Web 7.0.14 - Finalize Route TypeScript Hotfix

## Base
Parche aplicado sobre `src/app/api/acars/finalize/route.ts` de la actualización consolidada ACARS/Web 7.0.14.

## Problema corregido
`npx tsc --noEmit` y `npm run build` fallaban por:

- `Property 'registration' does not exist on type 'AcarsTelemetrySample'`.
- Comparación imposible `status === "completed"` dentro de un bloque donde `status` solo puede ser `"crashed" | "manual_review"`.
- Además, el build estaba compilando una carpeta temporal `_WEB_MINIMO_ACARS_FINALIZE` dejada dentro del repo.

## Archivos entregados

- `src/app/api/acars/finalize/route.ts` completo corregido.
- `tools/pw-web-clean-temp-folders.ps1` para eliminar carpetas temporales que no deben quedar dentro del repo.

## Cambios

### `route.ts`

- La matrícula/registration ahora se obtiene mediante `asObject(lastSample).registration` y `asObject(lastSample).aircraftRegistration`, evitando acceder a propiedades no declaradas en el tipo `AcarsTelemetrySample`.
- En cierre forense degradado, `dispatch_status` queda:
  - `cancelled` si `status === "crashed"`.
  - `dispatched` si `status === "manual_review"`.

## Validación esperada

Ejecutar en el repo Web:

```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\pw-web-clean-temp-folders.ps1"
npx tsc --noEmit
npm run build
```

Resultado esperado:

- TypeScript OK.
- Next build OK.
