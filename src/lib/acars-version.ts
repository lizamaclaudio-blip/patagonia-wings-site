// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "3.0.6";
export const ACARS_BACKEND = "FSUIPC7 + SimConnect + Supabase Direct";
export const ACARS_SIZE_MB = "~10 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-3.0.6.exe";

export const ACARS_RELEASE_NOTES = [
  "Fix: dialogo de actualizacion ya no aparece si la app está al día",
  "Fix crítico: ACARS ahora carga la reserva correctamente desde Supabase",
  "Fix: query corregido a columnas reales origin_ident/destination_ident",
  "Fix: eliminada dependencia a RPC inexistente en Supabase",
  "Fix: crash al abrir app corregido (AutoUpdater WinForms → WPF nativo)",
  "Sidebar: Pre-Vuelo renombrado a Despacho con ícono ✈",
];
