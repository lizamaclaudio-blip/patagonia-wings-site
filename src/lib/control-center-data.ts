import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export type DashboardMetric = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
};

export type DashboardSnapshot = {
  metrics: DashboardMetric[];
  recentFlights: Record<string, unknown>[];
  alerts: string[];
  pendingSources: {
    requests: number;
    ticketsAvailable: boolean;
  };
};

export type PilotRow = Record<string, unknown> & {
  last_flight?: Record<string, unknown> | null;
  account?: Record<string, unknown> | null;
};

export type HubRow = Record<string, unknown> & {
  pilot_count: number;
  aircraft_count: number;
  aircraft_here_count: number;
  aircraft_gap: number;
};

export type FleetRow = Record<string, unknown> & {
  condition?: Record<string, unknown> | null;
  display?: Record<string, unknown> | null;
  last_flight?: Record<string, unknown> | null;
};

export type GenericRow = Record<string, unknown>;

export type OperationRow = GenericRow & {
  dispatch?: GenericRow | null;
  score_report?: GenericRow | null;
  aircraft_location?: string | null;
  location_mismatch?: boolean;
};

function sanitizeLike(value: string) {
  return value.replace(/[,%]/g, "").trim();
}

async function countTable(
  table: string,
  configure?: (query: any) => any
) {
  const admin = createAdminSupabaseClient();
  let query = admin.from(table).select("*", { count: "exact", head: true });

  if (configure) {
    query = configure(query);
  }

  const { count } = await query;
  return count ?? 0;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const admin = createAdminSupabaseClient();

  const [
    authUsersResult,
    activePilots,
    hubsCount,
    aircraftTotal,
    aircraftMaintenance,
    activeReservations,
    recentFlightsResult,
    outOfHubResult,
    hoursTransferPending,
    promotionPending,
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    countTable("pilot_profiles", (query) => {
      let scoped = query.eq("is_active", true).eq("status", "active");
      if (env.airlineId) {
        scoped = scoped.eq("airline_id", env.airlineId);
      }
      return scoped;
    }),
    countTable("pw_hubs"),
    countTable("aircraft_fleet", (query) =>
      env.airlineId ? query.eq("airline_id", env.airlineId) : query
    ),
    countTable("v_aircraft_maintenance_queue", (query) =>
      query.eq("maintenance_required", true)
    ),
    countTable("flight_reservations", (query) =>
      query.in("status", ["reserved", "dispatched", "in_progress"])
    ),
    admin
      .from("flight_reservations")
      .select(
        "reservation_code, pilot_callsign, aircraft_registration, origin_ident, destination_ident, status, completed_at, procedure_score, performance_score"
      )
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("aircraft_fleet")
      .select("registration, home_hub_icao, current_airport_icao")
      .limit(500),
    countTable("pw_hours_transfer_requests", (query) =>
      query.in("request_status", ["pending", "review", "submitted"])
    ),
    countTable("pw_rank_promotion_requests", (query) =>
      query.in("request_status", ["pending", "review", "submitted"])
    ),
  ]);

  const outOfHubCount = (outOfHubResult.data ?? []).filter((row) => {
    const current = typeof row.current_airport_icao === "string" ? row.current_airport_icao : "";
    const home = typeof row.home_hub_icao === "string" ? row.home_hub_icao : "";
    return current && home && current !== home;
  }).length;

  const alerts: string[] = [];

  if (aircraftMaintenance > 0) {
    alerts.push(`${aircraftMaintenance} aeronaves requieren mantenimiento.`);
  }

  if (outOfHubCount > 0) {
    alerts.push(`${outOfHubCount} aeronaves están fuera de su hub base.`);
  }

  if (activeReservations > 0) {
    alerts.push(`${activeReservations} reservas siguen activas o en progreso.`);
  }

  return {
    metrics: [
      {
        label: "Usuarios totales",
        value: String(authUsersResult.data.users.length),
      },
      {
        label: "Pilotos activos",
        value: String(activePilots),
        tone: "success",
      },
      { label: "Hubs", value: String(hubsCount) },
      { label: "Aeronaves totales", value: String(aircraftTotal) },
      {
        label: "En mantenimiento",
        value: String(aircraftMaintenance),
        tone: aircraftMaintenance > 0 ? "warning" : "default",
      },
      {
        label: "Fuera de hub",
        value: String(outOfHubCount),
        tone: outOfHubCount > 0 ? "warning" : "default",
      },
      {
        label: "Reservas activas",
        value: String(activeReservations),
        tone: activeReservations > 0 ? "success" : "default",
      },
      {
        label: "Solicitudes pendientes",
        value: String(hoursTransferPending + promotionPending),
      },
    ],
    recentFlights: (recentFlightsResult.data ?? []) as Record<string, unknown>[],
    alerts,
    pendingSources: {
      requests: hoursTransferPending + promotionPending,
      ticketsAvailable: false,
    },
  };
}

export async function getPilotRanks(): Promise<GenericRow[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("pilot_ranks")
    .select("*")
    .order("sort_order", { ascending: true });

  return (data ?? []) as GenericRow[];
}

export async function getHubs(): Promise<HubRow[]> {
  const admin = createAdminSupabaseClient();
  const [hubsResult, pilotsResult, fleetResult] = await Promise.all([
    admin.from("pw_hubs").select("*").order("sort_order", { ascending: true }),
    admin.from("pilot_profiles").select("base_hub"),
    admin.from("aircraft_fleet").select("home_hub_icao,current_airport_icao"),
  ]);

  const pilotCountByHub = new Map<string, number>();
  const aircraftCountByHub = new Map<string, number>();
  const aircraftHereByHub = new Map<string, number>();

  for (const pilot of pilotsResult.data ?? []) {
    const hubCode = typeof pilot.base_hub === "string" ? pilot.base_hub : "";
    if (!hubCode) continue;
    pilotCountByHub.set(hubCode, (pilotCountByHub.get(hubCode) ?? 0) + 1);
  }

  for (const aircraft of fleetResult.data ?? []) {
    const home = typeof aircraft.home_hub_icao === "string" ? aircraft.home_hub_icao : "";
    const current =
      typeof aircraft.current_airport_icao === "string"
        ? aircraft.current_airport_icao
        : "";

    if (home) {
      aircraftCountByHub.set(home, (aircraftCountByHub.get(home) ?? 0) + 1);
    }

    if (current) {
      aircraftHereByHub.set(current, (aircraftHereByHub.get(current) ?? 0) + 1);
    }
  }

  return ((hubsResult.data ?? []) as Record<string, unknown>[]).map((hub) => {
    const hubCode = typeof hub.hub_code === "string" ? hub.hub_code : "";
    const pilotCount = pilotCountByHub.get(hubCode) ?? 0;
    const aircraftCount = aircraftCountByHub.get(hubCode) ?? 0;
    const aircraftHereCount = aircraftHereByHub.get(hubCode) ?? 0;

    return {
      ...hub,
      pilot_count: pilotCount,
      aircraft_count: aircraftCount,
      aircraft_here_count: aircraftHereCount,
      aircraft_gap: aircraftCount - pilotCount,
    } satisfies HubRow;
  });
}

export async function getPilots(search?: string): Promise<PilotRow[]> {
  const admin = createAdminSupabaseClient();

  let query = admin.from("pilot_profiles").select("*").order("callsign", {
    ascending: true,
  });

  if (env.airlineId) {
    query = query.eq("airline_id", env.airlineId);
  }

  if (search) {
    const value = sanitizeLike(search);
    query = query.or(
      `callsign.ilike.*${value}*,email.ilike.*${value}*,first_name.ilike.*${value}*,last_name.ilike.*${value}*`
    );
  }

  const { data } = await query.limit(200);
  const pilots = (data ?? []) as Record<string, unknown>[];
  const callsigns = pilots
    .map((row) => (typeof row.callsign === "string" ? row.callsign : ""))
    .filter(Boolean);

  const [recentFlightsResult, pilotAccountsResult] = await Promise.all([
    callsigns.length
      ? admin
          .from("v_pilot_recent_scored_flights")
          .select("*")
          .in("pilot_callsign", callsigns)
          .order("scoring_applied_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    callsigns.length
      ? admin.from("pilot_accounts").select("*").in("callsign", callsigns)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const recentFlightByCallsign = new Map<string, Record<string, unknown>>();
  for (const row of recentFlightsResult.data ?? []) {
    const callsign =
      typeof row.pilot_callsign === "string" ? row.pilot_callsign : "";

    if (callsign && !recentFlightByCallsign.has(callsign)) {
      recentFlightByCallsign.set(callsign, row);
    }
  }

  const accountByCallsign = new Map<string, Record<string, unknown>>();
  for (const row of pilotAccountsResult.data ?? []) {
    const callsign = typeof row.callsign === "string" ? row.callsign : "";
    if (callsign) {
      accountByCallsign.set(callsign, row);
    }
  }

  return pilots.map((pilot) => {
    const callsign =
      typeof pilot.callsign === "string" ? pilot.callsign : "";

    return {
      ...pilot,
      last_flight: recentFlightByCallsign.get(callsign) ?? null,
      account: accountByCallsign.get(callsign) ?? null,
    } satisfies PilotRow;
  });
}

export async function getFleet(
  search?: string,
  status?: string,
  hub?: string
): Promise<FleetRow[]> {
  const admin = createAdminSupabaseClient();

  let query = admin.from("aircraft_fleet").select("*").order("registration", {
    ascending: true,
  });

  if (env.airlineId) {
    query = query.eq("airline_id", env.airlineId);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (hub && hub !== "all") {
    query = query.or(`home_hub_icao.eq.${hub},current_airport_icao.eq.${hub}`);
  }

  if (search) {
    const value = sanitizeLike(search);
    query = query.or(
      `registration.ilike.*${value}*,variant.ilike.*${value}*,aircraft_type.ilike.*${value}*`
    );
  }

  const { data } = await query.limit(250);
  const fleet = (data ?? []) as Record<string, unknown>[];
  const aircraftIds = fleet
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);
  const lastFlightIds = fleet
    .map((row) => (typeof row.last_flight_id === "string" ? row.last_flight_id : ""))
    .filter(Boolean);

  const [conditionResult, displayResult, lastFlightsResult] = await Promise.all([
    aircraftIds.length
      ? admin.from("aircraft_condition").select("*").in("aircraft_id", aircraftIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    fleet.length
      ? admin
          .from("v_aircraft_fleet_display")
          .select("*")
          .in(
            "registration",
            fleet
              .map((row) =>
                typeof row.registration === "string" ? row.registration : ""
              )
              .filter(Boolean)
          )
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    lastFlightIds.length
      ? admin.from("flight_logs").select("*").in("id", lastFlightIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const conditionByAircraft = new Map<string, Record<string, unknown>>();
  for (const row of conditionResult.data ?? []) {
    const id = typeof row.aircraft_id === "string" ? row.aircraft_id : "";
    if (id) {
      conditionByAircraft.set(id, row);
    }
  }

  const displayByRegistration = new Map<string, Record<string, unknown>>();
  for (const row of displayResult.data ?? []) {
    const registration =
      typeof row.registration === "string" ? row.registration : "";
    if (registration) {
      displayByRegistration.set(registration, row);
    }
  }

  const lastFlightById = new Map<string, Record<string, unknown>>();
  for (const row of lastFlightsResult.data ?? []) {
    const id = typeof row.id === "string" ? row.id : "";
    if (id) {
      lastFlightById.set(id, row);
    }
  }

  return fleet.map((row) => {
    const id = typeof row.id === "string" ? row.id : "";
    const registration =
      typeof row.registration === "string" ? row.registration : "";
    const lastFlightId =
      typeof row.last_flight_id === "string" ? row.last_flight_id : "";

    return {
      ...row,
      condition: id ? conditionByAircraft.get(id) ?? null : null,
      display: registration
        ? displayByRegistration.get(registration) ?? null
        : null,
      last_flight: lastFlightId ? lastFlightById.get(lastFlightId) ?? null : null,
    } satisfies FleetRow;
  });
}

export async function getModelsData(): Promise<{
  models: GenericRow[];
  types: GenericRow[];
  variants: GenericRow[];
  operationRules: GenericRow[];
}> {
  const admin = createAdminSupabaseClient();

  const [models, types, variants, operationRules] = await Promise.all([
    admin.from("aircraft_models").select("*").order("code", { ascending: true }),
    admin.from("aircraft_types").select("*").order("sort_order", { ascending: true }),
    admin.from("aircraft_variants").select("*").order("code", { ascending: true }),
    admin
      .from("aircraft_type_operation_rules")
      .select("*")
      .order("aircraft_type_code", { ascending: true }),
  ]);

  return {
    models: (models.data ?? []) as Record<string, unknown>[],
    types: (types.data ?? []) as Record<string, unknown>[],
    variants: (variants.data ?? []) as Record<string, unknown>[],
    operationRules: (operationRules.data ?? []) as Record<string, unknown>[],
  };
}

export async function getOperationsData(
  status?: string,
  search?: string
): Promise<OperationRow[]> {
  const admin = createAdminSupabaseClient();

  let query = admin
    .from("flight_reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    const value = sanitizeLike(search);
    query = query.or(
      `reservation_code.ilike.*${value}*,pilot_callsign.ilike.*${value}*,aircraft_registration.ilike.*${value}*,origin_ident.ilike.*${value}*,destination_ident.ilike.*${value}*`
    );
  }

  const { data } = await query.limit(150);
  const reservations = (data ?? []) as Record<string, unknown>[];
  const reservationIds = reservations
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);

  const [dispatchResult, scoreReportsResult, fleetResult] = await Promise.all([
    reservationIds.length
      ? admin
          .from("dispatch_packages")
          .select("*")
          .in("reservation_id", reservationIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    reservationIds.length
      ? admin
          .from("pw_flight_score_reports")
          .select("*")
          .in("reservation_id", reservationIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    admin.from("aircraft_fleet").select("registration,current_airport_icao"),
  ]);

  const dispatchByReservation = new Map<string, Record<string, unknown>>();
  for (const row of dispatchResult.data ?? []) {
    const id = typeof row.reservation_id === "string" ? row.reservation_id : "";
    if (id) {
      dispatchByReservation.set(id, row);
    }
  }

  const scoreByReservation = new Map<string, Record<string, unknown>>();
  for (const row of scoreReportsResult.data ?? []) {
    const id = typeof row.reservation_id === "string" ? row.reservation_id : "";
    if (id) {
      scoreByReservation.set(id, row);
    }
  }

  const aircraftLocationByRegistration = new Map<string, string>();
  for (const row of fleetResult.data ?? []) {
    const registration =
      typeof row.registration === "string" ? row.registration : "";
    const airport =
      typeof row.current_airport_icao === "string"
        ? row.current_airport_icao
        : "";
    if (registration) {
      aircraftLocationByRegistration.set(registration, airport);
    }
  }

  const rows = reservations.map((reservation) => {
    const id = typeof reservation.id === "string" ? reservation.id : "";
    const registration =
      typeof reservation.aircraft_registration === "string"
        ? reservation.aircraft_registration
        : "";
    const origin =
      typeof reservation.origin_ident === "string" ? reservation.origin_ident : "";

    return {
      ...reservation,
      dispatch: id ? dispatchByReservation.get(id) ?? null : null,
      score_report: id ? scoreByReservation.get(id) ?? null : null,
      aircraft_location:
        registration ? aircraftLocationByRegistration.get(registration) ?? null : null,
      location_mismatch:
        registration && origin
          ? (aircraftLocationByRegistration.get(registration) ?? origin) !== origin
          : false,
    } satisfies OperationRow;
  });

  return rows;
}

export async function getRulesData(): Promise<{
  flightModes: GenericRow[];
  operationRules: GenericRow[];
  damageRules: GenericRow[];
  scoreReports: GenericRow[];
}> {
  const admin = createAdminSupabaseClient();

  const [flightModes, operationRules, damageRules, scoreReports] = await Promise.all([
    admin.from("pw_flight_modes").select("*").order("code", { ascending: true }),
    admin
      .from("aircraft_type_operation_rules")
      .select("*")
      .order("aircraft_type_code", { ascending: true }),
    admin
      .from("aircraft_damage_rule_catalog")
      .select("*")
      .order("event_code", { ascending: true }),
    admin
      .from("pw_flight_score_reports")
      .select(
        "reservation_id,pilot_callsign,route_code,procedure_score,mission_score,performance_score,procedure_grade,performance_grade,scored_at"
      )
      .order("scored_at", { ascending: false })
      .limit(30),
  ]);

  return {
    flightModes: (flightModes.data ?? []) as Record<string, unknown>[],
    operationRules: (operationRules.data ?? []) as Record<string, unknown>[],
    damageRules: (damageRules.data ?? []) as Record<string, unknown>[],
    scoreReports: (scoreReports.data ?? []) as Record<string, unknown>[],
  };
}

export async function getRequestsData(): Promise<{
  hoursTransfers: GenericRow[];
  promotions: GenericRow[];
  messagesAvailable: boolean;
}> {
  const admin = createAdminSupabaseClient();

  const [hoursTransfers, promotions] = await Promise.all([
    admin
      .from("pw_hours_transfer_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("pw_rank_promotion_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return {
    hoursTransfers: (hoursTransfers.data ?? []) as Record<string, unknown>[],
    promotions: (promotions.data ?? []) as Record<string, unknown>[],
    messagesAvailable: false,
  };
}

export async function getSettingsData(): Promise<{
  providers: GenericRow[];
  releases: GenericRow[];
  airlines: GenericRow[];
}> {
  const admin = createAdminSupabaseClient();
  const [providers, releases, airlines] = await Promise.all([
    admin
      .from("integration_providers")
      .select("*")
      .order("provider_code", { ascending: true }),
    admin
      .from("acars_releases")
      .select("*")
      .order("release_date", { ascending: false }),
    admin.from("airlines").select("*").limit(10),
  ]);

  return {
    providers: (providers.data ?? []) as Record<string, unknown>[],
    releases: (releases.data ?? []) as Record<string, unknown>[],
    airlines: (airlines.data ?? []) as Record<string, unknown>[],
  };
}

export async function getAuditData(): Promise<{
  reservationAudit: GenericRow[];
  aircraftMovements: GenericRow[];
  flightLogs: GenericRow[];
}> {
  const admin = createAdminSupabaseClient();
  const [reservationAudit, aircraftMovements, flightLogs] = await Promise.all([
    admin
      .from("flight_reservation_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("aircraft_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("flight_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return {
    reservationAudit: (reservationAudit.data ?? []) as Record<string, unknown>[],
    aircraftMovements: (aircraftMovements.data ?? []) as Record<string, unknown>[],
    flightLogs: (flightLogs.data ?? []) as Record<string, unknown>[],
  };
}


export type CareerRankSnapshot = {
  rank: GenericRow;
  requirement: GenericRow | null;
  aircraft: GenericRow[];
  theoryModules: GenericRow[];
  specialQualifications: GenericRow[];
};

async function safeSelect<T = GenericRow>(promise: Promise<{ data: T[] | null; error: unknown }>) {
  try {
    const result = await promise;
    return Array.isArray(result.data) ? result.data : [];
  } catch {
    return [] as T[];
  }
}

export async function getCareerData(): Promise<{
  ranks: CareerRankSnapshot[];
  toursConfigured: boolean;
  rawCounts: {
    requirements: number;
    theoryCatalog: number;
    qualificationCatalog: number;
  };
}> {
  const admin = createAdminSupabaseClient();

  const [
    ranks,
    aircraftPermissions,
    requirements,
    theoryCatalog,
    theoryRequirements,
    qualificationCatalog,
    qualificationRequirements,
    tours,
    aircraftTypes,
  ] = await Promise.all([
    safeSelect(admin.from("pilot_ranks").select("*").eq("is_active", true).order("sort_order", { ascending: true })),
    safeSelect(admin.from("pilot_rank_aircraft_permissions").select("rank_code,aircraft_type_code")),
    safeSelect(admin.from("pw_rank_requirements").select("*")),
    safeSelect(admin.from("pw_rank_theory_catalog").select("*").eq("is_active", true).order("sort_order", { ascending: true })),
    safeSelect(admin.from("pw_rank_theory_requirements").select("rank_code,theory_code,is_required")),
    safeSelect(admin.from("pw_special_qualification_catalog").select("*").eq("is_active", true).order("sort_order", { ascending: true })),
    safeSelect(admin.from("pw_rank_special_qualification_requirements").select("rank_code,qualification_code,is_required")),
    safeSelect(admin.from("pw_tour_catalog").select("code").eq("is_published", true)),
    safeSelect(admin.from("aircraft_types").select("code,variant_name,manufacturer,family,sort_order").eq("is_active", true).order("sort_order", { ascending: true })),
  ]);

  const aircraftTypeByCode = new Map<string, GenericRow>();
  for (const row of aircraftTypes as GenericRow[]) {
    aircraftTypeByCode.set(String(row.code), row);
  }

  const requirementByRank = new Map<string, GenericRow>();
  for (const row of requirements as GenericRow[]) {
    requirementByRank.set(String(row.rank_code), row);
  }

  const theoryByCode = new Map<string, GenericRow>();
  for (const row of theoryCatalog as GenericRow[]) {
    theoryByCode.set(String(row.code), row);
  }

  const qualificationByCode = new Map<string, GenericRow>();
  for (const row of qualificationCatalog as GenericRow[]) {
    qualificationByCode.set(String(row.code), row);
  }

  const aircraftByRank = new Map<string, GenericRow[]>();
  for (const row of aircraftPermissions as GenericRow[]) {
    const rankCode = String(row.rank_code ?? "");
    const typeCode = String(row.aircraft_type_code ?? "");
    if (!rankCode || !typeCode) continue;
    const current = aircraftByRank.get(rankCode) ?? [];
    current.push(aircraftTypeByCode.get(typeCode) ?? { code: typeCode, variant_name: typeCode });
    aircraftByRank.set(rankCode, current);
  }

  const theoryByRank = new Map<string, GenericRow[]>();
  for (const row of theoryRequirements as GenericRow[]) {
    const rankCode = String(row.rank_code ?? "");
    const theoryCode = String(row.theory_code ?? "");
    if (!rankCode || !theoryCode) continue;
    const current = theoryByRank.get(rankCode) ?? [];
    current.push(theoryByCode.get(theoryCode) ?? { code: theoryCode, title: theoryCode });
    theoryByRank.set(rankCode, current);
  }

  const qualificationsByRank = new Map<string, GenericRow[]>();
  for (const row of qualificationRequirements as GenericRow[]) {
    const rankCode = String(row.rank_code ?? "");
    const qualificationCode = String(row.qualification_code ?? "");
    if (!rankCode || !qualificationCode) continue;
    const current = qualificationsByRank.get(rankCode) ?? [];
    current.push(
      qualificationByCode.get(qualificationCode) ?? {
        code: qualificationCode,
        name: qualificationCode,
      }
    );
    qualificationsByRank.set(rankCode, current);
  }

  return {
    ranks: (ranks as GenericRow[]).map((rank) => ({
      rank,
      requirement: requirementByRank.get(String(rank.code)) ?? null,
      aircraft: aircraftByRank.get(String(rank.code)) ?? [],
      theoryModules: theoryByRank.get(String(rank.code)) ?? [],
      specialQualifications: qualificationsByRank.get(String(rank.code)) ?? [],
    })),
    toursConfigured: (tours as GenericRow[]).length > 0,
    rawCounts: {
      requirements: (requirements as GenericRow[]).length,
      theoryCatalog: (theoryCatalog as GenericRow[]).length,
      qualificationCatalog: (qualificationCatalog as GenericRow[]).length,
    },
  };
}
