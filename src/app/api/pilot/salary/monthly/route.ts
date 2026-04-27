import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getUserFromAccessToken } from "@/lib/supabase/server";
import { lastBusinessDayLabel } from "@/lib/pilot-economy";

function getBearerToken(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function periodRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01T00:00:00Z`;
  const end =
    month === 12
      ? `${year + 1}-01-01T00:00:00Z`
      : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`;
  return { start, end };
}

function readPeriod(request: NextRequest) {
  const now = new Date();
  const search = request.nextUrl.searchParams;
  const year = Number(search.get("year")) || now.getUTCFullYear();
  const month = Number(search.get("month")) || now.getUTCMonth() + 1;

  return {
    year,
    month: Math.min(12, Math.max(1, month)),
  };
}

function getFlightBlockMinutes(row: Record<string, unknown>) {
  return (
    toNumber(row.actual_block_minutes) ||
    toNumber(row.block_minutes) ||
    toNumber(row.block_time_minutes) ||
    toNumber(row.estimated_block_minutes)
  );
}

async function loadSalaryData(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return { response: json({ error: "No autenticado." }, 401) };

  let user;
  try {
    user = await getUserFromAccessToken(token);
  } catch {
    return { response: json({ error: "Sesión inválida." }, 401) };
  }

  const { year, month } = readPeriod(request);
  const { start, end } = periodRange(year, month);
  const supabase = createSupabaseServerClient(token);

  const { data: profile } = await supabase
    .from("pilot_profiles")
    .select("id,callsign,wallet_balance,first_name,last_name,email")
    .eq("id", user.id)
    .maybeSingle();

  const callsign = (profile?.callsign as string | null | undefined) ?? null;

  const { data: flightsData } = callsign
    ? await supabase
        .from("flight_reservations")
        .select("*")
        .eq("pilot_callsign", callsign)
        .eq("status", "completed")
        .gte("completed_at", start)
        .lt("completed_at", end)
        .order("completed_at", { ascending: false })
    : { data: [] };

  const flights = (flightsData ?? []) as Array<Record<string, unknown>>;
  const flightsCount = flights.length;
  const commissionTotal = flights.reduce((sum, f) => sum + toNumber(f.commission_usd), 0);
  const damageTotal = flights.reduce((sum, f) => sum + toNumber(f.damage_deduction_usd), 0);
  const blockMinutesTotal = flights.reduce((sum, f) => sum + getFlightBlockMinutes(f), 0);
  const blockHoursTotal = roundMoney(blockMinutesTotal / 60);

  const { data: expenseData } = callsign
    ? await supabase
        .from("pilot_expense_ledger")
        .select("*")
        .or(`pilot_id.eq.${user.id},pilot_callsign.eq.${callsign}`)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
    : { data: [] };

  const expenses = (expenseData ?? []) as Array<Record<string, unknown>>;
  const expensesTotal = expenses.reduce((sum, item) => sum + Math.abs(toNumber(item.amount_usd)), 0);
  const expensesByCategory = expenses.reduce<Record<string, number>>((acc, item) => {
    const category = String(item.category ?? "otros");
    acc[category] = roundMoney((acc[category] ?? 0) + Math.abs(toNumber(item.amount_usd)));
    return acc;
  }, {});

  const baseSalary = flightsCount >= 5 ? 1500 : 0;
  const grossTotal = commissionTotal + baseSalary;
  const netPaid = Math.max(0, grossTotal - damageTotal - expensesTotal);

  const { data: ledger } = await supabase
    .from("pilot_salary_ledger")
    .select("*")
    .eq("pilot_id", user.id)
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();

  const { data: historyRows } = await supabase
    .from("pilot_salary_ledger")
    .select("*")
    .eq("pilot_id", user.id)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(12);

  return {
    data: {
      period: { year, month },
      paymentDate: lastBusinessDayLabel(year, month),
      pilot: {
        id: user.id,
        callsign,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || callsign || user.email,
        email: profile?.email ?? user.email ?? null,
        walletBalanceUsd: roundMoney(toNumber(profile?.wallet_balance)),
      },
      flightsCount,
      blockMinutesTotal,
      blockHoursTotal,
      commissionTotalUsd: roundMoney(commissionTotal),
      damageDeductionsUsd: roundMoney(damageTotal),
      expensesTotalUsd: roundMoney(expensesTotal),
      expensesByCategory,
      baseSalaryUsd: baseSalary,
      grossTotalUsd: roundMoney(grossTotal),
      netPaidUsd: roundMoney(netPaid),
      qualifiesForBase: flightsCount >= 5,
      ledger: ledger ?? null,
      recentFlights: flights.slice(0, 30).map((f) => ({
        id: String(f.id ?? ""),
        flightNumber: String(f.flight_number ?? f.route_code ?? "—"),
        origin: String(f.origin_icao ?? f.origin_airport ?? f.origin ?? "—"),
        destination: String(f.destination_icao ?? f.destination_airport ?? f.destination ?? "—"),
        commissionUsd: roundMoney(toNumber(f.commission_usd)),
        damageDeductionUsd: roundMoney(toNumber(f.damage_deduction_usd)),
        blockMinutes: getFlightBlockMinutes(f),
        completedAt: String(f.completed_at ?? ""),
      })),
      expenses: expenses.slice(0, 30).map((e) => ({
        id: String(e.id ?? ""),
        code: String(e.expense_code ?? ""),
        category: String(e.category ?? "otros"),
        amountUsd: roundMoney(Math.abs(toNumber(e.amount_usd))),
        description: String(e.description ?? e.expense_code ?? "Gasto piloto"),
        createdAt: String(e.created_at ?? ""),
      })),
      monthlyHistory: (historyRows ?? []).map((row: Record<string, unknown>) => ({
        periodYear: Number(row.period_year),
        periodMonth: Number(row.period_month),
        flightsCount: Number(row.flights_count ?? 0),
        blockHoursTotal: roundMoney(toNumber(row.block_hours_total)),
        commissionTotalUsd: roundMoney(toNumber(row.commission_total_usd)),
        baseSalaryUsd: roundMoney(toNumber(row.base_salary_usd)),
        damageDeductionsUsd: roundMoney(toNumber(row.damage_deductions_usd)),
        expensesTotalUsd: roundMoney(toNumber(row.expenses_total_usd)),
        netPaidUsd: roundMoney(toNumber(row.net_paid_usd)),
        status: String(row.status ?? "pending"),
        paidAt: row.paid_at ? String(row.paid_at) : null,
      })),
    },
    user,
    token,
    year,
    month,
    callsign,
  };
}

// GET: current/selected period earnings for the authenticated pilot
export async function GET(request: NextRequest) {
  const loaded = await loadSalaryData(request);
  if ("response" in loaded) return loaded.response;
  return json(loaded.data);
}

// POST: settle salary period into ledger and credit wallet
export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return json({ error: "No autenticado." }, 401);

  let user;
  try {
    user = await getUserFromAccessToken(token);
  } catch {
    return json({ error: "Sesión inválida." }, 401);
  }

  const body = await request.json().catch(() => null);
  const { year, month } = (body ?? {}) as { year?: number; month?: number };

  const now = new Date();
  const targetYear = year ?? now.getUTCFullYear();
  const targetMonth = month ?? now.getUTCMonth() + 1;

  if (targetMonth < 1 || targetMonth > 12) {
    return json({ error: "Mes inválido." }, 400);
  }

  const url = new URL(request.url);
  url.searchParams.set("year", String(targetYear));
  url.searchParams.set("month", String(targetMonth));
  const loaded = await loadSalaryData(new NextRequest(url, { headers: request.headers }));
  if ("response" in loaded) return loaded.response;

  const data = loaded.data;
  const supabase = createSupabaseServerClient(token);

  const { data: existing } = await supabase
    .from("pilot_salary_ledger")
    .select("id, status")
    .eq("pilot_id", user.id)
    .eq("period_year", targetYear)
    .eq("period_month", targetMonth)
    .maybeSingle();

  if (existing?.status === "paid") {
    return json({ error: "Este período ya fue pagado." }, 409);
  }

  const { data: ledger, error: ledgerError } = await supabase
    .from("pilot_salary_ledger")
    .upsert(
      {
        pilot_id: user.id,
        pilot_callsign: data.pilot.callsign,
        period_year: targetYear,
        period_month: targetMonth,
        flights_count: data.flightsCount,
        block_hours_total: data.blockHoursTotal,
        commission_total_usd: data.commissionTotalUsd,
        base_salary_usd: data.baseSalaryUsd,
        damage_deductions_usd: data.damageDeductionsUsd,
        expenses_total_usd: data.expensesTotalUsd,
        gross_total_usd: data.grossTotalUsd,
        net_paid_usd: data.netPaidUsd,
        status: data.flightsCount === 0 ? "skipped" : "paid",
        paid_at: data.flightsCount === 0 ? null : new Date().toISOString(),
      },
      { onConflict: "pilot_id,period_year,period_month" }
    )
    .select("*")
    .maybeSingle();

  if (ledgerError) {
    return json({ error: ledgerError.message }, 500);
  }

  if (data.netPaidUsd > 0) {
    const currentBalance = data.pilot.walletBalanceUsd;
    await supabase
      .from("pilot_profiles")
      .update({
        wallet_balance: roundMoney(currentBalance + data.netPaidUsd),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  return json({ success: true, ledger });
}
