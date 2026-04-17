// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "3.1.6";
export const ACARS_BACKEND = "SimConnect + FSUIPC7 fallback + Supabase Direct";
export const ACARS_SIZE_MB = "~28 MB";
export const ACARS_DOWNLOAD_URL = "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup-3.1.6.exe";

export const ACARS_RELEASE_NOTES = [
  "Panel de pesos SimBrief vs simulador: ZFW, combustible y pasajeros en tiempo real",
  "Alerta de coincidencia de combustible al arrancar motores (tolerancia ±10%)",
  "Log PIREP preliminar en pantalla: altitud máx, velocidad, distancia, VS aterrizaje",
  "Actualización silenciosa integrada: barra de progreso dentro del ACARS",
  "El ACARS reabre automáticamente tras instalar una actualización",
  "Notificación '✓ Actualizado' al reiniciar después de una actualización",
  "Fix: simulador ya no se cuelga al cerrar y volver a abrir el ACARS",
  "Versión Web 2.0 · ACARS 3.1.6",
];
