// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "3.0.1";
export const ACARS_BACKEND = "FSUIPC7 + SimConnect + Supabase Direct";
export const ACARS_SIZE_MB = "~10 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-3.0.1.exe";

export const ACARS_RELEASE_NOTES = [
  "Fix: GetDispatchPackageStatus con fallback a 'prepared'",
  "Fix: ACARS carga despachos sin requerir SimBrief previo",
  "Web: SimBrief opcional - el ACARS puede generar plan de vuelo",
  "Rediseño UI: tema blanco/celeste premium en todas las pestañas",
  "Perfil real: métricas Pulso10, Ruta10, habilitaciones",
];
