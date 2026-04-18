// Version del cliente ACARS.
// Actualizar solo este archivo al publicar una nueva release del instalador.

export const ACARS_VERSION = "3.2.0";
export const ACARS_BACKEND = "SimConnect + FSUIPC7 fallback + Supabase Direct";
export const ACARS_SIZE_MB = "~22.6 MB";
export const ACARS_DOWNLOAD_URL =
  "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup-3.2.0.exe";

export const ACARS_RELEASE_NOTES = [
  "Sistema de evaluacion SUR Air v5.0: procedimientos (100pts) + performance (base 60)",
  "Calificaciones exactas segun PDF oficial: Proc 100/90/80, Perf ≥100/60/30",
  "Velocidad de taxi corregida a 25 kts y luces NAV evaluadas en todas las fases",
  "VS de aterrizaje categorizado: perfecto 30-180fpm, duro 300-500, accidente >1000",
  "Bonificaciones por vuelo manual, lluvia, viento cruzado y alta elevacion",
  "Penalidades por viento de cola, alabeo excesivo y aproximacion inestable",
  "Version Web 2.0 · ACARS 3.2.0",
];
