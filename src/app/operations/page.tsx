"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PublicHeader from "@/components/site/PublicHeader";
import ProtectedPage, {
  useProtectedSession,
} from "@/components/site/ProtectedPage";
import {
  ensurePilotProfile,
  type PilotProfileRecord,
} from "@/lib/pilot-profile";
import { supabase } from "@/lib/supabase/browser";
import {
  applyAircraftToOperation,
  applyItineraryToOperation,
  cancelFlightOperation,
  computeFlightReadiness,
  getActiveFlightReservation,
  getDefaultFlightOperation,
  getDispatchBlockingReasons,
  getOperationalFlightNumber,
  listAvailableAircraft,
  listAvailableItineraries,
  mapReservationToOperation,
  markDispatchPrepared,
  saveFlightOperation,
  flightModeOptions,
  type AvailableAircraftOption,
  type AvailableItineraryOption,
  type FlightMode,
  type FlightOperationRecord,
} from "@/lib/flight-ops";
import {
  resolveSimbriefType,
  type SimbriefDispatchPayload,
  type SimbriefDispatchResponse,
  type SimbriefOfpSummary,
} from "@/lib/simbrief";

type NavigraphStatus = {
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

type NavigraphDeviceSession = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
  startedAt: number;
};

type AirportRecord = {
  icao: string;
  name: string;
  city: string | null;
  country: string | null;
};

type ItineraryTimingMeta = {
  routeCode: string;
  routeGroup: string | null;
  serviceProfile: string | null;
  serviceLevel: string | null;
  scheduledBlockMin: number | null;
  expectedBlockP50: number | null;
  expectedBlockP80: number | null;
  bufferDepartureMinLow: number | null;
  bufferDepartureMinHigh: number | null;
  bufferArrivalMinLow: number | null;
  bufferArrivalMinHigh: number | null;
};

type OperationStage = "catalog" | "plan" | "dispatch" | "simbrief";

type SimbriefPreview = {
  flightNumber: string;
  routeCode: string;
  origin: AirportRecord | null;
  destination: AirportRecord | null;
  alternate: AirportRecord | null;
  airframe: string;
  routeText: string;
  distanceNm: number;
  eteMinutes: number;
  etaIso: string;
  pax: number;
  payloadKg: number;
  cargoKg: number;
  tripFuelKg: number;
  reserveFuelKg: number;
  taxiFuelKg: number;
  blockFuelKg: number;
  zfwKg: number;
  towKg: number;
  lwKg: number;
  mzfwKg: number;
  mtowKg: number;
  mlwKg: number;
  maxRangeNm: number;
  source: "estimated" | "real";
  staticId: string | null;
  generatedAtIso: string | null;
  pdfUrl: string | null;
  matchedByStaticId: boolean;
};

type SimbriefBridge = {
  staticId: string;
  generateUrl: string;
  editUrl: string;
  fetchUrl: string;
  outputpage: string;
  timestamp: number;
  type: string;
};

type DestinationStats = {
  totalArrivals: number;
  lastVisit: string;
  totalFlights: number;
  avgFuelKg: number;
  bestFuelKg: number;
  totalPassengers: number;
  selectedAircraftFlights: number;
};

const EMPTY_NAVIGRAPH_STATUS: NavigraphStatus = {
  configured: false,
  connected: false,
  hasRefreshToken: false,
  expiresAt: null,
  scopes: [],
  subscriptions: [],
  clientId: null,
  subject: null,
  error: null,
};

const ELEVATION_BY_ICAO: Record<string, number> = {
  SCEL: 1555,
  SCTE: 294,
  SCFA: 455,
  SCDA: 154,
  SCIE: 26,
};

const AIRFRAME_STATS: Record<
  string,
  {
    cruiseKts: number;
    paxMin: number;
    paxMax: number;
    payloadBase: number;
    cargoBase: number;
    taxiFuel: number;
    reserveFuel: number;
    tripFuelPerNm: number;
    mzfw: number;
    mtow: number;
    mlw: number;
    maxRange: number;
  }
> = {
  "B737-700": {
    cruiseKts: 440,
    paxMin: 102,
    paxMax: 138,
    payloadBase: 11200,
    cargoBase: 1800,
    taxiFuel: 280,
    reserveFuel: 950,
    tripFuelPerNm: 4.1,
    mzfw: 52800,
    mtow: 70080,
    mlw: 58000,
    maxRange: 3350,
  },
  "B737-800": {
    cruiseKts: 447,
    paxMin: 138,
    paxMax: 174,
    payloadBase: 13600,
    cargoBase: 2300,
    taxiFuel: 320,
    reserveFuel: 1100,
    tripFuelPerNm: 4.6,
    mzfw: 62732,
    mtow: 79015,
    mlw: 66349,
    maxRange: 3060,
  },
  ATR72: {
    cruiseKts: 275,
    paxMin: 44,
    paxMax: 64,
    payloadBase: 5400,
    cargoBase: 900,
    taxiFuel: 90,
    reserveFuel: 280,
    tripFuelPerNm: 2.2,
    mzfw: 21500,
    mtow: 23000,
    mlw: 22500,
    maxRange: 825,
  },
  C208: {
    cruiseKts: 165,
    paxMin: 4,
    paxMax: 9,
    payloadBase: 850,
    cargoBase: 220,
    taxiFuel: 25,
    reserveFuel: 70,
    tripFuelPerNm: 0.95,
    mzfw: 3538,
    mtow: 3970,
    mlw: 3970,
    maxRange: 900,
  },
};

function getDefaultDepartureLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 45);
  now.setSeconds(0, 0);
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatMinutes(minutes: number) {
  const safeMinutes = Math.max(1, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getAirportLabel(airport: AirportRecord | null, icao: string) {
  if (!airport) return icao;
  return airport.city ? `${airport.icao} · ${airport.city}` : airport.icao;
}

function getAirportCityLabel(airport: AirportRecord | null, fallbackIcao: string) {
  if (!airport) return fallbackIcao;
  return airport.city || airport.name || fallbackIcao;
}

function renderAirportFlagPill(airport: AirportRecord | null, icao: string) {
  const country = getCountryDisplay(airport?.country, icao);
  return `${country.flag} ${icao}`;
}

function getAirportCardTitle(airport: AirportRecord | null, fallbackIcao: string) {
  if (!airport) return fallbackIcao;
  return airport.city ? `${airport.name} (${airport.city})` : airport.name;
}

function getCountryFlag(country: string | null | undefined) {
  const normalized = (country ?? "").trim().toUpperCase();

  if (["CL", "CHILE"].includes(normalized)) return "🇨🇱";
  if (["AR", "ARGENTINA"].includes(normalized)) return "🇦🇷";
  if (["BR", "BRAZIL", "BRASIL"].includes(normalized)) return "🇧🇷";
  if (["UY", "URUGUAY"].includes(normalized)) return "🇺🇾";
  if (["PY", "PARAGUAY"].includes(normalized)) return "🇵🇾";
  if (["BO", "BOLIVIA"].includes(normalized)) return "🇧🇴";
  if (["PE", "PERU", "PERÚ"].includes(normalized)) return "🇵🇪";
  if (["EC", "ECUADOR"].includes(normalized)) return "🇪🇨";
  if (["CO", "COLOMBIA"].includes(normalized)) return "🇨🇴";
  if (["US", "USA", "UNITED STATES", "ESTADOS UNIDOS"].includes(normalized)) return "🇺🇸";
  if (["MX", "MEXICO", "MÉXICO"].includes(normalized)) return "🇲🇽";
  if (["ES", "SPAIN", "ESPAÑA"].includes(normalized)) return "🇪🇸";
  if (["FR", "FRANCE", "FRANCIA"].includes(normalized)) return "🇫🇷";
  if (["GB", "UK", "UNITED KINGDOM", "REINO UNIDO", "ENGLAND", "INGLATERRA"].includes(normalized)) return "🇬🇧";

  return "🌐";
}

function getCountryLabel(country: string | null | undefined) {
  return (country ?? "Internacional").trim() || "Internacional";
}

function getCountryFromIcao(icao: string | null | undefined) {
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

function getCountryDisplay(country: string | null | undefined, icao: string) {
  const resolved = country ?? getCountryFromIcao(icao);
  return {
    flag: getCountryFlag(resolved),
    label: getCountryLabel(resolved),
  };
}

function getRouteGroupLabel(routeGroup: string | null | undefined) {
  switch ((routeGroup ?? "").trim()) {
    case "domestic_chile":
      return "Doméstico Chile";
    case "domestic_argentina":
      return "Doméstico Argentina";
    case "transborder_patagonia":
      return "Transfronterizo";
    case "south_america_regional":
      return "Regional Sudamérica";
    case "continental_longhaul":
      return "Internacional";
    case "transoceanic":
      return "Transoceánico";
    default:
      return "Operación regular";
  }
}

function getElevation(icao: string) {
  return ELEVATION_BY_ICAO[icao] ?? 0;
}

function normalizeAircraftKey(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
}

function getCompatibleAircraft(
  itinerary: AvailableItineraryOption | null,
  aircraft: AvailableAircraftOption[]
) {
  if (!itinerary) return [];

  const compatibleTypes = itinerary.compatible_aircraft_types ?? [];

  if (compatibleTypes.length) {
    const normalizedCompatible = compatibleTypes.map((item) => normalizeAircraftKey(item));

    const matched = aircraft.filter((item) => {
      const codeKey = normalizeAircraftKey(item.aircraft_code);
      const nameKey = normalizeAircraftKey(item.aircraft_name);

      return normalizedCompatible.some(
        (compatibleKey) =>
          compatibleKey === codeKey ||
          compatibleKey === nameKey ||
          compatibleKey.includes(codeKey) ||
          compatibleKey.includes(nameKey) ||
          codeKey.includes(compatibleKey) ||
          nameKey.includes(compatibleKey)
      );
    });

    if (matched.length > 0) return matched;

    if ((itinerary.available_aircraft_count ?? 0) > 0) {
      return aircraft;
    }
  }

  if (!itinerary.aircraft_type_code) {
    return (itinerary.available_aircraft_count ?? 0) > 0 ? aircraft : [];
  }

  const strictMatches = aircraft.filter(
    (item) => normalizeAircraftKey(item.aircraft_code) === normalizeAircraftKey(itinerary.aircraft_type_code)
  );

  if (strictMatches.length > 0) return strictMatches;

  return (itinerary.available_aircraft_count ?? 0) > 0 ? aircraft : [];
}

function buildRouteText(origin: string, destination: string, alternate: string | null) {
  if (!alternate) return `${origin} DCT ${destination}`;
  return `${origin} DCT ${destination} ALTN ${alternate}`;
}

function getDestinationStats(
  destinationIcao: string,
  aircraftCode: string,
  flightNumber: string
): DestinationStats {
  const baseSeed = destinationIcao
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const aircraftSeed = aircraftCode
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const flightSeed = flightNumber
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const totalFlights = 12 + (baseSeed % 41);
  const selectedAircraftFlights = 4 + (aircraftSeed % Math.max(5, totalFlights - 3));
  const avgFuelKg = 420 + (baseSeed % 1400);
  const bestFuelKg = Math.max(150, avgFuelKg - (flightSeed % 180));
  const totalPassengers = 70 + (baseSeed % 620);
  const totalArrivals = 1800 + baseSeed * 7;
  const lastVisit = new Date(Date.now() - (baseSeed % 45) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return {
    totalArrivals,
    lastVisit,
    totalFlights,
    avgFuelKg,
    bestFuelKg,
    totalPassengers,
    selectedAircraftFlights,
  };
}

function buildSimbriefPreview(params: {
  profile: PilotProfileRecord;
  operation: FlightOperationRecord;
  originAirport: AirportRecord | null;
  destinationAirport: AirportRecord | null;
  alternateAirport: AirportRecord | null;
}): SimbriefPreview {
  const { profile, operation, originAirport, destinationAirport, alternateAirport } = params;
  const airframe = operation.aircraftCode || "B737-700";
  const stats = AIRFRAME_STATS[airframe] ?? AIRFRAME_STATS["B737-700"];
  const seed = `${operation.origin}${operation.destination}${airframe}${profile.callsign}`
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const distanceNm = Math.max(
    180,
    operation.origin === operation.destination ? 120 : 240 + (seed % 780)
  );
  const eteMinutes = Math.max(30, Math.round((distanceNm / stats.cruiseKts) * 60) + 12);
  const pax = Math.min(stats.paxMax, Math.max(stats.paxMin, stats.paxMin + (seed % 18)));
  const payloadKg = stats.payloadBase + pax * 6;
  const cargoKg = stats.cargoBase + (seed % 420);
  const tripFuelKg = Math.round(distanceNm * stats.tripFuelPerNm);
  const reserveFuelKg = stats.reserveFuel;
  const taxiFuelKg = stats.taxiFuel;
  const blockFuelKg = tripFuelKg + reserveFuelKg + taxiFuelKg;
  const zfwKg = payloadKg + cargoKg + Math.round(stats.mzfw * 0.58);
  const towKg = zfwKg + blockFuelKg;
  const lwKg = towKg - tripFuelKg;

  const departure = operation.scheduledDeparture
    ? new Date(operation.scheduledDeparture)
    : new Date();
  const eta = new Date(departure.getTime() + eteMinutes * 60_000).toISOString();

  return {
    flightNumber: operation.flightNumber || profile.callsign,
    routeCode: operation.routeCode || operation.flightNumber,
    origin: originAirport,
    destination: destinationAirport,
    alternate: alternateAirport,
    airframe,
    routeText:
      operation.routeText.trim() ||
      buildRouteText(operation.origin, operation.destination, alternateAirport?.icao ?? null),
    distanceNm,
    eteMinutes,
    etaIso: eta,
    pax,
    payloadKg,
    cargoKg,
    tripFuelKg,
    reserveFuelKg,
    taxiFuelKg,
    blockFuelKg,
    zfwKg,
    towKg,
    lwKg,
    mzfwKg: stats.mzfw,
    mtowKg: stats.mtow,
    mlwKg: stats.mlw,
    maxRangeNm: stats.maxRange,
    source: "estimated",
    staticId: null,
    generatedAtIso: null,
    pdfUrl: null,
    matchedByStaticId: false,
  };
}

function mergeSimbriefSummaryIntoPreview(params: {
  base: SimbriefPreview;
  summary: SimbriefOfpSummary;
  airports: AirportRecord[];
}) {
  const { base, summary, airports } = params;

  const findAirport = (icao: string | null, fallback: AirportRecord | null) => {
    if (!icao) return fallback;
    return airports.find((item) => item.icao === icao) ?? fallback;
  };

  return {
    ...base,
    origin: findAirport(summary.origin, base.origin),
    destination: findAirport(summary.destination, base.destination),
    alternate: findAirport(summary.alternate, base.alternate),
    airframe: summary.airframe ?? base.airframe,
    routeText: summary.routeText ?? base.routeText,
    distanceNm: summary.distanceNm ?? base.distanceNm,
    eteMinutes: summary.eteMinutes ?? base.eteMinutes,
    etaIso: summary.etaIso ?? base.etaIso,
    pax: summary.pax ?? base.pax,
    payloadKg: summary.payloadKg ?? base.payloadKg,
    cargoKg: summary.cargoKg ?? base.cargoKg,
    tripFuelKg: summary.tripFuelKg ?? base.tripFuelKg,
    reserveFuelKg: summary.reserveFuelKg ?? base.reserveFuelKg,
    taxiFuelKg: summary.taxiFuelKg ?? base.taxiFuelKg,
    blockFuelKg: summary.blockFuelKg ?? base.blockFuelKg,
    zfwKg: summary.zfwKg ?? base.zfwKg,
    towKg: summary.towKg ?? base.towKg,
    lwKg: summary.lwKg ?? base.lwKg,
    mzfwKg: summary.mzfwKg ?? base.mzfwKg,
    mtowKg: summary.mtowKg ?? base.mtowKg,
    mlwKg: summary.mlwKg ?? base.mlwKg,
    source: "real",
    staticId: summary.staticId ?? base.staticId,
    generatedAtIso: summary.generatedAtIso ?? base.generatedAtIso,
    pdfUrl: summary.pdfUrl ?? base.pdfUrl,
    matchedByStaticId: summary.matchedByStaticId,
  } satisfies SimbriefPreview;
}

function SummaryKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-[28px] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function SmallInfoCard({
  title,
  value,
  subvalue,
}: {
  title: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="surface-outline rounded-[22px] px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
        {title}
      </p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      {subvalue ? <p className="mt-2 text-sm text-white/66">{subvalue}</p> : null}
    </div>
  );
}

function StagePill({
  active,
  complete,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  complete: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
          : complete
            ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
            : "border-white/10 bg-white/5 text-white/60"
      } ${disabled ? "cursor-not-allowed opacity-50" : "hover:bg-white/10"}`}
    >
      {label}
    </button>
  );
}

function OperationsContent() {
  const session = useProtectedSession();

  const [profile, setProfile] = useState<PilotProfileRecord | null>(null);
  const [operation, setOperation] = useState<FlightOperationRecord | null>(null);
  const [availableAircraft, setAvailableAircraft] = useState<AvailableAircraftOption[]>([]);
  const [availableItineraries, setAvailableItineraries] = useState<AvailableItineraryOption[]>([]);
  const [airports, setAirports] = useState<AirportRecord[]>([]);
  const [itineraryTiming, setItineraryTiming] = useState<Record<string, ItineraryTimingMeta>>({});
  const [stage, setStage] = useState<OperationStage>("catalog");
  const [selectedAlternate, setSelectedAlternate] = useState<string>("");
  const [simbriefPreview, setSimbriefPreview] = useState<SimbriefPreview | null>(null);
  const [simbriefBridge, setSimbriefBridge] = useState<SimbriefBridge | null>(null);
  const [lastOfpSummary, setLastOfpSummary] = useState<SimbriefOfpSummary | null>(null);
  const [navigraphStatus, setNavigraphStatus] = useState<NavigraphStatus>(EMPTY_NAVIGRAPH_STATUS);
  const [checkingNavigraph, setCheckingNavigraph] = useState(true);
  const [connectingNavigraph, setConnectingNavigraph] = useState(false);
  const [deviceSession, setDeviceSession] = useState<NavigraphDeviceSession | null>(null);
  const [syncingSimbrief, setSyncingSimbrief] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);


  async function loadNavigraphStatus(silent = false) {
    if (!silent) {
      setCheckingNavigraph(true);
    }

    try {
      const response = await fetch("/api/auth/navigraph/status", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as NavigraphStatus;
      setNavigraphStatus(data);
    } catch {
      setNavigraphStatus(EMPTY_NAVIGRAPH_STATUS);
      if (!silent) {
        setErrorMessage("No se pudo comprobar el estado de Navigraph.");
      }
    } finally {
      if (!silent) {
        setCheckingNavigraph(false);
      }
    }
  }

  async function handleConnectNavigraph() {
    setConnectingNavigraph(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const response = await fetch("/api/auth/navigraph/device/start", {
        method: "POST",
      });
      const data = (await response.json()) as
        | ({ ok: true } & Omit<NavigraphDeviceSession, "startedAt">)
        | { error?: string };

      if (!response.ok || !("ok" in data)) {
        throw new Error("error" in data ? data.error || "No se pudo iniciar Navigraph." : "No se pudo iniciar Navigraph.");
      }

      const sessionData: NavigraphDeviceSession = {
        deviceCode: data.deviceCode,
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        verificationUriComplete: data.verificationUriComplete,
        expiresIn: data.expiresIn,
        interval: data.interval,
        startedAt: Date.now(),
      };

      setDeviceSession(sessionData);
      if (typeof window !== "undefined") {
        window.open(sessionData.verificationUriComplete, "_blank", "noopener,noreferrer");
      }
      setInfoMessage(
        `Autoriza Patagonia Wings en Navigraph con el código ${sessionData.userCode} y luego vuelve para seguir.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo iniciar la conexión con Navigraph."
      );
    } finally {
      setConnectingNavigraph(false);
    }
  }

  async function loadData(currentUserId: string) {
    setLoading(true);
    setErrorMessage("");

    try {
      const currentProfile = await ensurePilotProfile(session.user);
      setProfile(currentProfile);

      if (!currentProfile) {
        setOperation(getDefaultFlightOperation(currentUserId, null));
        setAvailableAircraft([]);
        setAvailableItineraries([]);
        setAirports([]);
        setItineraryTiming({});
        setStage("catalog");
        return;
      }

      const loadItineraryTiming = async (routeCodes: string[]) => {
        const normalizedRouteCodes = Array.from(new Set(routeCodes.filter(Boolean)));
        if (normalizedRouteCodes.length === 0) {
          return {} as Record<string, ItineraryTimingMeta>;
        }

        const [routesResponse, blockProfilesResponse] = await Promise.all([
          supabase
            .from("network_routes")
            .select("id, route_code, route_group, service_profile, service_level")
            .in("route_code", normalizedRouteCodes),
          supabase
            .from("v_network_route_aircraft_profiles")
            .select(
              "route_code, scheduled_block_min, expected_block_p50, expected_block_p80, buffer_departure_min_low, buffer_departure_min_high, buffer_arrival_min_low, buffer_arrival_min_high"
            )
            .in("route_code", normalizedRouteCodes),
        ]);

        const routeRows = routesResponse.error ? [] : ((routesResponse.data ?? []) as Record<string, unknown>[]);
        const blockRows = blockProfilesResponse.error ? [] : ((blockProfilesResponse.data ?? []) as Record<string, unknown>[]);

        const byRouteCode: Record<string, ItineraryTimingMeta> = {};

        for (const row of routeRows) {
          const routeCode = typeof row.route_code === "string" ? row.route_code : "";
          if (!routeCode) continue;
          byRouteCode[routeCode] = {
            routeCode,
            routeGroup: typeof row.route_group === "string" ? row.route_group : null,
            serviceProfile: typeof row.service_profile === "string" ? row.service_profile : null,
            serviceLevel: typeof row.service_level === "string" ? row.service_level : null,
            scheduledBlockMin: null,
            expectedBlockP50: null,
            expectedBlockP80: null,
            bufferDepartureMinLow: null,
            bufferDepartureMinHigh: null,
            bufferArrivalMinLow: null,
            bufferArrivalMinHigh: null,
          };
        }

        for (const row of blockRows) {
          const routeCode = typeof row.route_code === "string" ? row.route_code : "";
          if (!routeCode) continue;
          const current = byRouteCode[routeCode] ?? {
            routeCode,
            routeGroup: null,
            serviceProfile: null,
            serviceLevel: null,
            scheduledBlockMin: null,
            expectedBlockP50: null,
            expectedBlockP80: null,
            bufferDepartureMinLow: null,
            bufferDepartureMinHigh: null,
            bufferArrivalMinLow: null,
            bufferArrivalMinHigh: null,
          } satisfies ItineraryTimingMeta;

          const scheduled = typeof row.scheduled_block_min === "number" ? row.scheduled_block_min : Number(row.scheduled_block_min ?? NaN);
          const p50 = typeof row.expected_block_p50 === "number" ? row.expected_block_p50 : Number(row.expected_block_p50 ?? NaN);
          const p80 = typeof row.expected_block_p80 === "number" ? row.expected_block_p80 : Number(row.expected_block_p80 ?? NaN);
          const depLow = typeof row.buffer_departure_min_low === "number" ? row.buffer_departure_min_low : Number(row.buffer_departure_min_low ?? NaN);
          const depHigh = typeof row.buffer_departure_min_high === "number" ? row.buffer_departure_min_high : Number(row.buffer_departure_min_high ?? NaN);
          const arrLow = typeof row.buffer_arrival_min_low === "number" ? row.buffer_arrival_min_low : Number(row.buffer_arrival_min_low ?? NaN);
          const arrHigh = typeof row.buffer_arrival_min_high === "number" ? row.buffer_arrival_min_high : Number(row.buffer_arrival_min_high ?? NaN);

          byRouteCode[routeCode] = {
            ...current,
            scheduledBlockMin:
              current.scheduledBlockMin == null || (Number.isFinite(scheduled) && scheduled < current.scheduledBlockMin)
                ? (Number.isFinite(scheduled) ? scheduled : current.scheduledBlockMin)
                : current.scheduledBlockMin,
            expectedBlockP50:
              current.expectedBlockP50 == null || (Number.isFinite(p50) && p50 < current.expectedBlockP50)
                ? (Number.isFinite(p50) ? p50 : current.expectedBlockP50)
                : current.expectedBlockP50,
            expectedBlockP80:
              current.expectedBlockP80 == null || (Number.isFinite(p80) && p80 > current.expectedBlockP80)
                ? (Number.isFinite(p80) ? p80 : current.expectedBlockP80)
                : current.expectedBlockP80,
            bufferDepartureMinLow:
              current.bufferDepartureMinLow == null || (Number.isFinite(depLow) && depLow < current.bufferDepartureMinLow)
                ? (Number.isFinite(depLow) ? depLow : current.bufferDepartureMinLow)
                : current.bufferDepartureMinLow,
            bufferDepartureMinHigh:
              current.bufferDepartureMinHigh == null || (Number.isFinite(depHigh) && depHigh > current.bufferDepartureMinHigh)
                ? (Number.isFinite(depHigh) ? depHigh : current.bufferDepartureMinHigh)
                : current.bufferDepartureMinHigh,
            bufferArrivalMinLow:
              current.bufferArrivalMinLow == null || (Number.isFinite(arrLow) && arrLow < current.bufferArrivalMinLow)
                ? (Number.isFinite(arrLow) ? arrLow : current.bufferArrivalMinLow)
                : current.bufferArrivalMinLow,
            bufferArrivalMinHigh:
              current.bufferArrivalMinHigh == null || (Number.isFinite(arrHigh) && arrHigh > current.bufferArrivalMinHigh)
                ? (Number.isFinite(arrHigh) ? arrHigh : current.bufferArrivalMinHigh)
                : current.bufferArrivalMinHigh,
          };
        }

        return byRouteCode;
      };

      const airportCatalogRequest = async () => {
        const attempts = [
          () => supabase.from("airports").select("*").order("ident"),
          () => supabase.from("airports").select("*").order("icao_code"),
          () => supabase.from("airports").select("*"),
        ];

        for (const attempt of attempts) {
          const response = await attempt();
          if (!response.error) {
            return response.data ?? [];
          }
        }

        return [];
      };

      const [aircraftResult, itinerariesResult, activeReservationResult, airportRowsResult] =
        await Promise.allSettled([
          listAvailableAircraft(currentProfile),
          listAvailableItineraries(currentProfile),
          getActiveFlightReservation(currentProfile),
          airportCatalogRequest(),
        ]);

      const aircraft: AvailableAircraftOption[] = aircraftResult.status === "fulfilled" ? aircraftResult.value : [];
      const itineraries: AvailableItineraryOption[] = itinerariesResult.status === "fulfilled" ? (itinerariesResult.value.filter(Boolean) as AvailableItineraryOption[]) : [];
      const activeReservation = activeReservationResult.status === "fulfilled" ? activeReservationResult.value : null;
      const airportRows = airportRowsResult.status === "fulfilled" ? airportRowsResult.value : [];
      const timingMeta = await loadItineraryTiming(itineraries.map((item) => item.itinerary_code));
      const enrichedItineraries = itineraries.map((item) => ({
        ...item,
        ...(timingMeta[item.itinerary_code] ?? {}),
      }));

      setAvailableAircraft(aircraft);
      setAvailableItineraries(enrichedItineraries);
      setItineraryTiming(timingMeta);
      setAirports(
        ((airportRows ?? []) as Record<string, unknown>[]).map((row) => ({
          icao:
            typeof row.ident === "string"
              ? row.ident
              : typeof row.icao_code === "string"
                ? row.icao_code
                : typeof row.icao === "string"
                  ? row.icao
                  : "",
          name: typeof row.name === "string" ? row.name : "",
          city:
            typeof row.municipality === "string"
              ? row.municipality
              : typeof row.city === "string"
                ? row.city
                : null,
          country:
            typeof row.iso_country === "string"
              ? row.iso_country
              : typeof row.country_code === "string"
                ? row.country_code
                : typeof row.country === "string"
                  ? row.country
                  : null,
        }))
      );

      const nextOperation = activeReservation
        ? mapReservationToOperation(activeReservation, currentProfile, aircraft, enrichedItineraries)
        : getDefaultFlightOperation(currentUserId, currentProfile);

      setOperation(nextOperation);

      if (activeReservation?.status === "dispatch_ready") {
        setStage("simbrief");
      } else if (activeReservation?.status === "reserved") {
        setStage("dispatch");
      } else if (nextOperation.itineraryId) {
        setStage("plan");
      } else {
        setStage("catalog");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar operaciones desde Supabase.";
      setErrorMessage(message);
      setOperation(getDefaultFlightOperation(currentUserId, null));
      setAvailableAircraft([]);
      setAvailableItineraries([]);
      setAirports([]);
      setItineraryTiming({});
      setStage("catalog");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(session.user.id);
  }, [session.user.id, session.user]);

  useEffect(() => {
    void loadNavigraphStatus();
  }, []);

  useEffect(() => {
    if (!deviceSession) {
      return;
    }

    const expiresAt = deviceSession.startedAt + deviceSession.expiresIn * 1000;
    if (Date.now() >= expiresAt) {
      setDeviceSession(null);
      setErrorMessage("La autorización de Navigraph expiró. Inicia el proceso nuevamente.");
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/auth/navigraph/device/poll", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceCode: deviceSession.deviceCode,
            interval: deviceSession.interval,
          }),
        });

        const data = (await response.json()) as
          | { ok: true; status: "authorized"; expiresAt: string }
          | { ok?: false; status?: string; interval?: number; message?: string; error?: string };

        if (response.ok && "ok" in data && data.ok) {
          setDeviceSession(null);
          await loadNavigraphStatus(true);
          setCheckingNavigraph(false);
          setInfoMessage("Navigraph quedó conectado correctamente.");
          return;
        }

        if (data.status === "pending") {
          setDeviceSession((current) =>
            current ? { ...current, interval: data.interval ?? current.interval } : current
          );
          return;
        }

        setDeviceSession(null);
        const failure = data as { message?: string; error?: string };
        setErrorMessage(failure.message || failure.error || "No se pudo completar la autorización con Navigraph.");
      } catch {
        setDeviceSession(null);
        setErrorMessage("Falló el polling de Navigraph. Intenta conectar nuevamente.");
      }
    }, Math.max(2, deviceSession.interval) * 1000);

    return () => window.clearTimeout(timer);
  }, [deviceSession]);

  const readiness = useMemo(
    () => computeFlightReadiness(profile, operation),
    [profile, operation]
  );

  const dispatchBlockingReasons = useMemo(
    () => getDispatchBlockingReasons(profile, operation),
    [profile, operation]
  );

  const currentMode = operation?.flightMode ?? "itinerary";

  const filteredItineraries = useMemo(
    () => availableItineraries.filter((item) => item.flight_mode === currentMode),
    [availableItineraries, currentMode]
  );

  const visibleItineraries = useMemo(
    () =>
      filteredItineraries
        .map((item) => {
          const compatibleAircraft = getCompatibleAircraft(item, availableAircraft);
          const originAirport = airports.find((airport) => airport.icao === item.origin_icao) ?? null;
          const destinationAirport =
            airports.find((airport) => airport.icao === item.destination_icao) ?? null;
          const timing = itineraryTiming[item.itinerary_code];
          const fallbackEstimatedMinutes =
            55 +
            ((item.itinerary_code.length * 7 + item.destination_icao.charCodeAt(0)) % 105);
          const scheduledBlockMin =
            item.scheduled_block_min ??
            timing?.scheduledBlockMin ??
            item.expected_block_p50 ??
            timing?.expectedBlockP50 ??
            fallbackEstimatedMinutes;

          return {
            item,
            compatibleAircraft,
            originAirport,
            destinationAirport,
            scheduledBlockMin,
            routeGroupLabel: getRouteGroupLabel(item.route_group ?? timing?.routeGroup ?? null),
            displayFlightNumber:
              item.flight_designator || getOperationalFlightNumber(item.origin_icao, item.destination_icao),
          };
        })
        .filter((entry) => entry.compatibleAircraft.length > 0),
    [airports, availableAircraft, filteredItineraries, itineraryTiming]
  );

  const selectedItinerary = useMemo(
    () =>
      availableItineraries.find((item) => item.itinerary_id === operation?.itineraryId) ?? null,
    [availableItineraries, operation?.itineraryId]
  );

  const compatibleAircraft = useMemo(() => {
    const compatible = getCompatibleAircraft(selectedItinerary, availableAircraft);

    if (
      operation?.aircraftId &&
      operation?.aircraftCode &&
      compatible.every((item) => item.aircraft_id !== operation.aircraftId)
    ) {
      return [
        {
          aircraft_id: operation.aircraftId,
          tail_number: operation.aircraftTailNumber || "",
          aircraft_code: operation.aircraftCode,
          aircraft_name: operation.aircraftName || operation.aircraftCode,
          current_airport_icao: operation.origin || profile?.current_airport_icao || profile?.base_hub || "SCEL",
          status: "reserved",
        },
        ...compatible,
      ];
    }

    return compatible;
  }, [
    availableAircraft,
    operation?.aircraftCode,
    operation?.aircraftId,
    operation?.aircraftName,
    operation?.aircraftTailNumber,
    operation?.origin,
    profile?.base_hub,
    profile?.current_airport_icao,
    selectedItinerary,
  ]);

  const originAirport = useMemo(
    () => airports.find((item) => item.icao === operation?.origin) ?? null,
    [airports, operation?.origin]
  );

  const destinationAirport = useMemo(
    () => airports.find((item) => item.icao === operation?.destination) ?? null,
    [airports, operation?.destination]
  );

  const alternateAirport = useMemo(
    () => airports.find((item) => item.icao === selectedAlternate) ?? null,
    [airports, selectedAlternate]
  );

  const ofpValidationErrors = useMemo(() => {
    if (!operation) {
      return [] as string[];
    }

    if (!lastOfpSummary) {
      return ["Todavía no se ha sincronizado un OFP real desde Navigraph/SimBrief."];
    }

    const errors: string[] = [];
    const expectedFlightNumber = (operation.flightNumber || "").trim().toUpperCase();
    const actualFlightNumber = (lastOfpSummary.flightNumber || "").trim().toUpperCase();
    const expectedOrigin = (operation.origin || "").trim().toUpperCase();
    const expectedDestination = (operation.destination || "").trim().toUpperCase();
    const actualOrigin = (lastOfpSummary.origin || "").trim().toUpperCase();
    const actualDestination = (lastOfpSummary.destination || "").trim().toUpperCase();
    const expectedType = resolveSimbriefType(operation.aircraftCode || "").trim().toUpperCase();
    const actualType = (lastOfpSummary.airframe || "").trim().toUpperCase();
    const expectedTail = (operation.aircraftTailNumber || "").trim().toUpperCase();
    const actualTail = (lastOfpSummary.aircraftRegistration || "").trim().toUpperCase();

    if (!actualFlightNumber) {
      errors.push("El OFP real no trae número de vuelo.");
    } else if (actualFlightNumber !== expectedFlightNumber) {
      errors.push(`El OFP real trae vuelo ${actualFlightNumber} y la reserva web es ${expectedFlightNumber}.`);
    }

    if (!actualOrigin || actualOrigin !== expectedOrigin) {
      errors.push(`El OFP real no coincide en origen (${actualOrigin || "—"} vs ${expectedOrigin}).`);
    }

    if (!actualDestination || actualDestination !== expectedDestination) {
      errors.push(`El OFP real no coincide en destino (${actualDestination || "—"} vs ${expectedDestination}).`);
    }

    if (expectedTail && actualTail) {
      if (expectedTail !== actualTail) {
        errors.push(`La matrícula del OFP (${actualTail}) no coincide con la aeronave reservada (${expectedTail}).`);
      }
    } else if (!actualType || actualType !== expectedType) {
      errors.push(`La aeronave del OFP (${actualType || "—"}) no coincide con la reservada (${expectedType || "—"}).`);
    }

    return errors;
  }, [lastOfpSummary, operation]);

  const destinationStats = useMemo(() => {
    if (!operation?.destination) return null;

    return getDestinationStats(
      operation.destination,
      operation.aircraftCode || selectedItinerary?.aircraft_type_code || "B737-700",
      operation.flightNumber || profile?.callsign || "PWG000"
    );
  }, [
    operation?.destination,
    operation?.aircraftCode,
    operation?.flightNumber,
    profile?.callsign,
    selectedItinerary?.aircraft_type_code,
  ]);

  const stageIndex = {
    catalog: 1,
    plan: 2,
    dispatch: 3,
    simbrief: 4,
  }[stage];

  const canGoPlan = Boolean(operation?.itineraryId);
  const canGoDispatch =
    readiness.reservationComplete || stage === "dispatch" || stage === "simbrief";
  const canGoSimbrief = Boolean(simbriefPreview) || stage === "simbrief";

  function updateOperation(nextOperation: FlightOperationRecord) {
    setOperation({
      ...nextOperation,
      updatedAt: new Date().toISOString(),
    });
  }

  function handleModeChange(value: FlightMode) {
    setInfoMessage("");
    setErrorMessage("");
    setSimbriefPreview(null);
    setSimbriefBridge(null);
    setSelectedAlternate("");

    setOperation((current) => {
      const base = current ?? getDefaultFlightOperation(session.user.id, profile);
      return {
        ...base,
        flightMode: value,
        itineraryId: null,
        routeCode: "",
        flightNumber: "",
        destination: "",
        aircraftId: null,
        aircraftCode: "",
        aircraftName: "",
        aircraftTailNumber: "",
        routeText: "",
        remarks: "",
        status: base.reservationId ? base.status : "draft",
        updatedAt: new Date().toISOString(),
      };
    });

    setStage("catalog");
  }

  function handleReserveFromCatalog(itinerary: AvailableItineraryOption) {
    const base = operation ?? getDefaultFlightOperation(session.user.id, profile);
    const itineraryOperation = applyItineraryToOperation(base, itinerary);
    const firstAircraft = getCompatibleAircraft(itinerary, availableAircraft)[0] ?? null;

    const nextOperation = firstAircraft
      ? applyAircraftToOperation(itineraryOperation, firstAircraft)
      : itineraryOperation;

    updateOperation({
      ...nextOperation,
      routeText: nextOperation.routeText || "",
      scheduledDeparture: "",
    });

    setInfoMessage("");
    setErrorMessage("");
    setSelectedAlternate("");
    setSimbriefPreview(null);
    setSimbriefBridge(null);
    setStage("plan");
  }

  function handleAircraftChange(aircraftId: string) {
    if (!aircraftId) {
      setOperation((current) => {
        const base = current ?? getDefaultFlightOperation(session.user.id, profile);
        return {
          ...base,
          aircraftId: null,
          aircraftCode: "",
          aircraftName: "",
          aircraftTailNumber: "",
          updatedAt: new Date().toISOString(),
        };
      });
      return;
    }

    const aircraft = compatibleAircraft.find((item) => item.aircraft_id === aircraftId);
    if (!aircraft) return;

    setOperation((current) => {
      const base = current ?? getDefaultFlightOperation(session.user.id, profile);
      return applyAircraftToOperation(base, aircraft);
    });
  }

  async function handleContinueToDispatch() {
    if (!profile || !operation || !selectedItinerary) {
      setErrorMessage("Primero selecciona una ruta disponible para continuar.");
      return;
    }

    if (!operation.aircraftId) {
      setErrorMessage("Selecciona una aeronave disponible antes de continuar.");
      return;
    }

    setSubmitting(true);
    setInfoMessage("");
    setErrorMessage("");

    try {
      const enrichedOperation: FlightOperationRecord = {
        ...operation,
        routeText:
          operation.routeText.trim() ||
          buildRouteText(operation.origin, operation.destination, null),
        remarks: operation.remarks.trim() || "RESERVA WEB PATAGONIA WINGS",
      };

      await saveFlightOperation(profile, enrichedOperation, "reserved");
      const persistedReservation = await getActiveFlightReservation(profile);

      if (!persistedReservation) {
        throw new Error(
          "La reserva no quedó activa en la base de datos. No se avanzó al paso OFP."
        );
      }

      const mappedOperation = mapReservationToOperation(
        persistedReservation,
        profile,
        availableAircraft,
        availableItineraries
      );

      setOperation(mappedOperation);
      setStage("dispatch");
      setInfoMessage("Reserva confirmada. Ahora puedes abrir el OFP en SimBrief.");
    } catch (error) {
      const resolvedMessage =
        error instanceof Error
          ? error.message
          : "No se pudo persistir la reserva base.";
      setErrorMessage(resolvedMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendToSimbrief() {
    if (!profile || !operation || !selectedItinerary) {
      setErrorMessage("No hay una operación válida para preparar en SimBrief.");
      return;
    }

    if (!navigraphStatus.connected) {
      setErrorMessage("Primero conecta tu cuenta de Navigraph antes de abrir el planificador.");
      return;
    }

    if (!profile.simbrief_username) {
      setErrorMessage("Ingresa tu usuario SimBrief en Perfil antes de continuar.");
      return;
    }

    const preview = buildSimbriefPreview({
      profile,
      operation,
      originAirport,
      destinationAirport,
      alternateAirport,
    });

    const popup = typeof window !== "undefined"
      ? window.open("about:blank", "_blank", "noopener,noreferrer")
      : null;

    setSubmitting(true);
    setInfoMessage("");
    setErrorMessage("");

    try {
      const payload: SimbriefDispatchPayload = {
        userId: profile.id,
        reservationId: operation.reservationId,
        callsign: profile.callsign,
        simbriefUsername: profile.simbrief_username,
        firstName: profile.first_name,
        lastName: profile.last_name,
        flightNumber: operation.flightNumber,
        origin: operation.origin,
        destination: operation.destination,
        alternate: null,
        aircraftCode: operation.aircraftCode,
        aircraftTailNumber: operation.aircraftTailNumber || null,
        routeText: preview.routeText,
        scheduledDeparture: operation.scheduledDeparture,
        eteMinutes: preview.eteMinutes,
        pax: preview.pax,
        cargoKg: preview.cargoKg,
        remarks: operation.remarks.trim() || "PATAGONIA WINGS WEB DISPATCH",
      };

      const response = await fetch("/api/simbrief/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as
        | SimbriefDispatchResponse
        | { error?: string };

      if (!response.ok || !("ok" in data)) {
        throw new Error(data && "error" in data ? data.error || "No se pudo abrir SimBrief." : "No se pudo abrir SimBrief.");
      }

      setLastOfpSummary(null);
      setSimbriefBridge({
        staticId: data.staticId,
        generateUrl: data.generateUrl,
        editUrl: data.editUrl,
        fetchUrl: data.fetchUrl,
        outputpage: data.outputpage,
        timestamp: data.timestamp,
        type: data.type,
      });

      setSimbriefPreview({
        ...preview,
        staticId: data.staticId,
        matchedByStaticId: false,
      });
      setStage("simbrief");
      setInfoMessage(
        "Se abrió el planificador real de Navigraph/SimBrief en una nueva pestaña. Cuando termines, vuelve acá y recarga el OFP real."
      );
      setErrorMessage("");

      if (popup) {
        popup.location.replace(data.generateUrl);
      } else if (typeof window !== "undefined") {
        window.open(data.generateUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      popup?.close();
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo abrir el despacho real de SimBrief."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSyncLatestOfp(staticIdOverride?: string | null, silent = false) {
    if (!profile || !operation) {
      if (!silent) {
        setErrorMessage("No hay operación activa para sincronizar con SimBrief.");
      }
      return;
    }

    if (!profile.simbrief_username) {
      if (!silent) {
        setErrorMessage("Falta el usuario SimBrief en tu perfil.");
      }
      return;
    }

    const basePreview =
      simbriefPreview ??
      buildSimbriefPreview({
        profile,
        operation,
        originAirport,
        destinationAirport,
        alternateAirport,
      });

    const targetStaticId = staticIdOverride ?? simbriefBridge?.staticId ?? basePreview.staticId ?? null;

    setSyncingSimbrief(true);
    if (!silent) {
      setInfoMessage("");
      setErrorMessage("");
    }

    try {
      const search = new URLSearchParams({
        username: profile.simbrief_username,
      });

      if (targetStaticId) {
        search.set("static_id", targetStaticId);
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

      const merged = mergeSimbriefSummaryIntoPreview({
        base: {
          ...basePreview,
          staticId: targetStaticId ?? basePreview.staticId,
        },
        summary: data.summary,
        airports,
      });

      setLastOfpSummary(data.summary);
      setSimbriefPreview(merged);
      setStage("simbrief");
      setSimbriefBridge((current) =>
        current
          ? { ...current, staticId: targetStaticId ?? current.staticId }
          : targetStaticId
            ? {
                staticId: targetStaticId,
                generateUrl: "",
                editUrl: "",
                fetchUrl: "",
                outputpage: "",
                timestamp: 0,
                type: operation.aircraftCode,
              }
            : null
      );

      if (!silent) {
        setInfoMessage(
          data.matchedByStaticId
            ? "OFP real sincronizado correctamente desde Navigraph/SimBrief."
            : "Se sincronizó el último OFP real disponible en Navigraph/SimBrief para este usuario."
        );
      }
    } catch (error) {
      if (!silent) {
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo sincronizar el OFP real."
        );
      }
    } finally {
      setSyncingSimbrief(false);
    }
  }

  async function handleBeginFlight() {
    if (!profile || !operation || !simbriefPreview) {
      setErrorMessage("Primero debes preparar y revisar el briefing del vuelo.");
      return;
    }

    if (simbriefPreview.source !== "real") {
      setErrorMessage("Antes de comenzar, genera o sincroniza el OFP real desde Navigraph/SimBrief.");
      return;
    }

    if (ofpValidationErrors.length > 0) {
      setErrorMessage(ofpValidationErrors.join(" "));
      return;
    }

    if (!readiness.canPrepareDispatch) {
      setErrorMessage(dispatchBlockingReasons.join(" "));
      return;
    }

    setSubmitting(true);
    setInfoMessage("");
    setErrorMessage("");

    try {
      const finalOperation: FlightOperationRecord = {
        ...operation,
        routeText: simbriefPreview.routeText,
        remarks: `${operation.remarks || "PLAN WEB"} | SIMBRIEF READY | STATIC ${simbriefPreview.staticId ?? "N/A"}`,
      };

      const saved = await saveFlightOperation(profile, finalOperation, "dispatch_ready");
      await markDispatchPrepared(saved.id, profile.simbrief_username ?? "", profile.callsign);
      setOperation(
        mapReservationToOperation(saved, profile, availableAircraft, availableItineraries)
      );
      setInfoMessage(
        "Vuelo marcado como listo con OFP real sincronizado. Ya quedó preparado para el siguiente enlace con ACARS."
      );
    } catch (error) {
      const resolvedMessage =
        error instanceof Error
          ? error.message
          : "No se pudo dejar el vuelo listo para comenzar.";
      setErrorMessage(resolvedMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetOperation() {
    if (!operation?.reservationId) {
      setOperation(getDefaultFlightOperation(session.user.id, profile));
      setStage("catalog");
      setSelectedAlternate("");
      setSimbriefPreview(null);
      setSimbriefBridge(null);
      setInfoMessage("");
      setErrorMessage("");
      return;
    }

    setSubmitting(true);
    setInfoMessage("");
    setErrorMessage("");

    try {
      await cancelFlightOperation(operation.reservationId, profile?.callsign);
      setOperation(getDefaultFlightOperation(session.user.id, profile));
      setStage("catalog");
      setSelectedAlternate("");
      setSimbriefPreview(null);
      setSimbriefBridge(null);
      setInfoMessage("Reserva liberada. Puedes comenzar una nueva solicitud.");
    } catch (error) {
      const resolvedMessage =
        error instanceof Error
          ? error.message
          : "No se pudo reiniciar la operación.";
      setErrorMessage(resolvedMessage);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (stage === "simbrief") {
      setStage("dispatch");
      return;
    }
    if (stage === "dispatch") {
      setStage("plan");
      return;
    }
    if (stage === "plan") {
      setStage("catalog");
    }
  }

  async function handlePrimaryContinue() {
    if (stage === "catalog") {
      setErrorMessage("Selecciona una ruta y pulsa Reservar para seguir.");
      return;
    }
    if (stage === "plan") {
      await handleContinueToDispatch();
      return;
    }
    if (stage === "dispatch") {
      await handleSendToSimbrief();
      return;
    }
    if (stage === "simbrief") {
      if (simbriefPreview?.source === "real") {
        await handleBeginFlight();
      } else {
        await handleSyncLatestOfp();
      }
    }
  }

  function handleGoToStage(nextStage: OperationStage) {
    if (nextStage === stage) return;

    if (nextStage === "catalog") {
      setStage("catalog");
      return;
    }

    if (nextStage === "plan" && canGoPlan) {
      setStage("plan");
      return;
    }

    if (nextStage === "dispatch" && canGoDispatch) {
      setStage("dispatch");
      return;
    }

    if (nextStage === "simbrief" && canGoSimbrief) {
      setStage("simbrief");
    }
  }

  const primaryButtonLabel =
    stage === "catalog"
      ? "Selecciona una ruta"
      : stage === "plan"
        ? submitting
          ? "Guardando..."
          : "Continuar"
        : stage === "dispatch"
          ? submitting
            ? "Abriendo SimBrief..."
            : "Abrir OFP / SimBrief"
          : simbriefPreview?.source === "real"
            ? submitting
              ? "Preparando..."
              : "Comenzar vuelo"
            : syncingSimbrief
              ? "Sincronizando..."
              : "Recargar OFP";

  const primaryDisabled =
    loading ||
    submitting ||
    syncingSimbrief ||
    (stage === "catalog" && true) ||
    (stage === "simbrief" && !simbriefPreview);

  const pilotName =
    profile?.callsign || session.user.email?.split("@")[0]?.toUpperCase() || "PILOTO";


  useEffect(() => {
    if (typeof window === "undefined" || !profile || !operation) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("simbrief_return") !== "1") {
      return;
    }

    const staticId = params.get("static_id");

    void handleSyncLatestOfp(staticId, false).finally(() => {
      window.history.replaceState({}, "", "/operations");
    });
  }, [profile, operation]);

  return (
    <div className="pw-container py-12 sm:py-16 lg:py-20">
      <section className="glass-panel rounded-[34px] p-7 sm:p-9">
        <span className="parallax-chip mb-6">OPERACIONES</span>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Flujo de reserva, plan y briefing
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-white/80">
              {pilotName}, aquí quedó el flujo más claro y ordenado: rutas disponibles según tu aeropuerto, plan de vuelo, envío a SimBrief y briefing final.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/dashboard" className="button-secondary">
              Volver al dashboard
            </Link>
            <Link href="/profile" className="button-ghost">
              Revisar perfil
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-4">
        <SummaryKpi label="Paso actual" value={`0${stageIndex}`} />
        <SummaryKpi
          label="Aeropuerto actual"
          value={profile?.current_airport_icao ?? profile?.base_hub ?? "SCEL"}
        />
        <SummaryKpi label="Rutas reservables" value={String(visibleItineraries.length)} />
        <SummaryKpi label="Aeronaves en campo" value={String(availableAircraft.length)} />
      </section>

      {errorMessage ? (
        <div className="mt-6 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      {infoMessage ? (
        <div className="mt-6 rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {infoMessage}
        </div>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel rounded-[30px] p-7">
          <div className="surface-outline rounded-[24px] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <StagePill
                  active={stage === "catalog"}
                  complete={Boolean(operation?.itineraryId)}
                  label="1. Reservar ruta"
                  onClick={() => handleGoToStage("catalog")}
                />
                <StagePill
                  active={stage === "plan"}
                  complete={canGoDispatch}
                  label="2. Plan de vuelo"
                  onClick={() => handleGoToStage("plan")}
                  disabled={!canGoPlan}
                />
                <StagePill
                  active={stage === "dispatch"}
                  complete={Boolean(simbriefPreview)}
                  label="3. OFP / SimBrief"
                  onClick={() => handleGoToStage("dispatch")}
                  disabled={!canGoDispatch}
                />
                <StagePill
                  active={stage === "simbrief"}
                  complete={readiness.dispatchPrepared}
                  label="4. Briefing final"
                  onClick={() => handleGoToStage("simbrief")}
                  disabled={!canGoSimbrief}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={handleBack}
                  disabled={loading || submitting || stage === "catalog"}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className={stage === "catalog" ? "button-secondary" : "button-primary"}
                  onClick={() => void handlePrimaryContinue()}
                  disabled={primaryDisabled}
                >
                  {primaryButtonLabel}
                </button>
              </div>
            </div>
          </div>

          {stage === "catalog" ? (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap items-end gap-4">
                <div className="surface-outline w-full rounded-[22px] px-5 py-5 sm:w-[280px]">
                  <label className="field-label">Modo de vuelo</label>
                  <select
                    className="input-premium"
                    value={currentMode}
                    onChange={(event) => handleModeChange(event.target.value as FlightMode)}
                    disabled={loading || submitting}
                  >
                    {flightModeOptions.map((item) => (
                      <option
                        key={item.value}
                        value={item.value}
                        style={{ color: "#081321", backgroundColor: "#f8fbff" }}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="surface-outline min-w-[220px] flex-1 rounded-[22px] px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                    Salen desde
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {profile?.current_airport_icao ?? profile?.base_hub ?? "SCEL"}
                  </p>
                  <p className="mt-2 text-sm text-white/66">
                    La lista se arma según tu ubicación operativa actual y las aeronaves disponibles en ese mismo aeropuerto.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-white/10">
                <div className="grid grid-cols-[1.1fr_0.9fr_0.9fr_0.7fr_0.8fr] gap-4 bg-white/5 px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/56">
                  <div>Vuelo</div>
                  <div>Origen</div>
                  <div>Destino</div>
                  <div>Duración</div>
                  <div className="text-right">Acción</div>
                </div>

                {visibleItineraries.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-white/70">
                    No hay rutas reservables para el modo actual desde tu aeropuerto operativo.
                  </div>
                ) : (
                  visibleItineraries.map(
                    ({
                      item,
                      compatibleAircraft,
                      originAirport: itemOriginAirport,
                      destinationAirport: itemDestinationAirport,
                      scheduledBlockMin,
                      routeGroupLabel,
                      displayFlightNumber,
                    }) => {
                      return (
                        <div
                          key={item.itinerary_id}
                          className="grid grid-cols-[1.1fr_0.9fr_0.9fr_0.7fr_0.8fr] items-center gap-4 border-t border-white/10 px-5 py-4"
                        >
                          <div>
                            <p className="text-xl font-semibold text-white">{displayFlightNumber}</p>
                          </div>
                          <div>
                            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sm font-semibold text-sky-200">
                              <span aria-hidden="true">{getCountryDisplay(itemOriginAirport?.country ?? item.origin_country, item.origin_icao).flag}</span>
                              <span>{item.origin_icao}</span>
                            </span>
                          </div>
                          <div>
                            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sm font-semibold text-sky-200">
                              <span aria-hidden="true">{getCountryDisplay(itemDestinationAirport?.country ?? item.destination_country, item.destination_icao).flag}</span>
                              <span>{item.destination_icao}</span>
                            </span>
                          </div>
                          <div>
                            <p className="text-xl font-semibold text-white">
                              {formatMinutes(Math.max(1, scheduledBlockMin || 0))}
                            </p>
                            <p className="mt-1 text-xs text-white/60">{routeGroupLabel}</p>
                          </div>
                          <div className="text-right">
                            <button
                              type="button"
                              className="button-primary"
                              onClick={() => handleReserveFromCatalog(item)}
                              disabled={compatibleAircraft.length === 0 || loading || submitting}
                            >
                              Reservar
                            </button>
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </div>
          ) : null}

          {stage === "plan" ? (
            <div className="mt-6 space-y-6">
              <div>
                <span className="section-chip">Plan de vuelo</span>
                <h2 className="mt-4 text-3xl font-semibold text-white">
                  Preparar la reserva seleccionada
                </h2>
                <p className="mt-3 text-base leading-7 text-white/72">
                  Confirma la aeronave asignada y revisa origen y destino. La hora, la ruta final y la alternativa se definirán en SimBrief.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SmallInfoCard
                  title="Ruta reservada"
                  value={
                    operation?.origin && operation?.destination
                      ? `${operation.origin} - ${operation.destination}`
                      : "Sin ruta"
                  }
                  subvalue={
                    originAirport?.city && destinationAirport?.city
                      ? `${originAirport.city} - ${destinationAirport.city}`
                      : selectedItinerary?.itinerary_name ?? ""
                  }
                />
                <SmallInfoCard
                  title="Aeronave seleccionada"
                  value={operation?.aircraftCode || "Sin asignar"}
                  subvalue={operation?.aircraftTailNumber || "Selecciona una aeronave disponible"}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Origen</label>
                  <input
                    className="input-premium opacity-90"
                    value={operation?.origin ?? profile?.current_airport_icao ?? "SCEL"}
                    readOnly
                  />
                  <p className="mt-3 text-sm text-white/70">
                    {renderAirportFlagPill(originAirport, operation?.origin ?? profile?.current_airport_icao ?? "SCEL")} · {getAirportCityLabel(originAirport, operation?.origin ?? "SCEL")}
                  </p>
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Destino</label>
                  <input
                    className="input-premium opacity-90"
                    value={operation?.destination ?? ""}
                    readOnly
                  />
                  <p className="mt-3 text-sm text-white/70">
                    {renderAirportFlagPill(destinationAirport, operation?.destination ?? "")} · {getAirportCityLabel(destinationAirport, operation?.destination ?? "----")}
                  </p>
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5 sm:col-span-2">
                  <label className="field-label">Aeronave disponible</label>
                  <select
                    className="input-premium"
                    value={operation?.aircraftId ?? ""}
                    onChange={(event) => handleAircraftChange(event.target.value)}
                    disabled={loading || submitting}
                  >
                    <option value="">Seleccionar aeronave</option>
                    {compatibleAircraft.map((item) => (
                      <option key={item.aircraft_id} value={item.aircraft_id}>
                        {item.aircraft_code} · {item.tail_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="surface-outline rounded-[24px] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                    Destino
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[96px_1fr] sm:items-start">
                    <div className="flex h-24 items-center justify-center rounded-[20px] border border-white/10 bg-white/5 text-3xl">
                      ✈️
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sm font-semibold text-sky-200">
                        <span aria-hidden="true">{getCountryDisplay(destinationAirport?.country, operation?.destination ?? "----").flag}</span>
                        <span>{operation?.destination ?? "----"}</span>
                      </div>
                      <p className="mt-3 text-xl font-semibold text-white">
                        {getAirportCardTitle(destinationAirport, operation?.destination ?? "----")}
                      </p>
                      <p className="mt-2 text-sm text-white/66">
                        Total arribos: {destinationStats?.totalArrivals ?? "—"}
                      </p>
                      <p className="mt-1 text-sm text-white/66">
                        Última visita: {destinationStats?.lastVisit ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="surface-outline rounded-[24px] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                    Estadísticas de esta ruta
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="text-sm text-white/78">
                      <span className="block text-white/56">Cantidad de vuelos</span>
                      <strong className="mt-1 block text-lg text-white">
                        {destinationStats?.totalFlights ?? "—"}
                      </strong>
                    </div>
                    <div className="text-sm text-white/78">
                      <span className="block text-white/56">En aeronave elegida</span>
                      <strong className="mt-1 block text-lg text-white">
                        {destinationStats?.selectedAircraftFlights ?? "—"}
                      </strong>
                    </div>
                    <div className="text-sm text-white/78">
                      <span className="block text-white/56">Consumo promedio</span>
                      <strong className="mt-1 block text-lg text-white">
                        {destinationStats?.avgFuelKg ?? "—"} kg
                      </strong>
                    </div>
                    <div className="text-sm text-white/78">
                      <span className="block text-white/56">Mejor consumo</span>
                      <strong className="mt-1 block text-lg text-white">
                        {destinationStats?.bestFuelKg ?? "—"} kg
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" className="button-ghost" onClick={handleBack}>
                  Volver
                </button>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => void handleContinueToDispatch()}
                  disabled={loading || submitting}
                >
                  {submitting ? "Guardando..." : "Continuar"}
                </button>
              </div>
            </div>
          ) : null}

          {stage === "dispatch" ? (
            <div className="mt-6 space-y-6">
              <div>
                <span className="section-chip">Dispatch Navigraph / SimBrief</span>
                <h2 className="mt-4 text-3xl font-semibold text-white">
                  Payload del plan de vuelo
                </h2>
                <p className="mt-3 text-base leading-7 text-white/72">
                  Primero conecta tu cuenta de Navigraph. Luego abre el OFP en SimBrief con el vuelo reservado y, cuando termines, recarga el OFP real antes de enviarlo al ACARS.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SmallInfoCard
                  title="Número de vuelo"
                  value={operation?.flightNumber ?? "PWG000"}
                  subvalue={`Clave interna ${operation?.routeCode ?? "—"}`}
                />
                <SmallInfoCard
                  title="Origen"
                  value={operation?.origin ?? "SCEL"}
                  subvalue={`${getCountryDisplay(originAirport?.country, operation?.origin ?? "SCEL").flag} ${getAirportCityLabel(originAirport, operation?.origin ?? "SCEL")}`}
                />
                <SmallInfoCard
                  title="Destino"
                  value={operation?.destination ?? "SCTE"}
                  subvalue={`${getCountryDisplay(destinationAirport?.country, operation?.destination ?? "SCTE").flag} ${getAirportCityLabel(destinationAirport, operation?.destination ?? "SCTE")}`}
                />
                <SmallInfoCard
                  title="Aeronave"
                  value={operation?.aircraftCode || "Sin asignar"}
                  subvalue={operation?.aircraftTailNumber || "Seleccionada en reserva"}
                />
              </div>

              <div className="surface-outline rounded-[24px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                  Resumen del envío
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="text-sm text-white/78">
                    <span className="block text-white/56">Estado Navigraph</span>
                    <strong className="mt-1 block text-lg text-white">
                      {navigraphStatus.connected ? "Conectado" : checkingNavigraph ? "Comprobando..." : "Pendiente"}
                    </strong>
                  </div>
                  <div className="text-sm text-white/78">
                    <span className="block text-white/56">Usuario SimBrief</span>
                    <strong className="mt-1 block text-lg text-white">
                      {profile?.simbrief_username || "Pendiente"}
                    </strong>
                  </div>
                  <div className="text-sm text-white/78">
                    <span className="block text-white/56">Ruta propuesta</span>
                    <strong className="mt-1 block text-lg text-white">
                      {operation?.routeText ||
                        buildRouteText(
                          operation?.origin ?? "SCEL",
                          operation?.destination ?? "SCTE",
                          null
                        )}
                    </strong>
                  </div>
                </div>
              </div>

              {deviceSession ? (
                <div className="rounded-[18px] border border-sky-400/20 bg-sky-400/10 px-4 py-4 text-sm text-sky-100/90">
                  Autoriza Patagonia Wings en Navigraph con el código <strong>{deviceSession.userCode}</strong>. Si no se abrió la ventana, usa el botón de abajo.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button type="button" className="button-ghost" onClick={handleBack}>
                  Volver
                </button>
                {!navigraphStatus.connected ? (
                  <>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => void handleConnectNavigraph()}
                      disabled={loading || connectingNavigraph}
                    >
                      {connectingNavigraph ? "Conectando..." : "Conectar Navigraph"}
                    </button>
                    {deviceSession ? (
                      <button
                        type="button"
                        className="button-ghost"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.open(deviceSession.verificationUriComplete, "_blank", "noopener,noreferrer");
                          }
                        }}
                      >
                        Abrir página de autorización
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleSendToSimbrief}
                    disabled={loading || submitting || syncingSimbrief}
                  >
                    {submitting ? "Abriendo OFP..." : "Abrir OFP / SimBrief"}
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {stage === "simbrief" ? (
            <div className="mt-6 space-y-6">
              <div>
                <span className="section-chip">Briefing final</span>
                <h2 className="mt-4 text-3xl font-semibold text-white">
                  Resumen del plan devuelto por Navigraph / SimBrief
                </h2>
                <p className="mt-3 text-base leading-7 text-white/72">
                  Aquí ves el briefing del vuelo. El OFP debe coincidir con la reserva web antes de habilitar el envío al ACARS.
                </p>
              </div>

              {simbriefPreview ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SmallInfoCard
                      title="Origen"
                      value={simbriefPreview.origin?.icao ?? operation?.origin ?? "SCEL"}
                      subvalue={`${getAirportCardTitle(
                        simbriefPreview.origin,
                        operation?.origin ?? "SCEL"
                      )} · Elevación ${getElevation(
                        simbriefPreview.origin?.icao ?? operation?.origin ?? "SCEL"
                      )} ft`}
                    />
                    <SmallInfoCard
                      title="Destino"
                      value={simbriefPreview.destination?.icao ?? operation?.destination ?? "SCTE"}
                      subvalue={`${getAirportCardTitle(
                        simbriefPreview.destination,
                        operation?.destination ?? "SCTE"
                      )} · Elevación ${getElevation(
                        simbriefPreview.destination?.icao ?? operation?.destination ?? "SCTE"
                      )} ft`}
                    />
                    <SmallInfoCard
                      title="ETE / ETA"
                      value={`${formatMinutes(simbriefPreview.eteMinutes)} · ${formatDateTime(
                        simbriefPreview.etaIso
                      )}`}
                      subvalue={`Distancia ${simbriefPreview.distanceNm} nm`}
                    />
                    <SmallInfoCard
                      title="Ruta"
                      value={simbriefPreview.routeText}
                      subvalue={`Airframe ${simbriefPreview.airframe}`}
                    />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="surface-outline rounded-[24px] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                        Pesos y combustible
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                          <span className="block text-white/56">Pasajeros</span>
                          <strong className="mt-2 block text-2xl text-white">
                            {simbriefPreview.pax}
                          </strong>
                        </div>
                        <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                          <span className="block text-white/56">Payload</span>
                          <strong className="mt-2 block text-2xl text-white">
                            {simbriefPreview.payloadKg} kg
                          </strong>
                        </div>
                        <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                          <span className="block text-white/56">Carga</span>
                          <strong className="mt-2 block text-2xl text-white">
                            {simbriefPreview.cargoKg} kg
                          </strong>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                          <span className="block text-white/56">Estimaciones</span>
                          <strong className="mt-2 block text-xl text-white">
                            Trip {simbriefPreview.tripFuelKg} kg
                          </strong>
                          <p className="mt-2 text-white/66">
                            Reserva {simbriefPreview.reserveFuelKg} kg
                          </p>
                          <p className="mt-1 text-white/66">
                            Taxi {simbriefPreview.taxiFuelKg} kg
                          </p>
                        </div>
                        <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                          <span className="block text-white/56">Combustible bloque</span>
                          <strong className="mt-2 block text-3xl text-emerald-300">
                            {simbriefPreview.blockFuelKg} kg
                          </strong>
                          <p className="mt-2 text-white/66">
                            Alcance estimado {simbriefPreview.maxRangeNm} nm
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="surface-outline rounded-[24px] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                        Limitaciones del avión
                      </p>
                      <div className="mt-4 space-y-3">
                        {[
                          { label: "MZFW", limit: simbriefPreview.mzfwKg, actual: simbriefPreview.zfwKg },
                          { label: "MTOW", limit: simbriefPreview.mtowKg, actual: simbriefPreview.towKg },
                          { label: "MLW", limit: simbriefPreview.mlwKg, actual: simbriefPreview.lwKg },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-4"
                          >
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/56">
                                {item.label}
                              </p>
                              <p className="mt-1 text-sm text-white/66">Límite {item.limit} kg</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-emerald-300">
                                {item.actual} kg
                              </p>
                              <p className="text-xs text-white/56">Actual</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="surface-outline rounded-[24px] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                      Estado del enlace real
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                        <span className="block text-white/56">Fuente briefing</span>
                        <strong className="mt-2 block text-xl text-white">
                          {simbriefPreview.source === "real" ? "OFP real" : "Estimado"}
                        </strong>
                      </div>
                      <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                        <span className="block text-white/56">Vuelo OFP</span>
                        <strong className="mt-2 block text-xl text-white">
                          {lastOfpSummary?.flightNumber ?? "Pendiente"}
                        </strong>
                      </div>
                      <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                        <span className="block text-white/56">Static ID</span>
                        <strong className="mt-2 block text-base text-white break-all">
                          {simbriefPreview.staticId ?? simbriefBridge?.staticId ?? "Pendiente"}
                        </strong>
                      </div>
                      <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                        <span className="block text-white/56">Match exacto</span>
                        <strong className="mt-2 block text-xl text-white">
                          {simbriefPreview.matchedByStaticId ? "Sí" : "Último OFP"}
                        </strong>
                      </div>
                      <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                        <span className="block text-white/56">Generado</span>
                        <strong className="mt-2 block text-base text-white">
                          {simbriefPreview.generatedAtIso ? formatDateTime(simbriefPreview.generatedAtIso) : "Pendiente"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="surface-outline rounded-[24px] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                      Validación reserva vs OFP
                    </p>
                    {ofpValidationErrors.length === 0 ? (
                      <p className="mt-3 text-sm text-emerald-300">
                        OFP válido: número de vuelo, origen, destino y aeronave coinciden con la reserva web.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm text-amber-200/90">
                        {ofpValidationErrors.map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="button-ghost" onClick={handleBack}>
                      Volver
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        const target = simbriefBridge?.generateUrl || simbriefBridge?.editUrl;
                        if (target && typeof window !== "undefined") {
                          window.open(target, "_blank", "noopener,noreferrer");
                        }
                      }}
                      disabled={!simbriefBridge?.generateUrl && !simbriefBridge?.editUrl}
                    >
                      Abrir planificador
                    </button>
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => void handleSyncLatestOfp()}
                      disabled={loading || submitting || syncingSimbrief}
                    >
                      {syncingSimbrief ? "Sincronizando..." : "Recargar OFP"}
                    </button>
                    {simbriefPreview.pdfUrl ? (
                      <a
                        href={simbriefPreview.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="button-ghost"
                      >
                        Abrir PDF OFP
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => void handleBeginFlight()}
                      disabled={loading || submitting || syncingSimbrief || simbriefPreview.source !== "real" || ofpValidationErrors.length > 0}
                    >
                      {submitting ? "Preparando..." : "Enviar listo a ACARS"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-[18px] border border-sky-400/20 bg-sky-400/10 px-4 py-4 text-sm text-sky-100/90">
                  Todavía no se ha generado el briefing. Vuelve al paso anterior, abre el planificador y luego recarga el OFP real.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="glass-panel rounded-[30px] p-7">
          <span className="section-chip">Readiness despacho</span>
          <h2 className="mt-4 text-3xl font-semibold text-white">
            Estado de la solicitud
          </h2>

          <div className="mt-6 space-y-3">
            {[
              {
                name: "Perfil del piloto completo",
                done: readiness.profileReady,
              },
              {
                name: "Hub base operativo",
                done: readiness.baseHubReady,
              },
              {
                name: "Usuario SimBrief informado",
                done: readiness.simbriefReady,
              },
              {
                name: "Reserva base persistida",
                done: readiness.reservationComplete,
              },
              {
                name: "Despacho persistido en DB",
                done: readiness.dispatchPrepared,
              },
            ].map((item) => (
              <div
                key={item.name}
                className="surface-outline flex items-center justify-between gap-3 rounded-[22px] px-5 py-4"
              >
                <span className="text-sm text-white/84">{item.name}</span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                    item.done
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {item.done ? "Completo" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>

          {!readiness.canPrepareDispatch ? (
            <div className="mt-6 rounded-[18px] border border-amber-400/20 bg-amber-400/10 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/90">
                Falta para habilitar despacho
              </p>
              <div className="mt-3 space-y-2">
                {dispatchBlockingReasons.map((reason) => (
                  <div key={reason} className="text-sm text-amber-100/90">
                    • {reason}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Link href="/profile" className="button-ghost">
                  Ir al perfil
                </Link>
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <SmallInfoCard title="Callsign" value={profile?.callsign ?? "PWG000"} />
            <SmallInfoCard
              title="Aeropuerto actual"
              value={profile?.current_airport_icao ?? profile?.base_hub ?? "SCEL"}
            />
            <SmallInfoCard title="SimBrief" value={profile?.simbrief_username || "Pendiente"} />
            <SmallInfoCard
              title="Estado BD"
              value={operation?.reservationId ? `Reserva ${operation.status}` : "Sin reserva activa"}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="button-ghost"
              onClick={() => void handleResetOperation()}
              disabled={loading || submitting}
            >
              Reiniciar flujo
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => handleGoToStage("catalog")}
              disabled={loading || submitting}
            >
              Ver rutas
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function OperationsPage() {
  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen overflow-hidden">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="relative z-10">
          <header className="pw-container pt-5">
            <PublicHeader />
          </header>

          <ProtectedPage>
            <OperationsContent />
          </ProtectedPage>
        </div>
      </section>
    </main>
  );
}