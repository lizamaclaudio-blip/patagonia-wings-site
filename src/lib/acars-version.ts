// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "3.0.3";
export const ACARS_BACKEND = "FSUIPC7 + SimConnect + Supabase Direct";
export const ACARS_SIZE_MB = "~10 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-3.0.3.exe";

export const ACARS_RELEASE_NOTES = [
  "Nueva página DESPACHO: strip de vuelo, badge de estado, plan de vuelo, pesos y METAR",
  "Fix: ACARS muestra reservas en estado 'reserved' (no solo 'dispatched')",
  "Fix: fallback query directo a Supabase si la RPC falla",
  "Mensajería clara: indica si hay que despachar o si está listo para volar",
  "Sidebar: Pre-Vuelo renombrado a Despacho con icóno ✈",
];
