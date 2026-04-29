# Patagonia Wings - Instrucciones Codex

## Regla principal
Trabajar de forma autonoma. No hacer microconsultas. Reparar todo lo necesario dentro del alcance indicado por el prompt.

## Flujo
- Revisar estado del repo antes de modificar.
- No romper 18B contable.
- No tocar service role, RLS contable, airline_ledger ni wallet mensual salvo instruccion explicita.
- Ejecutar build antes de commit.
- Hacer push solo al final si build y validaciones estan OK.
- Actualizar docs/MASTER_CHANGELOG.md.

## Validaciones obligatorias
- `npm run build` (si se toca web).
- Scan mojibake si se toca UI web:
  - `rg -n "Ã|Â|â€|ðŸ|?" src/app/dashboard src/components src/app/api/simbrief src/lib/simbrief.ts`
- Verificar que SimBrief no envie `PWG` dentro de `route`.
- Verificar que selector Tipo no muestre matricula.
- Verificar que selector Matricula muestre solo matricula.

## Supabase
- Aplicar migraciones directamente si Supabase CLI, DATABASE_URL o psql estan configurados.
- Si no hay credenciales reales, dejar migracion lista y reportar ese unico bloqueo.
- No abrir tablas contables sensibles a escritura cliente.

## ACARS 7.0.0
- ACARS es caja negra operacional.
- Registrar la mayor cantidad de evidencia posible.
- Supabase/Web evaluan score y economia final.
- Solo penalizar senales soportadas y confiables por aeronave/simulador.
- Senales no soportadas deben quedar ocultas o N/D, nunca rojo penalizante.

## Build oficial ACARS
- ACARS WPF .NET Framework legacy se valida oficialmente con MSBuild VS2022 x64.
- Comando oficial:
  - `"C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\amd64\MSBuild.exe" PatagoniaWings.Acars.sln /t:Clean,Build /p:Configuration=Debug /p:Platform=x64 /m`
- No usar `dotnet build` como validacion final de ACARS WPF (puede dar falsos errores de XAML/InitializeComponent).
