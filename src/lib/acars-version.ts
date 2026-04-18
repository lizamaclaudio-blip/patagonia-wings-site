// Version del cliente ACARS.
// Actualizar solo este archivo al publicar una nueva release del instalador.

export const ACARS_VERSION = "3.2.2";
export const ACARS_BACKEND = "SimConnect + FSUIPC7 fallback + Supabase Direct";
export const ACARS_SIZE_MB = "~22.7 MB";
export const ACARS_DOWNLOAD_URL =
  "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup-3.2.2.exe";

export const ACARS_RELEASE_NOTES = [
  "CabinSystemsReliable por perfil: Fenix, FBW, Headwind y MadDog no penalizan sistemas de cabina",
  "Reservas activas se cierran automaticamente al salir de la app o ante crash (cancelled/interrupted)",
  "Fotos de aeronave: fallback por familia cuando no existe imagen especifica",
  "Perfiles actualizados con ImageAsset correcto para todas las aeronaves",
  "Version Web 2.0 · ACARS 3.2.2",
];
