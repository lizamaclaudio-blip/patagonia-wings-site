import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getUserFromAccessToken } from "@/lib/supabase/server";

type TransferMode = "ground_bus" | "ground_taxi" | "air_ticket";

type PilotProfile = {
  id: string;
  current_airport_icao?: string | null;
  current_airport_code?: string | null;
  base_hub?: string | null;
  wallet_balance?: number | string | null;
};

type AirportRow = {
  ident: string;
  name: string | null;
  municipality: string | null;
  iso_country: string | null;
  airport_type?: string | null;
  is_active?: boolean | null;
  is_hub?: boolean | null;
  hub_code?: string | null;
  category?: string | null;
  latitude_deg?: number | string | null;
  longitude_deg?: number | string | null;
};

type TransferDestinationRow = {
  airport_ident: string;
  mode: TransferMode | string;
  is_active: boolean | null;
  display_priority: number | string | null;
};

type AircraftRow = {
  id: string;
  status?: string | null;
  is_active?: boolean | null;
  current_airport_code?: string | null;
  current_airport_icao?: string | null;
  home_hub_icao?: string | null;
  hub_code?: string | null;
};

type TransferOption = {
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

const ALLOWED_MODES: TransferMode[] = ["ground_taxi", "ground_bus", "air_ticket"];
const DEFAULT_HUBS: Array<{ airport_ident: string; mode: TransferMode; display_priority: number }> = [
  { airport_ident: "SCEL", mode: "air_ticket", display_priority: 10 },
  { airport_ident: "SCTE", mode: "air_ticket", display_priority: 20 },
  { airport_ident: "SCCI", mode: "air_ticket", display_priority: 30 },
  { airport_ident: "SAEZ", mode: "air_ticket", display_priority: 40 },
  { airport_ident: "SABE", mode: "air_ticket", display_priority: 50 },
  { airport_ident: "SACO", mode: "air_ticket", display_priority: 60 },
  { airport_ident: "SPJC", mode: "air_ticket", display_priority: 70 },
  { airport_ident: "SBGR", mode: "air_ticket", display_priority: 80 },
  { airport_ident: "KMIA", mode: "air_ticket", display_priority: 90 },
  { airport_ident: "KJFK", mode: "air_ticket", display_priority: 100 },
  { airport_ident: "KLAX", mode: "air_ticket", display_priority: 110 },
];

const TAXI_CITY_GROUPS: string[][] = [
  ["SCEL", "SCTB"],
  ["SCTE", "SCPF"],
  ["SABE", "SADF", "SADM", "SAEZ"],
];

function normalizeCity(value: unknown) {
  return typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase()
    : "";
}

function isTransferEligibleAirport(airport?: AirportRow | null) {
  if (!airport || airport.is_active === false) return false;

  const airportType = (airport.airport_type ?? "").trim().toLowerCase();
  const airportName = (airport.name ?? "").trim().toLowerCase();

  return !(
    airportType.includes("heli") ||
    airportType.includes("closed") ||
    airportType.includes("balloonport") ||
    airportName.includes("helipuerto") ||
    airportName.includes("heliport")
  );
}

function getTaxiGroupCandidates(originIdent: string) {
  const group = TAXI_CITY_GROUPS.find((items) => items.includes(originIdent));
  return group?.filter((ident) => ident !== originIdent) ?? [];
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("Falta Authorization Bearer.");
  }
  return authorization.slice(7).trim();
}

function normalizeTransferMode(value: unknown): TransferMode {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "ground_bus" || normalized === "ground_taxi" || normalized === "air_ticket") {
    return normalized;
  }
  throw new Error("Modo de traslado inválido.");
}

function normalizeIdent(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{4}$/.test(normalized)) {
    throw new Error("Destino inválido.");
  }
  return normalized;
}

function normalizeAirport(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getProfileAirport(profile: PilotProfile) {
  return (
    normalizeAirport(profile.current_airport_icao) ||
    normalizeAirport(profile.current_airport_code) ||
    normalizeAirport(profile.base_hub) ||
    "SCTB"
  );
}

function isHubAirport(airport?: AirportRow | null) {
  if (!airport) return false;
  const category = (airport.category ?? "").trim().toUpperCase();
  return Boolean(
    airport.is_hub ||
      (airport.hub_code ?? "").trim() ||
      category.startsWith("H0") ||
      category.startsWith("H1") ||
      category.startsWith("H2") ||
      category.startsWith("H3"),
  );
}

function airportDistanceNm(origin: AirportRow, destination: AirportRow) {
  const lat1 = toNumber(origin.latitude_deg, NaN);
  const lon1 = toNumber(origin.longitude_deg, NaN);
  const lat2 = toNumber(destination.latitude_deg, NaN);
  const lon2 = toNumber(destination.longitude_deg, NaN);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return null;
  }

  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const rNm = 3440.065;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(rNm * c * 10) / 10;
}

function calculateTransferCostUsd(mode: TransferMode, distanceNm: number | null) {
  const distance = Math.max(distanceNm ?? 0, 0);

  if (mode === "ground_taxi") {
    return Math.round(Math.min(45, Math.max(8, 10 + distance * 1.2)) * 100) / 100;
  }

  if (mode === "ground_bus") {
    return Math.round(Math.min(120, Math.max(12, 15 + distance * 0.055)) * 100) / 100;
  }

  return Math.round(Math.min(650, Math.max(55, 45 + distance * 0.075)) * 100) / 100;
}

function aircraftAtAirport(row: AircraftRow, airportIdent: string) {
  return [row.current_airport_code, row.current_airport_icao, row.home_hub_icao, row.hub_code]
    .map(normalizeAirport)
    .includes(airportIdent);
}

function isAvailableAircraft(row: AircraftRow) {
  const status = (row.status ?? "available").trim().toLowerCase();
  return row.is_active !== false && ["available", "active", "ready"].includes(status);
}

async function loadPilotProfile(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
  const { data, error } = await supabase
    .from("pilot_profiles")
    .select("id,current_airport_icao,current_airport_code,base_hub,wallet_balance")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("No existe perfil de piloto.");
  }

  return data as PilotProfile;
}

async function buildTransferOptions(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
): Promise<TransferOption[]> {
  const profile = await loadPilotProfile(supabase, userId);
  const originIdent = getProfileAirport(profile);
  const walletBalance = toNumber(profile.wallet_balance, 0);

  const { data: originAirportRow, error: originAirportError } = await supabase
    .from("airports")
    .select("ident,name,municipality,iso_country,airport_type,is_active,is_hub,hub_code,category,latitude_deg,longitude_deg")
    .eq("ident", originIdent)
    .maybeSingle();

  if (originAirportError) {
    throw new Error(originAirportError.message);
  }

  if (!originAirportRow) {
    throw new Error(`No se encontró el aeropuerto actual ${originIdent}.`);
  }

  const originAirport = originAirportRow as AirportRow;
  if (!isTransferEligibleAirport(originAirport)) {
    throw new Error("El aeropuerto actual no es válido para traslados de piloto.");
  }

  const originCountry = originAirport.iso_country ?? null;
  const originCity = normalizeCity(originAirport.municipality);

  const { data: transferRows, error: transferError } = await supabase
    .from("pw_transfer_destinations")
    .select("airport_ident,mode,is_active,display_priority")
    .eq("is_active", true)
    .in("mode", ALLOWED_MODES);

  if (transferError) {
    throw new Error(transferError.message);
  }

  const configuredDestinations = ((transferRows ?? []) as TransferDestinationRow[])
    .filter((row) => ALLOWED_MODES.includes(row.mode as TransferMode))
    .map((row) => ({
      airport_ident: normalizeAirport(row.airport_ident),
      mode: row.mode as TransferMode,
      display_priority: toNumber(row.display_priority, 100),
    }));

  const sameCityConfiguredAirportIdents = configuredDestinations
    .filter((item) => item.mode === "ground_taxi")
    .map((item) => item.airport_ident);

  const taxiGroupCandidates = getTaxiGroupCandidates(originIdent);

  let sameMunicipalityAirportIdents: string[] = [];
  if (originCountry && originCity && originAirport.municipality) {
    const { data: sameMunicipalityRows } = await supabase
      .from("airports")
      .select("ident,airport_type,name,is_active")
      .eq("iso_country", originCountry)
      .eq("municipality", originAirport.municipality)
      .eq("is_active", true)
      .limit(30);

    sameMunicipalityAirportIdents = ((sameMunicipalityRows ?? []) as AirportRow[])
      .filter((row) => isTransferEligibleAirport(row))
      .map((row) => normalizeAirport(row.ident));
  }

  const requestedAirportIdents = Array.from(
    new Set([
      originIdent,
      ...configuredDestinations.map((item) => item.airport_ident),
      ...DEFAULT_HUBS.map((item) => item.airport_ident),
      ...taxiGroupCandidates,
      ...sameCityConfiguredAirportIdents,
      ...sameMunicipalityAirportIdents,
    ]),
  ).filter(Boolean);

  const { data: airportRows, error: airportError } = await supabase
    .from("airports")
    .select("ident,name,municipality,iso_country,airport_type,is_active,is_hub,hub_code,category,latitude_deg,longitude_deg")
    .in("ident", requestedAirportIdents);

  if (airportError) {
    throw new Error(airportError.message);
  }

  const airports = new Map<string, AirportRow>();
  airports.set(originIdent, originAirport);
  for (const airport of (airportRows ?? []) as AirportRow[]) {
    airports.set(normalizeAirport(airport.ident), airport);
  }

  const isOriginHub = isHubAirport(originAirport);

  let hasAvailableAircraftAtOrigin = false;
  if (!isOriginHub) {
    const { data: aircraftRows } = await supabase
      .from("aircraft")
      .select("id,status,is_active,current_airport_code,current_airport_icao,home_hub_icao,hub_code")
      .or(
        `current_airport_code.eq.${originIdent},current_airport_icao.eq.${originIdent},home_hub_icao.eq.${originIdent},hub_code.eq.${originIdent}`,
      )
      .limit(200);

    hasAvailableAircraftAtOrigin = ((aircraftRows ?? []) as AircraftRow[]).some(
      (row) => aircraftAtAirport(row, originIdent) && isAvailableAircraft(row),
    );
  }

  const abandonmentPenaltyUsd = !isOriginHub && hasAvailableAircraftAtOrigin ? 350 : 0;

  const sameCityTaxiDestinations = Array.from(
    new Set(
      Array.from(airports.values())
        .filter((airport) => {
          const ident = normalizeAirport(airport.ident);
          if (!ident || ident === originIdent || !isTransferEligibleAirport(airport)) return false;
          if (originCountry && airport.iso_country !== originCountry) return false;
          const airportCity = normalizeCity(airport.municipality);
          return Boolean(
            taxiGroupCandidates.includes(ident) ||
              sameCityConfiguredAirportIdents.includes(ident) ||
              (originCity && airportCity && airportCity === originCity),
          );
        })
        .map((airport) => normalizeAirport(airport.ident)),
    ),
  );

  const taxiDestinations = sameCityTaxiDestinations.map((airportIdent, index) => ({
    airport_ident: airportIdent,
    mode: "ground_taxi" as TransferMode,
    display_priority: 5 + index,
  }));

  const allDestinations = [...configuredDestinations, ...taxiDestinations, ...DEFAULT_HUBS];
  const deduped = new Map<string, { airport_ident: string; mode: TransferMode; display_priority: number }>();

  for (const item of allDestinations) {
    const airportIdent = normalizeAirport(item.airport_ident);
    if (!airportIdent || airportIdent === originIdent) continue;
    const key = `${item.mode}:${airportIdent}`;
    const existing = deduped.get(key);
    if (!existing || item.display_priority < existing.display_priority) {
      deduped.set(key, { ...item, airport_ident: airportIdent });
    }
  }

  const priced = Array.from(deduped.values())
    .map((item) => {
      const destination = airports.get(item.airport_ident);
      if (!destination || !isTransferEligibleAirport(destination)) return null;

      const destinationCity = normalizeCity(destination.municipality);
      const sameCity = Boolean(
        taxiGroupCandidates.includes(item.airport_ident) ||
          (originCity && destinationCity && destinationCity === originCity),
      );

      if (item.mode === "ground_taxi" && !sameCity) return null;
      if (item.mode === "ground_bus" && originCountry && destination.iso_country !== originCountry) return null;
      if (item.mode === "ground_bus" && sameCity) return null;

      const distanceNm = airportDistanceNm(originAirport, destination);
      const travelCostUsd = calculateTransferCostUsd(item.mode, distanceNm);
      const totalCostUsd = Math.round((travelCostUsd + abandonmentPenaltyUsd) * 100) / 100;

      return {
        mode: item.mode,
        origin_ident: originIdent,
        destination_ident: item.airport_ident,
        destination_name: destination.name ?? null,
        destination_city: destination.municipality ?? null,
        destination_country: destination.iso_country ?? null,
        distance_nm: distanceNm,
        travel_cost_usd: travelCostUsd,
        abandonment_penalty_usd: abandonmentPenaltyUsd,
        total_cost_usd: totalCostUsd,
        wallet_balance_usd: walletBalance,
        can_afford: walletBalance >= totalCostUsd,
        reason:
          walletBalance < totalCostUsd
            ? "Saldo insuficiente"
            : abandonmentPenaltyUsd > 0
              ? "Incluye multa por abandono operacional fuera de hub"
              : item.mode === "ground_taxi"
                ? "Taxi urbano sin multa operacional desde hub o sin abandono fuera de hub"
                : "Traslado sin multa operacional",
        displayPriority: item.display_priority,
      } satisfies TransferOption & { displayPriority: number };
    })
    .filter(Boolean) as Array<TransferOption & { displayPriority: number }>;

  return ALLOWED_MODES.flatMap((mode) =>
    priced
      .filter((option) => option.mode === mode)
      .sort((a, b) => {
        const sameCountryA = a.destination_country === originCountry ? 0 : 1;
        const sameCountryB = b.destination_country === originCountry ? 0 : 1;
        return (
          sameCountryA - sameCountryB ||
          a.displayPriority - b.displayPriority ||
          (a.distance_nm ?? Number.POSITIVE_INFINITY) - (b.distance_nm ?? Number.POSITIVE_INFINITY) ||
          a.destination_ident.localeCompare(b.destination_ident)
        );
      })
      .slice(0, 4)
      .map(({ displayPriority: _displayPriority, ...option }) => option),
  );
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    const user = await getUserFromAccessToken(accessToken);
    const supabase = createSupabaseServerClient(accessToken);

    const options = await buildTransferOptions(supabase, user.id);

    return NextResponse.json({ ok: true, options });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar alternativas de traslado." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    const user = await getUserFromAccessToken(accessToken);
    const supabase = createSupabaseServerClient(accessToken);
    const payload = (await request.json()) as { mode?: unknown; destinationIdent?: unknown };

    const mode = normalizeTransferMode(payload.mode);
    const destinationIdent = normalizeIdent(payload.destinationIdent);
    const profile = await loadPilotProfile(supabase, user.id);
    const options = await buildTransferOptions(supabase, user.id);
    const selected = options.find((option) => option.mode === mode && option.destination_ident === destinationIdent);

    if (!selected) {
      throw new Error("Ese traslado no está disponible desde tu ubicación actual.");
    }

    if (!selected.can_afford) {
      throw new Error("Saldo insuficiente para ejecutar el traslado.");
    }

    const walletBefore = toNumber(profile.wallet_balance, 0);
    const walletAfter = Math.round((walletBefore - selected.total_cost_usd) * 100) / 100;

    const { error: updateError } = await supabase
      .from("pilot_profiles")
      .update({
        current_airport_icao: selected.destination_ident,
        current_airport_code: selected.destination_ident,
        wallet_balance: walletAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { data: ledgerRow } = await supabase
      .from("pw_pilot_transfer_ledger")
      .insert({
        pilot_id: user.id,
        mode: selected.mode,
        origin_ident: selected.origin_ident,
        destination_ident: selected.destination_ident,
        distance_nm: selected.distance_nm,
        travel_cost_usd: selected.travel_cost_usd,
        abandonment_penalty_usd: selected.abandonment_penalty_usd,
        total_cost_usd: selected.total_cost_usd,
        wallet_before_usd: walletBefore,
        wallet_after_usd: walletAfter,
        reason: selected.reason,
      })
      .select("id")
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      destinationIdent: selected.destination_ident,
      totalCostUsd: selected.total_cost_usd,
      walletBalanceUsd: walletAfter,
      result: {
        transfer_id: ledgerRow?.id ?? null,
        mode: selected.mode,
        origin_ident: selected.origin_ident,
        destination_ident: selected.destination_ident,
        travel_cost_usd: selected.travel_cost_usd,
        abandonment_penalty_usd: selected.abandonment_penalty_usd,
        total_cost_usd: selected.total_cost_usd,
        wallet_balance_usd: walletAfter,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar el traslado." },
      { status: 500 },
    );
  }
}
