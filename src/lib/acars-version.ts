// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "3.0.9";
export const ACARS_BACKEND = "SimConnect + FSUIPC7 fallback + Supabase Direct";
export const ACARS_SIZE_MB = "~48 MB";
export const ACARS_DOWNLOAD_URL = "https://github.com/lizamaclaudio-blip/patagonia-wings-acars/releases/latest/download/PatagoniaWingsACARSSetup-3.0.9.exe";

export const ACARS_RELEASE_NOTES = [
  "Luces en tiempo real via LIGHT ON STATES — respuesta inmediata al toggle en cabina",
  "Colores uniformes: verde = encendido / rojo = apagado en todas las luces",
  "Panel SISTEMAS: APU y Bleed Air ocultos en aeronaves sin esos sistemas (C208, GA)",
  "Detección de +60 variantes de aeronaves MSFS 2020/2024",
  "Scoring PIREP justo: sin penalización de presurización en C208, BE58 y GA",
  "SimConnect como backend primario, FSUIPC7 como fallback automático",
  "Versión Web 2.0 · ACARS 3.0.9",
];
