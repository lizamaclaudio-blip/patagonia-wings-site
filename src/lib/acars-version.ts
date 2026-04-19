// Version del cliente ACARS.
// Actualizar solo este archivo al publicar una nueva release del instalador.

export const ACARS_VERSION = "3.2.6";
export const ACARS_BACKEND = "SimConnect + FSUIPC7 fallback + Supabase Direct";
export const ACARS_SIZE_MB = "~25.0 MB";
export const ACARS_DOWNLOAD_URL =
  "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup-3.2.6.exe";

export const ACARS_RELEASE_NOTES = [
  "Sistema de 10 fases operacionales: PRE · IGN · TAX · TO · ASC · CRU · DES · LDG · TAG · PAR",
  "Orden de arranque oficial: 2 motores 2-1 · 4 motores 4-2-3-1",
  "Live view: avión animado desplazándose entre origen y destino según progreso real",
  "Cierre server-authoritative: servidor decide completed/crashed/aborted/interrupted/manual_review",
  "PIREP oficial oculto + score server-side persistidos en Supabase",
  "Arquitectura de telemetría extendida: motores 1-4 · autopilot · seatbelt · pressurization",
  "Splash de actualización muestra versión real y reabre ACARS automáticamente",
  "Evaluación por fase con penalizaciones y bonificaciones por etapa",
  "Perfil piloto y condición de aeronave actualizados en cierre oficial",
  "Version Web 2.0 · ACARS 3.2.6",
];

