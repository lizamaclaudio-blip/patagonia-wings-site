// Version visible del cliente ACARS publicada al usuario final.
// La revision interna del updater se controla por manifests remotos.

export const ACARS_VERSION = "7.0.8";
export const ACARS_BACKEND = "Supabase/Web release feed + updater diferencial compatible legacy";
export const ACARS_SIZE_MB = "~30 MB";
export const ACARS_DOWNLOAD_URL =
  "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup.exe";

export const ACARS_RELEASE_NOTES = [
  "Integracion base con SayIntentions.AI (settings, sync y logs server-side).",
  "Landing publica con partner SayIntentions.AI.",
  "Release estable: 7.0.8.",
  "Hotfix Soporte ACARS: pruebas HUD bridge/health/state, diagnostico de update ampliado y estado de simulador.",
  "Cronometro inicia al presionar Iniciar Vuelo, no al moverse la aeronave.",
  "Log ACARS en vivo en Oficina: telemetria, fase, fuel, distancia, eventos.",
  "HUD MSFS in-game panel con bridge local ACARS->HUD.",
  "Finalize con confirmacion real del servidor y summaryUrl obligatorio.",
  "Apertura automatica del resumen web despues de finalize exitoso.",
  "Autoupdate universal reforzado desde cualquier version legacy.",
];
