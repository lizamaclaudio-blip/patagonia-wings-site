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
  aircraftName: string;
  aircraftTailNumber: string;
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
  aircraft_name: string;
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
  aircraft_id: string | null;
  aircraft_registration?: string | null;
  aircraft_type_code?: string | null;
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
  status: FlightOperationStatus | "dispatched" | "in_progress" | "completed" | "cancelled";
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

type GenericRecord = Record<string, unknown>;

function normalizeUpper(value: string) {
  return value.trim().toUpperCase();
}

function getProfileAirport(profile?: PilotProfileRecord | null) {
  return normalizeUpper(profile?.current_airport_icao ?? profile?.base_hub ?? "SCEL");
}

function toFlightMode(value: unknown): FlightMode {
  if (value === "charter" || value === "training" || value === "event") {
    return value;
  }
  return "itinerary";
}

function normalizeAircraftDisplayName(code: string) {
  const normalized = code.replace(/_/g, " ").replace(/-/g, " ");
  return normalized;
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

function buildDispatchPersistenceError(
  updateError: unknown,
  packageError: unknown
) {
  const updateMessage =
    updateError instanceof Error ? updateError.message : String(updateError ?? "");
  const packageMessage =
    packageError instanceof Error ? packageError.message : String(packageError ?? "");

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
    routeText: row.route_text ?? "",
    scheduledDeparture: row.scheduled_departure
      ? toDateTimeLocalValue(row.scheduled_departure)
      : "",
    remarks: row.remarks ?? "",
    status:
      row.status === "in_progress" || row.status === "completed"
        ? "dispatch_ready"
        : row.status === "cancelled"
          ? "draft"
          : row.status,
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
      .select("id, registration, aircraft_type_code, current_airport_code, status")
      .eq("current_airport_code", airport)
      .eq("status", "available")
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
        aircraft_name: normalizeAircraftDisplayName(
          typeof row.aircraft_type_code === "string" ? row.aircraft_type_code : ""
        ),
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
        .select("id, route_code, origin_ident, destination_ident, route_group, service_profile, service_level, priority, distance_nm, is_active, flight_number, flight_designator")
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
    const attempts = [
      supabase.from("flight_reservations").select("*").eq("pilot_callsign", profile.callsign).in("status", ["reserved", "dispatched", "in_flight", "draft", "dispatch_ready", "in_progress"]).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("flight_reservations").select("*").eq("pilot_id", profile.id).in("status", ["draft", "reserved", "dispatch_ready", "in_progress", "dispatched", "in_flight"]).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
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
    let reservationRpcError: unknown = null;

    try {
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

      if (firstRow) {
        return mapLegacyReservationFromRpc(firstRow, profile);
      }
    } catch (error) {
      reservationRpcError = error;
    }

    try {
      const payload = {
        airline_id: profile.airline_id,
        pilot_id: profile.id,
        aircraft_id: operation.aircraftId,
        itinerary_id: operation.itineraryId,
        flight_mode: operation.flightMode,
        flight_number: normalizeUpper(operation.flightNumber),
        origin_icao: normalizeUpper(operation.origin),
        destination_icao: normalizeUpper(operation.destination),
        scheduled_departure: operation.scheduledDeparture
          ? fromDateTimeLocalValue(operation.scheduledDeparture)
          : null,
        route_text: operation.routeText.trim() || null,
        remarks: operation.remarks.trim() || null,
        status: "reserved",
      };

      const { data, error } = await supabase
        .from("flight_reservations")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return data as DbFlightReservationRow;
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError ?? "");
      const rpcMessage =
        reservationRpcError instanceof Error
          ? reservationRpcError.message
          : String(reservationRpcError ?? "");

      if (rpcMessage && fallbackMessage) {
        throw new Error(
          `No se pudo crear la reserva base. RPC: ${rpcMessage} | Tabla directa: ${fallbackMessage}`
        );
      }

      throw fallbackError instanceof Error
        ? fallbackError
        : new Error("No se pudo crear la reserva base.");
    }
  }

  if (!operation.reservationId) {
    throw new Error("No existe una reserva activa para emitir el despacho final.");
  }

  if (status === "dispatch_ready") {
    return updateReservationStatusLegacy(operation.reservationId, "dispatch_ready");
  }

  const payload = {
    airline_id: profile.airline_id,
    pilot_id: profile.id,
    aircraft_id: operation.aircraftId,
    itinerary_id: operation.itineraryId,
    flight_mode: operation.flightMode,
    flight_number: normalizeUpper(operation.flightNumber),
    origin_icao: normalizeUpper(operation.origin),
    destination_icao: normalizeUpper(operation.destination),
    scheduled_departure: operation.scheduledDeparture
      ? fromDateTimeLocalValue(operation.scheduledDeparture)
      : null,
    route_text: operation.routeText.trim() || null,
    remarks: operation.remarks.trim() || null,
    status: toPersistedReservationStatus(status),
  };

  const { data, error } = await supabase
    .from("flight_reservations")
    .update(payload)
    .eq("id", operation.reservationId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as DbFlightReservationRow;
}

export async function markDispatchPrepared(
  reservationId: string,
  simbriefUsername: string,
  pilotCallsign?: string
) {
  let reservationStatusError: unknown = null;

  try {
    await updateReservationStatusLegacy(reservationId, "dispatch_ready");
  } catch (error) {
    reservationStatusError = error;
  }

  let rpcPackageError: unknown = null;

  if (pilotCallsign) {
    try {
      const { data, error } = await supabase.rpc("pw_create_dispatch_package", {
        p_callsign: pilotCallsign,
        p_reservation_id: reservationId,
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? (data[0] as GenericRecord | undefined) : (data as GenericRecord | null);
      if (row) {
        const now = new Date().toISOString();
        return {
          reservation_id: reservationId,
          simbrief_username: simbriefUsername,
          status: "prepared",
          prepared_at:
            typeof row.prepared_at === "string" ? row.prepared_at : now,
          released_at:
            typeof row.released_at === "string" ? row.released_at : null,
          created_at:
            typeof row.created_at === "string" ? row.created_at : now,
          updated_at:
            typeof row.updated_at === "string" ? row.updated_at : now,
        } satisfies DispatchPackageRow;
      }
    } catch (error) {
      rpcPackageError = error;
    }
  }

  try {
    const payload = {
      reservation_id: reservationId,
      simbrief_username: simbriefUsername,
      status: "prepared",
      prepared_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("dispatch_packages")
      .upsert(payload, { onConflict: "reservation_id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as DispatchPackageRow;
  } catch (fallbackPackageError) {
    throw buildDispatchPersistenceError(reservationStatusError, rpcPackageError || fallbackPackageError);
  }
}

export async function cancelFlightOperation(
  reservationId: string,
  pilotCallsign?: string
) {
  if (pilotCallsign) {
    try {
      const { error } = await supabase.rpc("pw_cancel_active_reservation", {
        p_callsign: pilotCallsign,
        p_reason: "manual_cancel_from_web",
      });

      if (!error) {
        return;
      }
    } catch {
      // fallback legacy below
    }
  }

  const { error } = await supabase
    .from("flight_reservations")
    .update({ status: "cancelled" })
    .eq("id", reservationId);

  if (error) {
    throw error;
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
