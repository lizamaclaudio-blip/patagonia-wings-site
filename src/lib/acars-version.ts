// Version visible del cliente ACARS publicada al usuario final.
// La revision interna del updater se controla por manifests remotos.

export const ACARS_VERSION = "7.0.1";
export const ACARS_BACKEND = "Supabase/Web release feed + updater diferencial compatible legacy";
export const ACARS_SIZE_MB = "~30 MB";
export const ACARS_DOWNLOAD_URL =
  "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup.exe";

export const ACARS_RELEASE_NOTES = [
  "Autoupdate estable 7.0.1 desde feed publico Supabase/Web.",
  "Compatibilidad legacy reforzada: upgrade desde versiones anteriores.",
  "Descarga directa del instalador oficial + fallback manual.",
  "Telemetria y caja negra ACARS 7 con perfiles/capabilities mejoradas.",
  "Release estable: 7.0.1.",
];
