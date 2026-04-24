import type { PilotProfileRecord } from "@/lib/pilot-profile";
import {
  getOperationalFlightNumber,
  type AvailableAircraftOption,
  type FlightOperationRecord,
} from "@/lib/flight-ops";
import { supabase } from "@/lib/supabase/browser";

export type CharterAirportOption = {
  icao: string;
  ident?: string | null;
  name: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type CharterAircraftOption = AvailableAircraftOption & {
  license_status?: string | null;
  license_granted_at?: string | null;
};

export type CharterRouteDraft = {
  originIcao: string;
  destinationIcao: string;
  selectedAircraft: CharterAircraftOption;
  scheduledDeparture: string;
  remarks?: string;
};

function normalizeIcao(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function toAirportOption(row: Record<string, unknown>): CharterAirportOption {
  const icao = normalizeIcao(
    typeof row.icao === "string"
      ? row.icao
      : typeof row.ident === "string"
        ? row.ident
        : "",
  );

  return {
    icao,
    ident: icao,
    name: typeof row.name === "string" ? row.name : null,
    city:
      typeof row.city === "string"
        ? row.city
        : typeof row.municipality === "string"
          ? row.municipality
          : null,
    country:
      typeof row.country === "string"
        ? row.country
        : typeof row.iso_country === "string"
          ? row.iso_country
          : null,
    latitude:
      typeof row.latitude === "number"
        ? row.latitude
        : typeof row.latitude_deg === "number"
          ? row.latitude_deg
          : null,
    longitude:
      typeof row.longitude === "number"
        ? row.longitude
        : typeof row.longitude_deg === "number"
          ? row.longitude_deg
          : null,
  };
}

function toAircraftOption(row: Record<string, unknown>): CharterAircraftOption {
  const aircraftId = typeof row.aircraft_id === "string" ? row.aircraft_id : String(row.aircraft_id ?? "");
  const tailNumber =
    typeof row.tail_number === "string"
      ? row.tail_number
      : typeof row.registration === "string"
        ? row.registration
        : typeof row.aircraft_registration === "string"
          ? row.aircraft_registration
          : "";
  const aircraftTypeCode =
    typeof row.aircraft_type_code === "string"
      ? row.aircraft_type_code
      : typeof row.aircraft_type === "string"
        ? row.aircraft_type
        : typeof row.aircraft_code === "string"
          ? row.aircraft_code
          : "";

  return {
    aircraft_id: aircraftId,
    tail_number: tailNumber,
    aircraft_code: aircraftTypeCode,
    aircraft_type_code: aircraftTypeCode,
    aircraft_name:
      typeof row.aircraft_name === "string"
        ? row.aircraft_name
        : typeof row.display_name === "string"
          ? row.display_name
          : aircraftTypeCode,
    aircraft_variant_code: typeof row.aircraft_variant_code === "string" ? row.aircraft_variant_code : undefined,
    addon_provider: typeof row.addon_provider === "string" ? row.addon_provider : undefined,
    variant_name: typeof row.variant_name === "string" ? row.variant_name : undefined,
    current_airport_icao: normalizeIcao(
      typeof row.current_airport_icao === "string"
        ? row.current_airport_icao
        : typeof row.current_airport === "string"
          ? row.current_airport
          : "",
    ),
    status: typeof row.status === "string" ? row.status : "available",
    display_category: typeof row.display_category === "string" ? row.display_category : undefined,
    display_status: typeof row.display_status === "string" ? row.display_status : undefined,
    selectable: row.selectable !== false,
    license_status: typeof row.license_status === "string" ? row.license_status : null,
    license_granted_at: typeof row.license_granted_at === "string" ? row.license_granted_at : null,
  };
}

export async function searchCharterAirports(query: string, limit = 20) {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [] as CharterAirportOption[];

  const { data, error } = await supabase.rpc("pw_search_airports_for_dispatch", {
    p_query: cleanQuery,
    p_limit: limit,
  });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => toAirportOption(row as Record<string, unknown>)).filter((row) => row.icao);
}

export async function listCharterAircraftAtOrigin(originIcao: string) {
  const origin = normalizeIcao(originIcao);
  if (!origin) return [] as CharterAircraftOption[];

  const { data, error } = await supabase.rpc("pw_list_charter_aircraft", {
    p_origin_icao: origin,
  });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => toAircraftOption(row as Record<string, unknown>)).filter((row) => row.aircraft_id);
}

export function buildCharterFlightOperation(params: {
  userId: string;
  profile: PilotProfileRecord;
  draft: CharterRouteDraft;
}): FlightOperationRecord {
  const now = new Date().toISOString();
  const origin = normalizeIcao(params.draft.originIcao);
  const destination = normalizeIcao(params.draft.destinationIcao);
  const flightNumber = getOperationalFlightNumber(origin, destination) || `PWG${Math.floor(900 + Math.random() * 90)}`;
  const aircraft = params.draft.selectedAircraft;
  const aircraftTypeCode = normalizeIcao(aircraft.aircraft_type_code ?? aircraft.aircraft_code);
  const tailNumber = aircraft.tail_number?.trim() ?? "";

  return {
    reservationId: null,
    userId: params.userId,
    itineraryId: null,
    aircraftId: aircraft.aircraft_id,
    flightMode: "charter",
    routeCode: `CHARTER-${origin}-${destination}`,
    flightNumber,
    origin,
    destination,
    aircraftCode: aircraftTypeCode,
    aircraftTypeCode,
    aircraftName: aircraft.aircraft_name || aircraftTypeCode,
    aircraftTailNumber: tailNumber,
    aircraftVariantCode: aircraft.aircraft_variant_code ?? "",
    aircraftAddonProvider: aircraft.addon_provider ?? "",
    aircraftVariantLabel: [aircraft.variant_name, aircraft.aircraft_variant_code, aircraft.addon_provider]
      .filter(Boolean)
      .join(" · "),
    routeText: `${origin} DCT ${destination}`,
    scheduledDeparture: params.draft.scheduledDeparture,
    remarks: [
      "CHARTER_OPERATION",
      "REAL_WEATHER_REQUIRED",
      params.draft.remarks?.trim() ?? "",
    ]
      .filter(Boolean)
      .join(" | "),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}
