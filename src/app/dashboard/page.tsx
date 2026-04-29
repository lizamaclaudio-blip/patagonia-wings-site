"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PublicHeader from "@/components/site/PublicHeader";
import CharterDispatchPanel from "@/components/dashboard/CharterDispatchPanel";
import ProtectedPage, {
  useProtectedSession,
} from "@/components/site/ProtectedPage";
import {
  ensurePilotProfile,
  type PilotProfileRecord,
} from "@/lib/pilot-profile";
import {
  markDispatchPrepared,
  saveFlightOperation,
  getOperationalFlightNumber,
  listAvailableAircraft,
  listAvailableItineraries,
  cancelFlightOperation,
  isAircraftCompatibleWithRoute,
  normalizeAircraftDisplayName,
  type AvailableAircraftOption,
  type AvailableItineraryOption,
  type FlightOperationRecord,
  type FlightMode,
} from "@/lib/flight-ops";
import {
  buildSimbriefEditUrl,
  buildSimbriefRedirectUrl,
  normalizeSimbriefFlightNumber,
  resolveSimbriefType,
  type SimbriefOfpSummary,
} from "@/lib/simbrief";
import { supabase } from "@/lib/supabase/browser";
import { estimateFlightEconomy, estimateSimbriefFlightEconomy } from "@/lib/pilot-economy";
import { resolvePatagoniaScore } from "@/lib/sur-score";
import { getRankInsignia } from "@/lib/rank-insignias";

type DashboardMetrics = {
  pilotStatus: string;
  monthLabel: string;
  monthPosition: number | null;
  monthHours: number;
  totalPireps: number;
  totalHours: number;
  patagoniaScore: number;
  walletBalance: number;
  careerRankCode: string;
  careerRank: string;
};

type ScoreLedgerRow = {
  pilot_callsign: string | null;
  flight_hours: number | null;
  procedure_score?: number | null;
  mission_score?: number | null;
  created_at: string | null;
};

type PilotHoursRow = {
  callsign: string | null;
  total_hours?: number | null;
  career_hours?: number | null;
  transferred_hours?: number | null;
};

type DashboardTabKey = "central" | "dispatch" | "office" | "training";
type DispatchStepKey = "flight_type" | "aircraft" | "itinerary" | "dispatch_flow" | "summary";
type DispatchFlightTypeId =
  | "career"
  | "charter"
  | "training"
  | "event"
  | "special_mission"
  | "free_flight"
  | "qualification";

type MetricDisplayItem = {
  label: string;
  type: "text" | "number" | "currency";
  value: string | number;
  decimals?: number;
};

type AirportRow = {
  ident: string | null;
  name: string | null;
  municipality: string | null;
  iso_country: string | null;
};

type ItineraryAirportMeta = {
  ident: string;
  name: string | null;
  municipality: string | null;
  iso_country: string | null;
  latitude_deg: number | null;
  longitude_deg: number | null;
};

type DispatchValidationItem = {
  key: "flight_number" | "origin" | "destination" | "airframe";
  label: string;
  webValue: string;
  simbriefValue: string;
  matches: boolean;
};

type AirportHeroResponse = {
  imageUrl: string;
  source: "local" | "pexels" | "fallback";
  photographerName?: string | null;
  photographerUrl?: string | null;
  providerName?: string | null;
  providerUrl?: string | null;
  photoPageUrl?: string | null;
};

type NavigraphStatusResponse = {
  configured: boolean;
  connected: boolean;
  hasRefreshToken: boolean;
  expiresAt: string | null;
  scopes: string[];
  subscriptions: string[];
  clientId: string | null;
  subject: string | null;
  error: string | null;
};

type DashboardPartner = {
  name: string;
  eyebrow: string;
  description: string;
  logoPath: string;
  href: string;
  cta: string;
};

const DASHBOARD_PARTNERS: DashboardPartner[] = [
  {
    name: "Navigraph",
    eyebrow: "Cartas, AIRAC y planificación",
    description:
      "Cartas, datos de navegación y planificación profesional para preparar vuelos IFR con mayor realismo.",
    logoPath: "/partners/navigraph.png",
    href: "https://navigraph.com/downloads",
    cta: "Descargar Navigraph",
  },
  {
    name: "SayIntentions.AI",
    eyebrow: "ATC e inmersión con IA",
    description:
      "Ecosistema de comunicaciones, ATC, copiloto y apoyo operacional para simulación avanzada.",
    logoPath: "/partners/sayintentions.png",
    href: "https://portal.sayintentions.ai/download/",
    cta: "Descargar SayIntentions",
  },
];

type DispatchMetarSummary = {
  condition: string;
  temperature: string;
  qnh: string;
  wind: string;
  visibility: string;
  raw: string;
};

type FlightReservationRow = {
  id?: string | null;
  pilot_callsign: string | null;
  route_code?: string | null;
  flight_number?: string | null;
  aircraft_type_code?: string | null;
  aircraft_registration?: string | null;
  origin_ident?: string | null;
  destination_ident?: string | null;
  status?: string | null;
  flight_mode_code?: string | null;
  procedure_score?: number | null;
  mission_score?: number | null;
  performance_score?: number | null;
  score_payload?: Record<string, unknown> | null;
  completed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type TrainingAircraftProgress = {
  aircraft_type_code: string;
  display_name: string;
  family_code: string | null;
  total_hours: number;
  training_flights: number;
  last_training_at: string | null;
  min_hours_required: number;
  checkride_available: boolean;
  image_path?: string | null;
};

type TrainingCategoryKey =
  | "school"
  | "single_turboprop"
  | "twin_turboprop"
  | "piston_twin"
  | "regional_jet"
  | "narrowbody_jet"
  | "widebody_jet";

type TrainingCategoryCard = {
  key: TrainingCategoryKey;
  title: string;
  description: string;
  tierLabel: string;
  accentClass: string;
  borderClass: string;
  badgeClass: string;
  categoryIndex: number;
  unlocked: boolean;
  currentTier: boolean;
  nextTier: boolean;
  aircraft: TrainingAircraftProgress[];
};

type TrainingCheckrideAircraftOption = {
  aircraft_type_code: string;
  display_name: string;
  requirement: string;
  badge?: string;
};

type TrainingCheckrideCriterion = {
  title: string;
  bullets: string[];
};

type TrainingCheckridePlanStep = {
  title: string;
  description: string;
};

type TrainingCheckrideWaypoint = {
  ident: string;
  label: string;
  type: string;
  active?: boolean;
};

type TrainingCheckrideCatalogItem = {
  code: string;
  title: string;
  description: string;
  category: string;
  status: "Disponible" | "Próximo bloque" | "Próximamente";
  recommendedRank: string;
  presetFile: string;
  heroImagePath: string;
  weatherGoal: string;
  introduction: string;
  approvalNote: string;
  weatherConditions: {
    ceiling: string;
    visibility: string;
    wind: string;
    precipitation: string;
    qnh: string;
    lockedPreset: string;
    operationalFocus: string;
  };
  route: {
    origin: string;
    destination: string;
    label: string;
    remarks: string;
  };
  routeWaypoints: TrainingCheckrideWaypoint[];
  aircraftOptions: TrainingCheckrideAircraftOption[];
  specialRules: string[];
  evaluationCriteria: TrainingCheckrideCriterion[];
  flightPlan: TrainingCheckridePlanStep[];
  scoring: {
    maxScore: number;
    passScore: number;
    items: string[];
  };
};

type TrainingTheoryOption = {
  id: string;
  label: string;
};

type TrainingTheoryQuestion = {
  id: string;
  topic: string;
  prompt: string;
  imagePath: string;
  options: TrainingTheoryOption[];
  correctOptionId: string;
  explanation: string;
};

type TrainingTheoryExam = {
  code: string;
  title: string;
  description: string;
  durationMinutes: number;
  passScore: number;
  imagePath: string;
  status: "Disponible" | "Próximo bloque";
  questions: TrainingTheoryQuestion[];
};

type TrainingTheoryAttemptStatus = "passed" | "failed";

type TrainingTheoryAttemptSummary = {
  exam_code: string;
  status: TrainingTheoryAttemptStatus;
  score_percent: number;
  correct_count: number;
  total_questions: number;
  submitted_at: string;
  next_available_at: string | null;
};

const TRAINING_THEORY_RETRY_DAYS = 7;
const TRAINING_THEORY_STORAGE_PREFIX = "pwg_theory_attempts_v1";

function getTheoryAttemptStorageKey(callsign: string) {
  const cleanCallsign = callsign.trim().toUpperCase() || "ANON";
  return `${TRAINING_THEORY_STORAGE_PREFIX}:${cleanCallsign}`;
}

function safeParseTheoryAttempts(value: string | null): Record<string, TrainingTheoryAttemptSummary> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, TrainingTheoryAttemptSummary>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readStoredTheoryAttempts(callsign: string): Record<string, TrainingTheoryAttemptSummary> {
  if (typeof window === "undefined") {
    return {};
  }

  return safeParseTheoryAttempts(window.localStorage.getItem(getTheoryAttemptStorageKey(callsign)));
}

function writeStoredTheoryAttempt(callsign: string, attempt: TrainingTheoryAttemptSummary) {
  if (typeof window === "undefined" || !callsign.trim()) {
    return;
  }

  const current = readStoredTheoryAttempts(callsign);
  const next = {
    ...current,
    [attempt.exam_code]: attempt,
  };

  window.localStorage.setItem(getTheoryAttemptStorageKey(callsign), JSON.stringify(next));
}

function getTheoryAttemptGate(attempt?: TrainingTheoryAttemptSummary | null) {
  if (!attempt) {
    return {
      locked: false,
      label: "Disponible",
      tone: "available" as const,
      helper: "Puedes iniciar un intento cuando estés listo.",
    };
  }

  if (attempt.status === "passed") {
    return {
      locked: true,
      label: "Aprobada",
      tone: "passed" as const,
      helper: `Evaluación aprobada con ${attempt.score_percent}%. No requiere nuevo intento.`,
    };
  }

  const nextAt = attempt.next_available_at ? new Date(attempt.next_available_at).getTime() : 0;
  const now = Date.now();

  if (Number.isFinite(nextAt) && nextAt > now) {
    return {
      locked: true,
      label: "Bloqueada",
      tone: "locked" as const,
      helper: `Reintento disponible el ${formatTheoryAttemptDate(attempt.next_available_at)}.`,
    };
  }

  return {
    locked: false,
    label: "Reintento disponible",
    tone: "retry" as const,
    helper: "Ya pasaron los 7 días de espera. Puedes realizar un nuevo intento.",
  };
}

function formatTheoryAttemptDate(value: string | null | undefined) {
  if (!value) {
    return "fecha pendiente";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "fecha pendiente";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function reduceLatestTheoryAttempts(rows: TrainingTheoryAttemptSummary[]) {
  const latest: Record<string, TrainingTheoryAttemptSummary> = {};

  for (const row of rows) {
    if (!row.exam_code) {
      continue;
    }

    const current = latest[row.exam_code];
    const rowTime = new Date(row.submitted_at ?? 0).getTime();
    const currentTime = current ? new Date(current.submitted_at ?? 0).getTime() : 0;

    if (!current || rowTime >= currentTime) {
      latest[row.exam_code] = row;
    }
  }

  return latest;
}


const TRAINING_MIN_AIRCRAFT_HOURS = 5;
const TRAINING_SCHOOL_AIRCRAFT = new Set(["C172", "C208", "BE58"]);
const TRAINING_AIRCRAFT_REGISTRATION_LABEL = "Avion de entrenamiento";
const TRAINING_AIRCRAFT_IMAGE_FALLBACK = "/dispatch/flight-types/training.png";
const TRAINING_CHECKRIDE_CATALOG: TrainingCheckrideCatalogItem[] = [
  {
    code: "HAB-IFR",
    title: "Habilitación IFR / IMC",
    description: "Chequeo inicial para validar operación instrumental básica, navegación y aproximación estabilizada en condiciones IMC.",
    category: "Base instrumental",
    status: "Disponible",
    recommendedRank: "Cadete avanzado / transición regional",
    presetFile: "PWG_Checkride_IFR_IMC.WPR",
    heroImagePath: "/checkrides/hab-ifr-imc.jpg",
    weatherGoal: "IMC controlado: techo bajo, visibilidad reducida y viento suave. La intención es evaluar procedimientos IFR, no viento cruzado ni mínimos CAT II.",
    introduction:
      "Esta habilitación certifica que el piloto puede planificar y ejecutar un vuelo instrumental base manteniendo orden de cabina, disciplina de procedimientos y una aproximación estabilizada hasta la toma.",
    approvalNote:
      "Aprobás con 85/100 o más, usando una de las aeronaves oficiales, el preset climático obligatorio y completando la ruta del checkride sin modificar las condiciones meteorológicas.",
    weatherConditions: {
      ceiling: "Techo principal bajo, alrededor de 800 a 1.200 ft AGL, suficiente para obligar trabajo IFR real durante la llegada.",
      visibility: "Visibilidad reducida, normalmente entre 5 y 8 km, sin llegar a baja visibilidad CAT.",
      wind: "Viento suave a moderado, con componente cruzada baja para no contaminar la evaluación instrumental.",
      precipitation: "Llovizna o lluvia ligera opcional; sin tormenta ni fenómenos severos.",
      qnh: "El QNH lo entrega el preset oficial del checkride y debe mantenerse sin cambios durante toda la prueba.",
      lockedPreset: "El clima del checkride debe mantenerse exactamente como fue cargado al iniciar el vuelo. Cualquier cambio manual antes o durante la prueba deja el chequeo como no conforme.",
      operationalFocus: "Salida IFR, navegación básica, interceptación de aproximación y estabilización a 1.000 ft AGL.",
    },
    route: {
      origin: "SCTE",
      destination: "SCIE",
      label: "Puerto Montt → Concepción",
      remarks: "Tramo corto y controlado para revisar salida instrumental, navegación en ruta y llegada estabilizada.",
    },
    routeWaypoints: [
      { ident: "SCTE", label: "Puerto Montt", type: "Salida", active: true },
      { ident: "IFR", label: "Navegación instrumental", type: "En ruta" },
      { ident: "APP", label: "Aproximación publicada", type: "Llegada" },
      { ident: "SCIE", label: "Concepción", type: "Destino", active: true },
    ],
    aircraftOptions: [
      { aircraft_type_code: "C208", display_name: "Cessna 208 Grand Caravan", requirement: "Opción oficial para chequeo instrumental básico", badge: "C208" },
      { aircraft_type_code: "B350", display_name: "Beechcraft King Air 350", requirement: "Opción oficial para transición IFR bimotor", badge: "B350" },
    ],
    specialRules: [
      "Usá exclusivamente el preset PWG_Checkride_IFR_IMC.WPR.",
      "Cualquiera de las dos aeronaves asignadas es válida para aprobar la habilitación.",
      "La aproximación debe estar estabilizada a 1.000 ft AGL.",
      "Si el clima se modifica manualmente, el checkride queda inválido.",
    ],
    evaluationCriteria: [
      {
        title: "Procedimientos operacionales",
        bullets: [
          "Cumplir flujo normal de salida, ascenso y navegación IFR.",
          "Mantener configuración coherente y gestión de energía estable.",
        ],
      },
      {
        title: "Navegación y llegada",
        bullets: [
          "Seguir la ruta indicada y entrar a la aproximación publicada de forma ordenada.",
          "Mantener interceptación y descenso controlados hasta mínimos.",
        ],
      },
      {
        title: "Aterrizaje",
        bullets: [
          "Llegar estabilizado a 1.000 ft AGL.",
          "Toma segura, centrada y sin excursión de pista.",
        ],
      },
      {
        title: "Control del clima",
        bullets: [
          "El preset oficial debe permanecer sin alteraciones durante toda la prueba.",
          "La meteorología debe coincidir con la condición cargada al iniciar el vuelo.",
        ],
      },
    ],
    flightPlan: [
      { title: "Preparación", description: "Cargar el preset oficial IFR / IMC, revisar la ruta y preparar la cabina para salida instrumental." },
      { title: "Salida", description: "Despegar desde SCTE cumpliendo el flujo normal y estableciendo la navegación IFR." },
      { title: "En ruta", description: "Mantener navegación ordenada, altitudes correctas y conciencia situacional hasta la llegada." },
      { title: "Aproximación", description: "Interceptar la aproximación publicada, configurar a tiempo y estabilizar a 1.000 ft AGL." },
      { title: "Cierre", description: "Completar aterrizaje seguro, rodaje normal y cierre del vuelo sin alterar el clima del checkride." },
    ],
    scoring: {
      maxScore: 100,
      passScore: 85,
      items: [
        "Clima oficial correcto y sin cambios.",
        "Uso de una de las aeronaves oficiales.",
        "Ruta y aproximación IFR correctamente ejecutadas.",
        "Aterrizaje seguro y estabilizado.",
      ],
    },
  },
  {
    code: "HAB-CAT-I",
    title: "Habilitación CAT I",
    description: "Chequeo de aproximación de precisión para mínimos estándar y operación IFR regular en flota regional/comercial.",
    category: "Aproximaciones",
    status: "Disponible",
    recommendedRank: "Piloto regional / Primer Oficial",
    presetFile: "PWG_Checkride_CAT_I.WPR",
    heroImagePath: "/checkrides/hab-cat-i.jpg",
    weatherGoal: "IFR de precisión con techo bajo y visibilidad reducida, pero aún dentro del entorno normal de una aproximación CAT I.",
    introduction:
      "La habilitación CAT I valida que el piloto pueda briefear, interceptar y aterrizar en una aproximación de precisión manteniendo mínimos, estabilización y criterio de continuación o frustrada.",
    approvalNote:
      "Aprobás con 85/100 o más, volando con una de las dos aeronaves oficiales y cumpliendo los mínimos CAT I, sin modificar el clima del checkride.",
    weatherConditions: {
      ceiling: "Techo bajo compatible con operación CAT I, lo bastante exigente para requerir disciplina de mínimos y monitoreo constante.",
      visibility: "Visibilidad/RVR reducida pero suficiente para una aproximación CAT I bien volada.",
      wind: "Viento bajo a moderado, sin componente extrema, para enfocar el chequeo en la aproximación de precisión.",
      precipitation: "Bruma, niebla o lluvia ligera según el preset oficial; sin fenómenos severos.",
      qnh: "El QNH del checkride lo fija el preset oficial y debe respetarse durante todo el vuelo.",
      lockedPreset: "Las condiciones meteorológicas deben mantenerse iguales desde el briefing hasta el cierre. Cualquier modificación invalida la prueba.",
      operationalFocus: "Briefing de precisión, mínimos CAT I, continuidad o frustrada y aterrizaje dentro de zona.",
    },
    route: {
      origin: "SCEL",
      destination: "SCTE",
      label: "Santiago → Puerto Montt",
      remarks: "Perfil comercial nacional para practicar briefing, interceptación y decisión en mínimos CAT I.",
    },
    routeWaypoints: [
      { ident: "SCEL", label: "Santiago", type: "Salida", active: true },
      { ident: "STAR", label: "Llegada instrumentada", type: "En ruta" },
      { ident: "ILS", label: "Aproximación de precisión", type: "Final" },
      { ident: "SCTE", label: "Puerto Montt", type: "Destino", active: true },
    ],
    aircraftOptions: [
      { aircraft_type_code: "ATR72", display_name: "ATR 72", requirement: "Opción oficial turbohélice regional para CAT I", badge: "ATR72" },
      { aircraft_type_code: "E175", display_name: "Embraer E175", requirement: "Opción oficial jet regional para CAT I", badge: "E175" },
    ],
    specialRules: [
      "Usá exclusivamente el preset PWG_Checkride_CAT_I.WPR.",
      "ATR72 y E175 son las dos aeronaves válidas para este checkride.",
      "Si se pierde estabilización por debajo de mínimos, corresponde frustrar.",
      "Modificar el clima deja el chequeo como no conforme.",
    ],
    evaluationCriteria: [
      {
        title: "Briefing y preparación",
        bullets: [
          "Revisar mínimos, ayudas y procedimiento de llegada antes de iniciar el descenso.",
          "Preparar la aeronave a tiempo y con configuración ordenada.",
        ],
      },
      {
        title: "Aproximación de precisión",
        bullets: [
          "Interceptar el procedimiento correctamente.",
          "Mantener senda, eje y velocidad dentro de parámetros normales.",
        ],
      },
      {
        title: "Decisión en mínimos",
        bullets: [
          "Continuar solo si la operación está estabilizada y visualmente apta.",
          "Frustrar si no se cumplen los criterios de seguridad.",
        ],
      },
      {
        title: "Integridad del checkride",
        bullets: [
          "El preset oficial debe permanecer intacto.",
          "Se evalúa el uso correcto del entorno CAT I, no viento cruzado ni LVO avanzada.",
        ],
      },
    ],
    flightPlan: [
      { title: "Briefing", description: "Preparar la aproximación CAT I, repasar mínimos y configurar radioayudas o FMC según la aeronave." },
      { title: "Crucero y descenso", description: "Llegar al descenso con el checkride ordenado y la llegada prevista con anticipación." },
      { title: "Intercepción", description: "Capturar localizador/senda o guía equivalente manteniendo energía controlada." },
      { title: "Mínimos", description: "Tomar la decisión correcta en mínimos: continuar si está apto o frustrar si no lo está." },
      { title: "Finalización", description: "Aterrizar dentro de zona y cerrar el vuelo manteniendo el clima del preset sin alteraciones." },
    ],
    scoring: {
      maxScore: 100,
      passScore: 85,
      items: [
        "Preset CAT I correcto.",
        "Briefing y preparación completos.",
        "Aproximación estabilizada y decisión correcta.",
        "Touchdown seguro dentro de zona.",
      ],
    },
  },
  {
    code: "HAB-CAT-II",
    title: "Habilitación CAT II",
    description: "Chequeo de baja visibilidad para flota comercial con mayor exigencia técnica, control operacional y cumplimiento de SOP.",
    category: "Aproximaciones",
    status: "Próximo bloque",
    recommendedRank: "Piloto comercial jet / Capitán junior",
    presetFile: "PWG_Checkride_CAT_II.WPR",
    heroImagePath: "/checkrides/hab-cat-ii.jpg",
    weatherGoal: "Baja visibilidad y techo muy bajo para validar el uso correcto de automatización, mínimos CAT II y criterio operacional.",
    introduction:
      "La habilitación CAT II confirma que el piloto puede conducir una aproximación de baja visibilidad con flota jet certificada, respetando briefing, automatización y monitoreo hasta mínimos.",
    approvalNote:
      "Aprobás con 85/100 o más, manteniendo la aproximación dentro de SOP, con una de las dos aeronaves oficiales y el clima del checkride sin modificaciones.",
    weatherConditions: {
      ceiling: "Techo muy bajo, compatible con una operación CAT II realista.",
      visibility: "RVR reducida propia de baja visibilidad, sin llegar al entorno CAT III.",
      wind: "Viento leve para no mezclar la prueba con un chequeo de crosswind.",
      precipitation: "Bruma, llovizna o niebla según el preset oficial; sin fenómeno convectivo severo.",
      qnh: "El QNH se toma del preset oficial y debe conservarse sin ajustes manuales externos al procedimiento normal.",
      lockedPreset: "El clima del checkride queda fijado al iniciar la prueba. Si el usuario altera visibilidad, viento, presión o nubosidad, la habilitación se invalida.",
      operationalFocus: "Automatización, callouts, mínimos CAT II, decisión y aterrizaje seguro en baja visibilidad.",
    },
    route: {
      origin: "SAEZ",
      destination: "SCEL",
      label: "Buenos Aires Ezeiza → Santiago",
      remarks: "Perfil internacional corto para practicar baja visibilidad en operación comercial jet.",
    },
    routeWaypoints: [
      { ident: "SAEZ", label: "Ezeiza", type: "Salida", active: true },
      { ident: "STAR", label: "Llegada instrumentada", type: "En ruta" },
      { ident: "CAT II", label: "Aproximación de baja visibilidad", type: "Final" },
      { ident: "SCEL", label: "Santiago", type: "Destino", active: true },
    ],
    aircraftOptions: [
      { aircraft_type_code: "A320_FENIX", display_name: "Airbus A320 Fenix", requirement: "Opción oficial de flota comercial para CAT II", badge: "A320" },
      { aircraft_type_code: "B738_PMDG", display_name: "Boeing 737-800 PMDG", requirement: "Opción oficial de flota comercial para CAT II", badge: "B738" },
    ],
    specialRules: [
      "Usá exclusivamente el preset PWG_Checkride_CAT_II.WPR.",
      "A320 Fenix y B738 PMDG son las dos aeronaves válidas para esta habilitación.",
      "La aproximación debe mantenerse estabilizada y conforme a SOP.",
      "Modificar el clima del checkride deja la evaluación inválida.",
    ],
    evaluationCriteria: [
      {
        title: "Automatización y monitoreo",
        bullets: [
          "Usar correctamente FD/AP según SOP de la aeronave.",
          "Monitorear la aproximación y resolver desviaciones a tiempo.",
        ],
      },
      {
        title: "Mínimos CAT II",
        bullets: [
          "Respetar mínimos operacionales y criterio de continuación o frustrada.",
          "Mantener estabilidad y conciencia situacional hasta la toma.",
        ],
      },
      {
        title: "Aterrizaje",
        bullets: [
          "Toma segura, controlada y dentro del eje.",
          "Rodaje posterior con disciplina de baja visibilidad.",
        ],
      },
      {
        title: "Integridad del clima",
        bullets: [
          "El preset oficial debe permanecer intacto.",
          "No se permite alterar visibilidad, nubes, presión o viento durante la prueba.",
        ],
      },
    ],
    flightPlan: [
      { title: "Preparación", description: "Cargar el preset CAT II, revisar ayudas y preparar briefing completo de baja visibilidad." },
      { title: "Descenso", description: "Gestionar descenso y energía con anticipación, llegando estable a la fase terminal." },
      { title: "Final", description: "Capturar la aproximación CAT II con monitoreo activo y configuración completa." },
      { title: "Mínimos", description: "Continuar o frustrar según SOP y estado real de la aproximación." },
      { title: "Post vuelo", description: "Completar toma y rodaje manteniendo el checkride válido hasta el cierre del vuelo." },
    ],
    scoring: {
      maxScore: 100,
      passScore: 85,
      items: [
        "Preset CAT II correcto.",
        "Uso correcto de automatización.",
        "Mínimos y estabilidad respetados.",
        "Toma segura y controlada.",
      ],
    },
  },
  {
    code: "HAB-CAT-III",
    title: "Habilitación CAT III",
    description: "Chequeo LVO avanzado para pilotos comerciales con operación de precisión y cumplimiento estricto de procedimientos.",
    category: "Aproximaciones",
    status: "Próximo bloque",
    recommendedRank: "Capitán comercial avanzado",
    presetFile: "PWG_Checkride_CAT_III.WPR",
    heroImagePath: "/checkrides/hab-cat-iii.jpg",
    weatherGoal: "Entorno LVO severo para validar operación CAT III/autoland con flota comercial preparada para esa exigencia.",
    introduction:
      "La habilitación CAT III es un chequeo avanzado de precisión. Requiere disciplina total de procedimientos, uso adecuado de automatización y control operacional en condiciones de visibilidad mínima.",
    approvalNote:
      "Aprobás con 85/100 o más, volando con una de las dos aeronaves oficiales, manteniendo la aproximación conforme a SOP y sin modificar el preset climático.",
    weatherConditions: {
      ceiling: "Techo extremadamente bajo, cercano a cero operativo, propio de una prueba CAT III.",
      visibility: "Visibilidad muy reducida / RVR muy baja, en un entorno de operación LVO avanzada.",
      wind: "Viento suave, sin componente extrema, para concentrar la prueba en automatización y monitoreo.",
      precipitation: "Niebla densa o humedad persistente según preset oficial.",
      qnh: "El QNH debe mantenerse como lo entrega el preset oficial del checkride.",
      lockedPreset: "La condición meteorológica del checkride debe permanecer intacta. Cualquier cambio deja el chequeo como inválido.",
      operationalFocus: "Configuración CAT III/autoland, monitoreo, touchdown y rollout seguros.",
    },
    route: {
      origin: "SCEL",
      destination: "SAEZ",
      label: "Santiago → Buenos Aires Ezeiza",
      remarks: "Vuelo comercial de precisión para evaluar un perfil LVO completo.",
    },
    routeWaypoints: [
      { ident: "SCEL", label: "Santiago", type: "Salida", active: true },
      { ident: "STAR", label: "Llegada de precisión", type: "En ruta" },
      { ident: "CAT III", label: "Autoland / LVO", type: "Final" },
      { ident: "SAEZ", label: "Ezeiza", type: "Destino", active: true },
    ],
    aircraftOptions: [
      { aircraft_type_code: "A320_FENIX", display_name: "Airbus A320 Fenix", requirement: "Opción oficial para operación CAT III", badge: "A320" },
      { aircraft_type_code: "B738_PMDG", display_name: "Boeing 737-800 PMDG", requirement: "Opción oficial para operación CAT III", badge: "B738" },
    ],
    specialRules: [
      "Usá exclusivamente el preset PWG_Checkride_CAT_III.WPR.",
      "A320 Fenix y B738 PMDG son las opciones válidas del checkride.",
      "La automatización y monitoreo deben seguir SOP de CAT III.",
      "Modificar el clima invalida la habilitación.",
    ],
    evaluationCriteria: [
      {
        title: "Configuración LVO",
        bullets: [
          "Preparar la aeronave para operación CAT III/autoland según su SOP.",
          "Configurar correctamente sistemas, mínimos y ayudas disponibles.",
        ],
      },
      {
        title: "Monitoreo de aproximación",
        bullets: [
          "Supervisar estabilidad, guías y estado del sistema hasta touchdown.",
          "Resolver cualquier desviación con criterio operacional seguro.",
        ],
      },
      {
        title: "Touchdown y rollout",
        bullets: [
          "Mantener control direccional tras la toma.",
          "Completar rollout y rodaje con disciplina LVO.",
        ],
      },
      {
        title: "Integridad del clima",
        bullets: [
          "El preset oficial debe seguir activo y sin cambios hasta el cierre.",
          "No se permite alterar la meteorología ni usar clima externo para facilitar la prueba.",
        ],
      },
    ],
    flightPlan: [
      { title: "Briefing LVO", description: "Preparar la aproximación CAT III, revisar mínimos, automatización y procedimientos de contingencia." },
      { title: "Descenso y llegada", description: "Llegar al entorno terminal con la aeronave totalmente preparada para baja visibilidad." },
      { title: "Aproximación", description: "Monitorear la captura y el comportamiento del sistema hasta la fase crítica." },
      { title: "Rollout", description: "Completar touchdown y rollout conforme al perfil CAT III de la aeronave." },
      { title: "Cierre", description: "Cerrar el vuelo sin perder la validez del preset climático ni del procedimiento." },
    ],
    scoring: {
      maxScore: 100,
      passScore: 85,
      items: [
        "Preset CAT III correcto.",
        "Configuración y monitoreo adecuados.",
        "Touchdown y rollout seguros.",
        "SOP cumplidos en LVO.",
      ],
    },
  },
  {
    code: "HAB-XWIND",
    title: "Habilitación viento cruzado 30 kt",
    description: "Chequeo específico para ampliar límites operacionales de viento cruzado en flota comercial.",
    category: "Performance",
    status: "Disponible",
    recommendedRank: "Piloto comercial / transición a jet",
    presetFile: "PWG_Checkride_XWIND.WPR",
    heroImagePath: "/checkrides/hab-crosswind.jpg",
    weatherGoal: "Viento cruzado fuerte y sostenido en pista seca. La prueba está pensada para aeronaves comerciales compatibles con este rango de crosswind.",
    introduction:
      "Esta habilitación valida la técnica del piloto para despegar y aterrizar con viento cruzado fuerte, manteniendo eje de pista, control direccional y una toma segura dentro de los límites operacionales.",
    approvalNote:
      "Aprobás con 85/100 o más, usando cualquiera de las dos aeronaves oficiales del checkride, respetando la técnica de crosswind y manteniendo el clima del preset sin cambios.",
    weatherConditions: {
      ceiling: "Condición VMC o con nubes altas, para concentrar la evaluación en la técnica de viento cruzado.",
      visibility: "Visibilidad alta y pista visualmente disponible durante toda la prueba.",
      wind: "Componente cruzada fuerte y estable, del orden del preset oficial, compatible con aeronaves comerciales y evaluación de técnica.",
      precipitation: "Sin precipitación significativa y con pista seca.",
      qnh: "El QNH queda fijado por el preset oficial del checkride y debe mantenerse sin cambios.",
      lockedPreset: "Si el viento, la dirección o cualquier otra variable del preset se alteran antes o durante el vuelo, el checkride queda inválido.",
      operationalFocus: "Corrección lateral, control de eje, técnica de flare y control direccional después de la toma.",
    },
    route: {
      origin: "SCEL",
      destination: "SCIE",
      label: "Santiago → Concepción",
      remarks: "Perfil corto con enfoque en técnica de viento cruzado durante aproximación, flare y aterrizaje.",
    },
    routeWaypoints: [
      { ident: "SCEL", label: "Santiago", type: "Salida", active: true },
      { ident: "DCT", label: "Tramo corto", type: "En ruta" },
      { ident: "FINAL", label: "Aproximación crosswind", type: "Final" },
      { ident: "SCIE", label: "Concepción", type: "Destino", active: true },
    ],
    aircraftOptions: [
      { aircraft_type_code: "A320_FENIX", display_name: "Airbus A320 Fenix", requirement: "Opción oficial comercial para crosswind fuerte", badge: "A320" },
      { aircraft_type_code: "B738_PMDG", display_name: "Boeing 737-800 PMDG", requirement: "Opción oficial comercial para crosswind fuerte", badge: "B738" },
    ],
    specialRules: [
      "Usá exclusivamente el preset PWG_Checkride_XWIND.WPR.",
      "A320 Fenix y B738 PMDG son las dos aeronaves válidas para esta habilitación.",
      "El foco del checkride es control lateral, eje de pista y touchdown seguro.",
      "Cambiar el viento o cualquier condición del preset invalida la prueba.",
    ],
    evaluationCriteria: [
      {
        title: "Despegue y llegada",
        bullets: [
          "Mantener control direccional desde la carrera de despegue hasta la salida inicial.",
          "Planificar una llegada ordenada con corrección lateral apropiada.",
        ],
      },
      {
        title: "Técnica de crosswind",
        bullets: [
          "Mantener eje de pista en corta final y durante el flare.",
          "Aplicar técnica de crab/de-crab o wing-low según corresponda a la aeronave.",
        ],
      },
      {
        title: "Touchdown",
        bullets: [
          "Toma segura, centrada y controlada.",
          "Sin pérdida de control ni excursión de pista.",
        ],
      },
      {
        title: "Integridad del checkride",
        bullets: [
          "El clima oficial debe mantenerse sin cambios.",
          "La aeronave elegida puede ser cualquiera de las dos opciones publicadas.",
        ],
      },
    ],
    flightPlan: [
      { title: "Preparación", description: "Cargar el preset de crosswind y revisar técnica, velocidad y configuración de aterrizaje." },
      { title: "Salida", description: "Despegar manteniendo control direccional y conciencia del viento durante el ascenso inicial." },
      { title: "En ruta", description: "Preparar con anticipación la llegada y el perfil de aproximación con viento cruzado." },
      { title: "Final", description: "Entrar a final estabilizado, corrigiendo eje y deriva de forma continua." },
      { title: "Aterrizaje", description: "Tocar dentro de zona, mantener el control y completar el rodaje sin perder la validez del checkride." },
    ],
    scoring: {
      maxScore: 100,
      passScore: 85,
      items: [
        "Preset crosswind correcto.",
        "Uso de una aeronave oficial del checkride.",
        "Técnica de viento cruzado correcta.",
        "Touchdown seguro y con control direccional.",
      ],
    },
  },
  {
    code: "HAB-SPECIAL",
    title: "Habilitación aeropuertos especiales",
    description: "Chequeo de operación en entorno exigente, con meteorología patagónica y toma de decisiones conservadora.",
    category: "Operación especial",
    status: "Próximamente",
    recommendedRank: "Piloto regional consolidado",
    presetFile: "PWG_Checkride_SPECIAL_AIRPORT.WPR",
    heroImagePath: "/checkrides/hab-special-airport.jpg",
    weatherGoal: "Entorno patagónico con viento moderado, nubosidad baja y lluvia ligera para practicar criterio y técnica en aeropuerto especial.",
    introduction:
      "La habilitación de aeropuertos especiales valida que el piloto pueda operar con criterio conservador en un escenario exigente, combinando meteorología variable, gestión de energía y conciencia de terreno.",
    approvalNote:
      "Aprobás con 85/100 o más, usando una de las dos aeronaves oficiales del checkride y manteniendo el clima del preset sin alteraciones.",
    weatherConditions: {
      ceiling: "Nubosidad baja o fragmentada, típica de operación patagónica exigente.",
      visibility: "Visibilidad suficiente para operar con cautela, sin transformarlo en un chequeo LVO.",
      wind: "Viento moderado con componente cruzada administrable para C208 y B350.",
      precipitation: "Lluvia ligera o chubascos débiles según el preset oficial.",
      qnh: "El QNH del checkride lo determina el preset oficial y debe respetarse durante toda la operación.",
      lockedPreset: "La meteorología del aeropuerto especial debe mantenerse igual al preset original del checkride. Cambiarla invalida la prueba.",
      operationalFocus: "Briefing de terreno, aproximación conservadora, posibilidad de frustrada y toma de decisiones seguras.",
    },
    route: {
      origin: "SCTE",
      destination: "SCCI",
      label: "Puerto Montt → Punta Arenas",
      remarks: "Perfil patagónico para evaluar planeamiento, meteorología y criterio de seguridad en entorno especial.",
    },
    routeWaypoints: [
      { ident: "SCTE", label: "Puerto Montt", type: "Salida", active: true },
      { ident: "PAT", label: "Tramo patagónico", type: "En ruta" },
      { ident: "SPECIAL", label: "Aproximación especial", type: "Llegada" },
      { ident: "SCCI", label: "Punta Arenas", type: "Destino", active: true },
    ],
    aircraftOptions: [
      { aircraft_type_code: "C208", display_name: "Cessna 208 Grand Caravan", requirement: "Opción oficial utilitaria para aeropuerto especial", badge: "C208" },
      { aircraft_type_code: "B350", display_name: "Beechcraft King Air 350", requirement: "Opción oficial regional para aeropuerto especial", badge: "B350" },
    ],
    specialRules: [
      "Usá exclusivamente el preset PWG_Checkride_SPECIAL_AIRPORT.WPR.",
      "C208 y B350 son las dos aeronaves válidas para esta habilitación.",
      "La evaluación considera criterio conservador y posibilidad de frustrada temprana.",
      "Modificar el clima deja la habilitación como inválida.",
    ],
    evaluationCriteria: [
      {
        title: "Planeamiento y briefing",
        bullets: [
          "Revisar meteorología, terreno y estrategia de aproximación antes del descenso.",
          "Llegar con conciencia situacional y criterio conservador.",
        ],
      },
      {
        title: "Gestión operacional",
        bullets: [
          "Controlar energía, configuración y perfil durante la llegada.",
          "Mantener margen para frustrar si la aproximación no está estable.",
        ],
      },
      {
        title: "Aterrizaje",
        bullets: [
          "Aterrizaje seguro, centrado y coherente con la situación meteorológica.",
          "No forzar la operación si las condiciones dejan de ser favorables.",
        ],
      },
      {
        title: "Integridad del clima",
        bullets: [
          "El preset oficial debe mantenerse igual al inicio del checkride.",
          "La evaluación considera la meteorología original del escenario, sin ayudas externas.",
        ],
      },
    ],
    flightPlan: [
      { title: "Planeamiento", description: "Cargar el preset oficial y revisar el escenario especial, su meteorología y el perfil de llegada." },
      { title: "Salida", description: "Despegar y establecer el vuelo con margen operacional y conciencia del terreno." },
      { title: "Ruta", description: "Mantener un vuelo ordenado, gestionando meteorología y combustible según el escenario." },
      { title: "Llegada", description: "Desarrollar una aproximación conservadora, preparada para frustrar si la situación lo exige." },
      { title: "Cierre", description: "Completar aterrizaje y rodaje solo si la operación permanece segura y el checkride sigue conforme." },
    ],
    scoring: {
      maxScore: 100,
      passScore: 85,
      items: [
        "Preset especial correcto.",
        "Planeamiento y briefing completos.",
        "Operación conservadora y estabilizada.",
        "Decisiones seguras durante la llegada.",
      ],
    },
  },
];

const TRAINING_THEORY_ASSETS = {
  briefing: "/dispatch/flight-types/training.png",
  dispatch: "/dispatch/flight-types/charter.png",
  acars: "/dispatch/flight-types/free-flight.png",
  procedures: "/dispatch/flight-types/career.png",
  safety: "/dispatch/flight-types/habilitaciones.png",
  weather: "/dispatch/flight-types/special-mission.png",
} as const;

const TRAINING_THEORY_OPTION_IDS = ["A", "B", "C", "D"] as const;

type TrainingTheoryQuestionSeed = {
  topic: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  imagePath?: string;
};

function buildTrainingTheoryQuestions(
  examCode: string,
  defaultImagePath: string,
  seeds: TrainingTheoryQuestionSeed[],
): TrainingTheoryQuestion[] {
  return seeds.map((seed, index) => ({
    id: `${examCode}-Q${String(index + 1).padStart(2, "0")}`,
    topic: seed.topic,
    prompt: seed.prompt,
    imagePath: seed.imagePath ?? defaultImagePath,
    options: seed.options.map((label, optionIndex) => ({
      id: TRAINING_THEORY_OPTION_IDS[optionIndex],
      label,
    })),
    correctOptionId: TRAINING_THEORY_OPTION_IDS[seed.correctIndex],
    explanation: seed.explanation,
  }));
}

const TRAINING_THEORY_EXAMS: TrainingTheoryExam[] = [
  {
    code: "T1",
    title: "Teórica 1",
    description: "Reglamento operativo base, flujo web, despacho, reservas y uso inicial del ACARS Patagonia Wings.",
    durationMinutes: 15,
    passScore: 85,
    imagePath: TRAINING_THEORY_ASSETS.briefing,
    status: "Disponible",
    questions: buildTrainingTheoryQuestions("T1", TRAINING_THEORY_ASSETS.briefing, [
      {
        topic: "Operación base",
        prompt: "¿Cuál es el objetivo principal de una evaluación teórica Patagonia Wings?",
        options: [
          "Validar conocimiento y criterio antes de avanzar a etapas prácticas.",
          "Cambiar automáticamente el rango del piloto sin volar.",
          "Reemplazar al ACARS durante todos los vuelos.",
          "Eliminar la necesidad de realizar briefing antes del despacho.",
        ],
        correctIndex: 0,
        explanation: "La teórica valida conocimiento operacional antes de habilitar pasos prácticos o checkrides.",
      },
      {
        topic: "Flujo operacional",
        prompt: "¿Cuál es el flujo general recomendado antes de iniciar un vuelo en Patagonia Wings?",
        options: [
          "Despegar primero y crear el despacho después.",
          "Seleccionar modalidad, preparar despacho/OFP, conectar ACARS, volar y cerrar.",
          "Crear varias reservas para elegir una después.",
          "Volar sin briefing para ahorrar tiempo.",
        ],
        correctIndex: 1,
        explanation: "El flujo correcto mantiene trazabilidad entre web, OFP, simulador y ACARS.",
        imagePath: TRAINING_THEORY_ASSETS.procedures,
      },
      {
        topic: "Reserva activa",
        prompt: "Si el piloto ya tiene una reserva activa, lo correcto es:",
        options: [
          "Crear una segunda reserva igual.",
          "Usar esa reserva o cancelarla antes de preparar otra.",
          "Cambiar manualmente el callsign del OFP.",
          "Ignorarla y volar otra ruta.",
        ],
        correctIndex: 1,
        explanation: "El bloqueo evita duplicidad operacional y errores de reporte.",
        imagePath: TRAINING_THEORY_ASSETS.dispatch,
      },
      {
        topic: "Callsign",
        prompt: "En entrenamiento, el número de vuelo debe mantenerse como:",
        options: [
          "001 sin prefijo.",
          "El callsign completo del piloto, por ejemplo PWG001.",
          "Una matrícula de aeronave física.",
          "Cualquier texto libre que acepte SimBrief.",
        ],
        correctIndex: 1,
        explanation: "El callsign completo permite que la web y el ACARS reconozcan correctamente al piloto.",
      },
      {
        topic: "OFP",
        prompt: "Si el origen o destino del OFP no coincide con el despacho web, el piloto debe:",
        options: [
          "Continuar igual y corregir después del aterrizaje.",
          "Corregir el OFP o el despacho antes de iniciar el vuelo.",
          "Cambiar de avión sin actualizar la web.",
          "Reportar manualmente sin datos.",
        ],
        correctIndex: 1,
        explanation: "Las discrepancias deben corregirse antes de volar para evitar rechazo o revisión manual.",
        imagePath: TRAINING_THEORY_ASSETS.dispatch,
      },
      {
        topic: "Entrenamiento",
        prompt: "La matrícula 'Avion de entrenamiento' significa que:",
        options: [
          "Es una aeronave física que queda movida de aeropuerto.",
          "Es un registro genérico de entrenamiento, no una aeronave física de la aerolínea.",
          "El vuelo no debe conectarse al ACARS.",
          "El piloto queda libre de procedimientos.",
        ],
        correctIndex: 1,
        explanation: "El entrenamiento registra progreso por tipo/modelo sin mover aeronaves de flota.",
        imagePath: TRAINING_THEORY_ASSETS.acars,
      },
      {
        topic: "Progreso",
        prompt: "Para que un entrenamiento aporte al progreso del piloto, debe estar principalmente:",
        options: [
          "Completado o validado según los criterios del sistema.",
          "Cancelado antes de despegar.",
          "Creado dos veces para la misma ruta.",
          "Sin origen ni destino definidos.",
        ],
        correctIndex: 0,
        explanation: "El progreso se alimenta de vuelos completados o válidos, no de cancelaciones.",
      },
      {
        topic: "Integridad",
        prompt: "Durante una evaluación o checkride, ¿qué conducta deja la prueba como no conforme?",
        options: [
          "Leer el briefing antes de iniciar.",
          "Mantener el procedimiento estabilizado.",
          "Modificar condiciones obligatorias para facilitar el resultado.",
          "Usar la aeronave oficial indicada.",
        ],
        correctIndex: 2,
        explanation: "Alterar condiciones obligatorias afecta la integridad de la evaluación.",
        imagePath: TRAINING_THEORY_ASSETS.safety,
      },
      {
        topic: "Despacho",
        prompt: "¿Para qué sirve el despacho operacional?",
        options: [
          "Para definir vuelo, ruta, aeronave, modalidad y reglas antes de ACARS.",
          "Solo para decorar el dashboard.",
          "Para cambiar el rango del piloto automáticamente.",
          "Para evitar que el piloto planifique combustible.",
        ],
        correctIndex: 0,
        explanation: "El despacho ordena los datos que luego deben coincidir con OFP, simulador y ACARS.",
        imagePath: TRAINING_THEORY_ASSETS.dispatch,
      },
      {
        topic: "ACARS",
        prompt: "El ACARS debe leer principalmente:",
        options: [
          "Solo la foto del avión.",
          "La reserva/despacho activo y la telemetría del simulador.",
          "Un vuelo inventado si no hay despacho.",
          "Cualquier aeropuerto aunque no coincida.",
        ],
        correctIndex: 1,
        explanation: "El ACARS debe trabajar contra el despacho activo para validar coherencia operacional.",
        imagePath: TRAINING_THEORY_ASSETS.acars,
      },
      {
        topic: "SimBrief",
        prompt: "¿Por qué se usa SimBrief/OFP dentro del flujo operacional?",
        options: [
          "Para planificar ruta, combustible y datos operacionales del vuelo.",
          "Para reemplazar completamente al ACARS.",
          "Para mover al piloto sin volar.",
          "Para omitir el despacho.",
        ],
        correctIndex: 0,
        explanation: "El OFP entrega datos de planificación que deben ser coherentes con la reserva/despacho.",
        imagePath: TRAINING_THEORY_ASSETS.dispatch,
      },
      {
        topic: "Cierre",
        prompt: "¿Cuándo se puede finalizar una evaluación teórica?",
        options: [
          "Después de responder y finalizar, o cuando se acabe el tiempo.",
          "Antes de leer las preguntas para guardar el resultado.",
          "Cuando el piloto cambie de pestaña.",
          "Después de borrar la reserva activa.",
        ],
        correctIndex: 0,
        explanation: "La evaluación se cierra por finalización manual o por término automático del tiempo.",
      },
      {
        topic: "Aprobación",
        prompt: "Con 15 preguntas y aprobación mínima de 85%, el piloto debe lograr al menos:",
        options: ["8 correctas.", "10 correctas.", "13 correctas.", "15 obligatoriamente."],
        correctIndex: 2,
        explanation: "85% de 15 preguntas exige 13 respuestas correctas o más.",
      },
      {
        topic: "Reintento",
        prompt: "Si un piloto reprueba una teórica, el sistema debe:",
        options: [
          "Permitir intentos ilimitados inmediatos.",
          "Bloquear el reintento por 7 días.",
          "Aprobarlo automáticamente.",
          "Eliminar su cuenta.",
        ],
        correctIndex: 1,
        explanation: "El bloqueo de 7 días evita intentos repetitivos sin estudio.",
        imagePath: TRAINING_THEORY_ASSETS.safety,
      },
      {
        topic: "Trazabilidad",
        prompt: "La mejor forma de mantener trazabilidad operacional es:",
        options: [
          "Mantener coherencia entre web, OFP, simulador, ACARS y cierre.",
          "Cambiar datos en cada etapa.",
          "Volar sin reserva para ahorrar pasos.",
          "Usar siempre matrícula genérica en itinerarios.",
        ],
        correctIndex: 0,
        explanation: "La coherencia de datos es la base del sistema Patagonia Wings.",
      },
    ]),
  },
  {
    code: "T2",
    title: "Teórica 2",
    description: "Meteorología básica, METAR/TAF, mínimos, viento y toma de decisiones operacionales.",
    durationMinutes: 15,
    passScore: 85,
    imagePath: TRAINING_THEORY_ASSETS.weather,
    status: "Disponible",
    questions: buildTrainingTheoryQuestions("T2", TRAINING_THEORY_ASSETS.weather, [
      { topic: "METAR", prompt: "¿Qué representa principalmente un METAR?", options: ["Pronóstico mensual.", "Reporte meteorológico observado de un aeródromo.", "Plan de vuelo operacional.", "Carta de aproximación."], correctIndex: 1, explanation: "El METAR describe condiciones observadas en un aeródromo en un momento determinado." },
      { topic: "TAF", prompt: "¿Qué entrega un TAF?", options: ["Pronóstico meteorológico para un aeródromo.", "Peso máximo de despegue.", "Código de reserva.", "Estado de mantenimiento."], correctIndex: 0, explanation: "El TAF es un pronóstico aeronáutico usado para planificación." },
      { topic: "Techo", prompt: "En operación IFR, un techo bajo afecta principalmente:", options: ["El color de la librea.", "La planificación de mínimos y aproximación.", "El callsign del piloto.", "El número de pasajeros web."], correctIndex: 1, explanation: "El techo bajo obliga a revisar mínimos y capacidad de aproximación." },
      { topic: "Visibilidad", prompt: "La visibilidad reducida exige al piloto:", options: ["Mayor disciplina de procedimiento y decisión de mínimos.", "Aumentar velocidad de aproximación sin cálculo.", "Ignorar cartas.", "Apagar luces de aterrizaje siempre."], correctIndex: 0, explanation: "La visibilidad reducida aumenta la exigencia de estabilización y decisión." },
      { topic: "QNH", prompt: "El QNH se utiliza para:", options: ["Ajustar el altímetro a presión local.", "Calcular matrícula.", "Crear una ruta en SimBrief automáticamente.", "Elegir textura de nube."], correctIndex: 0, explanation: "El QNH permite que el altímetro indique altitud referida al nivel medio del mar." },
      { topic: "Viento cruzado", prompt: "Un viento cruzado fuerte requiere:", options: ["Técnica adecuada y verificación de límites de aeronave/piloto.", "Aterrizar siempre sin flaps.", "Cerrar ACARS antes del final.", "Cambiar a VFR aunque esté IMC."], correctIndex: 0, explanation: "La componente cruzada debe compararse con límites y técnica disponible." },
      { topic: "Viento de cola", prompt: "Un viento de cola en aterrizaje normalmente:", options: ["Reduce distancia de aterrizaje.", "Aumenta distancia requerida y puede penalizar la operación.", "No afecta a ninguna aeronave.", "Hace innecesario revisar pista."], correctIndex: 1, explanation: "El viento de cola incrementa distancia y riesgo operacional." },
      { topic: "Lluvia", prompt: "La pista mojada implica revisar:", options: ["Solo el logo de la aerolínea.", "Distancia de aterrizaje, frenado y técnica de aproximación.", "El color del menú.", "El número de vuelo únicamente."], correctIndex: 1, explanation: "La pista contaminada o mojada altera frenado y performance." },
      { topic: "Alterno", prompt: "La meteorología de destino deteriorada puede exigir:", options: ["Planificar alterno y combustible adicional.", "Eliminar el OFP.", "Volver a iniciar la cuenta de piloto.", "Usar cualquier avión sin habilitación."], correctIndex: 0, explanation: "El alterno es parte clave de la planificación con meteorología marginal." },
      { topic: "CAT I", prompt: "Una aproximación CAT I corresponde a:", options: ["Aproximación de precisión con mínimos estándar.", "Vuelo sin instrumentos.", "Autoland obligatorio siempre.", "Rodaje visual solamente."], correctIndex: 0, explanation: "CAT I es una aproximación de precisión con mínimos menos restrictivos que CAT II/III." },
      { topic: "CAT II/III", prompt: "CAT II y CAT III requieren principalmente:", options: ["Menor preparación.", "Aeronave, piloto y procedimiento aptos para baja visibilidad.", "Solo viento calma.", "No usar cartas."], correctIndex: 1, explanation: "Las categorías avanzadas exigen equipamiento, habilitación y mínimos específicos." },
      { topic: "Tormenta", prompt: "Ante tormenta o cizalladura reportada en final, la decisión conservadora es:", options: ["Continuar siempre.", "Evaluar demora, alterno o frustrada según corresponda.", "Apagar transponder.", "Cambiar matrícula."], correctIndex: 1, explanation: "La seguridad operacional prima ante fenómenos severos." },
      { topic: "Bruma/niebla", prompt: "La niebla afecta principalmente:", options: ["La percepción visual de pista y referencias externas.", "La cantidad de pasajeros del sistema.", "El nombre del piloto.", "El tipo de combustible cargado en la web."], correctIndex: 0, explanation: "La niebla reduce referencias visuales críticas en aproximación y aterrizaje." },
      { topic: "Briefing meteo", prompt: "Antes de un checkride meteorológico, el piloto debe:", options: ["Revisar condiciones, mínimos y limitaciones antes de iniciar.", "Cambiar el preset para hacerlo más fácil.", "Volar sin briefing.", "Usar una ruta distinta sin aviso."], correctIndex: 0, explanation: "La revisión previa permite decidir si la operación es segura y válida." },
      { topic: "Integridad", prompt: "Si la evaluación exige un preset meteorológico, el piloto debe:", options: ["Mantenerlo sin cambios durante toda la prueba.", "Modificarlo al llegar a final.", "Cambiarlo si no ve la pista.", "Usar clima externo no autorizado."], correctIndex: 0, explanation: "Cambiar condiciones obligatorias invalida la comparación justa de la evaluación." },
    ]),
  },
  {
    code: "T3",
    title: "Teórica 3",
    description: "Despacho, combustible, peso, alternate, coherencia OFP-web y validaciones previas al vuelo.",
    durationMinutes: 15,
    passScore: 85,
    imagePath: TRAINING_THEORY_ASSETS.dispatch,
    status: "Disponible",
    questions: buildTrainingTheoryQuestions("T3", TRAINING_THEORY_ASSETS.dispatch, [
      { topic: "Despacho", prompt: "El despacho debe prepararse:", options: ["Antes de iniciar el vuelo y antes de conectar ACARS.", "Después de aterrizar.", "Solo si el piloto quiere.", "Cuando el avión ya está en crucero."], correctIndex: 0, explanation: "El despacho define los datos base que ACARS debe validar." },
      { topic: "Combustible", prompt: "El combustible cargado debe ser coherente con:", options: ["El OFP y las tolerancias definidas.", "El color de la cabina.", "El último video visto.", "Una cifra al azar."], correctIndex: 0, explanation: "La coherencia de combustible evita ventajas o errores operacionales." },
      { topic: "ZFW", prompt: "El ZFW sirve para validar principalmente:", options: ["Peso sin combustible y coherencia de carga/payload.", "Código de aeropuerto.", "Nombre de la librea.", "Hora local del usuario."], correctIndex: 0, explanation: "El ZFW ayuda a contrastar carga real versus planificación." },
      { topic: "Alternate", prompt: "Un alterno se considera especialmente cuando:", options: ["La meteorología o combustible lo requieren.", "El usuario quiere cambiar el menú.", "El avión tiene pintura blanca.", "El callsign termina en 1."], correctIndex: 0, explanation: "El alterno aporta margen de seguridad en planificación." },
      { topic: "OFP", prompt: "El OFP debe coincidir con la web en:", options: ["Número de vuelo/callsign, origen, destino y aeronave cuando aplique.", "Solo el color del mapa.", "Solo la hora local del navegador.", "Nada, porque son sistemas separados."], correctIndex: 0, explanation: "La validación cruzada reduce errores antes del vuelo." },
      { topic: "Ruta", prompt: "Si el piloto cambia origen en SimBrief pero no en la web:", options: ["Se genera inconsistencia operacional.", "La reserva se corrige sola siempre.", "No importa en ACARS.", "Aumenta automáticamente el score."], correctIndex: 0, explanation: "El sistema espera que ambos lados representen el mismo vuelo." },
      { topic: "Aeronave", prompt: "La aeronave seleccionada debe ser:", options: ["Compatible con el tipo de operación y el despacho.", "Siempre la más grande disponible.", "Una cualquiera aunque no exista.", "La del último piloto conectado."], correctIndex: 0, explanation: "La compatibilidad evita operaciones irreales o fuera de rango." },
      { topic: "Horario", prompt: "El horario de salida planificado sirve para:", options: ["Medir orden operacional y preparar el vuelo.", "Borrar los vuelos antiguos.", "Cambiar el hub base.", "Evitar usar OFP."], correctIndex: 0, explanation: "El horario forma parte de la disciplina de despacho." },
      { topic: "Estado", prompt: "Una reserva completada no debe:", options: ["Volver a aparecer como reserva activa.", "Quedar en historial si es válida.", "Tener reporte asociado.", "Mostrar ruta final."], correctIndex: 0, explanation: "Las reservas finalizadas no deben bloquear nuevos vuelos." },
      { topic: "Cancelación", prompt: "Cancelar una reserva activa debe:", options: ["Liberar el flujo para preparar una nueva reserva.", "Duplicar el vuelo.", "Aprobar una teórica.", "Cambiar la carrera del piloto."], correctIndex: 0, explanation: "La cancelación ordenada libera el estado operativo." },
      { topic: "Itinerario", prompt: "En itinerarios, la aeronave física normalmente:", options: ["Queda ubicada donde terminó el vuelo.", "Vuelve siempre al hub sin regla.", "No tiene aeropuerto.", "Se ignora completamente."], correctIndex: 0, explanation: "La ubicación de flota es clave para una aerolínea persistente." },
      { topic: "Entrenamiento", prompt: "En entrenamiento, el registro de aeronave es:", options: ["Genérico por tipo/modelo, sin matrícula física.", "Siempre CC-PWG0001.", "La matrícula real del itinerario.", "Un campo prohibido."], correctIndex: 0, explanation: "El entrenamiento evalúa progreso sin mover la flota real." },
      { topic: "Errores", prompt: "Si aparece un error de columna en Supabase al reservar, corresponde:", options: ["Revisar función/tabla y adaptar al esquema real.", "Ignorarlo y seguir volando.", "Eliminar toda la base.", "Cambiar la foto del avión."], correctIndex: 0, explanation: "Los errores de esquema deben corregirse en SQL o código antes de continuar." },
      { topic: "Trazabilidad", prompt: "La trazabilidad se mantiene cuando:", options: ["Cada etapa conserva los mismos datos operacionales.", "Cada sistema usa datos distintos.", "No se guarda historial.", "Se desactiva ACARS."], correctIndex: 0, explanation: "La consistencia es necesaria para historial, score y auditoría." },
      { topic: "Buenas prácticas", prompt: "Antes de finalizar un despacho, el piloto debe revisar:", options: ["Ruta, aeronave, combustible, hora, OFP y condiciones.", "Solo el botón final.", "Solo el color del avión.", "Nada si ya tiene experiencia."], correctIndex: 0, explanation: "La revisión previa evita errores que luego impactan ACARS y reporte." },
    ]),
  },
  {
    code: "T4",
    title: "Teórica 4",
    description: "Procedimientos IFR, navegación, aproximaciones, estabilización y operación instrumental.",
    durationMinutes: 15,
    passScore: 85,
    imagePath: TRAINING_THEORY_ASSETS.procedures,
    status: "Disponible",
    questions: buildTrainingTheoryQuestions("T4", TRAINING_THEORY_ASSETS.procedures, [
      { topic: "IFR", prompt: "Volar IFR implica principalmente:", options: ["Seguir procedimientos instrumentales y autorizaciones.", "Volar sin instrumentos.", "Ignorar cartas.", "Elegir rumbo al azar."], correctIndex: 0, explanation: "IFR exige disciplina de navegación, altitudes y procedimientos." },
      { topic: "SID", prompt: "Una SID corresponde a:", options: ["Salida instrumental publicada.", "Carta de estacionamiento.", "Reporte de mantenimiento.", "Tipo de combustible."], correctIndex: 0, explanation: "La SID ordena la salida desde el aeropuerto." },
      { topic: "STAR", prompt: "Una STAR se usa para:", options: ["Ordenar la llegada hacia el área terminal.", "Definir el color de luces.", "Calcular salario del piloto.", "Omitir el descenso."], correctIndex: 0, explanation: "La STAR conecta ruta con aproximación o llegada terminal." },
      { topic: "ILS", prompt: "El ILS entrega principalmente:", options: ["Guía lateral y vertical para aproximación de precisión.", "Solo temperatura exterior.", "Cantidad de pasajeros.", "Número de hub."], correctIndex: 0, explanation: "Localizador y glideslope guían la aproximación." },
      { topic: "Estabilización", prompt: "Una aproximación estabilizada exige:", options: ["Configuración, velocidad, senda y potencia controladas.", "Velocidad variable sin límites.", "Cambios bruscos cerca de pista.", "Flaps retraídos siempre."], correctIndex: 0, explanation: "La estabilización reduce riesgo en final." },
      { topic: "Mínimos", prompt: "Al llegar a mínimos sin referencias suficientes, corresponde:", options: ["Ejecutar frustrada.", "Continuar a ciegas.", "Apagar instrumentos.", "Cambiar destino en la web."], correctIndex: 0, explanation: "Sin referencias válidas, se debe frustrar." },
      { topic: "Frustrada", prompt: "Una aproximación frustrada debe:", options: ["Seguir el procedimiento publicado o instrucción ATC.", "Ser improvisada sin rumbo.", "Realizarse con tren abajo todo el circuito.", "No registrarse."], correctIndex: 0, explanation: "La frustrada es parte normal y segura de la operación IFR." },
      { topic: "Briefing", prompt: "El briefing de aproximación debe incluir:", options: ["Procedimiento, mínimos, altitudes, configuración y frustrada.", "Solo el destino.", "Solo la librea.", "Ningún dato si hay piloto automático."], correctIndex: 0, explanation: "Un briefing completo prepara al piloto ante contingencias." },
      { topic: "Altímetro", prompt: "Cruzar niveles de transición exige revisar:", options: ["Ajuste altimétrico local/estándar según fase.", "La foto del aeropuerto.", "El menú de entrenamiento.", "La contraseña."], correctIndex: 0, explanation: "El ajuste correcto evita errores verticales." },
      { topic: "Velocidad", prompt: "Bajo 10.000 ft normalmente se controla:", options: ["Límite de 250 kt salvo autorización/regla específica.", "Velocidad libre.", "Mach máximo solamente.", "Ninguna restricción."], correctIndex: 0, explanation: "El control de velocidad es parte del reglaje operacional." },
      { topic: "Luces", prompt: "El uso correcto de luces en pista y vuelo contribuye a:", options: ["Seguridad, visibilidad y cumplimiento de procedimientos.", "Cambiar el score sin relación.", "Reducir peso del avión.", "Eliminar la necesidad de ATC."], correctIndex: 0, explanation: "Las luces forman parte de SOP y seguridad." },
      { topic: "Config", prompt: "La configuración para aterrizaje debe completarse:", options: ["Con anticipación suficiente para estabilizar.", "Después de tocar pista.", "Solo al cerrar ACARS.", "Nunca en IFR."], correctIndex: 0, explanation: "Configurar tarde suele causar aproximaciones inestables." },
      { topic: "Conciencia situacional", prompt: "La conciencia situacional incluye saber:", options: ["Posición, altitud, energía, clima y siguiente acción.", "Solo el color de la web.", "Solo el nombre del avión.", "La cantidad de usuarios online."], correctIndex: 0, explanation: "Mantener el cuadro completo permite anticiparse." },
      { topic: "Autopilot", prompt: "El piloto automático:", options: ["Ayuda, pero no reemplaza el monitoreo del piloto.", "Elimina toda responsabilidad.", "Permite ignorar mínimos.", "Debe apagarse siempre antes del descenso."], correctIndex: 0, explanation: "El piloto sigue siendo responsable de monitorear y decidir." },
      { topic: "Cierre IFR", prompt: "Después del aterrizaje, el piloto debe:", options: ["Completar rodaje y cierre según procedimiento.", "Cerrar todo en la pista.", "Cambiar el aeropuerto de destino manualmente.", "Borrar el vuelo."], correctIndex: 0, explanation: "El cierre ordenado completa la trazabilidad del vuelo." },
    ]),
  },
  {
    code: "T5",
    title: "Teórica 5",
    description: "CRM, seguridad operacional, gestión de amenazas y errores, disciplina de cabina y toma de decisiones.",
    durationMinutes: 15,
    passScore: 85,
    imagePath: TRAINING_THEORY_ASSETS.safety,
    status: "Disponible",
    questions: buildTrainingTheoryQuestions("T5", TRAINING_THEORY_ASSETS.safety, [
      { topic: "CRM", prompt: "CRM significa principalmente:", options: ["Gestión de recursos de cabina/tripulación.", "Cambio rápido de matrícula.", "Control remoto de mapa.", "Código de reserva manual."], correctIndex: 0, explanation: "CRM busca usar todos los recursos disponibles para una operación segura." },
      { topic: "TEM", prompt: "TEM se enfoca en:", options: ["Amenazas, errores y manejo de estados no deseados.", "Solo estética de cabina.", "Ranking de pilotos por likes.", "Eliminar briefing."], correctIndex: 0, explanation: "Threat and Error Management permite anticipar y corregir riesgos." },
      { topic: "Amenaza", prompt: "Un ejemplo de amenaza operacional es:", options: ["Clima deteriorado en destino.", "Un fondo bonito en la web.", "El nombre del piloto.", "Una imagen de entrenamiento."], correctIndex: 0, explanation: "El clima adverso es una amenaza que debe gestionarse." },
      { topic: "Error", prompt: "Si el piloto detecta que cargó mal el combustible antes de salir, debe:", options: ["Corregir antes de iniciar o continuar la operación.", "Ignorarlo para no atrasarse.", "Cambiar el reporte final.", "Desactivar ACARS."], correctIndex: 0, explanation: "Detectar y corregir errores temprano es una conducta segura." },
      { topic: "Decisión", prompt: "Una decisión conservadora es preferible cuando:", options: ["La seguridad o los mínimos están comprometidos.", "El piloto quiere más puntos a toda costa.", "La pista no importa.", "El tiempo se acaba en la web."], correctIndex: 0, explanation: "La seguridad prevalece sobre puntualidad o score." },
      { topic: "Fatiga", prompt: "La fatiga puede afectar:", options: ["Atención, memoria, reacción y toma de decisiones.", "Solo el color del monitor.", "La matrícula del avión.", "El nombre del aeropuerto."], correctIndex: 0, explanation: "La fatiga es un factor humano crítico." },
      { topic: "Briefing", prompt: "Un buen briefing ayuda a:", options: ["Alinear plan, amenazas, roles y contingencias.", "Evitar leer procedimientos.", "Cambiar la meteorología.", "Aumentar el rango automáticamente."], correctIndex: 0, explanation: "El briefing anticipa escenarios y reduce improvisación." },
      { topic: "Comunicación", prompt: "La comunicación operacional debe ser:", options: ["Clara, breve y verificable.", "Ambigua.", "Solo visual.", "Innecesaria si hay piloto automático."], correctIndex: 0, explanation: "La comunicación clara reduce malentendidos." },
      { topic: "Go-around", prompt: "Una frustrada debe verse como:", options: ["Una maniobra normal de seguridad.", "Un fracaso del piloto.", "Algo prohibido.", "Una forma de evitar reporte."], correctIndex: 0, explanation: "Frustrar a tiempo es una decisión profesional." },
      { topic: "Procedimientos", prompt: "Los SOP existen para:", options: ["Estandarizar y reducir variabilidad operacional.", "Hacer más lenta la web.", "Evitar capacitación.", "Reemplazar criterio."], correctIndex: 0, explanation: "Los SOP entregan una base común de operación." },
      { topic: "Incidente", prompt: "Si ocurre un incidente, el piloto debe:", options: ["Reportar con transparencia y datos correctos.", "Ocultarlo cambiando datos.", "Cerrar el navegador.", "Crear una nueva reserva encima."], correctIndex: 0, explanation: "La cultura justa requiere reportes honestos para aprender." },
      { topic: "Presión operacional", prompt: "La presión por llegar a horario no debe:", options: ["Superar mínimos ni seguridad operacional.", "Ser considerada nunca.", "Cambiar la librea.", "Eliminar el despacho."], correctIndex: 0, explanation: "La puntualidad nunca debe estar por sobre seguridad." },
      { topic: "Automatización", prompt: "El exceso de confianza en automatización puede provocar:", options: ["Pérdida de monitoreo y conciencia situacional.", "Mejoras garantizadas siempre.", "Eliminación de errores humanos.", "Aprobación automática."], correctIndex: 0, explanation: "La automatización debe monitorearse activamente." },
      { topic: "Checklist", prompt: "Una checklist se usa para:", options: ["Confirmar acciones críticas y evitar omisiones.", "Decorar la cabina.", "Evitar aprender procedimientos.", "Cambiar el callsign."], correctIndex: 0, explanation: "La checklist es una defensa contra errores." },
      { topic: "Cultura", prompt: "Una cultura operacional madura promueve:", options: ["Seguridad, aprendizaje, disciplina y reporte honesto.", "Ocultar errores.", "Competir sin reglas.", "Modificar evaluaciones."], correctIndex: 0, explanation: "Patagonia Wings debe privilegiar seguridad y aprendizaje." },
    ]),
  },
  {
    code: "T6",
    title: "Teórica 6",
    description: "Evaluación integradora previa a checkrides y habilitaciones avanzadas Patagonia Wings.",
    durationMinutes: 15,
    passScore: 85,
    imagePath: TRAINING_THEORY_ASSETS.acars,
    status: "Disponible",
    questions: buildTrainingTheoryQuestions("T6", TRAINING_THEORY_ASSETS.acars, [
      { topic: "Integración", prompt: "La operación completa Patagonia Wings integra:", options: ["Web, despacho, OFP, simulador, ACARS y reporte final.", "Solo una foto de avión.", "Solo el chat del piloto.", "Un vuelo manual sin datos."], correctIndex: 0, explanation: "El sistema funciona por coherencia entre todas las etapas." },
      { topic: "Checkride", prompt: "Un checkride práctico evalúa principalmente:", options: ["Ejecución operacional bajo reglas y condiciones definidas.", "Solo la velocidad de internet.", "La cantidad de skins instaladas.", "El tamaño de la pantalla."], correctIndex: 0, explanation: "El checkride valida desempeño práctico y criterio." },
      { topic: "Teórica", prompt: "Una teórica aprobada debe:", options: ["Bloquearse para evitar repetirla innecesariamente.", "Repetirse cada minuto.", "Eliminar el historial.", "Crear una reserva física."], correctIndex: 0, explanation: "Al aprobar, el piloto ya cumplió esa etapa formativa." },
      { topic: "Reprobación", prompt: "Una reprobación debe generar:", options: ["Espera de 7 días antes de nuevo intento.", "Aprobación automática.", "Borrado de piloto.", "Ascenso de rango."], correctIndex: 0, explanation: "El período de espera fomenta estudio antes del reintento." },
      { topic: "ACARS", prompt: "Si ACARS no coincide con el despacho, el vuelo puede quedar:", options: ["Observado, rechazado o en revisión según regla.", "Siempre aprobado.", "Sin registro.", "Convertido en tour."], correctIndex: 0, explanation: "La inconsistencia afecta la validación del vuelo." },
      { topic: "Score", prompt: "El Patagonia Score debe reflejar:", options: ["Procedimientos, performance, incidentes y bonificaciones/penalizaciones.", "Solo distancia recorrida.", "Solo gusto personal.", "Solo la matrícula."], correctIndex: 0, explanation: "El score debe representar calidad operacional integral." },
      { topic: "Habilitación", prompt: "Una habilitación práctica se debe asignar según:", options: ["Aeronave/sistema, meteorología, rango y criterios definidos.", "Azar.", "Color del avión.", "Tamaño del monitor."], correctIndex: 0, explanation: "La habilitación debe ser coherente con capacidad real y entrenamiento." },
      { topic: "Aeronave oficial", prompt: "Si el checkride ofrece dos aeronaves oficiales:", options: ["Cualquiera de las dos es válida para ese checkride.", "Una debe reprobar automáticamente.", "El piloto debe adivinar la correcta.", "No se puede volar."], correctIndex: 0, explanation: "Las opciones oficiales son válidas por diseño del programa." },
      { topic: "Preset", prompt: "El preset climático oficial en checkride debe:", options: ["Mantenerse sin cambios para conservar integridad.", "Modificarse si el piloto quiere menos dificultad.", "Borrarse antes de despegar.", "Usarse solo en la web."], correctIndex: 0, explanation: "La condición fija permite evaluar a todos bajo el mismo estándar." },
      { topic: "Rango", prompt: "Permitir entrenar una categoría antes del rango busca:", options: ["Preparar transición progresiva del piloto.", "Saltarse todo el sistema.", "Evitar evaluación.", "Eliminar horas."], correctIndex: 0, explanation: "La transición anticipada permite aprendizaje antes de habilitación formal." },
      { topic: "Historial", prompt: "El historial debe mostrar principalmente vuelos:", options: ["Completados o evaluables, no cancelaciones normales.", "Todos los intentos borrados.", "Solo reservas vacías.", "Solo vuelos sin ACARS."], correctIndex: 0, explanation: "El historial debe representar actividad operacional real." },
      { topic: "Datos vivos", prompt: "Las estadísticas útiles deben basarse en:", options: ["Datos reales de Supabase y vuelos completados/evaluables.", "Mockups permanentes.", "Números inventados.", "Solo texto fijo."], correctIndex: 0, explanation: "El panel debe evolucionar hacia datos vivos confiables." },
      { topic: "Seguridad", prompt: "Un vuelo con manipulación indebida para obtener ventaja debe:", options: ["Quedar observado, invalidado o penalizado según la regla.", "Premiarse.", "Ignorarse.", "Duplicarse."], correctIndex: 0, explanation: "La integridad operacional protege el sistema de evaluación." },
      { topic: "Cierre", prompt: "El cierre correcto de un vuelo requiere:", options: ["Completar procedimiento, enviar reporte y liberar estados según corresponda.", "Apagar el PC sin cerrar.", "Crear otra reserva encima.", "Cambiar destino después."], correctIndex: 0, explanation: "El cierre ordenado mantiene historial y flota consistentes." },
      { topic: "Criterio", prompt: "El criterio operacional correcto ante duda crítica es:", options: ["Elegir la opción más segura y revisar antes de continuar.", "Improvisar para ahorrar tiempo.", "Forzar la operación.", "Cambiar los datos finales."], correctIndex: 0, explanation: "La toma de decisiones conservadora es clave en la filosofía Patagonia Wings." },
    ]),
  },
];

function buildWikimediaPhotoUrl(fileName: string) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
}

const TRAINING_AIRCRAFT_EXACT_PHOTO_MAP: Record<string, string> = {
  A319: buildWikimediaPhotoUrl("S7 Airbus A319.jpg"),
  A320: buildWikimediaPhotoUrl("WizzAir Airbus A320.jpg"),
  A20N: buildWikimediaPhotoUrl("WizzAir Airbus A320.jpg"),
  A321: buildWikimediaPhotoUrl("BMI Airbus A321.jpg"),
  A21N: buildWikimediaPhotoUrl("BMI Airbus A321.jpg"),
  C208: buildWikimediaPhotoUrl("Cessna 208 Caravan FAC5059 (5174238112).jpg"),
  B350: buildWikimediaPhotoUrl("Beechcraft Super King Air 350 N68RF FDK MD1.jpg"),
  BE58: buildWikimediaPhotoUrl("Beech Baron 58 TC VH-LWM at Wagga Wagga Airport.jpg"),
  B736: buildWikimediaPhotoUrl("Boeing 737-600.jpg"),
  B737: buildWikimediaPhotoUrl("TUIfly Boeing 737 700.jpg"),
  B738: buildWikimediaPhotoUrl("Boeing 737-800.jpg"),
  B739: buildWikimediaPhotoUrl("Lion Air Boeing 737-900ER; PK-LFH@DPS;04.08.2015 733ly (21155190953).jpg"),
  MD82: buildWikimediaPhotoUrl("McDonnell Douglas MD-82 (HK-4374X).jpg"),
  MD83: buildWikimediaPhotoUrl("McDonnell Douglas MD-83 (OY-RUE).jpg"),
  MD88: buildWikimediaPhotoUrl("McDonnell Douglas MD-88 N920DE.jpg"),
  E175: buildWikimediaPhotoUrl("Embraer EMB-170-200 LR E175LR (N401YX, cn 17000363) (10-11-2022).jpg"),
  E190: buildWikimediaPhotoUrl("Embraer 190-100LR, Aeromexico Connect JP7335949.jpg"),
  E195: buildWikimediaPhotoUrl("LOT - Polish Airlines Embraer ERJ-195LR; SP-LNC@ZRH;14.10.2011 617iu (6242944868).jpg"),
  ATR72: buildWikimediaPhotoUrl("ATR 72 G-LMRZ MG 9621.jpg"),
  B78X: buildWikimediaPhotoUrl("Boeing 787-9 American Airlines 09.jpg"),
  B789: buildWikimediaPhotoUrl("Boeing 787-9 American Airlines 09.jpg"),
  A339: buildWikimediaPhotoUrl("Airbus A330-941, Airbus Industries AN1954784.jpg"),
  B773: buildWikimediaPhotoUrl("Boeing 777-300ER (Cathay Pacific) (4867841227).jpg"),
  B77W: buildWikimediaPhotoUrl("Boeing 777-300ER (Cathay Pacific) (4867841227).jpg"),
};

const TRAINING_AIRCRAFT_MODEL_HINT_MAP: Array<{ matches: string[]; url: string }> = [
  { matches: ["737-600", "B737-600", "BOEING 737-600"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.B736 },
  { matches: ["737-700", "B737-700", "BOEING 737-700"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.B737 },
  { matches: ["737-800", "B737-800", "BOEING 737-800"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.B738 },
  { matches: ["737-900", "737-900ER", "B737-900", "BOEING 737-900"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.B739 },
  { matches: ["A319"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.A319 },
  { matches: ["A320", "A20N", "A320NEO"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.A20N },
  { matches: ["A321", "A21N", "A321NEO"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.A21N },
  { matches: ["C208", "CARAVAN"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.C208 },
  { matches: ["B350", "KING AIR 350", "SUPER KING AIR 350"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.B350 },
  { matches: ["BE58", "BARON 58", "B58 BARON", "BEECH BARON"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.BE58 },
  { matches: ["MD82", "MD-82"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.MD82 },
  { matches: ["MD83", "MD-83"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.MD83 },
  { matches: ["MD88", "MD-88"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.MD88 },
  { matches: ["E175", "ERJ-175", "EMBRAER 175"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.E175 },
  { matches: ["E190", "ERJ-190", "EMBRAER 190"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.E190 },
  { matches: ["E195", "ERJ-195", "EMBRAER 195"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.E195 },
  { matches: ["ATR72", "ATR 72", "ATR-72"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.ATR72 },
  { matches: ["B789", "B78X", "787-9", "DREAMLINER"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.B789 },
  { matches: ["A339", "A330-900", "A330NEO", "A330-941", "AIRBUS A330"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.A339 },
  { matches: ["B773", "B77W", "777-300", "777-300ER", "BOEING 777"], url: TRAINING_AIRCRAFT_EXACT_PHOTO_MAP.B773 },
];

function isTrainingSchoolAircraft(code?: string | null) {
  return TRAINING_SCHOOL_AIRCRAFT.has((code ?? "").trim().toUpperCase());
}

const TRAINING_CATEGORY_SEQUENCE: TrainingCategoryKey[] = [
  "school",
  "single_turboprop",
  "twin_turboprop",
  "piston_twin",
  "regional_jet",
  "narrowbody_jet",
  "widebody_jet",
];

const TRAINING_CATEGORY_META: Record<
  TrainingCategoryKey,
  {
    title: string;
    description: string;
    tierLabel: string;
    accentClass: string;
    borderClass: string;
    badgeClass: string;
  }
> = {
  school: {
    title: "Escuela base",
    description: "Primer bloque para practicar fundamentos, procedimientos y adaptación a la red Patagonia Wings.",
    tierLabel: "Base",
    accentClass: "text-emerald-200",
    borderClass: "border-emerald-300/24 bg-emerald-400/[0.06]",
    badgeClass: "border-emerald-300/24 bg-emerald-400/12 text-emerald-100",
  },
  single_turboprop: {
    title: "Monomotor turbohélice",
    description: "Transición a operación utilitaria/regional liviana, ideal para reforzar gestión de energía y precisión.",
    tierLabel: "Tier 1",
    accentClass: "text-cyan-200",
    borderClass: "border-cyan-300/24 bg-cyan-400/[0.055]",
    badgeClass: "border-cyan-300/24 bg-cyan-400/12 text-cyan-100",
  },
  twin_turboprop: {
    title: "Turbohélice bimotor",
    description: "Paso natural a plataformas regionales con más performance, procedimientos y gestión de sistemas.",
    tierLabel: "Tier 2",
    accentClass: "text-sky-200",
    borderClass: "border-sky-300/24 bg-sky-400/[0.055]",
    badgeClass: "border-sky-300/24 bg-sky-400/12 text-sky-100",
  },
  piston_twin: {
    title: "Pistón bimotor",
    description: "Entrenamiento técnico enfocado en multimotor liviano y dominio fino de performance y navegación.",
    tierLabel: "Tier 2",
    accentClass: "text-teal-200",
    borderClass: "border-teal-300/24 bg-teal-400/[0.055]",
    badgeClass: "border-teal-300/24 bg-teal-400/12 text-teal-100",
  },
  regional_jet: {
    title: "Jet regional",
    description: "Primer salto al mundo jet: más velocidad, energía y operaciones comerciales con cabina moderna.",
    tierLabel: "Tier 3",
    accentClass: "text-indigo-200",
    borderClass: "border-indigo-300/24 bg-indigo-400/[0.055]",
    badgeClass: "border-indigo-300/24 bg-indigo-400/12 text-indigo-100",
  },
  narrowbody_jet: {
    title: "Jet narrowbody",
    description: "Bloque operacional para línea principal: más complejidad, más alcance y mayor disciplina de SOP.",
    tierLabel: "Tier 4",
    accentClass: "text-violet-200",
    borderClass: "border-violet-300/24 bg-violet-400/[0.055]",
    badgeClass: "border-violet-300/24 bg-violet-400/12 text-violet-100",
  },
  widebody_jet: {
    title: "Jet widebody",
    description: "Tope de progresión para largo alcance y cabinas complejas, reservado para pilotos ya consolidados.",
    tierLabel: "Tier 5",
    accentClass: "text-amber-200",
    borderClass: "border-amber-300/24 bg-amber-400/[0.055]",
    badgeClass: "border-amber-300/24 bg-amber-400/12 text-amber-100",
  },
};

const TRAINING_TYPE_CATEGORY_MAP: Record<string, TrainingCategoryKey> = {
  C172: "school",
  C208: "single_turboprop",
  B350: "twin_turboprop",
  ATR72: "twin_turboprop",
  BE58: "piston_twin",
  E175: "regional_jet",
  E190: "regional_jet",
  E195: "regional_jet",
  A319: "narrowbody_jet",
  A320: "narrowbody_jet",
  A20N: "narrowbody_jet",
  A321: "narrowbody_jet",
  A21N: "narrowbody_jet",
  B736: "narrowbody_jet",
  B737: "narrowbody_jet",
  B738: "narrowbody_jet",
  B739: "narrowbody_jet",
  B38M: "narrowbody_jet",
  MD82: "narrowbody_jet",
  MD83: "narrowbody_jet",
  MD88: "narrowbody_jet",
  A339: "widebody_jet",
  A359: "widebody_jet",
  B772: "widebody_jet",
  B773: "widebody_jet",
  B77W: "widebody_jet",
  B789: "widebody_jet",
  B78X: "widebody_jet",
  C208_MSFS: "single_turboprop",
  C208_BLACKSQUARE: "single_turboprop",
  B350_MSFS: "twin_turboprop",
  B350_BLACKSQUARE: "twin_turboprop",
  ATR72_MSFS: "twin_turboprop",
  BE58_MSFS: "piston_twin",
  BE58_BLACKSQUARE: "piston_twin",
  BE58_BS_PRO: "piston_twin",
  E175_FLIGHTSIM: "regional_jet",
  E190_FLIGHTSIM: "regional_jet",
  E195_FLIGHTSIM: "regional_jet",
  A319_FENIX: "narrowbody_jet",
  A319_LATINVFR: "narrowbody_jet",
  A320_FENIX: "narrowbody_jet",
  A320_LATINVFR: "narrowbody_jet",
  A20N_FBW: "narrowbody_jet",
  A321_FENIX: "narrowbody_jet",
  A21N_LATINVFR: "narrowbody_jet",
  B736_PMDG: "narrowbody_jet",
  B737_PMDG: "narrowbody_jet",
  B738_PMDG: "narrowbody_jet",
  B739_PMDG: "narrowbody_jet",
  B38M_IFLY: "narrowbody_jet",
  MD82_MADDOG: "narrowbody_jet",
  MD83_MADDOG: "narrowbody_jet",
  MD88_MADDOG: "narrowbody_jet",
  A339_HEADWIND: "widebody_jet",
  A359_INIBUILDS: "widebody_jet",
  B772_PMDG: "widebody_jet",
  B77W_PMDG: "widebody_jet",
  B789_HORIZONS: "widebody_jet",
  B78X_MSFS: "widebody_jet",
};

const TRAINING_PERMISSION_FAMILIES: Record<string, string[]> = {
  C172: ["C172"],
  C208: ["C208", "C208_MSFS", "C208_BLACKSQUARE"],
  B350: ["B350", "B350_MSFS", "B350_BLACKSQUARE"],
  ATR72: ["ATR72", "ATR72_MSFS"],
  BE58: ["BE58", "BE58_MSFS", "BE58_BLACKSQUARE", "BE58_BS_PRO"],
  E175: ["E175", "E175_FLIGHTSIM"],
  E190: ["E190", "E190_FLIGHTSIM"],
  E195: ["E195", "E195_FLIGHTSIM"],
  A319: ["A319", "A319_FENIX", "A319_LATINVFR"],
  A320: ["A320", "A320_FENIX", "A320_LATINVFR"],
  A20N: ["A20N", "A20N_FBW"],
  A321: ["A321", "A321_FENIX"],
  A21N: ["A21N", "A21N_LATINVFR"],
  B736: ["B736", "B736_PMDG"],
  B737: ["B737", "B737_PMDG"],
  B738: ["B738", "B738_PMDG"],
  B739: ["B739", "B739_PMDG"],
  B38M: ["B38M", "B38M_IFLY"],
  MD82: ["MD82", "MD82_MADDOG"],
  MD83: ["MD83", "MD83_MADDOG"],
  MD88: ["MD88", "MD88_MADDOG"],
  A339: ["A339", "A339_HEADWIND"],
  A359: ["A359", "A359_INIBUILDS"],
  B772: ["B772", "B772_PMDG"],
  B773: ["B773"],
  B77W: ["B77W", "B77W_PMDG"],
  B789: ["B789", "B789_HORIZONS"],
  B78X: ["B78X", "B78X_MSFS"],
};

function normalizeTrainingRankCode(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function getTrainingCategoryIndex(categoryKey: TrainingCategoryKey) {
  return TRAINING_CATEGORY_SEQUENCE.indexOf(categoryKey);
}

function expandTrainingPermissionAliases(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!normalized) {
    return [] as string[];
  }

  const family = normalized.split("_")[0];
  const aliases = TRAINING_PERMISSION_FAMILIES[family];
  return aliases ? Array.from(new Set([...aliases, normalized])) : [normalized];
}

function isTrainingTypePermitted(
  aircraftTypeCode: string | null | undefined,
  permittedTypes: Set<string>,
) {
  if (permittedTypes.size === 0) {
    return false;
  }

  return expandTrainingPermissionAliases(aircraftTypeCode).some((alias) => permittedTypes.has(alias));
}

function resolveTrainingCategoryKey(code?: string | null): TrainingCategoryKey {
  const normalized = (code ?? "").trim().toUpperCase();
  if (isTrainingSchoolAircraft(normalized)) {
    return "school";
  }

  const direct = TRAINING_TYPE_CATEGORY_MAP[normalized];
  if (direct) {
    return direct;
  }

  const family = normalized.split("_")[0];
  return TRAINING_TYPE_CATEGORY_MAP[family] ?? "single_turboprop";
}

async function loadPilotPermittedTrainingTypes(profile: PilotProfileRecord | null) {
  const rankCode = normalizeTrainingRankCode(profile?.career_rank_code ?? profile?.rank_code);

  if (!rankCode) {
    return new Set<string>();
  }

  const direct = await supabase
    .from("pilot_rank_aircraft_permissions")
    .select("aircraft_type_code")
    .eq("rank_code", rankCode);

  const buildSet = (rows: Array<Record<string, unknown>> | null | undefined) => {
    const permitted = new Set<string>();

    for (const row of rows ?? []) {
      const candidates = [
        typeof row.aircraft_type_code === "string" ? row.aircraft_type_code : "",
        typeof row.variant_aircraft_type_code === "string" ? row.variant_aircraft_type_code : "",
        typeof row.variant_code === "string" ? row.variant_code : "",
        typeof row.aircraft_family_code === "string" ? row.aircraft_family_code : "",
      ];

      for (const candidate of candidates) {
        for (const alias of expandTrainingPermissionAliases(candidate)) {
          permitted.add(alias);
        }
      }
    }

    return permitted;
  };

  if (!direct.error) {
    const directSet = buildSet((direct.data ?? []) as Array<Record<string, unknown>>);
    if (directSet.size > 0) {
      return directSet;
    }
  }

  const variantView = await supabase
    .from("pw_v_rank_allowed_variants")
    .select("aircraft_type_code, variant_aircraft_type_code, variant_code, aircraft_family_code")
    .eq("rank_code", rankCode);

  if (!variantView.error) {
    const variantSet = buildSet((variantView.data ?? []) as Array<Record<string, unknown>>);
    if (variantSet.size > 0) {
      return variantSet;
    }
  }

  const familyRows = await supabase
    .from("pw_pilot_rank_aircraft_families")
    .select("aircraft_family_code")
    .eq("rank_code", rankCode);

  if (!familyRows.error) {
    const familyCodes = ((familyRows.data ?? []) as Array<Record<string, unknown>>)
      .map((row) => (typeof row.aircraft_family_code === "string" ? row.aircraft_family_code.trim().toUpperCase() : ""))
      .filter(Boolean);

    if (familyCodes.length > 0) {
      const familyVariants = await supabase
        .from("pw_aircraft_family_variants")
        .select("aircraft_family_code, aircraft_type_code, variant_aircraft_type_code, variant_code")
        .in("aircraft_family_code", familyCodes);

      if (!familyVariants.error) {
        const familySet = buildSet((familyVariants.data ?? []) as Array<Record<string, unknown>>);
        if (familySet.size > 0) {
          return familySet;
        }
      }
    }
  }

  return new Set<string>();
}

function normalizeTrainingIcao(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function defaultTrainingDepartureHHMM() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function trainingHHMMToIso(value: string) {
  const [rawHour, rawMinute] = value.split(":");
  const date = new Date();
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  date.setHours(Number.isFinite(hour) ? hour : 8, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date.toISOString();
}

function getTrainingAircraftImagePath(aircraft: TrainingAircraftProgress | null) {
  const explicitPath = aircraft?.image_path?.trim();
  if (explicitPath && (explicitPath.startsWith("http://") || explicitPath.startsWith("https://") || explicitPath.startsWith("/"))) {
    return explicitPath;
  }

  const exactCode = (aircraft?.aircraft_type_code ?? "").trim().toUpperCase();
  if (exactCode && TRAINING_AIRCRAFT_EXACT_PHOTO_MAP[exactCode]) {
    return TRAINING_AIRCRAFT_EXACT_PHOTO_MAP[exactCode];
  }

  const aircraftHint = `${aircraft?.aircraft_type_code ?? ""} ${aircraft?.display_name ?? ""} ${aircraft?.family_code ?? ""}`.trim().toUpperCase();
  if (aircraftHint) {
    const matched = TRAINING_AIRCRAFT_MODEL_HINT_MAP.find((entry) => entry.matches.some((token) => aircraftHint.includes(token)));
    if (matched) {
      return matched.url;
    }
  }

  const code = aircraft?.aircraft_type_code?.trim().toUpperCase();
  return code ? `/aircraft/training/${code.toLowerCase()}.png` : TRAINING_AIRCRAFT_IMAGE_FALLBACK;
}

type RankingCard = {
  title: string;
  entries: Array<{ label: string; value: string }>;
};

type TransferMode = "ground_taxi" | "ground_bus" | "air_ticket";

type TransferOption = {
  mode: TransferMode;
  title: string;
  subtitle: string;
  accent: "emerald" | "amber" | "cyan";
};

type TransferDestinationOption = {
  mode: TransferMode;
  origin_ident: string;
  destination_ident: string;
  destination_name: string | null;
  destination_city: string | null;
  destination_country: string | null;
  distance_nm: number | null;
  travel_cost_usd: number;
  abandonment_penalty_usd: number;
  total_cost_usd: number;
  wallet_balance_usd: number;
  can_afford: boolean;
  reason: string | null;
};

type NewsItem = {
  title: string;
  body: string;
  tag: string;
};

type CentralOverview = {
  airportCode: string;
  airportName: string;
  municipality: string;
  countryCode: string;
  countryName: string;
  pilotsOnField: number;
  metarText: string;
  imagePath: string;
  transferOptions: TransferOption[];
  monthlyRankingCards: RankingCard[];
  yearlyRankingCards: RankingCard[];
  activeFlights: FlightReservationRow[];
  recentFlights: FlightReservationRow[];
  newsItems: NewsItem[];
};

const EMPTY_METRICS: DashboardMetrics = {
  pilotStatus: "ACTIVO",
  monthLabel: "Mes actual",
  monthPosition: null,
  monthHours: 0,
  totalPireps: 0,
  totalHours: 0,
  patagoniaScore: 0,
  walletBalance: 0,
  careerRankCode: "CADET",
  careerRank: "Cadet",
};

const DASHBOARD_TABS: Array<{ key: DashboardTabKey; label: string }> = [
  { key: "central", label: "Central" },
  { key: "dispatch", label: "Despacho" },
  { key: "office", label: "Oficina" },
  { key: "training", label: "Entrenamiento" },
];

const DISPATCH_STEPS: Array<{ key: DispatchStepKey; label: string; shortLabel: string }> = [
  { key: "flight_type", label: "1. Tipo de vuelo", shortLabel: "Tipo de vuelo" },
  { key: "aircraft", label: "2. Aeronave", shortLabel: "Aeronave" },
  { key: "itinerary", label: "3. Itinerario", shortLabel: "Itinerario" },
  { key: "dispatch_flow", label: "4. Despacho", shortLabel: "Despacho" },
  { key: "summary", label: "5. Resumen", shortLabel: "Resumen" },
];

const DISPATCH_FLIGHT_TYPE_OPTIONS: Array<{
  id: DispatchFlightTypeId;
  title: string;
  description: string;
  imageSrc: string;
  hidden?: boolean;
  comingSoon?: boolean;
}> = [
  {
    id: "career",
    title: "Carrera",
    description: "Vuelos regulares de la red con progresión, reglas y continuidad operacional.",
    imageSrc: "/dispatch/flight-types/career.png",
  },
  {
    id: "charter",
    title: "Chárter",
    description: "Operación dedicada para vuelos especiales, flexibles y fuera del patrón regular.",
    imageSrc: "/dispatch/flight-types/charter.png",
  },
  {
    id: "free_flight",
    title: "Vuelo libre",
    description: "Salida abierta para explorar, practicar o mover aeronave con libertad visual.",
    imageSrc: "/dispatch/flight-types/free-flight.png",
  },
  {
    id: "event",
    title: "Evento",
    description: "Bloque reservado para vuelos coordinados, convocatoria interna y operación compartida.",
    imageSrc: "/dispatch/flight-types/event.png",
    comingSoon: true,
  },
  {
    id: "special_mission",
    title: "Misión especial",
    description: "Misiones puntuales con contexto operacional singular y prioridad específica.",
    imageSrc: "/dispatch/flight-types/special-mission.png",
    comingSoon: true,
  },
  {
    id: "training",
    title: "Entrenamiento",
    description: "Sesiones de práctica, chequeos y preparación operativa antes de salir a línea.",
    imageSrc: "/dispatch/flight-types/training.png",
    hidden: true,
  },
  {
    id: "qualification",
    title: "Habilitaciones",
    description: "Bloque pensado para chequeos, habilitaciones y misiones de progresion especifica.",
    imageSrc: "/dispatch/flight-types/habilitaciones.png",
    hidden: true,
  },
];

const DISPATCH_VISIBLE_FLIGHT_TYPE_OPTIONS = DISPATCH_FLIGHT_TYPE_OPTIONS.filter(
  (option) => !option.hidden
);

const COUNTRY_NAME_MAP: Record<string, string> = {
  AR: "Argentina",
  BR: "Brasil",
  CL: "Chile",
  ES: "España",
  PE: "Perú",
  UK: "Reino Unido",
  US: "Estados Unidos",
};

function toSafeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number) {
  return `$${formatInteger(value)}`;
}

function formatTransferUsd(value: unknown) {
  const amount = toSafeNumber(value);
  return `${new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)} USD`;
}

function getShortPilotName(profile: PilotProfileRecord | null) {
  const firstName = profile?.first_name?.trim().split(/\s+/)[0] ?? "";
  const firstLastName = profile?.last_name?.trim().split(/\s+/)[0] ?? "";
  const shortName = [firstName, firstLastName].filter(Boolean).join(" ").trim();

  if (shortName) {
    return shortName;
  }

  if (firstName) {
    return firstName;
  }

  if (profile?.callsign?.trim()) {
    return profile.callsign.trim();
  }

  return "Piloto";
}

function getProfileTotalHours(profile: PilotProfileRecord | null) {
  if (!profile) {
    return 0;
  }

  const raw = profile as PilotProfileRecord & {
    total_hours?: number | string | null;
    career_hours?: number | string | null;
    transferred_hours?: number | string | null;
  };

  const directTotal = toSafeNumber(raw.total_hours);
  if (directTotal > 0) {
    return directTotal;
  }

  const careerHours = toSafeNumber(raw.career_hours);
  const transferredHours = toSafeNumber(raw.transferred_hours);
  return careerHours + transferredHours;
}

function getProfileWallet(profile: PilotProfileRecord | null) {
  if (!profile) {
    return 0;
  }

  const raw = profile as PilotProfileRecord & {
    wallet_balance?: number | string | null;
  };

  return toSafeNumber(raw.wallet_balance);
}

function buildMonthLabel() {
  const raw = new Intl.DateTimeFormat("es-CL", { month: "long" }).format(new Date());
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getCountryName(countryCode?: string | null) {
  const normalized = countryCode?.trim().toUpperCase() ?? "";
  return COUNTRY_NAME_MAP[normalized] || normalized || "Ubicación actual";
}

function getFlagUrl(countryCode?: string | null) {
  const normalized = countryCode?.trim().toLowerCase() ?? "";
  return normalized ? `https://flagcdn.com/24x18/${normalized}.png` : "";
}

function normalizeCountryCode(value?: string | null) {
  const normalized = value?.trim().toUpperCase() ?? "";

  if (!normalized) return null;
  if (normalized.length === 2) return normalized;
  if (["CHILE"].includes(normalized)) return "CL";
  if (["ARGENTINA"].includes(normalized)) return "AR";
  if (["BRASIL", "BRAZIL"].includes(normalized)) return "BR";
  if (["PERU", "PERU"].includes(normalized)) return "PE";
  if (["COLOMBIA"].includes(normalized)) return "CO";
  if (["ECUADOR"].includes(normalized)) return "EC";
  if (["URUGUAY"].includes(normalized)) return "UY";
  if (["PARAGUAY"].includes(normalized)) return "PY";
  if (["BOLIVIA"].includes(normalized)) return "BO";
  if (["ESTADOS UNIDOS", "UNITED STATES", "USA", "US"].includes(normalized)) return "US";
  if (["MEXICO", "MEXICO"].includes(normalized)) return "MX";
  if (["ESPANA", "ESPANA", "SPAIN"].includes(normalized)) return "ES";
  if (["FRANCIA", "FRANCE"].includes(normalized)) return "FR";
  if (["REINO UNIDO", "UNITED KINGDOM", "UK", "ENGLAND", "INGLATERRA"].includes(normalized)) return "GB";
  return null;
}

function getCountryCodeFromIcao(icao?: string | null) {
  const normalized = (icao ?? "").trim().toUpperCase();
  if (normalized.startsWith("SC")) return "CL";
  if (normalized.startsWith("SA")) return "AR";
  if (normalized.startsWith("SB")) return "BR";
  if (normalized.startsWith("SP")) return "PE";
  if (normalized.startsWith("SK")) return "CO";
  if (normalized.startsWith("SE")) return "EC";
  if (normalized.startsWith("SU")) return "UY";
  if (normalized.startsWith("SG")) return "PY";
  if (normalized.startsWith("SL")) return "BO";
  if (normalized.startsWith("KM") || normalized.startsWith("KJ") || normalized.startsWith("KL")) return "US";
  if (normalized.startsWith("MM")) return "MX";
  if (normalized.startsWith("LE")) return "ES";
  if (normalized.startsWith("LF")) return "FR";
  if (normalized.startsWith("EG")) return "GB";
  return null;
}

function resolveCountryCode(value?: string | null, icao?: string | null) {
  return normalizeCountryCode(value) ?? getCountryCodeFromIcao(icao) ?? null;
}

function formatDurationMinutes(value: number | null | undefined) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "—";
  }

  const safeMinutes = Math.max(1, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Genera lista de horas de 00:00 a 23:45 en intervalos de 15 minutos. */
function buildDepartureTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      options.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` });
    }
  }
  return options;
}
const DEPARTURE_TIME_OPTIONS = buildDepartureTimeOptions();

/** Convierte HH:MM (hora local del aeropuerto, tratada como UTC para SimBrief) a ISO string. */
function departureHHMMtoISO(hhMm: string): string {
  const [hh, mm] = hhMm.split(":").map(Number);
  const now = new Date();
  now.setUTCHours(hh ?? 8, mm ?? 0, 0, 0);
  return now.toISOString();
}

/** Estimate block time in minutes from distance and aircraft type code.
 *  Formula: (distanceNm / cruiseKts) * 60 + climbDescentOverheadMin
 */
function estimateBlockMinutes(distanceNm: number, aircraftTypeCode?: string | null): number {
  if (!distanceNm || distanceNm <= 0) return 0;

  const code = (aircraftTypeCode ?? "").toUpperCase();

  // Wide-body jets ~490 kts
  const isWidebody = ["A330","A332","A333","A338","A339","A343","A345","A346",
    "A350","A35K","A359","A380","A388","B744","B747","B748","B762","B763","B764",
    "B767","B772","B773","B77L","B77W","B777","B778","B779","B787","B788","B789","B78X"].some(t => code.includes(t));
  if (isWidebody) {
    const cruiseKts = 490;
    const overheadMin = distanceNm < 500 ? 25 : 35;
    return Math.round((distanceNm / cruiseKts) * 60 + overheadMin);
  }

  // Narrow-body jets ~450 kts
  const isNarrowbody = ["A318","A319","A320","A321","B735","B736","B737","B738","B739",
    "B752","B753","B757","MD8","MD9","MD11"].some(t => code.includes(t));
  if (isNarrowbody) {
    const cruiseKts = 450;
    const overheadMin = distanceNm < 300 ? 20 : 30;
    return Math.round((distanceNm / cruiseKts) * 60 + overheadMin);
  }

  // Regional jets ~380 kts
  const isRegionalJet = ["CRJ","E170","E175","E190","E195","ERJ","E170","E175",
    "E190","E195","RJ1","RJ7","RJ8","RJ9"].some(t => code.includes(t));
  if (isRegionalJet) {
    const cruiseKts = 380;
    const overheadMin = 18;
    return Math.round((distanceNm / cruiseKts) * 60 + overheadMin);
  }

  // Turboprops ~280 kts
  const isTurboprop = ["ATR","AT4","AT7","DH8","Q400","Q300","Q200","DHC","PC12",
    "C208","C90","B350","BE20","BE30","TBM","SF34","SF50","JS41"].some(t => code.includes(t));
  if (isTurboprop) {
    const cruiseKts = 280;
    const overheadMin = 15;
    return Math.round((distanceNm / cruiseKts) * 60 + overheadMin);
  }

  // GA piston ~130 kts
  const cruiseKts = 130;
  const overheadMin = 10;
  return Math.round((distanceNm / cruiseKts) * 60 + overheadMin);
}

function formatUtcDateTime(value: string | null | undefined) {
  if (!value) {
    return "Pendiente";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date).replace(",", "") + " UTC";
}

function formatNavigraphExpiry(value: string | null | undefined) {
  if (!value) {
    return "Sin sesión activa";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}


function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateCoordinateDistanceNm(
  originLat: number | null | undefined,
  originLon: number | null | undefined,
  destinationLat: number | null | undefined,
  destinationLon: number | null | undefined,
) {
  if (!Number.isFinite(originLat) || !Number.isFinite(originLon) || !Number.isFinite(destinationLat) || !Number.isFinite(destinationLon)) {
    return null;
  }
  const dLat = toRadians((destinationLat ?? 0) - (originLat ?? 0));
  const dLon = toRadians((destinationLon ?? 0) - (originLon ?? 0));
  const lat1 = toRadians(originLat ?? 0);
  const lat2 = toRadians(destinationLat ?? 0);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const distance = 3440.065 * 2 * Math.asin(Math.sqrt(haversine));
  return Number.isFinite(distance) ? distance : null;
}

function calculateDistanceNm(originAirport: ItineraryAirportMeta | undefined, destinationAirport: ItineraryAirportMeta | undefined) {
  const distance = calculateCoordinateDistanceNm(
    originAirport?.latitude_deg,
    originAirport?.longitude_deg,
    destinationAirport?.latitude_deg,
    destinationAirport?.longitude_deg,
  );
  return distance != null ? Math.round(distance) : null;
}

function getPositiveNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function resolveWebDispatchDistanceNm(
  itinerary: AvailableItineraryOption | null | undefined,
  originAirport: ItineraryAirportMeta | undefined,
  destinationAirport: ItineraryAirportMeta | undefined,
): number | null {
  const itineraryDistance = getPositiveNumber(itinerary?.distance_nm);
  if (itineraryDistance != null) {
    return Math.round(itineraryDistance);
  }

  return calculateDistanceNm(originAirport, destinationAirport);
}

function resolveWebDispatchDurationMinutes(
  itinerary: AvailableItineraryOption | null | undefined,
  distanceNm: number | null | undefined,
  aircraftTypeCode?: string | null,
): number | null {
  // Misma prioridad visual usada en la tabla de selección de itinerario.
  const scheduledDuration = getPositiveNumber(itinerary?.scheduled_block_min);
  if (scheduledDuration != null) return scheduledDuration;

  const expectedP50 = getPositiveNumber(itinerary?.expected_block_p50);
  if (expectedP50 != null) return expectedP50;

  const expectedP80 = getPositiveNumber(itinerary?.expected_block_p80);
  if (expectedP80 != null) return expectedP80;

  const estimatedDuration = distanceNm ? estimateBlockMinutes(distanceNm, aircraftTypeCode) : 0;
  return estimatedDuration > 0 ? estimatedDuration : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getNestedRecord(source: unknown, ...keys: string[]) {
  let current: unknown = source;
  for (const key of keys) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
  }
  return asRecord(current);
}

function getNestedNumber(source: unknown, ...keys: string[]) {
  let current: unknown = source;
  for (const key of keys) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
  }
  if (typeof current === "number" && Number.isFinite(current)) return current;
  if (typeof current === "string" && current.trim()) {
    const parsed = Number(current);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getNestedText(source: unknown, ...keys: string[]) {
  let current: unknown = source;
  for (const key of keys) {
    const record = asRecord(current);
    if (!record) return "";
    current = record[key];
  }
  return typeof current === "string" ? current.trim() : "";
}

function getDestinationCityLabel(
  itinerary: AvailableItineraryOption,
  destinationAirport: ItineraryAirportMeta | undefined,
) {
  if (itinerary.destination_city?.trim()) {
    return itinerary.destination_city.trim();
  }

  if (destinationAirport?.municipality?.trim()) {
    return destinationAirport.municipality.trim();
  }

  if (destinationAirport?.name?.trim()) {
    return destinationAirport.name.trim();
  }

  const splitByArrow = itinerary.itinerary_name.split("→");
  const parsed = splitByArrow.length > 1 ? splitByArrow[splitByArrow.length - 1].trim() : "";
  return parsed || itinerary.destination_icao;
}

function getOriginCityLabel(
  itinerary: AvailableItineraryOption,
  originAirport: ItineraryAirportMeta | undefined,
  currentAirportCode: string,
  currentAirportCity: string,
) {
  if (itinerary.origin_city?.trim()) {
    return itinerary.origin_city.trim();
  }

  if (originAirport?.municipality?.trim()) {
    return originAirport.municipality.trim();
  }

  if (
    itinerary.origin_icao.trim().toUpperCase() === currentAirportCode.trim().toUpperCase() &&
    currentAirportCity.trim()
  ) {
    return currentAirportCity.trim();
  }

  if (originAirport?.name?.trim()) {
    return originAirport.name.trim();
  }

  return itinerary.origin_icao;
}

function compactFlightIdentifier(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function resolvePublishedFlightIdentifier(
  itinerary: AvailableItineraryOption | null,
  fallbackOrigin?: string | null,
  fallbackDestination?: string | null,
) {
  if (!itinerary) {
    return "";
  }

  const designator = compactFlightIdentifier(itinerary.flight_designator);
  const rawNumber = compactFlightIdentifier(itinerary.flight_number);
  const realValue = designator || rawNumber;
  const isRouteLikeValue = realValue.includes("-");
  const airlineCode = realValue.match(/^[A-Z]+/)?.[0] ?? "PWG";
  const numberDigits = !isRouteLikeValue ? realValue.match(/\d{1,4}$/)?.[0] ?? "" : "";

  if (numberDigits) {
    return `${airlineCode}${numberDigits.padStart(3, "0")}`;
  }

  const generatedNumber = getOperationalFlightNumber(
    itinerary.origin_icao || fallbackOrigin || "",
    itinerary.destination_icao || fallbackDestination || "",
  );

  return compactFlightIdentifier(generatedNumber || (!isRouteLikeValue ? realValue : ""));
}

function buildDispatchFlightNumber(itinerary: AvailableItineraryOption | null) {
  return resolvePublishedFlightIdentifier(itinerary) || "Pendiente";
}

function getDispatchFlightNumberValidationValue(itinerary: AvailableItineraryOption | null) {
  return resolvePublishedFlightIdentifier(itinerary);
}

function formatSimbriefFlightNumber(
  value: string | null | undefined,
  airlineIcao?: string | null,
) {
  const normalizedFlightNumber = compactFlightIdentifier(value);
  const normalizedAirline = compactFlightIdentifier(airlineIcao).replace(/[^A-Z]/g, "");

  if (!normalizedFlightNumber) {
    return "Pendiente";
  }

  if (/^[A-Z]+\d+$/i.test(normalizedFlightNumber)) {
    return normalizedFlightNumber;
  }

  if (normalizedAirline && /^\d+$/i.test(normalizedFlightNumber)) {
    return `${normalizedAirline}${normalizedFlightNumber}`;
  }

  return normalizedFlightNumber;
}

function getSimbriefFlightNumberValidationValue(
  value: string | null | undefined,
  airlineIcao?: string | null,
) {
  const formatted = formatSimbriefFlightNumber(value, airlineIcao);
  return formatted === "Pendiente" ? "" : compactFlightIdentifier(formatted);
}

function resolveSimbriefAirlineForDispatch(
  webFlightNumber: string | null | undefined,
  simbriefAirlineIcao?: string | null,
) {
  const explicitAirline = compactFlightIdentifier(simbriefAirlineIcao).replace(/[^A-Z]/g, "");

  if (explicitAirline) {
    return explicitAirline;
  }

  const webPrefix = compactFlightIdentifier(webFlightNumber).match(/^[A-Z]+/)?.[0] ?? "";

  // Patagonia Wings uses PWG internally, while SimBrief Airline ICAO is PGW.
  if (webPrefix === "PWG") {
    return "PGW";
  }

  return webPrefix;
}

function normalizePatagoniaFlightIdentifier(value: string | null | undefined) {
  const normalized = compactFlightIdentifier(value);
  return normalized.replace(/^PGW(?=\d)/, "PWG");
}

function normalizeDispatchComparisonValue(value: string | null | undefined) {
  return compactFlightIdentifier(value);
}

function normalizeTrainingOfpFlightNumber(
  value: string | null | undefined,
  pilotCallsign: string | null | undefined,
) {
  const normalizedValue = (value ?? "").trim().replace(/\s+/g, "").toUpperCase();
  const normalizedCallsign = (pilotCallsign ?? "").trim().replace(/\s+/g, "").toUpperCase();

  if (!normalizedValue) {
    return "";
  }

  if (!normalizedCallsign) {
    return normalizedValue;
  }

  if (normalizedValue === normalizedCallsign) {
    return normalizedCallsign;
  }

  const callsignPrefix = normalizedCallsign.match(/^[A-Z]+/)?.[0] ?? "PWG";
  const callsignDigits = normalizedCallsign.match(/\d+$/)?.[0] ?? "";
  const valuePrefix = normalizedValue.match(/^[A-Z]+/)?.[0] ?? "";
  const valueDigits = normalizedValue.match(/\d+$/)?.[0] ?? "";

  if (!valueDigits) {
    return normalizedValue;
  }

  const paddedValueDigits = valueDigits.padStart(callsignDigits.length || 3, "0");

  if (callsignDigits && paddedValueDigits === callsignDigits) {
    return normalizedCallsign;
  }

  if (!valuePrefix) {
    return `${callsignPrefix}${paddedValueDigits}`;
  }

  return `${valuePrefix}${paddedValueDigits}`;
}

function getAirportImagePath(airportCode: string) {
  return `/airports/${airportCode.toUpperCase()}.png`;
}

function getPreferredAirportCode(profile?: PilotProfileRecord | null) {
  const profileWithLegacyCodes = profile as (PilotProfileRecord & {
    current_airport_icao?: string | null;
    current_airport_code?: string | null;
    base_hub?: string | null;
  }) | null | undefined;

  return (
    profileWithLegacyCodes?.current_airport_icao ??
    profileWithLegacyCodes?.current_airport_code ??
    profileWithLegacyCodes?.base_hub ??
    "SCEL"
  )
    .trim()
    .toUpperCase();
}

function buildAirportHeroRequestUrl(central: Pick<CentralOverview, "airportCode" | "airportName" | "municipality" | "countryName">) {
  const params = new URLSearchParams({
    icao: central.airportCode,
    airportName: central.airportName,
    city: central.municipality,
    country: central.countryName,
    prefer: "pexels",
  });

  return `/api/airport-hero?${params.toString()}`;
}

function buildTransferOptions(countryCode: string, airportCode: string): TransferOption[] {
  const isChile = countryCode === "CL";

  return [
    {
      mode: "ground_taxi",
      title: "Taxi urbano / interaeródromo",
      subtitle: `Traslado inmediato dentro de la misma ciudad desde ${airportCode}, por ejemplo SCEL ↔ SCTB o SCTE ↔ SCPF.`,
      accent: "amber",
    },
    {
      mode: "ground_bus",
      title: "Traslado terrestre por bus",
      subtitle: isChile
        ? `Traslado interregional desde ${airportCode} hacia capitales regionales o aeropuertos nacionales habilitados.`
        : `Traslado terrestre doméstico desde ${airportCode} hacia capitales y aeropuertos regionales habilitados.`,
      accent: "emerald",
    },
    {
      mode: "air_ticket",
      title: "Ticket aéreo regular",
      subtitle: "Movimiento aéreo automático hacia hubs principales nacionales o internacionales habilitados por la red.",
      accent: "cyan",
    },
  ];
}

function normalizeTransferModeForUi(value: unknown): TransferMode | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "ground_taxi" || normalized === "ground_bus" || normalized === "air_ticket") {
    return normalized;
  }
  return null;
}

function formatMetarTemperature(token?: string | null) {
  if (!token) {
    return "Pendiente";
  }

  const normalized = token.trim().toUpperCase();
  const sign = normalized.startsWith("M") ? "-" : "";
  const numeric = Number.parseInt(normalized.replace("M", ""), 10);

  if (!Number.isFinite(numeric)) {
    return "Pendiente";
  }

  return `${sign}${numeric} °C`;
}

function formatMetarWind(rawMetar: string) {
  const match = rawMetar.match(/\b(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT\b/i);

  if (!match) {
    return "Pendiente";
  }

  const direction = match[1].toUpperCase() === "VRB" ? "VRB" : `${match[1]}°`;
  const speed = `${Number.parseInt(match[2], 10)} kt`;
  const gust = match[4] ? ` G${Number.parseInt(match[4], 10)}` : "";

  return `${direction} ${speed}${gust}`;
}

function formatMetarVisibility(rawMetar: string) {
  const match = rawMetar.match(
    /\b(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?KT\s+(CAVOK|\d{4}|M?\d+\/\d+SM|\d+SM)\b/i,
  );
  const token = match?.[1]?.toUpperCase();

  if (!token) {
    return "Pendiente";
  }

  if (token === "CAVOK" || token === "9999") {
    return "10 km+";
  }

  if (/^\d{4}$/.test(token)) {
    return `${Number.parseInt(token, 10)} m`;
  }

  return token.replace("SM", " sm");
}

function formatMetarQnh(rawMetar: string) {
  const qnhMatch = rawMetar.match(/\bQ(\d{4})\b/i);
  if (qnhMatch) {
    return `${qnhMatch[1]} hPa`;
  }

  const altimeterMatch = rawMetar.match(/\bA(\d{4})\b/i);
  if (!altimeterMatch) {
    return "Pendiente";
  }

  const inches = Number.parseInt(altimeterMatch[1], 10) / 100;
  const hPa = Math.round(inches * 33.8639);
  return `${hPa} hPa`;
}

function formatMetarCondition(rawMetar: string) {
  const normalized = rawMetar.toUpperCase();

  if (normalized.includes("TS")) {
    return "Tormenta";
  }

  if (normalized.includes("SN")) {
    return "Nieve";
  }

  if (/(RA|DZ|SHRA|VCSH)/.test(normalized)) {
    return "Lluvia";
  }

  if (/(FG|BR|HZ)/.test(normalized)) {
    return "Niebla";
  }

  if (normalized.includes("CAVOK")) {
    return "Estable";
  }

  if (/(OVC|BKN)/.test(normalized)) {
    return "Cubierto";
  }

  if (/(FEW|SCT|SKC|CLR|NSC)/.test(normalized)) {
    return "Parcial";
  }

  return "Variable";
}

const METAR_FALLBACK_BY_AIRPORT: Record<string, string[]> = {
  // Santiago / Región Metropolitana: aeródromos sin METAR propio toman SCEL.
  SCTB: ["SCEL"],
  SCBQ: ["SCEL", "SCTB"],
  SCLC: ["SCEL"],
  SCSN: ["SCEL"],

  // Valparaíso / costa central.
  SCRD: ["SCVM", "SCEL"],
  SCVM: ["SCEL"],

  // Puerto Montt / Patagonia norte: aeródromos cercanos toman SCTE.
  SCPF: ["SCTE"],
  SCJO: ["SCTE"],
  SCPQ: ["SCTE"],
  SCTN: ["SCTE"],
  SCFT: ["SCTE"],

  // Patagonia austral.
  SCNT: ["SCCI"],

  // Buenos Aires: aeródromos urbanos toman Aeroparque/Ezeiza.
  SADF: ["SABE", "SAEZ"],
  SADM: ["SADF", "SABE", "SAEZ"],
  SADL: ["SADF", "SABE", "SAEZ"],
};

function buildMetarCandidateIds(airportCode: string) {
  const current = airportCode.trim().toUpperCase();
  const candidates = [current, ...(METAR_FALLBACK_BY_AIRPORT[current] ?? [])];
  return Array.from(new Set(candidates.filter((item) => /^[A-Z0-9]{4}$/.test(item))));
}

function buildMetarDisplayText(rawMetar: string, requestedAirport: string, reportedStation?: string | null) {
  const requested = requestedAirport.trim().toUpperCase();
  const station = reportedStation?.trim().toUpperCase() ?? "";

  if (!station || station === requested) {
    return rawMetar;
  }

  return `${rawMetar} · Referencia cercana para ${requested}`;
}

function buildDispatchMetarSummary(rawMetar?: string | null): DispatchMetarSummary {
  const normalized = rawMetar?.trim() ?? "";

  if (!normalized || normalized.toUpperCase().includes("PENDIENTE")) {
    return {
      condition: "Pendiente",
      temperature: "Pendiente",
      qnh: "Pendiente",
      wind: "Pendiente",
      visibility: "Pendiente",
      raw: normalized || "METAR pendiente de actualización",
    };
  }

  const temperatureMatch = normalized.match(/\b(M?\d{2})\/(M?\d{2})\b/i);

  return {
    condition: formatMetarCondition(normalized),
    temperature: formatMetarTemperature(temperatureMatch?.[1]),
    qnh: formatMetarQnh(normalized),
    wind: formatMetarWind(normalized),
    visibility: formatMetarVisibility(normalized),
    raw: normalized,
  };
}

/** Returns raw visibility in meters from a METAR string, or null if not parseable. */
function parseMetarVisibilityMeters(rawMetar: string): number | null {
  const upper = rawMetar.toUpperCase();
  if (upper.includes("CAVOK")) return 9999;
  // SM (statute miles) — approximate
  const smMatch = rawMetar.match(/\bM?(\d+(?:\/\d+)?)SM\b/i);
  if (smMatch) {
    const smVal = smMatch[1].includes("/") ? 0.5 : Number.parseFloat(smMatch[1]);
    return Math.round(smVal * 1609);
  }
  // 4-digit meters (e.g. 0800, 1500, 9999)
  const mMatch = rawMetar.match(/(?:KT|MPS)\s+(\d{4})\b/);
  if (mMatch) return Number.parseInt(mMatch[1], 10);
  return null;
}

/** Returns wind speed in knots from a METAR string, or null if not parseable. */
function parseMetarWindKt(rawMetar: string): number | null {
  const match = rawMetar.match(/\b(?:\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/i);
  if (!match) return null;
  const speed = Number.parseInt(match[1], 10);
  const gust = match[2] ? Number.parseInt(match[2], 10) : 0;
  return Math.max(speed, gust);
}

type WeatherWarning = { level: "amber" | "red"; text: string };

/**
 * Compares current METAR conditions against a pilot's active qualifications.
 * Returns an array of warnings (empty = no issues detected).
 */
function buildWeatherWarnings(rawMetar: string, activeQualifications: string): WeatherWarning[] {
  const warnings: WeatherWarning[] = [];
  if (!rawMetar || rawMetar.toUpperCase().includes("PENDIENTE")) return warnings;

  const qualList = activeQualifications
    .split(",")
    .map((q) => q.trim().toUpperCase())
    .filter(Boolean);

  // --- Visibility / precision approach ---
  const visM = parseMetarVisibilityMeters(rawMetar);
  if (visM !== null) {
    let requiredH = 0;
    if (visM < 300) requiredH = 5;
    else if (visM < 550) requiredH = 4;
    else if (visM < 800) requiredH = 3;
    else if (visM < 1500) requiredH = 2;
    else if (visM < 5000) requiredH = 1;

    if (requiredH > 0) {
      const pilotH = qualList.reduce((max, q) => {
        const m = q.match(/^H(\d)$/);
        return m ? Math.max(max, Number.parseInt(m[1], 10)) : max;
      }, 0);
      if (pilotH < requiredH) {
        warnings.push({
          level: requiredH >= 3 ? "red" : "amber",
          text: `Visibilidad ${visM < 1000 ? `${visM} m` : `${(visM / 1000).toFixed(1)} km`} requiere habilitación H${requiredH} — tienes H${pilotH}.`,
        });
      }
    }
  }

  // --- Wind speed proxy for crosswind ---
  const windKt = parseMetarWindKt(rawMetar);
  if (windKt !== null) {
    let requiredV = 0;
    if (windKt > 35) requiredV = 3;
    else if (windKt > 25) requiredV = 2;
    else if (windKt > 15) requiredV = 1;

    if (requiredV > 0) {
      const pilotV = qualList.reduce((max, q) => {
        const m = q.match(/^V(\d)$/);
        return m ? Math.max(max, Number.parseInt(m[1], 10)) : max;
      }, 0);
      if (pilotV < requiredV) {
        warnings.push({
          level: requiredV >= 2 ? "red" : "amber",
          text: `Viento ${windKt} kt requiere habilitación V${requiredV} — tienes V${pilotV}.`,
        });
      }
    }
  }

  return warnings;
}

function buildNewsItems(
  airportCode: string,
  pilotsOnField: number,
  activeFlights: FlightReservationRow[],
  recentFlights: FlightReservationRow[],
): NewsItem[] {
  const items: NewsItem[] = [];

  items.push({
    tag: `NOTAM PWG · ${airportCode}`,
    title: `Boletín operacional ${airportCode}`,
    body:
      "Revisa METAR, QNH, combustible, pista en uso y restricciones internas antes de abrir SimBrief o iniciar el ACARS.",
  });

  if (pilotsOnField > 0) {
    items.push({
      tag: "Plataforma",
      title: `${formatInteger(pilotsOnField)} piloto(s) en esta ubicación`,
      body:
        "La central detecta pilotos posicionados en este aeropuerto. Ideal para coordinar salidas, vuelos de entrenamiento o eventos.",
    });
  }

  if (activeFlights.length > 0) {
    items.push({
      tag: "Operación viva",
      title: `${formatInteger(activeFlights.length)} vuelo(s) activo(s)`,
      body:
        "Hay reservas despachadas o vuelos en progreso. Revisa la actividad del aeropuerto antes de programar una nueva salida.",
    });
  }

  if (recentFlights.length > 0) {
    items.push({
      tag: "Historial",
      title: "Últimos cierres disponibles",
      body:
        "La oficina mantiene los PIREPs recientes para comparar score, procedimientos, performance y estado del reporte.",
    });
  }

  return items.slice(0, 5);
}

function formatFlightModeLabel(mode?: string | null) {
  const normalized = (mode ?? "").trim().toUpperCase();
  if (!normalized) {
    return "Operación";
  }

  const map: Record<string, string> = {
    ASSIGNMENT: "Asignación",
    CAREER: "Itinerario",
    CHARTER: "Chárter",
    EVENT: "Evento",
    TRAINING: "Entrenamiento",
    TOUR: "Tour",
  };

  return map[normalized] ?? normalized.replace(/_/g, " ");
}

function formatFlightStatusLabel(status?: string | null) {
  const normalized = (status ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    interrupted: "Interrumpido",
    crashed: "Accidentado",
    aborted: "Abortado",
    cancelled: "Cancelado",
    completed: "Completado",
    dispatch_ready: "Despacho",
    dispatched: "Despacho",
    in_progress: "En vuelo",
    in_flight: "En vuelo",
    reserved: "Reservado",
  };

  return map[normalized] ?? "Operación";
}

function formatRouteTag(row: FlightReservationRow) {
  const origin = row.origin_ident?.trim().toUpperCase() ?? "---";
  const destination = row.destination_ident?.trim().toUpperCase() ?? "---";
  return `${origin} → ${destination}`;
}

function topEntries(
  values: Array<{ label: string; rawValue: number }>,
  formatter: (value: number) => string,
) {
  return values
    .filter((entry) => Number.isFinite(entry.rawValue) && entry.rawValue > 0)
    .sort((a, b) => b.rawValue - a.rawValue || a.label.localeCompare(b.label))
    .slice(0, 3)
    .map((entry) => ({
      label: entry.label,
      value: formatter(entry.rawValue),
    }));
}

function buildRankingCards(
  ledgerRows: ScoreLedgerRow[],
  scoredFlights: FlightReservationRow[],
  variant: "month" | "year",
): RankingCard[] {
  const grouped = new Map<
    string,
    {
      hours: number;
      procedureTotal: number;
      procedureCount: number;
      missionTotal: number;
      missionCount: number;
    }
  >();

  for (const row of ledgerRows) {
    const callsign = row.pilot_callsign?.trim().toUpperCase();
    if (!callsign) {
      continue;
    }

    const current = grouped.get(callsign) ?? {
      hours: 0,
      procedureTotal: 0,
      procedureCount: 0,
      missionTotal: 0,
      missionCount: 0,
    };

    current.hours += toSafeNumber(row.flight_hours);

    const procedure = toSafeNumber(row.procedure_score);
    if (procedure > 0) {
      current.procedureTotal += procedure;
      current.procedureCount += 1;
    }

    const mission = toSafeNumber(row.mission_score);
    if (mission > 0) {
      current.missionTotal += mission;
      current.missionCount += 1;
    }

    grouped.set(callsign, current);
  }

  const bestProcedure = topEntries(
    Array.from(grouped.entries()).map(([label, stats]) => ({
      label,
      rawValue:
        stats.procedureCount > 0 ? stats.procedureTotal / stats.procedureCount : 0,
    })),
    (value) => `${formatDecimal(value)} pts`,
  );

  const bestMission = topEntries(
    Array.from(grouped.entries()).map(([label, stats]) => ({
      label,
      rawValue: stats.missionCount > 0 ? stats.missionTotal / stats.missionCount : 0,
    })),
    (value) => `${formatDecimal(value)} pts`,
  );

  const bestHours = topEntries(
    Array.from(grouped.entries()).map(([label, stats]) => ({
      label,
      rawValue: stats.hours,
    })),
    (value) => `${formatDecimal(value)} h`,
  );

  const bestPirep = topEntries(
    scoredFlights.map((flight) => ({
      label: flight.pilot_callsign?.trim().toUpperCase() ?? "PWG",
      rawValue: resolvePatagoniaScore({
        scorePayload: flight.score_payload,
        performanceScore: flight.performance_score,
        procedureScore: flight.procedure_score,
        missionScore: flight.mission_score,
      }),
    })),
    (value) => `${formatDecimal(value)} pts`,
  );

  const prefix = variant === "month" ? "Mes" : "Año";

  return [
    {
      title: `Mejores puntajes ${prefix.toLowerCase()}`,
      entries: bestProcedure.length
        ? bestProcedure
        : [{ label: "Sin datos", value: "Pendiente" }],
    },
    {
      title: `Ranking de horas ${prefix.toLowerCase()}`,
      entries: bestHours.length ? bestHours : [{ label: "Sin datos", value: "Pendiente" }],
    },
    {
      title: `Mejores PIREP ${prefix.toLowerCase()}`,
      entries: bestPirep.length ? bestPirep : [{ label: "Sin datos", value: "Pendiente" }],
    },
  ];
}

async function loadDashboardMetrics(profile: PilotProfileRecord) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthLabel = buildMonthLabel();
  const callsign = profile.callsign?.trim().toUpperCase();

  const validFinalStatuses = ["completed", "crashed", "manual_review", "rejected"];

  const [recentScoreRes, monthLedgerRes, allMonthLedgerRes, pirepCountRes, pilotProfilesRes] = await Promise.all([
    supabase
      .from("flight_reservations")
      .select("pilot_callsign, procedure_score, performance_score, mission_score, score_payload, completed_at, created_at, status")
      .eq("pilot_callsign", callsign)
      .in("status", validFinalStatuses)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("pw_pilot_score_ledger")
      .select("pilot_callsign, flight_hours, created_at")
      .eq("pilot_callsign", callsign)
      .gte("created_at", startOfMonth),
    supabase
      .from("pw_pilot_score_ledger")
      .select("pilot_callsign, flight_hours, created_at")
      .gte("created_at", startOfMonth),
    supabase
      .from("flight_reservations")
      .select("id", { count: "exact", head: true })
      .eq("pilot_callsign", callsign)
      .eq("status", "completed"),
    supabase
      .from("pilot_profiles")
      .select("callsign, total_hours, career_hours, transferred_hours"),
  ]);

  const monthHours = (monthLedgerRes.data ?? []).reduce((acc, row) => {
    return acc + toSafeNumber((row as ScoreLedgerRow).flight_hours);
  }, 0);

  const allPilotMonthHours = new Map<string, number>();
  for (const rawRow of (allMonthLedgerRes.data ?? []) as ScoreLedgerRow[]) {
    const pilotCallsign = rawRow.pilot_callsign?.trim().toUpperCase();
    if (!pilotCallsign) {
      continue;
    }

    const current = allPilotMonthHours.get(pilotCallsign) ?? 0;
    allPilotMonthHours.set(pilotCallsign, current + toSafeNumber(rawRow.flight_hours));
  }

  const rankingRows = ((pilotProfilesRes.data ?? []) as PilotHoursRow[])
    .map((row) => {
      const pilotCallsign = row.callsign?.trim().toUpperCase();
      if (!pilotCallsign) {
        return null;
      }

      const totalHours =
        toSafeNumber(row.total_hours) ||
        toSafeNumber(row.career_hours) + toSafeNumber(row.transferred_hours);

      return {
        callsign: pilotCallsign,
        totalHours,
        monthHours: allPilotMonthHours.get(pilotCallsign) ?? 0,
      };
    })
    .filter((row): row is { callsign: string; totalHours: number; monthHours: number } => Boolean(row))
    .sort((a, b) => {
      if (b.monthHours !== a.monthHours) {
        return b.monthHours - a.monthHours;
      }

      if (b.totalHours !== a.totalHours) {
        return b.totalHours - a.totalHours;
      }

      return a.callsign.localeCompare(b.callsign);
    });

  const monthPosition = rankingRows.findIndex((row) => row.callsign === callsign);
  const totalHours = getProfileTotalHours(profile);
  const pilotStatus = profile.status?.trim().toLowerCase() === "inactive" ? "INACTIVO" : "ACTIVO";
  const scoreSamples = ((recentScoreRes.data ?? []) as FlightReservationRow[])
    .map((row) =>
      resolvePatagoniaScore({
        scorePayload: row.score_payload,
        performanceScore: row.performance_score,
        procedureScore: row.procedure_score,
        missionScore: row.mission_score,
      }),
    )
    .filter((value) => Number.isFinite(value) && value > 0);

  const patagoniaScore = scoreSamples.length
    ? scoreSamples.reduce((sum, value) => sum + value, 0) / scoreSamples.length
    : 0;

  return {
    patagoniaScore,
    pilotStatus,
    monthLabel,
    monthPosition: monthHours > 0 && monthPosition >= 0 ? monthPosition + 1 : null,
    monthHours,
    totalPireps: pirepCountRes.count ?? 0,
    totalHours,
    walletBalance: getProfileWallet(profile),
    careerRankCode: profile.career_rank_code ?? profile.rank_code ?? "CADET",
    careerRank: getRankInsignia(profile.career_rank_code ?? profile.rank_code).name,
  } satisfies DashboardMetrics;
}

async function loadCentralOverview(profile: PilotProfileRecord): Promise<CentralOverview> {
  const profileWithLegacyCodes = profile as PilotProfileRecord & {
    current_airport_icao?: string | null;
    current_airport_code?: string | null;
    base_hub?: string | null;
  };
  const currentAirport = (
    profileWithLegacyCodes.current_airport_icao ??
    profileWithLegacyCodes.current_airport_code ??
    profileWithLegacyCodes.base_hub ??
    "SCEL"
  )
    .trim()
    .toUpperCase();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const [
    airportRes,
    pilotsOnFieldRes,
    activeFlightsRes,
    recentFlightsRes,
    monthLedgerRes,
    yearLedgerRes,
    monthScoredRes,
    yearScoredRes,
  ] = await Promise.all([
    supabase
      .from("airports")
      .select("ident, name, municipality, iso_country")
      .eq("ident", currentAirport)
      .maybeSingle(),
    supabase
      .from("pilot_profiles")
      .select("callsign", { count: "exact", head: true })
      .eq("current_airport_code", currentAirport),
    supabase
      .from("flight_reservations")
      .select(
        "pilot_callsign, route_code, flight_number, aircraft_type_code, aircraft_registration, origin_ident, destination_ident, status, flight_mode_code, updated_at",
      )
      .in("status", ["dispatched", "in_progress"])
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("flight_reservations")
      .select(
        "id, pilot_callsign, route_code, flight_number, aircraft_type_code, aircraft_registration, origin_ident, destination_ident, status, flight_mode_code, procedure_score, performance_score, mission_score, score_payload, completed_at, created_at",
      )
      .in("status", ["completed", "crashed", "manual_review", "rejected"])
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from("pw_pilot_score_ledger")
      .select("pilot_callsign, flight_hours, procedure_score, mission_score, created_at")
      .gte("created_at", monthStart),
    supabase
      .from("pw_pilot_score_ledger")
      .select("pilot_callsign, flight_hours, procedure_score, mission_score, created_at")
      .gte("created_at", yearStart),
    supabase
      .from("flight_reservations")
      .select(
        "pilot_callsign, route_code, procedure_score, performance_score, mission_score, score_payload, completed_at, created_at, origin_ident, destination_ident",
      )
      .eq("status", "completed")
      .eq("scoring_status", "scored")
      .gte("completed_at", monthStart)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from("flight_reservations")
      .select(
        "pilot_callsign, route_code, procedure_score, performance_score, mission_score, score_payload, completed_at, created_at, origin_ident, destination_ident",
      )
      .eq("status", "completed")
      .eq("scoring_status", "scored")
      .gte("completed_at", yearStart)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(500),
  ]);

  const airport = (airportRes.data ?? null) as AirportRow | null;

  let metarText = `METAR ${currentAirport} — pendiente de actualización`;

  try {
    const metarCandidateIds = buildMetarCandidateIds(currentAirport);
    const metarResponse = await fetch(`/api/weather/metar?ids=${metarCandidateIds.join(",")}`, {
      method: "GET",
      cache: "no-store",
    });

    if (metarResponse.ok) {
      const metarPayload = await metarResponse.json().catch(() => null) as {
        metar?: { raw?: string | null; station?: string | null } | null;
      } | null;

      const rawMetar = metarPayload?.metar?.raw?.trim();
      if (rawMetar) {
        metarText = buildMetarDisplayText(rawMetar, currentAirport, metarPayload?.metar?.station);
      }
    }
  } catch {
    metarText = `METAR ${currentAirport} — pendiente de actualización`;
  }

  const airportCode = airport?.ident?.trim().toUpperCase() ?? currentAirport;
  const countryCode = airport?.iso_country?.trim().toUpperCase() ?? "CL";
  const activeFlights = ((activeFlightsRes.data ?? []) as FlightReservationRow[]).slice(0, 10);
  const recentFlights = ((recentFlightsRes.data ?? []) as FlightReservationRow[]).slice(0, 20);
  const pilotsOnField = pilotsOnFieldRes.count ?? 0;

  return {
    airportCode,
    airportName: airport?.name?.trim() ?? "Aeropuerto actual del piloto",
    municipality: airport?.municipality?.trim() ?? "Ubicación operativa",
    countryCode,
    countryName: getCountryName(airport?.iso_country),
    pilotsOnField,
    metarText,
    imagePath: getAirportImagePath(currentAirport),
    transferOptions: buildTransferOptions(countryCode, airportCode),
    monthlyRankingCards: buildRankingCards(
      (monthLedgerRes.data ?? []) as ScoreLedgerRow[],
      (monthScoredRes.data ?? []) as FlightReservationRow[],
      "month",
    ),
    yearlyRankingCards: buildRankingCards(
      (yearLedgerRes.data ?? []) as ScoreLedgerRow[],
      (yearScoredRes.data ?? []) as FlightReservationRow[],
      "year",
    ),
    activeFlights,
    recentFlights,
    newsItems: buildNewsItems(airportCode, pilotsOnField, activeFlights, recentFlights),
  };
}

function AnimatedMetricValue({
  item,
  animateKey,
}: {
  item: MetricDisplayItem;
  animateKey: string;
}) {
  const isNumeric = item.type !== "text" && typeof item.value === "number";
  const [displayValue, setDisplayValue] = useState<number>(0);

  useEffect(() => {
    if (!isNumeric) {
      return;
    }

    const target = Number(item.value) || 0;
    const duration = 900;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(target * eased);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    setDisplayValue(0);
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [animateKey, isNumeric, item.type, item.value]);

  if (!isNumeric) {
    return <>{String(item.value)}</>;
  }

  if (item.type === "currency") {
    return <>{formatCurrency(displayValue)}</>;
  }

  if ((item.decimals ?? 0) > 0) {
    return <>{formatDecimal(displayValue)}</>;
  }

  return <>{formatInteger(displayValue)}</>;
}

function PilotStatsRail({
  items,
  animationSeed,
  rankCode,
}: {
  items: MetricDisplayItem[];
  animationSeed: string;
  rankCode: string;
}) {
  const rank = getRankInsignia(rankCode);

  return (
    <section className="mt-5 glass-panel rounded-[30px] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
            Estadísticas del piloto
          </p>
          <p className="mt-1 text-sm leading-6 text-white/56">
            Resumen operacional rápido al estilo sala de despacho: estado, rango, horas, score y billetera.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-400/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Panel vivo
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-h-[104px] flex-col justify-between rounded-[20px] border border-white/8 bg-white/[0.035] px-4 py-4"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
              {item.label}
            </span>
            {item.label === "Rango" ? (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={rank.asset}
                  alt={`Insignia ${rank.name}`}
                  className="h-12 w-12 object-contain"
                  loading="lazy"
                  decoding="async"
                />
                <span className="text-base font-semibold leading-tight text-white">
                  <AnimatedMetricValue item={item} animateKey={animationSeed} />
                </span>
              </div>
            ) : (
              <span className="mt-4 text-2xl font-semibold tracking-tight text-white">
                <AnimatedMetricValue item={item} animateKey={animationSeed} />
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}


function CentralSectionDivider() {
  return <div className="my-6 h-px w-full bg-white/10" />;
}

function CentralRankingGrid({ cards }: { cards: RankingCard[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))]"
        >
          <div className="border-b border-white/8 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Ranking
            </p>
            <h4 className="mt-2 text-base font-semibold text-white">{card.title}</h4>
          </div>

          <div className="space-y-3 p-4">
            {card.entries.map((entry, index) => (
              <div
                key={`${card.title}-${index}-${entry.label}`}
                className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-[#031428]/62 px-3 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/18 bg-emerald-500/[0.09] text-sm font-semibold text-emerald-300">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{entry.label}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/42">
                    Posición destacada
                  </p>
                </div>

                <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm font-semibold text-white">
                  {entry.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function useResolvedAirportHero(
  central: Pick<
    CentralOverview,
    "airportCode" | "airportName" | "municipality" | "countryName" | "imagePath"
  >,
) {
  const [heroImage, setHeroImage] = useState<AirportHeroResponse | null>(null);
  const [isResolvingImage, setIsResolvingImage] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolveAirportHero() {
      setIsResolvingImage(true);
      setHeroImage(null);

      try {
        const response = await fetch(buildAirportHeroRequestUrl(central), {
          method: "GET",
          cache: "no-store",
        });

        if (response.ok) {
          const payload = (await response.json().catch(() => null)) as AirportHeroResponse | null;

          if (!cancelled && payload?.imageUrl) {
            setHeroImage(payload);
            setIsResolvingImage(false);
            return;
          }
        }
      } catch {
        // fallback handled below
      }

      if (!cancelled) {
        setHeroImage({
          imageUrl: central.imagePath,
          source: "fallback",
        });
        setIsResolvingImage(false);
      }
    }

    void resolveAirportHero();

    return () => {
      cancelled = true;
    };
  }, [
    central.airportCode,
    central.airportName,
    central.countryName,
    central.imagePath,
    central.municipality,
  ]);

  return {
    heroImage,
    isResolvingImage,
    resolvedImageUrl: heroImage?.imageUrl ?? central.imagePath,
  };
}

function CentralAirportHero({ central }: { central: CentralOverview }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const { heroImage, isResolvingImage, resolvedImageUrl } = useResolvedAirportHero(central);
  const flagUrl = getFlagUrl(central.countryCode);
  const displayImageUrl =
    resolvedImageUrl && failedImageUrl !== resolvedImageUrl ? resolvedImageUrl : null;
  const showPexelsAttribution = heroImage?.source === "pexels" && Boolean(heroImage.photographerName);
  const metar = buildDispatchMetarSummary(central.metarText);
  const metarPending = /pendiente/i.test(metar.raw);
  const advisoryText = metarPending
    ? `Sin METAR actualizado para ${central.airportCode}. Antes de despachar, confirma meteorología, pista en uso, combustible y alternativo.`
    : `METAR disponible para ${central.airportCode}. Confirma QNH ${metar.qnh}, viento ${metar.wind}, visibilidad ${metar.visibility} y restricciones internas antes del push.`;

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(6,22,44,0.9),rgba(4,15,30,0.94))]">
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
              Central del hub actual
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {central.countryName}
              </h2>
              {flagUrl ? (
                <img
                  src={flagUrl}
                  alt={`Bandera de ${central.countryName}`}
                  className="h-[18px] w-auto rounded-[2px] object-cover shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
                />
              ) : null}
            </div>
            <p className="mt-2 text-base text-white/78">
              {central.airportCode} · {central.airportName}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
              Pilotos en esta ubicación
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {formatInteger(central.pilotsOnField)}
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr] lg:items-stretch">
          <div className="relative min-h-[260px] overflow-hidden rounded-[24px] bg-[#07131f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            {displayImageUrl ? (
              <img
                src={displayImageUrl}
                alt={`${central.airportCode} aeropuerto`}
                className="absolute inset-0 h-full w-full object-cover object-center"
                loading="eager"
                fetchPriority="high"
                onError={() => {
                  if (resolvedImageUrl) setFailedImageUrl(resolvedImageUrl);
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(30,144,255,0.18),transparent_40%),linear-gradient(160deg,rgba(3,20,40,1),rgba(7,35,66,0.9))]" />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/65" />

            <div className="absolute right-0 top-0 z-10">
              <img
                src="/branding/patagonia-logo.png"
                alt="Patagonia Wings"
                className="h-40 w-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]"
              />
            </div>

            {showPexelsAttribution ? (
              <div className="pointer-events-auto absolute bottom-[72px] left-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[10px] leading-none text-white/50 backdrop-blur-sm">
                {heroImage?.photographerUrl ? (
                  <a href={heroImage.photographerUrl} target="_blank" rel="noreferrer" className="transition hover:text-white/80">
                    © {heroImage.photographerName}
                  </a>
                ) : (
                  <span>© {heroImage?.photographerName}</span>
                )}
                {" "}·{" "}
                {heroImage?.providerUrl ? (
                  <a href={heroImage.providerUrl} target="_blank" rel="noreferrer" className="transition hover:text-white/80">
                    {heroImage?.providerName ?? "Pexels"}
                  </a>
                ) : (
                  <span>{heroImage?.providerName ?? "Pexels"}</span>
                )}
              </div>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-4 bg-[#15683e] px-5 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-[17px] font-bold leading-6 text-white">
                  {central.airportName}
                </p>
                <p className="truncate text-[13px] font-medium leading-5 text-white/80">
                  {central.municipality} · {central.countryName}
                </p>
              </div>
              {flagUrl ? (
                <img
                  src={flagUrl}
                  alt={`Bandera de ${central.countryName}`}
                  className="h-[28px] w-auto flex-shrink-0 rounded-[3px] object-cover shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                />
              ) : null}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Aeropuerto actual
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{central.airportName}</h3>
              <p className="mt-2 text-sm leading-7 text-white/74">
                {central.municipality} · {central.countryName}
              </p>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                  METAR
                </p>
                <span className="rounded-full border border-emerald-100/16 bg-emerald-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100/72">
                  {metar.condition}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                {[
                  ["Temp", metar.temperature],
                  ["QNH", metar.qnh],
                  ["Viento", metar.wind],
                  ["Visibilidad", metar.visibility],
                ].map(([label, value]) => (
                  <div key={`central-metar-${label}`} className="rounded-2xl border border-white/8 bg-black/16 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">{label}</p>
                    <p className="mt-1 text-sm font-bold text-white/84">{value}</p>
                  </div>
                ))}
              </div>

              <p className="mt-3 truncate text-[11px] font-medium text-white/42" title={metar.raw}>
                {metar.raw}
              </p>
            </div>

            <div className="rounded-[24px] border border-amber-300/16 bg-amber-300/[0.055] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200/18 bg-amber-300/[0.12] text-lg">
                  🔔
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100/72">
                      NOTAM PWG · {central.airportCode}
                    </p>
                    <span className="rounded-full border border-amber-200/18 bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-100/72">
                      Operacional interno
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/76">
                    {advisoryText}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                  ICAO actual
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">{central.airportCode}</h3>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                  País / bandera
                </p>
                <div className="mt-3 flex items-center gap-3">
                  {flagUrl ? (
                    <img
                      src={flagUrl}
                      alt={`Bandera de ${central.countryName}`}
                      className="h-[18px] w-auto rounded-[2px] object-cover"
                    />
                  ) : null}
                  <h3 className="text-2xl font-semibold text-white">{central.countryName}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CentralAirportActivityBoard({ central }: { central: CentralOverview }) {
  const airportCode = central.airportCode.trim().toUpperCase();
  const uniqueRows = new Map<string, FlightReservationRow>();

  for (const row of [...central.activeFlights, ...central.recentFlights]) {
    const key = row.id ?? `${row.pilot_callsign ?? "PWG"}-${row.flight_number ?? row.route_code ?? "ROUTE"}-${row.origin_ident ?? "---"}-${row.destination_ident ?? "---"}-${row.status ?? "status"}`;
    if (!uniqueRows.has(key)) {
      uniqueRows.set(key, row);
    }
  }

  const movementRows = Array.from(uniqueRows.values());
  const departures = movementRows
    .filter((row) => row.origin_ident?.trim().toUpperCase() === airportCode)
    .slice(0, 6);
  const arrivals = movementRows
    .filter((row) => row.destination_ident?.trim().toUpperCase() === airportCode)
    .slice(0, 6);

  const renderMovement = (row: FlightReservationRow, direction: "departure" | "arrival", index: number) => {
    const otherAirport = direction === "departure" ? row.destination_ident : row.origin_ident;
    const routeLabel = row.flight_number?.trim() || row.route_code?.trim() || formatRouteTag(row);
    const aircraft = row.aircraft_type_code?.trim()?.split("_")[0] || row.aircraft_registration?.trim() || "---";
    const status = formatFlightStatusLabel(row.status);
    const active = ["dispatched", "dispatch_ready", "in_progress", "in_flight"].includes((row.status ?? "").trim().toLowerCase());

    return (
      <div
        key={`${direction}-${row.id ?? routeLabel}-${index}`}
        className="grid grid-cols-[76px_minmax(0,1fr)_72px] items-center gap-3 rounded-[18px] border border-white/8 bg-[#031428]/58 px-3 py-3"
      >
        <div>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${active ? "border-emerald-300/18 bg-emerald-400/[0.09] text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/58"}`}>
            {status}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{routeLabel}</p>
          <p className="mt-1 truncate text-[11px] text-white/48">
            {aircraft} · {formatFlightModeLabel(row.flight_mode_code)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-white">{otherAirport?.trim().toUpperCase() ?? "---"}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/34">
            {direction === "departure" ? "Destino" : "Origen"}
          </p>
        </div>
      </div>
    );
  };

  const renderColumn = (
    title: string,
    subtitle: string,
    rows: FlightReservationRow[],
    direction: "departure" | "arrival",
    icon: string,
  ) => (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/48">{subtitle}</p>
          <h4 className="mt-1 text-lg font-semibold text-white">{icon} {title}</h4>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs font-bold text-white/72">
          {formatInteger(rows.length)}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {rows.length ? (
          rows.map((row, index) => renderMovement(row, direction, index))
        ) : (
          <div className="rounded-[18px] border border-dashed border-white/10 bg-[#031428]/45 px-4 py-6 text-center text-sm text-white/46">
            Sin movimientos registrados para esta lectura.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
            Actividad del aeropuerto
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Movimientos en {airportCode}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/56">
            Vista inspirada en una sala de despacho: separa salidas, arribos y control operacional usando reservas y vuelos recientes de Patagonia Wings.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.055] px-4 py-3 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/54">ATC/VATSIM</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">Preparado para integración</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {renderColumn("Partidas", "Desde la posición actual", departures, "departure", "🛫")}
        {renderColumn("Arribos", "Hacia la posición actual", arrivals, "arrival", "🛬")}
      </div>
    </section>
  );
}

function CentralNewsSection({
  items,
  liveNews,
}: {
  items: CentralOverview["newsItems"];
  liveNews: Array<{ title: string; description: string | null; url: string; publishedAt: string; source: string }> | null;
}) {
  const hasLiveNews = Boolean(liveNews && liveNews.length > 0);

  return (
    <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[24px] border border-white/8 bg-white/[0.025] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
              Novedades operacionales
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Comunicados de la central</h3>
          </div>
          <span className="rounded-full border border-emerald-300/18 bg-emerald-400/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
            PWG
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {items.length ? (
            items.map((item, index) => (
              <article
                key={`${item.tag}-${item.title}-${index}`}
                className="rounded-[18px] border border-white/8 bg-[#031428]/55 p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/56">
                  {item.tag}
                </p>
                <h4 className="mt-1 text-sm font-semibold leading-5 text-white">{item.title}</h4>
                <p className="mt-2 text-xs leading-5 text-white/52">{item.body}</p>
              </article>
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-white/10 bg-[#031428]/45 px-4 py-6 text-sm leading-6 text-white/48">
              Sin comunicados internos para esta lectura operacional.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[24px] border border-white/8 bg-white/[0.025] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
              Noticias locales
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Actualidad cerca de tu base</h3>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${hasLiveNews ? "border-cyan-300/18 bg-cyan-400/[0.08] text-cyan-100" : "border-white/10 bg-white/[0.045] text-white/48"}`}>
            {hasLiveNews ? "Live" : "Local"}
          </span>
        </div>

        {hasLiveNews ? (
          <div className="mt-4 space-y-2">
            {liveNews!.slice(0, 5).map((article, i) => {
              const dateStr = article.publishedAt
                ? new Date(article.publishedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
                : "";
              return (
                <a
                  key={`${article.url}-${i}`}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-[18px] border border-white/8 bg-[#031428]/55 p-4 transition hover:border-cyan-300/24 hover:bg-cyan-300/[0.045]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/56">
                        {article.source || "Fuente local"} {dateStr ? `· ${dateStr}` : ""}
                      </p>
                      <h4 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white">
                        {article.title}
                      </h4>
                    </div>
                    <span className="shrink-0 text-white/35">↗</span>
                  </div>
                  {article.description ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/52">{article.description}</p>
                  ) : null}
                </a>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-[18px] border border-dashed border-white/10 bg-[#031428]/45 px-4 py-6 text-sm leading-6 text-white/48">
            Cuando exista conexión con la API de noticias o se publiquen novedades para la ciudad actual del piloto, aparecerán aquí.
          </p>
        )}
      </div>
    </section>
  );
}

function CentralFlightsTable({
  rows,
  emptyLabel,
  variant,
}: {
  rows: FlightReservationRow[];
  emptyLabel: string;
  variant: "active" | "recent";
}) {
  const headers =
    variant === "active"
      ? ["Piloto", "Vuelo", "Aeronave", "Matrícula", "Origen", "Destino", "Estado", "Tipo"]
      : ["Piloto", "Vuelo", "Aeronave", "Matrícula", "Origen", "Destino", "Score", "Tipo", ""];

  const statusTone = (status?: string | null) => {
    const normalized = (status ?? "").trim().toLowerCase();

    if (normalized === "in_progress" || normalized === "in_flight") {
      return "border-cyan-400/18 bg-cyan-500/[0.08] text-cyan-200";
    }

    if (normalized === "dispatch_ready" || normalized === "dispatched") {
      return "border-emerald-400/18 bg-emerald-500/[0.08] text-emerald-200";
    }

    if (normalized === "completed") {
      return "border-white/12 bg-white/[0.06] text-white";
    }

    return "border-white/10 bg-white/[0.04] text-white/78";
  };

  const modeTone = (mode?: string | null) => {
    const normalized = (mode ?? "").trim().toUpperCase();

    if (normalized === "CAREER") {
      return "border-emerald-400/18 bg-emerald-500/[0.08] text-emerald-200";
    }

    if (normalized === "TRAINING") {
      return "border-amber-400/18 bg-amber-500/[0.08] text-amber-200";
    }

    if (normalized === "EVENT") {
      return "border-fuchsia-400/18 bg-fuchsia-500/[0.08] text-fuchsia-200";
    }

    if (normalized === "CHARTER") {
      return "border-cyan-400/18 bg-cyan-500/[0.08] text-cyan-200";
    }

    return "border-white/10 bg-white/[0.04] text-white/78";
  };

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/78">
          <thead className="bg-white/[0.04] text-[11px] uppercase tracking-[0.18em] text-white/50">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((row, index) => {
                const routeLabel = row.flight_number?.trim() || row.route_code?.trim() || formatRouteTag(row);
                // Show just the ICAO model code, not the addon suffix (A319_FENIX → A319)
                const rawTypeCode = row.aircraft_type_code?.trim() || "";
                const aircraftPrimary = rawTypeCode
                  ? rawTypeCode.split("_")[0]
                  : row.aircraft_registration?.trim() || "---";
                const registration = row.aircraft_registration?.trim() || null;

                return (
                  <tr
                    key={`${row.pilot_callsign ?? "pwg"}-${index}`}
                    className="border-t border-white/8 align-top"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">
                        {row.pilot_callsign?.trim().toUpperCase() ?? "PWG"}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{routeLabel}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{aircraftPrimary}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-xs font-medium uppercase tracking-[0.14em] text-white/60">
                        {registration ?? "—"}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-medium text-white/84">
                      {row.origin_ident?.trim().toUpperCase() ?? "---"}
                    </td>

                    <td className="px-4 py-3 font-medium text-white/84">
                      {row.destination_ident?.trim().toUpperCase() ?? "---"}
                    </td>

                    <td className="px-4 py-3">
                      {variant === "active" ? (
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusTone(row.status)}`}
                        >
                          {formatFlightStatusLabel(row.status)}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                          {toSafeNumber(row.procedure_score) > 0
                            ? `${formatDecimal(toSafeNumber(row.procedure_score))} pts`
                            : "—"}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${modeTone(row.flight_mode_code)}`}
                      >
                        {formatFlightModeLabel(row.flight_mode_code)}
                      </span>
                    </td>

                    {variant === "recent" ? (
                      <td className="px-4 py-3 text-right">
                        {row.id ? (
                          <a
                            href={`/flights/${row.id}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-white/54 transition hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-sky-300"
                            title="Ver resumen de vuelo"
                          >
                            <span className="text-sm">👁</span>
                          </a>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-white/54">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Office Economy Panel ─────────────────────────────────────────────────────

type EconStats = {
  airline: { name: string; balance_usd: number; total_revenue_usd: number; total_costs_usd: number; net_profit_usd: number; initial_capital_usd?: number; has_real_ledger?: boolean };
  breakdown: { income_flights: number; cost_fuel: number; cost_maintenance: number; cost_pilot_payments: number; cost_repairs: number; cost_salaries: number };
  totalFlightsCompleted: number;
};

function OfficeEconomyPanel() {
  const [stats, setStats] = useState<EconStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetch("/api/economia/stats")
      .then((r) => r.json())
      .then((data: { ok?: boolean } & Partial<EconStats>) => {
        if (data.ok && data.airline) setStats(data as EconStats);
      })
      .catch(() => undefined)
      .finally(() => setLoadingStats(false));
  }, []);

  if (loadingStats) {
    return (
      <div className="surface-outline rounded-[24px] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Economía aerolínea</p>
        <p className="mt-3 text-sm text-white/36">Cargando estadísticas...</p>
      </div>
    );
  }
  const fallbackStats: EconStats = {
    airline: {
      name: "Patagonia Wings",
      balance_usd: 1305000,
      total_revenue_usd: 0,
      total_costs_usd: 0,
      net_profit_usd: 0,
      initial_capital_usd: 1305000,
      has_real_ledger: false,
    },
    breakdown: {
      income_flights: 0,
      cost_fuel: 0,
      cost_maintenance: 0,
      cost_pilot_payments: 0,
      cost_repairs: 0,
      cost_salaries: 0,
    },
    totalFlightsCompleted: 0,
  };

  const { airline, breakdown, totalFlightsCompleted } = stats ?? fallbackStats;
  const isProfit = airline.net_profit_usd >= 0;

  function fmtU(n: number) {
    return `$${Math.abs(n).toLocaleString("es-CL", { maximumFractionDigits: 0 })} USD`;
  }

  return (
    <div className="surface-outline rounded-[24px] p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">💰 Economía aerolínea</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{airline.name}</h3>
          {airline.has_real_ledger === false ? (
            <p className="mt-2 max-w-xl text-xs leading-5 text-white/48">
              Capital inicial operativo cargado. Sin operaciones registradas aún.
            </p>
          ) : null}
        </div>
        <Link href="/economia" className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/60 transition hover:border-white/20 hover:text-white/90">
          Ver completo →
        </Link>
      </div>

      {/* 4 main KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        {[
          { label: "Balance", value: fmtU(airline.balance_usd), color: airline.balance_usd >= 0 ? "#34d399" : "#f87171" },
          { label: "Ingresos", value: fmtU(airline.total_revenue_usd), color: "#38bdf8" },
          { label: "Costos", value: fmtU(airline.total_costs_usd), color: "#fbbf24" },
          { label: isProfit ? "Utilidad" : "Pérdida", value: `${isProfit ? "+" : "−"}${fmtU(airline.net_profit_usd)}`, color: isProfit ? "#34d399" : "#f87171" },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-white/8 bg-white/[0.02] px-4 py-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/38">{k.label}</p>
            <p className="mt-1.5 text-base font-black" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Breakdown row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Vuelos", value: String(totalFlightsCompleted), color: "text-white" },
          { label: "Combustible", value: fmtU(breakdown.cost_fuel), color: "text-amber-300" },
          { label: "Mant.", value: fmtU(breakdown.cost_maintenance), color: "text-amber-300" },
          { label: "Pilotos", value: fmtU(breakdown.cost_pilot_payments), color: "text-cyan-300" },
          { label: "Reparac.", value: fmtU(breakdown.cost_repairs), color: "text-rose-300" },
          { label: "Salarios", value: fmtU(breakdown.cost_salaries), color: "text-violet-300" },
        ].map((b) => (
          <div key={b.label} className="flex flex-col rounded-[12px] border border-white/6 bg-white/[0.015] px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/36">{b.label}</p>
            <p className={`mt-1 text-xs font-bold ${b.color}`}>{b.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Wrapper: only renders the divider + transfers when the inner component doesn't return null.
// We use a child-component approach: CentralTransfersSection returns null when empty,
// so we pre-check using a shared state exposed via callback.
function CentralTransfersSectionWrapper({ central }: { central: CentralOverview }) {
  const [hasContent, setHasContent] = useState(false);

  const handleEmpty = useCallback(() => {
    setHasContent(false);
  }, []);

  const handleHasContent = useCallback(() => {
    setHasContent(true);
  }, []);

  useEffect(() => {
    setHasContent(false);
  }, [central.airportCode]);

  return (
    <>
      {hasContent && <CentralSectionDivider />}
      <CentralTransfersSectionControlled
        airportCode={central.airportCode}
        options={central.transferOptions}
        onEmpty={handleEmpty}
        onHasContent={handleHasContent}
      />
    </>
  );
}

function CentralTransfersSectionControlled({
  airportCode,
  options,
  onEmpty,
  onHasContent,
}: {
  airportCode: string;
  options: TransferOption[];
  onEmpty: () => void;
  onHasContent: () => void;
}) {
  const [destinations, setDestinations] = useState<TransferDestinationOption[]>([]);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const accentMap: Record<TransferOption["accent"], string> = {
    emerald: "border-emerald-400/14 bg-emerald-500/[0.05] text-emerald-200",
    amber: "border-amber-400/18 bg-amber-400/[0.06] text-amber-100",
    cyan: "border-cyan-400/14 bg-cyan-500/[0.05] text-cyan-200",
  };

  const visibleOptions = options.filter(
    (option) => option.mode === "ground_taxi" || option.mode === "ground_bus" || option.mode === "air_ticket",
  );

  useEffect(() => {
    let isMounted = true;

    async function loadTransferOptions() {
      setIsLoadingTransfers(true);
      setTransferError(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          throw new Error("No se encontró una sesión activa para consultar traslados.");
        }

        const response = await fetch("/api/pilot/transfer", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as {
          options?: TransferDestinationOption[];
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "No se pudieron cargar alternativas de traslado.");
        }

        if (isMounted) {
          const opts = payload?.options ?? [];
          setDestinations(opts);
          if (opts.length === 0) onEmpty();
          else onHasContent();
        }
      } catch (error) {
        if (isMounted) {
          setDestinations([]);
          setTransferError(error instanceof Error ? error.message : "No se pudieron cargar traslados.");
          onEmpty();
        }
      } finally {
        if (isMounted) {
          setIsLoadingTransfers(false);
        }
      }
    }

    void loadTransferOptions();

    return () => {
      isMounted = false;
    };
  }, [airportCode, onEmpty, onHasContent]);

  async function submitTransfer(destination: TransferDestinationOption) {
    const key = `${destination.mode}:${destination.destination_ident}`;
    setSubmittingKey(key);
    setTransferError(null);
    setTransferMessage(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No se encontró una sesión activa para ejecutar el traslado.");
      }

      const response = await fetch("/api/pilot/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          mode: destination.mode,
          destinationIdent: destination.destination_ident,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        destinationIdent?: string;
        totalCostUsd?: number;
        walletBalanceUsd?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo ejecutar el traslado.");
      }

      setTransferMessage(
        `Traslado confirmado a ${payload?.destinationIdent ?? destination.destination_ident}. Se descontaron ${formatTransferUsd(payload?.totalCostUsd ?? destination.total_cost_usd)}.`,
      );

      window.setTimeout(() => { window.location.reload(); }, 900);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "No se pudo ejecutar el traslado.");
    } finally {
      setSubmittingKey(null);
    }
  }

  // Hide the whole transfers block while loading or when there are no destinations.
  // This prevents the dashboard from flashing a temporary empty transfers card
  // when the API returns no options or when auth/session refresh triggers a re-fetch.
  if (destinations.length === 0 && !transferMessage) {
    return null;
  }

  const hasAbandonmentPenalty = destinations.some((d) => d.abandonment_penalty_usd > 0);

  return (
    <section>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Traslados</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-semibold text-white">Reposicionamiento</h3>
            {!isLoadingTransfers && destinations.length > 0 && (
              hasAbandonmentPenalty ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200">
                  ⚠ Aeropuerto no-hub · +$350 multa
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                  ✓ Hub designado · sin multa
                </span>
              )
            )}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
            Reposiciónate de inmediato desde <span className="font-semibold text-white">{airportCode}</span>.
            {hasAbandonmentPenalty ? " Se aplica multa operacional de $350 por aeronave disponible fuera de hub." : " Sin multa adicional — partís desde un hub."}
          </p>
        </div>
      </div>

      {transferMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-300/18 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          {transferMessage}
        </div>
      ) : null}

      {transferError ? (
        <div className="mt-4 rounded-2xl border border-rose-300/18 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
          {transferError}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {visibleOptions.map((option, optionIndex) => {
          const optionDestinations = destinations
            .filter((item) => normalizeTransferModeForUi(item.mode) === option.mode)
            .slice(0, 4);

          return (
            <article
              key={`${option.mode}-${optionIndex}`}
              className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${accentMap[option.accent]}`}>
                  {option.title}
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-white/52">{option.subtitle}</p>

              <div className="mt-4 rounded-xl border border-white/8 bg-[#031428]/30 px-3 py-2">
                <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34 md:grid">
                  <span>Aeropuerto</span>
                  <span>Tarifa</span>
                  <span className="text-right">Acción</span>
                </div>

                <div className="mt-0 space-y-2 md:mt-2">
                  {isLoadingTransfers ? (
                    <div className="rounded-xl border border-white/8 bg-[#031428]/55 px-3 py-3 text-[11px] font-semibold text-white/50">
                      Calculando alternativas...
                    </div>
                  ) : optionDestinations.length === 0 ? (
                    <div className="rounded-xl border border-white/8 bg-[#031428]/55 px-3 py-3 text-[11px] font-semibold text-white/50">
                      Sin alternativas desde esta ubicación.
                    </div>
                  ) : (
                    optionDestinations.map((destination, destinationIndex) => {
                      const submitKey = `${destination.mode}:${destination.destination_ident}`;
                      const renderKey = `${option.mode}:${destination.mode}:${destination.destination_ident}:${destinationIndex}`;
                      const isSubmitting = submittingKey === submitKey;
                      const blocked = isSubmitting || !destination.can_afford;
                      const hasPenalty = destination.abandonment_penalty_usd > 0;

                      return (
                        <div
                          key={renderKey}
                          className="rounded-xl border border-white/8 bg-[#031428]/58"
                        >
                          <div className="grid gap-2 px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-white">{destination.destination_ident}</p>
                              <p className="mt-0.5 truncate text-[10px] text-white/48">{destination.destination_name}</p>
                            </div>
                            <div className="text-left md:text-right">
                              <p className={`text-xs font-black ${destination.can_afford ? "text-emerald-300" : "text-rose-300"}`}>
                                {formatTransferUsd(destination.total_cost_usd)}
                              </p>
                              {hasPenalty ? <p className="text-[10px] text-amber-300">incluye multa</p> : null}
                            </div>
                            <div className="md:text-right">
                              <button
                                type="button"
                                disabled={blocked}
                                onClick={() => void submitTransfer(destination)}
                                className={`inline-flex h-9 min-w-[136px] items-center justify-center rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                                  blocked
                                    ? "cursor-not-allowed border border-white/8 bg-white/[0.03] text-white/32"
                                    : "border border-emerald-400/18 bg-emerald-500/[0.06] text-emerald-200 hover:bg-emerald-500/10"
                                }`}
                              >
                                {isSubmitting ? "Trasladando..." : destination.can_afford ? "Trasladar" : "Sin saldo"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ─── News section wrapper ─────────────────────────────────────────────────────

type LiveNewsArticle = {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  source: string;
};

function CentralNewsSectionWrapper({ central }: { central: CentralOverview }) {
  const [liveNews, setLiveNews] = useState<LiveNewsArticle[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (central.municipality) params.set("city", central.municipality);
    if (central.countryName) params.set("country", central.countryName);

    fetch(`/api/news/local?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; items?: LiveNewsArticle[] }) => {
        if (!cancelled) setLiveNews(data.ok && data.items && data.items.length > 0 ? data.items : null);
      })
      .catch(() => { if (!cancelled) setLiveNews(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [central.municipality, central.countryName]);

  // If still loading, show static items
  if (loading) {
    return (
      <>
        <CentralSectionDivider />
        <CentralNewsSection items={central.newsItems} liveNews={null} />
      </>
    );
  }

  // If no live news, show static operational items (hide section only if static is also empty)
  return (
    <>
      <CentralSectionDivider />
      <CentralNewsSection items={central.newsItems} liveNews={liveNews} />
    </>
  );
}

function CentralWorkspace({ central }: { central: CentralOverview }) {
  return (
    <div className="space-y-6">
      <CentralAirportHero central={central} />

      <CentralSectionDivider />
      <CentralAirportActivityBoard central={central} />

      <CentralTransfersSectionWrapper central={central} />

      <CentralNewsSectionWrapper central={central} />

      <CentralSectionDivider />
      <section>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
              Rankings mensuales
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Resumen del mes</h3>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Corte
            </p>
            <p className="mt-2 text-sm font-semibold text-white">Promedios y horas del mes</p>
          </div>
        </div>

        <div className="mt-5">
          <CentralRankingGrid cards={central.monthlyRankingCards} />
        </div>
      </section>

      <CentralSectionDivider />
      <section>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
              Rankings anuales
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Resumen del año</h3>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Corte
            </p>
            <p className="mt-2 text-sm font-semibold text-white">Acumulado anual</p>
          </div>
        </div>

        <div className="mt-5">
          <CentralRankingGrid cards={central.yearlyRankingCards} />
        </div>
      </section>

      <CentralSectionDivider />
      <section>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
              Pilotos volando
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Operación viva</h3>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Tráfico activo
            </p>
            <p className="mt-2 text-sm font-semibold text-white">{formatInteger(central.activeFlights.length)} movimiento(s)</p>
          </div>
        </div>

        <div className="mt-5">
          <CentralFlightsTable
            rows={central.activeFlights}
            emptyLabel="Aún no hay pilotos volando en esta lectura del panel."
            variant="active"
          />
        </div>
      </section>

      <CentralSectionDivider />
      <section>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
              Últimos 20 vuelos
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Historial reciente</h3>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Últimos cierres
            </p>
            <p className="mt-2 text-sm font-semibold text-white">{formatInteger(central.recentFlights.length)} registro(s)</p>
          </div>
        </div>

        <div className="mt-5">
          <CentralFlightsTable
            rows={central.recentFlights}
            emptyLabel="Todavía no hay vuelos recientes para mostrar."
            variant="recent"
          />
        </div>
      </section>
    </div>
  );
}

function DispatchOverviewHeader({
  central,
  metar,
}: {
  central: CentralOverview;
  metar: DispatchMetarSummary;
}) {
  const { resolvedImageUrl } = useResolvedAirportHero(central);
  const backgroundStyle = resolvedImageUrl
    ? { backgroundImage: `url(${resolvedImageUrl})` }
    : undefined;

  return (
    <div className="grid gap-5 border-b border-white/8 pb-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
      <div className="relative overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(6,22,44,0.88),rgba(4,15,30,0.96))] px-6 py-8 text-center sm:px-8 sm:py-10">
        {backgroundStyle ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={backgroundStyle}
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,14,28,0.18),rgba(4,12,24,0.86))]" />

        <div className="relative z-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
            Workspace Dispatch
          </p>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-[52px]">
            Centro de Despachos
          </h3>
          <p className="mx-auto mt-5 max-w-4xl text-base leading-8 text-white/76 sm:text-[18px]">
            Elige tu tipo de vuelo, escoge la aeronave para la cual estas habilitado y, si corresponde,
            confirma itinerario y despacho. Prepara el despacho en SimBrief y revisa que coincida con la web
            antes de enviarlo al ACARS.
          </p>
        </div>
      </div>

      <DispatchAirportBannerCard central={central} metar={metar} imageUrl={resolvedImageUrl} />

      <div className="hidden">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
          Workspace Dispatch
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white sm:text-[28px]">
          Flujo central reutilizando la lógica real del despacho
        </h3>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/72 sm:text-[15px]">
          Dejamos el flujo secuencial y bloqueado. No se puede avanzar al siguiente paso si el actual no está
          elegido o marcado como listo. Así mantenemos orden operativo dentro del dashboard.
        </p>
      </div>

      <div className="hidden rounded-2xl border border-emerald-400/16 bg-emerald-500/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
        Flujo base preservado
      </div>
    </div>
  );
}

function DispatchAirportBannerCard({
  central,
  metar,
  imageUrl,
}: {
  central: CentralOverview;
  metar: DispatchMetarSummary;
  imageUrl: string | null;
}) {
  const flagUrl = getFlagUrl(central.countryCode);
  const backgroundStyle = imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined;

  return (
    <aside className="overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,22,44,0.92),rgba(4,15,30,0.96))] shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
      <div className="relative min-h-[280px] overflow-hidden">
        {backgroundStyle ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center opacity-45"
            style={backgroundStyle}
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,35,0.26),rgba(5,12,24,0.94))]" />

        <div className="relative z-10 flex h-full min-h-[280px] flex-col justify-between p-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h4 className="text-[32px] font-semibold tracking-tight text-white">
                {central.municipality}
              </h4>
              {flagUrl ? (
                <img
                  src={flagUrl}
                  alt={`Bandera de ${central.countryName}`}
                  className="h-[18px] w-auto rounded-[2px] object-cover"
                />
              ) : null}
            </div>

            <p className="mt-3 text-lg text-white/80">
              {central.airportCode} - {central.airportName}
            </p>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-[20px] border border-white/10 bg-black/18">
              <div className="grid gap-px bg-white/10 sm:grid-cols-2">
                <div className="bg-[#071526]/86 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                    Estado
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">{metar.condition}</p>
                </div>
                <div className="bg-[#071526]/86 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                    Temp
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">{metar.temperature}</p>
                </div>
                <div className="bg-[#071526]/86 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                    QNH
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">{metar.qnh}</p>
                </div>
                <div className="bg-[#071526]/86 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                    Viento
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">{metar.wind}</p>
                </div>
                <div className="bg-[#071526]/86 px-4 py-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                    Visibilidad
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">{metar.visibility}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[16px] border border-white/10 bg-black/16 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                Hub actual
              </p>
              <p className="mt-2 text-sm leading-7 text-white/80">
                {formatInteger(central.pilotsOnField)} piloto(s) en esta ubicacion
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function DispatchAircraftCascadeSelector({
  rows,
  selectedAircraftId,
  onSelect,
}: {
  rows: AvailableAircraftOption[];
  selectedAircraftId: string | null;
  onSelect: (aircraftId: string) => void;
}) {
  const available = useMemo(() => rows.filter((r) => r.selectable), [rows]);

  // modelCode = aircraft_model_code (e.g. "C208", "A320") — agrupador real del Step 1
  // variantKey = aircraft_type_code (e.g. "C208_BLACKSQUARE") — agrupador del Step 2
  const [selModelCode, setSelModelCode] = useState<string>("");
  const [selVariantKey, setSelVariantKey] = useState<string>("");

  // Sync cascade state when external selectedAircraftId changes
  useEffect(() => {
    if (!selectedAircraftId) return;
    const found = available.find((r) => r.aircraft_id === selectedAircraftId);
    if (found) {
      setSelModelCode(found.aircraft_variant_code?.trim() || found.aircraft_code);
      setSelVariantKey(found.aircraft_type_code?.trim() || "");
    }
  }, [selectedAircraftId, available]);

  // Step 1: modelos únicos agrupados por aircraft_model_code (B737, C208, A320…)
  const uniqueModels = useMemo(() => {
    const seen = new Map<string, string>(); // modelCode → displayName
    for (const r of available) {
      // aircraft_variant_code en la BD contiene el model_code (e.g. "C208")
      const modelKey = r.aircraft_variant_code?.trim() || r.aircraft_code;
      if (modelKey && !seen.has(modelKey)) {
        seen.set(modelKey, r.aircraft_name || modelKey);
      }
    }
    return Array.from(seen.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [available]);

  // Deriva el nombre del addon desde aircraft_type_code si addon_provider está vacío
  // Ej: "B737_PMDG" → "PMDG" | "C208_BLACKSQUARE" → "Black Square" | "ATR72_MSFS" → "Estándar"
  const deriveAddonLabel = (typeCode: string | undefined | null): string => {
    if (!typeCode) return "Estándar";
    const suffix = typeCode.split("_").pop()?.toUpperCase() ?? "";
    const addonMap: Record<string, string> = {
      PMDG: "PMDG",
      FENIX: "Fenix",
      BLACKSQUARE: "Black Square",
      FBW: "FlyByWire (A32NX)",
      IFLY: "iFly",
      HORIZONS: "Horizons",
      MADDOG: "Leonardo MadDog",
      HEADWIND: "Headwind",
      FLIGHTSIM: "FlightSim Studio",
      LVFR: "LVFR",
      MSFS: "Estándar",
      NATIVE: "Estándar",
    };
    return addonMap[suffix] ?? suffix;
  };

  // Step 2: variantes únicas (aircraft_type_code) para el modelo seleccionado
  const uniqueVariants = useMemo(() => {
    if (!selModelCode) return [];
    // key → { addonLabel, displayName }
    const seen = new Map<string, { addonLabel: string; displayName: string }>();
    for (const r of available.filter(
      (r) => (r.aircraft_variant_code?.trim() || r.aircraft_code) === selModelCode
    )) {
      const key = r.aircraft_type_code?.trim() || "__none__";
      // Preferir addon_provider → variant_name → derivar de aircraft_type_code
      const addonLabel =
        r.addon_provider?.trim() ||
        r.variant_name?.trim() ||
        deriveAddonLabel(r.aircraft_type_code);
      const displayName = r.aircraft_name?.trim() || addonLabel;
      if (!seen.has(key)) seen.set(key, { addonLabel, displayName });
    }
    // Si hay varias entradas con el mismo addon (ej. B737-600 y B737-700 ambos "PMDG"),
    // usar el displayName del avión para diferenciarlas
    const addonCounts = new Map<string, number>();
    for (const { addonLabel } of seen.values())
      addonCounts.set(addonLabel, (addonCounts.get(addonLabel) ?? 0) + 1);
    return Array.from(seen.entries())
      .map(([key, { addonLabel, displayName }]) => ({
        key,
        label: (addonCounts.get(addonLabel) ?? 0) > 1 ? displayName : addonLabel,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [available, selModelCode]);

  // Auto-select variant when only one option available
  useEffect(() => {
    if (selModelCode && uniqueVariants.length === 1 && !selVariantKey) {
      setSelVariantKey(uniqueVariants[0].key);
    }
  }, [selModelCode, uniqueVariants, selVariantKey]);

  // Step 3: matrículas disponibles para modelo + variante seleccionada
  // Matrículas: filtra por modelo; variante es opcional y solo pre-filtra la lista
  const registrations = useMemo(() => {
    if (!selModelCode) return [];
    return available.filter((r) => {
      const modelKey = r.aircraft_variant_code?.trim() || r.aircraft_code;
      if (modelKey !== selModelCode) return false;
      // Si hay variante elegida, filtra; si no, muestra todas las del modelo
      if (selVariantKey) {
        const varKey = r.aircraft_type_code?.trim() || "__none__";
        return varKey === selVariantKey;
      }
      return true;
    });
  }, [available, selModelCode, selVariantKey]);

  // Auto-select registration when only one option available
  useEffect(() => {
    if (registrations.length === 1 && selectedAircraftId !== registrations[0].aircraft_id) {
      onSelect(registrations[0].aircraft_id);
    }
  }, [registrations, selectedAircraftId, onSelect]);

  // Cuando se selecciona matrícula, sincronizar variante con su aircraft_type_code
  useEffect(() => {
    if (!selectedAircraftId) return;
    const found = available.find((r) => r.aircraft_id === selectedAircraftId);
    if (found && !selVariantKey) {
      const key = found.aircraft_type_code?.trim() || "__none__";
      if (key !== "__none__") setSelVariantKey(key);
    }
  }, [selectedAircraftId, available, selVariantKey]);

  // Si cambió el modelo o la variante y la matrícula ya no pertenece a la lista visible, limpiarla.
  useEffect(() => {
    if (!selectedAircraftId) return;
    const stillVisible = registrations.some((r) => r.aircraft_id === selectedAircraftId);
    if (!stillVisible) {
      onSelect("");
    }
  }, [registrations, selectedAircraftId, onSelect]);

  const selectedReg = useMemo(
    () => available.find((r) => r.aircraft_id === selectedAircraftId) ?? null,
    [available, selectedAircraftId]
  );

  const handleModelChange = (code: string) => {
    setSelModelCode(code);
    setSelVariantKey("");
    onSelect("");
  };

  if (available.length === 0) {
    return (
      <div className="rounded-[16px] border border-white/8 bg-white/[0.03] px-5 py-8 text-center text-sm text-white/54">
        No hay aeronaves disponibles en este aeropuerto para esta etapa.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {/* 1 · Tipo de aeronave (modelo) */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/54">
            1 · Tipo de aeronave
          </label>
          <select
            value={selModelCode}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full rounded-[12px] border border-white/12 bg-[#031428] px-4 py-3 text-sm text-white focus:border-sky-400/60 focus:outline-none"
          >
            <option value="">— Elige tipo —</option>
            {uniqueModels.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* 2 · N° de registro */}
        <div className="flex flex-col gap-2">
          <label
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
              selModelCode ? "text-white/54" : "text-white/24"
            }`}
          >
            2 · N° de registro
          </label>
          <select
            value={selectedAircraftId ?? ""}
            onChange={(e) => {
              if (e.target.value) onSelect(e.target.value);
            }}
            disabled={!selModelCode}
            className="w-full rounded-[12px] border border-white/12 bg-[#031428] px-4 py-3 text-sm text-white focus:border-sky-400/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-36"
          >
            <option value="">— Elige matrícula —</option>
            {registrations.map((r) => (
              <option key={r.aircraft_id} value={r.aircraft_id}>
                {r.tail_number}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resumen de aeronave seleccionada */}
      {selectedReg ? (
        <>
          <div className="flex items-center gap-3 rounded-[14px] border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-3">
            <span className="text-lg text-emerald-300">✓</span>
            <div>
              <p className="text-sm font-semibold text-emerald-100">
                {selectedReg.tail_number} · {selectedReg.aircraft_name}
              </p>
              {(selectedReg.addon_provider || selectedReg.variant_name) && (
                <p className="mt-0.5 text-xs text-emerald-200/70">
                  {selectedReg.addon_provider || selectedReg.variant_name}
                </p>
              )}
            </div>
          </div>

          <AircraftHealthPanel aircraft={selectedReg} />
        </>
      ) : null}
    </div>
  );
}

function normalizeDispatchAircraftCode(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
}

function getDispatchAircraftCompatibilityCode(value: string | null | undefined) {
  const normalized = normalizeDispatchAircraftCode(value);
  if (!normalized) {
    return "";
  }

  const aliases: Array<[string, string]> = [
    ["C208", "C208"],
    ["TBM8", "TBM9"],
    ["TBM9", "TBM9"],
    ["BE58", "BE58"],
    ["B350", "B350"],
    ["AT76", "ATR72"],
    ["ATR72", "ATR72"],
    ["E175", "E175"],
    ["E190", "E190"],
    ["E195", "E195"],
    ["A319", "A319"],
    ["A20N", "A20N"],
    ["A320", "A320"],
    ["A21N", "A21N"],
    ["A321", "A321"],
    ["B736", "B737"],
    ["B737", "B737"],
    ["B738", "B738"],
    ["B739", "B739"],
    ["B38M", "B38M"],
    ["MD82", "MD82"],
    ["MD83", "MD83"],
    ["MD88", "MD88"],
    ["B78X", "B78X"],
    ["B789", "B789"],
    ["A339", "A339"],
    ["B77W", "B77W"],
    ["B772", "B772"],
    ["A359", "A359"],
  ];

  for (const [prefix, canonical] of aliases) {
    if (normalized.startsWith(prefix)) {
      return canonical;
    }
  }

  return normalized;
}

function mapDispatchFlightTypeToMode(value: DispatchFlightTypeId | null): FlightMode | null {
  switch (value) {
    case "career":
      return "itinerary";
    case "charter":
      return "charter";
    case "training":
    case "qualification":
      return "training";
    case "event":
    case "special_mission":
      return "event";
    case "free_flight":
      return "charter";
    default:
      return null;
  }
}

const LOW_RANK_ROUTE_LIMIT_CODES = new Set([
  "CADET",
  "CADETE",
  "STUDENT",
  "ALUMNO",
  "TRAINEE",
  "PILOT_CADET",
  "CADET_ADVANCED",
  "CADETE_AVANZADO",
  "RANK_1",
  "RANK_2",
  "R1",
  "R2",
  "SECOND_OFFICER",
  "SEGUNDO_OFICIAL",
  "JUNIOR_FIRST_OFFICER",
  "FIRST_OFFICER_JUNIOR",
  "PRIMER_OFICIAL_JUNIOR",
  "JFO",
  "SO",
]);

const LOW_RANK_ALLOWED_ROUTE_CATEGORIES = new Set(["regional", "national"]);

function normalizeDispatchRankCode(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
}

function getAllowedRouteCategoriesForPilot(profile: PilotProfileRecord | null) {
  const rankCode = normalizeDispatchRankCode(profile?.career_rank_code ?? profile?.rank_code);

  if (!rankCode) {
    return null;
  }

  return LOW_RANK_ROUTE_LIMIT_CODES.has(rankCode) ? LOW_RANK_ALLOWED_ROUTE_CATEGORIES : null;
}

function normalizeItineraryRouteCategory(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";

  if (!normalized) {
    return "";
  }

  if (["regional", "local", "local_regional", "feeder", "school_local", "domestic_chile", "domestic_argentina", "transborder_patagonia", "core"].includes(normalized)) {
    return "regional";
  }

  if (["national", "domestic", "interregional", "inter_regional", "interregional_national", "trunk"].includes(normalized)) {
    return "national";
  }

  if (["international", "internacional", "south_america_regional"].includes(normalized)) {
    return "international";
  }

  if (["longhaul", "long_haul", "ultra_long", "ultra_long_haul", "continental_longhaul", "heavy", "premium"].includes(normalized)) {
    return "long_haul";
  }

  if (["intercontinental", "inter_continental", "transoceanic"].includes(normalized)) {
    return "intercontinental";
  }

  return normalized;
}

function getItineraryRouteCategory(item: AvailableItineraryOption) {
  const directCategory = normalizeItineraryRouteCategory(
    (item as AvailableItineraryOption & { route_category?: string | null }).route_category
  );

  if (directCategory) {
    return directCategory;
  }

  for (const raw of [item.service_profile, item.route_group, item.service_level, item.flight_mode]) {
    const category = normalizeItineraryRouteCategory(raw);
    if (category) {
      return category;
    }
  }

  return "";
}


function formatEconomyUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("es-CL", { maximumFractionDigits: 0 })} USD`;
}

function buildEconomyEstimate({
  distanceNm,
  aircraftTypeCode,
  mode = "CAREER",
  originIcao,
  destinationIcao,
  originCountry,
  destinationCountry,
  operationCategory,
}: {
  distanceNm: number | null | undefined;
  aircraftTypeCode?: string | null;
  mode?: "CAREER" | "CHARTER";
  originIcao?: string | null;
  destinationIcao?: string | null;
  originCountry?: string | null;
  destinationCountry?: string | null;
  operationCategory?: string | null;
}) {
  if (!distanceNm || distanceNm <= 0) return null;
  return estimateFlightEconomy({
    distanceNm,
    aircraftTypeCode: aircraftTypeCode ?? "A320",
    operationType: mode,
    originIcao,
    destinationIcao,
    originCountry,
    destinationCountry,
    operationCategory,
  });
}

function EconomyMiniGrid({
  distanceNm,
  aircraftTypeCode,
  mode = "CAREER",
  originIcao,
  destinationIcao,
  originCountry,
  destinationCountry,
  operationCategory,
}: {
  distanceNm: number | null | undefined;
  aircraftTypeCode?: string | null;
  mode?: "CAREER" | "CHARTER";
  originIcao?: string | null;
  destinationIcao?: string | null;
  originCountry?: string | null;
  destinationCountry?: string | null;
  operationCategory?: string | null;
}) {
  const estimate = buildEconomyEstimate({ distanceNm, aircraftTypeCode, mode, originIcao, destinationIcao, originCountry, destinationCountry, operationCategory });
  if (!estimate) {
    return (
      <div className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4 text-sm text-white/50">
        Economía estimada no disponible para esta combinación.
      </div>
    );
  }

  const values = [
    { label: "💵 Piloto", value: formatEconomyUsd(estimate.pilotCommissionUsd), tone: "text-emerald-100" },
    { label: "👥 Pax", value: estimate.estimatedPassengers.toLocaleString("es-CL"), tone: "text-white/82" },
    { label: "📦 Carga", value: String(estimate.estimatedCargoKg.toLocaleString("es-CL")) + " kg", tone: "text-white/82" },
    { label: "🏢 Aerolínea", value: formatEconomyUsd(estimate.airlineRevenueUsd), tone: "text-cyan-100" },
    { label: "⛽ Combustible", value: formatEconomyUsd(estimate.fuelCostUsd), tone: "text-amber-100" },
    { label: "🛠 Mantención", value: formatEconomyUsd(estimate.maintenanceCostUsd), tone: "text-white/82" },
    { label: "🧾 Operación", value: formatEconomyUsd(estimate.airportFeesUsd + estimate.handlingCostUsd + estimate.repairReserveUsd + estimate.onboardServiceCostUsd), tone: "text-white/82" },
    { label: "🛍 Ventas", value: formatEconomyUsd(estimate.onboardServiceRevenueUsd + estimate.onboardSalesRevenueUsd), tone: "text-cyan-100" },
    { label: "📈 Utilidad", value: formatEconomyUsd(estimate.netProfitUsd), tone: estimate.netProfitUsd >= 0 ? "text-emerald-100" : "text-rose-100" },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {values.map((item) => (
        <div key={item.label} className="rounded-[16px] border border-white/8 bg-white/[0.035] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">{item.label}</p>
          <p className={`mt-1 text-sm font-black ${item.tone}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function DispatchItineraryTable({
  rows,
  selectedItineraryId,
  onSelect,
  airportsByIcao,
  currentAirportCode,
  currentAirportCity,
  currentCountryCode,
  selectedAircraftTypeCode,
  departureHHMM,
  onDepartureTimeChange,
}: {
  rows: AvailableItineraryOption[];
  selectedItineraryId: string | null;
  onSelect: (itineraryId: string) => void;
  airportsByIcao: Record<string, ItineraryAirportMeta>;
  currentAirportCode: string;
  currentAirportCity: string;
  currentCountryCode: string;
  selectedAircraftTypeCode?: string | null;
  departureHHMM: string;
  onDepartureTimeChange: (hhmm: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/78">
          <thead className="bg-white/[0.04] text-[11px] uppercase tracking-[0.18em] text-white/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Origen</th>
              <th className="px-4 py-3 font-semibold">Destino</th>
              <th className="px-4 py-3 font-semibold">Distancia</th>
              <th className="px-4 py-3 font-semibold">Duracion aprox.</th>
              <th className="px-4 py-3 font-semibold">Economía</th>
              <th className="px-4 py-3 font-semibold">Salida (local)</th>
              <th className="px-4 py-3 font-semibold text-right">Accion</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const isSelected = selectedItineraryId === row.itinerary_id;
              const originCode = row.origin_icao.trim().toUpperCase();
              const destinationCode = row.destination_icao.trim().toUpperCase();
              const rowKey = [
                row.itinerary_id,
                row.itinerary_code,
                row.flight_number,
                row.flight_designator,
                row.aircraft_type_code,
                row.compatible_aircraft_types?.join("_"),
                originCode,
                destinationCode,
                index,
              ]
                .filter(Boolean)
                .join("-");
              const originAirport = airportsByIcao[originCode];
              const destinationAirport = airportsByIcao[destinationCode];
              const originCity = getOriginCityLabel(
                row,
                originAirport,
                currentAirportCode,
                currentAirportCity,
              );
              const destinationCity = getDestinationCityLabel(row, destinationAirport);
              const originCountryCode = resolveCountryCode(
                originAirport?.iso_country ??
                  row.origin_country ??
                  (originCode === currentAirportCode.trim().toUpperCase() ? currentCountryCode : null),
                originCode,
              );
              const destinationCountryCode = resolveCountryCode(
                destinationAirport?.iso_country ?? row.destination_country,
                destinationCode,
              );
              const originFlagUrl = getFlagUrl(originCountryCode);
              const destinationFlagUrl = getFlagUrl(destinationCountryCode);
              const rawDistance = Number(row.distance_nm);
              const distanceNm =
                Number.isFinite(rawDistance) && rawDistance > 0
                  ? Math.round(rawDistance)
                  : calculateDistanceNm(originAirport, destinationAirport);
              const durationCandidate = [
                row.scheduled_block_min,
                row.expected_block_p50,
                row.expected_block_p80,
              ]
                .map((value) => Number(value))
                .find((value) => Number.isFinite(value) && value > 0);

              // Use DB value when available; otherwise estimate from distance + aircraft type
              const estimatedMinutes = distanceNm
                ? estimateBlockMinutes(distanceNm, selectedAircraftTypeCode)
                : 0;
              const resolvedDuration = durationCandidate ?? (estimatedMinutes > 0 ? estimatedMinutes : null);

              return (
                <tr
                  key={rowKey}
                  className={`border-t border-white/8 align-middle transition ${
                    isSelected ? "bg-emerald-500/[0.08]" : ""
                  }`}
                >
                  {/* ORIGEN */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-sm font-bold tracking-[0.08em] text-white">
                        {originCode || "---"}
                      </span>
                      {originFlagUrl ? (
                        <img
                          src={originFlagUrl}
                          alt={`Bandera ${originCountryCode ?? originCode}`}
                          className="h-[13px] w-[17px] rounded-[2px] object-cover"
                        />
                      ) : null}
                      <span className="text-sm text-white/60 truncate max-w-[140px]">{originCity}</span>
                    </div>
                  </td>
                  {/* DESTINO */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-sm font-bold tracking-[0.08em] text-white">
                        {destinationCode || "---"}
                      </span>
                      {destinationFlagUrl ? (
                        <img
                          src={destinationFlagUrl}
                          alt={`Bandera ${destinationCountryCode ?? destinationCode}`}
                          className="h-[13px] w-[17px] rounded-[2px] object-cover"
                        />
                      ) : null}
                      <span className="text-sm text-white/60 truncate max-w-[140px]">{destinationCity}</span>
                    </div>
                  </td>
                  {/* DISTANCIA */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-semibold text-white">
                      {distanceNm ? `${distanceNm} NM` : "—"}
                    </span>
                  </td>
                  {/* DURACION */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-semibold text-white">
                      {formatDurationMinutes(resolvedDuration)}
                    </span>
                    {!durationCandidate && estimatedMinutes > 0 ? (
                      <span className="ml-1 text-[11px] text-white/40">~est.</span>
                    ) : null}
                  </td>
                  {/* ECONOMIA */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      const estimate = buildEconomyEstimate({
                        distanceNm,
                        aircraftTypeCode: selectedAircraftTypeCode,
                        mode: "CAREER",
                        originIcao: originCode,
                        destinationIcao: destinationCode,
                        originCountry: originCountryCode,
                        destinationCountry: destinationCountryCode,
                        operationCategory: getItineraryRouteCategory(row),
                      });
                      return estimate ? (
                        <div className="text-xs leading-5">
                          <p className="font-black text-emerald-100">💵 {formatEconomyUsd(estimate.pilotCommissionUsd)}</p>
                          <p className="font-semibold text-cyan-100/80">📈 {formatEconomyUsd(estimate.netProfitUsd)}</p>
                        </div>
                      ) : (
                        <span className="text-white/38">—</span>
                      );
                    })()}
                  </td>
                  {/* HORA DE SALIDA */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={departureHHMM}
                      onChange={(e) => onDepartureTimeChange(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-xl border border-white/12 bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-white outline-none focus:border-emerald-400/60 focus:ring-0 cursor-pointer"
                      aria-label="Hora de salida local"
                    >
                      {DEPARTURE_TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0a1628] text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  {/* ACCION */}
                  <td className="px-4 py-3 min-w-[170px] text-right">
                    <button
                      type="button"
                      onClick={() => onSelect(row.itinerary_id)}
                      className={`inline-flex w-full items-center justify-center rounded-2xl border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                        isSelected
                          ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-100"
                          : "border-white/10 bg-white/[0.04] text-white/76 hover:bg-white/[0.08]"
                      }`}
                    >
                      {isSelected ? "Seleccionado" : "Seleccionar"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-white/54">
                  No hay itinerarios disponibles para la aeronave y modo de vuelo seleccionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DispatchValueCard({
  label,
  value,
  hint,
  valueClassName,
  hintClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
  hintClassName?: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-5 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/44">{label}</p>
      <p className={`mt-3 text-[1.7rem] font-semibold leading-none tracking-tight text-white ${valueClassName ?? ""}`}>
        {value}
      </p>
      {hint ? (
        <p className={`mt-3 text-[15px] leading-6 text-white/62 ${hintClassName ?? ""}`}>{hint}</p>
      ) : null}
    </div>
  );
}

function DispatchLocationCard({
  label,
  icao,
  city,
  countryCode,
}: {
  label: string;
  icao: string;
  city: string;
  countryCode?: string | null;
}) {
  const resolvedCountryCode = resolveCountryCode(countryCode, icao);
  const flagUrl = getFlagUrl(resolvedCountryCode);

  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-5 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/44">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[1.7rem] font-semibold leading-none tracking-[0.12em] text-white">
          {icao || "---"}
        </span>
        {flagUrl ? (
          <img
            src={flagUrl}
            alt={`Bandera ${resolvedCountryCode ?? icao}`}
            className="h-[18px] w-[26px] rounded-[3px] object-cover"
          />
        ) : null}
      </div>
      <p className="mt-3 text-[15px] leading-6 text-white/68">{city || "Pendiente"}</p>
    </div>
  );
}

function DispatchWideValueStrip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/44">{label}</p>
      <p className="mt-3 text-xl font-bold leading-7 tracking-[0.06em] text-white">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-6 text-white/58">{hint}</p> : null}
    </div>
  );
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function RouteAircraftSideIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="22" fill="rgba(103,215,255,0.13)" stroke="rgba(103,215,255,0.38)" strokeWidth="1.5" />
      <path d="M24 7.5c1.4 0 2.55 1.15 2.55 2.55v9.25l12.15 7.4c.55.34.9.94.9 1.6v2.45c0 .72-.72 1.22-1.4.96l-11.65-4.53v7.9l4.35 3.18c.38.28.6.72.6 1.18v1.56c0 .64-.6 1.1-1.22.94L24 40.28l-6.28 1.66c-.62.16-1.22-.3-1.22-.94v-1.56c0-.46.22-.9.6-1.18l4.35-3.18v-7.9L9.8 31.71c-.68.26-1.4-.24-1.4-.96V28.3c0-.66.35-1.26.9-1.6l12.15-7.4v-9.25C21.45 8.65 22.6 7.5 24 7.5Z" fill="url(#office-plane-gradient)" />
      <path d="M24 9.8v29" stroke="rgba(4,18,33,0.42)" strokeWidth="1.2" strokeLinecap="round" />
      <defs><linearGradient id="office-plane-gradient" x1="11" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFFFF" /><stop offset="0.45" stopColor="#9DEBFF" /><stop offset="1" stopColor="#38BDF8" /></linearGradient></defs>
    </svg>
  );
}

function formatAircraftHealthPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Sin diagnóstico";
  }
  return `${Math.round(value)}%`;
}

function getAircraftHealthTone(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "var(--health-neutral)";
  }
  if (value < 25) return "var(--health-red)";
  if (value < 50) return "var(--health-amber)";
  return "var(--health-green)";
}

function AircraftHealthBar({
  label,
  value,
}: {
  label: string;
  value?: number | null;
}) {
  const width = typeof value === "number" && !Number.isNaN(value)
    ? `${Math.max(0, Math.min(100, value))}%`
    : "0%";
  const tone = getAircraftHealthTone(value);
  const hasValue = typeof value === "number" && !Number.isNaN(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/56">
          {label}
        </span>
        <span className="text-xs font-semibold text-white/78">{formatAircraftHealthPercent(value)}</span>
      </div>
      <div className="aircraft-health-track">
        <div
          className="aircraft-health-fill"
          style={{ width, background: tone, opacity: hasValue ? 1 : 0.35 }}
        />
      </div>
    </div>
  );
}

function AircraftHealthPanel({
  aircraft,
}: {
  aircraft: AvailableAircraftOption;
}) {
  const maintenanceLabel =
    aircraft.maintenance_required
      ? aircraft.condition_band === "out_of_service"
        ? "Fuera de servicio"
        : "Mantenimiento requerido"
      : aircraft.condition_band === "warning"
        ? "Revisión sugerida"
        : "Disponible";

  const maintenanceTone = aircraft.maintenance_required
    ? "border-amber-300/25 bg-amber-500/[0.08] text-amber-100"
    : "border-emerald-300/20 bg-emerald-500/[0.08] text-emerald-100";

  return (
    <div className="mt-4 rounded-[18px] border border-white/8 bg-[#031428]/58 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/48">
          Salud de la aeronave
        </p>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${maintenanceTone}`}>
          {maintenanceLabel}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <AircraftHealthBar label="Motor" value={aircraft.engine_health} />
        <AircraftHealthBar label="Fuselaje" value={aircraft.fuselage_health} />
        <AircraftHealthBar label="Tren" value={aircraft.gear_health} />
      </div>
    </div>
  );
}


function parseTrainingAircraftProgressRow(row: Record<string, unknown>): TrainingAircraftProgress | null {
  const code =
    typeof row.aircraft_type_code === "string"
      ? row.aircraft_type_code.trim().toUpperCase()
      : typeof row.aircraft_code === "string"
        ? row.aircraft_code.trim().toUpperCase()
        : "";

  if (!code) {
    return null;
  }

  const totalHours = toSafeNumber(row.total_hours);
  const schoolAircraft = isTrainingSchoolAircraft(code);
  const minHours = schoolAircraft ? 0 : toSafeNumber(row.min_hours_required) || TRAINING_MIN_AIRCRAFT_HOURS;

  return {
    aircraft_type_code: code,
    display_name:
      typeof row.display_name === "string" && row.display_name.trim()
        ? row.display_name.trim()
        : normalizeAircraftDisplayName(code),
    family_code:
      typeof row.family_code === "string" && row.family_code.trim()
        ? row.family_code.trim().toUpperCase()
        : code.split("_")[0] || null,
    total_hours: totalHours,
    training_flights: Math.max(0, Math.round(toSafeNumber(row.training_flights))),
    last_training_at: typeof row.last_training_at === "string" ? row.last_training_at : null,
    min_hours_required: minHours,
    checkride_available: schoolAircraft
      ? true
      : typeof row.checkride_available === "boolean"
        ? row.checkride_available
        : totalHours >= minHours,
    image_path:
      typeof row.image_path === "string" && row.image_path.trim()
        ? row.image_path.trim()
        : typeof row.image_url === "string" && row.image_url.trim()
          ? row.image_url.trim()
          : typeof row.photo_path === "string" && row.photo_path.trim()
            ? row.photo_path.trim()
            : null,
  };
}

async function loadTrainingAircraftProgress(profile: PilotProfileRecord | null) {
  if (!profile?.callsign?.trim()) {
    return [] as TrainingAircraftProgress[];
  }

  try {
    const { data, error } = await supabase.rpc("pw_list_training_aircraft_progress", {
      p_callsign: profile.callsign.trim().toUpperCase(),
    });

    if (!error && Array.isArray(data)) {
      return data
        .map((row) => parseTrainingAircraftProgressRow(row as Record<string, unknown>))
        .filter((row): row is TrainingAircraftProgress => Boolean(row))
        .sort((a, b) => a.display_name.localeCompare(b.display_name, "es"));
    }
  } catch (error) {
    console.warn("No se pudo cargar progreso de entrenamiento por RPC:", error);
  }

  try {
    const { data, error } = await supabase
      .from("aircraft_fleet")
      .select("aircraft_type")
      .limit(500);

    if (!error && Array.isArray(data)) {
      const uniqueCodes = Array.from(
        new Set(
          data
            .map((row) => (typeof row.aircraft_type === "string" ? row.aircraft_type.trim().toUpperCase() : ""))
            .filter(Boolean),
        ),
      );

      return uniqueCodes
        .map((code) => ({
          aircraft_type_code: code,
          display_name: normalizeAircraftDisplayName(code),
          family_code: code.split("_")[0] || null,
          total_hours: 0,
          training_flights: 0,
          last_training_at: null,
          min_hours_required: isTrainingSchoolAircraft(code) ? 0 : TRAINING_MIN_AIRCRAFT_HOURS,
          checkride_available: isTrainingSchoolAircraft(code),
          image_path: null,
        }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name, "es"));
    }
  } catch (error) {
    console.warn("No se pudo cargar fallback de aeronaves para entrenamiento:", error);
  }

  return [] as TrainingAircraftProgress[];
}

function formatTrainingDate(value: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}


type TrainingReservationRpcRow = {
  ok?: boolean | null;
  reservation_id?: string | null;
  route_code?: string | null;
  flight_number?: string | null;
  error?: string | null;
};

type TrainingFinalizeRpcRow = {
  ok?: boolean | null;
  reservation_id?: string | null;
  route_code?: string | null;
  flight_number?: string | null;
  dispatch_status?: string | null;
  error?: string | null;
};

function TrainingIcaoInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [airportLabel, setAirportLabel] = useState("");
  const [isLoadingAirport, setIsLoadingAirport] = useState(false);
  const normalizedValue = normalizeTrainingIcao(value);

  useEffect(() => {
    let isActive = true;

    if (normalizedValue.length !== 4) {
      setAirportLabel("");
      setIsLoadingAirport(false);
      return () => {
        isActive = false;
      };
    }

    setIsLoadingAirport(true);

    void Promise.resolve(
      supabase
        .from("airports")
        .select("ident, name, municipality, iso_country")
        .eq("ident", normalizedValue)
        .maybeSingle(),
    )
      .then(({ data }) => {
        if (!isActive) return;
        const airport = (data ?? null) as AirportRow | null;
        const airportName = airport?.name?.trim() || airport?.municipality?.trim() || "";
        setAirportLabel(
          airportName
            ? `${normalizedValue} · ${airportName}`
            : `${normalizedValue} · aeropuerto no encontrado`,
        );
      })
      .catch(() => {
        if (isActive) {
          setAirportLabel(`${normalizedValue} · no se pudo consultar el aeropuerto`);
        }
      })
      .finally(() => {
        if (isActive) setIsLoadingAirport(false);
      });

    return () => {
      isActive = false;
    };
  }, [normalizedValue]);

  const helperText = normalizedValue.length === 4
    ? isLoadingAirport
      ? `${normalizedValue} · buscando aeropuerto...`
      : airportLabel || `${normalizedValue} · aeropuerto no encontrado`
    : normalizedValue.length > 0
      ? "Completa el ICAO de 4 caracteres."
      : "Ingresa el ICAO del aeropuerto.";

  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
      <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(normalizeTrainingIcao(event.target.value))}
        maxLength={4}
        placeholder="ICAO"
        className="mt-3 w-full rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-lg font-semibold uppercase tracking-[0.16em] text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/45"
      />
      <p className="mt-2 min-h-[18px] text-xs text-white/42">
        {helperText}
      </p>
    </div>
  );
}

function TrainingCheckrideDispatchModal({
  checkride,
  onClose,
}: {
  checkride: TrainingCheckrideCatalogItem | null;
  onClose: () => void;
}) {
  if (!checkride) {
    return null;
  }

  const route = checkride.route ?? {
    origin: "----",
    destination: "----",
    label: "Ruta pendiente",
    remarks: "La ruta especial del checkride todavía no está configurada.",
  };

  const scoring = checkride.scoring ?? {
    maxScore: 100,
    passScore: 85,
    items: ["Evaluación especial pendiente de configuración."],
  };

  const weatherConditions = checkride.weatherConditions ?? {
    ceiling: "Condición de techo pendiente de configuración.",
    visibility: "Condición de visibilidad/RVR pendiente de configuración.",
    wind: "Condición de viento pendiente de configuración.",
    precipitation: "Condición de precipitación/fenómeno pendiente de configuración.",
    qnh: "QNH pendiente de configuración.",
    lockedPreset: "Control de clima pendiente de configuración.",
    operationalFocus: "Objetivo operacional pendiente de configuración.",
  };

  const aircraftOptions = checkride.aircraftOptions ?? [];
  const specialRules = checkride.specialRules ?? [];
  const evaluationCriteria = checkride.evaluationCriteria ?? [];
  const flightPlan = checkride.flightPlan ?? [];
  const routeWaypoints = checkride.routeWaypoints ?? [];
  const aircraftCodes = aircraftOptions.map((option) => option.badge ?? option.aircraft_type_code).join(" / ");

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/76 px-4 py-6 backdrop-blur-[18px]">
      <div className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-cyan-300/16 bg-[#061423]/98 shadow-[0_32px_110px_rgba(0,0,0,0.62)]">
        <div className="relative border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(22,197,193,0.18),transparent_36%),linear-gradient(135deg,#102840,#061423_62%,#03101d)] px-5 py-5 text-white sm:px-7">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
                  Checkride / Habilitación
                </span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
                  {checkride.code}
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">{checkride.title}</h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-white/64">{checkride.introduction}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-fit rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/68 transition hover:bg-white/[0.09] hover:text-white"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <section className="grid gap-4 xl:grid-cols-[1.24fr_0.76fr]">
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="relative h-[300px] w-full overflow-hidden bg-[#071827]">
                <img
                  src={checkride.heroImagePath}
                  alt={checkride.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#061423] via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/70">Condición oficial</p>
                    <p className="mt-1 max-w-2xl text-sm font-semibold leading-5 text-white">{checkride.weatherGoal}</p>
                  </div>
                  <span className="rounded-full border border-white/12 bg-black/32 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/72 backdrop-blur-md">
                    {checkride.presetFile}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-cyan-300/14 bg-cyan-400/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/58">Resumen del checkride</p>
                <div className="mt-4 grid gap-2">
                  <div className="rounded-[16px] border border-white/8 bg-black/16 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/36">Equipo</p>
                    <p className="mt-1 text-lg font-semibold text-white">{aircraftCodes || "Pendiente"}</p>
                  </div>
                  <div className="rounded-[16px] border border-white/8 bg-black/16 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/36">Ruta</p>
                    <p className="mt-1 text-lg font-semibold text-white">{route.origin} → {route.destination}</p>
                    <p className="mt-1 text-xs text-white/46">{route.label}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[16px] border border-white/8 bg-black/16 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/36">Nivel</p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-white">{checkride.recommendedRank}</p>
                    </div>
                    <div className="rounded-[16px] border border-emerald-300/18 bg-emerald-400/10 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/54">Aprobación</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-100">{scoring.passScore}/{scoring.maxScore}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">¿Cómo lo apruebo?</p>
                <p className="mt-3 text-sm leading-6 text-white/62">{checkride.approvalNote}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">Ruta del vuelo</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{route.label}</h3>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/56">{route.remarks}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-4">
              {routeWaypoints.map((point, index) => (
                <div key={`${checkride.code}-wp-${point.ident}-${index}`} className="relative">
                  <div
                    className={`rounded-[18px] border px-4 py-4 ${
                      point.active
                        ? "border-cyan-300/24 bg-cyan-400/12 text-white"
                        : "border-white/8 bg-[#071827]/72 text-white/74"
                    }`}
                  >
                    <p className="font-mono text-xl font-semibold">{point.ident}</p>
                    <p className="mt-1 text-xs text-white/54">{point.label}</p>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">{point.type}</p>
                  </div>
                  {index < routeWaypoints.length - 1 ? (
                    <div className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 text-xl text-cyan-200/45 lg:block">→</div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
            <div className="rounded-[24px] border border-cyan-300/14 bg-cyan-400/[0.05] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/58">Condición climática obligatoria</p>
              <div className="mt-4 grid gap-2">
                {[
                  ["Techo", weatherConditions.ceiling],
                  ["Visibilidad", weatherConditions.visibility],
                  ["Viento", weatherConditions.wind],
                  ["Precipitación", weatherConditions.precipitation],
                  ["QNH", weatherConditions.qnh],
                ].map(([label, value]) => (
                  <div key={`${checkride.code}-weather-${label}`} className="rounded-[15px] border border-white/8 bg-black/16 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/46">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-cyan-50/72">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[16px] border border-amber-300/16 bg-amber-400/[0.07] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/62">Control del clima</p>
                <p className="mt-2 text-xs leading-5 text-amber-50/74">{weatherConditions.lockedPreset}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">Criterios de evaluación</p>
              <div className="mt-4 space-y-3">
                {evaluationCriteria.map((criterion, index) => (
                  <div key={`${checkride.code}-criterion-${index}`} className="rounded-[18px] border border-white/8 bg-[#071827]/72 px-4 py-3">
                    <div className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/24 bg-cyan-400/12 text-xs font-bold text-cyan-100">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-white">{criterion.title}</h4>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-white/58">
                          {criterion.bullets.map((bullet, bulletIndex) => (
                            <li key={`${checkride.code}-criterion-${index}-bullet-${bulletIndex}`}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">Plan de vuelo</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {flightPlan.map((step, index) => (
                <div key={`${checkride.code}-flightplan-${index}`} className="flex gap-3 rounded-[18px] border border-white/8 bg-[#071827]/72 px-4 py-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300/22 bg-emerald-400/12 text-[11px] font-bold text-emerald-100">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/56">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">Opciones oficiales de aeronave</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Selecciona una opción asignada</h3>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/56">
                  Patagonia Wings asigna estas dos opciones para la habilitación. Elegir una u otra no te reprueba; ambas son válidas siempre que uses una de las aeronaves publicadas para este checkride.
                </p>
              </div>
              <div className="rounded-[14px] border border-emerald-300/18 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                Máximo {scoring.maxScore} · aprueba con {scoring.passScore}
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {aircraftOptions.map((aircraft, index) => (
                <div key={`${checkride.code}-aircraft-option-${aircraft.aircraft_type_code}`} className="rounded-[20px] border border-white/8 bg-[#071827]/72 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{aircraft.display_name}</p>
                      <p className="mt-1 text-xs leading-5 text-white/54">{aircraft.requirement}</p>
                    </div>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 font-mono text-[10px] font-semibold text-cyan-100">
                      {aircraft.badge ?? aircraft.aircraft_type_code}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="mt-4 w-full rounded-[14px] border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/38"
                  >
                    Preparar despacho
                  </button>
                  <p className="mt-2 text-[11px] leading-5 text-white/34">Opción oficial {index + 1} para esta habilitación.</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[18px] border border-white/8 bg-black/14 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">Reglas rápidas</p>
              <ul className="mt-3 grid gap-2 text-xs leading-5 text-white/58 md:grid-cols-2">
                {specialRules.map((rule, index) => (
                  <li key={`${checkride.code}-rule-${index}`} className="rounded-[14px] border border-white/8 bg-white/[0.025] px-3 py-2">
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function TrainingTheoryExamModal({
  exam,
  profile,
  latestAttempt,
  onClose,
  onAttemptSaved,
}: {
  exam: TrainingTheoryExam | null;
  profile: PilotProfileRecord | null;
  latestAttempt?: TrainingTheoryAttemptSummary | null;
  onClose: () => void;
  onAttemptSaved: (attempt: TrainingTheoryAttemptSummary) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [examStarted, setExamStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [attemptSaveMessage, setAttemptSaveMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const savedAttemptRef = useRef(false);

  useEffect(() => {
    if (!exam) {
      return;
    }

    setCurrentIndex(0);
    setAnswers({});
    setExamStarted(false);
    setSubmitted(false);
    setSavingAttempt(false);
    setAttemptSaveMessage("");
    setTimeLeft(exam.durationMinutes * 60);
    savedAttemptRef.current = false;
  }, [exam]);

  const questions = exam?.questions ?? [];
  const totalQuestions = questions.length;
  const answeredCount = questions.filter((question) => Boolean(answers[question.id])).length;
  const correctCount = questions.filter((question) => answers[question.id] === question.correctOptionId).length;
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = exam ? scorePercent >= exam.passScore : false;
  const gate = getTheoryAttemptGate(latestAttempt);
  const lockedBeforeStart = gate.locked && !examStarted && !submitted;

  async function submitAttempt() {
    if (!exam || savedAttemptRef.current) {
      return;
    }

    savedAttemptRef.current = true;
    setSubmitted(true);
    setSavingAttempt(true);
    setAttemptSaveMessage("");

    const submittedAt = new Date();
    const nextAvailableAt = passed
      ? null
      : new Date(submittedAt.getTime() + TRAINING_THEORY_RETRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const pilotCallsign = profile?.callsign?.trim().toUpperCase() || "";
    const attempt: TrainingTheoryAttemptSummary = {
      exam_code: exam.code,
      status: passed ? "passed" : "failed",
      score_percent: scorePercent,
      correct_count: correctCount,
      total_questions: totalQuestions,
      submitted_at: submittedAt.toISOString(),
      next_available_at: nextAvailableAt,
    };

    if (pilotCallsign) {
      writeStoredTheoryAttempt(pilotCallsign, attempt);
    }

    onAttemptSaved(attempt);

    try {
      if (pilotCallsign) {
        const { error } = await supabase.from("pw_pilot_theory_exam_attempts").insert({
          pilot_callsign: pilotCallsign,
          exam_code: exam.code,
          status: attempt.status,
          score_percent: attempt.score_percent,
          correct_count: attempt.correct_count,
          total_questions: attempt.total_questions,
          submitted_at: attempt.submitted_at,
          next_available_at: attempt.next_available_at,
          answers,
        });

        if (error) {
          setAttemptSaveMessage("Resultado guardado localmente. Ejecuta el SQL de teóricas para guardarlo también en Supabase.");
        } else {
          setAttemptSaveMessage("Resultado guardado correctamente en Supabase.");
        }
      } else {
        setAttemptSaveMessage("Resultado calculado. No se detectó callsign para guardarlo en Supabase.");
      }
    } catch {
      setAttemptSaveMessage("Resultado guardado localmente. Supabase no respondió para registrar el intento.");
    } finally {
      setSavingAttempt(false);
    }
  }

  useEffect(() => {
    if (!exam || !examStarted || submitted || timeLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [exam, examStarted, submitted, timeLeft]);

  useEffect(() => {
    if (!exam || !examStarted || submitted || timeLeft > 0) {
      return;
    }

    void submitAttempt();
  }, [exam, examStarted, submitted, timeLeft]);

  if (!exam) {
    return null;
  }

  const currentQuestion = questions[currentIndex] ?? questions[0];
  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");
  const canFinish = answeredCount === totalQuestions;
  const minimumCorrect = Math.ceil((exam.passScore / 100) * totalQuestions);

  const setAnswer = (questionId: string, optionId: string) => {
    if (submitted || !examStarted) {
      return;
    }

    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  };

  const startExam = () => {
    if (lockedBeforeStart || totalQuestions === 0) {
      return;
    }

    setCurrentIndex(0);
    setAnswers({});
    setSubmitted(false);
    setAttemptSaveMessage("");
    setTimeLeft(exam.durationMinutes * 60);
    savedAttemptRef.current = false;
    setExamStarted(true);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-black/82 px-4 py-6 backdrop-blur-[18px]">
      <div className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-violet-300/16 bg-[#061423]/98 shadow-[0_32px_110px_rgba(0,0,0,0.66)]">
        <div className="relative border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_34%),linear-gradient(135deg,#16233b,#061423_62%,#030d18)] px-5 py-5 text-white sm:px-7">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-300/34 to-transparent" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-100">
                  Evaluación teórica
                </span>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                  {exam.code}
                </span>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                  timeLeft <= 180 && examStarted && !submitted
                    ? "border-amber-300/28 bg-amber-400/12 text-amber-100"
                    : "border-white/12 bg-white/[0.05] text-white/70"
                }`}>
                  Tiempo {minutes}:{seconds}
                </span>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                  gate.tone === "passed"
                    ? "border-emerald-300/24 bg-emerald-400/12 text-emerald-100"
                    : gate.tone === "locked"
                      ? "border-rose-300/24 bg-rose-400/12 text-rose-100"
                      : gate.tone === "retry"
                        ? "border-amber-300/24 bg-amber-400/12 text-amber-100"
                        : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                }`}>
                  {gate.label}
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">{exam.title}</h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-white/64">{exam.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-fit rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/68 transition hover:bg-white/[0.09] hover:text-white"
            >
              Cerrar
            </button>
          </div>
        </div>

        {totalQuestions > 0 ? (
          <div className="space-y-5 p-4 sm:p-6">
            <section className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-[22px] border border-violet-300/14 bg-violet-400/[0.055] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-100/58">Preguntas</p>
                <p className="mt-2 text-2xl font-semibold text-white">{totalQuestions}</p>
                <p className="mt-1 text-xs text-white/46">Alternativas múltiples</p>
              </div>
              <div className="rounded-[22px] border border-cyan-300/14 bg-cyan-400/[0.055] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/58">Tiempo</p>
                <p className="mt-2 text-2xl font-semibold text-white">{minutes}:{seconds}</p>
                <p className="mt-1 text-xs text-white/46">Contador real</p>
              </div>
              <div className="rounded-[22px] border border-emerald-300/14 bg-emerald-400/[0.055] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100/58">Aprobación</p>
                <p className="mt-2 text-2xl font-semibold text-white">{exam.passScore}%</p>
                <p className="mt-1 text-xs text-white/46">{minimumCorrect} de {totalQuestions} correctas</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">Avance</p>
                <p className="mt-2 text-2xl font-semibold text-white">{answeredCount}/{totalQuestions}</p>
                <p className="mt-1 text-xs text-white/46">Respondidas</p>
              </div>
            </section>

            {lockedBeforeStart ? (
              <section className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
                <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.035]">
                  <div className="relative h-[300px] w-full overflow-hidden bg-[#071827]">
                    <img
                      src={exam.imagePath}
                      alt={exam.title}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = TRAINING_AIRCRAFT_IMAGE_FALLBACK;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#061423] via-[#061423]/28 to-transparent" />
                    <div className="absolute bottom-5 left-5 right-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-100/70">Estado de evaluación</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{gate.label}</p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-[24px] border p-6 ${
                  gate.tone === "passed"
                    ? "border-emerald-300/22 bg-emerald-400/10"
                    : "border-rose-300/22 bg-rose-400/10"
                }`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/52">Acceso bloqueado</p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    {gate.tone === "passed" ? "Esta teórica ya fue aprobada" : "Reintento todavía no disponible"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/64">{gate.helper}</p>
                  {latestAttempt ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] border border-white/10 bg-black/18 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Último resultado</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{latestAttempt.score_percent}%</p>
                      </div>
                      <div className="rounded-[18px] border border-white/10 bg-black/18 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Fecha</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatTheoryAttemptDate(latestAttempt.submitted_at)}</p>
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-6 rounded-[14px] border border-white/10 bg-white/[0.06] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/76 transition hover:bg-white/[0.1] hover:text-white"
                  >
                    Entendido
                  </button>
                </div>
              </section>
            ) : submitted ? (
              <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
                  <div className={`rounded-[22px] border p-5 ${
                    passed
                      ? "border-emerald-300/20 bg-emerald-400/10"
                      : "border-rose-300/20 bg-rose-400/10"
                  }`}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Resultado</p>
                    <p className={`mt-3 text-4xl font-semibold ${passed ? "text-emerald-100" : "text-rose-100"}`}>
                      {scorePercent}%
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {passed ? "Evaluación aprobada" : "Evaluación no aprobada"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      Obtuviste {correctCount} respuestas correctas de {totalQuestions}. La nota mínima de aprobación es {exam.passScore}%.
                    </p>
                    {!passed ? (
                      <p className="mt-2 text-sm leading-6 text-amber-100/72">
                        Podrás realizar un nuevo intento después de 7 días.
                      </p>
                    ) : null}
                    {attemptSaveMessage ? (
                      <p className="mt-4 rounded-[16px] border border-white/10 bg-black/18 px-4 py-3 text-xs leading-5 text-white/56">
                        {attemptSaveMessage}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={savingAttempt}
                      className="mt-5 rounded-[14px] border border-white/10 bg-white/[0.06] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/76 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-wait disabled:opacity-60"
                    >
                      {savingAttempt ? "Guardando resultado..." : "Cerrar evaluación"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {questions.map((question, index) => {
                      const selectedOption = answers[question.id];
                      const isCorrect = selectedOption === question.correctOptionId;
                      const correctLabel = question.options.find((option) => option.id === question.correctOptionId)?.label ?? "—";

                      return (
                        <div key={question.id} className="rounded-[18px] border border-white/8 bg-black/18 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">Pregunta {index + 1}</p>
                              <p className="mt-1 text-sm font-semibold text-white">{question.prompt}</p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                              isCorrect
                                ? "border-emerald-300/24 bg-emerald-400/12 text-emerald-100"
                                : "border-rose-300/24 bg-rose-400/12 text-rose-100"
                            }`}>
                              {isCorrect ? "Correcta" : "Revisar"}
                            </span>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-white/52">
                            Respuesta correcta: <span className="text-white/78">{correctLabel}</span>
                          </p>
                          <p className="mt-2 text-xs leading-5 text-white/46">{question.explanation}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : !examStarted ? (
              <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
                <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="relative h-[320px] w-full overflow-hidden bg-[#071827]">
                    <img
                      src={exam.imagePath}
                      alt={exam.title}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = TRAINING_AIRCRAFT_IMAGE_FALLBACK;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#061423] via-[#061423]/35 to-transparent" />
                    <div className="absolute bottom-5 left-5 right-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-100/70">Briefing previo</p>
                      <p className="mt-2 text-2xl font-semibold text-white">Lee las instrucciones antes de iniciar</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">Instrucciones de la prueba</p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{exam.title}</h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-cyan-300/14 bg-cyan-400/[0.055] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/56">Duración</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{exam.durationMinutes} min</p>
                    </div>
                    <div className="rounded-[18px] border border-emerald-300/14 bg-emerald-400/[0.055] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/56">Aprobación</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{minimumCorrect}/{totalQuestions}</p>
                    </div>
                  </div>
                  <ul className="mt-5 space-y-3 text-sm leading-6 text-white/62">
                    <li>• Tendrás un solo intento activo y el contador comenzará al presionar “Hacer intento”.</li>
                    <li>• La prueba contiene {totalQuestions} preguntas con alternativas A/B/C/D.</li>
                    <li>• Puedes navegar entre preguntas antes de finalizar.</li>
                    <li>• Si apruebas, esta teórica queda bloqueada como aprobada.</li>
                    <li>• Si repruebas, el reintento quedará bloqueado por {TRAINING_THEORY_RETRY_DAYS} días.</li>
                  </ul>
                  <div className="mt-6 rounded-[18px] border border-amber-300/18 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50/74">
                    Al iniciar no se mostrarán instrucciones nuevamente. Revisa bien el tema y responde con calma.
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-[14px] border border-white/10 bg-white/[0.045] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/68 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={startExam}
                      className="rounded-[14px] border border-emerald-300/24 bg-emerald-400/12 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100 transition hover:bg-emerald-400/18"
                    >
                      Hacer intento
                    </button>
                  </div>
                </div>
              </section>
            ) : currentQuestion ? (
              <section className="grid gap-5 xl:grid-cols-[0.76fr_1.24fr]">
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="relative h-[260px] w-full overflow-hidden bg-[#071827]">
                      <img
                        src={currentQuestion.imagePath}
                        alt={currentQuestion.topic}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src = TRAINING_AIRCRAFT_IMAGE_FALLBACK;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#061423] via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-100/72">Tema</p>
                        <p className="mt-1 text-lg font-semibold text-white">{currentQuestion.topic}</p>
                      </div>
                    </div>
                    <div className="border-t border-white/8 p-4">
                      <p className="text-sm leading-6 text-white/58">
                        El contador está activo. Responde con calma y finaliza cuando completes todas las preguntas.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">Navegador</p>
                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {questions.map((question, index) => {
                        const answered = Boolean(answers[question.id]);
                        const active = index === currentIndex;

                        return (
                          <button
                            key={question.id}
                            type="button"
                            onClick={() => setCurrentIndex(index)}
                            className={`rounded-[12px] border px-3 py-2 text-xs font-semibold transition ${
                              active
                                ? "border-violet-300/30 bg-violet-400/18 text-violet-50"
                                : answered
                                  ? "border-emerald-300/22 bg-emerald-400/10 text-emerald-100"
                                  : "border-white/8 bg-white/[0.035] text-white/48 hover:bg-white/[0.07]"
                            }`}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">
                        Pregunta {currentIndex + 1} de {totalQuestions}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold leading-7 text-white">{currentQuestion.prompt}</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/54">
                      {currentQuestion.topic}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {currentQuestion.options.map((option) => {
                      const selected = answers[currentQuestion.id] === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setAnswer(currentQuestion.id, option.id)}
                          className={`rounded-[18px] border p-4 text-left transition ${
                            selected
                              ? "border-violet-300/34 bg-violet-400/14 text-white shadow-[0_0_28px_rgba(168,85,247,0.12)]"
                              : "border-white/8 bg-black/16 text-white/66 hover:border-white/14 hover:bg-white/[0.045] hover:text-white"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                              selected
                                ? "border-violet-200/50 bg-violet-300/18 text-violet-50"
                                : "border-white/10 bg-white/[0.035] text-white/46"
                            }`}>
                              {option.id}
                            </span>
                            <span className="text-sm leading-6">{option.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
                      disabled={currentIndex === 0}
                      className={`rounded-[14px] border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                        currentIndex === 0
                          ? "cursor-not-allowed border-white/8 bg-white/[0.02] text-white/28"
                          : "border-white/10 bg-white/[0.045] text-white/68 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      Anterior
                    </button>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => setCurrentIndex((value) => Math.min(totalQuestions - 1, value + 1))}
                        disabled={currentIndex >= totalQuestions - 1}
                        className={`rounded-[14px] border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                          currentIndex >= totalQuestions - 1
                            ? "cursor-not-allowed border-white/8 bg-white/[0.02] text-white/28"
                            : "border-cyan-300/18 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/16"
                        }`}
                      >
                        Siguiente
                      </button>
                      <button
                        type="button"
                        onClick={() => void submitAttempt()}
                        disabled={!canFinish || savingAttempt}
                        className={`rounded-[14px] border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                          canFinish && !savingAttempt
                            ? "border-emerald-300/24 bg-emerald-400/12 text-emerald-100 hover:bg-emerald-400/18"
                            : "cursor-not-allowed border-white/8 bg-white/[0.02] text-white/28"
                        }`}
                      >
                        {savingAttempt ? "Guardando..." : "Finalizar evaluación"}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="p-6">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-8 text-center">
              <p className="text-3xl">📘</p>
              <p className="mt-3 text-lg font-semibold text-white">Evaluación en preparación</p>
              <p className="mt-2 text-sm text-white/52">Esta teórica será habilitada en un próximo bloque.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrainingReservationModal({
  aircraft,
  profile,
  onClose,
  onReserved,
}: {
  aircraft: TrainingAircraftProgress | null;
  profile: PilotProfileRecord | null;
  onClose: () => void;
  onReserved: (reservation: FlightReservationRow & { id: string }) => void;
}) {
  const [originIcao, setOriginIcao] = useState("");
  const [destinationIcao, setDestinationIcao] = useState("");
  const [scheduledDeparture, setScheduledDeparture] = useState(defaultTrainingDepartureHHMM());
  const [scheduledDepartureWasEdited, setScheduledDepartureWasEdited] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingSimbrief, setSyncingSimbrief] = useState(false);
  const [finalizingDispatch, setFinalizingDispatch] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [reservationData, setReservationData] = useState<TrainingReservationRpcRow | null>(null);
  const [trainingSimbriefStaticId, setTrainingSimbriefStaticId] = useState<string | null>(null);
  const [trainingSimbriefSummary, setTrainingSimbriefSummary] = useState<SimbriefOfpSummary | null>(null);
  const [imageSrc, setImageSrc] = useState(getTrainingAircraftImagePath(aircraft));
  const modalContentRef = useRef<HTMLDivElement | null>(null);

  function clearTrainingDispatchState() {
    setReservationData(null);
    setTrainingSimbriefStaticId(null);
    setTrainingSimbriefSummary(null);
    setMessage("");
    setErrorMessage("");
  }

  useEffect(() => {
    if (!aircraft) {
      return;
    }

    setOriginIcao("");
    setDestinationIcao("");
    setScheduledDeparture(defaultTrainingDepartureHHMM());
    setScheduledDepartureWasEdited(false);
    setRemarks(`Entrenamiento ${aircraft.display_name} creado desde la página de Entrenamiento.`);
    setSaving(false);
    setSyncingSimbrief(false);
    setFinalizingDispatch(false);
    setMessage("");
    setErrorMessage("");
    setReservationData(null);
    setTrainingSimbriefStaticId(null);
    setTrainingSimbriefSummary(null);
    setImageSrc(getTrainingAircraftImagePath(aircraft));

    window.requestAnimationFrame(() => {
      modalContentRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [aircraft]);

  useEffect(() => {
    if (!aircraft || scheduledDepartureWasEdited) {
      return;
    }

    setScheduledDeparture(defaultTrainingDepartureHHMM());

    const intervalId = window.setInterval(() => {
      setScheduledDeparture(defaultTrainingDepartureHHMM());
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [aircraft, scheduledDepartureWasEdited]);

  if (!aircraft) {
    return null;
  }

  const cleanOrigin = normalizeTrainingIcao(originIcao);
  const cleanDestination = normalizeTrainingIcao(destinationIcao);
  const routeReady = cleanOrigin.length === 4 && cleanDestination.length === 4 && cleanOrigin !== cleanDestination;
  const pilotCallsign = profile?.callsign?.trim().toUpperCase() || "";
  const trainingFlightNumber = pilotCallsign;
  const trainingAirframe = resolveSimbriefType(aircraft.aircraft_type_code).trim().toUpperCase();
  const canCreateReservation = Boolean(pilotCallsign) && routeReady && !reservationData?.reservation_id && !saving;
  const canImportTrainingOfp = Boolean(profile?.simbrief_username?.trim() && !syncingSimbrief);

  const trainingSimbriefFlightNumberRaw = formatSimbriefFlightNumber(
    trainingSimbriefSummary?.flightNumber,
    trainingSimbriefSummary?.airlineIcao,
  );
  const simbriefFlightNumber = normalizeTrainingOfpFlightNumber(
    trainingSimbriefFlightNumberRaw === "Pendiente" ? "" : trainingSimbriefFlightNumberRaw,
    trainingFlightNumber,
  );
  const simbriefOrigin = trainingSimbriefSummary?.origin?.trim().toUpperCase() || "";
  const simbriefDestination = trainingSimbriefSummary?.destination?.trim().toUpperCase() || "";
  const simbriefAirframe = resolveSimbriefType(trainingSimbriefSummary?.airframe ?? "").trim().toUpperCase();
  const trainingValidationItems = [
    {
      label: "Vuelo",
      webValue: trainingFlightNumber || "Pendiente",
      simbriefValue: simbriefFlightNumber || "Pendiente",
      matches: Boolean(trainingSimbriefSummary) && simbriefFlightNumber === trainingFlightNumber,
    },
    {
      label: "Origen",
      webValue: cleanOrigin || "Pendiente",
      simbriefValue: simbriefOrigin || "Pendiente",
      matches: Boolean(trainingSimbriefSummary) && simbriefOrigin === cleanOrigin,
    },
    {
      label: "Destino",
      webValue: cleanDestination || "Pendiente",
      simbriefValue: simbriefDestination || "Pendiente",
      matches: Boolean(trainingSimbriefSummary) && simbriefDestination === cleanDestination,
    },
    {
      label: "Airframe",
      webValue: trainingAirframe || aircraft.aircraft_type_code,
      simbriefValue: simbriefAirframe || "Pendiente",
      matches: Boolean(trainingSimbriefSummary) && simbriefAirframe === trainingAirframe,
    },
  ];
  const trainingDispatchValid = Boolean(trainingSimbriefSummary) && trainingValidationItems.every((item) => item.matches);
  const canFinalizeDispatch = Boolean(reservationData?.reservation_id && trainingDispatchValid && !finalizingDispatch);

  async function createTrainingReservation() {
    if (!aircraft || !profile?.callsign?.trim()) {
      setErrorMessage("No se pudo identificar el piloto o la aeronave de entrenamiento.");
      return;
    }

    if (!routeReady) {
      setErrorMessage("Debes ingresar origen y destino ICAO válidos, distintos entre sí.");
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");
    setTrainingSimbriefStaticId(null);
    setTrainingSimbriefSummary(null);

    try {
      const { data, error } = await supabase.rpc("pw_create_training_reservation", {
        p_callsign: profile.callsign.trim().toUpperCase(),
        p_origin_ident: cleanOrigin,
        p_destination_ident: cleanDestination,
        p_aircraft_type_code: aircraft.aircraft_type_code,
        p_aircraft_display_name: aircraft.display_name,
        p_scheduled_departure: trainingHHMMToIso(scheduledDeparture),
        p_remarks: remarks.trim() || `Entrenamiento ${aircraft.display_name}`,
      });

      if (error) {
        throw error;
      }

      const row = (Array.isArray(data) ? data[0] : data) as TrainingReservationRpcRow | null;
      if (!row?.ok || !row.reservation_id) {
        throw new Error(row?.error || "No se pudo crear la reserva de entrenamiento.");
      }

      setReservationData(row);
      setMessage("Reserva de entrenamiento creada. Por ahora crea el OFP manualmente en SimBrief, impórtalo desde esta ventana y finaliza el despacho para que ACARS lo pueda rescatar.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear la reserva de entrenamiento. Revisa el SQL/RPC y los datos ingresados.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function importTrainingSimbriefOfp() {
    if (!profile?.simbrief_username?.trim()) {
      setErrorMessage("Falta tu usuario SimBrief en Perfil para importar el OFP.");
      return;
    }

    setSyncingSimbrief(true);
    setMessage("");
    setErrorMessage("");

    try {
      const search = new URLSearchParams({ username: profile.simbrief_username.trim() });
      if (trainingSimbriefStaticId?.trim()) {
        search.set("static_id", trainingSimbriefStaticId.trim());
      }

      const response = await fetch(`/api/simbrief/ofp?${search.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as
        | { ok: true; summary: SimbriefOfpSummary; matchedByStaticId: boolean }
        | { error?: string };

      if (!response.ok || !("ok" in data)) {
        throw new Error(data && "error" in data ? data.error || "No se pudo leer el OFP real." : "No se pudo leer el OFP real.");
      }

      setTrainingSimbriefSummary(data.summary);
      if (data.summary.staticId) {
        setTrainingSimbriefStaticId(data.summary.staticId);
      }
      setMessage("OFP importado desde SimBrief. Revisa que vuelo, origen, destino y airframe coincidan. Luego crea la reserva si aún no existe y finaliza el despacho para ACARS.");
    } catch (error) {
      setTrainingSimbriefSummary(null);
      setErrorMessage(error instanceof Error ? error.message : "No se pudo importar el OFP desde SimBrief.");
    } finally {
      setSyncingSimbrief(false);
    }
  }

  async function finalizeTrainingDispatch() {
    if (!aircraft || !profile || !reservationData?.reservation_id || !trainingSimbriefSummary) {
      setErrorMessage("Falta reserva u OFP importado para finalizar el despacho de entrenamiento.");
      return;
    }

    if (!trainingDispatchValid) {
      setErrorMessage("El OFP no coincide con la reserva de entrenamiento. Revisa vuelo, origen, destino y airframe.");
      return;
    }

    setFinalizingDispatch(true);
    setMessage("");
    setErrorMessage("");

    try {
      const normalizedFlightNumber =
        normalizeTrainingOfpFlightNumber(trainingSimbriefSummary.flightNumber, trainingFlightNumber) ||
        trainingFlightNumber;
      const routeText = trainingSimbriefSummary.routeText?.trim() || `${cleanOrigin} DCT ${cleanDestination}`;
      const simbriefPayload = {
        reservation_id: reservationData.reservation_id,
        dispatch_source: "navigraph_web_training",
        flight_mode: "training",
        route_code: reservationData.route_code ?? `TRAIN-${trainingFlightNumber}-${cleanOrigin}-${cleanDestination}`,
        flight_number: normalizedFlightNumber,
        origin_icao: cleanOrigin,
        destination_icao: cleanDestination,
        aircraft_id: null,
        aircraft_registration: TRAINING_AIRCRAFT_REGISTRATION_LABEL,
        aircraft_type_code: aircraft.aircraft_type_code,
        airframe: trainingSimbriefSummary.airframe ?? aircraft.aircraft_type_code,
        training_aircraft_display_name: aircraft.display_name,
        scheduled_departure: trainingHHMMToIso(scheduledDeparture),
        route_text: routeText,
        cruise_level: trainingSimbriefSummary.cruiseAltitude,
        alternate_icao: trainingSimbriefSummary.alternate,
        passenger_count: trainingSimbriefSummary.pax,
        cargo_kg: trainingSimbriefSummary.cargoKg,
        block_fuel_kg: trainingSimbriefSummary.blockFuelKg,
        trip_fuel_kg: trainingSimbriefSummary.tripFuelKg,
        reserve_fuel_kg: trainingSimbriefSummary.reserveFuelKg,
        taxi_fuel_kg: trainingSimbriefSummary.taxiFuelKg,
        payload_kg: trainingSimbriefSummary.payloadKg,
        zero_fuel_weight_kg: trainingSimbriefSummary.zfwKg,
        dispatch_token: trainingSimbriefSummary.staticId ?? trainingSimbriefStaticId,
        distance_nm: trainingSimbriefSummary.distanceNm,
        ete_minutes: trainingSimbriefSummary.eteMinutes,
        generated_at_iso: trainingSimbriefSummary.generatedAtIso,
        raw_units: trainingSimbriefSummary.rawUnits,
        pdf_url: trainingSimbriefSummary.pdfUrl,
        prepared_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.rpc("pw_finalize_training_dispatch", {
        p_reservation_id: reservationData.reservation_id,
        p_callsign: profile.callsign.trim().toUpperCase(),
        p_simbrief_username: profile.simbrief_username?.trim() || null,
        p_route_text: routeText,
        p_cruise_fl: trainingSimbriefSummary.cruiseAltitude ?? null,
        p_planned_fuel_kg: trainingSimbriefSummary.blockFuelKg ?? null,
        p_planned_payload_kg: trainingSimbriefSummary.payloadKg ?? null,
        p_simbrief_ofp_id: trainingSimbriefSummary.staticId ?? trainingSimbriefStaticId ?? null,
        p_simbrief_ofp_json: simbriefPayload,
        p_flight_number: normalizedFlightNumber,
        p_origin_ident: cleanOrigin,
        p_destination_ident: cleanDestination,
        p_aircraft_type_code: aircraft.aircraft_type_code,
        p_aircraft_display_name: aircraft.display_name,
      });

      if (error) {
        throw error;
      }

      const row = (Array.isArray(data) ? data[0] : data) as TrainingFinalizeRpcRow | null;
      if (!row?.ok || !row.reservation_id) {
        throw new Error(row?.error || "No se pudo finalizar el despacho de entrenamiento.");
      }

      const nextReservation: FlightReservationRow & { id: string } = {
        id: row.reservation_id,
        pilot_callsign: profile.callsign.trim().toUpperCase(),
        route_code: row.route_code ?? reservationData.route_code ?? `TRAIN-${cleanOrigin}-${cleanDestination}`,
        flight_number: row.flight_number ?? normalizedFlightNumber,
        aircraft_type_code: aircraft.aircraft_type_code,
        aircraft_registration: TRAINING_AIRCRAFT_REGISTRATION_LABEL,
        origin_ident: cleanOrigin,
        destination_ident: cleanDestination,
        status: "dispatched",
        flight_mode_code: "TRAINING",
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      onReserved(nextReservation);
      setMessage("Despacho de entrenamiento finalizado. ACARS ya puede rescatarlo igual que un chárter, pero sin aeronave física ni matrícula real.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo finalizar el despacho de entrenamiento.");
    } finally {
      setFinalizingDispatch(false);
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-y-auto bg-[#010714]/78 px-4 py-4 backdrop-blur-xl sm:py-5 lg:py-6">
      <div className="pointer-events-auto relative mx-auto w-full max-w-5xl overflow-hidden rounded-[32px] border border-cyan-300/16 bg-[#071526] shadow-[0_28px_90px_rgba(0,0,0,0.62)]">
        <div className="absolute inset-0 opacity-30">
          <img
            src={imageSrc}
            alt=""
            className="h-full w-full scale-110 object-cover blur-[16px]"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageSrc(TRAINING_AIRCRAFT_IMAGE_FALLBACK)}
          />
          <div className="absolute inset-0 bg-[#030a16]/82" />
        </div>

        <div
          ref={modalContentRef}
          className="relative z-10 p-5 sm:p-6 lg:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-100/56">
                Entrenamiento Patagonia Wings
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                Entrenamiento de {aircraft.display_name}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/62">
                Esta reserva no toma una aeronave física. El flujo queda como chárter: reserva web, OFP de SimBrief importado y despacho final para que ACARS lo rescate.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/[0.08]"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="self-start overflow-hidden rounded-[26px] border border-white/10 bg-black/24 p-3">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[22px] bg-[#020b15]">
                <img
                  src={imageSrc}
                  alt={aircraft.display_name}
                  className="h-full w-full object-cover object-center"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setImageSrc(TRAINING_AIRCRAFT_IMAGE_FALLBACK)}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 to-transparent px-5 py-4">
                  <p className="text-sm font-semibold text-white">{aircraft.aircraft_type_code}</p>
                  <p className="mt-1 text-xs text-white/60">{aircraft.family_code ?? "Familia entrenamiento"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TrainingIcaoInput
                  label="Origen"
                  value={originIcao}
                  onChange={(value) => {
                    setOriginIcao(value);
                    clearTrainingDispatchState();
                  }}
                />
                <TrainingIcaoInput
                  label="Destino"
                  value={destinationIcao}
                  onChange={(value) => {
                    setDestinationIcao(value);
                    clearTrainingDispatchState();
                  }}
                />
              </div>

              <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
                <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                  Hora salida local
                </label>
                <input
                  type="time"
                  value={scheduledDeparture}
                  onChange={(event) => {
                    setScheduledDepartureWasEdited(true);
                    setScheduledDeparture(event.target.value);
                    clearTrainingDispatchState();
                  }}
                  className="mt-3 w-full rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-base font-semibold text-white outline-none transition focus:border-cyan-300/45"
                />
                <p className="mt-2 text-xs text-white/42">
                  Se carga con tu hora local actual; puedes modificarla antes de crear la reserva.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4">
                <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                  Observaciones
                </label>
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  rows={3}
                  className="mt-3 w-full resize-none rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/45"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-cyan-300/14 bg-cyan-300/[0.055] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/62">
              Resumen de reserva
            </p>
            <div className="mt-3 grid gap-3 text-sm text-white/72 sm:grid-cols-4">
              <span><strong className="text-white">Piloto:</strong> {profile?.callsign ?? "—"}</span>
              <span><strong className="text-white">Ruta:</strong> {cleanOrigin || "----"} → {cleanDestination || "----"}</span>
              <span><strong className="text-white">Avión:</strong> {aircraft.aircraft_type_code}</span>
              <span><strong className="text-white">Matrícula:</strong> {TRAINING_AIRCRAFT_REGISTRATION_LABEL}</span>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-white/10 bg-[#031428]/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                  SimBrief / despacho
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">OFP SimBrief obligatorio</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/58">
                {reservationData?.reservation_id ? "Reserva creada" : "Pendiente reserva"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!canCreateReservation}
                onClick={() => void createTrainingReservation()}
                className={`py-3 ${canCreateReservation ? "button-primary" : "button-secondary cursor-not-allowed opacity-55"}`}
              >
                {saving ? "Creando reserva..." : reservationData?.reservation_id ? "Reserva creada" : "Crear reserva"}
              </button>
              <button
                type="button"
                disabled={!canImportTrainingOfp}
                onClick={() => void importTrainingSimbriefOfp()}
                className={`py-3 ${canImportTrainingOfp ? "button-secondary" : "button-secondary cursor-not-allowed opacity-55"}`}
              >
                {syncingSimbrief ? "Importando..." : "Importar OFP"}
              </button>
            </div>

            {!profile?.simbrief_username?.trim() ? (
              <p className="mt-3 text-sm text-amber-100/86">Falta configurar usuario SimBrief en Perfil para importar el OFP.</p>
            ) : (
              <p className="mt-3 text-sm text-white/58">
                Genera el OFP manualmente en SimBrief con vuelo, origen, destino y airframe correctos. Luego vuelve a esta ventana y usa Importar OFP.
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {trainingValidationItems.map((item) => (
                <div key={item.label} className="rounded-[18px] border border-white/8 bg-white/[0.035] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-white">Web: {item.webValue}</p>
                  <p className="mt-1 text-xs text-white/54">OFP: {item.simbriefValue}</p>
                  <p className={`mt-2 text-xs font-semibold ${item.matches ? "text-emerald-300" : "text-amber-200"}`}>
                    {item.matches ? "Coincide" : trainingSimbriefSummary ? "No coincide" : "Pendiente"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {message ? (
            <div className="mt-4 rounded-[18px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
              {message}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-4 rounded-[18px] border border-rose-300/24 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
            <button type="button" onClick={onClose} className="button-secondary py-3">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canFinalizeDispatch}
              onClick={() => void finalizeTrainingDispatch()}
              className={`py-3 ${canFinalizeDispatch ? "button-primary" : "button-secondary cursor-not-allowed opacity-50"}`}
            >
              {finalizingDispatch ? "Finalizando despacho..." : "Finalizar despacho"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardWorkspace({
  userId,
  profile,
  activeTab,
  onChangeTab,
  metrics,
  central,
  availableAircraft,
  availableItineraries,
  trainingAircraftProgress,
}: {
  userId: string;
  profile: PilotProfileRecord | null;
  activeTab: DashboardTabKey;
  onChangeTab: (tab: DashboardTabKey) => void;
  metrics: DashboardMetrics;
  central: CentralOverview;
  availableAircraft: AvailableAircraftOption[];
  availableItineraries: AvailableItineraryOption[];
  trainingAircraftProgress: TrainingAircraftProgress[];
}) {
  const [activeReservation, setActiveReservation] = useState<(FlightReservationRow & { id: string }) | null>(null);
  const [charterReservationId, setCharterReservationId] = useState<string | null>(null);
  const [charterOperation, setCharterOperation] = useState<FlightOperationRecord | null>(null);
  const [cancellingReservation, setCancellingReservation] = useState(false);
  const [routeNow, setRouteNow] = useState(() => Date.now());
  const [dispatchStep, setDispatchStep] = useState<DispatchStepKey>("flight_type");
  const [selectedFlightType, setSelectedFlightType] = useState<DispatchFlightTypeId | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<string | null>(null);
  const [selectedItinerary, setSelectedItinerary] = useState<string | null>(null);
  const [selectedDepartureHHMM, setSelectedDepartureHHMM] = useState<string>("08:00");
  const [dispatchReady, setDispatchReady] = useState(false);
  const [simbriefSummary, setSimbriefSummary] = useState<SimbriefOfpSummary | null>(null);
  const [syncingSimbrief, setSyncingSimbrief] = useState(false);
  const [simbriefGenerationActive, setSimbriefGenerationActive] = useState(false);
  const [simbriefInfoMessage, setSimbriefInfoMessage] = useState("");
  const [simbriefErrorMessage, setSimbriefErrorMessage] = useState("");
  const [finalizingDispatch, setFinalizingDispatch] = useState(false);
  const [summaryInfoMessage, setSummaryInfoMessage] = useState("");
  const [summaryErrorMessage, setSummaryErrorMessage] = useState("");
  const [preparedReservationId, setPreparedReservationId] = useState<string | null>(null);
  const [itineraryAirportsByIcao, setItineraryAirportsByIcao] = useState<
    Record<string, ItineraryAirportMeta>
  >({});
  const router = useRouter();
  const searchParams = useSearchParams();
  const [navigraphStatus, setNavigraphStatus] = useState<NavigraphStatusResponse | null>(null);
  const [loadingNavigraphStatus, setLoadingNavigraphStatus] = useState(false);
  const [navigraphInfoMessage, setNavigraphInfoMessage] = useState("");
  const [navigraphErrorMessage, setNavigraphErrorMessage] = useState("");
  const [simbriefStaticId, setSimbriefStaticId] = useState<string | null>(null);
  const [permittedTrainingTypes, setPermittedTrainingTypes] = useState<Set<string>>(new Set());
  const [openTrainingCategories, setOpenTrainingCategories] = useState<Record<TrainingCategoryKey, boolean>>({
    school: false,
    single_turboprop: false,
    twin_turboprop: false,
    piston_twin: false,
    regional_jet: false,
    narrowbody_jet: false,
    widebody_jet: false,
  });
  const [trainingPlannerAircraft, setTrainingPlannerAircraft] = useState<TrainingAircraftProgress | null>(null);
  const [selectedTrainingCheckride, setSelectedTrainingCheckride] = useState<TrainingCheckrideCatalogItem | null>(null);
  const [selectedTrainingTheoryExam, setSelectedTrainingTheoryExam] = useState<TrainingTheoryExam | null>(null);
  const [trainingTheoryAttempts, setTrainingTheoryAttempts] = useState<Record<string, TrainingTheoryAttemptSummary>>({});
  const rank = getRankInsignia(metrics.careerRankCode);

  function openTrainingPlanner(aircraft: TrainingAircraftProgress) {
    setTrainingPlannerAircraft(aircraft);

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  useEffect(() => {
    const callsign = profile?.callsign?.trim().toUpperCase() || "";

    if (!callsign) {
      setTrainingTheoryAttempts({});
      return;
    }

    let cancelled = false;
    const localAttempts = readStoredTheoryAttempts(callsign);
    setTrainingTheoryAttempts(localAttempts);

    void Promise.resolve(
      supabase
        .from("pw_pilot_theory_exam_attempts")
        .select("exam_code,status,score_percent,correct_count,total_questions,submitted_at,next_available_at")
        .eq("pilot_callsign", callsign)
        .order("submitted_at", { ascending: false }),
    )
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const remoteAttempts = reduceLatestTheoryAttempts(
          data.map((row) => ({
            exam_code: String(row.exam_code ?? ""),
            status: row.status === "passed" ? "passed" : "failed",
            score_percent: Number(row.score_percent ?? 0),
            correct_count: Number(row.correct_count ?? 0),
            total_questions: Number(row.total_questions ?? 0),
            submitted_at: String(row.submitted_at ?? new Date().toISOString()),
            next_available_at: row.next_available_at ? String(row.next_available_at) : null,
          })),
        );
        setTrainingTheoryAttempts((current) => ({ ...current, ...remoteAttempts }));
      })
      .catch(() => {
        // LocalStorage fallback keeps the UI usable before the SQL table exists.
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.callsign]);

  useEffect(() => {
    let cancelled = false;

    loadPilotPermittedTrainingTypes(profile)
      .then((next) => {
        if (!cancelled) {
          setPermittedTrainingTypes(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermittedTrainingTypes(new Set());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.career_rank_code, profile?.rank_code]);

  const trainingCategoryCards = useMemo<TrainingCategoryCard[]>(() => {
    const grouped = new Map<TrainingCategoryKey, TrainingAircraftProgress[]>();

    for (const key of TRAINING_CATEGORY_SEQUENCE) {
      grouped.set(key, []);
    }

    for (const item of trainingAircraftProgress) {
      const key = resolveTrainingCategoryKey(item.aircraft_type_code);
      grouped.get(key)?.push(item);
    }

    let highestPermittedCategoryIndex = 0;

    for (const item of trainingAircraftProgress) {
      const categoryKey = resolveTrainingCategoryKey(item.aircraft_type_code);
      const categoryIndex = getTrainingCategoryIndex(categoryKey);

      if (isTrainingSchoolAircraft(item.aircraft_type_code) || isTrainingTypePermitted(item.aircraft_type_code, permittedTrainingTypes)) {
        highestPermittedCategoryIndex = Math.max(highestPermittedCategoryIndex, categoryIndex);
      }
    }

    const maxUnlockedCategoryIndex = Math.min(
      TRAINING_CATEGORY_SEQUENCE.length - 1,
      highestPermittedCategoryIndex + 1,
    );

    return TRAINING_CATEGORY_SEQUENCE
      .map((key, index) => {
        const meta = TRAINING_CATEGORY_META[key];
        const aircraft = (grouped.get(key) ?? []).slice().sort((a, b) => a.display_name.localeCompare(b.display_name, "es"));

        return {
          key,
          title: meta.title,
          description: meta.description,
          tierLabel: meta.tierLabel,
          accentClass: meta.accentClass,
          borderClass: meta.borderClass,
          badgeClass: meta.badgeClass,
          categoryIndex: index,
          unlocked: index <= maxUnlockedCategoryIndex,
          currentTier: index <= highestPermittedCategoryIndex,
          nextTier: index === highestPermittedCategoryIndex + 1,
          aircraft,
        } satisfies TrainingCategoryCard;
      })
      .filter((card) => card.aircraft.length > 0);
  }, [trainingAircraftProgress, permittedTrainingTypes]);

  useEffect(() => {
    if (trainingCategoryCards.length === 0) {
      return;
    }

    setOpenTrainingCategories((previous) => {
      const nextState = { ...previous };

      for (const card of trainingCategoryCards) {
        if (typeof nextState[card.key] !== "boolean") {
          nextState[card.key] = false;
        } else if (!card.unlocked) {
          nextState[card.key] = false;
        }
      }

      return nextState;
    });
  }, [trainingCategoryCards]);

  function toggleTrainingCategory(categoryKey: TrainingCategoryKey) {
    setOpenTrainingCategories((previous) => ({
      ...previous,
      [categoryKey]: !previous[categoryKey],
    }));
  }

  const trainingAccessSummary = useMemo(() => {
    const unlockedCards = trainingCategoryCards.filter((card) => card.unlocked);
    const activeCards = trainingCategoryCards.filter((card) => card.currentTier);
    const previewCard = trainingCategoryCards.find((card) => card.nextTier && card.unlocked) ?? null;
    const activeAircraftCount = unlockedCards.reduce((sum, card) => sum + card.aircraft.length, 0);

    return {
      unlockedCards,
      activeCards,
      previewCard,
      activeAircraftCount,
    };
  }, [trainingCategoryCards]);

  const navigraphConnected = navigraphStatus?.connected === true;
  const navigraphConfigured = navigraphStatus?.configured === true;
  const navigraphExpiryLabel = useMemo(
    () => formatNavigraphExpiry(navigraphStatus?.expiresAt),
    [navigraphStatus?.expiresAt],
  );


  async function refreshNavigraphStatus(silent = false) {
    if (!silent) {
      setLoadingNavigraphStatus(true);
    }

    try {
      const response = await fetch("/api/auth/navigraph/status", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = (await response.json()) as NavigraphStatusResponse;

      if (!response.ok) {
        setNavigraphStatus(null);
        setNavigraphErrorMessage(payload?.error || "No se pudo consultar el estado de Navigraph.");
        if (!silent) {
          setNavigraphInfoMessage("");
        }
        return;
      }

      setNavigraphStatus(payload);
      if (!payload.connected && payload.error && !silent) {
        setNavigraphErrorMessage(payload.error);
      }
    } catch (error) {
      setNavigraphStatus(null);
      setNavigraphErrorMessage(
        error instanceof Error ? error.message : "No se pudo consultar Navigraph."
      );
    } finally {
      if (!silent) {
        setLoadingNavigraphStatus(false);
      }
    }
  }

  async function handleDisconnectNavigraph() {
    setLoadingNavigraphStatus(true);
    setNavigraphErrorMessage("");
    setNavigraphInfoMessage("");

    try {
      const response = await fetch("/api/auth/navigraph/disconnect", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("No se pudo cerrar la sesión de Navigraph.");
      }

      setNavigraphInfoMessage("Sesión Navigraph desconectada correctamente.");
      setSimbriefStaticId(null);
      await refreshNavigraphStatus(true);
    } catch (error) {
      setSimbriefGenerationActive(false);
      setNavigraphErrorMessage(
        error instanceof Error ? error.message : "No se pudo desconectar Navigraph."
      );
    } finally {
      setLoadingNavigraphStatus(false);
    }
  }

  async function handleOpenSimbriefPlanner() {
    if (!profile || !selectedAircraftRecord || !selectedItineraryRecord) {
      setNavigraphErrorMessage(isCharterLikeDispatch ? "Primero debes crear la reserva Chárter con origen, destino y aeronave." : "Primero debes confirmar tipo de vuelo, aeronave e itinerario.");
      return;
    }

    if (!profile.simbrief_username?.trim()) {
      setNavigraphErrorMessage("Falta tu usuario SimBrief en Perfil para abrir el OFP.");
      return;
    }

    if (!navigraphConnected) {
      setNavigraphInfoMessage("SimBrief se abrirá con los datos de Patagonia Wings. Si solicita sesión, inicia con tu cuenta Navigraph/SimBrief y luego vuelve para cargar el OFP.");
    }

    setSyncingSimbrief(true);
    setNavigraphErrorMessage("");
    setNavigraphInfoMessage("");

    try {
      const flightNumber = normalizeSimbriefFlightNumber(
        isCharterLikeDispatch
          ? webFlightNumberValidationValue || compactFlightIdentifier(profile.callsign) || "000"
          : webFlightNumberValidationValue ||
            compactFlightIdentifier(selectedItineraryRecord.flight_designator) ||
            compactFlightIdentifier(selectedItineraryRecord.flight_number) ||
            "000"
      );

      const payload = {
        userId: profile.id,
        reservationId: preparedReservationId ?? charterReservationId,
        callsign: profile.callsign,
        simbriefUsername: profile.simbrief_username.trim(),
        firstName: profile.first_name ?? null,
        lastName: profile.last_name ?? null,
        flightNumber,
        origin: webOriginCode,
        destination: webDestinationCode,
        alternate: null,
        aircraftCode:
          selectedAircraftRecord.aircraft_type_code ??
          selectedAircraftRecord.aircraft_code,
        aircraftTailNumber: selectedAircraftRecord.tail_number || null,
        routeText: isCharterLikeDispatch
          ? charterOperation?.routeText || selectedItineraryRecord.itinerary_code
          : selectedItineraryRecord.itinerary_code,
        scheduledDeparture:
          isCharterLikeDispatch && charterOperation?.scheduledDeparture
            ? charterOperation.scheduledDeparture
            : departureHHMMtoISO(selectedDepartureHHMM),
        eteMinutes:
          webDispatchDurationMinutes ??
          selectedItineraryRecord.scheduled_block_min ??
          selectedItineraryRecord.expected_block_p50 ??
          selectedItineraryRecord.expected_block_p80 ??
          60,
        pax: 0,
        cargoKg: 0,
        remarks: "PATAGONIA WINGS WEB DISPATCH",
      };

      const response = await fetch("/api/simbrief/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as
        | {
            ok: true;
            staticId: string;
            generateUrl: string;
            editUrl: string;
            mode?: "api" | "redirect";
            popupRequired?: boolean;
            warning?: string;
          }
        | { error?: string };

      if (!response.ok || !("ok" in data)) {
        throw new Error(
          data && "error" in data ? data.error || "No se pudo abrir SimBrief." : "No se pudo abrir SimBrief."
        );
      }

      setSimbriefStaticId(data.staticId);

      const popupName = data.mode === "api" ? "PWG_SIMBRIEF_GENERATOR" : "PWG_SIMBRIEF_PREFILL";
      const popupFeatures = data.mode === "api"
        ? "popup=yes,width=560,height=740,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes"
        : "popup=yes,width=1280,height=860,menubar=no,toolbar=yes,location=yes,status=yes,scrollbars=yes,resizable=yes";

      setSimbriefGenerationActive(true);
      setNavigraphInfoMessage(
        data.mode === "api"
          ? "Generando OFP SimBrief con los datos de Patagonia Wings. La ventana pequeña volverá automáticamente al finalizar."
          : "SimBrief se abrió prellenado. Revisa el vuelo, presiona Generate Flight en SimBrief y luego vuelve a Patagonia Wings para cargar el OFP automático."
      );

      const popup = window.open(data.generateUrl || data.editUrl, popupName, popupFeatures);

      if (!popup) {
        setSimbriefGenerationActive(false);
        throw new Error("El navegador bloqueó la ventana de SimBrief. Permite popups para Patagonia Wings e inténtalo nuevamente.");
      }

      const popupMonitor = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(popupMonitor);
          setSimbriefGenerationActive(false);
          setNavigraphInfoMessage(
            data.mode === "api"
              ? "La ventana de SimBrief se cerró. Usa Cargar OFP automático para recuperar el plan si no se cargó solo."
              : "Cuando hayas presionado Generate Flight en SimBrief, usa Cargar OFP automático para traer el plan a Patagonia Wings."
          );
        }
      }, 1200);
    } catch (error) {
      setSimbriefGenerationActive(false);
      setNavigraphErrorMessage(
        error instanceof Error ? error.message : "No se pudo abrir OFP / SimBrief."
      );
    } finally {
      setSyncingSimbrief(false);
    }
  }

  // Carga reserva activa del piloto y refresca telemetría viva enviada por ACARS.
  useEffect(() => {
    if (!profile) return;
    let alive = true;
    let timer: number | null = null;

    async function loadActiveReservation() {
      if (!profile) return;
      const { data } = await supabase
        .from("flight_reservations")
        .select("id, pilot_callsign, route_code, flight_number, aircraft_type_code, aircraft_registration, origin_ident, destination_ident, status, flight_mode_code, score_payload, updated_at, created_at")
        .eq("pilot_callsign", profile.callsign)
        .in("status", ["reserved", "dispatched", "dispatch_ready", "in_progress", "in_flight"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (alive) {
        setActiveReservation(data as (FlightReservationRow & { id: string }) | null);
      }
    }

    void loadActiveReservation();
    timer = window.setInterval(() => { void loadActiveReservation(); }, 10000);

    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [profile]);

  useEffect(() => {
    if (activeTab !== "dispatch") {
      return;
    }

    void refreshNavigraphStatus(true);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "dispatch") {
      return;
    }

    const ng = searchParams.get("ng");
    const ngError = searchParams.get("ng_error");
    const returnedStaticId = searchParams.get("static_id");
    const simbriefReturn = searchParams.get("simbrief_return");

    if (returnedStaticId) {
      setSimbriefStaticId(returnedStaticId);
    }

    if (ng === "connected") {
      setNavigraphInfoMessage("Navigraph conectado correctamente. Ya puedes abrir OFP / SimBrief.");
      setNavigraphErrorMessage("");
      void refreshNavigraphStatus(true);
    } else if (ngError) {
      setNavigraphErrorMessage(ngError);
      setNavigraphInfoMessage("");
      void refreshNavigraphStatus(true);
    } else if (simbriefReturn === "1") {
      setNavigraphInfoMessage("Volviste desde SimBrief. Ahora usa Cargar OFP automático para traer el plan generado y validar el despacho.");
    }
  }, [activeTab, searchParams]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRouteNow(Date.now());
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  const aircraftOptions = [
    {
      id: "atr72",
      title: "ATR 72 disponible",
      description: "Toma una aeronave regional desde la flota activa del aeropuerto actual.",
    },
    {
      id: "e175",
      title: "E175 disponible",
      description: "Opción jet regional para saltos medios dentro de la red operativa.",
    },
    {
      id: "a320",
      title: "A320 disponible",
      description: "Opción narrowbody para red troncal y rutas con mayor demanda.",
    },
  ] as const;

  const itineraryOptions = [
    {
      id: "short_leg",
      title: "Pierna corta disponible",
      description: "Itinerario corto alineado al aeropuerto actual y a la aeronave elegida.",
    },
    {
      id: "medium_leg",
      title: "Pierna media disponible",
      description: "Ruta media compatible con rango, red activa y disponibilidad real.",
    },
    {
      id: "special_leg",
      title: "Pierna especial / misión",
      description: "Slot especial para entrenamiento, evento o traslado validado.",
    },
  ] as const;

  const isCharterLikeDispatch = selectedFlightType === "charter" || selectedFlightType === "free_flight";
  const canOpenAircraft = Boolean(selectedFlightType);
  const canOpenItinerary = canOpenAircraft && !isCharterLikeDispatch && Boolean(selectedAircraft);
  const canOpenCharterDispatch = isCharterLikeDispatch && Boolean(charterReservationId && charterOperation);
  const canOpenDispatch = isCharterLikeDispatch ? canOpenCharterDispatch : canOpenItinerary && Boolean(selectedItinerary);
  const canOpenSummary = canOpenDispatch && dispatchReady;
  const dispatchMetar = useMemo(
    () => buildDispatchMetarSummary(central.metarText),
    [central.metarText],
  );
  const dispatchFlightMode = useMemo(
    () => mapDispatchFlightTypeToMode(selectedFlightType),
    [selectedFlightType],
  );
  const selectedAircraftRecord = useMemo(() => {
    const regularAircraft = availableAircraft.find((option) => option.aircraft_id === selectedAircraft) ?? null;

    if (regularAircraft) {
      return regularAircraft;
    }

    if (isCharterLikeDispatch && charterOperation?.aircraftId) {
      return {
        aircraft_id: charterOperation.aircraftId,
        tail_number: charterOperation.aircraftTailNumber,
        aircraft_code: charterOperation.aircraftCode,
        aircraft_type_code: charterOperation.aircraftTypeCode ?? charterOperation.aircraftCode,
        aircraft_name: charterOperation.aircraftName,
        aircraft_variant_code: charterOperation.aircraftVariantCode,
        addon_provider: charterOperation.aircraftAddonProvider,
        variant_name: charterOperation.aircraftVariantLabel,
        current_airport_icao: charterOperation.origin,
        status: "reserved",
        selectable: false,
      } as AvailableAircraftOption;
    }

    return null;
  }, [availableAircraft, charterOperation, isCharterLikeDispatch, selectedAircraft]);
  const filteredItineraries = useMemo(() => {
    const activeAirportCode = central.airportCode.trim().toUpperCase();
    const airportFiltered = availableItineraries.filter(
      (item) => item.origin_icao.trim().toUpperCase() === activeAirportCode,
    );
    const strictModeFiltered = dispatchFlightMode
      ? airportFiltered.filter((item) => item.flight_mode === dispatchFlightMode)
      : airportFiltered;
    const modeFiltered = strictModeFiltered.length > 0 ? strictModeFiltered : airportFiltered;

    if (!selectedAircraftRecord) {
      return modeFiltered;
    }

    const typeCode = selectedAircraftRecord.aircraft_type_code ?? selectedAircraftRecord.aircraft_code;
    const selectedCode = getDispatchAircraftCompatibilityCode(typeCode);

    if (!selectedCode) {
      return [];
    }

    const aircraftMatched = modeFiltered.filter((item) => {
      // Prioridad 1: Rutas V2 traen una lista explícita de aeronaves compatibles.
      // Esta debe mandar sobre service_profile, porque en V2 service_profile puede ser "pax"/"cargo"
      // y eso NO es una regla de compatibilidad por aeronave.
      const compatibleTypes = item.compatible_aircraft_types ?? [];
      if (compatibleTypes.length > 0) {
        return compatibleTypes.some((type) => {
          const routeTypeCode = getDispatchAircraftCompatibilityCode(type);
          return routeTypeCode === selectedCode;
        });
      }

      // Prioridad 2: compatibilidad directa por tipo de aeronave cuando la ruta viene legacy.
      if (item.aircraft_type_code) {
        return getDispatchAircraftCompatibilityCode(item.aircraft_type_code) === selectedCode;
      }

      // Prioridad 3: service_profile solo para perfiles operativos legacy reales.
      // No usar "pax", "cargo" o "mixed" para filtrar, porque son tipo de servicio, no tipo de ruta.
      const serviceProfile = (item.service_profile ?? "").trim().toLowerCase();
      const legacyRouteProfiles = new Set(["feeder", "regional", "trunk", "longhaul", "heavy", "cargo"]);
      if (legacyRouteProfiles.has(serviceProfile)) {
        return isAircraftCompatibleWithRoute(typeCode, item.service_profile);
      }

      // Con aeronave seleccionada, si la ruta no declara compatibilidad, no se muestra.
      return false;
    });

    const allowedRouteCategories = getAllowedRouteCategoriesForPilot(profile);

    if (!allowedRouteCategories) {
      return aircraftMatched;
    }

    const rankMatched = aircraftMatched.filter((item) => {
      const routeCategory = getItineraryRouteCategory(item);

      // Rutas V2 siempre traen route_group con la categoría oficial.
      // Si llega una ruta legacy sin categoría, no la escondemos para no romper datos antiguos.
      if (!routeCategory) {
        return true;
      }

      return allowedRouteCategories.has(routeCategory);
    });

    // Strict filtering: when an aircraft is selected, only show compatible itineraries
    // (even if the list is empty — do not fall back to all routes).
    // Además, los dos primeros rangos solo ven rutas regionales/nacionales.
    return rankMatched;
  }, [
    availableItineraries,
    central.airportCode,
    dispatchFlightMode,
    profile?.career_rank_code,
    profile?.rank_code,
    selectedAircraftRecord,
  ]);
  const regularSelectedItineraryRecord = useMemo(
    () => filteredItineraries.find((option) => option.itinerary_id === selectedItinerary) ?? null,
    [filteredItineraries, selectedItinerary],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    console.debug("[dispatch-filter]", {
      scope: "dashboard",
      flightType: selectedFlightType,
      flightMode: dispatchFlightMode,
      airport: central.airportCode,
      aircraftTotal: availableAircraft.length,
      itinerariesTotal: availableItineraries.length,
      filteredItineraries: filteredItineraries.length,
      selectedAircraftType:
        selectedAircraftRecord?.aircraft_type_code ??
        selectedAircraftRecord?.aircraft_code ??
        null,
    });
  }, [
    availableAircraft.length,
    availableItineraries.length,
    central.airportCode,
    dispatchFlightMode,
    filteredItineraries.length,
    selectedAircraftRecord,
    selectedFlightType,
  ]);

  const charterSelectedItineraryRecord = useMemo(() => {
    if (!isCharterLikeDispatch || !charterOperation) {
      return null;
    }

    const routeCode = charterOperation.routeCode || `CHARTER-${charterOperation.origin}-${charterOperation.destination}`;

    return {
      itinerary_id: charterReservationId ?? routeCode,
      itinerary_code: routeCode,
      itinerary_name: selectedFlightType === "free_flight" ? "Vuelo libre" : "Chárter Patagonia Wings",
      flight_mode: "charter",
      origin_icao: charterOperation.origin,
      destination_icao: charterOperation.destination,
      origin_city: charterOperation.origin,
      destination_city: charterOperation.destination,
      aircraft_type_code: charterOperation.aircraftTypeCode ?? charterOperation.aircraftCode,
      aircraft_type_name: charterOperation.aircraftName,
      compatible_aircraft_types: [charterOperation.aircraftTypeCode ?? charterOperation.aircraftCode].filter(Boolean),
      available_aircraft_count: 1,
      distance_nm: null,
      route_group: selectedFlightType === "free_flight" ? "free_flight" : "charter",
      service_profile: null,
      service_level: null,
      origin_country: null,
      destination_country: null,
      scheduled_block_min: null,
      expected_block_p50: null,
      expected_block_p80: null,
      buffer_departure_min_low: null,
      buffer_departure_min_high: null,
      buffer_arrival_min_low: null,
      buffer_arrival_min_high: null,
      flight_number: charterOperation.flightNumber,
      flight_designator: charterOperation.flightNumber,
    } as AvailableItineraryOption;
  }, [charterOperation, charterReservationId, isCharterLikeDispatch, selectedFlightType]);
  const selectedItineraryRecord = charterSelectedItineraryRecord ?? regularSelectedItineraryRecord;
  const webFlightNumber = useMemo(
    () => buildDispatchFlightNumber(selectedItineraryRecord),
    [selectedItineraryRecord],
  );
  const webFlightNumberValidationValue = useMemo(
    () => getDispatchFlightNumberValidationValue(selectedItineraryRecord),
    [selectedItineraryRecord],
  );
  const webOriginCode =
    selectedItineraryRecord?.origin_icao?.trim().toUpperCase() ?? central.airportCode.trim().toUpperCase();
  const webDestinationCode =
    selectedItineraryRecord?.destination_icao?.trim().toUpperCase() ?? "Pendiente";
  const webOriginAirport = itineraryAirportsByIcao[webOriginCode];
  const webDestinationAirport = itineraryAirportsByIcao[webDestinationCode];
  const webOriginCity = selectedItineraryRecord
    ? getOriginCityLabel(
        selectedItineraryRecord,
        webOriginAirport,
        central.airportCode,
        central.municipality,
      )
    : central.municipality;
  const webDestinationCity = selectedItineraryRecord
    ? getDestinationCityLabel(selectedItineraryRecord, webDestinationAirport)
    : "Pendiente";
  const webOriginCountryCode = resolveCountryCode(
    webOriginAirport?.iso_country ?? central.countryCode,
    webOriginCode,
  );
  const webDestinationCountryCode = resolveCountryCode(
    webDestinationAirport?.iso_country ?? selectedItineraryRecord?.destination_country ?? null,
    webDestinationCode,
  );
  const webAirframe = useMemo(() => {
    const normalized = resolveSimbriefType(selectedAircraftRecord?.aircraft_code ?? "").trim().toUpperCase();
    return normalized || "Pendiente";
  }, [selectedAircraftRecord]);
  const webDispatchDistanceNm = useMemo(
    () => resolveWebDispatchDistanceNm(selectedItineraryRecord, webOriginAirport, webDestinationAirport),
    [selectedItineraryRecord, webDestinationAirport, webOriginAirport],
  );
  const webDispatchDurationMinutes = useMemo(
    () =>
      resolveWebDispatchDurationMinutes(
        selectedItineraryRecord,
        webDispatchDistanceNm,
        selectedAircraftRecord?.aircraft_type_code ?? selectedAircraftRecord?.aircraft_code ?? null,
      ),
    [
      selectedAircraftRecord?.aircraft_code,
      selectedAircraftRecord?.aircraft_type_code,
      selectedItineraryRecord,
      webDispatchDistanceNm,
    ],
  );
  const simbriefOriginCode = simbriefSummary?.origin?.trim().toUpperCase() ?? "Pendiente";
  const simbriefDestinationCode = simbriefSummary?.destination?.trim().toUpperCase() ?? "Pendiente";
  const simbriefOriginAirport = itineraryAirportsByIcao[simbriefOriginCode];
  const simbriefDestinationAirport = itineraryAirportsByIcao[simbriefDestinationCode];
  const simbriefOriginCity =
    simbriefOriginAirport?.municipality?.trim() ||
    simbriefOriginAirport?.name?.trim() ||
    (simbriefSummary?.origin ? simbriefSummary.origin : "Pendiente");
  const simbriefDestinationCity =
    simbriefDestinationAirport?.municipality?.trim() ||
    simbriefDestinationAirport?.name?.trim() ||
    (simbriefSummary?.destination ? simbriefSummary.destination : "Pendiente");
  const simbriefOriginCountryCode = resolveCountryCode(
    simbriefOriginAirport?.iso_country ?? null,
    simbriefSummary?.origin ?? null,
  );
  const simbriefDestinationCountryCode = resolveCountryCode(
    simbriefDestinationAirport?.iso_country ?? null,
    simbriefSummary?.destination ?? null,
  );
  const simbriefAirframe = useMemo(() => {
    const normalized = resolveSimbriefType(simbriefSummary?.airframe ?? "").trim().toUpperCase();
    return normalized || "Pendiente";
  }, [simbriefSummary]);
  const simbriefAirlineIcaoForDispatch = useMemo(
    () => resolveSimbriefAirlineForDispatch(webFlightNumberValidationValue, simbriefSummary?.airlineIcao),
    [simbriefSummary?.airlineIcao, webFlightNumberValidationValue],
  );
  const simbriefFlightNumberDisplay = useMemo(
    () => formatSimbriefFlightNumber(simbriefSummary?.flightNumber, simbriefAirlineIcaoForDispatch),
    [simbriefAirlineIcaoForDispatch, simbriefSummary?.flightNumber],
  );
  const simbriefFlightNumberValidationValue = useMemo(
    () => getSimbriefFlightNumberValidationValue(simbriefSummary?.flightNumber, simbriefAirlineIcaoForDispatch),
    [simbriefAirlineIcaoForDispatch, simbriefSummary?.flightNumber],
  );
  const simbriefEconomyEstimate = useMemo(() => {
    if (!simbriefSummary) return null;
    return estimateSimbriefFlightEconomy({
      distanceNm: simbriefSummary.distanceNm ?? webDispatchDistanceNm ?? null,
      blockMinutes: simbriefSummary.eteMinutes ?? webDispatchDurationMinutes ?? null,
      aircraftTypeCode: simbriefSummary.airframe ?? selectedAircraftRecord?.aircraft_type_code ?? selectedAircraftRecord?.aircraft_code ?? null,
      operationType: isCharterLikeDispatch ? "CHARTER" : "CAREER",
      operationCategory: isCharterLikeDispatch ? "charter" : selectedItineraryRecord?.route_category ?? selectedItineraryRecord?.service_profile ?? null,
      originIcao: simbriefSummary.origin ?? webOriginCode,
      destinationIcao: simbriefSummary.destination ?? webDestinationCode,
      originCountry: simbriefOriginCountryCode,
      destinationCountry: simbriefDestinationCountryCode,
      passengerCount: simbriefSummary.pax ?? null,
      cargoKg: simbriefSummary.cargoKg ?? null,
      payloadKg: simbriefSummary.payloadKg ?? null,
      tripFuelKg: simbriefSummary.tripFuelKg ?? null,
      taxiFuelKg: simbriefSummary.taxiFuelKg ?? null,
      reserveFuelKg: simbriefSummary.reserveFuelKg ?? null,
      blockFuelKg: simbriefSummary.blockFuelKg ?? null,
    });
  }, [
    isCharterLikeDispatch,
    selectedAircraftRecord?.aircraft_code,
    selectedAircraftRecord?.aircraft_type_code,
    selectedItineraryRecord?.route_category,
    selectedItineraryRecord?.service_profile,
    simbriefDestinationCountryCode,
    simbriefOriginCountryCode,
    simbriefSummary,
    webDestinationCode,
    webDispatchDistanceNm,
    webDispatchDurationMinutes,
    webOriginCode,
  ]);
  const dispatchValidationItems = useMemo<DispatchValidationItem[]>(() => {
    const summary = simbriefSummary;
    const expectedFlightNumber = normalizePatagoniaFlightIdentifier(webFlightNumberValidationValue);
    const expectedOrigin = normalizeDispatchComparisonValue(webOriginCode);
    const expectedDestination = normalizeDispatchComparisonValue(webDestinationCode);
    const expectedAirframe = normalizeDispatchComparisonValue(webAirframe);
    const actualFlightNumber = normalizePatagoniaFlightIdentifier(simbriefFlightNumberValidationValue);
    const actualOrigin = normalizeDispatchComparisonValue(summary?.origin);
    const actualDestination = normalizeDispatchComparisonValue(summary?.destination);
    const actualAirframe = normalizeDispatchComparisonValue(
      resolveSimbriefType(summary?.airframe ?? ""),
    );

    return [
      {
        key: "flight_number",
        label: "Numero de vuelo",
        webValue: webFlightNumber,
        simbriefValue: simbriefFlightNumberDisplay,
        matches:
          Boolean(summary) &&
          Boolean(expectedFlightNumber) &&
          Boolean(actualFlightNumber) &&
          expectedFlightNumber === actualFlightNumber,
      },
      {
        key: "origin",
        label: "Origen",
        webValue: webOriginCode,
        simbriefValue: summary?.origin?.trim() || "Pendiente",
        matches:
          Boolean(summary) &&
          Boolean(expectedOrigin) &&
          Boolean(actualOrigin) &&
          expectedOrigin === actualOrigin,
      },
      {
        key: "destination",
        label: "Destino",
        webValue: webDestinationCode,
        simbriefValue: summary?.destination?.trim() || "Pendiente",
        matches:
          Boolean(summary) &&
          Boolean(expectedDestination) &&
          Boolean(actualDestination) &&
          expectedDestination === actualDestination,
      },
      {
        key: "airframe",
        label: "Airframe",
        webValue: webAirframe,
        simbriefValue: simbriefAirframe,
        matches:
          Boolean(summary) &&
          Boolean(expectedAirframe) &&
          Boolean(actualAirframe) &&
          expectedAirframe === actualAirframe,
      },
    ];
  }, [
    simbriefAirframe,
    simbriefFlightNumberDisplay,
    simbriefFlightNumberValidationValue,
    simbriefSummary,
    webAirframe,
    webDestinationCode,
    webFlightNumber,
    webFlightNumberValidationValue,
    webOriginCode,
  ]);
  const canValidateDispatch = useMemo(
    () => Boolean(simbriefSummary) && dispatchValidationItems.every((item) => item.matches),
    [dispatchValidationItems, simbriefSummary],
  );
  const summaryDispatchRoute = simbriefSummary?.routeText?.trim() || "Pendiente";
  const summaryDispatchDistance =
    webDispatchDistanceNm != null ? `${formatInteger(webDispatchDistanceNm)} NM` : "Pendiente";
  const summaryDispatchDuration = formatDurationMinutes(webDispatchDurationMinutes);
  const summaryAirframeDisplay = selectedAircraftRecord
    ? `${selectedAircraftRecord.aircraft_name} · ${webAirframe}`
    : "Pendiente";
  const canDispatchFlight =
    Boolean(profile) &&
    Boolean(selectedAircraftRecord) &&
    Boolean(selectedItineraryRecord) &&
    dispatchReady;

  useEffect(() => {
    const currentAirportCode = central.airportCode.trim().toUpperCase();
    const baseMap: Record<string, ItineraryAirportMeta> = currentAirportCode
      ? {
          [currentAirportCode]: {
            ident: currentAirportCode,
            name: central.airportName || null,
            municipality: central.municipality || null,
            iso_country: central.countryCode || null,
            latitude_deg: null,
            longitude_deg: null,
          },
        }
      : {};

    const airportCodes = Array.from(
      new Set(
        [
          ...filteredItineraries.flatMap((item) => [item.origin_icao, item.destination_icao]),
          selectedItineraryRecord?.origin_icao,
          selectedItineraryRecord?.destination_icao,
          charterOperation?.origin,
          charterOperation?.destination,
        ]
          .map((code) => code?.trim().toUpperCase())
          .filter((code): code is string => Boolean(code)),
      ),
    );

    if (airportCodes.length === 0) {
      setItineraryAirportsByIcao(baseMap);
      return;
    }

    let isCancelled = false;

    const mapRowToAirportMeta = (row: Record<string, unknown>): ItineraryAirportMeta | null => {
      const ident = typeof row.ident === "string" ? row.ident.trim().toUpperCase() : "";
      if (!ident) {
        return null;
      }

      const latitudeValue =
        typeof row.latitude_deg === "number" ? row.latitude_deg : Number(row.latitude_deg ?? NaN);
      const longitudeValue =
        typeof row.longitude_deg === "number" ? row.longitude_deg : Number(row.longitude_deg ?? NaN);

      return {
        ident,
        name: typeof row.name === "string" ? row.name : null,
        municipality: typeof row.municipality === "string" ? row.municipality : null,
        iso_country: typeof row.iso_country === "string" ? row.iso_country : null,
        latitude_deg: Number.isFinite(latitudeValue) ? latitudeValue : null,
        longitude_deg: Number.isFinite(longitudeValue) ? longitudeValue : null,
      };
    };

    const loadItineraryAirports = async () => {
      try {
        const withCoords = await supabase
          .from("airports")
          .select("ident, name, municipality, iso_country, latitude_deg, longitude_deg")
          .in("ident", airportCodes);

        const airportRows =
          withCoords.error || !withCoords.data
            ? await supabase
                .from("airports")
                .select("ident, name, municipality, iso_country")
                .in("ident", airportCodes)
            : withCoords;

        if (airportRows.error) {
          throw airportRows.error;
        }

        const nextMap = { ...baseMap };
        for (const rawRow of (airportRows.data ?? []) as Array<Record<string, unknown>>) {
          const airportMeta = mapRowToAirportMeta(rawRow);
          if (airportMeta) {
            nextMap[airportMeta.ident] = airportMeta;
          }
        }

        if (!isCancelled) {
          setItineraryAirportsByIcao(nextMap);
        }
      } catch {
        if (!isCancelled) {
          setItineraryAirportsByIcao(baseMap);
        }
      }
    };

    void loadItineraryAirports();

    return () => {
      isCancelled = true;
    };
  }, [
    central.airportCode,
    central.airportName,
    central.countryCode,
    central.municipality,
    charterOperation?.destination,
    charterOperation?.origin,
    filteredItineraries,
    selectedItineraryRecord?.destination_icao,
    selectedItineraryRecord?.origin_icao,
  ]);

  useEffect(() => {
    if (selectedAircraft && !selectedAircraftRecord) {
      setSelectedAircraft(null);
      setSelectedItinerary(null);
      setDispatchReady(false);
      setSimbriefGenerationActive(false);
      setSimbriefSummary(null);
      setSimbriefInfoMessage("");
      setSimbriefErrorMessage("");
      setPreparedReservationId(null);
      setSummaryInfoMessage("");
      setSummaryErrorMessage("");
    }
  }, [selectedAircraft, selectedAircraftRecord]);

  useEffect(() => {
    if (selectedItinerary && !selectedItineraryRecord) {
      setSelectedItinerary(null);
      setDispatchReady(false);
      setSimbriefGenerationActive(false);
      setSimbriefSummary(null);
      setSimbriefInfoMessage("");
      setSimbriefErrorMessage("");
      setPreparedReservationId(null);
      setSummaryInfoMessage("");
      setSummaryErrorMessage("");
    }
  }, [selectedItinerary, selectedItineraryRecord]);

  const isStepEnabled = (step: DispatchStepKey) => {
    const isLocked = Boolean(preparedReservationId);
    switch (step) {
      case "flight_type":
        return !isLocked;
      case "aircraft":
        return !isLocked && canOpenAircraft;
      case "itinerary":
        return !isLocked && canOpenItinerary;
      case "dispatch_flow":
        return !isLocked && canOpenDispatch;
      case "summary":
        return canOpenSummary;
      default:
        return false;
    }
  };

  const stepStatusLabel = {
    flightType: selectedFlightType
      ? DISPATCH_FLIGHT_TYPE_OPTIONS.find((option) => option.id === selectedFlightType)?.title ?? "Listo"
      : "Pendiente",
    aircraft: selectedAircraftRecord
      ? `${selectedAircraftRecord.tail_number} · ${selectedAircraftRecord.aircraft_name}`
      : "Pendiente",
    itinerary: selectedItineraryRecord
      ? `${selectedItineraryRecord.itinerary_code} · ${selectedItineraryRecord.origin_icao} - ${selectedItineraryRecord.destination_icao}`
      : "Pendiente",
    dispatch: preparedReservationId
      ? "Despachado ✓"
      : dispatchReady
        ? "Listo para despachar"
        : "Pendiente",
  };

  const handleStepChange = (step: DispatchStepKey) => {
    if (!isStepEnabled(step)) {
      return;
    }

    setDispatchStep(step);
  };

  const resetAfterFlightType = (nextFlightType: DispatchFlightTypeId) => {
    setSelectedFlightType(nextFlightType);
    setSelectedAircraft(null);
    setSelectedItinerary(null);
    setCharterReservationId(null);
    setCharterOperation(null);
    setDispatchReady(false);
    setSimbriefSummary(null);
    setSimbriefInfoMessage("");
    setSimbriefErrorMessage("");
    setPreparedReservationId(null);
    setSummaryInfoMessage("");
    setSummaryErrorMessage("");
    setDispatchStep("aircraft");
  };

  const resetAfterAircraft = (nextAircraft: string) => {
    setSelectedAircraft(nextAircraft);
    setSelectedItinerary(null);
    setCharterReservationId(null);
    setCharterOperation(null);
    setDispatchReady(false);
    setSimbriefSummary(null);
    setSimbriefInfoMessage("");
    setSimbriefErrorMessage("");
    setPreparedReservationId(null);
    setSummaryInfoMessage("");
    setSummaryErrorMessage("");
  };

  const resetAfterItinerary = (nextItinerary: string) => {
    setSelectedItinerary(nextItinerary);
    setCharterReservationId(null);
    setCharterOperation(null);
    setDispatchReady(false);
    setSimbriefSummary(null);
    setSimbriefInfoMessage("");
    setSimbriefErrorMessage("");
    setPreparedReservationId(null);
    setSummaryInfoMessage("");
    setSummaryErrorMessage("");
    setDispatchStep("dispatch_flow");
  };

  async function handleLoadSimbriefData(staticIdOverride?: string | null) {
    if (!profile?.simbrief_username?.trim()) {
      setDispatchReady(false);
      setSimbriefGenerationActive(false);
      setSimbriefSummary(null);
      setSimbriefInfoMessage("");
      setSimbriefErrorMessage("Falta tu usuario SimBrief en Perfil para cargar el OFP automático.");
      setSummaryInfoMessage("");
      setSummaryErrorMessage("");
      return;
    }

    setSyncingSimbrief(true);
    setDispatchReady(false);
    setSimbriefInfoMessage("");
    setSimbriefErrorMessage("");
    setSummaryInfoMessage("");
    setSummaryErrorMessage("");

    try {
      const search = new URLSearchParams({
        username: profile.simbrief_username.trim(),
      });

      const effectiveStaticId = staticIdOverride ?? simbriefStaticId;
      if (effectiveStaticId) {
        search.set("static_id", effectiveStaticId);
      }

      const response = await fetch(`/api/simbrief/ofp?${search.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as
        | { ok: true; summary: SimbriefOfpSummary; matchedByStaticId: boolean }
        | { error?: string };

      if (!response.ok || !("ok" in data)) {
        throw new Error(
          data && "error" in data ? data.error || "No se pudo leer el OFP real." : "No se pudo leer el OFP real."
        );
      }

      setSimbriefGenerationActive(false);
      setSimbriefSummary(data.summary);
      setSimbriefInfoMessage(
        "OFP cargado automáticamente desde SimBrief. Revisa la validación antes de continuar al resumen."
      );
      setSimbriefErrorMessage("");
      setPreparedReservationId(null);
    } catch (error) {
      setSimbriefGenerationActive(false);
      setSimbriefSummary(null);
      setSimbriefInfoMessage("");
      setSimbriefErrorMessage(
        error instanceof Error ? error.message : "No se pudo cargar el OFP automático desde SimBrief."
      );
      setPreparedReservationId(null);
    } finally {
      setSyncingSimbrief(false);
    }
  }

  useEffect(() => {
    function handleSimbriefReturn(event: MessageEvent) {
      if (event.origin !== window.location.origin) {
        return;
      }

      const payload = event.data as
        | { type?: string; staticId?: string | null; username?: string | null }
        | null;

      if (!payload || payload.type !== "PWG_SIMBRIEF_OFP_READY") {
        return;
      }

      const returnedStaticId = payload.staticId?.trim() || simbriefStaticId;
      if (returnedStaticId) {
        setSimbriefStaticId(returnedStaticId);
      }

      setSimbriefGenerationActive(false);
      setNavigraphInfoMessage("SimBrief terminó de generar el OFP. Cargando datos automáticamente en Patagonia Wings...");
      void handleLoadSimbriefData(returnedStaticId);
    }

    window.addEventListener("message", handleSimbriefReturn);
    return () => window.removeEventListener("message", handleSimbriefReturn);
  }, [profile?.simbrief_username, simbriefStaticId]);

  function handleValidateDispatch() {
    if (!simbriefSummary) {
      setDispatchReady(false);
      setSimbriefInfoMessage("");
      setSimbriefErrorMessage("Primero debes cargar el OFP automático desde SimBrief.");
      setPreparedReservationId(null);
      setSummaryInfoMessage("");
      setSummaryErrorMessage("");
      return;
    }

    if (!canValidateDispatch) {
      setDispatchReady(false);
      setSimbriefInfoMessage("");
      setSimbriefErrorMessage(
        "No se puede validar: vuelo, origen, destino o airframe no coinciden entre la web y SimBrief."
      );
      setPreparedReservationId(null);
      setSummaryInfoMessage("");
      setSummaryErrorMessage("");
      return;
    }

    setDispatchReady(true);
    setSimbriefErrorMessage("");
    setSimbriefInfoMessage("Despacho validado correctamente. Ya puedes continuar al resumen.");
    setSummaryInfoMessage("");
    setSummaryErrorMessage("");
  }

  async function handleDispatchFlight() {
    if (!profile) {
      setSummaryInfoMessage("");
      setSummaryErrorMessage("No se pudo identificar el perfil del piloto para despachar.");
      return;
    }

    if (!selectedAircraftRecord || !selectedItineraryRecord) {
      setSummaryInfoMessage("");
      setSummaryErrorMessage("Faltan aeronave o itinerario para dejar el vuelo listo.");
      return;
    }

    if (!simbriefSummary) {
      setSummaryInfoMessage("");
      setSummaryErrorMessage("Debes importar un OFP desde SimBrief antes de guardar el despacho final para ACARS.");
      return;
    }

    if (!canValidateDispatch) {
      setSummaryInfoMessage("");
      setSummaryErrorMessage("El OFP no coincide con la reserva web. Corrige vuelo, origen, destino o aeronave antes de guardar el despacho.");
      return;
    }

    if (!dispatchReady) {
      setSummaryInfoMessage("");
      setSummaryErrorMessage("Primero debes validar el despacho para dejar el vuelo listo para ACARS.");
      return;
    }

    setFinalizingDispatch(true);
    setSummaryInfoMessage("");
    setSummaryErrorMessage("");

    try {
      const normalizedFlightNumber =
        isCharterLikeDispatch
          ? compactFlightIdentifier(profile.callsign) || webFlightNumberValidationValue || "PWG000"
          : webFlightNumberValidationValue ||
            compactFlightIdentifier(selectedItineraryRecord.flight_designator) ||
            compactFlightIdentifier(selectedItineraryRecord.flight_number) ||
            `PWG${webFlightNumberValidationValue || "000"}`;
      const dispatchRouteCode = isCharterLikeDispatch
        ? selectedItineraryRecord.itinerary_code
        : normalizedFlightNumber;
      const remarks = [
        "DISPATCHED_FROM_DASHBOARD",
        simbriefSummary?.staticId ? `STATIC ${simbriefSummary.staticId}` : null,
        simbriefSummary?.aircraftRegistration ? `REG ${simbriefSummary.aircraftRegistration}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      const finalOperation: FlightOperationRecord = {
        reservationId: preparedReservationId ?? charterReservationId,
        userId: profile.id,
        itineraryId: isCharterLikeDispatch ? null : selectedItineraryRecord.itinerary_id,
        aircraftId: selectedAircraftRecord.aircraft_id,
        flightMode: dispatchFlightMode ?? selectedItineraryRecord.flight_mode ?? "itinerary",
        routeCode: dispatchRouteCode,
        flightNumber: normalizedFlightNumber,
        origin: webOriginCode,
        destination: webDestinationCode,
        aircraftCode: selectedAircraftRecord.aircraft_code,
        aircraftTypeCode:
          selectedAircraftRecord.aircraft_type_code ??
          selectedAircraftRecord.aircraft_code,
        aircraftName: selectedAircraftRecord.aircraft_name,
        aircraftTailNumber:
          selectedAircraftRecord.tail_number || simbriefSummary?.aircraftRegistration?.trim() || "",
        aircraftVariantCode: selectedAircraftRecord.aircraft_variant_code ?? "",
        aircraftAddonProvider: selectedAircraftRecord.addon_provider ?? "",
        aircraftVariantLabel: selectedAircraftRecord.variant_name ?? selectedAircraftRecord.aircraft_variant_code ?? "",
        routeText: simbriefSummary?.routeText?.trim() || charterOperation?.routeText || selectedItineraryRecord.itinerary_code,
        scheduledDeparture:
          isCharterLikeDispatch && charterOperation?.scheduledDeparture
            ? charterOperation.scheduledDeparture
            : departureHHMMtoISO(selectedDepartureHHMM),
        remarks,
        status: "dispatch_ready",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveFlightOperation(profile, finalOperation, "dispatch_ready");
      await markDispatchPrepared(saved.id, profile.simbrief_username ?? "", profile.callsign, {

          routeText: simbriefSummary.routeText ?? undefined,
          cruiseLevel: simbriefSummary.cruiseAltitude ?? undefined,
          alternateIcao: simbriefSummary.alternate ?? undefined,
          passengerCount: simbriefSummary.pax ?? undefined,
          cargoKg: simbriefSummary.cargoKg ?? undefined,
          tripFuelKg: simbriefSummary.tripFuelKg ?? undefined,
          reserveFuelKg: simbriefSummary.reserveFuelKg ?? undefined,
          taxiFuelKg: simbriefSummary.taxiFuelKg ?? undefined,
          blockFuelKg: simbriefSummary.blockFuelKg ?? undefined,
          payloadKg: simbriefSummary.payloadKg ?? undefined,
          zfwKg: simbriefSummary.zfwKg ?? undefined,
          staticId: simbriefSummary.staticId ?? undefined,
          flightNumber: normalizedFlightNumber,
          originIcao: simbriefSummary.origin ?? webOriginCode,
          destinationIcao: simbriefSummary.destination ?? webDestinationCode,
          airframe: simbriefSummary.airframe ?? selectedAircraftRecord.aircraft_code,
          aircraftRegistration:
            simbriefSummary.aircraftRegistration ?? selectedAircraftRecord.tail_number ?? undefined,
          distanceNm: simbriefSummary.distanceNm ?? undefined,
          eteMinutes: simbriefSummary.eteMinutes ?? undefined,
          generatedAtIso: simbriefSummary.generatedAtIso ?? undefined,
          matchedByStaticId: simbriefSummary.matchedByStaticId,
          rawUnits: simbriefSummary.rawUnits ?? undefined,
          pdfUrl: simbriefSummary.pdfUrl ?? undefined,
          scheduledBlockMinutes:
            webDispatchDurationMinutes ??
            selectedItineraryRecord.scheduled_block_min ??
            simbriefSummary.eteMinutes ??
            undefined,
          expectedBlockP50Minutes:
            webDispatchDurationMinutes ??
            selectedItineraryRecord.expected_block_p50 ??
            simbriefSummary.eteMinutes ??
            undefined,
          expectedBlockP80Minutes:
            webDispatchDurationMinutes ??
            selectedItineraryRecord.expected_block_p80 ??
            simbriefSummary.eteMinutes ??
            undefined,
        }
      );
      setPreparedReservationId(saved.id);
      setSummaryErrorMessage("");
      setSummaryInfoMessage(
        "Vuelo validado contra OFP y guardado en la base operativa. ACARS ya puede rescatar este despacho final desde la web."
      );
    } catch (error) {
      setSummaryInfoMessage("");
      setSummaryErrorMessage(
        error instanceof Error
          ? error.message
          : typeof error === "object" && error
            ? JSON.stringify(error)
            : "No se pudo despachar el vuelo a la base operativa."
      );
  } finally {
      setFinalizingDispatch(false);
    }
  }

  const activeOriginCode = activeReservation?.origin_ident?.trim().toUpperCase() ?? "----";
  const activeDestinationCode = activeReservation?.destination_ident?.trim().toUpperCase() ?? "----";
  const activeOriginAirport = itineraryAirportsByIcao[activeOriginCode];
  const activeDestinationAirport = itineraryAirportsByIcao[activeDestinationCode];
  const activeItineraryRecord = useMemo(
    () =>
      availableItineraries.find((item) => {
        const sameRoute =
          activeReservation?.route_code?.trim() &&
          item.itinerary_code?.trim() &&
          item.itinerary_code.trim().toUpperCase() === activeReservation.route_code.trim().toUpperCase();
        const sameAirports =
          item.origin_icao.trim().toUpperCase() === activeOriginCode &&
          item.destination_icao.trim().toUpperCase() === activeDestinationCode;
        return Boolean(sameRoute || sameAirports);
      }) ?? null,
    [activeDestinationCode, activeOriginCode, activeReservation?.route_code, availableItineraries],
  );
  const activeRouteDistanceNm = useMemo(() => {
    const itineraryDistance =
      typeof activeItineraryRecord?.distance_nm === "number" && activeItineraryRecord.distance_nm > 0
        ? activeItineraryRecord.distance_nm
        : 0;
    if (itineraryDistance > 0) {
      return itineraryDistance;
    }
    return calculateDistanceNm(activeOriginAirport, activeDestinationAirport) ?? 0;
  }, [activeDestinationAirport, activeItineraryRecord, activeOriginAirport]);
  const activeEstimatedMinutes = useMemo(
    () =>
      activeRouteDistanceNm > 0
        ? estimateBlockMinutes(activeRouteDistanceNm, activeReservation?.aircraft_type_code)
        : 0,
    [activeReservation?.aircraft_type_code, activeRouteDistanceNm],
  );
  const activeLivePayload = useMemo(() => getNestedRecord(activeReservation?.score_payload, "acars_live"), [activeReservation?.score_payload]);
  const activeLiveSample = useMemo(() => getNestedRecord(activeReservation?.score_payload, "acars_live", "last_sample"), [activeReservation?.score_payload]);
  const activeLiveLatitude = useMemo(() => getNestedNumber(activeLiveSample, "latitude") ?? getNestedNumber(activeLiveSample, "lat"), [activeLiveSample]);
  const activeLiveLongitude = useMemo(() => getNestedNumber(activeLiveSample, "longitude") ?? getNestedNumber(activeLiveSample, "lon") ?? getNestedNumber(activeLiveSample, "lng"), [activeLiveSample]);
  const activeLiveGroundSpeed = useMemo(() => getNestedNumber(activeLiveSample, "groundSpeed") ?? getNestedNumber(activeLiveSample, "ground_speed") ?? getNestedNumber(activeLiveSample, "groundSpeedKts"), [activeLiveSample]);
  const activeLivePhase = useMemo(() => getNestedText(activeLivePayload, "phase") || getNestedText(activeLiveSample, "phase"), [activeLivePayload, activeLiveSample]);
  const activeStatusIsLive = useMemo(() => {
    const normalizedStatus = activeReservation?.status?.trim().toLowerCase() ?? "";
    return normalizedStatus === "in_progress" || normalizedStatus === "in_flight";
  }, [activeReservation?.status]);
  const activeHasLivePosition = activeStatusIsLive && activeLiveLatitude != null && activeLiveLongitude != null;
  const activeLiveDistanceFromOriginNm = useMemo(() => {
    if (!activeHasLivePosition) return null;
    return calculateCoordinateDistanceNm(activeOriginAirport?.latitude_deg, activeOriginAirport?.longitude_deg, activeLiveLatitude, activeLiveLongitude);
  }, [activeHasLivePosition, activeLiveLatitude, activeLiveLongitude, activeOriginAirport]);
  const activeLiveDistanceToDestinationNm = useMemo(() => {
    if (!activeHasLivePosition) return null;
    return calculateCoordinateDistanceNm(activeLiveLatitude, activeLiveLongitude, activeDestinationAirport?.latitude_deg, activeDestinationAirport?.longitude_deg);
  }, [activeDestinationAirport, activeHasLivePosition, activeLiveLatitude, activeLiveLongitude]);
  const activeFlightProgress = useMemo(() => {
    if (!activeReservation || !activeStatusIsLive || !activeHasLivePosition) return 0;
    const flown = activeLiveDistanceFromOriginNm;
    const remaining = activeLiveDistanceToDestinationNm;
    if (flown != null && remaining != null && flown + remaining > 0) return clamp01(flown / (flown + remaining));
    if (flown != null && activeRouteDistanceNm > 0) return clamp01(flown / activeRouteDistanceNm);
    return 0;
  }, [activeHasLivePosition, activeLiveDistanceFromOriginNm, activeLiveDistanceToDestinationNm, activeReservation, activeRouteDistanceNm, activeStatusIsLive]);
  const activeDistanceFromOriginNm = useMemo(() => {
    if (!activeStatusIsLive || !activeHasLivePosition) return 0;
    if (activeLiveDistanceFromOriginNm != null) return Math.max(0, Math.round(activeLiveDistanceFromOriginNm));
    return Math.max(0, Math.round(activeRouteDistanceNm * clamp01(activeFlightProgress)));
  }, [activeFlightProgress, activeHasLivePosition, activeLiveDistanceFromOriginNm, activeRouteDistanceNm, activeStatusIsLive]);
  const activeDistanceToDestinationNm = useMemo(() => {
    if (!activeStatusIsLive || !activeHasLivePosition) return Math.max(0, Math.round(activeRouteDistanceNm));
    if (activeLiveDistanceToDestinationNm != null) return Math.max(0, Math.round(activeLiveDistanceToDestinationNm));
    return Math.max(0, Math.round(activeRouteDistanceNm - activeDistanceFromOriginNm));
  }, [activeDistanceFromOriginNm, activeHasLivePosition, activeLiveDistanceToDestinationNm, activeRouteDistanceNm, activeStatusIsLive]);
  const activeProgressLabel = useMemo(() => {
    const normalizedStatus = activeReservation?.status?.trim().toLowerCase() ?? "";
    if (normalizedStatus === "reserved") return "Reserva creada";
    if (normalizedStatus === "dispatched" || normalizedStatus === "dispatch_ready") return "Despacho preparado";
    if ((normalizedStatus === "in_progress" || normalizedStatus === "in_flight") && activeHasLivePosition) return "Vuelo en vivo";
    if (normalizedStatus === "in_progress" || normalizedStatus === "in_flight") return "Vuelo iniciado · esperando telemetría";
    return "Seguimiento";
  }, [activeHasLivePosition, activeReservation?.status]);
  const activeProgressPercent = Math.round(clamp01(activeFlightProgress) * 100);

  return (
    <section className="glass-panel rounded-[30px] p-4 sm:p-5 lg:p-6">
      <div className="border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {DASHBOARD_TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            // Bloquear Despacho si hay un vuelo reservado/despachado activo
            const isDispatchBlocked = tab.key === "dispatch" && Boolean(activeReservation) && !["completed", "cancelled"].includes(activeReservation?.status ?? "");
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => { if (!isDispatchBlocked) onChangeTab(tab.key); }}
                disabled={isDispatchBlocked}
                title={isDispatchBlocked ? `Vuelo ${activeReservation?.route_code ?? "activo"} en curso — finaliza o cancela el vuelo para despachar uno nuevo` : undefined}
                className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                    : isDispatchBlocked
                    ? "cursor-not-allowed border border-white/8 bg-white/[0.02] text-white/28 opacity-60"
                    : "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                }`}
              >
                {tab.label}
                {isDispatchBlocked ? " 🔒" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-5">
        {activeTab === "central" ? (
          <div className="surface-outline rounded-[28px] p-4 sm:p-5 lg:p-6">
            <CentralWorkspace central={central} />
          </div>
        ) : null}

        {activeTab === "dispatch" ? (
          <div className="space-y-4">
            <div className="surface-outline rounded-[26px] p-4 sm:p-5 lg:p-6">
              <div className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(6,22,44,0.88),rgba(4,15,30,0.92))] p-4 sm:p-5">
                <DispatchOverviewHeader central={central} metar={dispatchMetar} />

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-b border-white/8 pb-4">
                  {DISPATCH_STEPS.map((step) => {
                    const isActive = step.key === dispatchStep;
                    const isEnabled = isStepEnabled(step.key);
                    return (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() => handleStepChange(step.key)}
                        disabled={!isEnabled}
                        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                          isActive
                            ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                            : isEnabled
                            ? "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                            : "cursor-not-allowed border border-white/8 bg-white/[0.02] text-white/28 opacity-70"
                        }`}
                        title={isEnabled ? step.shortLabel : "Completa el paso anterior para habilitarlo"}
                      >
                        {step.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 min-h-[620px] rounded-[22px] border border-cyan-400/14 bg-[radial-gradient(circle_at_top,rgba(22,168,255,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 sm:min-h-[700px] lg:min-h-[820px] lg:p-5">
                  {dispatchStep === "flight_type" ? (
                    <div className="space-y-4">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                          Paso 1
                        </p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">Tipo de vuelo</h4>
                        <p className="hidden mt-3 text-sm leading-7 text-white/72">
                          Antes de tomar aeronave, aquí defines el perfil operativo del vuelo. Hasta que no elijas una
                          modalidad, Aeronave seguirá bloqueado.
                        </p>

                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Antes de tomar aeronave, define el modo operativo de tu vuelo. Solo puedes escoger una opcion
                          para habilitar el paso de aeronave.
                        </p>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {DISPATCH_VISIBLE_FLIGHT_TYPE_OPTIONS.map((option) => {
                            const isSelected = selectedFlightType === option.id;
                            const isComingSoon = option.comingSoon === true;

                            return (
                              <button
                                key={option.id}
                                type="button"
                                aria-pressed={isSelected}
                                disabled={isComingSoon}
                                onClick={() => {
                                  if (!isComingSoon) {
                                    resetAfterFlightType(option.id);
                                  }
                                }}
                                className={`group block w-full overflow-hidden rounded-[20px] border text-left transition duration-200 ${
                                  isComingSoon
                                    ? "cursor-not-allowed border-white/8 bg-white/[0.025] text-white/46"
                                    : isSelected
                                    ? "border-emerald-400/45 bg-emerald-500/[0.12] text-white shadow-[0_16px_34px_rgba(17,181,110,0.18)]"
                                    : "border-white/8 bg-white/[0.03] text-white/76 hover:bg-white/[0.05]"
                                }`}
                              >
                                <div className="relative aspect-[16/10] overflow-hidden rounded-[18px] bg-[#07131f]">
                                  <Image
                                    src={option.imageSrc}
                                    alt={option.title}
                                    fill
                                    sizes="(min-width: 1280px) 26vw, (min-width: 640px) 42vw, 100vw"
                                    className={`object-cover object-center transition duration-500 ${
                                      isComingSoon
                                        ? "scale-[1.02] opacity-50 grayscale"
                                        : isSelected
                                        ? "scale-[1.03]"
                                        : "group-hover:scale-[1.04]"
                                    }`}
                                  />
                                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,14,28,0.08),rgba(4,12,24,0.68))]" />

                                  {isComingSoon ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-[#020814]/48 backdrop-blur-[1px]">
                                      <div className="rounded-full border border-cyan-200/28 bg-black/34 px-6 py-2 text-center shadow-[0_16px_32px_rgba(0,0,0,0.35)]">
                                        <span className="block text-[11px] font-semibold uppercase tracking-[0.38em] text-cyan-100/90">
                                          Pronto
                                        </span>
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="absolute inset-x-0 top-0 flex items-start justify-end px-4 pt-4">
                                    <span
                                      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-xs font-semibold ${
                                        isComingSoon
                                          ? "border-cyan-200/20 bg-black/28 text-cyan-100/72"
                                          : isSelected
                                          ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-100"
                                          : "border-white/18 bg-black/18 text-white/74"
                                      }`}
                                    >
                                      {isComingSoon ? "Pronto" : isSelected ? "Activo" : "Elegir"}
                                    </span>
                                  </div>
                                </div>

                                <div className="px-4 py-4">
                                  <span className={`block text-base font-semibold ${isComingSoon ? "text-white/68" : "text-white"}`}>
                                    {option.title}
                                  </span>
                                  <span className={`mt-2 block text-sm leading-7 ${isComingSoon ? "text-white/46" : "text-white/68"}`}>
                                    {option.description}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-6 border-t border-white/8 pt-5">
                          <p className="text-sm leading-7 text-white/70">
                            {selectedFlightType
                              ? `Seleccionado: ${stepStatusLabel.flightType}. El flujo avanza automaticamente a Aeronave.`
                              : "Debes escoger una opcion para habilitar y abrir automaticamente el paso de aeronave."}
                          </p>
                        </div>
                      </div>

                      <div className="hidden rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Qué define este paso</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              La modalidad elegida marca el contexto del despacho. Desde aquí se conserva el flujo
                              secuencial sin tocar la estructura aprobada del dashboard.
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Estado actual</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              {selectedFlightType
                                ? `Seleccionado: ${stepStatusLabel.flightType}. Ya puedes pasar a Aeronave.`
                                : "Todavía no eliges un tipo de vuelo. Aeronave seguirá bloqueado hasta seleccionar uno."}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-[#031428]/58 p-4 text-sm leading-7 text-white/64">
                          Secuencia activa: primero eliges una de las seis tarjetas; recién después se habilita
                          Aeronave.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => handleStepChange("aircraft")}
                            disabled={!canOpenAircraft}
                            className={`py-3 ${canOpenAircraft ? "button-primary" : "button-secondary cursor-not-allowed opacity-55"}`}
                          >
                            Continuar a aeronave
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {dispatchStep === "aircraft" ? (
                    isCharterLikeDispatch ? (
                      <div className="space-y-4">
                        <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Paso 2</p>
                          <h4 className="mt-3 text-2xl font-semibold text-white">Chárter: origen, destino y aeronave</h4>
                          <p className="mt-3 text-sm leading-7 text-white/72">
                            Para vuelos Chárter y Vuelo libre no se usa el listado de itinerarios regulares. Aquí defines destino,
                            hora local, aeronave disponible en tu aeropuerto actual y creas la reserva directa para que ACARS la pueda leer.
                          </p>
                        </div>

                        {profile ? (
                          <CharterDispatchPanel
                            userId={userId}
                            profile={profile}
                            defaultOriginIcao={central.airportCode}
                            onReserved={(reservation, operation) => {
                              const reservationId = reservation.reservation_id ?? null;
                              const nextOperation: FlightOperationRecord = {
                                ...operation,
                                reservationId,
                                status: "reserved",
                                updatedAt: new Date().toISOString(),
                              };

                              setPreparedReservationId(null);
                              setCharterReservationId(reservationId);
                              setCharterOperation(nextOperation);
                              setSelectedAircraft(operation.aircraftId ?? reservation.aircraft_id ?? null);
                              setSelectedItinerary(null);
                              setDispatchReady(false);
                              setSimbriefSummary(null);
                              setSimbriefStaticId(null);
                              setSimbriefInfoMessage("");
                              setSimbriefErrorMessage("");
                              setSummaryErrorMessage("");

                              if (reservationId) {
                                setActiveReservation({
                                  id: reservationId,
                                  pilot_callsign: profile.callsign,
                                  route_code: reservation.route_code ?? operation.routeCode ?? null,
                                  flight_number: reservation.flight_number ?? operation.flightNumber ?? profile.callsign ?? null,
                                  aircraft_type_code: reservation.aircraft_type_code ?? operation.aircraftTypeCode ?? operation.aircraftCode ?? null,
                                  aircraft_registration: reservation.aircraft_registration ?? operation.aircraftTailNumber ?? null,
                                  origin_ident: reservation.origin_ident ?? operation.origin ?? null,
                                  destination_ident: reservation.destination_ident ?? operation.destination ?? null,
                                  status: reservation.status ?? "reserved",
                                  flight_mode_code: "charter",
                                  score_payload: null,
                                  created_at: new Date().toISOString(),
                                  updated_at: new Date().toISOString(),
                                } as FlightReservationRow & { id: string });
                              }

                              setSummaryInfoMessage("Chárter reservado correctamente. Continúa al paso Despacho para crear o importar el OFP.");
                              setDispatchStep("dispatch_flow");

                              window.requestAnimationFrame(() => {
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              });
                            }}
                          />
                        ) : (
                          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5 text-sm leading-7 text-white/70">
                            Cargando perfil del piloto para preparar el Chárter.
                          </div>
                        )}

                        <div className="flex flex-wrap gap-3">
                          <button type="button" onClick={() => handleStepChange("flight_type")} className="button-secondary py-3">
                            Volver a tipo de vuelo
                          </button>
                        </div>
                      </div>
                    ) : (
                    <div className="space-y-4">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Paso 2</p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">Selección de aeronave</h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Ahora sí puedes tomar aeronave. Al elegir una, se habilitará Itinerario. Si cambias el tipo de vuelo,
                          este paso se resetea para mantener el orden lógico.
                        </p>

                        <div className="mt-5">
                          <DispatchAircraftCascadeSelector
                            rows={
                              selectedItineraryRecord?.service_profile
                                ? availableAircraft.filter((a) =>
                                    isAircraftCompatibleWithRoute(
                                      a.aircraft_type_code ?? a.aircraft_code,
                                      selectedItineraryRecord.service_profile
                                    )
                                  )
                                : availableAircraft
                            }
                            selectedAircraftId={selectedAircraft}
                            onSelect={resetAfterAircraft}
                          />
                        </div>

                        <div className="mt-6 flex flex-col gap-4 border-t border-white/8 pt-5 lg:flex-row lg:items-center lg:justify-between">
                          <p className="text-sm leading-7 text-white/70">
                            {selectedAircraftRecord
                              ? `Aeronave seleccionada: ${selectedAircraftRecord.tail_number} · ${selectedAircraftRecord.aircraft_name}.`
                              : availableAircraft.length > 0
                                ? "Escoge una aeronave de la tabla para continuar al itinerario."
                                : "No tienes aeronaves habilitadas para este tipo de vuelo con tu rango actual."}
                          </p>

                          <div className="flex flex-wrap gap-3">
                            <button type="button" onClick={() => handleStepChange("flight_type")} className="button-secondary py-3">
                              Volver a tipo de vuelo
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStepChange("itinerary")}
                              disabled={!canOpenItinerary}
                              className={`py-3 ${canOpenItinerary ? "button-primary" : "button-secondary cursor-not-allowed opacity-55"}`}
                            >
                              Continuar a itinerario
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="hidden rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Qué se conserva</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Reutilizamos la lógica que ya teníamos para no romper reservas, lectura de flota ni filtros reales.
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Estado actual</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Tipo de vuelo: {stepStatusLabel.flightType}. Aeronave: {stepStatusLabel.aircraft}.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-[#031428]/58 p-4 text-sm leading-7 text-white/64">
                          El paso de Itinerario solo se habilita cuando una aeronave queda seleccionada.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button type="button" onClick={() => handleStepChange("flight_type")} className="button-secondary py-3">
                            Volver a tipo de vuelo
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepChange("itinerary")}
                            disabled={!canOpenItinerary}
                            className={`py-3 ${canOpenItinerary ? "button-primary" : "button-secondary cursor-not-allowed opacity-55"}`}
                          >
                            Continuar a itinerario
                          </button>
                        </div>
                      </div>
                    </div>

                    )
                  ) : null}

                  {dispatchStep === "itinerary" ? (
                    <div className="space-y-4">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Paso 3</p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">Seleccion de itinerario</h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Aqui eliges los itinerarios reales disponibles segun el tipo de vuelo y la aeronave que ya
                          seleccionaste. Sin una ruta confirmada, el paso de Despacho sigue bloqueado.
                        </p>

                        <div className="mt-5">
                          <DispatchItineraryTable
                            rows={filteredItineraries}
                            selectedItineraryId={selectedItinerary}
                            onSelect={resetAfterItinerary}
                            airportsByIcao={itineraryAirportsByIcao}
                            currentAirportCode={central.airportCode}
                            currentAirportCity={central.municipality}
                            currentCountryCode={central.countryCode}
                            selectedAircraftTypeCode={
                              selectedAircraftRecord?.aircraft_type_code ??
                              selectedAircraftRecord?.aircraft_code ??
                              null
                            }
                            departureHHMM={selectedDepartureHHMM}
                            onDepartureTimeChange={setSelectedDepartureHHMM}
                          />
                        </div>

                        <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-[#031428]/58 p-4 text-sm leading-7 text-white/64">
                          {selectedItineraryRecord
                            ? `Itinerario activo: ${selectedItineraryRecord.itinerary_code} ${selectedItineraryRecord.origin_icao}-${selectedItineraryRecord.destination_icao}.`
                            : filteredItineraries.length > 0
                              ? `${filteredItineraries.length} itinerario(s) disponibles para esta combinacion.`
                              : "No hay itinerarios compatibles con esta aeronave desde tu ubicacion actual."}
                        </div>

                        {selectedItineraryRecord ? (
                          <div className="mt-4 rounded-[20px] border border-emerald-300/16 bg-emerald-300/[0.045] p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/55">Economía estimada del itinerario</p>
                                <p className="mt-1 text-sm text-white/58">Valores previos al despacho; el cierre real se recalcula con el PIREP y el ledger.</p>
                              </div>
                              <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs font-semibold text-white/58">
                                {selectedItineraryRecord.origin_icao} → {selectedItineraryRecord.destination_icao}
                              </span>
                            </div>
                            <EconomyMiniGrid
                              distanceNm={Number(selectedItineraryRecord.distance_nm) || null}
                              aircraftTypeCode={selectedAircraftRecord?.aircraft_type_code ?? selectedAircraftRecord?.aircraft_code ?? null}
                              mode="CAREER"
                              originIcao={selectedItineraryRecord.origin_icao}
                              destinationIcao={selectedItineraryRecord.destination_icao}
                              originCountry={selectedItineraryRecord.origin_country}
                              destinationCountry={selectedItineraryRecord.destination_country}
                              operationCategory={selectedItineraryRecord.route_category ?? selectedItineraryRecord.service_profile}
                            />
                          </div>
                        ) : null}

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button type="button" onClick={() => handleStepChange("aircraft")} className="button-secondary py-3">
                            Volver a aeronave
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepChange("dispatch_flow")}
                            disabled={!canOpenDispatch}
                            className={`py-3 ${canOpenDispatch ? "button-primary" : "button-secondary cursor-not-allowed opacity-55"}`}
                          >
                            Continuar a despacho
                          </button>
                        </div>
                      </div>

                      <div className="hidden rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Secuencia vigente</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Tipo de vuelo: {stepStatusLabel.flightType}. Aeronave: {stepStatusLabel.aircraft}. Itinerario: {stepStatusLabel.itinerary}.
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Objetivo visual</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Dejamos el itinerario montado dentro del dashboard para avanzar o retroceder sin salir de esta ventana principal.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-[#031428]/58 p-4 text-sm leading-7 text-white/64">
                          El paso de Despacho se habilita recien cuando una ruta queda confirmada.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button type="button" onClick={() => handleStepChange("aircraft")} className="button-secondary py-3">
                            Volver a aeronave
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepChange("dispatch_flow")}
                            disabled={!canOpenDispatch}
                            className={`py-3 ${canOpenDispatch ? "button-primary" : "button-secondary cursor-not-allowed opacity-55"}`}
                          >
                            Continuar a despacho
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {false && dispatchStep === "dispatch_flow" ? (
                    <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Paso 4</p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">Despacho</h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Aquí queda el bloque OFP / SimBrief / Navigraph. Para habilitar Resumen, primero debes marcar este
                          despacho como listo y validado.
                        </p>

                        <div className="mt-5 space-y-3 text-sm leading-7 text-white/76">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Conexión y estado de Navigraph
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Apertura y recarga de OFP / SimBrief
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Validaciones previas contra la reserva real
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Reutilización</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              No rehacemos el despacho desde cero; aquí se enchufa el flujo real que ya estaba operativo.
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Estado actual</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              {dispatchReady ? "Despacho marcado como listo. Resumen ya está habilitado." : "Aún falta marcar este paso como listo para abrir Resumen."}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setDispatchReady((current) => !current)}
                          className={`mt-4 w-full rounded-[18px] border px-4 py-4 text-left transition ${
                            dispatchReady
                              ? "border-emerald-400/40 bg-emerald-500/[0.14] text-white shadow-[0_12px_30px_rgba(17,181,110,0.18)]"
                              : "border-white/8 bg-[#031428]/58 text-white/72 hover:bg-white/[0.05]"
                          }`}
                        >
                          <span className="block text-base font-semibold text-white">
                            {dispatchReady ? "Despacho listo para pasar a resumen" : "Marcar despacho como listo"}
                          </span>
                          <span className="mt-1 block text-sm leading-7 text-white/68">
                            Usa este estado como puerta de seguridad antes de abrir el resumen final.
                          </span>
                        </button>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => handleStepChange(isCharterLikeDispatch ? "aircraft" : "itinerary")}
                            className="button-secondary py-3"
                          >
                            {isCharterLikeDispatch ? "Volver al Chárter" : "Volver a itinerario"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepChange("summary")}
                            disabled={!canOpenSummary}
                            className={`py-3 ${canOpenSummary ? "button-primary" : "button-secondary cursor-not-allowed opacity-55"}`}
                          >
                            Continuar a resumen
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {dispatchStep === "dispatch_flow" ? (
                    <div className="space-y-4">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Paso 4</p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">
                          {isCharterLikeDispatch ? "Despacho Chárter" : "Despacho de itinerario"}
                        </h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Primero revisa la reserva web, luego prepara o importa el OFP de SimBrief, valida que los datos coincidan y finalmente continúa al resumen para dejar el vuelo listo para ACARS.
                        </p>
                      </div>

                      <div className="rounded-[22px] border border-cyan-300/14 bg-cyan-300/[0.055] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/62">
                              Resumen de reserva
                            </p>
                            <h5 className="mt-2 text-lg font-semibold text-white">
                              {isCharterLikeDispatch ? "Reserva Chárter / Vuelo libre" : "Reserva de itinerario"}
                            </h5>
                          </div>
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/76">
                            {preparedReservationId ? "Despachado" : charterReservationId ? "Reserva creada" : selectedItineraryRecord ? "Datos listos" : "Pendiente"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-white/72 sm:grid-cols-2 xl:grid-cols-4">
                          <span>
                            <strong className="text-white">Piloto:</strong> {profile?.callsign ?? "—"}
                          </span>
                          <span>
                            <strong className="text-white">Ruta:</strong> {webOriginCode || "----"} → {webDestinationCode || "----"}
                          </span>
                          <span>
                            <strong className="text-white">Avión:</strong> {webAirframe || selectedAircraftRecord?.aircraft_type_code || "—"}
                          </span>
                          <span>
                            <strong className="text-white">Matrícula:</strong> {selectedAircraftRecord?.tail_number || "—"}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/10 bg-[#031428]/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                              SimBrief / despacho
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-white">OFP SimBrief automático</h3>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            dispatchReady
                              ? "border-emerald-300/22 bg-emerald-400/10 text-emerald-100"
                              : simbriefSummary
                                ? "border-cyan-300/22 bg-cyan-400/10 text-cyan-100"
                                : "border-white/10 bg-white/[0.04] text-white/58"
                          }`}>
                            {dispatchReady ? "Despacho validado" : simbriefSummary ? "OFP cargado" : simbriefStaticId ? "SimBrief abierto" : "Pendiente OFP"}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-white/58">
                          Patagonia Wings prepara el vuelo con número, origen, destino, aeronave y matrícula. En modo seguro, SimBrief se abre prellenado: el piloto solo revisa, presiona Generate Flight y luego carga el OFP automático en esta página.
                        </p>

                        {simbriefGenerationActive ? (
                          <div className="mt-4 rounded-[20px] border border-emerald-300/20 bg-emerald-400/[0.08] p-4 text-sm text-emerald-50">
                            <p className="font-semibold">Generando OFP SimBrief...</p>
                            <p className="mt-1 text-emerald-50/72">
                              No completes el despacho todavía. Si estás en SimBrief, genera/guarda el vuelo y luego vuelve a Patagonia Wings para cargar combustible, pax, carga, ruta y tiempos planificados.
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-4 grid gap-3 rounded-[20px] border border-cyan-300/12 bg-cyan-300/[0.045] p-4 md:grid-cols-4">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/50">Vuelo PWG</p>
                            <p className="mt-1 text-sm font-semibold text-white">{webFlightNumber || "Pendiente"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/50">Ruta</p>
                            <p className="mt-1 text-sm font-semibold text-white">{webOriginCode} → {webDestinationCode}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/50">Airframe</p>
                            <p className="mt-1 text-sm font-semibold text-white">{webAirframe}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/50">Matrícula</p>
                            <p className="mt-1 text-sm font-semibold text-white">{selectedAircraftRecord?.tail_number || "Pendiente"}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void handleOpenSimbriefPlanner()}
                            disabled={syncingSimbrief || !selectedAircraftRecord || !selectedItineraryRecord}
                            className={`py-3 ${syncingSimbrief || !selectedAircraftRecord || !selectedItineraryRecord ? "button-secondary cursor-not-allowed opacity-55" : "button-primary"}`}
                          >
                            {syncingSimbrief ? "Preparando..." : simbriefStaticId ? "Regenerar OFP SimBrief" : "Generar OFP SimBrief"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleLoadSimbriefData()}
                            disabled={syncingSimbrief || !profile?.simbrief_username?.trim()}
                            className={`py-3 ${syncingSimbrief || !profile?.simbrief_username?.trim() ? "button-secondary cursor-not-allowed opacity-55" : "button-secondary"}`}
                          >
                            {syncingSimbrief ? "Cargando..." : "Cargar OFP automático"}
                          </button>

                          <button
                            type="button"
                            onClick={handleValidateDispatch}
                            disabled={!simbriefSummary || !canValidateDispatch}
                            className={`py-3 ${simbriefSummary && canValidateDispatch ? "button-primary" : "button-secondary cursor-not-allowed opacity-55"}`}
                          >
                            Validar despacho
                          </button>
                        </div>

                        {simbriefStaticId ? (
                          <div className="mt-3 rounded-[16px] border border-white/8 bg-white/[0.035] px-4 py-3 text-xs leading-6 text-white/58">
                            <span className="font-semibold text-cyan-100">static_id:</span> {simbriefStaticId}. Este identificador enlaza el OFP de SimBrief con la reserva Patagonia Wings.
                          </div>
                        ) : null}

                        {simbriefInfoMessage ? (
                          <div className="mt-4 rounded-[18px] border border-cyan-400/18 bg-cyan-500/[0.08] px-4 py-3 text-sm leading-7 text-cyan-100/90">
                            {simbriefInfoMessage}
                          </div>
                        ) : null}

                        {simbriefErrorMessage ? (
                          <div className="mt-4 rounded-[18px] border border-rose-400/18 bg-rose-500/[0.08] px-4 py-3 text-sm leading-7 text-rose-100/90">
                            {simbriefErrorMessage}
                          </div>
                        ) : null}

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {dispatchValidationItems.map((item) => (
                            <div key={item.key} className="rounded-[18px] border border-white/8 bg-white/[0.035] p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">{item.label}</p>
                              <p className="mt-2 text-sm font-semibold text-white">Web: {item.webValue}</p>
                              <p className="mt-1 text-xs text-white/54">OFP: {item.simbriefValue}</p>
                              <p className={`mt-2 text-xs font-semibold ${item.matches ? "text-emerald-300" : "text-amber-200"}`}>
                                {item.matches ? "Coincide" : simbriefSummary ? "No coincide" : "Pendiente"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5">
                        <button
                          type="button"
                          onClick={() => handleStepChange(isCharterLikeDispatch ? "aircraft" : "itinerary")}
                          className="button-secondary py-3"
                        >
                          {isCharterLikeDispatch ? "Volver al Chárter" : "Volver a itinerario"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStepChange("summary")}
                          disabled={!canOpenSummary}
                          className={`py-3 ${canOpenSummary ? "button-primary" : "button-secondary cursor-not-allowed opacity-50"}`}
                        >
                          Continuar a resumen
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {dispatchStep === "summary" ? (
                    <div className="space-y-4">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Paso 5</p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">Resumen final del vuelo</h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Aqui queda el consolidado final del vuelo a despachar. Al confirmar, la web lo deja listo en la base operativa para que ACARS lo rescate.
                        </p>
                      </div>

                      <div className="rounded-[22px] border border-cyan-400/14 bg-[#031428]/65 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                              Resumen web
                            </p>
                            <h5 className="mt-2 text-xl font-semibold text-white">Datos del vuelo a realizar</h5>
                          </div>
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                            Listo para despacho
                          </span>
                        </div>

                        <div className="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1fr_1fr_1fr]">
                          <DispatchValueCard
                            label="Numero de vuelo"
                            value={webFlightNumber}
                            hint={selectedItineraryRecord?.itinerary_code ?? "Pendiente"}
                          />
                          <DispatchLocationCard
                            label="Origen"
                            icao={webOriginCode}
                            city={webOriginCity}
                            countryCode={webOriginCountryCode}
                          />
                          <DispatchLocationCard
                            label="Destino"
                            icao={webDestinationCode}
                            city={webDestinationCity}
                            countryCode={webDestinationCountryCode}
                          />
                          <DispatchValueCard
                            label="Aeronave"
                            value={summaryAirframeDisplay}
                            hint={selectedAircraftRecord?.tail_number || "Pendiente"}
                            valueClassName="text-[1.35rem] leading-tight"
                          />
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <DispatchValueCard
                            label="Itinerario"
                            value={selectedItineraryRecord?.itinerary_name || selectedItineraryRecord?.itinerary_code || "Pendiente"}
                            hint={selectedItineraryRecord ? `${selectedItineraryRecord.origin_icao} → ${selectedItineraryRecord.destination_icao}` : undefined}
                            valueClassName="text-[1.3rem] leading-tight"
                          />
                          <DispatchValueCard
                            label="Distancia"
                            value={summaryDispatchDistance}
                          />
                          <DispatchValueCard
                            label="Duracion aprox."
                            value={summaryDispatchDuration}
                          />
                          <DispatchValueCard
                            label="Despacho"
                            value={stepStatusLabel.dispatch}
                            valueClassName={`text-[1.3rem] leading-tight ${preparedReservationId ? "text-emerald-300" : dispatchReady ? "text-sky-300" : ""}`}
                          />
                        </div>
                      </div>

                      {simbriefSummary ? (
                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                              OFP confirmado
                            </p>
                            <h5 className="mt-2 text-xl font-semibold text-white">Datos traidos desde SimBrief</h5>
                          </div>
                          <span className="rounded-full border border-emerald-300/25 bg-emerald-500/[0.12] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                            {preparedReservationId ? "Despachado" : "Validado"}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1fr_1fr_0.95fr]">
                          <DispatchValueCard
                            label="Numero de vuelo"
                            value={simbriefFlightNumberDisplay}
                            hint={profile?.simbrief_username?.trim() || "Usuario SimBrief pendiente"}
                          />
                          <DispatchLocationCard
                            label="Origen"
                            icao={simbriefOriginCode}
                            city={simbriefOriginCity}
                            countryCode={simbriefOriginCountryCode}
                          />
                          <DispatchLocationCard
                            label="Destino"
                            icao={simbriefDestinationCode}
                            city={simbriefDestinationCity}
                            countryCode={simbriefDestinationCountryCode}
                          />
                          <DispatchValueCard
                            label="Airframe ICAO"
                            value={simbriefAirframe}
                            hint={simbriefSummary?.aircraftRegistration?.trim() || "Matricula no informada"}
                          />
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <DispatchValueCard
                            label="Crucero"
                            value={simbriefSummary?.cruiseAltitude?.trim() || "Pendiente"}
                          />
                          <DispatchValueCard
                            label="Pasajeros"
                            value={
                              typeof simbriefSummary?.pax === "number"
                                ? String(simbriefSummary.pax)
                                : "Pendiente"
                            }
                          />
                          <DispatchValueCard
                            label="Payload"
                            value={
                              typeof simbriefSummary?.payloadKg === "number"
                                ? `${simbriefSummary.payloadKg.toLocaleString("es-CL")} kg`
                                : "Pendiente"
                            }
                          />
                          <DispatchValueCard
                            label="ZFW"
                            value={
                              typeof simbriefSummary?.zfwKg === "number"
                                ? `${simbriefSummary.zfwKg.toLocaleString("es-CL")} kg`
                                : "Pendiente"
                            }
                          />
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <DispatchValueCard
                            label="Comb. bloque"
                            value={
                              typeof simbriefSummary?.blockFuelKg === "number"
                                ? `${simbriefSummary.blockFuelKg.toLocaleString("es-CL")} kg`
                                : "Pendiente"
                            }
                          />
                          <DispatchValueCard
                            label="Distancia OFP"
                            value={
                              typeof simbriefSummary?.distanceNm === "number"
                                ? `${formatInteger(simbriefSummary.distanceNm)} NM`
                                : "Pendiente"
                            }
                          />
                          <DispatchValueCard
                            label="OFP cargado"
                            value={simbriefSummary ? "✓ Listo" : "Pendiente"}
                            valueClassName={simbriefSummary ? "text-[1.3rem] leading-tight text-emerald-400" : "text-[1.3rem] leading-tight text-white/50"}
                          />
                        </div>

                        {simbriefEconomyEstimate ? (
                          <div className="mt-4 rounded-[20px] border border-emerald-300/16 bg-emerald-300/[0.045] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/55">Economía planificada OFP</p>
                                <p className="mt-1 text-sm text-white/58">Esta planificación usa pax, carga y combustible importados desde SimBrief. El cierre ACARS calculará el resultado real final.</p>
                              </div>
                              <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs font-semibold text-white/58">
                                Fuente: SimBrief/OFP
                              </span>
                            </div>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              {[
                                { label: "💵 Piloto", value: formatEconomyUsd(simbriefEconomyEstimate.pilotPaymentUsd), tone: "text-emerald-100" },
                                { label: "👥 Pax OFP", value: simbriefEconomyEstimate.estimatedPassengers.toLocaleString("es-CL"), tone: "text-white/82" },
                                { label: "📦 Carga OFP", value: `${simbriefEconomyEstimate.estimatedCargoKg.toLocaleString("es-CL")} kg`, tone: "text-white/82" },
                                { label: "⛽ Combustible OFP", value: `${simbriefEconomyEstimate.fuelKg.toLocaleString("es-CL")} kg / ${formatEconomyUsd(simbriefEconomyEstimate.fuelCostUsd)}`, tone: "text-amber-100" },
                                { label: "🏢 Ingreso", value: formatEconomyUsd(simbriefEconomyEstimate.airlineRevenueUsd), tone: "text-cyan-100" },
                                { label: "🧾 Costos", value: formatEconomyUsd(simbriefEconomyEstimate.totalCostUsd), tone: "text-white/82" },
                                { label: "🛍 Servicio/ventas", value: formatEconomyUsd(simbriefEconomyEstimate.onboardServiceRevenueUsd + simbriefEconomyEstimate.onboardSalesRevenueUsd), tone: "text-cyan-100" },
                                { label: "📈 Utilidad", value: formatEconomyUsd(simbriefEconomyEstimate.netProfitUsd), tone: simbriefEconomyEstimate.netProfitUsd >= 0 ? "text-emerald-100" : "text-rose-100" },
                              ].map((item) => (
                                <div key={item.label} className="rounded-[16px] border border-white/8 bg-white/[0.035] px-3 py-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">{item.label}</p>
                                  <p className={`mt-1 text-sm font-black ${item.tone}`}>{item.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4">
                          <DispatchWideValueStrip
                            label="Ruta validada"
                            value={summaryDispatchRoute}
                          />
                        </div>
                      </div>
                      ) : null}

                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="space-y-4">
                          <div className="rounded-[18px] border border-white/8 bg-[#031428]/58 p-4">
                            <p className="text-sm font-semibold text-white">Salida a base operativa</p>
                            <p className="mt-2 text-sm leading-7 text-white/72">
                              Al presionar <span className="font-semibold text-white">Despachar vuelo</span>, la web guarda esta preparacion en la base activa y genera el paquete de despacho para ACARS.
                            </p>
                          </div>

                          {summaryInfoMessage ? (
                            <div className="rounded-[18px] border border-emerald-400/18 bg-emerald-500/[0.08] px-4 py-3 text-sm leading-7 text-emerald-100/88">
                              {summaryInfoMessage}
                            </div>
                          ) : null}

                          {summaryErrorMessage ? (
                            <div className="rounded-[18px] border border-rose-400/18 bg-rose-500/[0.08] px-4 py-3 text-sm leading-7 text-rose-100/90">
                              {summaryErrorMessage}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-3 pt-1">
                            <button type="button" onClick={() => handleStepChange("dispatch_flow")} className="button-secondary py-3">
                              Volver a despacho
                            </button>
                            <button
                              type="button"
                              onClick={handleDispatchFlight}
                              disabled={!canDispatchFlight || finalizingDispatch || Boolean(preparedReservationId)}
                              className={`py-3 ${!canDispatchFlight || finalizingDispatch || preparedReservationId ? "button-secondary cursor-not-allowed opacity-55" : "button-primary"}`}
                            >
                              {finalizingDispatch
                                ? "Despachando..."
                                : preparedReservationId
                                  ? "✓ Vuelo despachado — ACARS listo"
                                  : "Despachar vuelo"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {false && dispatchStep === "summary" ? (
                    <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Paso 5</p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">Resumen final y envío a ACARS</h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Última validación del flujo. Este paso solo se abre cuando los cuatro anteriores quedaron efectivamente completados.
                        </p>

                        <div className="mt-5 space-y-3 text-sm leading-7 text-white/76">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Tipo de vuelo: {stepStatusLabel.flightType}
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Aeronave: {stepStatusLabel.aircraft}
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Itinerario: {stepStatusLabel.itinerary}
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Despacho: {stepStatusLabel.dispatch}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Qué se ve aquí</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Un resumen limpio del vuelo listo para salir, con semáforos de validación y el botón final de envío cuando todo esté correcto.
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Compatibilidad futura</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Este panel podrá recibir después economía, score, tolerancias y auditoría sin romper la estructura ya aprobada.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-[#031428]/58 p-4 text-sm leading-7 text-white/64">
                          Resumen habilitado de forma progresiva: no se abre si algún paso anterior sigue pendiente.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button type="button" onClick={() => handleStepChange("dispatch_flow")} className="button-secondary py-3">
                            Volver a despacho
                          </button>
                          <Link href="/dashboard?tab=dispatch" className="button-primary py-3">
                            Ir al flujo operativo actual
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "office" && profile ? (
          <div className="flex flex-col gap-4">

            {/* ── Fila 1: Perfil + Accesos ── */}
            <div className="grid gap-4 lg:grid-cols-3">

              {/* Tarjeta de perfil */}
              <div className="surface-outline rounded-[24px] p-6 lg:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                  Oficina del piloto
                </p>
                <div className="mt-4 flex items-center gap-5">
                  {/* Avatar initials */}
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "linear-gradient(135deg,#0ca66b,#15b96e)" }}>
                    <span className="text-xl font-bold text-white">
                      {((profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? "")).toUpperCase() || profile.callsign.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-semibold text-white leading-tight">
                      {profile.first_name || profile.last_name
                        ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
                        : profile.callsign}
                    </h2>
                    <p className="mt-0.5 text-sm text-white/54">{profile.callsign}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <img
                        src={rank.asset}
                        alt={`Insignia ${rank.name}`}
                        className="h-12 w-12 object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-[11px] font-semibold text-white/80">
                        {metrics.careerRank}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-semibold ${metrics.pilotStatus === "ACTIVO" ? "bg-[#0ca66b]/20 text-[#49d787] border border-[#0ca66b]/30" : "bg-white/5 text-white/50 border border-white/10"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${metrics.pilotStatus === "ACTIVO" ? "bg-[#49d787]" : "bg-white/30"}`} />
                        {metrics.pilotStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Datos operacionales */}
                <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-white/8 pt-5 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Hub base</p>
                    <p className="mt-1 text-sm font-medium text-white">{profile.base_hub ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">País</p>
                    <p className="mt-1 text-sm font-medium text-white">{profile.country ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Simulador</p>
                    <p className="mt-1 text-sm font-medium text-white">{profile.simulator ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">SimBrief</p>
                    <p className="mt-1 text-sm font-medium text-white">{profile.simbrief_username ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">VATSIM</p>
                    <p className="mt-1 text-sm font-medium text-white">{profile.vatsim_id ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">IVAO</p>
                    <p className="mt-1 text-sm font-medium text-white">{profile.ivao_id ?? "—"}</p>
                  </div>
                </div>
              </div>

              {/* Accesos rápidos */}
              <div className="surface-outline rounded-[24px] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Accesos</p>
                <div className="mt-4 flex flex-col gap-3">
                  <Link href="/profile" className="button-secondary text-center text-sm">
                    ✏ Editar perfil
                  </Link>
                  <Link href="/certifications" className="button-ghost text-center text-sm">
                    🎖 Certificaciones
                  </Link>
                  <Link href="/operations" className="button-ghost text-center text-sm">
                    📋 Operaciones
                  </Link>
                </div>

                {/* Habilitaciones activas */}
                {profile.active_qualifications && (
                  <div className="mt-5 border-t border-white/8 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Habilitaciones</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.active_qualifications.split(",").map((q) => q.trim()).filter(Boolean).map((q) => (
                        <span key={q} className="inline-block rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                          {q}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Fila 2: Métricas de carrera ── */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Horas totales", value: formatDecimal(metrics.totalHours), unit: "hs" },
                { label: "PIREPs", value: formatInteger(metrics.totalPireps), unit: "vuelos" },
                { label: `Horas ${metrics.monthLabel}`, value: formatDecimal(metrics.monthHours), unit: "hs" },
                { label: `Posición ${metrics.monthLabel}`, value: metrics.monthPosition != null ? `#${formatInteger(metrics.monthPosition)}` : "—", unit: "" },
              ].map((m) => (
                <div key={m.label} className="surface-outline rounded-[20px] p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">{m.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{m.value}</p>
                  {m.unit && <p className="mt-0.5 text-[11px] text-white/38">{m.unit}</p>}
                </div>
              ))}
            </div>

            {/* ── Fila 3: Scores + Billetera ── */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Patagonia Score", value: formatDecimal(metrics.patagoniaScore), accent: "#67d7ff" },
                { label: "Rango", value: metrics.careerRank, accent: "#ffffff", rankAsset: rank.asset, rankName: rank.name },
                { label: "Estado", value: metrics.pilotStatus, accent: "#0ca66b" },
                { label: "Billetera", value: formatCurrency(metrics.walletBalance), accent: "#0ca66b" },
              ].map((m) => (
                <div key={m.label} className="surface-outline rounded-[20px] p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">{m.label}</p>
                  {"rankAsset" in m ? (
                    <img
                      src={m.rankAsset}
                      alt={`Insignia ${m.rankName}`}
                      className="mt-2 h-20 w-20 object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                  <p className={`mt-2 font-semibold ${"rankAsset" in m ? "text-lg" : "text-3xl"}`} style={{ color: m.accent }}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* ── Fila 4: Reserva activa ── */}
            <div className="surface-outline rounded-[24px] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Reserva activa
              </p>
              {activeReservation ? (
                <div className="mt-4 space-y-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-8">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Ruta</p>
                        <p className="mt-1 text-lg font-semibold text-white">{formatRouteTag(activeReservation)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Aeronave</p>
                        <p className="mt-1 text-sm font-medium text-white">
                          {activeReservation.aircraft_type_code ?? "—"}
                          {activeReservation.aircraft_registration ? ` · ${activeReservation.aircraft_registration}` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Estado</p>
                        <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-semibold ${
                          activeReservation.status === "in_progress" || activeReservation.status === "in_flight"
                            ? "border border-[#0ca66b]/30 bg-[#0ca66b]/20 text-[#49d787]"
                            : activeReservation.status === "dispatch_ready" || activeReservation.status === "dispatched"
                              ? "border border-[#67d7ff]/20 bg-[#67d7ff]/10 text-[#67d7ff]"
                              : "border border-white/10 bg-white/5 text-white/70"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${(activeReservation.status === "in_progress" || activeReservation.status === "in_flight") ? "bg-[#49d787]" : (activeReservation.status === "dispatch_ready" || activeReservation.status === "dispatched") ? "bg-[#67d7ff]" : "bg-white/40"}`} />
                          {formatFlightStatusLabel(activeReservation.status)}
                        </span>
                      </div>
                      {activeReservation.flight_mode_code && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Modo</p>
                          <p className="mt-1 text-sm text-white/70">{activeReservation.flight_mode_code}</p>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={cancellingReservation}
                      onClick={async () => {
                        if (!confirm("¿Cancelar esta reserva? No se puede deshacer.")) return;
                        setCancellingReservation(true);
                        try {
                          await cancelFlightOperation(
                            (activeReservation as FlightReservationRow & { id: string }).id,
                            profile.callsign
                          );
                          setActiveReservation(null);
                          setPreparedReservationId(null);
                          setCharterReservationId(null);
                          setCharterOperation(null);
                          setSelectedFlightType(null);
                          setSelectedAircraft(null);
                          setSelectedItinerary(null);
                          setDispatchReady(false);
                          setSimbriefSummary(null);
                          setSummaryInfoMessage("");
                          setSummaryErrorMessage("");
                          setDispatchStep("flight_type");
                        } catch {
                          alert("No se pudo cancelar la reserva. Intenta de nuevo.");
                        } finally {
                          setCancellingReservation(false);
                        }
                      }}
                      className="shrink-0 rounded-[12px] border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cancellingReservation ? "Cancelando..." : "✕ Cancelar reserva"}
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-[24px] border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(103,215,255,0.16),transparent_42%),linear-gradient(135deg,rgba(3,20,40,0.94),rgba(6,33,61,0.88))] p-5 shadow-[0_24px_60px_rgba(1,10,20,0.34)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
                          Progreso de ruta
                        </p>
                        <p className="mt-2 text-base font-semibold text-white">{activeProgressLabel}</p>
                        <p className="mt-1 text-xs text-white/42">
                          {activeHasLivePosition
                            ? `${activeProgressPercent}% real${activeLiveGroundSpeed != null ? ` · ${formatInteger(activeLiveGroundSpeed)} kt GS` : ""}${activeLivePhase ? ` · ${activeLivePhase}` : ""}`
                            : "Sin movimiento simulado: esperando datos reales del ACARS"}
                        </p>
                      </div>
                      <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/84">
                        {activeRouteDistanceNm > 0 ? `${formatInteger(activeRouteDistanceNm)} NM totales` : "Ruta en preparación"}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,160px)_1fr_minmax(0,160px)] lg:items-end">
                      <div className="rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/48">Origen</p>
                        <p className="mt-2 text-[1.55rem] font-bold tracking-[0.18em] text-white">{activeOriginCode}</p>
                        <p className="mt-2 text-xs text-cyan-100/80">
                          {activeStatusIsLive && activeHasLivePosition ? `${formatInteger(activeDistanceFromOriginNm)} NM recorridos` : "0 NM recorridos"}
                        </p>
                      </div>

                      <div className="relative px-2 py-4">
                        <div className="absolute inset-x-0 top-1/2 h-[1px] -translate-y-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <div className="relative h-[84px] rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-5">
                          <div className="absolute inset-x-5 top-1/2 h-[12px] -translate-y-1/2 overflow-hidden rounded-full bg-[#07192d] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                            <div className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgba(29,119,191,0.28),rgba(103,215,255,0.72),rgba(83,255,182,0.76))]" style={{ width: `${activeProgressPercent}%` }} />
                            <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 24px, rgba(255,255,255,0.16) 24px 26px)" }} />
                          </div>
                          <div
                            className="absolute top-1/2 w-[48px] -translate-y-1/2 drop-shadow-[0_10px_18px_rgba(103,215,255,0.30)] transition-[left] duration-[1400ms] ease-out"
                            style={{ left: activeProgressPercent <= 0 ? "0px" : `calc(${activeProgressPercent}% - 24px)` }}
                          >
                            <RouteAircraftSideIcon className={`h-auto w-full ${activeHasLivePosition ? "animate-[pulse_4.6s_ease-in-out_infinite]" : "opacity-70"}`} />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-4 lg:text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/48">Destino</p>
                        <p className="mt-2 text-[1.55rem] font-bold tracking-[0.18em] text-white">{activeDestinationCode}</p>
                        <p className="mt-2 text-xs text-emerald-100/80">
                          {activeRouteDistanceNm > 0 ? `${formatInteger(activeDistanceToDestinationNm)} NM restantes` : "Pendiente"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/38">Sin reserva activa en este momento.</p>
              )}
            </div>

            {/* ── Fila 5: Economía aerolínea (mini panel) ── */}
            <OfficeEconomyPanel />

            {/* ── Fila 6: Historial de vuelos ── */}
            <div className="surface-outline rounded-[24px] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Historial de vuelos
              </p>
              {central.recentFlights.length === 0 ? (
                <p className="mt-4 text-sm text-white/38">Sin vuelos registrados aún.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8">
                        <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Ruta</th>
                        <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Aeronave</th>
                        <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Tipo</th>
                        <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Score</th>
                        <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {central.recentFlights.slice(0, 8).map((f, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0">
                          <td className="py-3 font-medium text-white">
                            {f.id ? (
                              <Link href={`/flights/${f.id}`} className="transition hover:text-[#67d7ff]">
                                {formatRouteTag(f)}
                              </Link>
                            ) : (
                              formatRouteTag(f)
                            )}
                          </td>
                          <td className="py-3 text-white/70">{f.aircraft_type_code ?? "—"}</td>
                          <td className="py-3 text-white/54">{formatFlightStatusLabel(f.status)}</td>
                          <td className="py-3 text-right font-semibold text-[#67d7ff]">
                            {f.procedure_score != null ? formatDecimal(f.procedure_score) : "—"}
                          </td>
                          <td className="py-3 text-right text-white/38">
                            {f.completed_at ? new Date(f.completed_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        ) : null}

        {activeTab === "training" ? (
          <div className="flex flex-col gap-5">

            <div className="surface-outline relative overflow-hidden rounded-[24px] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.38)]">
              <div className="absolute inset-0">
                <Image
                  src="/dispatch/flight-types/training.png"
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 900px"
                  className="scale-110 object-cover opacity-35 blur-[7px]"
                  priority={false}
                />
                <div className="absolute inset-0 bg-[#06101d]/86" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(103,215,255,0.22),transparent_46%),linear-gradient(135deg,rgba(4,15,28,0.72),rgba(4,10,19,0.94))]" />
              </div>

              <div className="relative z-10">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/58">Entrenamiento</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Centro de Capacitación y Perfeccionamiento</h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-white/66">
                      Vuelos de práctica por aeronave, con origen/destino libre y evaluación histórica. Estas sesiones acumulan horas por tipo de avión,
                      pero no modifican el Patagonia Score general ni el promedio de ascenso.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[16px] border border-amber-300/20 bg-[#0d1723]/72 px-4 py-3 text-sm leading-6 text-amber-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
                  Para solicitar checkride de una aeronave necesitas completar al menos {TRAINING_MIN_AIRCRAFT_HOURS} horas de entrenamiento en ese tipo.
                  El score del entrenamiento queda visible como historial técnico, sin sumar ni restar al puntaje general del piloto.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  label: "Tipos de avión",
                  value: formatInteger(trainingAircraftProgress.length),
                  unit: "disponibles",
                  accent: "#67d7ff",
                },
                {
                  label: "Horas entrenamiento",
                  value: formatDecimal(trainingAircraftProgress.reduce((sum, item) => sum + item.total_hours, 0)),
                  unit: "por aeronave",
                  accent: "#ffffff",
                },
                {
                  label: "Checkrides listos",
                  value: formatInteger(trainingAircraftProgress.filter((item) => item.checkride_available).length),
                  unit: "habilitables",
                  accent: "#49d787",
                },
                {
                  label: "Regla mínima",
                  value: `${TRAINING_MIN_AIRCRAFT_HOURS}h`,
                  unit: "por tipo",
                  accent: "#fbbf24",
                },
              ].map((m) => (
                <div key={m.label} className="surface-outline rounded-[20px] p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">{m.label}</p>
                  <p className="mt-2 text-3xl font-semibold" style={{ color: m.accent }}>{m.value}</p>
                  {m.unit && <p className="mt-0.5 text-[11px] text-white/38">{m.unit}</p>}
                </div>
              ))}
            </div>

            <div className="surface-outline rounded-[24px] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Plan de entrenamiento</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Tarjetas desplegables por categoría de avión</h3>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-white/56">
                    Cada bloque se abre según el rango del piloto. Siempre quedan habilitadas las aeronaves que ya puede volar y, además,
                    la siguiente categoría inmediata para practicarla antes del ascenso definitivo.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px] lg:max-w-[460px]">
                  <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Categorías activas</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatInteger(trainingAccessSummary.activeCards.length)}</p>
                    <p className="mt-1 text-[11px] text-white/42">ya operativas por rango</p>
                  </div>
                  <div className="rounded-[18px] border border-cyan-300/14 bg-cyan-400/[0.06] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/60">Siguiente bloque</p>
                    <p className="mt-2 text-sm font-semibold text-cyan-50">
                      {trainingAccessSummary.previewCard?.title ?? "Sin siguiente bloque"}
                    </p>
                    <p className="mt-1 text-[11px] text-cyan-100/54">pre-habilitado para entrenar</p>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Aviones visibles</p>
                    <p className="mt-2 text-2xl font-semibold text-[#67d7ff]">{formatInteger(trainingAccessSummary.activeAircraftCount)}</p>
                    <p className="mt-1 text-[11px] text-white/42">entre vigentes y siguiente tier</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[18px] border border-white/8 bg-[#031428]/58 px-4 py-4 text-sm leading-6 text-white/70">
                <strong className="text-white">Lógica aplicada:</strong> los aviones escuela y las categorías ya habilitadas quedan operativas,
                mientras que la <span className="text-cyan-200">siguiente categoría</span> se desbloquea solo para entrenamiento previo. Las demás
                permanecen bloqueadas hasta progresar de rango.
              </div>

              <div className="mt-5 space-y-3">
                {trainingCategoryCards.length > 0 ? (
                  trainingCategoryCards.map((card) => {
                    const isOpen = openTrainingCategories[card.key] ?? false;
                    const categoryHours = card.aircraft.reduce((sum, item) => sum + item.total_hours, 0);
                    const readyCheckrides = card.aircraft.filter((item) => item.checkride_available).length;

                    return (
                      <div key={card.key} className={`overflow-hidden rounded-[20px] border ${card.borderClass}`}>
                        <div className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${card.badgeClass}`}>
                                {card.tierLabel}
                              </span>
                              <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${card.badgeClass}`}>
                                {card.currentTier ? "Operativa" : card.nextTier ? "Pre-habilitación" : "Bloqueada"}
                              </span>
                            </div>

                            <h4 className={`mt-2 text-lg font-semibold ${card.accentClass}`}>{card.title}</h4>
                            <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-white/62">{card.description}</p>

                            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/54">
                              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">
                                {formatInteger(card.aircraft.length)} aviones
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">
                                {formatDecimal(categoryHours)} h acumuladas
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">
                                {formatInteger(readyCheckrides)} checkrides listos
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <button
                              type="button"
                              disabled={!card.unlocked}
                              onClick={() => toggleTrainingCategory(card.key)}
                              className={`rounded-[12px] border px-4 py-2 text-[12px] font-semibold transition ${
                                card.unlocked
                                  ? "border-white/12 bg-white/[0.05] text-white hover:bg-white/[0.09]"
                                  : "cursor-not-allowed border-white/8 bg-white/[0.025] text-white/32"
                              }`}
                            >
                              {card.unlocked ? (isOpen ? "Ocultar categoría" : "Abrir categoría") : "Bloqueada por rango"}
                            </button>
                          </div>
                        </div>

                        {card.unlocked ? (
                          isOpen ? (
                            <div className="border-t border-white/8 bg-black/12 px-3.5 py-3">
                              <div className="grid gap-2.5">
                                {card.aircraft.map((item) => {
                                  const schoolAircraft = isTrainingSchoolAircraft(item.aircraft_type_code);
                                  const currentlyPermitted = schoolAircraft || isTrainingTypePermitted(item.aircraft_type_code, permittedTrainingTypes);
                                  const previewTraining = !currentlyPermitted && card.nextTier;
                                  const canTrain = currentlyPermitted || previewTraining;
                                  const progress = schoolAircraft || item.min_hours_required <= 0
                                    ? 100
                                    : Math.min(100, Math.round((item.total_hours / item.min_hours_required) * 100));

                                  return (
                                    <div key={item.aircraft_type_code} className="rounded-[16px] border border-white/8 bg-[#07111d]/72 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_auto] xl:items-center">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-[15px] font-semibold text-white">{item.display_name}</p>
                                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                              currentlyPermitted
                                                ? "border-emerald-300/24 bg-emerald-400/12 text-emerald-100"
                                                : previewTraining
                                                  ? "border-cyan-300/24 bg-cyan-400/12 text-cyan-100"
                                                  : "border-white/10 bg-white/[0.03] text-white/40"
                                            }`}>
                                              {currentlyPermitted ? "Disponible" : previewTraining ? "Entrenable" : "Bloqueado"}
                                            </span>
                                          </div>
                                          <div className="mt-1.5 flex flex-wrap gap-2.5 text-[11px] text-white/48">
                                            <span className="font-mono text-white/70">{item.aircraft_type_code}</span>
                                            <span>Familia {item.family_code ?? item.aircraft_type_code}</span>
                                            <span>{formatInteger(item.training_flights)} vuelos</span>
                                            <span>Último: {formatTrainingDate(item.last_training_at)}</span>
                                          </div>
                                          <div className="mt-3">
                                            <div className="flex items-center justify-between gap-3 text-[11px] text-white/42">
                                              <span>
                                                {schoolAircraft
                                                  ? "Avión escuela · acceso permanente"
                                                  : `${formatDecimal(item.total_hours)}h / ${formatDecimal(item.min_hours_required)}h`}
                                              </span>
                                              <span>{schoolAircraft ? "100%" : `${progress}%`}</span>
                                            </div>
                                            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                                              <div
                                                className={`h-full rounded-full ${item.checkride_available ? "bg-emerald-400" : currentlyPermitted ? "bg-[#67d7ff]" : "bg-cyan-300"}`}
                                                style={{ width: `${progress}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                                          <div className="rounded-[13px] border border-white/8 bg-white/[0.03] px-3 py-2.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">Horas</p>
                                            <p className="mt-1 text-sm font-semibold text-white">{formatDecimal(item.total_hours)}h</p>
                                          </div>
                                          <div className="rounded-[13px] border border-white/8 bg-white/[0.03] px-3 py-2.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">Checkride</p>
                                            <p className={`mt-1 text-sm font-semibold ${item.checkride_available ? "text-emerald-300" : "text-white/58"}`}>
                                              {item.checkride_available ? "Listo" : "Pendiente"}
                                            </p>
                                          </div>
                                          <div className="rounded-[13px] border border-white/8 bg-white/[0.03] px-3 py-2.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">Acceso</p>
                                            <p className={`mt-1 text-sm font-semibold ${currentlyPermitted ? "text-emerald-300" : previewTraining ? "text-cyan-200" : "text-white/58"}`}>
                                              {currentlyPermitted ? "Operativo" : previewTraining ? "Pre-entreno" : "Cerrado"}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex flex-col gap-2 xl:min-w-[205px] xl:items-end">
                                          <button
                                            type="button"
                                            disabled={!canTrain}
                                            onClick={() => canTrain && openTrainingPlanner(item)}
                                            className={`rounded-[12px] border px-4 py-2.5 text-xs font-semibold transition ${
                                              canTrain
                                                ? currentlyPermitted
                                                  ? "border-[#67d7ff]/25 bg-[#67d7ff]/10 text-[#67d7ff] hover:bg-[#67d7ff]/18"
                                                  : "border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/16"
                                                : "cursor-not-allowed border-white/8 bg-white/[0.025] text-white/32"
                                            }`}
                                          >
                                            {currentlyPermitted ? "Entrenar ahora" : previewTraining ? "Entrenar categoría siguiente" : "Bloqueado"}
                                          </button>

                                          {schoolAircraft ? (
                                            <span className="rounded-[12px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-2.5 text-center text-xs font-semibold text-emerald-200">
                                              Avión escuela inicial
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              disabled={!item.checkride_available || !currentlyPermitted}
                                              className={`rounded-[12px] border px-4 py-2.5 text-xs font-semibold transition ${
                                                item.checkride_available && currentlyPermitted
                                                  ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/16"
                                                  : "cursor-not-allowed border-white/8 bg-white/[0.025] text-white/32"
                                              }`}
                                            >
                                              {item.checkride_available && currentlyPermitted
                                                ? "Solicitar checkride"
                                                : previewTraining
                                                  ? "Checkride al subir de categoría"
                                                  : "Checkride bloqueado"}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null
                        ) : (
                          <div className="border-t border-white/8 px-5 py-4 text-sm leading-6 text-white/50">
                            Esta categoría se abrirá automáticamente cuando el piloto consolide la categoría anterior y su rango permita avanzar.
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[18px] border border-white/8 bg-white/[0.02] px-4 py-10 text-center text-white/48">
                    No se pudo cargar el listado de aeronaves. Ejecuta el SQL del bloque para habilitar el progreso de entrenamiento.
                  </div>
                )}
              </div>
            </div>

            <div className="surface-outline rounded-[24px] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Habilitaciones</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Checkrides operativos</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
                    Aquí quedará el listado de habilitaciones prácticas del piloto. Cada bloque podrá conectarse después
                    con lógica real de aprobación, pero desde ya queda visible el flujo con botón de checkride.
                  </p>
                </div>
                <div className="grid gap-2 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42 sm:grid-cols-2 lg:min-w-[280px]">
                  <div className="rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p>Checkrides listados</p>
                    <p className="mt-1 text-lg text-white">{TRAINING_CHECKRIDE_CATALOG.length}</p>
                  </div>
                  <div className="rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p>Teóricas disponibles</p>
                    <p className="mt-1 text-lg text-white">{TRAINING_THEORY_EXAMS.length}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {TRAINING_CHECKRIDE_CATALOG.map((item) => (
                  <div
                    key={item.code}
                    className="rounded-[18px] border border-white/8 bg-[#07111d]/72 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  >
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                            {item.code}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/62">
                            {item.category}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                            item.status === "Disponible"
                              ? "border-emerald-300/24 bg-emerald-400/12 text-emerald-100"
                              : item.status === "Próximo bloque"
                                ? "border-cyan-300/24 bg-cyan-400/12 text-cyan-100"
                                : "border-amber-300/24 bg-amber-400/12 text-amber-100"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-2 text-[15px] font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-[13px] leading-5 text-white/56">{item.description}</p>
                      </div>

                      <div className="flex flex-col gap-2 lg:min-w-[190px] lg:items-end">
                        <button
                          type="button"
                          onClick={() => setSelectedTrainingCheckride(item)}
                          className="rounded-[12px] border border-emerald-300/24 bg-emerald-400/10 px-4 py-2.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/16"
                        >
                          Checkride
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-outline rounded-[24px] p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Teóricas</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Evaluaciones teóricas</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
                    Bloque reservado para las pruebas teóricas del plan de formación. Queda preparado con seis evaluaciones
                    base y su acción directa para aplicar cada teórica.
                  </p>
                </div>
                <div className="rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                  <p>Total de pruebas</p>
                  <p className="mt-1 text-lg text-white">6</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {TRAINING_THEORY_EXAMS.map((exam) => {
                  const attempt = trainingTheoryAttempts[exam.code];
                  const gate = getTheoryAttemptGate(attempt);
                  const canOpenExam = exam.questions.length > 0 && !gate.locked;
                  const stateClass =
                    gate.tone === "passed"
                      ? "border-emerald-300/24 bg-emerald-400/12 text-emerald-100"
                      : gate.tone === "locked"
                        ? "border-rose-300/24 bg-rose-400/12 text-rose-100"
                        : gate.tone === "retry"
                          ? "border-amber-300/24 bg-amber-400/12 text-amber-100"
                          : "border-cyan-300/24 bg-cyan-400/12 text-cyan-100";

                  return (
                    <div
                      key={exam.code}
                      className="rounded-[18px] border border-white/8 bg-[#07111d]/72 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    >
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_auto] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-violet-300/24 bg-violet-400/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-100">
                              {exam.code}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/62">
                              Evaluación teórica
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${stateClass}`}>
                              {gate.label}
                            </span>
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                              {exam.durationMinutes} min · {exam.questions.length} preguntas
                            </span>
                          </div>
                          <p className="mt-2 text-[15px] font-semibold text-white">{exam.title}</p>
                          <p className="mt-1 text-[13px] leading-5 text-white/56">{exam.description}</p>
                          <p className="mt-2 text-[12px] leading-5 text-white/42">{gate.helper}</p>
                        </div>

                        <div className="flex flex-col gap-2 lg:min-w-[190px] lg:items-end">
                          <button
                            type="button"
                            disabled={exam.questions.length === 0}
                            onClick={() => exam.questions.length > 0 && setSelectedTrainingTheoryExam(exam)}
                            className={`rounded-[12px] border px-4 py-2.5 text-xs font-semibold transition ${
                              canOpenExam
                                ? "border-[#67d7ff]/24 bg-[#67d7ff]/10 text-[#9ae7ff] hover:bg-[#67d7ff]/16"
                                : gate.tone === "passed"
                                  ? "border-emerald-300/18 bg-emerald-400/8 text-emerald-100/70"
                                  : gate.tone === "locked"
                                    ? "border-rose-300/18 bg-rose-400/8 text-rose-100/70"
                                    : "cursor-not-allowed border-white/8 bg-white/[0.025] text-white/32"
                            }`}
                          >
                            {canOpenExam ? "Aplicar teórica" : gate.tone === "passed" ? "Aprobada" : gate.tone === "locked" ? "Bloqueada" : "Aplicar teórica"}
                          </button>
                          {attempt ? (
                            <span className="text-right text-[11px] leading-4 text-white/36">
                              Último intento: {attempt.score_percent}% · {formatTheoryAttemptDate(attempt.submitted_at)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}              </div>
            </div>

          </div>
        ) : null}
      </div>

      <TrainingCheckrideDispatchModal
        checkride={selectedTrainingCheckride}
        onClose={() => setSelectedTrainingCheckride(null)}
      />

      <TrainingTheoryExamModal
        exam={selectedTrainingTheoryExam}
        profile={profile}
        latestAttempt={selectedTrainingTheoryExam ? trainingTheoryAttempts[selectedTrainingTheoryExam.code] : null}
        onClose={() => setSelectedTrainingTheoryExam(null)}
        onAttemptSaved={(attempt) => {
          setTrainingTheoryAttempts((current) => ({
            ...current,
            [attempt.exam_code]: attempt,
          }));
        }}
      />

      <TrainingReservationModal
        aircraft={trainingPlannerAircraft}
        profile={profile}
        onClose={() => setTrainingPlannerAircraft(null)}
        onReserved={(reservation) => {
          setActiveReservation(reservation);
        }}
      />
    </section>
  );
}

function DashboardPartnersShowcase() {
  return (
    <section
      id="partners"
      className="mt-8 overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),linear-gradient(180deg,rgba(7,25,48,0.88),rgba(3,12,24,0.94))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6 lg:p-8"
    >
      <div className="flex flex-col gap-4 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
            Partners / Integraciones
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Programas recomendados para operar Patagonia Wings
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/68">
            Herramientas externas que complementan la operación del piloto: planificación, cartas, navegación,
            comunicaciones y experiencia de simulación. Cada logo abre su sitio oficial de descarga en una nueva pestaña.
          </p>
        </div>

        <div className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100/80">
          Publicidad oficial de partners
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {DASHBOARD_PARTNERS.map((partner) => (
          <a
            key={partner.name}
            href={partner.href}
            target="_blank"
            rel="noreferrer"
            className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/28 hover:bg-white/[0.06] hover:shadow-[0_22px_70px_rgba(21,213,255,0.11)] sm:p-6"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(34,211,238,0.16),transparent_42%)] opacity-70 transition group-hover:opacity-100" />
            <div className="relative z-10 flex min-h-[245px] flex-col justify-between gap-6">
              <div className="flex min-h-[130px] items-center justify-center rounded-[24px] border border-white/8 bg-black/20 px-6 py-8">
                <Image
                  src={partner.logoPath}
                  alt={`${partner.name} logo`}
                  width={420}
                  height={160}
                  className="max-h-[128px] w-auto max-w-full object-contain opacity-90 drop-shadow-[0_18px_38px_rgba(0,0,0,0.36)] transition duration-300 group-hover:scale-[1.03] group-hover:opacity-100"
                  sizes="(max-width: 1024px) 90vw, 420px"
                />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/52">
                  {partner.eyebrow}
                </p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">{partner.name}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/62">{partner.description}</p>
                  </div>
                  <span className="inline-flex w-fit shrink-0 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition group-hover:border-cyan-100/34 group-hover:bg-cyan-300/16">
                    {partner.cta} →
                  </span>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function DashboardContent() {
  const session = useProtectedSession();
  const [profile, setProfile] = useState<PilotProfileRecord | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [central, setCentral] = useState<CentralOverview>({
    airportCode: "SCEL",
    airportName: "Aeropuerto actual del piloto",
    municipality: "Ubicación operativa",
    countryCode: "CL",
    countryName: "Chile",
    pilotsOnField: 0,
    metarText: "METAR preparado para conectar en el siguiente bloque.",
    imagePath: getAirportImagePath("SCEL"),
    transferOptions: buildTransferOptions("CL", "SCEL"),
    monthlyRankingCards: [
      { title: "Mejores puntajes mes", entries: [{ label: "Sin datos", value: "Pendiente" }] },
      { title: "Ranking de horas mes", entries: [{ label: "Sin datos", value: "Pendiente" }] },
      { title: "Mejores PIREP mes", entries: [{ label: "Sin datos", value: "Pendiente" }] },
    ],
    yearlyRankingCards: [
      { title: "Mejores puntajes año", entries: [{ label: "Sin datos", value: "Pendiente" }] },
      { title: "Ranking de horas año", entries: [{ label: "Sin datos", value: "Pendiente" }] },
      { title: "Mejores PIREP año", entries: [{ label: "Sin datos", value: "Pendiente" }] },
    ],
    activeFlights: [],
    recentFlights: [],
    newsItems: buildNewsItems("SCEL", 0, [], []),
  });
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<DashboardTabKey>(initialTab === "dispatch" ? "dispatch" : initialTab === "office" ? "office" : initialTab === "training" ? "training" : "central");
  const [availableAircraft, setAvailableAircraft] = useState<AvailableAircraftOption[]>([]);
  const [availableItineraries, setAvailableItineraries] = useState<AvailableItineraryOption[]>([]);
  const [trainingAircraftProgress, setTrainingAircraftProgress] = useState<TrainingAircraftProgress[]>([]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");

    if (requestedTab === "dispatch" || requestedTab === "office" || requestedTab === "training" || requestedTab === "central") {
      setActiveTab(requestedTab);
      return;
    }

    setActiveTab("central");
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      const nextProfile = await ensurePilotProfile(session.user);

      if (!isMounted || !nextProfile) {
        return;
      }

      setProfile(nextProfile);

      const currentAirport = getPreferredAirportCode(nextProfile);
      setMetrics((current) => ({
        ...current,
        pilotStatus:
          nextProfile.status?.trim().toLowerCase() === "inactive" ? "INACTIVO" : "ACTIVO",
        monthLabel: buildMonthLabel(),
        totalHours: getProfileTotalHours(nextProfile),
        walletBalance: getProfileWallet(nextProfile),
        careerRankCode: nextProfile.career_rank_code ?? nextProfile.rank_code ?? "CADET",
        careerRank: getRankInsignia(nextProfile.career_rank_code ?? nextProfile.rank_code).name,
      }));
      setCentral((current) => ({
        ...current,
        airportCode: currentAirport,
        imagePath: getAirportImagePath(currentAirport),
      }));

      try {
        const [nextMetrics, nextCentral, nextAvailableAircraft, nextAvailableItineraries, nextTrainingAircraftProgress] = await Promise.all([
          loadDashboardMetrics(nextProfile),
          loadCentralOverview(nextProfile),
          listAvailableAircraft(nextProfile),
          listAvailableItineraries(nextProfile),
          loadTrainingAircraftProgress(nextProfile),
        ]);

        if (isMounted) {
          setMetrics(nextMetrics);
          setCentral(nextCentral);
          setAvailableAircraft(nextAvailableAircraft);
          setAvailableItineraries(nextAvailableItineraries);
          setTrainingAircraftProgress(nextTrainingAircraftProgress);
        }
      } catch (error) {
        console.error("No se pudieron cargar todas las métricas del dashboard:", error);
        if (isMounted) {
          setMetrics((current) => ({
            ...current,
            pilotStatus:
              nextProfile.status?.trim().toLowerCase() === "inactive" ? "INACTIVO" : "ACTIVO",
            monthLabel: buildMonthLabel(),
            totalHours: getProfileTotalHours(nextProfile),
            walletBalance: getProfileWallet(nextProfile),
            careerRankCode: nextProfile.career_rank_code ?? nextProfile.rank_code ?? "CADET",
            careerRank: getRankInsignia(nextProfile.career_rank_code ?? nextProfile.rank_code).name,
          }));

          setCentral((current) => ({
            ...current,
            airportCode:
              (nextProfile.current_airport_code ?? nextProfile.base_hub ?? "SCEL")
                .trim()
                .toUpperCase(),
            imagePath: getAirportImagePath(
              (nextProfile.current_airport_code ?? nextProfile.base_hub ?? "SCEL")
                .trim()
                .toUpperCase(),
            ),
          }));
          setAvailableAircraft([]);
          setAvailableItineraries([]);
          setTrainingAircraftProgress([]);
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [session.user]);

  const pilotName = useMemo(
    () => getShortPilotName(profile),
    [profile],
  );

  const compactMetrics = useMemo<MetricDisplayItem[]>(
    () => [
      { label: "Estado", type: "text", value: metrics.pilotStatus },
      { label: "Patagonia Score", type: "number", value: metrics.patagoniaScore, decimals: 1 },
      { label: "Rango", type: "text", value: metrics.careerRank },
      {
        label: `Posición ${metrics.monthLabel}`,
        type: metrics.monthPosition == null ? "text" : "number",
        value: metrics.monthPosition ?? "—",
      },
      { label: `Hs. ${metrics.monthLabel}`, type: "number", value: metrics.monthHours, decimals: 1 },
      { label: "PIREPs", type: "number", value: metrics.totalPireps },
      { label: "Horas", type: "number", value: metrics.totalHours, decimals: 1 },
      
      { label: "Billetera", type: "currency", value: metrics.walletBalance },
    ],
    [metrics],
  );

  const animationSeed = useMemo(
    () => JSON.stringify({
      monthPosition: metrics.monthPosition,
      monthHours: metrics.monthHours,
      totalPireps: metrics.totalPireps,
      totalHours: metrics.totalHours,
      patagoniaScore: metrics.patagoniaScore,
      walletBalance: metrics.walletBalance,
    }),
    [metrics],
  );

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-10 sm:px-6 sm:py-14 xl:px-10 lg:py-16">
      <section className="glass-panel rounded-[30px] px-6 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Bienvenido, {pilotName}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/76 sm:text-[15px]">
              Queremos ser la mejor aerolínea virtual del sur del mundo. Ayúdanos a seguir mejorando cada vuelo.
            </p>
          </div>

        </div>
      </section>

      <PilotStatsRail
        items={compactMetrics}
        animationSeed={animationSeed}
        rankCode={metrics.careerRankCode}
      />

      <div className="mt-6">
        <DashboardWorkspace
          userId={session.user.id}
          profile={profile}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          metrics={metrics}
          central={central}
          availableAircraft={availableAircraft}
          availableItineraries={availableItineraries}
          trainingAircraftProgress={trainingAircraftProgress}
        />
      </div>

    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="relative z-10">
          <header className="pw-container sticky top-4 z-40 pt-5">
            <PublicHeader />
          </header>

          <ProtectedPage>
            <DashboardContent />
          </ProtectedPage>
        </div>
      </section>
    </main>
  );
}
