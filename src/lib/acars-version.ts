// Version del cliente ACARS.
// Actualizar solo este archivo al publicar una nueva release del instalador.

export const ACARS_VERSION = "3.2.1";
export const ACARS_BACKEND = "SimConnect + FSUIPC7 fallback + Supabase Direct";
export const ACARS_SIZE_MB = "~22.6 MB";
export const ACARS_DOWNLOAD_URL =
  "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup-3.2.1.exe";

export const ACARS_RELEASE_NOTES = [
  "Matriz de reglaje final Patagonia Wings aplicada al nucleo de evaluacion",
  "Tabla de aterrizaje oficial: perfecto -60/-180, bueno -181/-250, duro -251/-500, mantenimiento -501/-700",
  "Sistemas de cabina solo penalizan si el perfil del avion los lee de forma confiable",
  "Transponder: solo informativo, no penalizacion dura",
  "Contrato unico Supabase/Web/ACARS sin duplicidades",
  "Version Web 2.0 · ACARS 3.2.1",
];
