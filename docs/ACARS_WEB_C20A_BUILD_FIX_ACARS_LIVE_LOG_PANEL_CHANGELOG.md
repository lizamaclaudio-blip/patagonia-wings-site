# ACARS WEB C20A Build Fix — AcarsLiveLogPanel path

## Motivo
El build de Next.js fallaba porque `src/components/PilotOfficePanel.tsx` importa `./AcarsLiveLogPanel`, pero el archivo no existía dentro de `src/components` en la copia local.

Error:

```txt
Cannot find module './AcarsLiveLogPanel' or its corresponding type declarations.
```

## Cambio aplicado
Se agrega el componente existente de telemetría viva en la ruta esperada:

```txt
src/components/AcarsLiveLogPanel.tsx
```

## Alcance
- No cambia Supabase.
- No cambia ACARS desktop.
- No cambia RPC security proxy.
- No cambia economía.
- No cambia versión.

## Validación esperada
Ejecutar:

```powershell
npm run build
```
