import type { SupabaseClient } from "@supabase/supabase-js";

export type HomeStatItem = {
  key: string;
  label: string;
  value: number;
};

type RouteRow = {
  id?: string | null;
  destination_ident?: string | null;
  is_active?: boolean | null;
};

type FleetRow = {
  registration?: string | null;
  aircraft_type?: string | null;
};

type ReservationRow = {
  status?: string | null;
  reserved_at?: string | null;
  dispatched_at?: string | null;
  departed_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

export const FALLBACK_HOME_STATS: HomeStatItem[] = [
  { key: "routes", label: "Rutas", value: 0 },
  { key: "destinations", label: "Destinos", value: 0 },
  { key: "aircraft", label: "Aeronaves", value: 0 },
  { key: "types", label: "Tipos", value: 0 },
  { key: "todayFlights", label: "Vuelos de hoy", value: 0 },
];

function normalizeAircraftTypeCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function isOperationalReservationStatus(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized.length > 0 && !["cancelled", "aborted", "interrupted", "crashed"].includes(normalized);
}

function isSameUtcDate(value: string | null | undefined, targetDateKey: string) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === targetDateKey;
}

export function buildHomeStatsSnapshot(params: {
  routes: RouteRow[];
  fleet: FleetRow[];
  models: Array<{ code?: string | null; is_active?: boolean | null }>;
  reservations: ReservationRow[];
  todayKey?: string;
}): HomeStatItem[] {
  const todayKey = params.todayKey ?? new Date().toISOString().slice(0, 10);

  const activeRoutes = params.routes.filter((row) => {
    const destination = (row.destination_ident ?? "").trim();
    return destination.length > 0 && row.is_active !== false;
  });

  const uniqueDestinations = new Set(
    activeRoutes
      .map((row) => (row.destination_ident ?? "").trim().toUpperCase())
      .filter(Boolean),
  );

  const uniqueAircraftIds = new Set(
    params.fleet
      .map((row) => (row.registration ?? "").trim().toUpperCase())
      .filter(Boolean),
  );

  const activeModels = params.models.filter((row) => row.is_active !== false);
  const uniqueAircraftTypes = new Set(
    activeModels
      .map((row) => normalizeAircraftTypeCode(row.code))
      .filter(Boolean),
  );

  const todaysFlights = params.reservations.filter((row) => {
    if (!isOperationalReservationStatus(row.status)) {
      return false;
    }

    return [
      row.reserved_at,
      row.dispatched_at,
      row.departed_at,
      row.completed_at,
      row.created_at,
    ].some((value) => isSameUtcDate(value, todayKey));
  });

  return [
    { key: "routes", label: "Rutas", value: activeRoutes.length },
    { key: "destinations", label: "Destinos", value: uniqueDestinations.size },
    { key: "aircraft", label: "Aeronaves", value: uniqueAircraftIds.size },
    { key: "types", label: "Tipos", value: uniqueAircraftTypes.size },
    { key: "todayFlights", label: "Vuelos de hoy", value: todaysFlights.length },
  ];
}

export async function loadHomeStatsFromSupabase(supabase: SupabaseClient): Promise<HomeStatItem[]> {
  const [routesResponse, fleetResponse, modelsResponse, reservationsResponse] = await Promise.all([
    supabase.from("network_routes").select("id, destination_ident, is_active"),
    supabase.from("aircraft_fleet").select("registration, aircraft_type"),
    supabase.from("aircraft_models").select("code, is_active"),
    supabase
      .from("flight_reservations")
      .select("status, reserved_at, dispatched_at, departed_at, completed_at, created_at"),
  ]);

  if (routesResponse.error) {
    throw routesResponse.error;
  }

  if (fleetResponse.error) {
    throw fleetResponse.error;
  }

  if (modelsResponse.error) {
    throw modelsResponse.error;
  }

  if (reservationsResponse.error) {
    throw reservationsResponse.error;
  }

  return buildHomeStatsSnapshot({
    routes: routesResponse.data ?? [],
    fleet: fleetResponse.data ?? [],
    models: modelsResponse.data ?? [],
    reservations: reservationsResponse.data ?? [],
  });
}
