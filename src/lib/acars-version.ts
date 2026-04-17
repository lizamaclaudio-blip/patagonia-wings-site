// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "3.1.5";
export const ACARS_BACKEND = "SimConnect + FSUIPC7 fallback + Supabase Direct";
export const ACARS_SIZE_MB = "~28 MB";
export const ACARS_DOWNLOAD_URL = "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup-3.1.5.exe";

export const ACARS_RELEASE_NOTES = [
  "Actualización silenciosa integrada: barra de progreso dentro del ACARS",
  "El ACARS reabre automáticamente tras instalar una actualización",
  "Notificación '✓ Actualizado' al reiniciar después de una actualización",
  "Fix: simulador ya no se cuelga al cerrar y volver a abrir el ACARS",
  "Badge de versión dinámico en login — siempre refleja la versión instalada",
  "METAR en tiempo real desde aviationweather.gov",
  "Panel SISTEMAS con guardia de conexión (OFF cuando el sim no está conectado)",
  "Versión Web 2.0 · ACARS 3.1.5",
];
