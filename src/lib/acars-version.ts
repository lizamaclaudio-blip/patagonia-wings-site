// Version del cliente ACARS.
// Actualizar solo este archivo al publicar una nueva release del instalador.

export const ACARS_VERSION = "3.2.5";
export const ACARS_BACKEND = "SimConnect + FSUIPC7 fallback + Supabase Direct";
export const ACARS_SIZE_MB = "~24.7 MB";
export const ACARS_DOWNLOAD_URL =
  "https://patagoniaw.com/downloads/PatagoniaWingsACARSSetup.exe";

export const ACARS_RELEASE_NOTES = [
  "Arquitectura SUR Air: luces FLOAT64 individuales (no bitmask), struct de 53 campos alineado",
  "AutopilotHeadingLock, AltitudeLock, Nav1Lock, ApproachHold, WingLeveler añadidos al struct",
  "Patagonia Score (ex SUR Score): renombrado en toda la interfaz",
  "Vuelos numerados PWG101…PWG113, retornos PWGxxx-2",
  "Cierre oficial server-authoritative con score/PIREP oficiales y estados trazables",
  "Resultado oficial persistido para completed, crashed, aborted e interrupted",
  "Version Web 2.0 · ACARS 3.2.5",
];

