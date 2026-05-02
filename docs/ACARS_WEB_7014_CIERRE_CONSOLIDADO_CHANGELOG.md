# Patagonia Wings ACARS/Web 7.0.14 cierre consolidado

Base: archivos mínimos actuales subidos por Claudio.

## Objetivo
Cerrar el flujo ACARS → Web/Supabase sin depender de pruebas parciales ni parches cruzados.

## Cambios ACARS
- `MainViewModel.cs`: PostFlight queda protegido por candado manual de una sola vez. Ningún cierre por aterrizaje/touchdown puede abrir Paso 5/6 si no viene desde `FinishFlight()` y `ManualCloseoutConfirmed=true`.
- `InFlightViewModel.cs`: mantiene cierre manual con gate, suelo, GS baja, parking brake, motores OFF y Cold & Dark; bloquea Takeoff/Climb/Cruise/Descent/Approach/Landing.
- `InFlightPage.xaml`: asegura `IsEnabled={Binding CanManualCloseout}` y XAML válido con `Cold &amp; Dark`.
- `ApiService.cs`: diagnóstico de finalize más explícito cuando Web no confirma persistencia/reservationClosed.

## Cambios Web
- `/api/acars/finalize`: si el cierre oficial falla por schema/reglaje/accounting, persiste trazabilidad forense y cierra la reserva como `manual_review`/`crashed` con `scoring_status=pending_server_closeout`, devolviendo `success=true`, `persisted=true`, `reservationClosed=true`, `summaryUrl`.
- No paga wallet, no devenga salary, no escribe ledger en fallback degradado.

## No toca
- HUD package Community.
- Economía normal de vuelos evaluables.
- RLS/policies.
- Instalador/autoupdate.
