// Version visible del cliente ACARS publicada al usuario final.
// La revision interna del updater se controla por manifests remotos.

export const ACARS_VERSION = "7.0.16";
export const ACARS_BACKEND = "Supabase/Web release feed + updater diferencial compatible legacy";
export const ACARS_SIZE_MB = "~30 MB";
export const ACARS_DOWNLOAD_URL =
  "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup.exe";

export const ACARS_RELEASE_NOTES = [
  "Release estable: 7.0.16.",
  "Resumen web diferencia claramente cierres evaluables, no evaluables y cierres recibidos sin evidencia suficiente.",
  "Prueba owner de PIREP XML habilitada para validar reglaje sin mover wallet ni generar ledger real.",
  "Diagnostico de salary mensual alineado al ledger por piloto/periodo, no por reservation_id.",
  "HUD MSFS in-game independiente Patagonia Wings, por bridge local ACARS->HUD.",
  "Finalize mantiene confirmacion real del servidor con success, persisted, reservationClosed y summaryUrl obligatorio.",
  "Apertura automatica del resumen web despues de finalize exitoso.",
  "Autoupdate universal reforzado desde cualquier version legacy.",
];


