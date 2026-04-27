// Patagonia Wings Economy Core
// Centraliza pagos piloto, compatibilidad aeronave-ruta, costos operacionales, ingresos estimados, flota y métricas.
// Regla: los componentes UI no deben duplicar fórmulas económicas.

/** Returns the last business day (Mon–Fri) of the given month as "DD de Mes de YYYY" */
export function lastBusinessDayLabel(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  while (last.getUTCDay() === 0 || last.getUTCDay() === 6) last.setUTCDate(last.getUTCDate() - 1);
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${last.getUTCDate()} de ${MONTHS[last.getUTCMonth()]} de ${last.getUTCFullYear()}`;
}

/** Returns the last business day of a month as ISO date string YYYY-MM-DD */
export function lastBusinessDayIso(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  while (last.getUTCDay() === 0 || last.getUTCDay() === 6) last.setUTCDate(last.getUTCDate() - 1);
  return last.toISOString().slice(0, 10);
}

export type AircraftCategory = "widebody" | "narrowbody" | "regional" | "ga";
export type FlightMode = "CAREER" | "CHARTER" | "TRAINING" | "EVENT" | string;
export type EconomySource = "estimate" | "simbrief" | "actual";
export type RouteBand = "local" | "regional" | "national" | "international" | "longhaul" | "intercontinental";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const money = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const int = (value: number) => Math.round(Number.isFinite(value) ? value : 0);

const REPAIR_BASE: Record<AircraftCategory, number> = {
  ga: 800,
  regional: 2000,
  narrowbody: 5000,
  widebody: 12000,
};

const WIDEBODY_CODES = ["B777", "B747", "B787", "B767", "B752", "A380", "A350", "A330", "A340", "A310", "A339", "A359", "B789", "B77W"];
const NARROWBODY_CODES = ["B737", "B738", "B739", "B735", "B736", "A319", "A320", "A321", "A20N", "A21N", "B757", "B38M"];
const REGIONAL_CODES = ["DH8", "DHC8", "DHC6", "AT72", "AT76", "ATR", "CRJ", "E170", "E175", "E190", "E195", "SF34", "BE20", "B350", "C208", "PC12"];

export function classifyAircraft(typeCode: string | null | undefined): AircraftCategory {
  const code = (typeCode ?? "").toUpperCase().replace(/\s/g, "");
  if (WIDEBODY_CODES.some((c) => code.startsWith(c))) return "widebody";
  if (NARROWBODY_CODES.some((c) => code.startsWith(c))) return "narrowbody";
  if (REGIONAL_CODES.some((c) => code.startsWith(c))) return "regional";
  return "ga";
}

export type AircraftEconomyProfile = {
  category: AircraftCategory;
  seats: number;
  bellyCargoKg: number;
  cargoKg: number;
  fuelBurnKgPerNm: number;
  maintenanceUsdPerBlockHour: number;
  estimatedMarketValueUsd: number;
  airportFeeMultiplier: number;
  handlingBaseUsd: number;
  cabinService: boolean;
  internationalRetail: boolean;
  practicalRangeNm: number;
  usableFuelCapacityKg: number;
  runwayRequirementM: number;
  internationalCapable: boolean;
  longHaulCapable: boolean;
};

const CATEGORY_PROFILE: Record<AircraftCategory, AircraftEconomyProfile> = {
  ga: { category: "ga", seats: 5, bellyCargoKg: 80, cargoKg: 180, fuelBurnKgPerNm: 0.45, maintenanceUsdPerBlockHour: 70, estimatedMarketValueUsd: 1200000, airportFeeMultiplier: 0.45, handlingBaseUsd: 35, cabinService: false, internationalRetail: false, practicalRangeNm: 650, usableFuelCapacityKg: 300, runwayRequirementM: 750, internationalCapable: false, longHaulCapable: false },
  regional: { category: "regional", seats: 70, bellyCargoKg: 650, cargoKg: 2400, fuelBurnKgPerNm: 3.5, maintenanceUsdPerBlockHour: 430, estimatedMarketValueUsd: 18000000, airportFeeMultiplier: 0.85, handlingBaseUsd: 135, cabinService: true, internationalRetail: false, practicalRangeNm: 1350, usableFuelCapacityKg: 5200, runwayRequirementM: 1300, internationalCapable: true, longHaulCapable: false },
  narrowbody: { category: "narrowbody", seats: 174, bellyCargoKg: 1800, cargoKg: 5200, fuelBurnKgPerNm: 8.2, maintenanceUsdPerBlockHour: 1250, estimatedMarketValueUsd: 65000000, airportFeeMultiplier: 1.15, handlingBaseUsd: 360, cabinService: true, internationalRetail: true, practicalRangeNm: 3050, usableFuelCapacityKg: 21000, runwayRequirementM: 2250, internationalCapable: true, longHaulCapable: false },
  widebody: { category: "widebody", seats: 290, bellyCargoKg: 9500, cargoKg: 22000, fuelBurnKgPerNm: 22, maintenanceUsdPerBlockHour: 4200, estimatedMarketValueUsd: 185000000, airportFeeMultiplier: 1.75, handlingBaseUsd: 920, cabinService: true, internationalRetail: true, practicalRangeNm: 7200, usableFuelCapacityKg: 110000, runwayRequirementM: 3100, internationalCapable: true, longHaulCapable: true },
};

const SPECIFIC_AIRCRAFT_PROFILES: Array<[RegExp, Partial<AircraftEconomyProfile>]> = [
  [/^C172/, { category: "ga", seats: 3, bellyCargoKg: 35, cargoKg: 70, fuelBurnKgPerNm: 0.18, maintenanceUsdPerBlockHour: 45, estimatedMarketValueUsd: 450000, airportFeeMultiplier: 0.35, handlingBaseUsd: 25, cabinService: false, internationalRetail: false, practicalRangeNm: 480, usableFuelCapacityKg: 150, runwayRequirementM: 650, internationalCapable: false, longHaulCapable: false }],
  [/^BE58/, { category: "ga", seats: 5, bellyCargoKg: 80, cargoKg: 180, fuelBurnKgPerNm: 0.42, maintenanceUsdPerBlockHour: 70, estimatedMarketValueUsd: 850000, airportFeeMultiplier: 0.45, handlingBaseUsd: 35, cabinService: false, internationalRetail: false, practicalRangeNm: 780, usableFuelCapacityKg: 310, runwayRequirementM: 850, internationalCapable: false, longHaulCapable: false }],
  [/^TBM9/, { category: "ga", seats: 5, bellyCargoKg: 90, cargoKg: 220, fuelBurnKgPerNm: 0.58, maintenanceUsdPerBlockHour: 110, estimatedMarketValueUsd: 4200000, airportFeeMultiplier: 0.55, handlingBaseUsd: 55, cabinService: false, internationalRetail: false, practicalRangeNm: 1300, usableFuelCapacityKg: 880, runwayRequirementM: 950, internationalCapable: true, longHaulCapable: false }],
  [/^C208/, { category: "ga", seats: 9, bellyCargoKg: 180, cargoKg: 1100, fuelBurnKgPerNm: 0.78, maintenanceUsdPerBlockHour: 85, estimatedMarketValueUsd: 2500000, airportFeeMultiplier: 0.55, handlingBaseUsd: 60, cabinService: false, internationalRetail: false, practicalRangeNm: 800, usableFuelCapacityKg: 1000, runwayRequirementM: 750, internationalCapable: false, longHaulCapable: false }],
  [/^DHC6/, { category: "regional", seats: 19, bellyCargoKg: 260, cargoKg: 1400, fuelBurnKgPerNm: 1.18, maintenanceUsdPerBlockHour: 190, estimatedMarketValueUsd: 6500000, airportFeeMultiplier: 0.62, handlingBaseUsd: 85, cabinService: false, internationalRetail: false, practicalRangeNm: 740, usableFuelCapacityKg: 1700, runwayRequirementM: 550, internationalCapable: true, longHaulCapable: false }],
  [/^B350|^BE20/, { category: "regional", seats: 9, bellyCargoKg: 140, cargoKg: 600, fuelBurnKgPerNm: 0.92, maintenanceUsdPerBlockHour: 130, estimatedMarketValueUsd: 5200000, airportFeeMultiplier: 0.58, handlingBaseUsd: 75, cabinService: false, internationalRetail: false, practicalRangeNm: 1450, usableFuelCapacityKg: 1600, runwayRequirementM: 1150, internationalCapable: true, longHaulCapable: false }],
  [/^AT7|^ATR/, { category: "regional", seats: 70, bellyCargoKg: 600, cargoKg: 2400, fuelBurnKgPerNm: 3.2, maintenanceUsdPerBlockHour: 430, estimatedMarketValueUsd: 24000000, airportFeeMultiplier: 0.82, handlingBaseUsd: 135, cabinService: true, internationalRetail: false, practicalRangeNm: 825, usableFuelCapacityKg: 5000, runwayRequirementM: 1300, internationalCapable: true, longHaulCapable: false }],
  [/^E175|^E17/, { category: "regional", seats: 78, bellyCargoKg: 900, cargoKg: 3100, fuelBurnKgPerNm: 4.9, maintenanceUsdPerBlockHour: 650, estimatedMarketValueUsd: 32000000, airportFeeMultiplier: 0.9, handlingBaseUsd: 170, cabinService: true, internationalRetail: true, practicalRangeNm: 1800, usableFuelCapacityKg: 9200, runwayRequirementM: 1800, internationalCapable: true, longHaulCapable: false }],
  [/^E190|^E195|^E19/, { category: "regional", seats: 104, bellyCargoKg: 1250, cargoKg: 3900, fuelBurnKgPerNm: 5.8, maintenanceUsdPerBlockHour: 780, estimatedMarketValueUsd: 47000000, airportFeeMultiplier: 0.98, handlingBaseUsd: 210, cabinService: true, internationalRetail: true, practicalRangeNm: 2100, usableFuelCapacityKg: 12800, runwayRequirementM: 1950, internationalCapable: true, longHaulCapable: false }],
  [/^A319/, { category: "narrowbody", seats: 144, bellyCargoKg: 1450, cargoKg: 4500, fuelBurnKgPerNm: 7.5, maintenanceUsdPerBlockHour: 1150, estimatedMarketValueUsd: 50000000, airportFeeMultiplier: 1.08, handlingBaseUsd: 310, cabinService: true, internationalRetail: true, practicalRangeNm: 3300, usableFuelCapacityKg: 19000, runwayRequirementM: 2100, internationalCapable: true, longHaulCapable: false }],
  [/^A320|^A20N/, { category: "narrowbody", seats: 180, bellyCargoKg: 1900, cargoKg: 5200, fuelBurnKgPerNm: 8.1, maintenanceUsdPerBlockHour: 1250, estimatedMarketValueUsd: 72000000, airportFeeMultiplier: 1.15, handlingBaseUsd: 360, cabinService: true, internationalRetail: true, practicalRangeNm: 3150, usableFuelCapacityKg: 21000, runwayRequirementM: 2250, internationalCapable: true, longHaulCapable: false }],
  [/^A321|^A21N/, { category: "narrowbody", seats: 214, bellyCargoKg: 2500, cargoKg: 6800, fuelBurnKgPerNm: 9.2, maintenanceUsdPerBlockHour: 1450, estimatedMarketValueUsd: 85000000, airportFeeMultiplier: 1.22, handlingBaseUsd: 420, cabinService: true, internationalRetail: true, practicalRangeNm: 3400, usableFuelCapacityKg: 23500, runwayRequirementM: 2350, internationalCapable: true, longHaulCapable: false }],
  [/^B736/, { category: "narrowbody", seats: 123, bellyCargoKg: 1250, cargoKg: 3900, fuelBurnKgPerNm: 6.7, maintenanceUsdPerBlockHour: 1150, estimatedMarketValueUsd: 42000000, airportFeeMultiplier: 1.03, handlingBaseUsd: 290, cabinService: true, internationalRetail: true, practicalRangeNm: 2800, usableFuelCapacityKg: 17500, runwayRequirementM: 2050, internationalCapable: true, longHaulCapable: false }],
  [/^B737|^B738/, { category: "narrowbody", seats: 174, bellyCargoKg: 1800, cargoKg: 5200, fuelBurnKgPerNm: 8.3, maintenanceUsdPerBlockHour: 1350, estimatedMarketValueUsd: 78000000, airportFeeMultiplier: 1.15, handlingBaseUsd: 370, cabinService: true, internationalRetail: true, practicalRangeNm: 2950, usableFuelCapacityKg: 20500, runwayRequirementM: 2250, internationalCapable: true, longHaulCapable: false }],
  [/^B739/, { category: "narrowbody", seats: 189, bellyCargoKg: 2100, cargoKg: 6100, fuelBurnKgPerNm: 8.8, maintenanceUsdPerBlockHour: 1450, estimatedMarketValueUsd: 82000000, airportFeeMultiplier: 1.18, handlingBaseUsd: 390, cabinService: true, internationalRetail: true, practicalRangeNm: 2900, usableFuelCapacityKg: 22000, runwayRequirementM: 2400, internationalCapable: true, longHaulCapable: false }],
  [/^B38M/, { category: "narrowbody", seats: 189, bellyCargoKg: 2200, cargoKg: 6500, fuelBurnKgPerNm: 7.8, maintenanceUsdPerBlockHour: 1500, estimatedMarketValueUsd: 95000000, airportFeeMultiplier: 1.2, handlingBaseUsd: 410, cabinService: true, internationalRetail: true, practicalRangeNm: 3300, usableFuelCapacityKg: 21500, runwayRequirementM: 2300, internationalCapable: true, longHaulCapable: false }],
  [/^A339|^A330/, { category: "widebody", seats: 287, bellyCargoKg: 8500, cargoKg: 23000, fuelBurnKgPerNm: 19.5, maintenanceUsdPerBlockHour: 3450, estimatedMarketValueUsd: 150000000, airportFeeMultiplier: 1.68, handlingBaseUsd: 840, cabinService: true, internationalRetail: true, practicalRangeNm: 7000, usableFuelCapacityKg: 111000, runwayRequirementM: 2950, internationalCapable: true, longHaulCapable: true }],
  [/^A359|^A350/, { category: "widebody", seats: 315, bellyCargoKg: 9500, cargoKg: 25000, fuelBurnKgPerNm: 18.8, maintenanceUsdPerBlockHour: 3800, estimatedMarketValueUsd: 180000000, airportFeeMultiplier: 1.78, handlingBaseUsd: 920, cabinService: true, internationalRetail: true, practicalRangeNm: 8000, usableFuelCapacityKg: 115000, runwayRequirementM: 3000, internationalCapable: true, longHaulCapable: true }],
  [/^B789|^B787/, { category: "widebody", seats: 296, bellyCargoKg: 9000, cargoKg: 24000, fuelBurnKgPerNm: 18.6, maintenanceUsdPerBlockHour: 3600, estimatedMarketValueUsd: 160000000, airportFeeMultiplier: 1.72, handlingBaseUsd: 880, cabinService: true, internationalRetail: true, practicalRangeNm: 7300, usableFuelCapacityKg: 101000, runwayRequirementM: 3000, internationalCapable: true, longHaulCapable: true }],
  [/^B77|^B777/, { category: "widebody", seats: 368, bellyCargoKg: 12000, cargoKg: 30000, fuelBurnKgPerNm: 25.5, maintenanceUsdPerBlockHour: 5200, estimatedMarketValueUsd: 210000000, airportFeeMultiplier: 1.95, handlingBaseUsd: 1120, cabinService: true, internationalRetail: true, practicalRangeNm: 7200, usableFuelCapacityKg: 145000, runwayRequirementM: 3200, internationalCapable: true, longHaulCapable: true }],
  [/^B747/, { category: "widebody", seats: 416, bellyCargoKg: 16000, cargoKg: 36000, fuelBurnKgPerNm: 30.5, maintenanceUsdPerBlockHour: 6500, estimatedMarketValueUsd: 130000000, airportFeeMultiplier: 2.08, handlingBaseUsd: 1350, cabinService: true, internationalRetail: true, practicalRangeNm: 7000, usableFuelCapacityKg: 163000, runwayRequirementM: 3300, internationalCapable: true, longHaulCapable: true }],
];

export function getAircraftEconomyProfile(aircraftTypeCode?: string | null): AircraftEconomyProfile {
  const code = (aircraftTypeCode ?? "").toUpperCase().replace(/\s/g, "");
  const category = classifyAircraft(code);
  const base = CATEGORY_PROFILE[category];
  const specific = SPECIFIC_AIRCRAFT_PROFILES.find(([pattern]) => pattern.test(code))?.[1];
  return { ...base, ...(specific ?? {}), category: specific?.category ?? base.category };
}

export function estimateAircraftMarketValueUsd(aircraftTypeCode?: string | null): number {
  return getAircraftEconomyProfile(aircraftTypeCode).estimatedMarketValueUsd;
}

export function estimateFleetInvestmentUsd(aircraftTypeCodes: Array<string | null | undefined>): number {
  return money(aircraftTypeCodes.reduce((sum, code) => sum + estimateAircraftMarketValueUsd(code), 0));
}

export function getRouteBand(distanceNm: number): RouteBand {
  if (distanceNm >= 5000) return "intercontinental";
  if (distanceNm >= 2600) return "longhaul";
  if (distanceNm >= 900) return "international";
  if (distanceNm >= 350) return "national";
  if (distanceNm >= 80) return "regional";
  return "local";
}

export function isAircraftCompatibleWithRoute({ aircraftTypeCode, distanceNm, operationCategory, originCountry, destinationCountry }: { aircraftTypeCode?: string | null; distanceNm: number; operationCategory?: string | null; originCountry?: string | null; destinationCountry?: string | null }): { compatible: boolean; reason: string } {
  const profile = getAircraftEconomyProfile(aircraftTypeCode);
  const band = getRouteBand(Math.max(0, distanceNm));
  const international = !!originCountry && !!destinationCountry && originCountry !== destinationCountry;
  const category = (operationCategory ?? "").toLowerCase();
  const requiredFuelKg = estimateFuelKg(distanceNm, aircraftTypeCode);
  if (requiredFuelKg > profile.usableFuelCapacityKg * 0.92) return { compatible: false, reason: "Combustible requerido supera capacidad utilizable; requiere escala técnica." };
  if (distanceNm > profile.practicalRangeNm) return { compatible: false, reason: "Ruta fuera del alcance práctico de la aeronave." };
  if ((band === "longhaul" || band === "intercontinental" || category === "long_haul" || category === "intercontinental") && !profile.longHaulCapable) return { compatible: false, reason: "Ruta de largo alcance requiere aeronave long haul." };
  if (international && !profile.internationalCapable) return { compatible: false, reason: "Aeronave no apta para operación internacional en este modelo." };
  return { compatible: true, reason: "Compatible con la ruta." };
}


export type AircraftRouteCandidate = {
  aircraft_id?: string | null;
  aircraft_type_code?: string | null;
  aircraft_code?: string | null;
  tail_number?: string | null;
  current_airport_icao?: string | null;
  current_airport_code?: string | null;
  status?: string | null;
  selectable?: boolean | null;
  maintenance_required?: boolean | null;
  maintenance_reason?: string | null;
  [key: string]: unknown;
};

export type AircraftRouteRejection<T = AircraftRouteCandidate> = {
  aircraft: T;
  reason: string;
  code: string;
};

export type AircraftRouteFilterResult<T = AircraftRouteCandidate> = {
  compatibleAircraft: T[];
  rejectedAircraft: AircraftRouteRejection<T>[];
};

function getCandidateAircraftTypeCode(candidate: AircraftRouteCandidate | string | null | undefined): string {
  if (typeof candidate === "string") return candidate.trim().toUpperCase();
  if (!candidate) return "";
  return String(candidate.aircraft_type_code ?? candidate.aircraft_code ?? "").trim().toUpperCase();
}

function getCandidateAirport(candidate: AircraftRouteCandidate): string {
  return String(candidate.current_airport_icao ?? candidate.current_airport_code ?? "").trim().toUpperCase();
}

function getCandidateStatus(candidate: AircraftRouteCandidate): string {
  return String(candidate.status ?? "available").trim().toLowerCase();
}

export function filterAircraftTypesForRoute({
  aircraftTypeCodes,
  distanceNm,
  operationCategory = null,
  originCountry = null,
  destinationCountry = null,
}: {
  aircraftTypeCodes: string[];
  distanceNm: number;
  operationCategory?: string | null;
  originCountry?: string | null;
  destinationCountry?: string | null;
}): { compatibleTypes: string[]; rejectedTypes: Array<{ type: string; reason: string }> } {
  const uniqueTypes = Array.from(new Set(aircraftTypeCodes.map((type) => String(type ?? "").trim().toUpperCase()).filter(Boolean)));
  const compatibleTypes: string[] = [];
  const rejectedTypes: Array<{ type: string; reason: string }> = [];

  for (const type of uniqueTypes) {
    const check = isAircraftCompatibleWithRoute({
      aircraftTypeCode: type,
      distanceNm,
      operationCategory,
      originCountry,
      destinationCountry,
    });

    if (check.compatible) compatibleTypes.push(type);
    else rejectedTypes.push({ type, reason: check.reason });
  }

  return { compatibleTypes, rejectedTypes };
}

export function filterAircraftForPilotRoute<T extends AircraftRouteCandidate>({
  aircraft,
  originIcao,
  distanceNm,
  operationCategory = null,
  originCountry = null,
  destinationCountry = null,
  requireSelectable = true,
}: {
  aircraft: T[];
  originIcao?: string | null;
  distanceNm: number;
  operationCategory?: string | null;
  originCountry?: string | null;
  destinationCountry?: string | null;
  requireSelectable?: boolean;
}): AircraftRouteFilterResult<T> {
  const origin = String(originIcao ?? "").trim().toUpperCase();
  const compatibleAircraft: T[] = [];
  const rejectedAircraft: AircraftRouteRejection<T>[] = [];

  for (const item of aircraft) {
    const typeCode = getCandidateAircraftTypeCode(item);
    const currentAirport = getCandidateAirport(item);
    const status = getCandidateStatus(item);

    if (!typeCode) {
      rejectedAircraft.push({ aircraft: item, reason: "Aeronave sin tipo operacional definido.", code: "missing_type" });
      continue;
    }

    if (origin && currentAirport && currentAirport !== origin) {
      rejectedAircraft.push({ aircraft: item, reason: "La aeronave no está físicamente en el aeropuerto de origen.", code: "wrong_airport" });
      continue;
    }

    if (requireSelectable && item.selectable === false) {
      rejectedAircraft.push({ aircraft: item, reason: "Aeronave no seleccionable para despacho.", code: "not_selectable" });
      continue;
    }

    if (["maintenance", "in_maintenance", "unavailable", "grounded"].includes(status) || item.maintenance_required === true) {
      rejectedAircraft.push({ aircraft: item, reason: item.maintenance_reason || "Aeronave en mantenimiento o no disponible.", code: "maintenance" });
      continue;
    }

    const check = isAircraftCompatibleWithRoute({
      aircraftTypeCode: typeCode,
      distanceNm,
      operationCategory,
      originCountry,
      destinationCountry,
    });

    if (!check.compatible) {
      rejectedAircraft.push({ aircraft: item, reason: check.reason, code: "route_compatibility" });
      continue;
    }

    compatibleAircraft.push(item);
  }

  return { compatibleAircraft, rejectedAircraft };
}

const PILOT_AIRCRAFT_RESPONSIBILITY: Record<AircraftCategory, number> = { ga: 0.75, regional: 1.0, narrowbody: 1.25, widebody: 1.55 };
const PILOT_OPERATION_MULTIPLIER: Record<string, number> = { CAREER: 1.0, ITINERARY: 1.0, CHARTER: 1.25, TRAINING: 0.35, EVENT: 0.8, TOUR: 0.8, SPECIAL_MISSION: 1.15 };
const PILOT_PAY_RULES: Record<RouteBand, { min: number; max: number; base: number; hourly: number; distance: number }> = {
  local: { min: 18, max: 60, base: 14, hourly: 16, distance: 0.015 },
  regional: { min: 25, max: 180, base: 22, hourly: 22, distance: 0.015 },
  national: { min: 60, max: 320, base: 45, hourly: 32, distance: 0.02 },
  international: { min: 120, max: 700, base: 90, hourly: 48, distance: 0.018 },
  longhaul: { min: 350, max: 1500, base: 250, hourly: 68, distance: 0.012 },
  intercontinental: { min: 500, max: 1800, base: 340, hourly: 72, distance: 0.012 },
};

export function calculateFlightCommission({ distanceNm, blockMinutes, aircraftTypeCode, flightModeCode }: { distanceNm: number; blockMinutes: number; aircraftTypeCode?: string | null; flightModeCode?: string | null }): number {
  const dist = Math.max(0, Number(distanceNm) || 0);
  const blockHours = Math.max(0, Number(blockMinutes) || 0) / 60;
  const band = getRouteBand(dist);
  const rule = PILOT_PAY_RULES[band];
  const category = classifyAircraft(aircraftTypeCode);
  const modeKey = (flightModeCode ?? "CAREER").toUpperCase();
  const base = rule.base + blockHours * rule.hourly + dist * rule.distance;
  const raw = base * PILOT_AIRCRAFT_RESPONSIBILITY[category] * (PILOT_OPERATION_MULTIPLIER[modeKey] ?? 1.0);
  return money(clamp(raw, rule.min, rule.max));
}

export function calculateDamageDeduction(damageEvents: Array<{ severity?: string | null }>, aircraftTypeCode?: string | null): number {
  const hasSeriousDamage = damageEvents.some((e) => e.severity === "heavy" || e.severity === "critical");
  if (!hasSeriousDamage) return 0;
  return money(REPAIR_BASE[classifyAircraft(aircraftTypeCode)] * 0.1);
}

export function estimateBlockMinutes(distanceNm: number): number {
  if (distanceNm <= 0) return 0;
  const cruiseKts = distanceNm > 5000 ? 488 : distanceNm > 2600 ? 480 : distanceNm > 900 ? 450 : distanceNm > 250 ? 360 : 240;
  const overhead = distanceNm > 5000 ? 90 : distanceNm > 2600 ? 80 : distanceNm > 900 ? 60 : distanceNm > 250 ? 45 : 32;
  return Math.max(25, Math.round((distanceNm / cruiseKts) * 60 + overhead));
}

export function estimateFuelKg(distanceNm: number, aircraftTypeCode?: string | null): number {
  if (distanceNm <= 0) return 0;
  const profile = getAircraftEconomyProfile(aircraftTypeCode);
  const tripFuel = distanceNm * profile.fuelBurnKgPerNm;
  const taxiFuel = profile.category === "widebody" ? 1800 : profile.category === "narrowbody" ? 650 : profile.category === "regional" ? 220 : 45;
  const contingencyFuel = tripFuel * 0.08;
  const finalReserve = profile.category === "widebody" ? 4500 : profile.category === "narrowbody" ? 1600 : profile.category === "regional" ? 450 : 90;
  return int(tripFuel + taxiFuel + contingencyFuel + finalReserve);
}

export type FuelPriceContext = {
  originCountry?: string | null;
  destinationCountry?: string | null;
  originCity?: string | null;
  destinationCity?: string | null;
  originIcao?: string | null;
  destinationIcao?: string | null;
  fuelType?: "JetA1" | "AVGAS" | string;
};

const COUNTRY_FUEL_PRICE_USD_PER_KG: Record<string, number> = { CL: 1.44, CHL: 1.44, Chile: 1.44, AR: 1.34, ARG: 1.34, Argentina: 1.34, BR: 1.52, BRA: 1.52, Brasil: 1.52, Brazil: 1.52, PE: 1.48, Peru: 1.48, BO: 1.36, Bolivia: 1.36, UY: 1.55, Uruguay: 1.55, PY: 1.42, Paraguay: 1.42, US: 1.25, USA: 1.25, "Estados Unidos": 1.25, ES: 1.72, España: 1.72, FR: 1.78, Francia: 1.78, GB: 1.82, "Reino Unido": 1.82, AE: 1.32, "Emiratos Árabes Unidos": 1.32, default: 1.45 };
const AIRPORT_FUEL_PRICE_USD_PER_KG: Record<string, number> = { SCEL: 1.44, SCTE: 1.56, SCIE: 1.5, SCCI: 1.75, SCTB: 1.52, SCPF: 1.6, SCRD: 1.52, SCJO: 1.56, SCPQ: 1.62, SCTN: 1.68, SCFT: 1.68, SCQP: 1.52, SCVD: 1.55, SCSN: 1.52, SCNT: 1.72, SCBA: 1.66, SCFA: 1.5, SCCF: 1.5, SCDA: 1.5, SABE: 1.36, SAEZ: 1.34, SACO: 1.3, SAME: 1.34, SAZN: 1.36, SAZS: 1.42, SAVC: 1.46, SAWG: 1.48, SAWH: 1.52, SARI: 1.38, SASA: 1.38, SAAR: 1.34, SPJC: 1.48, SLLP: 1.36, SBGR: 1.52, KMIA: 1.25, KJFK: 1.3, KLAX: 1.32, LEMD: 1.72, LFPG: 1.78, EGLL: 1.82, OMDB: 1.32 };

export function estimateFuelPriceUsdPerKg(ctx: FuelPriceContext = {}): number {
  const originIcao = (ctx.originIcao ?? "").toUpperCase();
  if (originIcao && AIRPORT_FUEL_PRICE_USD_PER_KG[originIcao]) return AIRPORT_FUEL_PRICE_USD_PER_KG[originIcao];
  const country = (ctx.originCountry ?? ctx.destinationCountry ?? "").trim();
  return COUNTRY_FUEL_PRICE_USD_PER_KG[country] ?? COUNTRY_FUEL_PRICE_USD_PER_KG[country.toUpperCase()] ?? COUNTRY_FUEL_PRICE_USD_PER_KG.default;
}

export function estimateFuelCostUsd(distanceNm: number, aircraftTypeCode?: string | null, ctx: FuelPriceContext = {}): number {
  return money(estimateFuelKg(distanceNm, aircraftTypeCode) * estimateFuelPriceUsdPerKg(ctx));
}

export function estimateWearCostPerHour(aircraftTypeCode?: string | null): number {
  return getAircraftEconomyProfile(aircraftTypeCode).maintenanceUsdPerBlockHour;
}

export function estimateMaintenanceCostUsd(distanceNm: number, aircraftTypeCode?: string | null): number {
  return money((estimateBlockMinutes(distanceNm) / 60) * estimateWearCostPerHour(aircraftTypeCode));
}

function routeBand(distanceNm: number): "regional" | "national" | "international" | "longhaul" {
  const band = getRouteBand(distanceNm);
  if (band === "local") return "regional";
  if (band === "intercontinental") return "longhaul";
  return band;
}

function loadFactorFor(operationType: string, distanceNm: number) {
  const op = operationType.toUpperCase();
  if (op === "CHARTER") return distanceNm > 900 ? 0.9 : 0.88;
  if (op === "TRAINING") return 0;
  if (op === "EVENT") return 0.76;
  const band = getRouteBand(distanceNm);
  return band === "local" ? 0.68 : band === "regional" ? 0.76 : band === "national" ? 0.82 : band === "international" ? 0.8 : 0.84;
}

function averageFareUsd(distanceNm: number, operationType: string, international: boolean) {
  const op = operationType.toUpperCase();
  if (op === "TRAINING") return 0;
  const band = getRouteBand(distanceNm);
  const base = international ? 82 : band === "local" ? 38 : 58;
  const fare = base + distanceNm * (international ? 0.15 : 0.115);
  const bounded = clamp(fare, international ? 105 : 45, band === "intercontinental" ? 950 : band === "longhaul" ? 760 : band === "international" ? 420 : 290);
  return money(op === "CHARTER" ? bounded * 1.45 : bounded);
}

function cargoRateUsdPerKg(distanceNm: number, operationType: string) {
  const op = operationType.toUpperCase();
  const rate = 0.2 + Math.min(distanceNm, 5000) * 0.00009;
  return money(op === "CHARTER" ? rate * 1.25 : rate);
}

function marginMultiplier(operationType: string, distanceNm: number, international: boolean) {
  const op = operationType.toUpperCase();
  if (op === "CHARTER") return 1.35;
  if (op === "TRAINING") return 1.04;
  if (op === "EVENT") return 1.18;
  const band = routeBand(distanceNm);
  if (band === "regional") return 1.2;
  if (band === "national") return 1.18;
  if (band === "international" || international) return 1.16;
  return 1.14;
}

export type EstimateFlightEconomyInput = FuelPriceContext & {
  distanceNm: number;
  blockMinutes?: number | null;
  aircraftTypeCode?: string | null;
  operationType?: FlightMode | null;
  operationCategory?: string | null;
  isCargo?: boolean | null;
  passengerCount?: number | null;
  cargoKg?: number | null;
  actualFuelKg?: number | null;
  damageCostUsd?: number | null;
  economySource?: EconomySource;
};

export type FlightEconomyEstimate = {
  distanceNm: number; blockMinutes: number; routeBand: RouteBand; aircraftCategory: AircraftCategory; aircraftValueUsd: number; aircraftCompatible: boolean; compatibilityReason: string; practicalRangeNm: number; usableFuelCapacityKg: number; estimatedPassengers: number; estimatedCargoKg: number; loadFactor: number; averageFareUsd: number; passengerRevenueUsd: number; cargoRevenueUsd: number; charterRevenueUsd: number; airlineRevenueUsd: number; fuelKg: number; fuelLiters: number; fuelPriceUsdPerKg: number; fuelCostUsd: number; maintenanceCostUsd: number; airportFeesUsd: number; handlingCostUsd: number; pilotCommissionUsd: number; pilotPaymentUsd: number; repairReserveUsd: number; onboardServiceRevenueUsd: number; onboardSalesRevenueUsd: number; onboardServiceCostUsd: number; hasCabinService: boolean; isInternational: boolean; totalCostUsd: number; netProfitUsd: number; profitMarginPct: number; economySource: EconomySource; confidenceLabel: string;
};

export function estimateFlightEconomy(input: EstimateFlightEconomyInput): FlightEconomyEstimate {
  const distanceNm = Math.max(0, Number(input.distanceNm) || 0);
  const blockMinutes = input.blockMinutes && input.blockMinutes > 0 ? Math.round(input.blockMinutes) : estimateBlockMinutes(distanceNm);
  const operationType = (input.operationType ?? "CAREER").toString().toUpperCase();
  const profile = getAircraftEconomyProfile(input.aircraftTypeCode);
  const band = getRouteBand(distanceNm);
  const international = !!input.originCountry && !!input.destinationCountry && input.originCountry !== input.destinationCountry;
  const compatibility = isAircraftCompatibleWithRoute({ aircraftTypeCode: input.aircraftTypeCode, distanceNm, operationCategory: input.operationCategory, originCountry: input.originCountry, destinationCountry: input.destinationCountry });
  const loadFactor = loadFactorFor(operationType, distanceNm);
  const passengerCount = input.passengerCount != null ? Math.max(0, Math.round(input.passengerCount)) : Math.round(profile.seats * loadFactor);
  const cargoKg = input.cargoKg != null ? Math.max(0, Math.round(input.cargoKg)) : Math.round((input.isCargo ? profile.cargoKg : profile.bellyCargoKg) * (operationType === "CHARTER" ? 0.72 : 0.52));
  const fareUsd = averageFareUsd(distanceNm, operationType, international);
  const passengerRevenue = operationType === "TRAINING" ? 0 : money(passengerCount * fareUsd);
  const cargoRevenue = operationType === "TRAINING" ? 0 : money(cargoKg * cargoRateUsdPerKg(distanceNm, operationType));
  const hasCabinService = profile.cabinService && passengerCount > 0 && operationType !== "TRAINING";
  const onboardServiceRevenueUsd = hasCabinService ? money(passengerCount * (international ? 6.5 : 3.25)) : 0;
  const onboardSalesRevenueUsd = hasCabinService && international && profile.internationalRetail ? money(passengerCount * 8.5 * 0.34) : 0;
  const onboardServiceCostUsd = hasCabinService ? money(passengerCount * (international ? 4.3 : 2.1)) : 0;
  const fuelKg = input.actualFuelKg && input.actualFuelKg > 0 ? Math.round(input.actualFuelKg) : estimateFuelKg(distanceNm, input.aircraftTypeCode);
  const fuelPrice = estimateFuelPriceUsdPerKg(input);
  const fuelCostUsd = money(fuelKg * fuelPrice);
  const maintenanceCostUsd = estimateMaintenanceCostUsd(distanceNm, input.aircraftTypeCode);
  const pilotCommissionUsd = calculateFlightCommission({ distanceNm, blockMinutes, aircraftTypeCode: input.aircraftTypeCode, flightModeCode: operationType });
  const airportFeesUsd = money(clamp(60 + distanceNm * 0.09, 80, 1800) * profile.airportFeeMultiplier * (international ? 1.18 : 1));
  const handlingCostUsd = money((profile.handlingBaseUsd + distanceNm * 0.025) * (operationType === "CHARTER" ? 1.12 : 1));
  const repairReserveUsd = money(input.damageCostUsd && input.damageCostUsd > 0 ? input.damageCostUsd : (fuelCostUsd + maintenanceCostUsd) * 0.035);
  const directCosts = fuelCostUsd + maintenanceCostUsd + pilotCommissionUsd + airportFeesUsd + handlingCostUsd + repairReserveUsd + onboardServiceCostUsd;
  const demandRevenue = passengerRevenue + cargoRevenue + onboardServiceRevenueUsd + onboardSalesRevenueUsd;
  const minimumRevenue = directCosts * marginMultiplier(operationType, distanceNm, international);
  const airlineRevenueUsd = money(Math.max(demandRevenue, minimumRevenue));
  const charterRevenueUsd = operationType === "CHARTER" ? airlineRevenueUsd : 0;
  const totalCostUsd = money(directCosts);
  const netProfitUsd = money(airlineRevenueUsd - totalCostUsd);
  const profitMarginPct = airlineRevenueUsd > 0 ? money((netProfitUsd / airlineRevenueUsd) * 100) : 0;
  const economySource = input.economySource ?? "estimate";
  return { distanceNm: int(distanceNm), blockMinutes, routeBand: band, aircraftCategory: profile.category, aircraftValueUsd: estimateAircraftMarketValueUsd(input.aircraftTypeCode), aircraftCompatible: compatibility.compatible, compatibilityReason: compatibility.reason, practicalRangeNm: profile.practicalRangeNm, usableFuelCapacityKg: profile.usableFuelCapacityKg, estimatedPassengers: passengerCount, estimatedCargoKg: cargoKg, loadFactor: money(loadFactor), averageFareUsd: fareUsd, passengerRevenueUsd: passengerRevenue, cargoRevenueUsd: cargoRevenue, charterRevenueUsd, airlineRevenueUsd, fuelKg, fuelLiters: int(fuelKg / 0.8), fuelPriceUsdPerKg: money(fuelPrice), fuelCostUsd, maintenanceCostUsd, airportFeesUsd, handlingCostUsd, pilotCommissionUsd, pilotPaymentUsd: pilotCommissionUsd, repairReserveUsd, onboardServiceRevenueUsd, onboardSalesRevenueUsd, onboardServiceCostUsd, hasCabinService, isInternational: international, totalCostUsd, netProfitUsd, profitMarginPct, economySource, confidenceLabel: economySource === "actual" ? "Datos de cierre ACARS" : economySource === "simbrief" ? "Datos SimBrief/OFP" : "Estimado operacional" };
}

export function estimateRouteProfitLoss(distanceNm: number, aircraftTypeCode?: string | null, flightModeCode?: string | null): FlightEconomyEstimate {
  return estimateFlightEconomy({ distanceNm, aircraftTypeCode, operationType: flightModeCode ?? "CAREER" });
}

export type FlightEconomyRange = { min: FlightEconomyEstimate; max: FlightEconomyEstimate; best: FlightEconomyEstimate; minAircraftTypeCode: string; maxAircraftTypeCode: string; bestAircraftTypeCode: string; aircraftTypes: string[]; excludedAircraftTypes: string[] };

export function estimateEconomyRangeForAircraftTypes({ distanceNm, aircraftTypeCodes, operationType = "CAREER", context = {}, operationCategory = null }: { distanceNm: number; aircraftTypeCodes: string[]; operationType?: FlightMode | null; context?: FuelPriceContext; operationCategory?: string | null }): FlightEconomyRange | null {
  const cleanTypes = Array.from(new Set(aircraftTypeCodes.map((type) => (type ?? "").trim().toUpperCase()).filter(Boolean)));
  if (!distanceNm || distanceNm <= 0 || cleanTypes.length === 0) return null;
  const compatibleTypes = cleanTypes.filter((type) => isAircraftCompatibleWithRoute({ aircraftTypeCode: type, distanceNm, operationCategory, originCountry: context.originCountry, destinationCountry: context.destinationCountry }).compatible);
  if (compatibleTypes.length === 0) return null;
  const sorted = compatibleTypes.sort((a, b) => getAircraftEconomyProfile(a).seats - getAircraftEconomyProfile(b).seats);
  const estimates = sorted.map((type) => ({ type, estimate: estimateFlightEconomy({ distanceNm, aircraftTypeCode: type, operationType, operationCategory, ...context }) }));
  const first = estimates[0];
  const last = estimates[estimates.length - 1];
  const best = estimates.reduce((selected, current) => current.estimate.netProfitUsd > selected.estimate.netProfitUsd ? current : selected, first);
  return { min: first.estimate, max: last.estimate, best: best.estimate, minAircraftTypeCode: first.type, maxAircraftTypeCode: last.type, bestAircraftTypeCode: best.type, aircraftTypes: sorted, excludedAircraftTypes: cleanTypes.filter((type) => !compatibleTypes.includes(type)) };
}

export function estimateRouteCommission(distanceNm: number | null | undefined, blockMinutes: number | null | undefined): string {
  const dist = typeof distanceNm === "number" ? distanceNm : 0;
  const block = typeof blockMinutes === "number" ? blockMinutes : estimateBlockMinutes(dist);
  if (!dist && !block) return "—";
  const band = getRouteBand(dist);
  const low = calculateFlightCommission({ distanceNm: dist, blockMinutes: block, aircraftTypeCode: band === "longhaul" || band === "intercontinental" ? "B789" : band === "international" ? "A320" : "ATR72" });
  const high = calculateFlightCommission({ distanceNm: dist, blockMinutes: block, aircraftTypeCode: band === "longhaul" || band === "intercontinental" ? "B77W" : band === "international" ? "B738" : "E190" });
  const min = Math.min(low, high);
  const max = Math.max(low, high);
  return min === max ? `$${min.toFixed(0)}` : `$${min.toFixed(0)} – $${max.toFixed(0)}`;
}



// ─────────────────────────────────────────────────────────────────────────────
// SimBrief / OFP planning bridge — Economía Realista V10
// Cuando existe OFP, la economía planificada reemplaza las estimaciones base
// de pasajeros, carga, combustible y block time. El cierre ACARS sigue siendo
// la fuente real final.
// ─────────────────────────────────────────────────────────────────────────────

export type SimbriefEconomyInput = FuelPriceContext & {
  distanceNm?: number | null;
  blockMinutes?: number | null;
  eteMinutes?: number | null;
  aircraftTypeCode?: string | null;
  operationType?: FlightMode | null;
  operationCategory?: string | null;
  passengerCount?: number | null;
  cargoKg?: number | null;
  payloadKg?: number | null;
  tripFuelKg?: number | null;
  taxiFuelKg?: number | null;
  reserveFuelKg?: number | null;
  blockFuelKg?: number | null;
};

export function resolveSimbriefPlannedFuelKg(input: SimbriefEconomyInput): number | null {
  if (input.blockFuelKg != null && input.blockFuelKg > 0) return Math.round(input.blockFuelKg);
  const composed = [input.tripFuelKg, input.taxiFuelKg, input.reserveFuelKg]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);
  return composed > 0 ? Math.round(composed) : null;
}

export function estimateSimbriefFlightEconomy(input: SimbriefEconomyInput): FlightEconomyEstimate | null {
  const distanceNm = Number(input.distanceNm) || 0;
  if (distanceNm <= 0) return null;

  const plannedFuelKg = resolveSimbriefPlannedFuelKg(input);
  const blockMinutes =
    input.blockMinutes && input.blockMinutes > 0
      ? Math.round(input.blockMinutes)
      : input.eteMinutes && input.eteMinutes > 0
        ? Math.round(input.eteMinutes)
        : null;

  return estimateFlightEconomy({
    distanceNm,
    blockMinutes,
    aircraftTypeCode: input.aircraftTypeCode,
    operationType: input.operationType ?? "CAREER",
    operationCategory: input.operationCategory,
    originIcao: input.originIcao,
    destinationIcao: input.destinationIcao,
    originCountry: input.originCountry,
    destinationCountry: input.destinationCountry,
    passengerCount: input.passengerCount,
    cargoKg: input.cargoKg ?? input.payloadKg ?? null,
    actualFuelKg: plannedFuelKg,
    economySource: "simbrief",
  });
}

// Plan de gastos del piloto — Economía Realista V2
// Estos valores alimentan la página de economía y sirven como fallback cuando
// Supabase aún no tiene cargado pilot_expense_catalog.
// ─────────────────────────────────────────────────────────────────────────────

export type PilotExpenseCategory =
  | "transfer"
  | "license"
  | "certification"
  | "type_rating"
  | "theory_exam"
  | "practical_check"
  | "training";

export type PilotExpensePlanItem = {
  code: string;
  category: PilotExpenseCategory;
  label: string;
  amountUsd: number;
  phase: string;
  description: string;
  requiredFor?: string;
};

export const PILOT_EXPENSE_PLAN: PilotExpensePlanItem[] = [
  { code: "TRANSFER_GROUND_SHORT", category: "transfer", label: "Traslado terrestre corto", amountUsd: 45, phase: "Operación", description: "Reposicionamiento del piloto por tramo corto terrestre." },
  { code: "TRANSFER_GROUND_LONG", category: "transfer", label: "Traslado terrestre largo", amountUsd: 120, phase: "Operación", description: "Reposicionamiento terrestre entre ciudades o aeropuertos cercanos." },
  { code: "TRANSFER_DOMESTIC_AIR", category: "transfer", label: "Traslado aéreo doméstico", amountUsd: 220, phase: "Operación", description: "Pasaje comercial interno para mover al piloto dentro del país." },
  { code: "TRANSFER_INTERNATIONAL_AIR", category: "transfer", label: "Traslado aéreo internacional", amountUsd: 650, phase: "Operación", description: "Pasaje comercial regional o internacional para reposicionamiento." },
  { code: "TRANSFER_NON_HUB_RECOVERY", category: "transfer", label: "Multa por dejar aeronave fuera de hub", amountUsd: 350, phase: "Operación", description: "Costo operacional cuando el piloto abandona una aeronave en aeropuerto no hub." },

  { code: "LICENSE_MEDICAL_ADMIN", category: "license", label: "Renovación médica/administrativa virtual", amountUsd: 120, phase: "Licencia", description: "Costo administrativo periódico de licencia y aptitud operacional." },
  { code: "LICENSE_IFR_IMC", category: "license", label: "Habilitación IFR/IMC", amountUsd: 1800, phase: "Licencia", description: "Habilitación para operar bajo reglas instrumentales y meteorología reducida." },

  { code: "THEORY_IFR_EXAM", category: "theory_exam", label: "Prueba teórica IFR/IMC", amountUsd: 180, phase: "Prueba teórica", description: "Examen teórico previo a habilitación IFR/IMC.", requiredFor: "IFR/IMC" },
  { code: "THEORY_REGIONAL_EXAM", category: "theory_exam", label: "Prueba teórica aeronave regional", amountUsd: 280, phase: "Prueba teórica", description: "Evaluación de sistemas, performance y procedimientos para turbohélice/regional.", requiredFor: "Regional" },
  { code: "THEORY_NARROWBODY_EXAM", category: "theory_exam", label: "Prueba teórica narrowbody", amountUsd: 750, phase: "Prueba teórica", description: "Evaluación de sistemas, SOP, performance y operación jet de línea.", requiredFor: "A320/B737/E-Jets" },
  { code: "THEORY_WIDEBODY_EXAM", category: "theory_exam", label: "Prueba teórica widebody/long haul", amountUsd: 1200, phase: "Prueba teórica", description: "Evaluación avanzada para operación intercontinental y aeronaves widebody.", requiredFor: "B787/A330/B777" },
  { code: "THEORY_RECURRENT_EXAM", category: "theory_exam", label: "Prueba teórica recurrente", amountUsd: 95, phase: "Prueba teórica", description: "Evaluación periódica para mantener vigencia operacional." },

  { code: "CHECKRIDE_REGIONAL", category: "practical_check", label: "Checkride aeronave regional", amountUsd: 900, phase: "Prueba práctica", description: "Evaluación práctica para liberar operación regional." },
  { code: "CHECKRIDE_NARROWBODY", category: "practical_check", label: "Checkride narrowbody", amountUsd: 2200, phase: "Prueba práctica", description: "Evaluación práctica de habilitación en jet de línea." },
  { code: "CHECKRIDE_WIDEBODY", category: "practical_check", label: "Checkride widebody", amountUsd: 4200, phase: "Prueba práctica", description: "Evaluación práctica avanzada para largo alcance." },

  { code: "CERT_CROSSWIND_CAT_I", category: "certification", label: "Crosswind CAT I", amountUsd: 350, phase: "Certificación", description: "Permite operar con viento cruzado moderado dentro de límites del reglaje." },
  { code: "CERT_CROSSWIND_CAT_II", category: "certification", label: "Crosswind CAT II", amountUsd: 750, phase: "Certificación", description: "Permite operar con viento cruzado mayor, sujeto a aeronave y meteorología." },
  { code: "CERT_CROSSWIND_CAT_III", category: "certification", label: "Crosswind CAT III", amountUsd: 1200, phase: "Certificación", description: "Nivel avanzado de viento cruzado y operación exigente." },

  { code: "TYPE_RATING_REGIONAL", category: "type_rating", label: "Habilitación aeronave regional", amountUsd: 3500, phase: "Habilitación", description: "Curso/habilitación operacional para aeronaves regionales." },
  { code: "TYPE_RATING_NARROWBODY", category: "type_rating", label: "Habilitación narrowbody", amountUsd: 8500, phase: "Habilitación", description: "Curso/habilitación para operación tipo A320/B737 o equivalente." },
  { code: "TYPE_RATING_WIDEBODY", category: "type_rating", label: "Habilitación widebody", amountUsd: 15000, phase: "Habilitación", description: "Curso/habilitación para aeronaves de largo alcance." },
  { code: "RECURRENT_TRAINING", category: "training", label: "Entrenamiento recurrente", amountUsd: 250, phase: "Entrenamiento", description: "Entrenamiento periódico de continuidad operacional." },
];

export function getPilotExpensePlanTotalUsd(category?: PilotExpenseCategory): number {
  return money(
    PILOT_EXPENSE_PLAN
      .filter((item) => !category || item.category === category)
      .reduce((sum, item) => sum + item.amountUsd, 0)
  );
}

export function getPilotExpenseCategoryLabel(category: PilotExpenseCategory | string): string {
  const labels: Record<string, string> = {
    transfer: "Traslados",
    license: "Licencias",
    certification: "Certificaciones",
    type_rating: "Habilitaciones",
    theory_exam: "Pruebas teóricas",
    practical_check: "Pruebas prácticas",
    training: "Entrenamiento",
  };
  return labels[category] ?? category;
}
