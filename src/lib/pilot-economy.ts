// Pilot Economy — commission calculation, damage deductions, payment dates

/** Returns the last business day (Mon–Fri) of the given month as "DD de Mes de YYYY" */
export function lastBusinessDayLabel(year: number, month: number): string {
  // Start from last day of month, walk back until Monday–Friday
  const last = new Date(Date.UTC(year, month, 0)); // day 0 = last day of previous month = last day of `month`
  while (last.getUTCDay() === 0 || last.getUTCDay() === 6) {
    last.setUTCDate(last.getUTCDate() - 1);
  }
  const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${last.getUTCDate()} de ${MONTHS[last.getUTCMonth()]} de ${last.getUTCFullYear()}`;
}

/** Returns the last business day of a month as ISO date string YYYY-MM-DD */
export function lastBusinessDayIso(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  while (last.getUTCDay() === 0 || last.getUTCDay() === 6) {
    last.setUTCDate(last.getUTCDate() - 1);
  }
  return last.toISOString().slice(0, 10);
}

// Pilot Economy — commission calculation and damage deductions

export type AircraftCategory = "widebody" | "narrowbody" | "regional" | "ga";
export type FlightMode = "CAREER" | "CHARTER" | "TRAINING" | "EVENT" | string;

const AIRCRAFT_MULTIPLIER: Record<AircraftCategory, number> = {
  widebody: 2.2,
  narrowbody: 1.6,
  regional: 1.3,
  ga: 0.8,
};

// CAREER (itinerary) pays more than CHARTER — scheduled lines have higher responsibility
const MODE_MULTIPLIER: Record<string, number> = {
  CAREER: 1.5,
  CHARTER: 1.2,
  TRAINING: 0.5,
  EVENT: 0.8,
};

// Base repair cost estimate by aircraft category (USD)
const REPAIR_BASE: Record<AircraftCategory, number> = {
  ga: 800,
  regional: 2000,
  narrowbody: 5000,
  widebody: 12000,
};

const WIDEBODY_CODES = [
  "B777", "B747", "B787", "B767", "B752", "A380", "A350", "A330", "A340", "A310",
];
const NARROWBODY_CODES = [
  "B737", "B738", "B739", "B735", "B736", "A319", "A320", "A321", "B757",
];
const REGIONAL_CODES = [
  "DH8", "AT72", "AT76", "CRJ", "E170", "E175", "E190", "E195", "SF34",
  "BE20", "C208", "PC12",
];

export function classifyAircraft(typeCode: string | null | undefined): AircraftCategory {
  const code = (typeCode ?? "").toUpperCase().replace(/\s/g, "");
  if (WIDEBODY_CODES.some((c) => code.startsWith(c))) return "widebody";
  if (NARROWBODY_CODES.some((c) => code.startsWith(c))) return "narrowbody";
  if (REGIONAL_CODES.some((c) => code.startsWith(c))) return "regional";
  return "ga";
}

export function calculateFlightCommission({
  distanceNm,
  blockMinutes,
  aircraftTypeCode,
  flightModeCode,
}: {
  distanceNm: number;
  blockMinutes: number;
  aircraftTypeCode?: string | null;
  flightModeCode?: string | null;
}): number {
  const blockHours = Math.max(0, blockMinutes) / 60;
  const base = blockHours * 30 + Math.max(0, distanceNm) * 0.06;

  const category = classifyAircraft(aircraftTypeCode);
  const aircraftMult = AIRCRAFT_MULTIPLIER[category];

  const modeKey = (flightModeCode ?? "CAREER").toUpperCase();
  const modeMult = MODE_MULTIPLIER[modeKey] ?? 1.0;

  const raw = base * aircraftMult * modeMult;
  return Math.min(500, Math.max(15, Math.round(raw * 100) / 100));
}

export function calculateDamageDeduction(
  damageEvents: Array<{ severity?: string | null }>,
  aircraftTypeCode?: string | null
): number {
  const hasSeriousDamage = damageEvents.some(
    (e) => e.severity === "heavy" || e.severity === "critical"
  );
  if (!hasSeriousDamage) return 0;

  const category = classifyAircraft(aircraftTypeCode);
  const repairBase = REPAIR_BASE[category];
  return Math.round(repairBase * 0.1 * 100) / 100;
}

// Projected commission label for route catalog display
export function estimateRouteCommission(
  distanceNm: number | null | undefined,
  blockMinutes: number | null | undefined
): string {
  const dist = typeof distanceNm === "number" ? distanceNm : 0;
  const block = typeof blockMinutes === "number" ? blockMinutes : 0;
  if (!dist && !block) return "—";

  // Show a range: narrowbody (most common) vs widebody
  const narrow = calculateFlightCommission({ distanceNm: dist, blockMinutes: block, aircraftTypeCode: "A320" });
  const wide = calculateFlightCommission({ distanceNm: dist, blockMinutes: block, aircraftTypeCode: "B777" });

  if (narrow === wide) return `$${narrow.toFixed(0)}`;
  return `$${narrow.toFixed(0)} – $${wide.toFixed(0)}`;
}
