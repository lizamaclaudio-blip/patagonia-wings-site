import { NextResponse } from "next/server";
import { createSupabaseServerClient, getUserFromAccessToken } from "@/lib/supabase/server";
import { estimateAircraftMarketValueUsd } from "@/lib/pilot-economy";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, unknown>;

type MonthlyCostItem = {
  code: string;
  label: string;
  amountUsd: number;
  description: string;
};

const DEFAULT_OWNER_CALLSIGNS = ["PWG001"];
const PAGE_SIZE = 1000;

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

async function assertOwner(request: Request) {
  const token = extractBearerToken(request);
  if (!token) throw new Error("Cierre mensual restringido: falta sesión administrativa.");

  const user = await getUserFromAccessToken(token);
  const supabase = createSupabaseServerClient(token);
  const { data: profile, error } = await supabase
    .from("pilot_profiles")
    .select("callsign, email")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo validar owner: ${error.message}`);

  const callsign = asText((profile as AnyRow | null)?.callsign);
  const email = asText((profile as AnyRow | null)?.email) || user.email || "";

  if (!isOwnerIdentity(callsign, email)) {
    throw new Error("Cierre mensual restringido: solo la dirección de Patagonia Wings puede aplicar costos fijos.");
  }

  return { token, callsign, email };
}

function normalizeType(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code) return "UNKNOWN";
  if (code.startsWith("A20N")) return "A320";
  if (code.startsWith("A21N")) return "A321";
  if (code.startsWith("A318")) return "A318";
  if (code.startsWith("A319")) return "A319";
  if (code.startsWith("A320")) return "A320";
  if (code.startsWith("A321")) return "A321";
  if (code.startsWith("A359") || code.startsWith("A350")) return "A359";
  if (code.startsWith("A339") || code.startsWith("A330")) return "A339";
  if (code.startsWith("B736") || code.startsWith("B7376")) return "B736";
  if (code.startsWith("B738") || code.startsWith("B7378")) return "B738";
  if (code.startsWith("B739") || code.startsWith("B7379")) return "B739";
  if (code.startsWith("B38M") || code.includes("MAX8")) return "B38M";
  if (code.startsWith("B789") || code.startsWith("B787")) return "B789";
  if (code.startsWith("B77") || code.startsWith("B777")) return "B77W";
  if (code.startsWith("B747") || code.startsWith("B74")) return "B747";
  if (code.startsWith("AT7") || code.startsWith("ATR")) return "ATR72";
  if (code.startsWith("E17")) return "E175";
  if (code.startsWith("E19")) return "E190";
  if (code.startsWith("B350") || code.startsWith("BE20")) return "B350";
  if (code.startsWith("BE58")) return "BE58";
  if (code.startsWith("C172")) return "C172";
  if (code.startsWith("C208")) return "C208";
  if (code.startsWith("DHC6")) return "DHC6";
  if (code.startsWith("TBM")) return "TBM9";
  return code.slice(0, 8);
}

async function fetchAllRows(supabase: ReturnType<typeof createSupabaseServerClient>, table: string, select: string) {
  const rows: AnyRow[] = [];
  for (let from = 0; from < 50000; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);
    if (error) break;
    const page = (data ?? []) as unknown as AnyRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function rowRegistration(row: AnyRow) {
  return asText(row.registration) || asText(row.tail_number) || asText(row.aircraft_registration) || asText(row.reg) || asText(row.registration_code);
}

function rowType(row: AnyRow) {
  return normalizeType(
    row.aircraft_type ?? row.aircraft_type_code ?? row.type_code ?? row.type ?? row.model ?? row.variant_name ?? row.aircraft_model ?? row.icao_type ?? row.icao_code
  );
}

function dedupeFleet(fleetRows: AnyRow[], aircraftRows: AnyRow[]) {
  const byKey = new Map<string, { type: string; registration: string }>();
  const all = [...fleetRows, ...aircraftRows];
  all.forEach((row, index) => {
    const registration = rowRegistration(row).toUpperCase();
    const key = registration ? `REG:${registration}` : `IDX:${index}:${asText(row.id)}`;
    if (byKey.has(key)) return;
    byKey.set(key, { type: rowType(row), registration });
  });
  return Array.from(byKey.values()).filter((row) => row.type && row.type !== "UNKNOWN");
}

async function getAirline(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data, error } = await supabase
    .from("airlines")
    .select("id, name, balance_usd")
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "No existe aerolínea configurada.");
  return data as AnyRow;
}

async function recalculateAirlineBalance(supabase: ReturnType<typeof createSupabaseServerClient>, airlineId: string) {
  try {
    await supabase.rpc("pw_recalculate_airline_balance", { p_airline_id: airlineId });
  } catch {
    // Fallback manual below.
  }

  const { data: rows } = await supabase
    .from("airline_ledger")
    .select("amount_usd")
    .eq("airline_id", airlineId);

  const amounts = ((rows ?? []) as AnyRow[]).map((row) => asNumber(row.amount_usd));
  const balance = roundMoney(amounts.reduce((sum, n) => sum + n, 0));
  const revenue = roundMoney(amounts.filter((n) => n > 0).reduce((sum, n) => sum + n, 0));
  const costs = roundMoney(Math.abs(amounts.filter((n) => n < 0).reduce((sum, n) => sum + n, 0)));

  await supabase
    .from("airlines")
    .update({ balance_usd: balance, total_revenue_usd: revenue, total_costs_usd: costs })
    .eq("id", airlineId);
}

async function buildMonthlyCostPlan(supabase: ReturnType<typeof createSupabaseServerClient>, periodYear?: number, periodMonth?: number) {
  const now = new Date();
  const year = periodYear || now.getUTCFullYear();
  const month = periodMonth || now.getUTCMonth() + 1;
  const periodCode = `${year}-${String(month).padStart(2, "0")}`;

  const airline = await getAirline(supabase);

  const [{ data: assetRows }, fleetRows, aircraftRows, { data: hubs }, { data: ledgerPeriod }] = await Promise.all([
    supabase.from("aircraft_asset_values").select("aircraft_type, estimated_monthly_fixed_cost_usd, estimated_purchase_price_usd"),
    fetchAllRows(supabase, "aircraft_fleet", "id, registration, aircraft_type, aircraft_type_code, type_code, model, status, current_airport_icao, home_hub_icao"),
    fetchAllRows(supabase, "aircraft", "id, registration, aircraft_type, aircraft_type_code, type_code, model, status, current_airport_code, home_hub_code"),
    supabase.from("hubs").select("hub_code, icao_code, airport_icao, name"),
    supabase
      .from("airline_ledger")
      .select("entry_type, amount_usd, description, metadata, created_at")
      .eq("airline_id", airline.id)
      .contains("metadata", { period_code: periodCode })
      .limit(100),
  ]);

  const catalog = new Map<string, { monthly: number; value: number }>();
  for (const row of (assetRows ?? []) as AnyRow[]) {
    const type = normalizeType(row.aircraft_type);
    if (!type || type === "UNKNOWN") continue;
    catalog.set(type, {
      monthly: asNumber(row.estimated_monthly_fixed_cost_usd),
      value: asNumber(row.estimated_purchase_price_usd),
    });
  }

  const fleet = dedupeFleet(fleetRows, aircraftRows);
  let fleetFixedUsd = 0;
  let fleetValueUsd = 0;
  for (const aircraft of fleet) {
    const item = catalog.get(aircraft.type);
    const value = item?.value || estimateAircraftMarketValueUsd(aircraft.type);
    fleetValueUsd += value;
    fleetFixedUsd += item?.monthly || value * 0.002;
  }

  const hubCount = Math.max(((hubs ?? []) as AnyRow[]).length, 1);
  const staffCostUsd = 58 * 3000;
  const hubCostUsd = hubCount * 18000;
  const insuranceCostUsd = fleetValueUsd * 0.0011;
  const systemsCostUsd = 6500;
  const trainingAdminUsd = 4200;
  const reserveContributionUsd = Math.max(25000, (staffCostUsd + hubCostUsd + fleetFixedUsd) * 0.08);

  const items: MonthlyCostItem[] = [
    { code: "monthly_staff_cost", label: "Nómina staff y administración", amountUsd: roundMoney(staffCostUsd), description: "58 personas × USD 3.000 mensuales." },
    { code: "monthly_hub_cost", label: "Hubs, oficinas y operación base", amountUsd: roundMoney(hubCostUsd), description: `${hubCount} hub(s) × USD 18.000.` },
    { code: "monthly_fleet_fixed_cost", label: "Costo fijo mensual de flota", amountUsd: roundMoney(fleetFixedUsd), description: `${fleet.length} aeronaves reales deduplicadas.` },
    { code: "monthly_insurance_cost", label: "Seguros y reserva patrimonial", amountUsd: roundMoney(insuranceCostUsd), description: "Estimación 0,11% mensual del valor patrimonial de flota." },
    { code: "monthly_systems_cost", label: "Sistemas, hosting y operación digital", amountUsd: roundMoney(systemsCostUsd), description: "Servidores, APIs, dominios y herramientas operacionales." },
    { code: "monthly_training_admin", label: "Capacitación y administración operacional", amountUsd: roundMoney(trainingAdminUsd), description: "Apoyo administrativo y recurrentes internos." },
    { code: "monthly_reserve_contribution", label: "Aporte a reserva técnica", amountUsd: roundMoney(reserveContributionUsd), description: "Reserva para continuidad operacional y contingencias." },
  ];

  const totalMonthlyCostUsd = roundMoney(items.reduce((sum, item) => sum + item.amountUsd, 0));
  const alreadyApplied = ((ledgerPeriod ?? []) as AnyRow[]).some((row) => asText(row.entry_type).startsWith("monthly_"));

  return {
    airline: {
      id: String(airline.id),
      name: asText(airline.name) || "Patagonia Wings",
      balanceUsd: roundMoney(asNumber(airline.balance_usd)),
    },
    period: { year, month, code: periodCode },
    fleet: { count: fleet.length, valueUsd: roundMoney(fleetValueUsd), fixedMonthlyUsd: roundMoney(fleetFixedUsd) },
    hubs: { count: hubCount },
    items,
    totalMonthlyCostUsd,
    sixMonthReserveUsd: roundMoney(totalMonthlyCostUsd * 6),
    recommendedReserveUsd: roundMoney(totalMonthlyCostUsd * 6 * 1.25),
    alreadyApplied,
    recentPeriodLedger: ledgerPeriod ?? [],
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    const supabase = createSupabaseServerClient();
    const plan = await buildMonthlyCostPlan(
      supabase,
      Number.isFinite(year) && year > 2000 ? year : undefined,
      Number.isFinite(month) && month >= 1 && month <= 12 ? month : undefined
    );
    return NextResponse.json({ ok: true, ...plan });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo calcular costos fijos mensuales." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { token, callsign } = await assertOwner(request);
    const body = await request.json().catch(() => ({}));
    const periodYear = Number(body?.periodYear);
    const periodMonth = Number(body?.periodMonth);
    const supabase = createSupabaseServerClient(token);
    const plan = await buildMonthlyCostPlan(
      supabase,
      Number.isFinite(periodYear) && periodYear > 2000 ? periodYear : undefined,
      Number.isFinite(periodMonth) && periodMonth >= 1 && periodMonth <= 12 ? periodMonth : undefined
    );

    if (plan.alreadyApplied) {
      return NextResponse.json({ ok: true, status: "already_applied", message: `Los costos fijos de ${plan.period.code} ya estaban aplicados.`, ...plan });
    }

    const closurePayload = {
      airline_id: plan.airline.id,
      period_year: plan.period.year,
      period_month: plan.period.month,
      period_code: plan.period.code,
      total_cost_usd: plan.totalMonthlyCostUsd,
      status: "applied",
      applied_by_callsign: callsign || null,
      breakdown: plan.items,
      metadata: {
        fleet: plan.fleet,
        hubs: plan.hubs,
        recommended_reserve_usd: plan.recommendedReserveUsd,
        source: "monthly_fixed_costs_route",
      },
      applied_at: new Date().toISOString(),
    };

    const { data: closure, error: closureError } = await supabase
      .from("airline_monthly_closures")
      .upsert(closurePayload, { onConflict: "airline_id,period_year,period_month" })
      .select("id")
      .maybeSingle();

    if (closureError) throw new Error(`No se pudo registrar cierre mensual: ${closureError.message}`);

    const ledgerRows = plan.items.map((item) => ({
      airline_id: plan.airline.id,
      entry_type: item.code,
      amount_usd: -Math.abs(item.amountUsd),
      description: item.label,
      pilot_callsign: callsign || null,
      metadata: {
        period_code: plan.period.code,
        period_year: plan.period.year,
        period_month: plan.period.month,
        closure_id: closure?.id ?? null,
        description: item.description,
        source: "monthly_fixed_costs",
      },
      created_at: new Date().toISOString(),
    }));

    const { error: ledgerError } = await supabase.from("airline_ledger").insert(ledgerRows);
    if (ledgerError) throw new Error(`No se pudo registrar ledger mensual: ${ledgerError.message}`);

    await recalculateAirlineBalance(supabase, plan.airline.id);
    const refreshedPlan = await buildMonthlyCostPlan(supabase, plan.period.year, plan.period.month);

    return NextResponse.json({ ok: true, status: "applied", message: `Costos fijos ${plan.period.code} aplicados.`, ...refreshedPlan });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo aplicar cierre mensual." },
      { status: 500 }
    );
  }
}
