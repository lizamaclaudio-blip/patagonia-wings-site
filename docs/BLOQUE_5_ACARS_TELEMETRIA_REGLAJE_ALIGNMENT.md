# Bloque 5 — Alineación telemetría ACARS ↔ reglaje ↔ resumen Web

## Base revisada

- Web: base `public.zip` + parche Bloque 4 funcional.
- ACARS: base `PatagoniaWings.Acars.SimConnect.zip` + parche HUD independiente ya aplicado por Claudio.
- PIREP real revisado: `Flight-SCTB-SCEL-8FBA0C33-33D2-437C-B4D8-675A009F4283.XML`.

## Hallazgo principal

ACARS sí estaba leyendo telemetría base suficiente para vuelo evaluable: posición, velocidad, altitud, AGL, VS, combustible, peso, luces, parking brake, motores, AP, flaps, tren, XPDR, meteo y detección de aeronave.

Pero había desalineaciones para el resumen estilo SUR/Pirep y para el reglaje Web:

1. `G-Force` no se leía desde SimConnect; por eso el XML real traía `TouchdownGForce=0.000` y `MaxGForce=0.000`.
2. `ApiService.SerializeSimData()` no enviaba todo lo que ya estaba disponible en `SimData`.
3. El XML PIREP tenía viento como texto (`258/9kts`) pero la Web esperaba tags numéricos `VientoSalidaVelocidad`, `VientoSalidaDireccion`, `VientoLlegadaVelocidad`, `VientoLlegadaDireccion`.
4. El bloque `<Avion>` no exponía todos los estados de sistemas necesarios para auditar luces, batería, aviónica, puertas, AP, APU, bleed, combustible por tanques y pesos.
5. El scoring Web podía mostrar G-force, pero no podía penalizar por G porque el dato llegaba en cero.

## Cambios aplicados

### ACARS — SimConnect

Archivo: `PatagoniaWings.Acars.SimConnect/SimConnectStructs.cs`

- Se agrega campo final `GForce` al struct de telemetría.
- Se agrega al final para no romper el orden legacy de los campos previos.

Archivo: `PatagoniaWings.Acars.SimConnect/SimConnectService.cs`

- Se registra simvar `G FORCE`.
- Se normaliza `gForce` con fallback `1.0` si el simulador no entrega señal.
- Se alimenta `SimData.LandingG` y `SimData.GForce`.

Archivo: `PatagoniaWings.Acars.Core/Models/SimData.cs`

- Se agrega `GForce` como dato explícito de caja negra.

### ACARS — PIREP XML RAW

Archivo: `PatagoniaWings.Acars.Core/Services/PirepXmlBuilder.cs`

- `TouchdownGForce`, `MaxGForce`, `MinGForce` ahora usan G real desde SimConnect.
- Meteorología agrega tags numéricos para que la Web no tenga que interpretar texto.
- `<Avion>` queda enriquecido con:
  - XPDR estado/código.
  - combustible total/capacidad/tanques.
  - battery master.
  - avionics master.
  - doors.
  - luces NAV/BCN/STB/TAXI/LAND.
  - seatbelt/no smoking.
  - autopilot.
  - APU/bleed.
  - GForce.
  - ZFW, payload y empty weight.

### ACARS — finalize JSON

Archivo: `PatagoniaWings.Acars.Core/Services/ApiService.cs`

- `blackboxSummary` agrega:
  - max/min G-force.
  - elapsed_seconds.
  - airborne_samples.
  - on_ground_samples.
- `SerializeSimData()` agrega `gForce`.
- Se preserva todo lo agregado en Bloque 4: pesos, combustible, sistemas, detección y meteo.

### Web — evaluación oficial

Archivo: `src/lib/acars-official.ts`

- `AcarsTelemetrySample` ahora acepta `gForce`.
- El resumen estilo SUR usa `gForce` como fuente prioritaria para `landing_g_force` y `touchdown_g`.
- El reglaje oficial ahora penaliza G-force en touchdown:
  - `>= 1.8G`: firme.
  - `>= 2.5G`: elevado.
  - `>= 3.5G`: hard/crash threshold server-side.

## Matriz de alineación funcional

| Necesidad PIREP/Web | Estado después de este bloque |
|---|---|
| Posición LAT/LON | OK |
| Altitud, AGL, IAS, GS, VS | OK |
| Fases/takeoff/landing por onGround + AGL + velocidad | OK |
| Combustible inicial/final/usado | OK |
| Capacidad y tanques | OK |
| TOW/LW/ZFW/payload/empty weight | OK |
| Touchdown VS | OK |
| Touchdown G / Max G | OK, corregido en este bloque |
| Overspeed/Stall/Pause | OK por samples + XML |
| Luces NAV/BCN/STB/TAXI/LAND | OK |
| Parking brake | OK |
| AP | OK con señal base, sujeto a addon |
| Tren/flaps/spoilers | OK |
| XPDR código/estado | OK |
| COM2 PIC/radio check | Parcial: lectura existe; lógica de desafío PIC depende del flujo UI/servicio |
| Batería/aviónica/puertas | OK |
| APU/bleed/seatbelt/no smoking | OK según perfil/capability |
| Viento salida/llegada | OK con tags numéricos agregados |
| QNH/OAT/lluvia | OK |
| Detección aeronave/addon/perfil | OK |
| TDZ/runway/centerline | Pendiente real: no hay runway geometry confiable todavía; queda como server-side futuro |
| Ruta y plan OFP | OK desde dispatch/preparedDispatch |
| Economía/ledger/salary | No se toca; depende de `completed + evaluable` server-side |

## Validación requerida

1. Compilar ACARS Release x64 con MSBuild oficial.
2. Compilar Web con `npx tsc --noEmit` y `npm run build`.
3. Hacer vuelo real mínimo:
   - más de 120 segundos,
   - más de 4 muestras,
   - al menos un tramo airborne,
   - aterrizaje en destino,
   - shutdown/parking brake.
4. Revisar que el resumen Web muestre:
   - G-force distinta de 0,
   - vientos salida/llegada,
   - fuel start/end/used,
   - TOW/LW/ZFW,
   - luces/sistemas en XML/score_payload,
   - estado `scored` si el vuelo fue completo.

## No tocado

- HUD MSFS2020 independiente.
- SayIntentions.
- Autoupdate/installer/versiones.
- Wallet/salary/ledger.
- RLS/Supabase policies.
- Diseño visual de la página de resultado.
