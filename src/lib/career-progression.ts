// src/lib/career-progression.ts
// Patagonia Wings - career, ranks, aircraft licenses and progression helpers.
// Keep this file independent from React so it can be used by dashboard, office and tests.

export type CareerRankCode =
  | "CADET"
  | "SECOND_OFFICER"
  | "JUNIOR_FIRST_OFFICER"
  | "FIRST_OFFICER"
  | "SENIOR_FIRST_OFFICER"
  | "JUNIOR_CAPTAIN"
  | "CAPTAIN"
  | "SENIOR_CAPTAIN"
  | "INTERNATIONAL_COMMANDER"
  | "LINE_CHECK_CAPTAIN";

export type AircraftLicenseStatus =
  | "LOCKED"
  | "NOT_OBTAINED"
  | "TRAINING"
  | "ELIGIBLE_FOR_CHECKRIDE"
  | "CHECKRIDE_REQUESTED"
  | "VALID"
  | "EXPIRED"
  | "SUSPENDED"
  | "REJECTED";

export type CareerRank = {
  code: CareerRankCode;
  name: string;
  shortName: string;
  sortOrder: number;
  minHours: number;
  minValidFlights: number;
  minAverageScore: number;
  requiresCheckride: boolean;
  requiresTheory: boolean;
  requiresSpecialCert: boolean;
  description: string;
  nextObjective: string;
  colorAccent: string;
};

export type AircraftLicenseRequirement = {
  aircraftTypeCode: string;
  displayName: string;
  familyCode: string;
  minRankCode: CareerRankCode;
  trainingHoursRequired: number;
  trainingFlightsRequired: number;
  minTrainingScore: number;
  checkrideRequired: boolean;
  checkrideTemplateCode: string | null;
  recurrentRequired: boolean;
  validityDays: number | null;
  isSchoolAircraft: boolean;
  notes: string;
};

export type RequirementStatus = {
  key: string;
  label: string;
  current: number;
  required: number;
  met: boolean;
  progressPct: number;
};

export type CareerProgressInput = {
  totalHours: number;
  validFlights: number;
  averageScore: number;
  currentRankCode?: string | null;
};

export type CareerProgressResult = {
  currentRank: CareerRank;
  nextRank: CareerRank | null;
  requirements: RequirementStatus[];
  overallProgressPct: number;
  allRequirementsMet: boolean;
  nextRecommendedAction: string;
};

export const CAREER_RANKS: CareerRank[] = [
  {
    code: "CADET",
    name: "Cadete Escuela",
    shortName: "Cadete",
    sortOrder: 1,
    minHours: 0,
    minValidFlights: 0,
    minAverageScore: 0,
    requiresCheckride: false,
    requiresTheory: false,
    requiresSpecialCert: false,
    description: "Ingreso inicial a Patagonia Wings. Etapa escuela y adaptación al flujo operativo.",
    nextObjective: "Completa tus primeros vuelos escuela y prepara el checkride inicial.",
    colorAccent: "#94a3b8",
  },
  {
    code: "SECOND_OFFICER",
    name: "Segundo Oficial",
    shortName: "2O",
    sortOrder: 2,
    minHours: 10,
    minValidFlights: 3,
    minAverageScore: 80,
    requiresCheckride: true,
    requiresTheory: false,
    requiresSpecialCert: false,
    description: "Primer escalón operativo. Demuestra dominio básico de procedimientos.",
    nextObjective: "Consolida operación básica y comienza licencias formales.",
    colorAccent: "#67e8f9",
  },
  {
    code: "JUNIOR_FIRST_OFFICER",
    name: "Primer Oficial Junior",
    shortName: "FO Jr",
    sortOrder: 3,
    minHours: 30,
    minValidFlights: 8,
    minAverageScore: 82,
    requiresCheckride: true,
    requiresTheory: false,
    requiresSpecialCert: false,
    description: "Transición hacia operación regional liviana y turbohélice avanzada.",
    nextObjective: "Obtén licencias de aeronaves livianas avanzadas y turbohélices.",
    colorAccent: "#22d3ee",
  },
  {
    code: "FIRST_OFFICER",
    name: "Primer Oficial",
    shortName: "FO",
    sortOrder: 4,
    minHours: 75,
    minValidFlights: 18,
    minAverageScore: 84,
    requiresCheckride: true,
    requiresTheory: true,
    requiresSpecialCert: false,
    description: "Ingreso a operación regional IFR y aeronaves regionales.",
    nextObjective: "Aprueba IFR básico y comienza operación regional formal.",
    colorAccent: "#4ade80",
  },
  {
    code: "SENIOR_FIRST_OFFICER",
    name: "Primer Oficial Senior",
    shortName: "FO Sr",
    sortOrder: 5,
    minHours: 150,
    minValidFlights: 35,
    minAverageScore: 86,
    requiresCheckride: true,
    requiresTheory: true,
    requiresSpecialCert: false,
    description: "Transición a jets regionales y narrow body inicial.",
    nextObjective: "Prepara transición a jet y primeras habilitaciones narrow body.",
    colorAccent: "#34d399",
  },
  {
    code: "JUNIOR_CAPTAIN",
    name: "Capitán Junior",
    shortName: "CPT Jr",
    sortOrder: 6,
    minHours: 300,
    minValidFlights: 60,
    minAverageScore: 88,
    requiresCheckride: true,
    requiresTheory: true,
    requiresSpecialCert: false,
    description: "Ingreso a mando en rutas de complejidad media y narrow body.",
    nextObjective: "Completa upgrade de mando y checkride de capitán junior.",
    colorAccent: "#facc15",
  },
  {
    code: "CAPTAIN",
    name: "Capitán",
    shortName: "CPT",
    sortOrder: 7,
    minHours: 550,
    minValidFlights: 100,
    minAverageScore: 89,
    requiresCheckride: true,
    requiresTheory: true,
    requiresSpecialCert: false,
    description: "Capitán operativo con acceso a flota compleja y operación avanzada.",
    nextObjective: "Mantén estándar de capitán y prepara habilitaciones de largo alcance.",
    colorAccent: "#fb923c",
  },
  {
    code: "SENIOR_CAPTAIN",
    name: "Capitán Senior",
    shortName: "CPT Sr",
    sortOrder: 8,
    minHours: 850,
    minValidFlights: 150,
    minAverageScore: 90,
    requiresCheckride: true,
    requiresTheory: true,
    requiresSpecialCert: false,
    description: "Operación avanzada, largo alcance básico y wide body inicial.",
    nextObjective: "Completa Long Haul básico y licencias wide body.",
    colorAccent: "#f97316",
  },
  {
    code: "INTERNATIONAL_COMMANDER",
    name: "Comandante Internacional",
    shortName: "CMD Intl",
    sortOrder: 9,
    minHours: 1200,
    minValidFlights: 220,
    minAverageScore: 91,
    requiresCheckride: true,
    requiresTheory: true,
    requiresSpecialCert: true,
    description: "Operación internacional compleja, ETOPS y aproximaciones avanzadas.",
    nextObjective: "Completa ETOPS, CAT avanzado y operación internacional.",
    colorAccent: "#a78bfa",
  },
  {
    code: "LINE_CHECK_CAPTAIN",
    name: "Instructor / Line Check Captain",
    shortName: "LCC",
    sortOrder: 10,
    minHours: 1800,
    minValidFlights: 320,
    minAverageScore: 93,
    requiresCheckride: true,
    requiresTheory: true,
    requiresSpecialCert: true,
    description: "Instructor y evaluador de línea. Máximo escalón operacional.",
    nextObjective: "Mantén estándar instructor y apoya evaluación de pilotos.",
    colorAccent: "#f0abfc",
  },
];

export const AIRCRAFT_LICENSE_REQUIREMENTS: AircraftLicenseRequirement[] = [
  { aircraftTypeCode: "C172", displayName: "Cessna 172 Skyhawk", familyCode: "C172", minRankCode: "CADET", trainingHoursRequired: 0, trainingFlightsRequired: 0, minTrainingScore: 0, checkrideRequired: false, checkrideTemplateCode: null, recurrentRequired: false, validityDays: null, isSchoolAircraft: true, notes: "Aeronave escuela inicial." },
  { aircraftTypeCode: "C208", displayName: "Cessna 208 Caravan", familyCode: "C208", minRankCode: "CADET", trainingHoursRequired: 0, trainingFlightsRequired: 0, minTrainingScore: 0, checkrideRequired: false, checkrideTemplateCode: null, recurrentRequired: false, validityDays: null, isSchoolAircraft: true, notes: "Aeronave escuela inicial y utilitaria." },
  { aircraftTypeCode: "BE58", displayName: "Beechcraft Baron 58", familyCode: "BE58", minRankCode: "CADET", trainingHoursRequired: 0, trainingFlightsRequired: 0, minTrainingScore: 0, checkrideRequired: false, checkrideTemplateCode: null, recurrentRequired: false, validityDays: null, isSchoolAircraft: true, notes: "Aeronave escuela bimotor básica." },

  { aircraftTypeCode: "DHC6", displayName: "DHC-6 Twin Otter", familyCode: "DHC6", minRankCode: "SECOND_OFFICER", trainingHoursRequired: 3, trainingFlightsRequired: 2, minTrainingScore: 82, checkrideRequired: true, checkrideTemplateCode: "CHECK_DHC6", recurrentRequired: false, validityDays: null, isSchoolAircraft: false, notes: "Operación STOL/regional básica." },

  { aircraftTypeCode: "B350", displayName: "Beechcraft King Air 350", familyCode: "B350", minRankCode: "JUNIOR_FIRST_OFFICER", trainingHoursRequired: 4, trainingFlightsRequired: 2, minTrainingScore: 82, checkrideRequired: true, checkrideTemplateCode: "CHECK_B350", recurrentRequired: false, validityDays: null, isSchoolAircraft: false, notes: "Turbohélice avanzado." },
  { aircraftTypeCode: "TBM9", displayName: "Daher TBM 930", familyCode: "TBM9", minRankCode: "JUNIOR_FIRST_OFFICER", trainingHoursRequired: 4, trainingFlightsRequired: 2, minTrainingScore: 82, checkrideRequired: true, checkrideTemplateCode: "CHECK_TBM9", recurrentRequired: false, validityDays: null, isSchoolAircraft: false, notes: "Turbohélice monomotor avanzado." },

  { aircraftTypeCode: "ATR72", displayName: "ATR 72-600", familyCode: "ATR72", minRankCode: "FIRST_OFFICER", trainingHoursRequired: 6, trainingFlightsRequired: 3, minTrainingScore: 84, checkrideRequired: true, checkrideTemplateCode: "CHECK_ATR72", recurrentRequired: false, validityDays: null, isSchoolAircraft: false, notes: "Turbohélice regional." },
  { aircraftTypeCode: "E170", displayName: "Embraer E170", familyCode: "EJET", minRankCode: "FIRST_OFFICER", trainingHoursRequired: 6, trainingFlightsRequired: 3, minTrainingScore: 84, checkrideRequired: true, checkrideTemplateCode: "CHECK_E170", recurrentRequired: false, validityDays: null, isSchoolAircraft: false, notes: "Jet regional inicial." },
  { aircraftTypeCode: "E175", displayName: "Embraer E175", familyCode: "EJET", minRankCode: "FIRST_OFFICER", trainingHoursRequired: 6, trainingFlightsRequired: 3, minTrainingScore: 84, checkrideRequired: true, checkrideTemplateCode: "CHECK_E175", recurrentRequired: false, validityDays: null, isSchoolAircraft: false, notes: "Jet regional inicial." },

  { aircraftTypeCode: "E190", displayName: "Embraer E190", familyCode: "EJET", minRankCode: "SENIOR_FIRST_OFFICER", trainingHoursRequired: 7, trainingFlightsRequired: 3, minTrainingScore: 85, checkrideRequired: true, checkrideTemplateCode: "CHECK_E190", recurrentRequired: false, validityDays: null, isSchoolAircraft: false, notes: "Jet regional avanzado." },
  { aircraftTypeCode: "E195", displayName: "Embraer E195", familyCode: "EJET", minRankCode: "SENIOR_FIRST_OFFICER", trainingHoursRequired: 7, trainingFlightsRequired: 3, minTrainingScore: 85, checkrideRequired: true, checkrideTemplateCode: "CHECK_E195", recurrentRequired: false, validityDays: null, isSchoolAircraft: false, notes: "Jet regional avanzado." },
  { aircraftTypeCode: "A319", displayName: "Airbus A319", familyCode: "AIRBUS_A320_FAMILY", minRankCode: "SENIOR_FIRST_OFFICER", trainingHoursRequired: 8, trainingFlightsRequired: 3, minTrainingScore: 86, checkrideRequired: true, checkrideTemplateCode: "CHECK_A319", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Familia Airbus narrow body." },
  { aircraftTypeCode: "A320", displayName: "Airbus A320", familyCode: "AIRBUS_A320_FAMILY", minRankCode: "SENIOR_FIRST_OFFICER", trainingHoursRequired: 8, trainingFlightsRequired: 3, minTrainingScore: 86, checkrideRequired: true, checkrideTemplateCode: "CHECK_A320", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Familia Airbus narrow body." },
  { aircraftTypeCode: "A20N", displayName: "Airbus A320neo", familyCode: "AIRBUS_A320_FAMILY", minRankCode: "SENIOR_FIRST_OFFICER", trainingHoursRequired: 8, trainingFlightsRequired: 3, minTrainingScore: 86, checkrideRequired: true, checkrideTemplateCode: "CHECK_A20N", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Familia Airbus neo." },
  { aircraftTypeCode: "SU95", displayName: "Sukhoi Superjet 100", familyCode: "REGIONAL_JET", minRankCode: "SENIOR_FIRST_OFFICER", trainingHoursRequired: 8, trainingFlightsRequired: 3, minTrainingScore: 86, checkrideRequired: true, checkrideTemplateCode: "CHECK_SU95", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Jet regional/medio." },

  { aircraftTypeCode: "A321", displayName: "Airbus A321", familyCode: "AIRBUS_A320_FAMILY", minRankCode: "JUNIOR_CAPTAIN", trainingHoursRequired: 9, trainingFlightsRequired: 3, minTrainingScore: 87, checkrideRequired: true, checkrideTemplateCode: "CHECK_A321", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Narrow body avanzado." },
  { aircraftTypeCode: "A21N", displayName: "Airbus A321neo", familyCode: "AIRBUS_A320_FAMILY", minRankCode: "JUNIOR_CAPTAIN", trainingHoursRequired: 9, trainingFlightsRequired: 3, minTrainingScore: 87, checkrideRequired: true, checkrideTemplateCode: "CHECK_A21N", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Narrow body avanzado neo." },
  { aircraftTypeCode: "B736", displayName: "Boeing 737-600", familyCode: "BOEING_737_NG", minRankCode: "JUNIOR_CAPTAIN", trainingHoursRequired: 9, trainingFlightsRequired: 3, minTrainingScore: 87, checkrideRequired: true, checkrideTemplateCode: "CHECK_B736", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Familia Boeing 737 NG." },
  { aircraftTypeCode: "B737", displayName: "Boeing 737-700", familyCode: "BOEING_737_NG", minRankCode: "JUNIOR_CAPTAIN", trainingHoursRequired: 9, trainingFlightsRequired: 3, minTrainingScore: 87, checkrideRequired: true, checkrideTemplateCode: "CHECK_B737", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Familia Boeing 737 NG." },
  { aircraftTypeCode: "B738", displayName: "Boeing 737-800", familyCode: "BOEING_737_NG", minRankCode: "JUNIOR_CAPTAIN", trainingHoursRequired: 9, trainingFlightsRequired: 3, minTrainingScore: 87, checkrideRequired: true, checkrideTemplateCode: "CHECK_B738", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Familia Boeing 737 NG." },
  { aircraftTypeCode: "B739", displayName: "Boeing 737-900", familyCode: "BOEING_737_NG", minRankCode: "JUNIOR_CAPTAIN", trainingHoursRequired: 9, trainingFlightsRequired: 3, minTrainingScore: 87, checkrideRequired: true, checkrideTemplateCode: "CHECK_B739", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Familia Boeing 737 NG." },

  { aircraftTypeCode: "B38M", displayName: "Boeing 737 MAX 8", familyCode: "BOEING_737_MAX", minRankCode: "CAPTAIN", trainingHoursRequired: 10, trainingFlightsRequired: 3, minTrainingScore: 88, checkrideRequired: true, checkrideTemplateCode: "CHECK_B38M", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Boeing 737 MAX." },
  { aircraftTypeCode: "MD82", displayName: "McDonnell Douglas MD-82", familyCode: "MADDOG_MD80", minRankCode: "CAPTAIN", trainingHoursRequired: 10, trainingFlightsRequired: 3, minTrainingScore: 88, checkrideRequired: true, checkrideTemplateCode: "CHECK_MD82", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Familia MD-80." },
  { aircraftTypeCode: "MD83", displayName: "McDonnell Douglas MD-83", familyCode: "MADDOG_MD80", minRankCode: "CAPTAIN", trainingHoursRequired: 10, trainingFlightsRequired: 3, minTrainingScore: 88, checkrideRequired: true, checkrideTemplateCode: "CHECK_MD83", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Familia MD-80." },
  { aircraftTypeCode: "MD88", displayName: "McDonnell Douglas MD-88", familyCode: "MADDOG_MD80", minRankCode: "CAPTAIN", trainingHoursRequired: 10, trainingFlightsRequired: 3, minTrainingScore: 88, checkrideRequired: true, checkrideTemplateCode: "CHECK_MD88", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Familia MD-80." },
  { aircraftTypeCode: "B789", displayName: "Boeing 787-9 Dreamliner", familyCode: "BOEING_787", minRankCode: "CAPTAIN", trainingHoursRequired: 12, trainingFlightsRequired: 3, minTrainingScore: 89, checkrideRequired: true, checkrideTemplateCode: "CHECK_B789", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Wide body inicial." },
  { aircraftTypeCode: "B78X", displayName: "Boeing 787-10 Dreamliner", familyCode: "BOEING_787", minRankCode: "CAPTAIN", trainingHoursRequired: 12, trainingFlightsRequired: 3, minTrainingScore: 89, checkrideRequired: true, checkrideTemplateCode: "CHECK_B78X", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Wide body inicial." },

  { aircraftTypeCode: "A339", displayName: "Airbus A330-900neo", familyCode: "AIRBUS_A330", minRankCode: "SENIOR_CAPTAIN", trainingHoursRequired: 14, trainingFlightsRequired: 4, minTrainingScore: 90, checkrideRequired: true, checkrideTemplateCode: "CHECK_A339", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Wide body long haul." },
  { aircraftTypeCode: "A359", displayName: "Airbus A350-900", familyCode: "AIRBUS_A350", minRankCode: "SENIOR_CAPTAIN", trainingHoursRequired: 14, trainingFlightsRequired: 4, minTrainingScore: 90, checkrideRequired: true, checkrideTemplateCode: "CHECK_A359", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Wide body long haul." },
  { aircraftTypeCode: "B772", displayName: "Boeing 777-200ER", familyCode: "BOEING_777", minRankCode: "SENIOR_CAPTAIN", trainingHoursRequired: 14, trainingFlightsRequired: 4, minTrainingScore: 90, checkrideRequired: true, checkrideTemplateCode: "CHECK_B772", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Wide body long haul." },
  { aircraftTypeCode: "B77W", displayName: "Boeing 777-300ER", familyCode: "BOEING_777", minRankCode: "SENIOR_CAPTAIN", trainingHoursRequired: 15, trainingFlightsRequired: 4, minTrainingScore: 90, checkrideRequired: true, checkrideTemplateCode: "CHECK_B77W", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Wide body long haul." },
  { aircraftTypeCode: "B77F", displayName: "Boeing 777 Freighter", familyCode: "BOEING_777", minRankCode: "SENIOR_CAPTAIN", trainingHoursRequired: 15, trainingFlightsRequired: 4, minTrainingScore: 90, checkrideRequired: true, checkrideTemplateCode: "CHECK_B77F", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Wide body cargo." },

  { aircraftTypeCode: "B748", displayName: "Boeing 747-8i", familyCode: "BOEING_747", minRankCode: "INTERNATIONAL_COMMANDER", trainingHoursRequired: 16, trainingFlightsRequired: 4, minTrainingScore: 91, checkrideRequired: true, checkrideTemplateCode: "CHECK_B748", recurrentRequired: true, validityDays: 365, isSchoolAircraft: false, notes: "Operación internacional avanzada." },
];

function clampProgress(current: number, required: number) {
  if (required <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((current / required) * 100)));
}

export function getCareerRankByCode(code: string | null | undefined) {
  return CAREER_RANKS.find((rank) => rank.code === code) ?? null;
}

export function getCareerRankByHours(totalHours: number) {
  const safeHours = Number.isFinite(totalHours) ? totalHours : 0;
  return [...CAREER_RANKS]
    .sort((a, b) => b.sortOrder - a.sortOrder)
    .find((rank) => safeHours >= rank.minHours) ?? CAREER_RANKS[0];
}

export function getNextCareerRank(currentRankCode: string | null | undefined, totalHours = 0) {
  const currentRank = getCareerRankByCode(currentRankCode) ?? getCareerRankByHours(totalHours);
  return CAREER_RANKS.find((rank) => rank.sortOrder === currentRank.sortOrder + 1) ?? null;
}

export function getAircraftRequirement(aircraftTypeCode: string | null | undefined) {
  const normalized = (aircraftTypeCode ?? "").trim().toUpperCase();
  return AIRCRAFT_LICENSE_REQUIREMENTS.find((item) => item.aircraftTypeCode === normalized) ?? null;
}

export function getAircraftByMinimumRank(rankCode: string) {
  const rank = getCareerRankByCode(rankCode);
  if (!rank) return [];

  return AIRCRAFT_LICENSE_REQUIREMENTS.filter((item) => {
    const minRank = getCareerRankByCode(item.minRankCode);
    return minRank ? minRank.sortOrder <= rank.sortOrder : false;
  });
}

export function getAircraftUnlockedAtRank(rankCode: string) {
  return AIRCRAFT_LICENSE_REQUIREMENTS.filter((item) => item.minRankCode === rankCode);
}

export function calculateCareerProgress(input: CareerProgressInput): CareerProgressResult {
  const totalHours = Number.isFinite(input.totalHours) ? input.totalHours : 0;
  const validFlights = Number.isFinite(input.validFlights) ? input.validFlights : 0;
  const averageScore = Number.isFinite(input.averageScore) ? input.averageScore : 0;

  const currentRank = getCareerRankByCode(input.currentRankCode) ?? getCareerRankByHours(totalHours);
  const nextRank = getNextCareerRank(currentRank.code, totalHours);

  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      requirements: [],
      overallProgressPct: 100,
      allRequirementsMet: true,
      nextRecommendedAction: "Ya estás en el rango máximo operacional. Mantén estándar instructor y apoya la evaluación de línea.",
    };
  }

  const requirements: RequirementStatus[] = [
    {
      key: "hours",
      label: "Horas totales",
      current: totalHours,
      required: nextRank.minHours,
      met: totalHours >= nextRank.minHours,
      progressPct: clampProgress(totalHours, nextRank.minHours),
    },
    {
      key: "validFlights",
      label: "Vuelos válidos",
      current: validFlights,
      required: nextRank.minValidFlights,
      met: validFlights >= nextRank.minValidFlights,
      progressPct: clampProgress(validFlights, nextRank.minValidFlights),
    },
    {
      key: "averageScore",
      label: "Score promedio",
      current: averageScore,
      required: nextRank.minAverageScore,
      met: nextRank.minAverageScore <= 0 || averageScore >= nextRank.minAverageScore,
      progressPct: clampProgress(averageScore, nextRank.minAverageScore),
    },
  ];

  const allRequirementsMet = requirements.every((item) => item.met);
  const overallProgressPct = Math.round(
    requirements.reduce((sum, item) => sum + item.progressPct, 0) / requirements.length,
  );

  const firstMissing = requirements.find((item) => !item.met);
  const nextRecommendedAction = allRequirementsMet
    ? nextRank.requiresCheckride
      ? `Solicita el checkride de ascenso a ${nextRank.name}.`
      : `Ya cumples los requisitos para ascender a ${nextRank.name}.`
    : firstMissing
      ? `Próximo objetivo: completar ${firstMissing.label.toLowerCase()} para avanzar a ${nextRank.name}.`
      : nextRank.nextObjective;

  return {
    currentRank,
    nextRank,
    requirements,
    overallProgressPct,
    allRequirementsMet,
    nextRecommendedAction,
  };
}

export function formatRankRequirementStatus(item: RequirementStatus) {
  const current = Number.isInteger(item.current) ? item.current.toString() : item.current.toFixed(1);
  const required = Number.isInteger(item.required) ? item.required.toString() : item.required.toFixed(1);
  return `${current} / ${required}`;
}
