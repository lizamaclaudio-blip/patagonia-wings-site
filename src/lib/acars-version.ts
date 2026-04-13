// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "2.0.17";
export const ACARS_BACKEND = "FSUIPC7 + SimConnect + Supabase Direct";
export const ACARS_SIZE_MB = "~48 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-2.0.17.exe";

export const ACARS_RELEASE_NOTES = [
  "Detección de aeronave por AircraftProfiles.json - todas las flotas soportadas",
  "Fix flujo despacho: reserva pasa a dispatch_ready al confirmar desde la web",
  "Tab Entrenamiento: habilitaciones, progresión, historial y tipos de vuelo",
  "LVARs por perfil: A319 Headwind, Headwind A320, Fenix A320 con sets correctos",
  "Pre-Vuelo y Perfil rediseñados - UI premium con SimBrief integrado",
];
