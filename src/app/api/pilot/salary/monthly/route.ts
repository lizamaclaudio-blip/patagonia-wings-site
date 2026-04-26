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

function periodRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01T00:00:00Z`;
  const end =
    month === 12
      ? `${year + 1}-01-01T00:00:00Z`
      : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`;
  return { start, end };
}

// GET: current period earnings for the authenticated pilot
export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return json({ error: "No autenticado." }, 401);

  let user;
  try {
    user = await getUserFromAccessToken(token);
  } catch {
    return json({ error: "Sesión inválida." }, 401);
  }

  const supabase = createSupabaseServerClient(token);

  // Resolve callsign (flight_reservations links by callsign, not user id)
  const { data: profile } = await supabase
    .from("pilot_profiles")
    .select("callsign")
    .eq("id", user.id)
    .maybeSingle();

  const callsign = profile?.callsign ?? null;

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const { start, end } = periodRange(year, month);

  const { data: flightsData } = callsign
    ? await supabase
        .from("flight_reservations")
        .select("id, commission_usd, damage_deduction_usd, completed_at")
        .eq("pilot_callsign", callsign)
        .eq("status", "completed")
        .gte("completed_at", start)
        .lt("completed_at", end)
    : { data: [] };

  const flights = flightsData ?? [];
  const flightsCount = flights.length;
  const commissionTotal = flights.reduce((sum, f) => sum + (Number(f.commission_usd) || 0), 0);
  const damageTotal = flights.reduce((sum, f) => sum + (Number(f.damage_deduction_usd) || 0), 0);
  const baseSalary = flightsCount >= 5 ? 1500 : 0;
  const netPaid = Math.max(0, commissionTotal + baseSalary - damageTotal);

  const { data: ledger } = await supabase
    .from("pilot_salary_ledger")
    .select("*")
    .eq("pilot_id", user.id)
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();

  return json({
    period: { year, month },
    paymentDate: lastBusinessDayLabel(year, month),
    flightsCount,
    commissionTotalUsd: Math.round(commissionTotal * 100) / 100,
    damageDeductionsUsd: Math.round(damageTotal * 100) / 100,
    baseSalaryUsd: baseSalary,
    netPaidUsd: Math.round(netPaid * 100) / 100,
    qualifiesForBase: flightsCount >= 5,
    ledger: ledger ?? null,
    recentFlights: flights.slice(0, 20).map((f) => ({
      id: f.id,
      commissionUsd: Number(f.commission_usd) || 0,
      damageDeductionUsd: Number(f.damage_deduction_usd) || 0,
      completedAt: f.completed_at,
    })),
  });
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

  const supabase = createSupabaseServerClient(token);

  const { data: profile } = await supabase
    .from("pilot_profiles")
    .select("callsign, wallet_balance")
    .eq("id", user.id)
    .maybeSingle();

  const callsign = profile?.callsign ?? null;
  const { start, end } = periodRange(targetYear, targetMonth);

  const { data: flightsData } = callsign
    ? await supabase
        .from("flight_reservations")
        .select("id, commission_usd, damage_deduction_usd")
        .eq("pilot_callsign", callsign)
        .eq("status", "completed")
        .gte("completed_at", start)
        .lt("completed_at", end)
    : { data: [] };

  const flights = flightsData ?? [];
  const flightsCount = flights.length;
  const commissionTotal = flights.reduce((sum, f) => sum + (Number(f.commission_usd) || 0), 0);
  const damageTotal = flights.reduce((sum, f) => sum + (Number(f.damage_deduction_usd) || 0), 0);
  const baseSalary = flightsCount >= 5 ? 1500 : 0;
  const netPaid = Math.max(0, commissionTotal + baseSalary - damageTotal);

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
        period_year: targetYear,
        period_month: targetMonth,
        flights_count: flightsCount,
        commission_total_usd: Math.round(commissionTotal * 100) / 100,
        base_salary_usd: baseSalary,
        damage_deductions_usd: Math.round(damageTotal * 100) / 100,
        net_paid_usd: Math.round(netPaid * 100) / 100,
        status: flightsCount === 0 ? "skipped" : "paid",
        paid_at: flightsCount === 0 ? null : new Date().toISOString(),
      },
      { onConflict: "pilot_id,period_year,period_month" }
    )
    .select("*")
    .maybeSingle();

  if (ledgerError) {
    return json({ error: ledgerError.message }, 500);
  }

  if (netPaid > 0) {
    const currentBalance = Number(profile?.wallet_balance ?? 0);
    await supabase
      .from("pilot_profiles")
      .update({
        wallet_balance: Math.round((currentBalance + netPaid) * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  return json({ success: true, ledger });
}
