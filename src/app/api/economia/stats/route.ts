import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    // Airline summary from airlines table + aggregate from ledger
    const [airlineRes, ledgerAggRes, ledgerRecentRes, ledgerHistoryRes, payrollRes, topPilotsRes] = await Promise.all([
      supabase.from("airlines").select("id, name, balance_usd, total_revenue_usd, total_costs_usd").limit(1).maybeSingle(),

      supabase.from("airline_ledger").select("entry_type, amount_usd"),

      supabase
        .from("airline_ledger")
        .select("entry_type, amount_usd, pilot_callsign, description, reservation_id, created_at")
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("airline_ledger")
        .select("entry_type, amount_usd, pilot_callsign, description, reservation_id, created_at")
        .order("created_at", { ascending: false })
        .limit(250),

      supabase
        .from("pilot_salary_ledger")
        .select("pilot_callsign, period_year, period_month, flights_count, commission_total_usd, block_hours_total, base_salary_usd, net_paid_usd, status")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(30),

      supabase
        .from("flight_reservations")
        .select("pilot_callsign, commission_usd, damage_deduction_usd")
        .eq("status", "completed")
        .not("commission_usd", "is", null)
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);

    const airline = airlineRes.data ?? null;
    const ledgerRows = (ledgerAggRes.data ?? []) as Array<{ entry_type: string; amount_usd: unknown }>;
    const recentLedger = (ledgerRecentRes.data ?? []) as Array<Record<string, unknown>>;
    const historyLedger = (ledgerHistoryRes.data ?? []) as Array<Record<string, unknown>>;
    const payrollRows = (payrollRes.data ?? []) as Array<Record<string, unknown>>;
    const topPilotRows = (topPilotsRes.data ?? []) as Array<Record<string, unknown>>;

    const reservationIds = Array.from(
      new Set(
        historyLedger
          .map((row) => asText(row.reservation_id))
          .filter(Boolean)
      )
    );

    const reservationStatusMap = new Map<string, string>();
    if (reservationIds.length > 0) {
      const { data: reservationRows } = await supabase
        .from("flight_reservations")
        .select("id,status,scoring_status")
        .in("id", reservationIds);

      for (const row of (reservationRows ?? []) as Array<Record<string, unknown>>) {
        const id = asText(row.id);
        if (!id) continue;
        const scoringStatus = asText(row.scoring_status).toLowerCase();
        const baseStatus = asText(row.status).toLowerCase();
        const normalized = scoringStatus === "pending_server_closeout" || scoringStatus === "incomplete_closeout" || scoringStatus === "no_evaluable"
          ? "no_evaluable"
          : (baseStatus || "unknown");
        reservationStatusMap.set(id, normalized);
      }
    }

    // Aggregate from ledger by entry_type
    const byType: Record<string, number> = {};
    for (const row of ledgerRows) {
      const t = asText(row.entry_type) || "other";
      byType[t] = (byType[t] ?? 0) + asNumber(row.amount_usd);
    }

    const initialCapital = asNumber(byType["initial_capital"]);
    const passengerRevenue = asNumber(byType["passenger_revenue"]);
    const cargoRevenue = asNumber(byType["cargo_revenue"]);
    const charterRevenue = asNumber(byType["charter_revenue"]);
    const legacyFlightIncome = asNumber(byType["flight_income"]);
    const totalIncome = passengerRevenue + cargoRevenue + charterRevenue + legacyFlightIncome;
    const totalFuel = Math.abs(asNumber(byType["fuel_cost"]));
    const totalMaintenance = Math.abs(asNumber(byType["maintenance_cost"]));
    const totalPilotPayments = Math.abs(asNumber(byType["pilot_payment"]));
    const totalRepairs = Math.abs(asNumber(byType["repair_cost"]) + asNumber(byType["repair_reserve"]));
    const totalAirportFees = Math.abs(asNumber(byType["airport_fees"]));
    const totalHandling = Math.abs(asNumber(byType["handling_cost"]));
    const totalSalaries = Math.abs(asNumber(byType["salary_payment"]));
    const totalCosts = totalFuel + totalMaintenance + totalPilotPayments + totalRepairs + totalAirportFees + totalHandling + totalSalaries;
    const netProfit = totalIncome - totalCosts;

    const storedBalance = airline ? asNumber(airline.balance_usd) : 0;
    const ledgerBalance = ledgerRows.reduce((sum, row) => sum + asNumber(row.amount_usd), 0);
    const hasLedgerRows = ledgerRows.length > 0;

    // Prefer the real persisted balance. If it has not been recalculated yet,
    // use ledger sum. If the database still has no initial capital entry, expose
    // the operational base so Oficina/Economía never render an empty $0 airline.
    const airlineBalance =
      storedBalance !== 0
        ? storedBalance
        : hasLedgerRows
          ? ledgerBalance
          : 1305000;

    // Monthly payroll summary — group by year/month
    const payrollByMonth: Record<string, { year: number; month: number; flights: number; commission: number; base_salary: number; net: number; callsigns: string[] }> = {};
    for (const row of payrollRows) {
      const key = `${asNumber(row.period_year)}-${asNumber(row.period_month)}`;
      if (!payrollByMonth[key]) {
        payrollByMonth[key] = {
          year: asNumber(row.period_year),
          month: asNumber(row.period_month),
          flights: 0,
          commission: 0,
          base_salary: 0,
          net: 0,
          callsigns: [],
        };
      }
      payrollByMonth[key].flights += asNumber(row.flights_count);
      payrollByMonth[key].commission += asNumber(row.commission_total_usd);
      payrollByMonth[key].base_salary += asNumber(row.base_salary_usd);
      payrollByMonth[key].net += asNumber(row.net_paid_usd);
      const cs = asText(row.pilot_callsign);
      if (cs && !payrollByMonth[key].callsigns.includes(cs)) {
        payrollByMonth[key].callsigns.push(cs);
      }
    }

    // Top pilots by commission
    const pilotTotals: Record<string, number> = {};
    for (const row of topPilotRows) {
      const cs = asText(row.pilot_callsign);
      if (!cs) continue;
      pilotTotals[cs] = (pilotTotals[cs] ?? 0) + asNumber(row.commission_usd);
    }
    const topPilots = Object.entries(pilotTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([callsign, commission]) => ({ callsign, commission: Math.round(commission * 100) / 100 }));

    const totalFlightsCompleted = topPilotRows.length;

    const movementHistory = historyLedger.map((row) => {
      const amount = asNumber(row.amount_usd);
      const reservationId = asText(row.reservation_id) || null;
      const reservationStatus = reservationId ? (reservationStatusMap.get(reservationId) ?? "unknown") : "n/a";
      const isNoEvaluable = reservationStatus === "no_evaluable";
      const source = reservationId
        ? "airline_ledger + flight_economy_snapshots"
        : "airline_ledger";
      return {
        created_at: asText(row.created_at),
        pilot_callsign: asText(row.pilot_callsign) || "—",
        reservation_id: reservationId,
        entry_type: asText(row.entry_type) || "other",
        description: isNoEvaluable
          ? "Cierre no evaluable (sin impacto operacional)"
          : (asText(row.description) || "Movimiento aerolínea"),
        income_usd: isNoEvaluable ? 0 : amount > 0 ? Math.round(amount * 100) / 100 : 0,
        cost_usd: isNoEvaluable ? 0 : amount < 0 ? Math.round(Math.abs(amount) * 100) / 100 : 0,
        net_usd: isNoEvaluable ? 0 : Math.round(amount * 100) / 100,
        trace_amount_usd: Math.round(amount * 100) / 100,
        operational_impact: isNoEvaluable ? "excluded" : "included",
        status: reservationStatus,
        source,
      };
    });

    const noEvaluablesTotal = movementHistory.reduce(
      (sum, item) => item.status === "no_evaluable" ? sum + Math.abs(asNumber((item as Record<string, unknown>).trace_amount_usd)) : sum,
      0
    );

    return NextResponse.json({
      ok: true,
      airline: {
        name: asText(airline?.name) || "Patagonia Wings",
        balance_usd: Math.round(airlineBalance * 100) / 100,
        total_revenue_usd: Math.round(totalIncome * 100) / 100,
        total_costs_usd: Math.round(totalCosts * 100) / 100,
        net_profit_usd: Math.round(netProfit * 100) / 100,
        initial_capital_usd: Math.round((initialCapital || 1305000) * 100) / 100,
        has_real_ledger: hasLedgerRows,
      },
      breakdown: {
        income_flights: Math.round(totalIncome * 100) / 100,
        income_passengers: Math.round(passengerRevenue * 100) / 100,
        income_cargo: Math.round(cargoRevenue * 100) / 100,
        income_charter: Math.round(charterRevenue * 100) / 100,
        cost_fuel: Math.round(totalFuel * 100) / 100,
        cost_maintenance: Math.round(totalMaintenance * 100) / 100,
        cost_pilot_payments: Math.round(totalPilotPayments * 100) / 100,
        cost_repairs: Math.round(totalRepairs * 100) / 100,
        cost_airport_fees: Math.round(totalAirportFees * 100) / 100,
        cost_handling: Math.round(totalHandling * 100) / 100,
        cost_salaries: Math.round(totalSalaries * 100) / 100,
        no_evaluable_total: Math.round(noEvaluablesTotal * 100) / 100,
      },
      payroll: Object.values(payrollByMonth)
        .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
        .slice(0, 6),
      recentLedger: recentLedger.slice(0, 10),
      movementHistory,
      topPilots,
      totalFlightsCompleted,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error al obtener estadisticas." },
      { status: 500 }
    );
  }
}
