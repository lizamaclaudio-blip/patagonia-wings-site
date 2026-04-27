import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, unknown>;

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function monthLabel(value: unknown) {
  const raw = asText(value);
  if (!raw) return "Sin mes";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 7);
  return date.toLocaleDateString("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function monthKey(value: unknown) {
  const raw = asText(value);
  if (!raw) return "sin_mes";
  return raw.slice(0, 7);
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function addGroup<T extends { key: string }>(map: Map<string, T>, key: string, factory: () => T) {
  let row = map.get(key);
  if (!row) {
    row = factory();
    map.set(key, row);
  }
  return row;
}

async function safeSelect(supabase: ReturnType<typeof createSupabaseServerClient>, table: string, select: string, options?: { orderBy?: string; ascending?: boolean; limit?: number }) {
  let query = supabase.from(table).select(select);
  if (options?.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? false });
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) return [] as AnyRow[];
  return (data ?? []) as unknown as AnyRow[];
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const [monthlyRows, snapshotRows, ledgerRows, expenseRows, salaryRows] = await Promise.all([
      safeSelect(
        supabase,
        "pw_economy_monthly_metrics",
        "month, flights_count, distance_nm_total, block_minutes_total, passengers_estimated, passengers_actual, cargo_kg_estimated, cargo_kg_actual, fuel_kg_total, fuel_cost_usd, passenger_revenue_usd, cargo_revenue_usd, onboard_service_revenue_usd, onboard_sales_revenue_usd, onboard_service_cost_usd, airline_revenue_usd, pilot_payment_usd, maintenance_cost_usd, repair_cost_usd, airport_fees_usd, handling_cost_usd, total_cost_usd, net_profit_usd, profit_margin_pct",
        { orderBy: "month", ascending: false, limit: 18 }
      ),
      safeSelect(
        supabase,
        "flight_economy_snapshots",
        "created_at, reservation_id, flight_number, pilot_callsign, aircraft_registration, aircraft_type, operation_type, origin_icao, destination_icao, distance_nm, estimated_passengers, actual_passengers, estimated_cargo_kg, actual_cargo_kg, fuel_kg_estimated, fuel_kg_actual, airline_revenue_usd, total_cost_usd, net_profit_usd",
        { orderBy: "created_at", ascending: false, limit: 500 }
      ),
      safeSelect(
        supabase,
        "airline_ledger",
        "created_at, entry_type, amount_usd, pilot_callsign, description",
        { orderBy: "created_at", ascending: false, limit: 500 }
      ),
      safeSelect(
        supabase,
        "pilot_expense_ledger",
        "created_at, pilot_callsign, expense_code, category, amount_usd, description",
        { orderBy: "created_at", ascending: false, limit: 500 }
      ),
      safeSelect(
        supabase,
        "pilot_salary_ledger",
        "period_year, period_month, pilot_callsign, flights_count, commission_total_usd, block_hours_total, base_salary_usd, net_paid_usd, status",
        { orderBy: "period_year", ascending: false, limit: 500 }
      ),
    ]);

    const monthly = monthlyRows.map((row) => ({
      month: asText(row.month),
      label: monthLabel(row.month),
      flights: asNumber(row.flights_count),
      distanceNm: asNumber(row.distance_nm_total),
      blockHours: roundMoney(asNumber(row.block_minutes_total) / 60),
      passengers: Math.max(asNumber(row.passengers_actual), asNumber(row.passengers_estimated)),
      cargoKg: Math.max(asNumber(row.cargo_kg_actual), asNumber(row.cargo_kg_estimated)),
      fuelKg: asNumber(row.fuel_kg_total),
      fuelCostUsd: roundMoney(asNumber(row.fuel_cost_usd)),
      passengerRevenueUsd: roundMoney(asNumber(row.passenger_revenue_usd)),
      cargoRevenueUsd: roundMoney(asNumber(row.cargo_revenue_usd)),
      onboardRevenueUsd: roundMoney(asNumber(row.onboard_service_revenue_usd) + asNumber(row.onboard_sales_revenue_usd)),
      airlineRevenueUsd: roundMoney(asNumber(row.airline_revenue_usd)),
      totalCostUsd: roundMoney(asNumber(row.total_cost_usd)),
      netProfitUsd: roundMoney(asNumber(row.net_profit_usd)),
      profitMarginPct: roundMoney(asNumber(row.profit_margin_pct)),
    })).reverse();

    const routeMap = new Map<string, { key: string; route: string; flights: number; revenueUsd: number; costUsd: number; profitUsd: number; passengers: number; cargoKg: number; distanceNm: number }>();
    const aircraftMap = new Map<string, { key: string; aircraftType: string; flights: number; revenueUsd: number; costUsd: number; profitUsd: number; fuelKg: number; distanceNm: number }>();
    const pilotMap = new Map<string, { key: string; callsign: string; flights: number; commissionUsd: number; hours: number }>();
    const ledgerByMonth = new Map<string, { key: string; label: string; incomeUsd: number; costUsd: number; netUsd: number }>();
    const expensesByCategory = new Map<string, { key: string; category: string; amountUsd: number; count: number }>();

    for (const row of snapshotRows) {
      const origin = asText(row.origin_icao).toUpperCase() || "????";
      const destination = asText(row.destination_icao).toUpperCase() || "????";
      const routeKey = `${origin}-${destination}`;
      const route = addGroup(routeMap, routeKey, () => ({ key: routeKey, route: `${origin} → ${destination}`, flights: 0, revenueUsd: 0, costUsd: 0, profitUsd: 0, passengers: 0, cargoKg: 0, distanceNm: 0 }));
      route.flights += 1;
      route.revenueUsd += asNumber(row.airline_revenue_usd);
      route.costUsd += asNumber(row.total_cost_usd);
      route.profitUsd += asNumber(row.net_profit_usd);
      route.passengers += Math.max(asNumber(row.actual_passengers), asNumber(row.estimated_passengers));
      route.cargoKg += Math.max(asNumber(row.actual_cargo_kg), asNumber(row.estimated_cargo_kg));
      route.distanceNm += asNumber(row.distance_nm);

      const aircraftType = asText(row.aircraft_type).toUpperCase() || "SIN TIPO";
      const aircraft = addGroup(aircraftMap, aircraftType, () => ({ key: aircraftType, aircraftType, flights: 0, revenueUsd: 0, costUsd: 0, profitUsd: 0, fuelKg: 0, distanceNm: 0 }));
      aircraft.flights += 1;
      aircraft.revenueUsd += asNumber(row.airline_revenue_usd);
      aircraft.costUsd += asNumber(row.total_cost_usd);
      aircraft.profitUsd += asNumber(row.net_profit_usd);
      aircraft.fuelKg += Math.max(asNumber(row.fuel_kg_actual), asNumber(row.fuel_kg_estimated));
      aircraft.distanceNm += asNumber(row.distance_nm);
    }

    for (const row of ledgerRows) {
      const key = monthKey(row.created_at);
      const group = addGroup(ledgerByMonth, key, () => ({ key, label: monthLabel(row.created_at), incomeUsd: 0, costUsd: 0, netUsd: 0 }));
      const amount = asNumber(row.amount_usd);
      if (amount >= 0) group.incomeUsd += amount;
      else group.costUsd += Math.abs(amount);
      group.netUsd += amount;
    }

    for (const row of expenseRows) {
      const category = asText(row.category) || "otros";
      const group = addGroup(expensesByCategory, category, () => ({ key: category, category, amountUsd: 0, count: 0 }));
      group.amountUsd += Math.abs(asNumber(row.amount_usd));
      group.count += 1;
    }

    for (const row of salaryRows) {
      const callsign = asText(row.pilot_callsign).toUpperCase() || "SIN CALLSIGN";
      const pilot = addGroup(pilotMap, callsign, () => ({ key: callsign, callsign, flights: 0, commissionUsd: 0, hours: 0 }));
      pilot.flights += asNumber(row.flights_count);
      pilot.commissionUsd += asNumber(row.commission_total_usd) + asNumber(row.base_salary_usd) + asNumber(row.net_paid_usd);
      pilot.hours += asNumber(row.block_hours_total);
    }

    const totalsFromMonthly = monthly.reduce((acc, row) => {
      acc.flights += row.flights;
      acc.distanceNm += row.distanceNm;
      acc.blockHours += row.blockHours;
      acc.passengers += row.passengers;
      acc.cargoKg += row.cargoKg;
      acc.fuelKg += row.fuelKg;
      acc.revenueUsd += row.airlineRevenueUsd;
      acc.costUsd += row.totalCostUsd;
      acc.profitUsd += row.netProfitUsd;
      return acc;
    }, { flights: 0, distanceNm: 0, blockHours: 0, passengers: 0, cargoKg: 0, fuelKg: 0, revenueUsd: 0, costUsd: 0, profitUsd: 0 });

    const ledgerTrend = Array.from(ledgerByMonth.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-12);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      totals: {
        flights: totalsFromMonthly.flights || snapshotRows.length,
        distanceNm: roundMoney(totalsFromMonthly.distanceNm),
        blockHours: roundMoney(totalsFromMonthly.blockHours),
        passengers: Math.round(totalsFromMonthly.passengers),
        cargoKg: roundMoney(totalsFromMonthly.cargoKg),
        fuelKg: roundMoney(totalsFromMonthly.fuelKg),
        revenueUsd: roundMoney(totalsFromMonthly.revenueUsd),
        costUsd: roundMoney(totalsFromMonthly.costUsd),
        profitUsd: roundMoney(totalsFromMonthly.profitUsd),
      },
      monthly,
      ledgerTrend,
      topRoutes: Array.from(routeMap.values()).sort((a, b) => b.profitUsd - a.profitUsd).slice(0, 8).map((row) => ({ ...row, revenueUsd: roundMoney(row.revenueUsd), costUsd: roundMoney(row.costUsd), profitUsd: roundMoney(row.profitUsd), distanceNm: roundMoney(row.distanceNm), cargoKg: roundMoney(row.cargoKg) })),
      lossRoutes: Array.from(routeMap.values()).sort((a, b) => a.profitUsd - b.profitUsd).slice(0, 6).map((row) => ({ ...row, revenueUsd: roundMoney(row.revenueUsd), costUsd: roundMoney(row.costUsd), profitUsd: roundMoney(row.profitUsd), distanceNm: roundMoney(row.distanceNm), cargoKg: roundMoney(row.cargoKg) })),
      topAircraft: Array.from(aircraftMap.values()).sort((a, b) => b.profitUsd - a.profitUsd).slice(0, 8).map((row) => ({ ...row, revenueUsd: roundMoney(row.revenueUsd), costUsd: roundMoney(row.costUsd), profitUsd: roundMoney(row.profitUsd), fuelKg: roundMoney(row.fuelKg), distanceNm: roundMoney(row.distanceNm) })),
      topPilots: Array.from(pilotMap.values()).sort((a, b) => b.commissionUsd - a.commissionUsd).slice(0, 8).map((row) => ({ ...row, commissionUsd: roundMoney(row.commissionUsd), hours: roundMoney(row.hours) })),
      pilotExpenses: Array.from(expensesByCategory.values()).sort((a, b) => b.amountUsd - a.amountUsd).map((row) => ({ ...row, amountUsd: roundMoney(row.amountUsd) })),
      dataHealth: {
        monthlyRows: monthlyRows.length,
        snapshotRows: snapshotRows.length,
        ledgerRows: ledgerRows.length,
        expenseRows: expenseRows.length,
        salaryRows: salaryRows.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudieron cargar métricas históricas." }, { status: 500 });
  }
}
