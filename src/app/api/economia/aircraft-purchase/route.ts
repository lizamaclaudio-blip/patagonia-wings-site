import { NextResponse } from "next/server";
import { createSupabaseServerClient, getUserFromAccessToken } from "@/lib/supabase/server";
import { estimateAircraftMarketValueUsd } from "@/lib/pilot-economy";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, unknown>;

type PurchaseBody = {
  aircraftType?: string;
  targetHubIcao?: string;
  quantity?: number;
  requestedByCallsign?: string;
  allowBelowReserve?: boolean;
};


const DEFAULT_OWNER_CALLSIGNS = ["PWG001"];

function parseOwnerList(value: string | undefined, fallback: string[]) {
  const parsed = (value ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function isOwnerIdentity(callsign?: string | null, email?: string | null) {
  const ownerCallsigns = parseOwnerList(process.env.PWG_OWNER_CALLSIGNS ?? process.env.NEXT_PUBLIC_PWG_OWNER_CALLSIGNS, DEFAULT_OWNER_CALLSIGNS);
  const ownerEmails = parseOwnerList(process.env.PWG_OWNER_EMAILS ?? process.env.NEXT_PUBLIC_PWG_OWNER_EMAILS, []);
  const normalizedCallsign = (callsign ?? "").trim().toUpperCase();
  const normalizedEmail = (email ?? "").trim().toUpperCase();
  return Boolean(
    (normalizedCallsign && ownerCallsigns.includes(normalizedCallsign)) ||
    (normalizedEmail && ownerEmails.includes(normalizedEmail))
  );
}

function extractBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

async function assertAircraftPurchaseOwner(request: Request) {
  const token = extractBearerToken(request);
  if (!token) {
    throw new Error("Compra restringida: falta sesión administrativa.");
  }

  const user = await getUserFromAccessToken(token);
  const supabase = createSupabaseServerClient(token);
  const { data: profile, error } = await supabase
    .from("pilot_profiles")
    .select("callsign, email")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo validar el perfil administrador: ${error.message}`);
  }

  const callsign = typeof profile?.callsign === "string" ? profile.callsign : "";
  const email = typeof profile?.email === "string" ? profile.email : user.email ?? "";

  if (!isOwnerIdentity(callsign, email)) {
    throw new Error("Compra restringida: solo la dirección de Patagonia Wings puede comprar aeronaves.");
  }

  return { token, callsign, email };
}

const FACTORY_BY_TYPE: Record<string, string> = {
  C208: "Cessna/Textron · Wichita",
  B350: "Beechcraft/Textron · Wichita",
  ATR72: "ATR · Toulouse",
  E175: "Embraer · São José dos Campos",
  E190: "Embraer · São José dos Campos",
  A319: "Airbus · Hamburg/Toulouse",
  A320: "Airbus · Hamburg/Toulouse",
  A321: "Airbus · Hamburg/Toulouse",
  B736: "Boeing · Renton",
  B738: "Boeing · Renton",
  B739: "Boeing · Renton",
  B38M: "Boeing · Renton",
  A339: "Airbus · Toulouse",
  A359: "Airbus · Toulouse",
  B789: "Boeing · Everett/Charleston",
  B77W: "Boeing · Everett",
  B747: "Boeing · Everett",
};

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function normalizeType(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code) return "";
  if (code.startsWith("A20N")) return "A320";
  if (code.startsWith("A21N")) return "A321";
  if (code.startsWith("B738") || code.startsWith("B7378")) return "B738";
  if (code.startsWith("B739") || code.startsWith("B7379")) return "B739";
  if (code.startsWith("B38M") || code.includes("MAX8")) return "B38M";
  if (code.startsWith("B789") || code.startsWith("B787")) return "B789";
  if (code.startsWith("A339") || code.startsWith("A330")) return "A339";
  if (code.startsWith("B77") || code.startsWith("B777")) return "B77W";
  if (code.startsWith("B747") || code.startsWith("B74")) return "B747";
  if (code.startsWith("AT7") || code.startsWith("ATR")) return "ATR72";
  if (code.startsWith("E17")) return "E175";
  if (code.startsWith("E19")) return "E190";
  return code.slice(0, 8);
}

function normalizeHub(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function countryForHub(hub: string) {
  if (hub.startsWith("SC")) return "CL";
  if (hub.startsWith("SA")) return "AR";
  if (hub.startsWith("SB")) return "BR";
  if (hub.startsWith("SP")) return "PE";
  if (hub.startsWith("SU")) return "UY";
  if (hub.startsWith("K")) return "US";
  return "CL";
}

function registrationPrefix(countryCode: string) {
  if (countryCode === "AR") return "LV-PWG";
  if (countryCode === "BR") return "PR-PWG";
  if (countryCode === "US") return "N-PWG";
  return "CC-PWG";
}

async function getAirline(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data, error } = await supabase
    .from("airlines")
    .select("id, name, balance_usd")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "No existe aerolínea configurada.");
  }

  return data as AnyRow;
}

async function getAircraftPrice(supabase: ReturnType<typeof createSupabaseServerClient>, aircraftType: string) {
  const { data } = await supabase
    .from("aircraft_asset_values")
    .select("aircraft_type, estimated_purchase_price_usd, estimated_monthly_fixed_cost_usd, estimated_hourly_maintenance_usd, metadata")
    .eq("aircraft_type", aircraftType)
    .maybeSingle();

  const row = (data ?? {}) as AnyRow;
  return {
    aircraftType,
    purchasePriceUsd: roundMoney(asNumber(row.estimated_purchase_price_usd) || estimateAircraftMarketValueUsd(aircraftType)),
    monthlyFixedCostUsd: roundMoney(asNumber(row.estimated_monthly_fixed_cost_usd)),
    hourlyMaintenanceUsd: roundMoney(asNumber(row.estimated_hourly_maintenance_usd)),
    factory: typeof row.metadata === "object" && row.metadata && "factory" in row.metadata
      ? String((row.metadata as Record<string, unknown>).factory ?? "")
      : FACTORY_BY_TYPE[aircraftType] ?? "Fábrica del fabricante",
  };
}

async function recalculateAirlineBalance(supabase: ReturnType<typeof createSupabaseServerClient>, airlineId: string) {
  try {
    await supabase.rpc("pw_recalculate_airline_balance", { p_airline_id: airlineId });
  } catch {
    // Fallback manual below keeps the endpoint safe if the RPC is not available.
  }

  const { data: rows } = await supabase
    .from("airline_ledger")
    .select("amount_usd")
    .eq("airline_id", airlineId);

  const amounts = ((rows ?? []) as Array<{ amount_usd?: unknown }>).map((row) => asNumber(row.amount_usd));
  const balance = roundMoney(amounts.reduce((sum, n) => sum + n, 0));
  const revenue = roundMoney(amounts.filter((n) => n > 0).reduce((sum, n) => sum + n, 0));
  const costs = roundMoney(Math.abs(amounts.filter((n) => n < 0).reduce((sum, n) => sum + n, 0)));

  await supabase
    .from("airlines")
    .update({ balance_usd: balance, total_revenue_usd: revenue, total_costs_usd: costs })
    .eq("id", airlineId);
}

async function nextRegistration(supabase: ReturnType<typeof createSupabaseServerClient>, countryCode: string) {
  const prefix = registrationPrefix(countryCode);
  const [{ data: a }, { data: f }] = await Promise.all([
    supabase.from("aircraft").select("registration").ilike("registration", `${prefix}%`).limit(1000),
    supabase.from("aircraft_fleet").select("registration").ilike("registration", `${prefix}%`).limit(1000),
  ]);

  const maxNumber = [...((a ?? []) as AnyRow[]), ...((f ?? []) as AnyRow[])]
    .map((row) => asText(row.registration).match(/(\d{4})$/)?.[1])
    .filter(Boolean)
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);

  return `${prefix}${String(maxNumber + 1).padStart(4, "0")}`;
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const airline = await getAirline(supabase);
    const [{ data: catalog }, { data: requests }] = await Promise.all([
      supabase
        .from("aircraft_asset_values")
        .select("aircraft_type, estimated_purchase_price_usd, estimated_monthly_fixed_cost_usd, estimated_hourly_maintenance_usd, metadata")
        .order("estimated_purchase_price_usd", { ascending: true }),
      supabase
        .from("aircraft_purchase_requests")
        .select("id, aircraft_type, target_hub_icao, estimated_purchase_price_usd, status, delivery_origin, created_at, delivered_at")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const options = ((catalog ?? []) as AnyRow[]).map((row) => ({
      aircraftType: normalizeType(row.aircraft_type),
      estimatedPurchasePriceUsd: roundMoney(asNumber(row.estimated_purchase_price_usd)),
      estimatedMonthlyFixedCostUsd: roundMoney(asNumber(row.estimated_monthly_fixed_cost_usd)),
      estimatedHourlyMaintenanceUsd: roundMoney(asNumber(row.estimated_hourly_maintenance_usd)),
      factory: typeof row.metadata === "object" && row.metadata && "factory" in row.metadata
        ? String((row.metadata as Record<string, unknown>).factory ?? "")
        : FACTORY_BY_TYPE[normalizeType(row.aircraft_type)] ?? "Fábrica del fabricante",
    }));

    return NextResponse.json({
      ok: true,
      airline: {
        id: airline.id,
        name: asText(airline.name) || "Patagonia Wings",
        balanceUsd: roundMoney(asNumber(airline.balance_usd)),
      },
      options,
      recentRequests: requests ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo cargar compra de aeronaves." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const owner = await assertAircraftPurchaseOwner(request);
    const supabase = createSupabaseServerClient(owner.token);
    const body = (await request.json().catch(() => ({}))) as PurchaseBody;
    const aircraftType = normalizeType(body.aircraftType);
    const targetHubIcao = normalizeHub(body.targetHubIcao);
    const quantity = Math.min(Math.max(Math.trunc(Number(body.quantity ?? 1)), 1), 5);

    if (!aircraftType) return NextResponse.json({ ok: false, error: "Falta aircraftType." }, { status: 400 });
    if (!targetHubIcao) return NextResponse.json({ ok: false, error: "Falta targetHubIcao." }, { status: 400 });

    const airline = await getAirline(supabase);
    const airlineId = String(airline.id);
    const price = await getAircraftPrice(supabase, aircraftType);
    const totalPriceUsd = roundMoney(price.purchasePriceUsd * quantity);
    const currentBalance = asNumber(airline.balance_usd);

    if (currentBalance < totalPriceUsd) {
      return NextResponse.json(
        { ok: false, error: "Caja insuficiente para comprar la aeronave.", balanceUsd: currentBalance, requiredUsd: totalPriceUsd },
        { status: 409 }
      );
    }

    const countryCode = countryForHub(targetHubIcao);
    const registrations: string[] = [];
    const createdFleetIds: string[] = [];
    const createdAircraftIds: string[] = [];
    const nowIso = new Date().toISOString();
    const requestRows: AnyRow[] = [];

    for (let i = 0; i < quantity; i += 1) {
      const registration = await nextRegistration(supabase, countryCode);
      registrations.push(registration);
      const referenceCode = `PUR-${aircraftType}-${targetHubIcao}-${Date.now()}-${i + 1}`;

      const { data: purchaseRequest, error: requestError } = await supabase
        .from("aircraft_purchase_requests")
        .insert({
          aircraft_type: aircraftType,
          requested_by_callsign: owner.callsign || body.requestedByCallsign || null,
          target_hub_icao: targetHubIcao,
          estimated_purchase_price_usd: price.purchasePriceUsd,
          delivery_origin: price.factory,
          delivery_destination_icao: targetHubIcao,
          status: "delivered",
          metadata: {
            registration,
            reference_code: referenceCode,
            country_code: countryCode,
            monthly_fixed_cost_usd: price.monthlyFixedCostUsd,
            hourly_maintenance_usd: price.hourlyMaintenanceUsd,
            source: "aircraft_purchase_api_v1",
          },
          created_at: nowIso,
          approved_at: nowIso,
          delivered_at: nowIso,
        })
        .select("id, aircraft_type, target_hub_icao, estimated_purchase_price_usd, status, created_at")
        .maybeSingle();

      if (requestError) throw new Error(requestError.message);
      requestRows.push((purchaseRequest ?? {}) as AnyRow);

      const { data: fleetRow, error: fleetError } = await supabase
        .from("aircraft_fleet")
        .insert({
          airline_id: airlineId,
          registration,
          fleet_code: `${aircraftType}-${registration}`,
          aircraft_type: aircraftType,
          variant: aircraftType,
          home_hub_icao: targetHubIcao,
          current_airport_icao: targetHubIcao,
          status: "available",
          moved_at: nowIso,
          created_at: nowIso,
          maintenance_required: false,
          updated_at: nowIso,
        })
        .select("id")
        .maybeSingle();

      if (!fleetError && fleetRow?.id) createdFleetIds.push(String(fleetRow.id));

      const { data: aircraftRow, error: aircraftError } = await supabase
        .from("aircraft")
        .insert({
          registration,
          fleet_name: `Patagonia Wings ${aircraftType}`,
          aircraft_type_code: aircraftType,
          aircraft_model_code: aircraftType,
          aircraft_variant_code: aircraftType,
          variant_name: aircraftType,
          aircraft_display_name: `Patagonia Wings ${aircraftType} ${registration}`,
          home_hub_code: targetHubIcao,
          current_airport_code: targetHubIcao,
          country_code: countryCode,
          status: "available",
          serial_in_type: Number(registration.match(/(\d{4})$/)?.[1] ?? 1),
          is_active: true,
          notes: `Comprada por economía de aerolínea. Fábrica: ${price.factory}.`,
          provision_source: "airline_purchase",
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id")
        .maybeSingle();

      if (!aircraftError && aircraftRow?.id) {
        createdAircraftIds.push(String(aircraftRow.id));
        await supabase.from("aircraft_condition").insert({
          aircraft_id: aircraftRow.id,
          engine_health: 100,
          fuselage_health: 100,
          gear_health: 100,
          overall_health: 100,
          flight_hours_total: 0,
          cycles_total: 0,
          maintenance_required: false,
          updated_at: nowIso,
        }).then(() => undefined);
      }
    }

    const { data: ledger, error: ledgerError } = await supabase
      .from("airline_ledger")
      .insert({
        airline_id: airlineId,
        entry_type: "aircraft_purchase",
        amount_usd: -totalPriceUsd,
        pilot_callsign: owner.callsign || body.requestedByCallsign || null,
        description: `Compra ${quantity}x ${aircraftType} para hub ${targetHubIcao}`,
        metadata: {
          aircraft_type: aircraftType,
          quantity,
          target_hub_icao: targetHubIcao,
          registrations,
          created_fleet_ids: createdFleetIds,
          created_aircraft_ids: createdAircraftIds,
          delivery_origin: price.factory,
          purchase_request_ids: requestRows.map((row) => row.id).filter(Boolean),
          source: "aircraft_purchase_api_v1",
        },
        created_at: nowIso,
      })
      .select("id, amount_usd")
      .maybeSingle();

    if (ledgerError) throw new Error(ledgerError.message);

    await recalculateAirlineBalance(supabase, airlineId);

    return NextResponse.json({
      ok: true,
      purchased: {
        aircraftType,
        quantity,
        targetHubIcao,
        totalPriceUsd,
        registrations,
        createdFleetIds,
        createdAircraftIds,
        deliveryOrigin: price.factory,
        ledgerId: ledger?.id ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo comprar la aeronave.";
    const status = message.includes("Compra restringida") || message.includes("sesión administrativa") ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
