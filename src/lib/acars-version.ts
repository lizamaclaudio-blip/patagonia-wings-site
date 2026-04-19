// Version del cliente ACARS.
// Actualizar solo este archivo al publicar una nueva release del instalador.

export const ACARS_VERSION = "3.2.5";
export const ACARS_BACKEND = "SimConnect + FSUIPC7 fallback + Supabase Direct";
export const ACARS_SIZE_MB = "~25.0 MB";
export const ACARS_DOWNLOAD_URL =
  "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup-3.2.5-r2.exe";

export const ACARS_RELEASE_NOTES = [
  "Arquitectura SUR Air: luces FLOAT64 individuales (no bitmask), struct de 53 campos alineado",
  "AutopilotHeadingLock, AltitudeLock, Nav1Lock, ApproachHold, WingLeveler añadidos al struct",
  "Patagonia Score (ex SUR Score): renombrado en toda la interfaz",
  "Vuelos numerados PWG101…PWG113, retornos PWGxxx-2",
  "Arquitectura SUR Air: luces FLOAT64 individuales (no bitmask), struct de 53 campos alineado",
  "AutopilotHeadingLock, AltitudeLock, Nav1Lock, ApproachHold, WingLeveler añadidos al struct",
  "Patagonia Score (ex SUR Score): renombrado en toda la interfaz",
  "Vuelos numerados PWG101…PWG113, retornos PWGxxx-2",
  "Cierre oficial ACARS server-authoritative con finalize y closeout oficiales",
  "PIREP oficial oculto + score server-side persistidos en backend",
  "Version Web 2.0 · ACARS 3.2.5",
];

