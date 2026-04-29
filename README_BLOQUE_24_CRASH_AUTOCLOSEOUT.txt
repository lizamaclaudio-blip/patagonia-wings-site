Bloque 24 — Crash Auto Closeout / ACARS caja negra RAW

Objetivo:
- Si MSFS emite evento SimConnect "Crashed" o si el ACARS detecta un impacto severo compatible con crash, el vuelo se marca automáticamente como CRASH.
- El ACARS genera el PIREP RAW, adjunta telemetría + damageEvents y lo envía por el pipeline oficial /api/acars/finalize.
- El ACARS NO evalúa puntaje final. Solo marca el evento como evidencia RAW para que Supabase/Web aplique el castigo oficial.

Archivos incluidos:
- PatagoniaWings.Acars.Core/Services/FlightService.cs
- PatagoniaWings.Acars.Core/Services/ApiService.cs
- PatagoniaWings.Acars.Master/Views/MainWindow.xaml.cs

Cambios principales:
1) FlightService
   - Agrega evento CrashDetected.
   - Mantiene MarkCrash(reason).
   - Detecta impactos severos cuando el simulador no dispara el evento Crashed.
   - Registra crash en DamageEventCollector para incluir evento de daño.

2) MainWindow
   - El evento SimConnect Crashed ya no solo cierra reserva.
   - Ahora llama HandleCrashDetectedAsync().
   - Genera FlightReport, marca ResultStatus=crashed, agrega Remarks AUTO_CLOSEOUT_CRASH y envía SubmitFlightReportAsync().
   - Si falla el finalize, intenta fallback CloseReservationAsync(crashed).

3) ApiService
   - Si el cierre viene marcado como crashed, el payload RAW queda FlightValid=false y agrega incidente AUTO_CLOSEOUT_CRASH.
   - La evaluación oficial sigue pendiente en Supabase/Web.

Notas:
- Compilar en Windows: Release x64.
- Probar en B58: iniciar vuelo, provocar crash/impacto severo, confirmar que se cierra automáticamente y aparece registro en Web/Supabase.
- Si el simulador tiene crash desactivado, el detector heurístico cubre impacto severo por G/VS/velocidad/bank/pitch en fases activas.
