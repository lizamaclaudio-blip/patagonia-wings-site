// ─── Versión del cliente ACARS ──────────────────────────────────────────────
// Actualizar SOLO este archivo cada vez que se suba una nueva versión del ACARS.
// El número se propaga automáticamente a toda la web.

export const ACARS_VERSION = "3.1.7";
export const ACARS_BACKEND = "SimConnect + FSUIPC7 fallback + Supabase Direct";
export const ACARS_SIZE_MB = "~28 MB";
export const ACARS_DOWNLOAD_URL = "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases/PatagoniaWingsACARSSetup-3.1.7.exe";

export const ACARS_RELEASE_NOTES = [
  "Fix luces: detección robusta para todos los addons (Asobo, Black Square, PMDG, Fenix…)",
  "Fix combustible: conversión kg/lbs automática según el backend del simulador",
  "Fix squawk: código de transponder correcto en todos los aviones via FSUIPC",
  "Cronómetro arranca desde block-out (antes del despegue)",
  "Log de procedimientos en tiempo real: luces, fases, AP, cinturones",
  "UI más grande y premium: fuentes aumentadas, indicadores más visibles",
  "Panel de pesos SimBrief vs simulador con comparación al arrancar motores (±10%)",
  "Versión Web 2.0 · ACARS 3.1.7",
];
