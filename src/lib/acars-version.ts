// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "2.0.12";
export const ACARS_BACKEND = "FSUIPC7 + SimConnect + Supabase Direct";
export const ACARS_SIZE_MB = "~48 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-2.0.12.exe";

export const ACARS_RELEASE_NOTES = [
  "Detección automática A319/A320/A321 FlyByWire",
  "LVARs corregidos: Beacon, Strobe, Landing, Nav, Taxi",
  "N1 motores via L:A32NX_ENGINE_N1 (FlyByWire docs)",
  "Sistema de actualizaciones automáticas via Supabase",
  "Instalador one-click con todas las dependencias",
];
