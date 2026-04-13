// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "3.0.2";
export const ACARS_BACKEND = "FSUIPC7 + SimConnect + Supabase Direct";
export const ACARS_SIZE_MB = "~10 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-3.0.2.exe";

export const ACARS_RELEASE_NOTES = [
  "Rediseño UI completo: tema blanco/celeste en todas las páginas",
  "Fix: carga de despacho desde Supabase sin requerir SimBrief",
  "Fix: estado 'dispatched' sincronizado correctamente con ACARS",
  "Web: SimBrief opcional en flujo de despacho",
  "Login y ventana principal actualizados al nuevo tema",
];
