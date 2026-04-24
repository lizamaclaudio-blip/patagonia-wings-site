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
  status?: string | null;
};

type ReservationRow = {
  status?: string | null;
  reserved_at?: string | null;
  dispatched_at?: string | null;
  departed_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

type PublicSiteMetricsRow = {
  routes_count?: number | string | null;
  destinations_count?: number | string | null;
  aircraft_count?: number | string | null;
  types_count?: number | string | null;
  today_flights_count?: number | string | null;
};

export const FALLBACK_HOME_STATS: HomeStatItem[] = [
  { key: "routes", label: "Rutas", value: 0 },
  { key: "destinations", label: "Destinos", value: 0 },
  { key: "aircraft", label: "Aeronaves", value: 0 },
  { key: "types", label: "Tipos", value: 0 },
  { key: "todayFlights", label: "Vuelos de hoy", value: 0 },
];

function toSafeInteger(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed);
}

function normalizeAircraftTypeCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function isOperationalReservationStatus(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return (
    normalized.length > 0 &&
    !["cancelled", "aborted", "interrupted", "crashed", "deleted"].includes(normalized)
  );
}

function isActiveFleetStatus(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return !["retired", "deleted", "inactive"].includes(normalized);
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

  const activeFleet = params.fleet.filter((row) => {
    const registration = (row.registration ?? "").trim();
    return registration.length > 0 && isActiveFleetStatus(row.status);
  });

  const uniqueAircraftIds = new Set(
    activeFleet
      .map((row) => (row.registration ?? "").trim().toUpperCase())
      .filter(Boolean),
  );

  const uniqueFleetTypes = new Set(
    activeFleet
      .map((row) => normalizeAircraftTypeCode(row.aircraft_type))
      .filter(Boolean),
  );

  const activeModels = params.models.filter((row) => row.is_active !== false);
  const uniqueModelTypes = new Set(
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
    {
      key: "types",
      label: "Tipos",
      value: uniqueFleetTypes.size || uniqueModelTypes.size,
    },
    { key: "todayFlights", label: "Vuelos de hoy", value: todaysFlights.length },
  ];
}

function mapPublicMetricsRow(row: PublicSiteMetricsRow | null | undefined): HomeStatItem[] | null {
  if (!row) {
    return null;
  }

  return [
    { key: "routes", label: "Rutas", value: toSafeInteger(row.routes_count) },
    { key: "destinations", label: "Destinos", value: toSafeInteger(row.destinations_count) },
    { key: "aircraft", label: "Aeronaves", value: toSafeInteger(row.aircraft_count) },
    { key: "types", label: "Tipos", value: toSafeInteger(row.types_count) },
    { key: "todayFlights", label: "Vuelos de hoy", value: toSafeInteger(row.today_flights_count) },
  ];
}

async function loadHomeStatsFromPublicRpc(supabase: SupabaseClient): Promise<HomeStatItem[] | null> {
  const { data, error } = await supabase.rpc("pw_get_public_site_metrics");

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return mapPublicMetricsRow(row as PublicSiteMetricsRow | null | undefined);
}

async function loadHomeStatsFromTables(supabase: SupabaseClient): Promise<HomeStatItem[]> {
  const [routesResponse, fleetResponse, modelsResponse, reservationsResponse] =
    await Promise.all([
      supabase.from("network_routes").select("id, destination_ident, is_active"),
      supabase.from("aircraft_fleet").select("registration, aircraft_type, status"),
      supabase.from("aircraft_models").select("code, is_active"),
      supabase
        .from("flight_reservations")
        .select("status, reserved_at, dispatched_at, departed_at, completed_at, created_at"),
    ]);

  return buildHomeStatsSnapshot({
    routes: routesResponse.error ? [] : routesResponse.data ?? [],
    fleet: fleetResponse.error ? [] : fleetResponse.data ?? [],
    models: modelsResponse.error ? [] : modelsResponse.data ?? [],
    reservations: reservationsResponse.error ? [] : reservationsResponse.data ?? [],
  });
}

export async function loadHomeStatsFromSupabase(supabase: SupabaseClient): Promise<HomeStatItem[]> {
  try {
    const rpcStats = await loadHomeStatsFromPublicRpc(supabase);
    if (rpcStats) {
      return rpcStats;
    }
  } catch {
    // Si la función RPC aún no existe o está bloqueada, se usa fallback tolerante a RLS.
  }

  return loadHomeStatsFromTables(supabase);
}
