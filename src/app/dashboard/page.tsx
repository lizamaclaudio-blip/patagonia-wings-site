"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PublicHeader from "@/components/site/PublicHeader";
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
  type AvailableAircraftOption,
  type AvailableItineraryOption,
  type FlightOperationRecord,
  type FlightMode,
} from "@/lib/flight-ops";
import {
  buildSimbriefEditUrl,
  buildSimbriefRedirectUrl,
  resolveSimbriefType,
  type SimbriefOfpSummary,
} from "@/lib/simbrief";
import { supabase } from "@/lib/supabase/browser";

type DashboardMetrics = {
  pilotStatus: string;
  monthLabel: string;
  monthPosition: number | null;
  monthHours: number;
  totalPireps: number;
  totalHours: number;
  pulso10: number;
  ruta10: number;
  legadoPoints: number;
  walletBalance: number;
  careerRank: string;
};

type ScoreLedgerRow = {
  pilot_callsign: string | null;
  flight_hours: number | null;
  procedure_score?: number | null;
  mission_score?: number | null;
  created_at: string | null;
};

type ScoreRow = {
  pilot_callsign: string;
  pulso_10: number | null;
  ruta_10: number | null;
  legado_points: number | null;
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

type DispatchMetarSummary = {
  condition: string;
  temperature: string;
  qnh: string;
  wind: string;
  visibility: string;
  raw: string;
};

type FlightReservationRow = {
  pilot_callsign: string | null;
  route_code?: string | null;
  aircraft_type_code?: string | null;
  aircraft_registration?: string | null;
  origin_ident?: string | null;
  destination_ident?: string | null;
  status?: string | null;
  flight_mode_code?: string | null;
  procedure_score?: number | null;
  mission_score?: number | null;
  completed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type RankingCard = {
  title: string;
  entries: Array<{ label: string; value: string }>;
};

type TransferOption = {
  title: string;
  subtitle: string;
  eta: string;
  priceLabel: string;
  accent: "emerald" | "cyan" | "amber";
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
  pulso10: 0,
  ruta10: 0,
  legadoPoints: 0,
  walletBalance: 0,
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
    id: "training",
    title: "Entrenamiento",
    description: "Sesiones de práctica, chequeos y preparación operativa antes de salir a línea.",
    imageSrc: "/dispatch/flight-types/training.png",
  },
  {
    id: "event",
    title: "Evento",
    description: "Bloque reservado para vuelos coordinados, convocatoria interna y operación compartida.",
    imageSrc: "/dispatch/flight-types/event.png",
  },
  {
    id: "special_mission",
    title: "Misión especial",
    description: "Misiones puntuales con contexto operacional singular y prioridad específica.",
    imageSrc: "/dispatch/flight-types/special-mission.png",
  },
  {
    id: "free_flight",
    title: "Vuelo libre",
    description: "Salida abierta para explorar, practicar o mover aeronave con libertad visual.",
    imageSrc: "/dispatch/flight-types/free-flight.png",
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

function formatRankLabel(value: string | null | undefined) {
  const normalized = (value ?? "CADET").trim();
  if (!normalized) {
    return "Cadet";
  }

  return normalized
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
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
    return "Pendiente";
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

function calculateDistanceNm(
  originAirport: ItineraryAirportMeta | undefined,
  destinationAirport: ItineraryAirportMeta | undefined,
) {
  const originLat = originAirport?.latitude_deg;
  const originLon = originAirport?.longitude_deg;
  const destinationLat = destinationAirport?.latitude_deg;
  const destinationLon = destinationAirport?.longitude_deg;

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLon) ||
    !Number.isFinite(destinationLat) ||
    !Number.isFinite(destinationLon)
  ) {
    return null;
  }

  const dLat = toRadians((destinationLat ?? 0) - (originLat ?? 0));
  const dLon = toRadians((destinationLon ?? 0) - (originLon ?? 0));
  const lat1 = toRadians(originLat ?? 0);
  const lat2 = toRadians(destinationLat ?? 0);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  const distance = 3440.065 * 2 * Math.asin(Math.sqrt(haversine));
  return Number.isFinite(distance) ? Math.round(distance) : null;
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

function buildDispatchFlightNumber(itinerary: AvailableItineraryOption | null) {
  if (!itinerary) {
    return "Pendiente";
  }

  const rawNumber = itinerary?.flight_number?.trim().toUpperCase() ?? "";
  const designator = itinerary?.flight_designator?.trim().toUpperCase() ?? "";
  const airlineCode = designator.match(/^[A-Z]+/)?.[0] ?? "PWG";
  const numberDigits =
    rawNumber.match(/\d{1,4}$/)?.[0] ??
    designator.match(/\d{1,4}$/)?.[0] ??
    "";

  if (numberDigits) {
    return `${airlineCode} ${numberDigits.padStart(3, "0")}`;
  }

  const generatedNumber = getOperationalFlightNumber(itinerary.origin_icao, itinerary.destination_icao);
  const generatedDigits = generatedNumber.match(/\d{1,4}$/)?.[0] ?? "";
  if (generatedDigits) {
    return `PWG ${generatedDigits.padStart(3, "0")}`;
  }

  return designator || rawNumber || "Pendiente";
}

function getDispatchFlightNumberValidationValue(itinerary: AvailableItineraryOption | null) {
  if (!itinerary) {
    return "";
  }

  const rawNumber = itinerary?.flight_number?.trim().toUpperCase() ?? "";
  const designator = itinerary?.flight_designator?.trim().toUpperCase() ?? "";
  const numberDigits =
    rawNumber.match(/\d{1,4}$/)?.[0] ??
    designator.match(/\d{1,4}$/)?.[0] ??
    "";

  if (numberDigits) {
    return numberDigits.padStart(3, "0");
  }

  const generatedNumber = getOperationalFlightNumber(itinerary.origin_icao, itinerary.destination_icao);
  const generatedDigits = generatedNumber.match(/\d{1,4}$/)?.[0] ?? "";
  if (generatedDigits) {
    return generatedDigits.padStart(3, "0");
  }

  return normalizeDispatchComparisonValue(rawNumber || designator);
}

function formatSimbriefFlightNumber(value: string | null | undefined) {
  const normalized = normalizeDispatchComparisonValue(value);
  const airlineCode = normalized.match(/^[A-Z]+/)?.[0] ?? "PWG";
  const numberDigits = normalized.match(/\d{1,4}$/)?.[0] ?? "";

  if (numberDigits) {
    return `${airlineCode} ${numberDigits.padStart(3, "0")}`;
  }

  return normalized || "Pendiente";
}

function getSimbriefFlightNumberValidationValue(value: string | null | undefined) {
  const normalized = normalizeDispatchComparisonValue(value);
  const numberDigits = normalized.match(/\d{1,4}$/)?.[0] ?? "";
  return numberDigits ? numberDigits.padStart(3, "0") : normalized;
}

function normalizeDispatchComparisonValue(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function getAirportImagePath(airportCode: string) {
  return `/airports/${airportCode.toUpperCase()}.png`;
}

function getPreferredAirportCode(profile?: PilotProfileRecord | null) {
  return (
    profile?.current_airport_code ??
    profile?.base_hub ??
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
  });

  return `/api/airport-hero?${params.toString()}`;
}

function buildTransferOptions(countryCode: string, airportCode: string): TransferOption[] {
  const isChile = countryCode === "CL";

  return [
    {
      title: "Traslado terrestre",
      subtitle: isChile
        ? `Moverte por tierra desde ${airportCode} hacia otro punto nacional cuando la economía quede activa.`
        : `Moverte por tierra desde ${airportCode} hacia otro punto doméstico cuando la economía quede activa.`,
      eta: isChile ? "2h a 8h" : "3h a 10h",
      priceLabel: isChile ? "$18.000 CLP" : "$24.000 ARS",
      accent: "emerald",
    },
    {
      title: "Ticket aéreo regular",
      subtitle: "Reservado para saltos rápidos entre hubs y aeropuertos de red sin romper la ubicación real del piloto.",
      eta: "45m a 3h",
      priceLabel: "Economía piloto",
      accent: "cyan",
    },
    {
      title: "Reposicionamiento prioritario",
      subtitle: "Opción futura para mover al piloto con prioridad operacional cuando la red o un evento lo requieran.",
      eta: "Prioridad alta",
      priceLabel: "Tarifa dinámica",
      accent: "amber",
    },
  ];
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

function buildNewsItems(
  airportCode: string,
  pilotsOnField: number,
  activeFlights: FlightReservationRow[],
  recentFlights: FlightReservationRow[],
): NewsItem[] {
  const latestFlight = recentFlights[0] ?? null;
  const latestFlightTag = latestFlight ? formatRouteTag(latestFlight) : `${airportCode} → ---`;
  const latestFlightScore = latestFlight ? toSafeNumber(latestFlight.procedure_score) : 0;
  const activeCount = activeFlights.length;

  return [
    {
      tag: "NOTAM",
      title: `Centro informativo ${airportCode}`,
      body: `Este panel queda listo para eventos, avisos operativos, récords del mes y publicaciones internas sin salir de la Central del hub.`,
    },
    {
      tag: "OPERACIÓN",
      title: activeCount > 0 ? `${activeCount} vuelo(s) activos ahora` : "Operación tranquila en este momento",
      body:
        activeCount > 0
          ? `Ya puedes usar esta ventana para destacar la operación viva del día y luego enchufar alertas reales según salida, taxi, crucero o llegada.`
          : `Cuando haya pilotos volando, aquí podrás destacar movimientos activos, eventos del día y tráfico relevante del hub actual.`,
    },
    {
      tag: "ÚLTIMO CIERRE",
      title: latestFlight ? latestFlightTag : "Esperando vuelos recientes",
      body: latestFlight
        ? `Último cierre registrado con ${formatDecimal(latestFlightScore)} pts de procedimiento. Este bloque queda listo para convertirlo luego en noticia, récord o destacado.`
        : `Aún no hay cierres recientes para convertir en noticia. Cuando entren más vuelos, esta tarjeta podrá resaltar el último PIREP destacado.`,
    },
    {
      tag: "MOVIMIENTO HUB",
      title: `${formatInteger(pilotsOnField)} piloto(s) en ${airportCode}`,
      body: `La Central ya puede mostrar el pulso del hub actual. Más adelante podremos usar este mismo bloque para avisos de traslados, slots o saturación operativa.`,
    },
  ];
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
    cancelled: "Cancelado",
    completed: "Completado",
    dispatched: "Despacho",
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
      rawValue: toSafeNumber(flight.procedure_score),
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

  const [scoreRes, monthLedgerRes, allMonthLedgerRes, pirepCountRes, pilotProfilesRes] = await Promise.all([
    supabase
      .from("pw_pilot_scores")
      .select("pilot_callsign, pulso_10, ruta_10, legado_points")
      .eq("pilot_callsign", callsign)
      .maybeSingle(),
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

  return {
    pilotStatus,
    monthLabel,
    monthPosition: monthPosition >= 0 ? monthPosition + 1 : rankingRows.length ? rankingRows.length + 1 : 1,
    monthHours,
    totalPireps: pirepCountRes.count ?? 0,
    totalHours,
    pulso10: toSafeNumber((scoreRes.data as ScoreRow | null)?.pulso_10),
    ruta10: toSafeNumber((scoreRes.data as ScoreRow | null)?.ruta_10),
    legadoPoints: toSafeNumber((scoreRes.data as ScoreRow | null)?.legado_points),
    walletBalance: getProfileWallet(profile),
    careerRank: formatRankLabel(profile.career_rank_code ?? profile.rank_code),
  } satisfies DashboardMetrics;
}

async function loadCentralOverview(profile: PilotProfileRecord): Promise<CentralOverview> {
  const currentAirport = (
    profile.current_airport_code ??
    profile.base_hub ??
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
        "pilot_callsign, route_code, aircraft_type_code, aircraft_registration, origin_ident, destination_ident, status, flight_mode_code, updated_at",
      )
      .in("status", ["dispatched", "in_flight"])
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("flight_reservations")
      .select(
        "pilot_callsign, route_code, aircraft_type_code, aircraft_registration, origin_ident, destination_ident, status, flight_mode_code, procedure_score, mission_score, completed_at, created_at",
      )
      .eq("status", "completed")
      .order("completed_at", { ascending: false, nullsFirst: false })
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
        "pilot_callsign, route_code, procedure_score, mission_score, completed_at, created_at, origin_ident, destination_ident",
      )
      .eq("status", "completed")
      .eq("scoring_status", "scored")
      .gte("completed_at", monthStart)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from("flight_reservations")
      .select(
        "pilot_callsign, route_code, procedure_score, mission_score, completed_at, created_at, origin_ident, destination_ident",
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
    const metarResponse = await fetch(`/api/weather/metar?ids=${currentAirport}`, {
      method: "GET",
      cache: "no-store",
    });

    if (metarResponse.ok) {
      const metarPayload = await metarResponse.json().catch(() => null) as {
        metar?: { raw?: string | null } | null;
      } | null;

      const rawMetar = metarPayload?.metar?.raw?.trim();
      if (rawMetar) {
        metarText = rawMetar;
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
}: {
  items: MetricDisplayItem[];
  animationSeed: string;
}) {
  return (
    <aside className="order-1 xl:order-2">
      <div className="glass-panel rounded-[30px] p-4 sm:p-5">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
          Estadísticas del piloto
        </p>

        <div className="mt-4 grid gap-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex min-h-[82px] flex-col items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4 text-center"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/58">
                {item.label}
              </span>
              <span className="mt-2 text-xl font-semibold tracking-tight text-white">
                <AnimatedMetricValue item={item} animateKey={animationSeed} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
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
  const showPexelsAttribution =
    Boolean(displayImageUrl) &&
    heroImage?.source === "pexels" &&
    Boolean(heroImage.photographerName || heroImage.providerName);

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
          <div className="overflow-hidden rounded-[24px] bg-[#07131f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            {displayImageUrl ? (
              <div className="relative h-full min-h-[220px] w-full overflow-hidden rounded-[24px] bg-[#07131f]">
                <img
                  src={displayImageUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover object-center blur-2xl scale-110 opacity-55"
                />

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_24%,rgba(2,10,18,0.28)_100%)]" />

                <img
                  src={displayImageUrl}
                  alt={`${central.airportCode} banner`}
                  className="absolute inset-0 h-full w-full object-contain object-center"
                  loading="eager"
                  fetchPriority="high"
                  onError={() => {
                    if (resolvedImageUrl) {
                      setFailedImageUrl(resolvedImageUrl);
                    }
                  }}
                />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(3,10,20,0.94))] px-5 pb-4 pt-12">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
                        Marco dinámico del hub
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {central.municipality} · {central.countryName}
                      </p>
                    </div>

                    <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/68">
                      {heroImage?.source === "local"
                        ? "Imagen manual"
                        : heroImage?.source === "pexels"
                          ? "Fallback API"
                          : isResolvingImage
                            ? "Buscando foto"
                            : "Sin imagen local"}
                    </div>
                  </div>

                  {showPexelsAttribution ? (
                    <p className="pointer-events-auto mt-3 text-[11px] leading-5 text-white/60">
                      Foto por{" "}
                      {heroImage?.photographerUrl ? (
                        <a
                          href={heroImage.photographerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-200/90 transition hover:text-cyan-100"
                        >
                          {heroImage.photographerName}
                        </a>
                      ) : (
                        <span className="text-white/74">{heroImage?.photographerName}</span>
                      )}
                      {" "}vía{" "}
                      {heroImage?.providerUrl ? (
                        <a
                          href={heroImage.providerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-200/90 transition hover:text-cyan-100"
                        >
                          {heroImage?.providerName ?? "Pexels"}
                        </a>
                      ) : (
                        <span className="text-white/74">{heroImage?.providerName ?? "Pexels"}</span>
                      )}
                      {heroImage?.photoPageUrl ? (
                        <>
                          {" "}·{" "}
                          <a
                            href={heroImage.photoPageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-200/90 transition hover:text-cyan-100"
                          >
                            ver foto
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[220px] h-full w-full items-end overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(30,144,255,0.24),transparent_38%),linear-gradient(135deg,rgba(3,20,40,1),rgba(7,35,66,0.86))] p-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                    Marco dinámico del aeropuerto
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">
                    {central.airportCode}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-7 text-white/74">
                    Si subes una imagen manual en{" "}
                    <span className="font-semibold text-white">public/airports/{central.airportCode}.jpg</span>,
                    la tomará primero. Si no existe, quedará listo para buscar una foto automática por ciudad.
                  </p>
                </div>
              </div>
            )}
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                METAR
              </p>
              <p className="mt-3 text-sm leading-7 text-white/78">{central.metarText}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                  ICAO actual
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">{central.airportCode}</p>
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
                  <span className="text-lg font-semibold text-white">{central.countryName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CentralTransfersSection({
  airportCode,
  options,
}: {
  airportCode: string;
  options: TransferOption[];
}) {
  const accentMap: Record<TransferOption["accent"], string> = {
    emerald: "border-emerald-400/14 bg-emerald-500/[0.05] text-emerald-200",
    cyan: "border-cyan-400/14 bg-cyan-500/[0.05] text-cyan-200",
    amber: "border-amber-400/14 bg-amber-500/[0.05] text-amber-200",
  };

  return (
    <section>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
            Traslados
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Movimiento entre ubicaciones</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72">
            Este bloque ya queda listo para la futura economía del piloto. Desde aquí podrás pagar un
            movimiento controlado desde <span className="font-semibold text-white">{airportCode}</span> sin romper la
            ubicación real ni el flujo operativo del hub.
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
            Estado del módulo
          </p>
          <p className="mt-2 text-sm font-semibold text-white">Preparado para economía</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {options.map((option) => (
          <article
            key={option.title}
            className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4"
          >
            <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accentMap[option.accent]}`}>
              Próximamente
            </div>
            <h4 className="mt-4 text-lg font-semibold text-white">{option.title}</h4>
            <p className="mt-3 text-sm leading-7 text-white/72">{option.subtitle}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-[#031428]/55 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Tiempo</p>
                <p className="mt-2 text-sm font-semibold text-white">{option.eta}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#031428]/55 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Costo base</p>
                <p className="mt-2 text-sm font-semibold text-white">{option.priceLabel}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CentralNewsSection({ items }: { items: CentralOverview["newsItems"] }) {
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
        Noticias / NOTAM
      </p>
      <h3 className="mt-2 text-2xl font-semibold text-white">Panel informativo</h3>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <article
            key={`${item.tag}-${item.title}`}
            className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4"
          >
            <div className="inline-flex rounded-full border border-white/10 bg-[#031428]/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              {item.tag}
            </div>
            <p className="mt-4 text-base font-semibold text-white">{item.title}</p>
            <p className="mt-3 text-sm leading-7 text-white/72">{item.body}</p>
          </article>
        ))}
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
      ? ["Piloto", "Vuelo", "Aeronave", "Origen", "Destino", "Estado", "Tipo"]
      : ["Piloto", "Vuelo", "Aeronave", "Origen", "Destino", "Score", "Tipo"];

  const statusTone = (status?: string | null) => {
    const normalized = (status ?? "").trim().toLowerCase();

    if (normalized === "in_flight") {
      return "border-cyan-400/18 bg-cyan-500/[0.08] text-cyan-200";
    }

    if (normalized === "dispatched") {
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
                const routeLabel = row.route_code?.trim() || formatRouteTag(row);
                const aircraftPrimary =
                  row.aircraft_type_code?.trim() || row.aircraft_registration?.trim() || "---";
                const aircraftSecondary =
                  row.aircraft_registration?.trim() && row.aircraft_registration?.trim() !== aircraftPrimary
                    ? row.aircraft_registration?.trim()
                    : null;

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
                      {aircraftSecondary ? (
                        <div className="mt-1 text-xs uppercase tracking-[0.14em] text-white/42">
                          {aircraftSecondary}
                        </div>
                      ) : null}
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
                            : "Pendiente"}
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
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-white/54">
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

function CentralWorkspace({ central }: { central: CentralOverview }) {
  return (
    <div className="space-y-6">
      <CentralAirportHero central={central} />

      <CentralSectionDivider />
      <CentralTransfersSection airportCode={central.airportCode} options={central.transferOptions} />

      <CentralSectionDivider />
      <CentralNewsSection items={central.newsItems} />

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

  // Step 2: variantes únicas (aircraft_type_code) para el modelo seleccionado
  const uniqueVariants = useMemo(() => {
    if (!selModelCode) return [];
    // key → { addonLabel, displayName }
    const seen = new Map<string, { addonLabel: string; displayName: string }>();
    for (const r of available.filter(
      (r) => (r.aircraft_variant_code?.trim() || r.aircraft_code) === selModelCode
    )) {
      const key = r.aircraft_type_code?.trim() || "__none__";
      // Preferir addon_provider (ej. "PMDG", "Asobo", "Black Square") sobre variant_name
      const addonLabel = r.addon_provider?.trim() || r.variant_name?.trim() || "Estándar";
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
  const registrations = useMemo(() => {
    if (!selModelCode || !selVariantKey) return [];
    return available.filter((r) => {
      const modelKey = r.aircraft_variant_code?.trim() || r.aircraft_code;
      const varKey = r.aircraft_type_code?.trim() || "__none__";
      return modelKey === selModelCode && varKey === selVariantKey;
    });
  }, [available, selModelCode, selVariantKey]);

  // Auto-select registration when only one option available
  useEffect(() => {
    if (registrations.length === 1 && selectedAircraftId !== registrations[0].aircraft_id) {
      onSelect(registrations[0].aircraft_id);
    }
  }, [registrations, selectedAircraftId, onSelect]);

  const selectedReg = useMemo(
    () => available.find((r) => r.aircraft_id === selectedAircraftId) ?? null,
    [available, selectedAircraftId]
  );

  const handleModelChange = (code: string) => {
    setSelModelCode(code);
    setSelVariantKey("");
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

        {/* 2 · Variante / Addon */}
        <div className="flex flex-col gap-2">
          <label
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
              selModelCode ? "text-white/54" : "text-white/24"
            }`}
          >
            2 · Variante / Addon
          </label>
          <select
            value={selVariantKey}
            onChange={(e) => setSelVariantKey(e.target.value)}
            disabled={!selModelCode}
            className="w-full rounded-[12px] border border-white/12 bg-[#031428] px-4 py-3 text-sm text-white focus:border-sky-400/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-36"
          >
            <option value="">— Elige variante —</option>
            {uniqueVariants.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* 3 · N° de registro */}
        <div className="flex flex-col gap-2">
          <label
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
              selVariantKey ? "text-white/54" : "text-white/24"
            }`}
          >
            3 · N° de registro
          </label>
          <select
            value={selectedAircraftId ?? ""}
            onChange={(e) => {
              if (e.target.value) onSelect(e.target.value);
            }}
            disabled={!selVariantKey}
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
              <th className="px-4 py-3 font-semibold">Salida (local)</th>
              <th className="px-4 py-3 font-semibold text-right">Accion</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isSelected = selectedItineraryId === row.itinerary_id;
              const originCode = row.origin_icao.trim().toUpperCase();
              const destinationCode = row.destination_icao.trim().toUpperCase();
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
                  key={row.itinerary_id}
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
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-white/54">
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

function DashboardWorkspace({
  profile,
  activeTab,
  onChangeTab,
  metrics,
  central,
  availableAircraft,
  availableItineraries,
}: {
  profile: PilotProfileRecord | null;
  activeTab: DashboardTabKey;
  onChangeTab: (tab: DashboardTabKey) => void;
  metrics: DashboardMetrics;
  central: CentralOverview;
  availableAircraft: AvailableAircraftOption[];
  availableItineraries: AvailableItineraryOption[];
}) {
  const [activeReservation, setActiveReservation] = useState<(FlightReservationRow & { id: string }) | null>(null);
  const [cancellingReservation, setCancellingReservation] = useState(false);
  const [dispatchStep, setDispatchStep] = useState<DispatchStepKey>("flight_type");
  const [selectedFlightType, setSelectedFlightType] = useState<DispatchFlightTypeId | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<string | null>(null);
  const [selectedItinerary, setSelectedItinerary] = useState<string | null>(null);
  const [selectedDepartureHHMM, setSelectedDepartureHHMM] = useState<string>("08:00");
  const [dispatchReady, setDispatchReady] = useState(false);
  const [simbriefSummary, setSimbriefSummary] = useState<SimbriefOfpSummary | null>(null);
  const [syncingSimbrief, setSyncingSimbrief] = useState(false);
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
      setNavigraphErrorMessage(
        error instanceof Error ? error.message : "No se pudo desconectar Navigraph."
      );
    } finally {
      setLoadingNavigraphStatus(false);
    }
  }

  async function handleOpenSimbriefPlanner() {
    if (!profile || !selectedAircraftRecord || !selectedItineraryRecord) {
      setNavigraphErrorMessage("Primero debes confirmar tipo de vuelo, aeronave e itinerario.");
      return;
    }

    if (!profile.simbrief_username?.trim()) {
      setNavigraphErrorMessage("Falta tu usuario SimBrief en Perfil para abrir el OFP.");
      return;
    }

    if (!navigraphConnected) {
      setNavigraphErrorMessage("Primero conecta Navigraph antes de abrir el plan OFP / SimBrief.");
      return;
    }

    setSyncingSimbrief(true);
    setNavigraphErrorMessage("");
    setNavigraphInfoMessage("");

    try {
      const flightNumber =
        selectedItineraryRecord.flight_designator?.trim().replace(/\s+/g, "").toUpperCase() ||
        `PWG${webFlightNumberValidationValue || "000"}`;

      const payload = {
        userId: profile.id,
        reservationId: preparedReservationId,
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
        routeText: selectedItineraryRecord.itinerary_code,
        scheduledDeparture: departureHHMMtoISO(selectedDepartureHHMM),
        eteMinutes:
          selectedItineraryRecord.expected_block_p50 ??
          selectedItineraryRecord.scheduled_block_min ??
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
        | { ok: true; staticId: string; generateUrl: string; editUrl: string }
        | { error?: string };

      if (!response.ok || !("ok" in data)) {
        throw new Error(
          data && "error" in data ? data.error || "No se pudo abrir SimBrief." : "No se pudo abrir SimBrief."
        );
      }

      setSimbriefStaticId(data.staticId);
      setNavigraphInfoMessage("Plan OFP preparado. Completa el despacho en SimBrief y luego usa 'Importar OFP'.");
      window.open(data.generateUrl || data.editUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setNavigraphErrorMessage(
        error instanceof Error ? error.message : "No se pudo abrir OFP / SimBrief."
      );
    } finally {
      setSyncingSimbrief(false);
    }
  }

  // Carga reserva activa del piloto — al montar y al cambiar de tab
  useEffect(() => {
    if (!profile) return;
    let alive = true;

    async function loadActiveReservation() {
      if (!profile) return;
      const { data } = await supabase
        .from("flight_reservations")
        .select("id, pilot_callsign, route_code, aircraft_type_code, aircraft_registration, origin_ident, destination_ident, status, flight_mode_code, updated_at, created_at")
        .eq("pilot_callsign", profile.callsign)
        .in("status", ["reserved", "dispatched", "in_flight"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (alive) {
        setActiveReservation(data as (FlightReservationRow & { id: string }) | null);
      }
    }

    void loadActiveReservation();
    return () => { alive = false; };
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
      setNavigraphInfoMessage("Volviste desde SimBrief. Ahora importa el OFP para validar el despacho.");
    }
  }, [activeTab, searchParams]);

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

  const canOpenAircraft = Boolean(selectedFlightType);
  const canOpenItinerary = canOpenAircraft && Boolean(selectedAircraft);
  const canOpenDispatch = canOpenItinerary && Boolean(selectedItinerary);
  const canOpenSummary = canOpenDispatch && dispatchReady;
  const dispatchMetar = useMemo(
    () => buildDispatchMetarSummary(central.metarText),
    [central.metarText],
  );
  const dispatchFlightMode = useMemo(
    () => mapDispatchFlightTypeToMode(selectedFlightType),
    [selectedFlightType],
  );
  const selectedAircraftRecord = useMemo(
    () => availableAircraft.find((option) => option.aircraft_id === selectedAircraft) ?? null,
    [availableAircraft, selectedAircraft],
  );
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
    const selectedCode = getDispatchAircraftCompatibilityCode(selectedAircraftRecord.aircraft_code);

    const aircraftMatched = modeFiltered.filter((item) => {
      // Prioridad 1: filtrar por service_profile (validación idéntica a la RPC)
      if (item.service_profile) {
        return isAircraftCompatibleWithRoute(typeCode, item.service_profile);
      }

      // Prioridad 2: lista explícita de tipos compatibles
      const compatibleTypes = item.compatible_aircraft_types ?? [];
      if (compatibleTypes.length > 0) {
        return compatibleTypes.some(
          (type) => getDispatchAircraftCompatibilityCode(type) === selectedCode,
        );
      }

      if (item.aircraft_type_code) {
        return getDispatchAircraftCompatibilityCode(item.aircraft_type_code) === selectedCode;
      }

      // Sin info de compatibilidad: mostrar igualmente
      return true;
    });

    // Strict filtering: when an aircraft is selected, only show compatible itineraries
    // (even if the list is empty — don't fall back to all routes)
    return aircraftMatched;
  }, [availableItineraries, central.airportCode, dispatchFlightMode, selectedAircraftRecord]);
  const selectedItineraryRecord = useMemo(
    () => filteredItineraries.find((option) => option.itinerary_id === selectedItinerary) ?? null,
    [filteredItineraries, selectedItinerary],
  );
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
  const simbriefFlightNumberDisplay = useMemo(
    () => formatSimbriefFlightNumber(simbriefSummary?.flightNumber),
    [simbriefSummary],
  );
  const simbriefFlightNumberValidationValue = useMemo(
    () => getSimbriefFlightNumberValidationValue(simbriefSummary?.flightNumber),
    [simbriefSummary],
  );
  const dispatchValidationItems = useMemo<DispatchValidationItem[]>(() => {
    const summary = simbriefSummary;
    const expectedFlightNumber = webFlightNumberValidationValue;
    const expectedOrigin = normalizeDispatchComparisonValue(webOriginCode);
    const expectedDestination = normalizeDispatchComparisonValue(webDestinationCode);
    const expectedAirframe = normalizeDispatchComparisonValue(webAirframe);
    const actualFlightNumber = simbriefFlightNumberValidationValue;
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
    typeof simbriefSummary?.distanceNm === "number"
      ? `${formatInteger(simbriefSummary.distanceNm)} NM`
      : typeof selectedItineraryRecord?.distance_nm === "number"
        ? `${formatInteger(selectedItineraryRecord.distance_nm)} NM`
        : "Pendiente";
  const summaryDispatchDuration =
    typeof simbriefSummary?.eteMinutes === "number"
      ? formatDurationMinutes(simbriefSummary.eteMinutes)
      : formatDurationMinutes(
          selectedItineraryRecord?.scheduled_block_min ??
            selectedItineraryRecord?.expected_block_p50 ??
            selectedItineraryRecord?.expected_block_p80 ??
            null,
        );
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
        filteredItineraries
          .flatMap((item) => [item.origin_icao, item.destination_icao])
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
    filteredItineraries,
  ]);

  useEffect(() => {
    if (selectedAircraft && !selectedAircraftRecord) {
      setSelectedAircraft(null);
      setSelectedItinerary(null);
      setDispatchReady(false);
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
    setDispatchReady(false);
    setSimbriefSummary(null);
    setSimbriefInfoMessage("");
    setSimbriefErrorMessage("");
    setPreparedReservationId(null);
    setSummaryInfoMessage("");
    setSummaryErrorMessage("");
    setDispatchStep("dispatch_flow");
  };

  async function handleLoadSimbriefData() {
    if (!profile?.simbrief_username?.trim()) {
      setDispatchReady(false);
      setSimbriefSummary(null);
      setSimbriefInfoMessage("");
      setSimbriefErrorMessage("Falta tu usuario SimBrief en Perfil para traer el OFP.");
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

      if (simbriefStaticId?.trim()) {
        search.set("static_id", simbriefStaticId.trim());
      }

      if (simbriefStaticId) {
        search.set("static_id", simbriefStaticId);
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

      setSimbriefSummary(data.summary);
      setSimbriefInfoMessage(
        "Datos de OFP cargados desde SimBrief. Revisa la validación antes de habilitar el resumen."
      );
      setSimbriefErrorMessage("");
      setPreparedReservationId(null);
    } catch (error) {
      setSimbriefSummary(null);
      setSimbriefInfoMessage("");
      setSimbriefErrorMessage(
        error instanceof Error ? error.message : "No se pudo cargar el OFP desde SimBrief."
      );
      setPreparedReservationId(null);
    } finally {
      setSyncingSimbrief(false);
    }
  }

  function handleValidateDispatch() {
    if (!simbriefSummary) {
      setDispatchReady(false);
      setSimbriefInfoMessage("");
      setSimbriefErrorMessage("Primero debes traer los datos del OFP desde SimBrief.");
      setPreparedReservationId(null);
      setSummaryInfoMessage("");
      setSummaryErrorMessage("");
      return;
    }

    if (simbriefStaticId?.trim() && !simbriefSummary.matchedByStaticId) {
      setDispatchReady(false);
      setSimbriefInfoMessage("");
      setSimbriefErrorMessage(
        "El OFP importado no coincide con el static_id del despacho actual. Vuelve a abrir SimBrief desde esta reserva y vuelve a importar."
      );
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

    if (simbriefStaticId?.trim() && !simbriefSummary.matchedByStaticId) {
      setSummaryInfoMessage("");
      setSummaryErrorMessage("El OFP importado no pertenece a esta reserva. Vuelve a abrir SimBrief desde este despacho e importa otra vez.");
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
        simbriefSummary?.flightNumber?.trim().replace(/\s+/g, "").toUpperCase() ||
        selectedItineraryRecord.flight_designator?.trim().replace(/\s+/g, "").toUpperCase() ||
        `PWG${webFlightNumberValidationValue || "000"}`;
      const remarks = [
        "DISPATCHED_FROM_DASHBOARD",
        simbriefSummary?.staticId ? `STATIC ${simbriefSummary.staticId}` : null,
        simbriefSummary?.aircraftRegistration ? `REG ${simbriefSummary.aircraftRegistration}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      const finalOperation: FlightOperationRecord = {
        reservationId: preparedReservationId,
        userId: profile.id,
        itineraryId: selectedItineraryRecord.itinerary_id,
        aircraftId: selectedAircraftRecord.aircraft_id,
        flightMode: dispatchFlightMode ?? selectedItineraryRecord.flight_mode ?? "itinerary",
        routeCode: selectedItineraryRecord.itinerary_code,
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
        routeText: simbriefSummary?.routeText?.trim() || selectedItineraryRecord.itinerary_code,
        scheduledDeparture: departureHHMMtoISO(selectedDepartureHHMM),
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
          flightNumber: simbriefSummary.flightNumber ?? normalizedFlightNumber,
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
            simbriefSummary.eteMinutes ??
            selectedItineraryRecord.scheduled_block_min ??
            undefined,
          expectedBlockP50Minutes:
            simbriefSummary.eteMinutes ??
            selectedItineraryRecord.expected_block_p50 ??
            undefined,
          expectedBlockP80Minutes:
            simbriefSummary.eteMinutes ??
            selectedItineraryRecord.expected_block_p80 ??
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

  return (
    <section className="glass-panel rounded-[30px] p-4 sm:p-5 lg:p-6">
      <div className="border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {DASHBOARD_TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            // Bloquear Oficina si hay un vuelo reservado/despachado activo
            const isOfficeBlocked = tab.key === "office" && Boolean(activeReservation) && !["completed", "cancelled"].includes(activeReservation?.status ?? "");
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => { if (!isOfficeBlocked) onChangeTab(tab.key); }}
                disabled={isOfficeBlocked}
                title={isOfficeBlocked ? `Vuelo ${activeReservation?.route_code ?? "activo"} en curso — finaliza o cancela el vuelo para despachar uno nuevo` : undefined}
                className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                    : isOfficeBlocked
                    ? "cursor-not-allowed border border-white/8 bg-white/[0.02] text-white/28 opacity-60"
                    : "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                }`}
              >
                {tab.label}
                {isOfficeBlocked ? " 🔒" : ""}
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
                            return (
                              <button
                                key={option.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => resetAfterFlightType(option.id)}
                                className={`group block w-full overflow-hidden rounded-[20px] border text-left transition duration-200 ${
                                  isSelected
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
                                      isSelected ? "scale-[1.03]" : "group-hover:scale-[1.04]"
                                    }`}
                                  />
                                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,14,28,0.08),rgba(4,12,24,0.68))]" />
                                  <div className="absolute inset-x-0 top-0 flex items-start justify-end px-4 pt-4">
                                    <span
                                      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-xs font-semibold ${
                                        isSelected
                                          ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-100"
                                          : "border-white/18 bg-black/18 text-white/74"
                                      }`}
                                    >
                                      {isSelected ? "Activo" : "Elegir"}
                                    </span>
                                  </div>
                                </div>

                                <div className="px-4 py-4">
                                  <span className="block text-base font-semibold text-white">{option.title}</span>
                                  <span className="mt-2 block text-sm leading-7 text-white/68">
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
                                : `No hay aeronaves disponibles en ${central.airportCode} para esta etapa.`}
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
                              : "No hay itinerarios compatibles para la combinacion actual."}
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
                          <button type="button" onClick={() => handleStepChange("itinerary")} className="button-secondary py-3">
                            Volver a itinerario
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
                        <h4 className="mt-3 text-2xl font-semibold text-white">Despacho</h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Confirma los datos del vuelo. Una vez confirmado, el resumen queda habilitado para despachar a la base operativa y que ACARS pueda rescatar la preparacion.
                        </p>
                      </div>


                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                              Navigraph · SimBrief
                            </p>
                            <h5 className="mt-2 text-xl font-semibold text-white">Conexión web y preparación del OFP</h5>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/68">
                              En la web usaremos Authorization Code Flow con Navigraph. Después abrimos SimBrief para generar el OFP, lo importamos, validamos vuelo/origen/destino/aeronave y recién entonces lo dejamos listo para ACARS.
                            </p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                            navigraphConnected
                              ? "border-emerald-300/20 bg-emerald-500/[0.12] text-emerald-100"
                              : "border-white/10 bg-white/[0.06] text-white/70"
                          }`}>
                            {loadingNavigraphStatus
                              ? "Consultando..."
                              : navigraphConnected
                                ? "Navigraph conectado"
                                : navigraphConfigured
                                  ? "Navigraph no conectado"
                                  : "Configuración pendiente"}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <DispatchValueCard
                            label="Estado web"
                            value={
                              loadingNavigraphStatus
                                ? "Consultando"
                                : navigraphConnected
                                  ? "Conectado"
                                  : navigraphConfigured
                                    ? "Pendiente"
                                    : "Sin configurar"
                            }
                            hint={navigraphStatus?.subject || "Cuenta Navigraph no enlazada"}
                          />
                          <DispatchValueCard
                            label="Scopes"
                            value={navigraphStatus?.scopes?.length ? navigraphStatus.scopes.join(", ") : "Pendiente"}
                          />
                          <DispatchValueCard
                            label="Expira"
                            value={navigraphExpiryLabel}
                          />
                          <DispatchValueCard
                            label="Static ID"
                            value={simbriefStaticId || simbriefSummary?.staticId || "Pendiente"}
                            hint="Se usa para reabrir o rescatar el OFP correcto."
                          />
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setNavigraphErrorMessage("");
                              setNavigraphInfoMessage("");
                              window.location.href = `/api/auth/navigraph/start?next=${encodeURIComponent("/dashboard?tab=dispatch")}`;
                            }}
                            className="button-primary py-3"
                          >
                            {navigraphConnected ? "Reconectar Navigraph" : "Conectar Navigraph"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleOpenSimbriefPlanner()}
                            disabled={!navigraphConnected || syncingSimbrief}
                            className={`py-3 ${!navigraphConnected || syncingSimbrief ? "button-secondary cursor-not-allowed opacity-55" : "button-secondary"}`}
                          >
                            {simbriefSummary?.staticId || simbriefStaticId ? "Abrir OFP / SimBrief" : "Crear OFP / SimBrief"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleLoadSimbriefData()}
                            disabled={syncingSimbrief}
                            className={`py-3 ${syncingSimbrief ? "button-secondary cursor-not-allowed opacity-55" : "button-secondary"}`}
                          >
                            {syncingSimbrief ? "Importando..." : "Importar OFP"}
                          </button>

                          {navigraphConnected ? (
                            <button
                              type="button"
                              onClick={() => void handleDisconnectNavigraph()}
                              className="button-ghost py-3"
                            >
                              Desconectar
                            </button>
                          ) : null}
                        </div>

                        {navigraphInfoMessage ? (
                          <div className="mt-4 rounded-[18px] border border-emerald-400/18 bg-emerald-500/[0.08] px-4 py-3 text-sm leading-7 text-emerald-100/88">
                            {navigraphInfoMessage}
                          </div>
                        ) : null}

                        {navigraphErrorMessage ? (
                          <div className="mt-4 rounded-[18px] border border-rose-400/18 bg-rose-500/[0.08] px-4 py-3 text-sm leading-7 text-rose-100/90">
                            {navigraphErrorMessage}
                          </div>
                        ) : null}

                        {simbriefInfoMessage ? (
                          <div className="mt-4 rounded-[18px] border border-cyan-400/18 bg-cyan-500/[0.08] px-4 py-3 text-sm leading-7 text-cyan-100/90">
                            {simbriefInfoMessage}
                          </div>
                        ) : null}

                        {simbriefErrorMessage ? (
                          <div className="mt-4 rounded-[18px] border border-amber-400/18 bg-amber-500/[0.08] px-4 py-3 text-sm leading-7 text-amber-100/90">
                            {simbriefErrorMessage}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[22px] border border-cyan-400/14 bg-[#031428]/65 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                              Bloque 1
                            </p>
                            <h5 className="mt-2 text-xl font-semibold text-white">Datos confirmados en la web</h5>
                          </div>
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                            Flujo actual
                          </span>
                        </div>

                        <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1fr_1fr_0.9fr]">
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
                            label="Airframe ICAO"
                            value={webAirframe}
                            hint={
                              selectedAircraftRecord
                                ? `${selectedAircraftRecord.aircraft_name} · ${selectedAircraftRecord.tail_number}`
                                : "Pendiente"
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                          Confirmar despacho
                        </p>
                        <p className="mt-3 text-sm leading-7 text-white/68">
                          El plan de vuelo sera generado por ACARS al iniciar el vuelo. Confirma los datos de la web para despachar a la base operativa.
                        </p>

                        <button
                          type="button"
                          onClick={() => { setDispatchReady(true); setDispatchStep("summary"); }}
                          className="mt-5 w-full rounded-[18px] border border-cyan-400/30 bg-cyan-500/[0.12] px-4 py-4 text-left text-white transition hover:bg-cyan-500/[0.18]"
                        >
                          <span className="block text-base font-semibold text-white">
                            Confirmar despacho y continuar a resumen
                          </span>
                          <span className="mt-1 block text-sm leading-7 text-white/68">
                            Los datos confirmados en la web seran enviados a la base operativa para que ACARS los rescate.
                          </span>
                        </button>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button type="button" onClick={() => handleStepChange("itinerary")} className="button-secondary py-3">
                            Volver a itinerario
                          </button>
                        </div>
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
                    <div className="mt-2 flex flex-wrap gap-2">
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
                { label: "Pulso 10", value: formatDecimal(metrics.pulso10), accent: "#67d7ff" },
                { label: "Ruta 10", value: formatDecimal(metrics.ruta10), accent: "#67d7ff" },
                { label: "Legado", value: formatInteger(metrics.legadoPoints), accent: "#0ca66b" },
                { label: "Billetera", value: formatCurrency(metrics.walletBalance), accent: "#0ca66b" },
              ].map((m) => (
                <div key={m.label} className="surface-outline rounded-[20px] p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">{m.label}</p>
                  <p className="mt-2 text-3xl font-semibold" style={{ color: m.accent }}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* ── Fila 4: Reserva activa ── */}
            <div className="surface-outline rounded-[24px] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Reserva activa
              </p>
              {activeReservation ? (
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
                    {/* Ruta */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Ruta</p>
                      <p className="mt-1 text-lg font-semibold text-white">{formatRouteTag(activeReservation)}</p>
                    </div>
                    {/* Aeronave */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Aeronave</p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {activeReservation.aircraft_type_code ?? "—"}
                        {activeReservation.aircraft_registration ? ` · ${activeReservation.aircraft_registration}` : ""}
                      </p>
                    </div>
                    {/* Estado */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Estado</p>
                      <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-semibold ${
                        activeReservation.status === "in_flight"
                          ? "bg-[#0ca66b]/20 text-[#49d787] border border-[#0ca66b]/30"
                          : activeReservation.status === "dispatched"
                            ? "bg-[#67d7ff]/10 text-[#67d7ff] border border-[#67d7ff]/20"
                            : "bg-white/5 text-white/70 border border-white/10"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${activeReservation.status === "in_flight" ? "bg-[#49d787]" : activeReservation.status === "dispatched" ? "bg-[#67d7ff]" : "bg-white/40"}`} />
                        {formatFlightStatusLabel(activeReservation.status)}
                      </span>
                    </div>
                    {/* Modo */}
                    {activeReservation.flight_mode_code && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Modo</p>
                        <p className="mt-1 text-sm text-white/70">{activeReservation.flight_mode_code}</p>
                      </div>
                    )}
                  </div>
                  {/* Botón cancelar */}
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
                    className="shrink-0 rounded-[12px] border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancellingReservation ? "Cancelando..." : "✕ Cancelar reserva"}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/38">Sin reserva activa en este momento.</p>
              )}
            </div>

            {/* ── Fila 5: Historial de vuelos ── */}
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
                          <td className="py-3 font-medium text-white">{formatRouteTag(f)}</td>
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

            {/* ── Header ── */}
            <div className="surface-outline rounded-[24px] p-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Entrenamiento</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Centro de práctica y preparación</h2>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Progresá como piloto completando entrenamientos, checkrides y habilitaciones. Todo registrado en tu historial operativo.
                  </p>
                </div>
                <div className="mt-4 shrink-0 sm:mt-0">
                  <button
                    type="button"
                    onClick={() => onChangeTab("dispatch")}
                    className="rounded-[12px] bg-[#67d7ff]/10 border border-[#67d7ff]/20 px-5 py-2.5 text-sm font-semibold text-[#67d7ff] transition hover:bg-[#67d7ff]/20"
                  >
                    ✈ Reservar vuelo de entrenamiento
                  </button>
                </div>
              </div>
            </div>

            {/* ── Fila 1: Métricas de entrenamiento ── */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  label: "Rango actual",
                  value: metrics.careerRank,
                  unit: "",
                  accent: "#67d7ff",
                },
                {
                  label: "Vuelos entrenamiento",
                  value: formatInteger(
                    central.recentFlights.filter((f) => f.flight_mode_code === "TRAINING" || f.flight_mode_code === "training").length
                  ),
                  unit: "registrados",
                  accent: "#ffffff",
                },
                {
                  label: "Pulso 10",
                  value: formatDecimal(metrics.pulso10),
                  unit: "procedimiento",
                  accent: "#67d7ff",
                },
                {
                  label: "Ruta 10",
                  value: formatDecimal(metrics.ruta10),
                  unit: "navegación",
                  accent: "#67d7ff",
                },
              ].map((m) => (
                <div key={m.label} className="surface-outline rounded-[20px] p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">{m.label}</p>
                  <p className="mt-2 text-3xl font-semibold" style={{ color: m.accent }}>{m.value}</p>
                  {m.unit && <p className="mt-0.5 text-[11px] text-white/38">{m.unit}</p>}
                </div>
              ))}
            </div>

            {/* ── Fila 2: Habilitaciones + Categorías ── */}
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">

              {/* Habilitaciones activas */}
              <div className="surface-outline rounded-[24px] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Habilitaciones activas</p>
                {profile?.active_qualifications ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.active_qualifications.split(",").map((q) => q.trim()).filter(Boolean).map((q) => (
                      <span key={q} className="inline-flex items-center gap-1.5 rounded-full border border-[#0ca66b]/30 bg-[#0ca66b]/10 px-3 py-1 text-[12px] font-semibold text-[#49d787]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#49d787]" />
                        {q}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-white/38">Sin habilitaciones registradas. Completá un checkride para obtener tu primera habilitación.</p>
                )}
                {profile?.active_certifications && (
                  <div className="mt-5 border-t border-white/8 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Certificaciones</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.active_certifications.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
                        <span key={c} className="inline-block rounded-md border border-[#67d7ff]/20 bg-[#67d7ff]/5 px-2 py-0.5 text-[11px] text-[#67d7ff]/80">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Categorías de entrenamiento disponibles */}
              <div className="surface-outline rounded-[24px] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Tipos de entrenamiento</p>
                <div className="mt-4 flex flex-col gap-3">
                  {[
                    { icon: "🛩", title: "Vuelo de línea de entrenamiento", desc: "Rutas de la red en modo entrenamiento supervisado. Score sin penalización.", badge: "Disponible", badgeColor: "#49d787" },
                    { icon: "✅", title: "Checkride de tipo", desc: "Habilitación para operar una nueva familia de aeronaves. Requiere completar el perfil.", badge: "Con reserva", badgeColor: "#67d7ff" },
                    { icon: "🗺", title: "Familiarización de ruta", desc: "Vuelos de baja presión para conocer rutas nuevas, terminales y procedimientos regionales.", badge: "Disponible", badgeColor: "#49d787" },
                    { icon: "⬆", title: "Solicitar ascenso de rango", desc: "Cuando cumplas los gates de horas y score, podés iniciar el proceso de ascenso.", badge: metrics.pulso10 >= 7 && metrics.ruta10 >= 7 ? "Elegible" : "Pendiente", badgeColor: metrics.pulso10 >= 7 && metrics.ruta10 >= 7 ? "#49d787" : "#ffffff" },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3 rounded-[14px] border border-white/8 bg-white/[0.03] p-4">
                      <span className="mt-0.5 text-xl">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                          <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                            style={{ color: item.badgeColor, borderColor: `${item.badgeColor}40`, background: `${item.badgeColor}15` }}>
                            {item.badge}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-5 text-white/50">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Fila 3: Historial de vuelos de entrenamiento ── */}
            <div className="surface-outline rounded-[24px] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Historial de entrenamiento</p>
              {(() => {
                const trainingFlights = central.recentFlights.filter(
                  (f) => f.flight_mode_code === "TRAINING" || f.flight_mode_code === "training"
                );
                if (trainingFlights.length === 0) {
                  return (
                    <div className="mt-4 rounded-[16px] border border-white/8 bg-white/[0.02] p-8 text-center">
                      <p className="text-[28px]">✈</p>
                      <p className="mt-2 text-sm font-semibold text-white/70">Sin vuelos de entrenamiento registrados</p>
                      <p className="mt-1 text-xs text-white/38">Reservá un vuelo de entrenamiento desde la pestaña Despacho para empezar a construir tu historial.</p>
                    </div>
                  );
                }
                return (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/8">
                          <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Ruta</th>
                          <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Aeronave</th>
                          <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Procedimiento</th>
                          <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Misión</th>
                          <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainingFlights.slice(0, 8).map((f, i) => (
                          <tr key={i} className="border-b border-white/5 last:border-0">
                            <td className="py-3 font-medium text-white">{formatRouteTag(f)}</td>
                            <td className="py-3 text-white/70">{f.aircraft_type_code ?? "—"}</td>
                            <td className="py-3 text-right font-semibold text-[#67d7ff]">
                              {f.procedure_score != null ? formatDecimal(f.procedure_score) : "—"}
                            </td>
                            <td className="py-3 text-right font-semibold text-[#49d787]">
                              {f.mission_score != null ? formatDecimal(f.mission_score) : "—"}
                            </td>
                            <td className="py-3 text-right text-white/38">
                              {f.completed_at ? new Date(f.completed_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* ── Fila 4: Próximos pasos ── */}
            <div className="surface-outline rounded-[24px] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Ruta de progresión — {metrics.careerRank}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Pulso 10 ≥ 7.0", done: metrics.pulso10 >= 7, value: `${formatDecimal(metrics.pulso10)} / 7.0` },
                  { label: "Ruta 10 ≥ 7.0",  done: metrics.ruta10  >= 7, value: `${formatDecimal(metrics.ruta10)} / 7.0` },
                  { label: "Horas acumuladas",  done: metrics.totalHours >= 10, value: `${formatDecimal(metrics.totalHours)} hs` },
                ].map((gate) => (
                  <div key={gate.label} className={`flex items-center gap-3 rounded-[14px] border p-4 ${gate.done ? "border-[#0ca66b]/30 bg-[#0ca66b]/8" : "border-white/8 bg-white/[0.02]"}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${gate.done ? "bg-[#49d787] text-black" : "bg-white/10 text-white/40"}`}>
                      {gate.done ? "✓" : "·"}
                    </span>
                    <div>
                      <p className={`text-sm font-semibold ${gate.done ? "text-[#49d787]" : "text-white/60"}`}>{gate.label}</p>
                      <p className="text-[11px] text-white/38">{gate.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : null}
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
        careerRank: formatRankLabel(nextProfile.career_rank_code ?? nextProfile.rank_code),
      }));
      setCentral((current) => ({
        ...current,
        airportCode: currentAirport,
        imagePath: getAirportImagePath(currentAirport),
      }));

      try {
        const [nextMetrics, nextCentral, nextAvailableAircraft, nextAvailableItineraries] = await Promise.all([
          loadDashboardMetrics(nextProfile),
          loadCentralOverview(nextProfile),
          listAvailableAircraft(nextProfile),
          listAvailableItineraries(nextProfile),
        ]);

        if (isMounted) {
          setMetrics(nextMetrics);
          setCentral(nextCentral);
          setAvailableAircraft(nextAvailableAircraft);
          setAvailableItineraries(nextAvailableItineraries);
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
            careerRank: formatRankLabel(nextProfile.career_rank_code ?? nextProfile.rank_code),
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
      { label: "Pulso 10", type: "number", value: metrics.pulso10, decimals: 1 },
      { label: "Ruta 10", type: "number", value: metrics.ruta10, decimals: 1 },
      { label: "Rango", type: "text", value: metrics.careerRank },
      {
        label: `Posición ${metrics.monthLabel}`,
        type: "number",
        value: metrics.monthPosition ?? 0,
      },
      { label: `Hs. ${metrics.monthLabel}`, type: "number", value: metrics.monthHours, decimals: 1 },
      { label: "Pireps", type: "number", value: metrics.totalPireps },
      { label: "Horas", type: "number", value: metrics.totalHours, decimals: 1 },
      { label: "Legado", type: "number", value: metrics.legadoPoints },
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
      pulso10: metrics.pulso10,
      ruta10: metrics.ruta10,
      legadoPoints: metrics.legadoPoints,
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-start">
        <div className="order-2 xl:order-1">
          <DashboardWorkspace
            profile={profile}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            metrics={metrics}
            central={central}
            availableAircraft={availableAircraft}
            availableItineraries={availableItineraries}
          />
        </div>

        <PilotStatsRail items={compactMetrics} animationSeed={animationSeed} />
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
