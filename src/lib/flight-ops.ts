import { supabase } from "@/lib/supabase/browser";
import type { PilotProfileRecord } from "@/lib/pilot-profile";
import { resolveSimbriefType } from "@/lib/simbrief";

export type FlightMode = "itinerary" | "charter" | "training" | "event";
export type FlightOperationStatus = "draft" | "reserved" | "dispatch_ready";

export type FlightOperationRecord = {
  reservationId: string | null;
  userId: string;
  itineraryId: string | null;
  aircraftId: string | null;
  flightMode: FlightMode;
  routeCode: string;
  flightNumber: string;
  origin: string;
  destination: string;
  aircraftCode: string;
  aircraftTypeCode?: string;
  aircraftName: string;
  aircraftTailNumber: string;
  aircraftVariantCode?: string;
  aircraftAddonProvider?: string;
  aircraftVariantLabel?: string;
  routeText: string;
  scheduledDeparture: string;
  remarks: string;
  status: FlightOperationStatus;
  createdAt: string;
  updatedAt: string;
};

export type FlightReadiness = {
  profileReady: boolean;
  simbriefReady: boolean;
  baseHubReady: boolean;
  reservationStarted: boolean;
  routeReady: boolean;
  aircraftReady: boolean;
  departureReady: boolean;
  canReserve: boolean;
  canPrepareDispatch: boolean;
  reservationComplete: boolean;
  dispatchPrepared: boolean;
  readyForAcars: boolean;
  completionPercent: number;
  flightStatusLabel: string;
  dispatchStatusLabel: string;
};

export type AvailableAircraftOption = {
  aircraft_id: string;
  tail_number: string;
  aircraft_code: string;
  aircraft_type_code?: string;
  aircraft_name: string;
  aircraft_variant_code?: string;
  addon_provider?: string;
  variant_name?: string;
  current_airport_icao: string;
  status: string;
  display_category?: string;
  display_status?: string;
  selectable?: boolean;
};

export type AvailableItineraryOption = {
  itinerary_id: string;
  itinerary_code: string;
  itinerary_name: string;
  flight_mode: FlightMode;
  origin_icao: string;
  destination_icao: string;
  origin_city?: string | null;
  destination_city?: string | null;
  aircraft_type_code: string | null;
  aircraft_type_name: string | null;
  compatible_aircraft_types?: string[];
  available_aircraft_count?: number;
  distance_nm?: number | null;
  route_group?: string | null;
  service_profile?: string | null;
  service_level?: string | null;
  origin_country?: string | null;
  destination_country?: string | null;
  scheduled_block_min?: number | null;
  expected_block_p50?: number | null;
  expected_block_p80?: number | null;
  buffer_departure_min_low?: number | null;
  buffer_departure_min_high?: number | null;
  buffer_arrival_min_low?: number | null;
  buffer_arrival_min_high?: number | null;
  flight_number?: string | null;
  flight_designator?: string | null;
};

export type DbFlightReservationRow = {
  id: string;
  airline_id: string | null;
  pilot_id: string;
  pilot_callsign?: string | null;
  aircraft_id: string | null;
  aircraft_registration?: string | null;
  aircraft_type_code?: string | null;
  aircraft_variant_code?: string | null;
  addon_provider?: string | null;
  variant_name?: string | null;
  itinerary_id: string | null;
  route_code?: string | null;
  flight_mode: FlightMode;
  flight_number: string;
  origin_icao: string;
  destination_icao: string;
  origin?: string;
  destination?: string;
  scheduled_departure: string | null;
  route_text: string | null;
  routeText?: string | null;
  routeCode?: string | null;
  remarks: string | null;
  status: FlightOperationStatus | "dispatched" | "in_progress" | "completed" | "cancelled" | "in_flight";
  created_at: string;
  updated_at: string;
};

export type DispatchPackageRow = {
  reservation_id: string;
  simbrief_username: string | null;
  status: "pending" | "prepared" | "released" | "cancelled";
  prepared_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
};

export const flightModeOptions: Array<{ value: FlightMode; label: string }> = [
  { value: "itinerary", label: "Itinerary" },
  { value: "charter", label: "Charter" },
  { value: "training", label: "Training" },
  { value: "event", label: "Event" },
];

function mapDbFlightModeToClient(value: unknown): FlightMode {
  const normalized = normalizeUpper(typeof value === "string" ? value : "");

  if (normalized === "CHARTER") return "charter";
  if (normalized === "TRAINING") return "training";
  if (normalized === "EVENT") return "event";
  return "itinerary";
}

function mapClientFlightModeToDb(value: FlightMode) {
  switch (value) {
    case "charter":
      return "CHARTER";
    case "training":
      return "TRAINING";
    case "event":
      return "EVENT";
    case "itinerary":
    default:
      return "CAREER";
  }
}


type GenericRecord = Record<string, unknown>;

function normalizeUpper(value: string) {
  return value.trim().toUpperCase();
}

function getProfileAirport(profile?: PilotProfileRecord | null) {
  return normalizeUpper(profile?.current_airport_icao ?? profile?.base_hub ?? "SCEL");
}

function toFlightMode(value: unknown): FlightMode {
  return mapDbFlightModeToClient(value);
}

function normalizeAircraftDisplayName(code: string) {
  const normalized = code.replace(/_/g, " ").replace(/-/g, " ");
  return normalized;
}

function buildAircraftVariantLabel(record: {
  aircraft_variant_code?: string | null;
  addon_provider?: string | null;
  variant_name?: string | null;
}) {
  return [
    record.variant_name?.trim(),
    record.aircraft_variant_code?.trim(),
    record.addon_provider?.trim(),
  ]
    .filter((item): item is string => Boolean(item))
    .join(" · ");
}

function getDisplayCategoryFromCode(code: string) {
  const normalized = normalizeUpper(code);

  if (["C208", "TBM9", "TBM8"].includes(normalized)) {
    return "Monomotor turbohélice";
  }

  if (["BE58"].includes(normalized)) {
    return "Bimotor pistón";
  }

  if (["B350", "AT76", "ATR72"].includes(normalized)) {
    return "Bimotor turbohélice";
  }

  if (normalized.startsWith("E17") || normalized.startsWith("E19")) {
    return "Jet regional";
  }

  if (
    normalized.startsWith("A3") ||
    normalized.startsWith("A2") ||
    normalized.startsWith("B73") ||
    normalized.startsWith("MD8")
  ) {
    return "Narrowbody";
  }

  if (
    normalized.startsWith("B77") ||
    normalized.startsWith("B78") ||
    normalized.startsWith("A33") ||
    normalized.startsWith("A35")
  ) {
    return "Widebody";
  }

  return "Operación general";
}

function normalizeRankCode(value: string | null | undefined) {
  const normalized = normalizeUpper(value ?? "");
  return normalized || "CADET";
}

function parseCompatibleAircraftTypes(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [] as string[];
}

function normalizeOperationalToken(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function parseOperationalTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => parseOperationalTokens(item))
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[;,|/]/)
      .map((item) => normalizeOperationalToken(item))
      .filter(Boolean);
  }

  return [];
}

function buildOperationalTokenSet(...values: unknown[]) {
  return new Set(
    values.flatMap((value) => parseOperationalTokens(value))
  );
}

function collectRouteRequirementTokens(
  row: GenericRecord,
  keywords: string[]
) {
  const tokens = new Set<string>();

  for (const [rawKey, value] of Object.entries(row)) {
    const key = rawKey.trim().toLowerCase();
    if (!keywords.some((keyword) => key.includes(keyword))) {
      continue;
    }

    if (
      !(
        key.includes("required") ||
        key.includes("allowed") ||
        key.includes("eligible") ||
        key.endsWith("_codes") ||
        key.endsWith("_code") ||
        key.endsWith("_tags") ||
        key.endsWith("_list")
      )
    ) {
      continue;
    }

    for (const token of parseOperationalTokens(value)) {
      tokens.add(token);
    }
  }

  return Array.from(tokens);
}

function routeMatchesOperationalRequirements(
  row: GenericRecord,
  pilotQualifications: Set<string>,
  pilotCertifications: Set<string>
) {
  const requiredQualifications = collectRouteRequirementTokens(row, [
    "qualification",
    "habilit",
    "rating",
  ]);
  const requiredCertifications = collectRouteRequirementTokens(row, [
    "certification",
    "certif",
    "checkout",
  ]);

  const qualificationsOk =
    requiredQualifications.length === 0 ||
    requiredQualifications.every((token) => pilotQualifications.has(token));
  const certificationsOk =
    requiredCertifications.length === 0 ||
    requiredCertifications.every((token) => pilotCertifications.has(token));

  return qualificationsOk && certificationsOk;
}

const FLIGHT_NUMBER_PAIR_OVERRIDES: Record<string, number> = {
  "SCEL-SCTE": 120,
};

function buildFlightPairKey(origin: string, destination: string) {
  return [normalizeUpper(origin), normalizeUpper(destination)].sort().join("-");
}

function hashFlightPairToEvenBase(pairKey: string) {
  const override = FLIGHT_NUMBER_PAIR_OVERRIDES[pairKey];
  if (override) return override;

  const hash = pairKey
    .split("")
    .reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 3), 0);

  const bucket = hash % 400;
  return 200 + bucket * 2;
}

export function getOperationalFlightNumber(origin: string, destination: string) {
  const normalizedOrigin = normalizeUpper(origin);
  const normalizedDestination = normalizeUpper(destination);

  if (!normalizedOrigin || !normalizedDestination || normalizedOrigin === normalizedDestination) {
    return "";
  }

  const pair = [normalizedOrigin, normalizedDestination].sort();
  const pairKey = buildFlightPairKey(normalizedOrigin, normalizedDestination);
  const evenBase = hashFlightPairToEvenBase(pairKey);
  const sequence = normalizedOrigin === pair[0] ? evenBase : evenBase + 1;

  return `PWG${String(sequence).padStart(3, "0")}`;
}

function normalizeFlightNumber(
  flightNumber: string | null | undefined,
  origin: string,
  destination: string
) {
  const normalizedFlightNumber = flightNumber?.trim().toUpperCase() ?? "";

  if (normalizedFlightNumber && !normalizedFlightNumber.includes("-")) {
    return normalizedFlightNumber;
  }

  return getOperationalFlightNumber(origin, destination);
}

function extractOperationalFlightDigits(value: string | null | undefined) {
  const normalized = normalizeUpper(value ?? "");
  if (!normalized || normalized.includes("-")) {
    return "";
  }

  const digits = normalized.match(/\d{1,4}$/)?.[0] ?? "";
  return digits ? digits.padStart(3, "0") : "";
}

function normalizeItineraryFlightIdentity(
  flightNumber: string | number | null | undefined,
  flightDesignator: string | null | undefined,
  origin: string,
  destination: string
) {
  const normalizedNumber =
    typeof flightNumber === "number"
      ? String(flightNumber)
      : typeof flightNumber === "string"
        ? flightNumber
        : "";
  const normalizedDesignator = typeof flightDesignator === "string" ? flightDesignator : "";
  const generatedDesignator = getOperationalFlightNumber(origin, destination);
  const generatedDigits = extractOperationalFlightDigits(generatedDesignator);

  const numberDigits = extractOperationalFlightDigits(normalizedNumber);
  const designatorDigits = extractOperationalFlightDigits(normalizedDesignator);
  const resolvedDigits = numberDigits || designatorDigits || generatedDigits || null;
  const resolvedDesignator = (() => {
    const cleanDesignator = normalizeUpper(normalizedDesignator);
    if (cleanDesignator && !cleanDesignator.includes("-")) {
      return cleanDesignator;
    }

    const cleanNumber = normalizeUpper(normalizedNumber);
    if (/^[A-Z]{2,4}\d{1,4}$/.test(cleanNumber)) {
      return cleanNumber;
    }

    if (resolvedDigits) {
      return `PWG${resolvedDigits}`;
    }

    return generatedDesignator || null;
  })();

  return {
    flightNumber: resolvedDigits,
    flightDesignator: resolvedDesignator,
  };
}

function mapLegacyReservationFromRpc(
  row: GenericRecord,
  profile: PilotProfileRecord
): DbFlightReservationRow {
  const statusValue = typeof row.status === "string" ? row.status : "reserved";
  const mappedStatus: DbFlightReservationRow["status"] =
    statusValue === "dispatched"
      ? "dispatch_ready"
      : statusValue === "in_flight"
        ? "in_progress"
        : statusValue === "completed"
          ? "completed"
          : statusValue === "cancelled"
            ? "cancelled"
            : "reserved";

  const createdAt =
    typeof row.created_at === "string"
      ? row.created_at
      : new Date().toISOString();
  const updatedAt =
    typeof row.updated_at === "string"
      ? row.updated_at
      : createdAt;

  return {
    id: typeof row.reservation_id === "string" ? row.reservation_id : String(row.id ?? ""),
    airline_id: profile.airline_id ?? null,
    pilot_id: profile.id,
    aircraft_id: typeof row.aircraft_id === "string" ? row.aircraft_id : null,
    aircraft_registration:
      typeof row.aircraft_registration === "string"
        ? row.aircraft_registration
        : typeof row.registration === "string"
          ? row.registration
          : null,
    aircraft_type_code:
      typeof row.aircraft_type_code === "string"
        ? row.aircraft_type_code
        : typeof row.aircraft_code === "string"
          ? row.aircraft_code
          : null,
    aircraft_variant_code:
      typeof row.aircraft_variant_code === "string"
        ? row.aircraft_variant_code
        : typeof row.variant_code === "string"
          ? row.variant_code
          : null,
    addon_provider:
      typeof row.addon_provider === "string" ? row.addon_provider : null,
    variant_name:
      typeof row.variant_name === "string"
        ? row.variant_name
        : typeof row.variant_label === "string"
          ? row.variant_label
          : null,
    itinerary_id:
      typeof row.route_id === "string"
        ? row.route_id
        : typeof row.route_code === "string"
          ? row.route_code
          : null,
    route_code: typeof row.route_code === "string" ? row.route_code : null,
    flight_mode: toFlightMode(row.flight_mode_code),
    flight_number:
      typeof row.flight_number === "string"
        ? row.flight_number
        : typeof row.flight_designator === "string"
          ? row.flight_designator
          : typeof row.route_code === "string"
            ? row.route_code
            : "",
    origin_icao:
      typeof row.origin_ident === "string"
        ? row.origin_ident
        : typeof row.origin_icao === "string"
          ? row.origin_icao
          : getProfileAirport(profile),
    destination_icao:
      typeof row.destination_ident === "string"
        ? row.destination_ident
        : typeof row.destination_icao === "string"
          ? row.destination_icao
          : "",
    scheduled_departure:
      typeof row.scheduled_departure === "string"
        ? row.scheduled_departure
        : null,
    route_text: typeof row.route_text === "string" ? row.route_text : null,
    remarks: typeof row.remarks === "string" ? row.remarks : null,
    status: mappedStatus,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function toPersistedReservationStatus(status: FlightOperationStatus) {
  if (status === "dispatch_ready") {
    return "dispatched";
  }

  return status;
}

async function updateReservationStatusLegacy(
  reservationId: string,
  status: FlightOperationStatus
) {
  const persistedStatus = toPersistedReservationStatus(status);
  const { data, error } = await supabase
    .from("flight_reservations")
    .update({
      status: persistedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as DbFlightReservationRow;
}

function extractErrorMessage(e: unknown): string {
  if (!e) return "";
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as Record<string, unknown>).message;
    if (typeof m === "string") return m;
  }
  try { return JSON.stringify(e); } catch { return String(e); }
}

function buildDispatchPersistenceError(
  updateError: unknown,
  packageError: unknown
) {
  const updateMessage = extractErrorMessage(updateError);
  const packageMessage = extractErrorMessage(packageError);

  if (updateMessage && packageMessage) {
    return new Error(
      `No se pudo emitir el despacho final. Estado reserva: ${updateMessage} | Dispatch package: ${packageMessage}`
    );
  }

  if (updateMessage) {
    return new Error(`No se pudo actualizar la reserva a dispatched: ${updateMessage}`);
  }

  if (packageMessage) {
    return new Error(`No se pudo crear el dispatch package: ${packageMessage}`);
  }

  return new Error("No se pudo emitir el despacho final a Supabase.");
}

export function getDefaultFlightOperation(
  userId: string,
  profile?: PilotProfileRecord | null
): FlightOperationRecord {
  const now = new Date().toISOString();
  const origin = getProfileAirport(profile);

  return {
    reservationId: null,
    userId,
    itineraryId: null,
    aircraftId: null,
    flightMode: "itinerary",
    routeCode: "",
    flightNumber: "",
    origin,
    destination: "",
    aircraftCode: "",
    aircraftName: "",
    aircraftTailNumber: "",
    aircraftVariantCode: "",
    aircraftAddonProvider: "",
    aircraftVariantLabel: "",
    routeText: "",
    scheduledDeparture: "",
    remarks: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function mapReservationToOperation(
  row: DbFlightReservationRow,
  profile?: PilotProfileRecord | null,
  aircraftOptions: AvailableAircraftOption[] = [],
  itineraryOptions: AvailableItineraryOption[] = []
): FlightOperationRecord {
  const matchedAircraft = aircraftOptions.find(
    (item) => item.aircraft_id === row.aircraft_id
  );
  const matchedItinerary = itineraryOptions.find(
    (item) => item.itinerary_id === row.itinerary_id || item.itinerary_code === row.flight_number
  );

  const origin = normalizeUpper(
    row.origin_icao || profile?.current_airport_icao || profile?.base_hub || "SCEL"
  );
  const destination = normalizeUpper(row.destination_icao || "");

  return {
    reservationId: row.id,
    userId: row.pilot_id,
    itineraryId: row.itinerary_id,
    aircraftId: row.aircraft_id,
    flightMode: row.flight_mode,
    routeCode:
      matchedItinerary?.itinerary_code ?? row.route_code ??
      (typeof row.flight_number === "string" && row.flight_number.includes("PWG-")
        ? row.flight_number
        : ""),
    flightNumber: normalizeFlightNumber(row.flight_number, origin, destination),
    origin,
    destination,
    aircraftCode:
      matchedAircraft?.aircraft_code ?? row.aircraft_type_code ?? matchedItinerary?.aircraft_type_code ?? "",
    aircraftName:
      matchedAircraft?.aircraft_name ??
      (row.aircraft_type_code
        ? normalizeAircraftDisplayName(row.aircraft_type_code)
        : matchedItinerary?.aircraft_type_name ?? ""),
    aircraftTailNumber: matchedAircraft?.tail_number ?? row.aircraft_registration ?? "",
    aircraftVariantCode:
      matchedAircraft?.aircraft_variant_code ?? row.aircraft_variant_code ?? "",
    aircraftAddonProvider:
      matchedAircraft?.addon_provider ?? row.addon_provider ?? "",
    aircraftVariantLabel:
      buildAircraftVariantLabel({
        aircraft_variant_code:
          matchedAircraft?.aircraft_variant_code ?? row.aircraft_variant_code ?? "",
        addon_provider:
          matchedAircraft?.addon_provider ?? row.addon_provider ?? "",
        variant_name:
          matchedAircraft?.variant_name ?? row.variant_name ?? "",
      }) || "",
    routeText: row.route_text ?? "",
    scheduledDeparture: row.scheduled_departure
      ? toDateTimeLocalValue(row.scheduled_departure)
      : "",
    remarks: row.remarks ?? "",
    status: (
      row.status === "in_progress" || row.status === "completed" || row.status === "dispatched"
        ? "dispatch_ready"
        : row.status === "cancelled" || row.status === "in_flight"
          ? "draft"
          : (row.status as FlightOperationStatus)
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function applyItineraryToOperation(
  current: FlightOperationRecord,
  itinerary: AvailableItineraryOption
): FlightOperationRecord {
  const operationalFlightNumber =
    itinerary.flight_designator?.trim() ||
    itinerary.flight_number?.trim() ||
    getOperationalFlightNumber(itinerary.origin_icao, itinerary.destination_icao);

  return {
    ...current,
    itineraryId: itinerary.itinerary_id,
    flightMode: itinerary.flight_mode,
    routeCode: itinerary.itinerary_code,
    flightNumber: operationalFlightNumber,
    origin: itinerary.origin_icao,
    destination: itinerary.destination_icao,
    aircraftCode: itinerary.aircraft_type_code ?? current.aircraftCode,
    aircraftName: itinerary.aircraft_type_name ?? current.aircraftName,
    aircraftVariantCode: current.aircraftVariantCode,
    aircraftAddonProvider: current.aircraftAddonProvider,
    aircraftVariantLabel: current.aircraftVariantLabel,
    updatedAt: new Date().toISOString(),
  };
}

export function applyAircraftToOperation(
  current: FlightOperationRecord,
  aircraft: AvailableAircraftOption
): FlightOperationRecord {
  return {
    ...current,
    aircraftId: aircraft.aircraft_id,
    aircraftCode: aircraft.aircraft_code,
    aircraftName: aircraft.aircraft_name,
    aircraftTailNumber: aircraft.tail_number,
    aircraftVariantCode: aircraft.aircraft_variant_code ?? "",
    aircraftAddonProvider: aircraft.addon_provider ?? "",
    aircraftVariantLabel: buildAircraftVariantLabel(aircraft),
    updatedAt: new Date().toISOString(),
  };
}

export function computeFlightReadiness(
  profile: PilotProfileRecord | null,
  operation: FlightOperationRecord | null
): FlightReadiness {
  const normalizedProfile = {
    firstName: profile?.first_name?.trim() ?? "",
    lastName: profile?.last_name?.trim() ?? "",
    callsign: profile?.callsign?.trim() ?? "",
    baseHub: profile?.base_hub?.trim() ?? "",
    simbrief: profile?.simbrief_username?.trim() ?? "",
  };

  const profileReady = Boolean(
    normalizedProfile.firstName &&
      normalizedProfile.lastName &&
      normalizedProfile.callsign
  );

  const simbriefReady = Boolean(normalizedProfile.simbrief);
  const baseHubReady = Boolean(normalizedProfile.baseHub);

  const routeReady = Boolean(
    operation?.flightNumber?.trim() &&
      operation?.origin?.trim() &&
      operation?.destination?.trim() &&
      operation.origin.trim() !== operation.destination.trim()
  );

  const aircraftReady = Boolean(
    operation?.aircraftId?.trim() &&
      operation?.aircraftCode?.trim() &&
      operation?.aircraftName?.trim()
  );

  const departureReady = true;

  const reservationStarted = Boolean(
    operation?.flightNumber?.trim() ||
      operation?.destination?.trim() ||
      operation?.aircraftId?.trim()
  );

  const canReserve = routeReady && aircraftReady;

  const reservationComplete =
    operation?.status === "reserved" || operation?.status === "dispatch_ready";

  const canPrepareDispatch =
    reservationComplete && profileReady && simbriefReady && baseHubReady;

  const dispatchPrepared = operation?.status === "dispatch_ready";
  const readyForAcars = dispatchPrepared;

  const completedSteps = [
    profileReady,
    simbriefReady,
    baseHubReady,
    reservationComplete,
    dispatchPrepared,
  ].filter(Boolean).length;

  const completionPercent = Math.round((completedSteps / 5) * 100);

  let flightStatusLabel = "Sin reserva activa";

  if (operation?.status === "draft") {
    flightStatusLabel = "Reserva en borrador";
  }

  if (operation?.status === "reserved") {
    flightStatusLabel = "Vuelo reservado";
  }

  if (operation?.status === "dispatch_ready") {
    flightStatusLabel = "Listo para despacho";
  }

  let dispatchStatusLabel = "Pendiente";

  if (canPrepareDispatch && !dispatchPrepared) {
    dispatchStatusLabel = "Puede prepararse";
  }

  if (dispatchPrepared) {
    dispatchStatusLabel = "Preparado";
  }

  return {
    profileReady,
    simbriefReady,
    baseHubReady,
    reservationStarted,
    routeReady,
    aircraftReady,
    departureReady,
    canReserve,
    canPrepareDispatch,
    reservationComplete,
    dispatchPrepared,
    readyForAcars,
    completionPercent,
    flightStatusLabel,
    dispatchStatusLabel,
  };
}

export function getDispatchBlockingReasons(
  profile: PilotProfileRecord | null,
  operation: FlightOperationRecord | null
) {
  const readiness = computeFlightReadiness(profile, operation);
  const reasons: string[] = [];

  if (!readiness.profileReady) {
    reasons.push("Completa nombre, apellido y callsign en tu perfil.");
  }

  if (!readiness.baseHubReady) {
    reasons.push("Selecciona un hub base operativo.");
  }

  if (!readiness.simbriefReady) {
    reasons.push("Ingresa tu usuario SimBrief.");
  }

  if (!readiness.reservationComplete) {
    reasons.push("Confirma primero la reserva base del vuelo.");
  }

  return reasons;
}

// Categorías permitidas por service_profile de ruta.
// Replicado desde la lógica de la RPC create_flight_reservation en Supabase.
const ROUTE_PROFILE_ALLOWED_CATEGORIES: Record<string, string[]> = {
  feeder:    ["single_turboprop", "twin_turboprop", "piston_twin", "regional_jet"],
  regional:  ["twin_turboprop", "regional_jet", "narrowbody_jet"],
  trunk:     ["narrowbody_jet", "regional_jet"],  // NOT widebody_jet - RPC rejects it
  longhaul:  ["widebody_jet", "narrowbody_jet"],   //洲际航线接受宽体和窄体
  heavy:     ["widebody_jet", "narrowbody_jet"],  // SCEL-EGLL, SCEL-KJFK, etc.
  cargo:     ["single_turboprop", "twin_turboprop", "narrowbody_jet", "widebody_jet"],
};

export function isAircraftCompatibleWithRoute(
  aircraftTypeCode: string | null | undefined,
  routeServiceProfile: string | null | undefined
): boolean {
  if (!routeServiceProfile || !aircraftTypeCode) return true; // sin datos: no filtrar
  const allowed = ROUTE_PROFILE_ALLOWED_CATEGORIES[routeServiceProfile.toLowerCase()];
  if (!allowed) return true; // profile desconocido: no filtrar
  // Buscamos la categoría del tipo en la lista estática de aircraft_types
  const cat = AIRCRAFT_TYPE_CATEGORY[aircraftTypeCode.toUpperCase()] ?? null;
  if (!cat) return true; // tipo desconocido: no filtrar
  return allowed.includes(cat);
}

// Mapa aircraft_type_code → category (sincronizado con tabla aircraft_types de Supabase)
const AIRCRAFT_TYPE_CATEGORY: Record<string, string> = {
  C208_MSFS: "single_turboprop", C208_BLACKSQUARE: "single_turboprop",
  TBM9_MSFS: "single_turboprop", TBM8_BLACKSQUARE: "single_turboprop",
  B350_MSFS: "twin_turboprop",   B350_BLACKSQUARE: "twin_turboprop",  ATR72_MSFS: "twin_turboprop",
  BE58_MSFS: "piston_twin",      BE58_BLACKSQUARE: "piston_twin",     BE58_BS_PRO: "piston_twin",
  E175_FLIGHTSIM: "regional_jet", E190_FLIGHTSIM: "regional_jet",     E195_FLIGHTSIM: "regional_jet",
  A319_FENIX: "narrowbody_jet",  A319_LATINVFR: "narrowbody_jet",
  A320_FENIX: "narrowbody_jet",  A320_LATINVFR: "narrowbody_jet",     A20N_FBW: "narrowbody_jet",
  A321_FENIX: "narrowbody_jet",  A21N_LATINVFR: "narrowbody_jet",
  B736_PMDG: "narrowbody_jet",   B737_PMDG: "narrowbody_jet",
  B738_PMDG: "narrowbody_jet",   B739_PMDG: "narrowbody_jet",         B38M_IFLY: "narrowbody_jet",
  MD82_MADDOG: "narrowbody_jet", MD83_MADDOG: "narrowbody_jet",        MD88_MADDOG: "narrowbody_jet",
  A339_HEADWIND: "widebody_jet", A359_INIBUILDS: "widebody_jet",
  B772_PMDG: "widebody_jet",     B77W_PMDG: "widebody_jet",
  B789_HORIZONS: "widebody_jet", B78X_MSFS: "widebody_jet",
};

export async function listAvailableAircraft(profile: PilotProfileRecord) {
  const airport = getProfileAirport(profile);

  const mapDisplayRows = (rows: GenericRecord[]) =>
    rows.map((row) => {
      const selectable =
        typeof row.selectable === "boolean"
          ? row.selectable
          : typeof row.display_status === "string"
            ? row.display_status.trim().toLowerCase() === "disponible"
            : typeof row.status === "string"
              ? row.status.trim().toLowerCase() === "available"
              : false;

      const aircraftCode = resolveSimbriefType(
        typeof row.icao_code === "string"
          ? row.icao_code
          : typeof row.aircraft_model_code === "string"
            ? row.aircraft_model_code
            : typeof row.airframe_code === "string"
              ? row.airframe_code
              : typeof row.aircraft_type_code === "string"
                ? row.aircraft_type_code
                : typeof row.aircraft_code === "string"
                  ? row.aircraft_code
                  : ""
      );

      const aircraftName =
        typeof row.display_name === "string"
          ? row.display_name
          : typeof row.aircraft_name === "string"
            ? row.aircraft_name
            : normalizeAircraftDisplayName(aircraftCode);

      return {
        aircraft_id:
          typeof row.aircraft_id === "string"
            ? row.aircraft_id
            : typeof row.id === "string"
              ? row.id
              : String(row.id ?? ""),
        tail_number:
          typeof row.registration === "string"
            ? row.registration
            : typeof row.tail_number === "string"
              ? row.tail_number
              : "",
        aircraft_code: aircraftCode,
        aircraft_name: aircraftName,
        aircraft_variant_code:
          typeof row.aircraft_variant_code === "string"
            ? row.aircraft_variant_code
            : typeof row.variant_code === "string"
              ? row.variant_code
              : "",
        addon_provider:
          typeof row.addon_provider === "string" ? row.addon_provider : "",
        variant_name:
          typeof row.variant_name === "string"
            ? row.variant_name
            : typeof row.variant_label === "string"
              ? row.variant_label
              : "",
        current_airport_icao:
          typeof row.current_airport_code === "string"
            ? row.current_airport_code
            : typeof row.current_airport_icao === "string"
              ? row.current_airport_icao
              : airport,
        status: selectable ? "available" : "unavailable",
        display_category:
          typeof row.display_category === "string"
            ? row.display_category
            : getDisplayCategoryFromCode(aircraftCode),
        display_status: selectable ? "Disponible" : "No disponible",
        selectable,
      } satisfies AvailableAircraftOption;
    });

  try {
    const { data, error } = await supabase.rpc("pw_get_available_aircraft_display", {
      p_callsign: profile.callsign,
    });

    if (!error) {
      return mapDisplayRows((data ?? []) as GenericRecord[]);
    }
  } catch {
    // fallback chain below keeps legacy behavior when the new RPC is not available
  }

  try {
    const { data, error } = await supabase
      .from("aircraft")
      .select(
        "id, registration, aircraft_type_code, aircraft_model_code, aircraft_variant_code, addon_provider, variant_name, aircraft_display_name, current_airport_code, status"
      )
      .eq("current_airport_code", airport)
      .eq("status", "available")
      .eq("is_active", true)
      .order("aircraft_model_code")
      .order("addon_provider")
      .order("registration");

    if (error) {
      throw error;
    }

    return ((data ?? []) as GenericRecord[]).map((row) => {
      const isAvailable =
        typeof row.status === "string" ? row.status.trim().toLowerCase() === "available" : false;

      return {
        aircraft_id: String(row.id ?? ""),
        tail_number: typeof row.registration === "string" ? row.registration : "",
        aircraft_code: resolveSimbriefType(
          typeof row.aircraft_type_code === "string" ? row.aircraft_type_code : ""
        ),
        aircraft_name:
          typeof row.aircraft_display_name === "string" && row.aircraft_display_name
            ? row.aircraft_display_name
            : normalizeAircraftDisplayName(
                typeof row.aircraft_model_code === "string" && row.aircraft_model_code
                  ? row.aircraft_model_code
                  : typeof row.aircraft_type_code === "string"
                    ? row.aircraft_type_code
                    : ""
              ),
        aircraft_type_code:
          typeof row.aircraft_type_code === "string" ? row.aircraft_type_code : "",
        aircraft_variant_code:
          typeof row.aircraft_variant_code === "string"
            ? row.aircraft_variant_code
            : typeof row.aircraft_model_code === "string"
              ? row.aircraft_model_code
              : "",
        addon_provider:
          typeof row.addon_provider === "string" ? row.addon_provider : "",
        variant_name:
          typeof row.variant_name === "string" && row.variant_name
            ? row.variant_name
            : typeof row.addon_provider === "string" && row.addon_provider
              ? `${typeof row.aircraft_model_code === "string" ? row.aircraft_model_code : ""} · ${row.addon_provider}`
              : "",
        current_airport_icao:
          typeof row.current_airport_code === "string" ? row.current_airport_code : airport,
        status: typeof row.status === "string" ? row.status : "available",
        display_status: isAvailable ? "Disponible" : "No disponible",
        selectable: isAvailable,
        display_category: getDisplayCategoryFromCode(
          typeof row.aircraft_type_code === "string" ? row.aircraft_type_code : ""
        ),
      } satisfies AvailableAircraftOption;
    });
  } catch (tableError) {
    const rpcAttempts: Array<Record<string, unknown>> = [
      { p_callsign: profile.callsign, p_route_code: null },
      { p_callsign: profile.callsign },
      { p_pilot_id: profile.id },
    ];

    for (const params of rpcAttempts) {
      const { data, error } = await supabase.rpc("get_available_aircraft_for_pilot", params);
      if (!error) {
        return ((data ?? []) as GenericRecord[]).map((row) => {
          const isAvailable =
            typeof row.status === "string" ? row.status.trim().toLowerCase() === "available" : false;

          return {
            aircraft_id:
              typeof row.aircraft_id === "string" ? row.aircraft_id : String(row.id ?? ""),
            tail_number:
              typeof row.registration === "string"
                ? row.registration
                : typeof row.tail_number === "string"
                  ? row.tail_number
                  : "",
            aircraft_code: resolveSimbriefType(
              typeof row.aircraft_type_code === "string"
                ? row.aircraft_type_code
                : typeof row.aircraft_code === "string"
                  ? row.aircraft_code
                  : ""
            ),
            aircraft_name:
              typeof row.aircraft_name === "string"
                ? row.aircraft_name
                : normalizeAircraftDisplayName(
                    typeof row.aircraft_type_code === "string"
                      ? row.aircraft_type_code
                      : typeof row.aircraft_code === "string"
                        ? row.aircraft_code
                        : ""
                  ),
            aircraft_variant_code:
              typeof row.aircraft_variant_code === "string"
                ? row.aircraft_variant_code
                : typeof row.variant_code === "string"
                  ? row.variant_code
                  : "",
            addon_provider:
              typeof row.addon_provider === "string" ? row.addon_provider : "",
            variant_name:
              typeof row.variant_name === "string"
                ? row.variant_name
                : typeof row.variant_label === "string"
                  ? row.variant_label
                  : "",
            current_airport_icao:
              typeof row.current_airport_icao === "string"
                ? row.current_airport_icao
                : typeof row.current_airport_code === "string"
                  ? row.current_airport_code
                  : airport,
            status: typeof row.status === "string" ? row.status : "available",
            display_status: isAvailable ? "Disponible" : "No disponible",
            selectable: isAvailable,
            display_category:
              typeof row.display_category === "string"
                ? row.display_category
                : getDisplayCategoryFromCode(
                    typeof row.aircraft_type_code === "string"
                      ? row.aircraft_type_code
                      : typeof row.aircraft_code === "string"
                        ? row.aircraft_code
                        : ""
                  ),
          } satisfies AvailableAircraftOption;
        });
      }
    }

    throw tableError instanceof Error ? tableError : new Error("No se pudo obtener aeronaves disponibles.");
  }
}

export async function listAvailableItineraries(profile: PilotProfileRecord) {
  const airport = getProfileAirport(profile);
  const rankCode = normalizeRankCode(profile.rank_code ?? profile.career_rank_code);
  const rawProfile = profile as PilotProfileRecord & {
    qualifications?: string | null;
    certifications?: string | null;
  };
  const pilotQualifications = buildOperationalTokenSet(
    profile.active_qualifications,
    rawProfile.qualifications
  );
  const pilotCertifications = buildOperationalTokenSet(
    profile.active_certifications,
    rawProfile.certifications
  );

  const mapItineraryRows = (rows: GenericRecord[]) =>
    rows
      .map((row) => {
        const compatibleAircraftTypes = parseCompatibleAircraftTypes(row.compatible_aircraft_types);
        const origin = typeof row.origin_ident === "string" ? row.origin_ident : typeof row.origin_icao === "string" ? row.origin_icao : "";
        const destination = typeof row.destination_ident === "string" ? row.destination_ident : typeof row.destination_icao === "string" ? row.destination_icao : "";
        const routeCode = typeof row.route_code === "string" ? row.route_code : "";
        const destinationCity = typeof row.destination_city === "string" ? row.destination_city : destination;
        const availableCount = typeof row.available_aircraft_count === "number" ? row.available_aircraft_count : Number(row.available_aircraft_count ?? compatibleAircraftTypes.length ?? 0);
        const normalizedFlightIdentity = normalizeItineraryFlightIdentity(
          typeof row.flight_number === "string" || typeof row.flight_number === "number" ? row.flight_number : null,
          typeof row.flight_designator === "string" ? row.flight_designator : null,
          origin,
          destination
        );

        if (!routeCode || !origin || !destination) return null;
        if (!routeMatchesOperationalRequirements(row, pilotQualifications, pilotCertifications)) return null;

        return {
          itinerary_id: typeof row.route_id === "string" ? row.route_id : routeCode,
          itinerary_code: routeCode,
          itinerary_name: typeof row.route_name === "string" ? row.route_name : `${origin} → ${destinationCity}`,
          flight_mode: "itinerary" as FlightMode,
          origin_icao: origin,
          destination_icao: destination,
          origin_city: typeof row.origin_city === "string" ? row.origin_city : null,
          destination_city: typeof row.destination_city === "string" ? row.destination_city : null,
          aircraft_type_code: compatibleAircraftTypes.length === 1 ? compatibleAircraftTypes[0] : null,
          aircraft_type_name: compatibleAircraftTypes.length === 1 ? normalizeAircraftDisplayName(compatibleAircraftTypes[0]) : compatibleAircraftTypes.length > 1 ? "Multi-fleet" : null,
          compatible_aircraft_types: compatibleAircraftTypes,
          available_aircraft_count: Number.isFinite(availableCount) ? availableCount : 0,
          distance_nm: typeof row.distance_nm === "number" ? row.distance_nm : Number(row.distance_nm ?? NaN),
          route_group: typeof row.route_group === "string" ? row.route_group : null,
          service_profile: typeof row.service_profile === "string" ? row.service_profile : null,
          service_level: typeof row.service_level === "string" ? row.service_level : null,
          origin_country: typeof row.origin_country === "string" ? row.origin_country : null,
          destination_country: typeof row.destination_country === "string" ? row.destination_country : null,
          scheduled_block_min: typeof row.scheduled_block_min === "number" ? row.scheduled_block_min : Number(row.scheduled_block_min ?? NaN),
          expected_block_p50: typeof row.expected_block_p50 === "number" ? row.expected_block_p50 : Number(row.expected_block_p50 ?? NaN),
          expected_block_p80: typeof row.expected_block_p80 === "number" ? row.expected_block_p80 : Number(row.expected_block_p80 ?? NaN),
          buffer_departure_min_low: typeof row.buffer_departure_min_low === "number" ? row.buffer_departure_min_low : Number(row.buffer_departure_min_low ?? NaN),
          buffer_departure_min_high: typeof row.buffer_departure_min_high === "number" ? row.buffer_departure_min_high : Number(row.buffer_departure_min_high ?? NaN),
          buffer_arrival_min_low: typeof row.buffer_arrival_min_low === "number" ? row.buffer_arrival_min_low : Number(row.buffer_arrival_min_low ?? NaN),
          buffer_arrival_min_high: typeof row.buffer_arrival_min_high === "number" ? row.buffer_arrival_min_high : Number(row.buffer_arrival_min_high ?? NaN),
          flight_number: normalizedFlightIdentity.flightNumber,
          flight_designator: normalizedFlightIdentity.flightDesignator,
        } satisfies AvailableItineraryOption;
      })
      .filter(Boolean) as AvailableItineraryOption[];

  for (const params of [{ p_callsign: profile.callsign }, { p_pilot_id: profile.id }] as Array<Record<string, unknown>>) {
    const { data, error } = await supabase.rpc("get_available_itineraries_for_pilot", params);
    if (!error) {
      return mapItineraryRows((data ?? []) as GenericRecord[]);
    }
  }

  const [{ data: routes, error: routesError }, { data: routeAircraft, error: routeAircraftError }, { data: rankPermissions, error: rankPermissionsError }, { data: aircraft, error: aircraftError }] =
    await Promise.all([
      supabase
        .from("network_routes")
        .select("*")
        .eq("origin_ident", airport)
        .eq("is_active", true)
        .order("priority")
        .order("route_code"),
      supabase.from("network_route_aircraft").select("route_id, aircraft_type_code"),
      supabase.from("pilot_rank_aircraft_permissions").select("aircraft_type_code").eq("rank_code", rankCode),
      supabase.from("aircraft").select("aircraft_type_code").eq("current_airport_code", airport).eq("status", "available"),
    ]);

  if (routesError) throw routesError;
  if (routeAircraftError) throw routeAircraftError;

  const permittedTypes = new Set(
    ((rankPermissionsError ? [] : rankPermissions ?? []) as GenericRecord[])
      .map((row) => (typeof row.aircraft_type_code === "string" ? row.aircraft_type_code : ""))
      .filter(Boolean)
  );

  const availableTypes = new Set(
    ((aircraftError ? [] : aircraft ?? []) as GenericRecord[])
      .map((row) => (typeof row.aircraft_type_code === "string" ? row.aircraft_type_code : ""))
      .filter(Boolean)
  );

  const allowedTypes = new Set(
    Array.from(availableTypes).filter((code) => permittedTypes.size === 0 || permittedTypes.has(code))
  );

  const compatibilityMap = new Map<string, string[]>();
  for (const row of ((routeAircraft ?? []) as GenericRecord[])) {
    const routeId = typeof row.route_id === "string" ? row.route_id : "";
    const typeCode = typeof row.aircraft_type_code === "string" ? row.aircraft_type_code : "";
    if (!routeId || !typeCode || !allowedTypes.has(typeCode)) continue;
    const current = compatibilityMap.get(routeId) ?? [];
    current.push(typeCode);
    compatibilityMap.set(routeId, current);
  }

  return ((routes ?? []) as GenericRecord[])
    .map((row) => {
      const routeId = typeof row.id === "string" ? row.id : "";
      const routeCode = typeof row.route_code === "string" ? row.route_code : "";
      const origin = typeof row.origin_ident === "string" ? row.origin_ident : airport;
      const destination = typeof row.destination_ident === "string" ? row.destination_ident : "";
      const compatibleAircraftTypes = compatibilityMap.get(routeId) ?? [];
      const normalizedFlightIdentity = normalizeItineraryFlightIdentity(
        typeof row.flight_number === "string" || typeof row.flight_number === "number" ? row.flight_number : null,
        typeof row.flight_designator === "string" ? row.flight_designator : null,
        origin,
        destination
      );
      if (!routeId || !routeCode || !destination || compatibleAircraftTypes.length === 0) return null;
      if (!routeMatchesOperationalRequirements(row, pilotQualifications, pilotCertifications)) return null;
      return {
        itinerary_id: routeId,
        itinerary_code: routeCode,
        itinerary_name: `${origin} → ${destination}`,
        flight_mode: "itinerary" as FlightMode,
        origin_icao: origin,
        destination_icao: destination,
        origin_city: null,
        destination_city: null,
        aircraft_type_code: compatibleAircraftTypes.length === 1 ? compatibleAircraftTypes[0] : null,
        aircraft_type_name: compatibleAircraftTypes.length === 1 ? normalizeAircraftDisplayName(compatibleAircraftTypes[0]) : "Multi-fleet",
        compatible_aircraft_types: compatibleAircraftTypes,
        available_aircraft_count: compatibleAircraftTypes.length,
        distance_nm:
          typeof row.distance_nm === "number"
            ? row.distance_nm
            : Number.isFinite(Number(row.distance_nm ?? NaN))
              ? Number(row.distance_nm)
              : null,
        route_group: typeof row.route_group === "string" ? row.route_group : null,
        service_profile: typeof row.service_profile === "string" ? row.service_profile : null,
        service_level: typeof row.service_level === "string" ? row.service_level : null,
        origin_country: null,
        destination_country: null,
        scheduled_block_min: null,
        expected_block_p50: null,
        expected_block_p80: null,
        buffer_departure_min_low: null,
        buffer_departure_min_high: null,
        buffer_arrival_min_low: null,
        buffer_arrival_min_high: null,
        flight_number: normalizedFlightIdentity.flightNumber,
        flight_designator: normalizedFlightIdentity.flightDesignator,
      } satisfies AvailableItineraryOption;
    })
    .filter(Boolean) as AvailableItineraryOption[];
}

export async function getActiveFlightReservation(profile: PilotProfileRecord) {
  try {
    const { data, error } = await supabase.rpc("pw_get_active_reservation_for_pilot", {
      p_callsign: profile.callsign,
    });

    if (error) throw error;

    const rows = (data ?? []) as GenericRecord[];
    const firstRow = rows[0];
    if (!firstRow) return null;
    return mapLegacyReservationFromRpc(firstRow, profile);
  } catch (rpcError) {
    // flight_reservations no tiene columna pilot_id — solo pilot_callsign.
    // Intentar con callsign exacto y luego con un rango de estados más amplio.
    const attempts = [
      supabase.from("flight_reservations").select("*").eq("pilot_callsign", normalizeUpper(profile.callsign)).in("status", ["reserved", "dispatched", "in_flight", "in_progress"]).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("flight_reservations").select("*").eq("pilot_callsign", normalizeUpper(profile.callsign)).in("status", ["draft", "reserved", "dispatched", "in_flight", "in_progress", "completed"]).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ];
    for (const attempt of attempts) {
      const { data, error } = await attempt;
      if (!error) return (data ?? null) as DbFlightReservationRow | null;
    }
    throw rpcError instanceof Error ? rpcError : new Error("No se pudo obtener la reserva activa.");
  }
}

export async function saveFlightOperation(
  profile: PilotProfileRecord,
  operation: FlightOperationRecord,
  status: FlightOperationStatus
) {
  if (status === "reserved") {
    const { data, error } = await supabase.rpc("create_flight_reservation", {
      p_callsign: profile.callsign,
      p_route_code: normalizeUpper(operation.routeCode || operation.flightNumber),
      p_aircraft_id: operation.aircraftId,
      p_hold_minutes: 15,
    });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as GenericRecord[];
    const firstRow = rows[0];

    if (!firstRow) {
      throw new Error("La RPC create_flight_reservation no devolvió una reserva válida.");
    }

    return mapLegacyReservationFromRpc(firstRow, profile);
  }

  if (!operation.reservationId) {
    const reserved = (await saveFlightOperation(profile, operation, "reserved")) as DbFlightReservationRow;
    if (!reserved?.id) {
      throw new Error("No se pudo crear la reserva base para el despacho.");
    }
    operation = { ...operation, reservationId: reserved.id };
  }

  if (status === "dispatch_ready") {
    const { data, error } = await supabase
      .from("flight_reservations")
      .update({ status: "dispatched", updated_at: new Date().toISOString() })
      .eq("id", operation.reservationId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as DbFlightReservationRow;
  }

  const { data, error } = await supabase
    .from("flight_reservations")
    .update({
      updated_at: new Date().toISOString(),
      flight_mode_code: mapClientFlightModeToDb(operation.flightMode),
    })
    .eq("id", operation.reservationId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as DbFlightReservationRow;
}

export type DispatchSimBriefData = {
  routeText?: string | null;
  cruiseLevel?: string | null;
  alternateIcao?: string | null;
  passengerCount?: number | null;
  cargoKg?: number | null;
  tripFuelKg?: number | null;
  reserveFuelKg?: number | null;
  taxiFuelKg?: number | null;
  blockFuelKg?: number | null;
  payloadKg?: number | null;
  zfwKg?: number | null;
  scheduledBlockMinutes?: number | null;
  expectedBlockP50Minutes?: number | null;
  expectedBlockP80Minutes?: number | null;
  staticId?: string | null;
  flightNumber?: string | null;
  originIcao?: string | null;
  destinationIcao?: string | null;
  airframe?: string | null;
  aircraftRegistration?: string | null;
  distanceNm?: number | null;
  eteMinutes?: number | null;
  generatedAtIso?: string | null;
  matchedByStaticId?: boolean | null;
  rawUnits?: string | null;
  pdfUrl?: string | null;
};

export async function markDispatchPrepared(
  reservationId: string,
  simbriefUsername: string,
  pilotCallsign?: string,
  simBriefData?: DispatchSimBriefData
) {
  // NOTE: el status de la reserva (dispatch_ready) ya fue actualizado por
  // saveFlightOperation antes de llamar esta función. No se necesita duplicarlo.

  let rpcPackageError: unknown = null;

  const now = new Date().toISOString();

  const { data: reservationRow } = await supabase
    .from("flight_reservations")
    .select("id, pilot_callsign, status, route_id, route_code")
    .eq("id", reservationId)
    .maybeSingle();

  let reservationRouteId =
    typeof reservationRow?.route_id === "string" ? reservationRow.route_id : null;

  if (!reservationRouteId && typeof reservationRow?.route_code === "string") {
    const { data: routeRow } = await supabase
      .from("network_routes")
      .select("id")
      .eq("route_code", reservationRow.route_code)
      .maybeSingle();

    reservationRouteId = typeof routeRow?.id === "string" ? routeRow.id : null;
  }

  const reservationStatus =
    typeof reservationRow?.status === "string" ? reservationRow.status : null;

  const effectivePilotCallsign =
    pilotCallsign?.trim() ||
    (typeof reservationRow?.pilot_callsign === "string" ? reservationRow.pilot_callsign : "");

  // Construir el payload del dispatch package usando los nombres de columna
  // REALES de la tabla dispatch_packages en Supabase.
  //   - dispatch_status  (no "status")
  //   - cruise_fl        (no "cruise_level")
  //   - planned_fuel_kg  (no "fuel_planned_kg")
  //   - planned_payload_kg (no "payload_kg")
  //   - simbrief_normalized (jsonb) para el resto de datos SimBrief
  const dispatchSource = simBriefData ? "navigraph_web" : "manual";

  const packagePayload: Record<string, unknown> = {
    reservation_id: reservationId,
    pilot_callsign: effectivePilotCallsign || null,
    route_id: reservationRouteId,
    simbrief_username: simbriefUsername,
    dispatch_status: "prepared",
    route_code: typeof reservationRow?.route_code === "string" ? reservationRow.route_code : null,
    updated_at: now,
  };

  if (simBriefData) {
    // Columnas reales de dispatch_packages
    if (simBriefData.routeText)           packagePayload.route_text           = simBriefData.routeText.trim();
    if (simBriefData.cruiseLevel)         packagePayload.cruise_fl            = simBriefData.cruiseLevel.trim();  // columna real: cruise_fl
    if (simBriefData.blockFuelKg != null) packagePayload.planned_fuel_kg      = simBriefData.blockFuelKg;         // columna real: planned_fuel_kg
    if (simBriefData.payloadKg != null)   packagePayload.planned_payload_kg   = simBriefData.payloadKg;           // columna real: planned_payload_kg

    // El resto de datos SimBrief va en simbrief_normalized (jsonb), que el
    // ACARS puede leer como sub-objeto para pax, cargo, combustible detallado, etc.
    const normalized: Record<string, unknown> = {};
    if (simBriefData.alternateIcao)          normalized.alternate_icao           = simBriefData.alternateIcao.trim().toUpperCase();
    if (simBriefData.flightNumber)           normalized.flight_number            = simBriefData.flightNumber.trim().toUpperCase();
    if (simBriefData.originIcao)             normalized.origin_icao              = simBriefData.originIcao.trim().toUpperCase();
    if (simBriefData.destinationIcao)        normalized.destination_icao         = simBriefData.destinationIcao.trim().toUpperCase();
    if (simBriefData.airframe)               normalized.airframe                 = simBriefData.airframe.trim().toUpperCase();
    if (simBriefData.aircraftRegistration)   normalized.aircraft_registration    = simBriefData.aircraftRegistration.trim().toUpperCase();
    if (simBriefData.passengerCount != null) normalized.passenger_count          = simBriefData.passengerCount;
    if (simBriefData.cargoKg != null)        normalized.cargo_kg                 = simBriefData.cargoKg;
    if (simBriefData.blockFuelKg != null)    normalized.block_fuel_kg            = simBriefData.blockFuelKg;
    if (simBriefData.tripFuelKg != null)     normalized.trip_fuel_kg             = simBriefData.tripFuelKg;
    if (simBriefData.reserveFuelKg != null)  normalized.reserve_fuel_kg          = simBriefData.reserveFuelKg;
    if (simBriefData.taxiFuelKg != null)     normalized.taxi_fuel_kg             = simBriefData.taxiFuelKg;
    if (simBriefData.payloadKg != null)      normalized.payload_kg               = simBriefData.payloadKg;
    if (simBriefData.zfwKg != null)          normalized.zero_fuel_weight_kg      = simBriefData.zfwKg;
    if (simBriefData.scheduledBlockMinutes != null)
                                             normalized.scheduled_block_minutes  = simBriefData.scheduledBlockMinutes;
    if (simBriefData.expectedBlockP50Minutes != null)
                                             normalized.expected_block_p50_minutes = simBriefData.expectedBlockP50Minutes;
    if (simBriefData.expectedBlockP80Minutes != null)
                                             normalized.expected_block_p80_minutes = simBriefData.expectedBlockP80Minutes;
    if (simBriefData.staticId)               normalized.dispatch_token           = simBriefData.staticId;
    if (simBriefData.cruiseLevel)            normalized.cruise_level             = simBriefData.cruiseLevel.trim();
    if (simBriefData.distanceNm != null)     normalized.distance_nm              = simBriefData.distanceNm;
    if (simBriefData.eteMinutes != null)     normalized.ete_minutes              = simBriefData.eteMinutes;
    if (simBriefData.generatedAtIso)         normalized.generated_at_iso         = simBriefData.generatedAtIso;
    if (simBriefData.matchedByStaticId != null)
                                             normalized.matched_by_static_id     = simBriefData.matchedByStaticId;
    if (simBriefData.rawUnits)               normalized.raw_units                = simBriefData.rawUnits;
    if (simBriefData.pdfUrl)                 normalized.pdf_url                  = simBriefData.pdfUrl;
    if (Object.keys(normalized).length > 0) packagePayload.simbrief_normalized  = normalized;
  }

  // Actualizar el status de la reserva a dispatch_ready para que el ACARS pueda leerla.
  // El ACARS filtra por: dispatch_ready | dispatched | in_progress | in_flight
  if (reservationStatus === "reserved" || reservationStatus === "draft") {
    try {
      await supabase
        .from("flight_reservations")
        .update({ status: "dispatched", updated_at: now })
        .eq("id", reservationId);
    } catch (statusErr) {
      console.warn("[markDispatchPrepared] No se pudo actualizar status reserva a dispatch_ready:", statusErr);
    }
  }

  if (effectivePilotCallsign && (reservationStatus === "reserved" || reservationStatus === "dispatch_ready" || reservationStatus === "dispatched")) {
    try {
      const { data, error } = await supabase.rpc("pw_create_dispatch_package", {
        p_callsign: normalizeUpper(effectivePilotCallsign),
        p_reservation_id: reservationId,
        p_dispatch_source: dispatchSource,
        p_route_text: simBriefData?.routeText ?? null,
        p_cruise_fl: simBriefData?.cruiseLevel ?? null,
        p_planned_fuel_kg: simBriefData?.blockFuelKg ?? null,
        p_planned_payload_kg: simBriefData?.payloadKg ?? null,
        p_simbrief_username: simbriefUsername || null,
        p_simbrief_ofp_id: simBriefData?.staticId ?? null,
        p_simbrief_ofp_json: packagePayload.simbrief_normalized ?? null,
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? (data[0] as GenericRecord | undefined) : (data as GenericRecord | null);
      if (row) {
        // RPC creó el package base — ahora hacemos PATCH con los datos de SimBrief
        if (simBriefData) {
          await supabase
            .from("dispatch_packages")
            .update({
              ...packagePayload,
              updated_at: now,
            })
            .eq("reservation_id", reservationId);
        }

        return {
          reservation_id: reservationId,
          simbrief_username: simbriefUsername,
          status: "prepared",
          prepared_at: typeof row.prepared_at === "string" ? row.prepared_at : now,
          released_at: typeof row.released_at === "string" ? row.released_at : null,
          created_at: typeof row.created_at === "string" ? row.created_at : now,
          updated_at: now,
        } satisfies DispatchPackageRow;
      }
    } catch (error) {
      rpcPackageError = error;
    }
  }

  if (!reservationRouteId) {
    throw buildDispatchPersistenceError(
      rpcPackageError,
      new Error("No se pudo determinar route_id para el dispatch package desde la reserva activa.")
    );
  }

  try {
    const { data, error } = await supabase
      .from("dispatch_packages")
      .upsert(packagePayload, { onConflict: "reservation_id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as DispatchPackageRow;
  } catch (fallbackPackageError) {
    throw buildDispatchPersistenceError(rpcPackageError, fallbackPackageError);
  }
}

export async function cancelFlightOperation(
  reservationId: string,
  pilotCallsign?: string
) {
  if (pilotCallsign?.trim()) {
    try {
      const { error } = await supabase.rpc("pw_cancel_active_reservation", {
        p_callsign: normalizeUpper(pilotCallsign),
        p_reason: "manual_cancel_from_web",
      });

      if (!error) {
        return;
      }
    } catch {
      // fallback legacy below
    }
  }

  const nowIso = new Date().toISOString();

  // Obtener aircraft_id antes de cancelar para liberar el avión
  const { data: resRow } = await supabase
    .from("flight_reservations")
    .select("aircraft_id")
    .eq("id", reservationId)
    .single();

  const { error } = await supabase
    .from("flight_reservations")
    .update({ status: "cancelled", updated_at: nowIso })
    .eq("id", reservationId);

  if (error) throw error;

  // Liberar el avión si existe
  const aircraftId = (resRow as { aircraft_id?: string } | null)?.aircraft_id;
  if (aircraftId) {
    await supabase
      .from("aircraft")
      .update({ status: "available", updated_at: nowIso })
      .eq("id", aircraftId);
  }
}

export function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const time = date.getTime();

  if (Number.isNaN(time)) return "";

  const offset = date.getTimezoneOffset();
  const localDate = new Date(time - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
