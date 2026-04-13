// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "3.0.0";
export const ACARS_BACKEND = "FSUIPC7 + SimConnect + Supabase Direct";
export const ACARS_SIZE_MB = "~10 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-3.0.0.exe";

export const ACARS_RELEASE_NOTES = [
  "Rediseño completo UI: tema blanco/celeste premium en todas las pestañas",
  "Pre-Vuelo real: despacho Supabase + generación SimBrief + importación OFP",
  "Vuelo en Vivo simplificado: luces, altitud, APU, bleed, seatbelt, transponder",
  "Panel adaptativo por aeronave — sección Puertas aparece solo si aplica",
  "Perfil real: métricas Pulso10, Ruta10, Legado, habilitaciones y certificaciones",
];
