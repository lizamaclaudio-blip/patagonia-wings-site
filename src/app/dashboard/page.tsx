"use client";

import Image from "next/image";
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
import {
  listAvailableAircraft,
  listAvailableItineraries,
  type AvailableAircraftOption,
  type AvailableItineraryOption,
  type FlightMode,
} from "@/lib/flight-ops";
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
  | "free_flight";

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

type AirportHeroResponse = {
  imageUrl: string;
  source: "local" | "pexels" | "fallback";
  photographerName?: string | null;
  photographerUrl?: string | null;
  providerName?: string | null;
  providerUrl?: string | null;
  photoPageUrl?: string | null;
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
  },
];

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

function CentralAirportHero({ central }: { central: CentralOverview }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [heroImage, setHeroImage] = useState<AirportHeroResponse | null>(null);
  const [isResolvingImage, setIsResolvingImage] = useState(true);
  const flagUrl = getFlagUrl(central.countryCode);

  useEffect(() => {
    let cancelled = false;

    async function resolveAirportHero() {
      setImageFailed(false);
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
      cancelled = true
    };
  }, [central]);

  const displayImageUrl = !imageFailed ? (heroImage?.imageUrl ?? central.imagePath) : null;
  const showPexelsAttribution =
    !imageFailed &&
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
                  onError={() => setImageFailed(true)}
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

function DispatchAirportBannerCard({
  central,
  metar,
}: {
  central: CentralOverview;
  metar: DispatchMetarSummary;
}) {
  const flagUrl = getFlagUrl(central.countryCode);

  return (
    <aside className="overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,22,44,0.92),rgba(4,15,30,0.96))] shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
      <div className="relative min-h-[280px] overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-45"
          style={{ backgroundImage: `url(${central.imagePath})` }}
        />
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

function DispatchAircraftTable({
  rows,
  selectedAircraftId,
  onSelect,
}: {
  rows: AvailableAircraftOption[];
  selectedAircraftId: string | null;
  onSelect: (aircraftId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/78">
          <thead className="bg-white/[0.04] text-[11px] uppercase tracking-[0.18em] text-white/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Registro</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Ubicacion</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold text-right">Accion</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isSelected = selectedAircraftId === row.aircraft_id;

              return (
                <tr
                  key={row.aircraft_id}
                  className={`border-t border-white/8 align-top transition ${
                    isSelected ? "bg-emerald-500/[0.08]" : ""
                  }`}
                >
                  <td className="px-4 py-4 font-semibold text-white">{row.tail_number || "---"}</td>
                  <td className="px-4 py-4 text-white/84">{row.aircraft_code || "---"}</td>
                  <td className="px-4 py-4 text-white/84">{row.aircraft_name || "---"}</td>
                  <td className="px-4 py-4 text-white/84">{row.current_airport_icao || "---"}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full border border-emerald-400/18 bg-emerald-500/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
                      {row.status || "available"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onSelect(row.aircraft_id)}
                      className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                        isSelected
                          ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-100"
                          : "border-white/10 bg-white/[0.04] text-white/76 hover:bg-white/[0.08]"
                      }`}
                    >
                      {isSelected ? "Seleccionada" : "Seleccionar"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-white/54">
                  No hay aeronaves disponibles en este aeropuerto para esta etapa.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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

function mapDispatchFlightTypeToMode(value: DispatchFlightTypeId | null): FlightMode | null {
  switch (value) {
    case "career":
      return "itinerary";
    case "charter":
      return "charter";
    case "training":
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
}: {
  rows: AvailableItineraryOption[];
  selectedItineraryId: string | null;
  onSelect: (itineraryId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/78">
          <thead className="bg-white/[0.04] text-[11px] uppercase tracking-[0.18em] text-white/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Ruta</th>
              <th className="px-4 py-3 font-semibold">Origen</th>
              <th className="px-4 py-3 font-semibold">Destino</th>
              <th className="px-4 py-3 font-semibold">Flota</th>
              <th className="px-4 py-3 font-semibold">Disp.</th>
              <th className="px-4 py-3 font-semibold text-right">Accion</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isSelected = selectedItineraryId === row.itinerary_id;
              const fleetLabel =
                row.compatible_aircraft_types?.length
                  ? row.compatible_aircraft_types.join(", ")
                  : row.aircraft_type_code || row.aircraft_type_name || "Multi-fleet";

              return (
                <tr
                  key={row.itinerary_id}
                  className={`border-t border-white/8 align-top transition ${
                    isSelected ? "bg-emerald-500/[0.08]" : ""
                  }`}
                >
                  <td className="px-4 py-4">
                    <div className="font-semibold text-white">{row.itinerary_code}</div>
                    <div className="mt-1 text-sm text-white/68">{row.itinerary_name}</div>
                  </td>
                  <td className="px-4 py-4 text-white/84">{row.origin_icao || "---"}</td>
                  <td className="px-4 py-4 text-white/84">{row.destination_icao || "---"}</td>
                  <td className="px-4 py-4 text-white/84">{fleetLabel}</td>
                  <td className="px-4 py-4 text-white/84">
                    {typeof row.available_aircraft_count === "number" ? row.available_aircraft_count : 0}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onSelect(row.itinerary_id)}
                      className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
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

function DashboardWorkspace({
  activeTab,
  onChangeTab,
  metrics,
  central,
  availableAircraft,
  availableItineraries,
}: {
  activeTab: DashboardTabKey;
  onChangeTab: (tab: DashboardTabKey) => void;
  metrics: DashboardMetrics;
  central: CentralOverview;
  availableAircraft: AvailableAircraftOption[];
  availableItineraries: AvailableItineraryOption[];
}) {
  const [dispatchStep, setDispatchStep] = useState<DispatchStepKey>("flight_type");
  const [selectedFlightType, setSelectedFlightType] = useState<DispatchFlightTypeId | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<string | null>(null);
  const [selectedItinerary, setSelectedItinerary] = useState<string | null>(null);
  const [dispatchReady, setDispatchReady] = useState(false);

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
    const modeFiltered = dispatchFlightMode
      ? availableItineraries.filter((item) => item.flight_mode === dispatchFlightMode)
      : [];

    if (!selectedAircraftRecord) {
      return modeFiltered;
    }

    const selectedCode = normalizeDispatchAircraftCode(selectedAircraftRecord.aircraft_code);

    return modeFiltered.filter((item) => {
      const compatibleTypes = item.compatible_aircraft_types ?? [];
      if (compatibleTypes.length > 0) {
        return compatibleTypes.some(
          (type) => normalizeDispatchAircraftCode(type) === selectedCode,
        );
      }

      if (item.aircraft_type_code) {
        return normalizeDispatchAircraftCode(item.aircraft_type_code) === selectedCode;
      }

      return (item.available_aircraft_count ?? 0) > 0;
    });
  }, [availableItineraries, dispatchFlightMode, selectedAircraftRecord]);
  const selectedItineraryRecord = useMemo(
    () => filteredItineraries.find((option) => option.itinerary_id === selectedItinerary) ?? null,
    [filteredItineraries, selectedItinerary],
  );

  useEffect(() => {
    if (selectedAircraft && !selectedAircraftRecord) {
      setSelectedAircraft(null);
      setSelectedItinerary(null);
      setDispatchReady(false);
    }
  }, [selectedAircraft, selectedAircraftRecord]);

  useEffect(() => {
    if (selectedItinerary && !selectedItineraryRecord) {
      setSelectedItinerary(null);
      setDispatchReady(false);
    }
  }, [selectedItinerary, selectedItineraryRecord]);

  const isStepEnabled = (step: DispatchStepKey) => {
    switch (step) {
      case "flight_type":
        return true;
      case "aircraft":
        return canOpenAircraft;
      case "itinerary":
        return canOpenItinerary;
      case "dispatch_flow":
        return canOpenDispatch;
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
      ? `${selectedAircraftRecord.tail_number} · ${selectedAircraftRecord.aircraft_code}`
      : "Pendiente",
    itinerary: selectedItineraryRecord
      ? `${selectedItineraryRecord.itinerary_code} · ${selectedItineraryRecord.origin_icao} - ${selectedItineraryRecord.destination_icao}`
      : "Pendiente",
    dispatch: dispatchReady ? "Despacho marcado como listo" : "Pendiente",
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
    setDispatchStep("aircraft");
  };

  const resetAfterAircraft = (nextAircraft: string) => {
    setSelectedAircraft(nextAircraft);
    setSelectedItinerary(null);
    setDispatchReady(false);
  };

  const resetAfterItinerary = (nextItinerary: string) => {
    setSelectedItinerary(nextItinerary);
    setDispatchReady(false);
  };

  return (
    <section className="mt-6 glass-panel rounded-[30px] p-4 sm:p-5 lg:p-6">
      <div className="border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {DASHBOARD_TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChangeTab(tab.key)}
                className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                    : "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                }`}
              >
                {tab.label}
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
                <div className="grid gap-5 border-b border-white/8 pb-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
                  <div className="relative overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(6,22,44,0.88),rgba(4,15,30,0.96))] px-6 py-8 text-center sm:px-8 sm:py-10">
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-cover bg-center opacity-20"
                      style={{ backgroundImage: `url(${central.imagePath})` }}
                    />
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

                  <DispatchAirportBannerCard central={central} metar={dispatchMetar} />

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
                          {DISPATCH_FLIGHT_TYPE_OPTIONS.map((option) => {
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
                          <DispatchAircraftTable
                            rows={availableAircraft}
                            selectedAircraftId={selectedAircraft}
                            onSelect={resetAfterAircraft}
                          />
                        </div>

                        <div className="mt-6 flex flex-col gap-4 border-t border-white/8 pt-5 lg:flex-row lg:items-center lg:justify-between">
                          <p className="text-sm leading-7 text-white/70">
                            {selectedAircraftRecord
                              ? `Aeronave seleccionada: ${selectedAircraftRecord.tail_number} · ${selectedAircraftRecord.aircraft_code}.`
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

                  {dispatchStep === "dispatch_flow" ? (
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

                  {dispatchStep === "summary" ? (
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
                          <Link href="/operations" className="button-primary py-3">
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

        {activeTab === "office" ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="surface-outline rounded-[24px] p-5 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Oficina del piloto
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Perfil, carrera y administración</h2>
              <p className="mt-3 text-sm leading-7 text-white/72">
                Este espacio será la oficina del piloto para revisar rango, progreso, transferencias,
                billetera, historial y documentos internos, manteniendo todo dentro de la misma base visual.
              </p>
            </div>

            <div className="surface-outline rounded-[24px] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Accesos
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <Link href="/profile" className="button-secondary">
                  Abrir perfil
                </Link>
                <button type="button" className="button-ghost">
                  Historial
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "training" ? (
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="surface-outline rounded-[24px] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Entrenamiento
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Centro de práctica y preparación</h2>
              <p className="mt-3 text-sm leading-7 text-white/72">
                Aquí quedará el acceso a entrenamiento, checkrides y futuras habilitaciones,
                siempre dentro del mismo panel interno para que el dashboard se sienta como una cabina de control.
              </p>
            </div>

            <div className="surface-outline rounded-[24px] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Vista inicial
              </p>
              <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-white/76">
                Más adelante esta pestaña podrá mostrar cursos, pendientes y misiones de entrenamiento
                sin salir de esta misma ventana central.
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
  const [activeTab, setActiveTab] = useState<DashboardTabKey>("central");
  const [availableAircraft, setAvailableAircraft] = useState<AvailableAircraftOption[]>([]);
  const [availableItineraries, setAvailableItineraries] = useState<AvailableItineraryOption[]>([]);

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
    <div className="pw-container py-10 sm:py-14 lg:py-16">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/operations" className="button-primary py-3">
              Ir a operaciones
            </Link>
            <Link href="/profile" className="button-secondary py-3">
              Abrir perfil
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="glass-panel rounded-[30px] px-4 py-4 sm:px-5 lg:px-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10">
            {compactMetrics.map((item) => (
              <div
                key={item.label}
                className="flex min-h-[82px] flex-col items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.03] px-2 py-3 text-center"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/58">
                  {item.label}
                </span>
                <span className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">
                  <AnimatedMetricValue item={item} animateKey={animationSeed} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DashboardWorkspace
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        metrics={metrics}
        central={central}
        availableAircraft={availableAircraft}
        availableItineraries={availableItineraries}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen overflow-x-hidden">
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
