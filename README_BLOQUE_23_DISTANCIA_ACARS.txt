Bloque 23 — Fix distancia ACARS

Cambio aplicado:
- El ACARS ahora prioriza la distancia planificada del despacho/web/Supabase antes de estimar por tiempo de bloque.
- Se agregó PlannedDistanceNm a PreparedDispatch y AcarsReadyFlight.
- ApiService intenta leer distance_nm / route_distance_nm / planned_distance_nm desde reserva, dispatch package, SimBrief normalized/OFP.
- Si no viene distancia directa, ApiService consulta network_routes por route_code o por origin/destination.
- InFlightViewModel usa PlannedDistanceNm como distancia total de ruta y calcula distancia restante como total planificado - distancia recorrida.

Objetivo:
- Evitar casos como SCTB -> SCSN donde el ACARS estimaba 240 NM por tiempo de bloque, mientras la web marcaba cerca de 55 NM totales.

Archivos modificados:
- PatagoniaWings.Acars.Core/Models/PreparedDispatch.cs
- PatagoniaWings.Acars.Core/Models/AcarsReadyFlight.cs
- PatagoniaWings.Acars.Core/Services/ApiService.cs
- PatagoniaWings.Acars.Master/ViewModels/InFlightViewModel.cs

Validación pendiente local:
- Compilar Release x64 en Windows/Visual Studio.
- Probar reserva SCTB -> SCSN: el total debe venir desde network_routes/distance_nm y no desde estimación por block time.
