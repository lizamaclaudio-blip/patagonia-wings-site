// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "2.0.11";
export const ACARS_BACKEND = "FSUIPC7 + SimConnect + Supabase Direct";
export const ACARS_SIZE_MB = "~48 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-2.0.11.exe";

export const ACARS_RELEASE_NOTES = [
  "Soporte completo Airbus A319 Headwind",
  "MobiFlight WASM Module integrado (luces, N1, transponder)",
  "Fallback automático FSUIPC → SimConnect",
  "Detección automática del avión cargado",
  "Mejoras en login y telemetría",
];
