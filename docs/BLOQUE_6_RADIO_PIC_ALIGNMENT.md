# Bloque 6 — Radio PIC / COM1-COM2 alignment

Base: Bloque 5 ACARS telemetry alignment + ZIP ACARS completo revisado.
Objetivo: dejar funcional el chequeo PIC por radio real del simulador y persistirlo hasta el resumen Web/Supabase.

## Hallazgo

El ACARS ya tenía lógica visual de PIC Radio Check en `InFlightViewModel`, pero estaba incompleta para una prueba real:

- Solo leía `COM ACTIVE FREQUENCY:2`.
- El XML real de prueba `Flight-SCTB-SCEL...XML` mostró `Com2 = 0.00`.
- `Com1` quedaba fijo en `0.00`.
- `PICsFailed` y `CantidadPICs` quedaban siempre en `0` en el XML, aunque la UI ejecutara checks.
- La Web solo podía puntuar PIC si el XML traía `PICsFailed` / `CantidadPICs`.

## Cambios aplicados

### ACARS SimConnect

Archivos:

- `PatagoniaWings.Acars.SimConnect/SimConnectStructs.cs`
- `PatagoniaWings.Acars.SimConnect/SimConnectService.cs`
- `PatagoniaWings.Acars.Core/Models/SimData.cs`

Cambios:

- Lectura de `COM ACTIVE FREQUENCY:1`.
- Lectura de `COM STANDBY FREQUENCY:1`.
- Lectura de `COM ACTIVE FREQUENCY:2`.
- Lectura de `COM STANDBY FREQUENCY:2`.
- Normalización simple de frecuencias válidas 100–150 MHz.

### ACARS PIC Check

Archivo:

- `PatagoniaWings.Acars.Master/ViewModels/InFlightViewModel.cs`

Cambios:

- PIC ahora acepta coincidencia en COM1 o COM2 activo.
- Tolerancia `±0.015 MHz` para radios 25 kHz / 8.33 kHz y redondeo SimConnect.
- Si el vuelo corto no entra formalmente en `Cruise`, el sistema también puede activar PIC en `Climb` o `Descent`.
- El texto ahora dice `Sintonice COM1/COM2`.
- Se registra qué radio coincidió: `COM1` o `COM2`.

### ACARS FlightReport / XML / Finalize

Archivos:

- `PatagoniaWings.Acars.Core/Models/FlightReport.cs`
- `PatagoniaWings.Acars.Core/Services/PirepXmlBuilder.cs`
- `PatagoniaWings.Acars.Core/Services/ApiService.cs`

Cambios:

- Se agregan campos de resumen PIC al report:
  - `PicChecksTotal`
  - `PicChecksCompleted`
  - `PicChecksSucceeded`
  - `PicChecksFailed`
  - `LastPicRequiredFrequencyMhz`
  - `PicRadioSource`
- El XML ahora escribe:
  - `PICsFailed`
  - `CantidadPICs`
  - `PICsOK`
  - `PICsTotalProgramados`
  - `PICRadio`
  - `PICUltimaFrecuencia`
  - `Com1`
  - `Com1Standby`
  - `Com2`
  - `Com2Standby`
- El payload finalize también envía esos datos en `report`, `lastSimData` y `blackboxSummary`.

### Web/Supabase scoring

Archivo:

- `src/lib/acars-official.ts`

Cambios:

- La Web acepta PIC desde XML, `report` o `blackboxSummary`.
- Eventos actualizados:
  - `CRU_PIC_RADIO_OK`
  - `CRU_PIC_RADIO_FAILED`
- Penalización mantiene `-5` por fallo PIC.
- El resumen SUR-style puede mostrar COM1/COM2 y la frecuencia PIC requerida.

## No tocado

- HUD MSFS2020.
- SayIntentions.
- Wallet.
- Salary mensual.
- Ledger aerolínea.
- RLS/Supabase policies.
- Installer/autoupdate.
- Diseño visual del resumen.

## Validación esperada

ACARS:

```powershell
& "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe" ".\PatagoniaWings.Acars.Master\PatagoniaWings.Acars.Master.csproj" /t:Clean,Build /p:Configuration=Release /p:Platform=x64
```

Web:

```powershell
npx tsc --noEmit
npm run build
```

## Prueba manual PIC

1. Despachar vuelo y enviarlo al ACARS.
2. Iniciar vuelo.
3. Despegar y mantener vuelo más de 120 segundos.
4. Cuando aparezca `PIC CHECK`, sintonizar la frecuencia indicada en COM1 o COM2 activo.
5. El ACARS debe cambiar a `PIC OK`.
6. Finalizar vuelo.
7. Verificar en XML:
   - `CantidadPICs >= 1`
   - `PICsOK >= 1`
   - `PICsFailed = 0`
   - `Com1` o `Com2` con frecuencia real.
8. Verificar en resumen Web:
   - evento `PIC radio registrado correctamente`.
