// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "2.0.14";
export const ACARS_BACKEND = "FSUIPC7 + SimConnect + Supabase Direct";
export const ACARS_SIZE_MB = "~48 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-2.0.14.exe";

export const ACARS_RELEASE_NOTES = [
  "Pre-Vuelo rediseñado con SimBrief integrado",
  "Importa OFP: combustible, FL crucero y alterno automático",
  "METAR origen y destino en tiempo real",
  "MobiFlight WASM incluido en instalador (sin pasos manuales)",
  "LVARs A32NX: Beacon, Strobe, Landing, Nav, Taxi, N1",
];
