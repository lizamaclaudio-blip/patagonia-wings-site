// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "3.0.4";
export const ACARS_BACKEND = "FSUIPC7 + SimConnect + Supabase Direct";
export const ACARS_SIZE_MB = "~10 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-3.0.4.exe";

export const ACARS_RELEASE_NOTES = [
  "Fix crítico: crash al abrir la app corregido (AutoUpdater WinForms)",
  "Diálogo de actualización reemplazado por WPF nativo (sin crash)",
  "Nueva página DESPACHO: strip de vuelo, badge de estado, plan de vuelo",
  "Fix: ACARS muestra reservas en estado reserved sin requerir dispatch",
  "Sidebar: Pre-Vuelo renombrado a Despacho con icóno ✈",
];
