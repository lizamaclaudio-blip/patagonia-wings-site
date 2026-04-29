import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient, getUserFromAccessToken } from "@/lib/supabase/server";
import { lastBusinessDayLabel, lastBusinessDayIso } from "@/lib/pilot-economy";

const DEFAULT_OWNER_CALLSIGNS = ["PWG001"];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function getBearerToken(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function asNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parseOwnerList(value: string | undefined, fallback: string[]) {
  const parsed = (value ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
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

function getFlightBlockMinutes(row: Record<string, unknown>) {
  return asNumber(row.actual_block_minutes) || asNumber(row.block_minutes) || asNumber(row.block_time_minutes) || asNumber(row.estimated_block_minutes);
}

function periodRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01T00:00:00Z`;
  const end = month === 12 ? `${year + 1}-01-01T00:00:00Z` : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`;
  return { start, end };
}

async function assertOwner(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) throw new Error("No autenticado.");
  const user = await getUserFromAccessToken(token);
  const supabase = createSupabaseServerClient(token);
  const { data: profile } = await supabase.from("pilot_profiles").select("callsign,email").eq("id", user.id).maybeSingle();
  const callsign = String(profile?.callsign ?? "").toUpperCase();
  const email = String(profile?.email ?? user.email ?? "").toUpperCase();
  if (!isOwnerIdentity(callsign, email)) throw new Error("Solo owner/direccion puede ejecutar liquidaciones.");
  return { token, callsign };
}

function resolvePeriod(request: NextRequest) {
  const now = new Date();
  const bodyPeriod = request.method === "POST" ? request.nextUrl.searchParams : request.nextUrl.searchParams;
  const year = Number(bodyPeriod.get("year")) || now.getUTCFullYear();
  const month = Math.min(12, Math.max(1, Number(bodyPeriod.get("month")) || now.getUTCMonth() + 1));
  return { year, month };
}

async function buildSummary(year: number, month: number, token: string) {
  const { start, end } = periodRange(year, month);
  const supabase = createSupabaseServerClient(token);
  const { data: flightsData } = await supabase
    .from("flight_reservations")
    .select("pilot_callsign,commission_usd,damage_deduction_usd,actual_block_minutes,block_minutes,block_time_minutes,estimated_block_minutes,status,completed_at")
    .eq("status", "completed")
    .gte("completed_at", start)
    .lt("completed_at", end);
  const flights = (flightsData ?? []) as Array<Record<string, unknown>>;
  const callsigns = Array.from(new Set(flights.map((row) => String(row.pilot_callsign ?? "").toUpperCase()).filter(Boolean)));
  const { data: profilesData } = callsigns.length
    ? await supabase.from("pilot_profiles").select("id,callsign,wallet_balance").in("callsign", callsigns)
    : { data: [] };
  const profiles = (profilesData ?? []) as Array<Record<string, unknown>>;
  const byCallsign = new Map<string, { id: string; wallet: number }>();
  for (const profile of profiles) byCallsign.set(String(profile.callsign ?? "").toUpperCase(), { id: String(profile.id ?? ""), wallet: asNumber(profile.wallet_balance) });

  const { data: expensesData } = callsigns.length
    ? await supabase.from("pilot_expense_ledger").select("pilot_id,pilot_callsign,amount_usd,created_at").gte("created_at", start).lt("created_at", end)
    : { data: [] };
  const expenses = (expensesData ?? []) as Array<Record<string, unknown>>;

  const { data: existingRows } = await supabase.from("pilot_salary_ledger").select("id,pilot_id,status,period_year,period_month").eq("period_year", year).eq("period_month", month);
  const existingMap = new Map<string, { id: string; status: string }>();
  for (const row of (existingRows ?? []) as Array<Record<string, unknown>>) existingMap.set(String(row.pilot_id ?? ""), { id: String(row.id ?? ""), status: String(row.status ?? "pending") });

  const aggregates = callsigns.map((callsign) => {
    const pilotFlights = flights.filter((row) => String(row.pilot_callsign ?? "").toUpperCase() === callsign);
    const profile = byCallsign.get(callsign);
    const pilotExpenses = expenses.filter((row) => String(row.pilot_callsign ?? "").toUpperCase() === callsign || (profile?.id && String(row.pilot_id ?? "") === profile.id));
    const commissionTotalUsd = roundMoney(pilotFlights.reduce((sum, row) => sum + asNumber(row.commission_usd), 0));
    const damageDeductionsUsd = roundMoney(pilotFlights.reduce((sum, row) => sum + asNumber(row.damage_deduction_usd), 0));
    const blockHoursTotal = roundMoney(pilotFlights.reduce((sum, row) => sum + getFlightBlockMinutes(row), 0) / 60);
    const expensesTotalUsd = roundMoney(pilotExpenses.reduce((sum, row) => sum + Math.abs(asNumber(row.amount_usd)), 0));
    const baseSalaryUsd = pilotFlights.length >= 5 ? 1500 : 0;
    const grossTotalUsd = roundMoney(commissionTotalUsd + baseSalaryUsd);
    const netPaidUsd = roundMoney(Math.max(0, grossTotalUsd - damageDeductionsUsd - expensesTotalUsd));
    const existing = profile?.id ? existingMap.get(profile.id) : null;
    return {
      callsign,
      pilotId: profile?.id ?? null,
      walletBeforeUsd: profile?.wallet ?? 0,
      flightsCount: pilotFlights.length,
      blockHoursTotal,
      commissionTotalUsd,
      baseSalaryUsd,
      damageDeductionsUsd,
      expensesTotalUsd,
      grossTotalUsd,
      netPaidUsd,
      existingStatus: existing?.status ?? null,
      payable: Boolean(profile?.id) && netPaidUsd > 0 && existing?.status !== "paid",
    };
  });

  return {
    period: { year, month, paymentDateLabel: lastBusinessDayLabel(year, month), businessDayIso: lastBusinessDayIso(year, month) },
    totals: {
      pilots: aggregates.length,
      payablePilots: aggregates.filter((row) => row.payable).length,
      netPayableUsd: roundMoney(aggregates.filter((row) => row.payable).reduce((sum, row) => sum + row.netPaidUsd, 0)),
    },
    pilots: aggregates,
  };
}

export async function GET(request: NextRequest) {
  try {
    const owner = await assertOwner(request);
    const { year, month } = resolvePeriod(request);
    const summary = await buildSummary(year, month, owner.token);
    return json({ ok: true, ...summary });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "No se pudo generar preview." }, 403);
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await assertOwner(request);
    const { year, month } = resolvePeriod(request);
    const summary = await buildSummary(year, month, owner.token);
    const admin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    const results: Array<{ callsign: string; pilotId: string | null; status: string; netPaidUsd: number }> = [];
    for (const row of summary.pilots) {
      if (!row.pilotId) {
        results.push({ callsign: row.callsign, pilotId: null, status: "missing_profile", netPaidUsd: 0 });
        continue;
      }
      if (row.existingStatus === "paid") {
        results.push({ callsign: row.callsign, pilotId: row.pilotId, status: "already_paid", netPaidUsd: row.netPaidUsd });
        continue;
      }

      const status = row.flightsCount === 0 ? "skipped" : "paid";
      const paidAt = status === "paid" ? nowIso : null;
      const { error: ledgerError } = await admin.from("pilot_salary_ledger").upsert(
        {
          pilot_id: row.pilotId,
          pilot_callsign: row.callsign,
          period_year: year,
          period_month: month,
          flights_count: row.flightsCount,
          block_hours_total: row.blockHoursTotal,
          commission_total_usd: row.commissionTotalUsd,
          base_salary_usd: row.baseSalaryUsd,
          damage_deductions_usd: row.damageDeductionsUsd,
          expenses_total_usd: row.expensesTotalUsd,
          gross_total_usd: row.grossTotalUsd,
          net_paid_usd: row.netPaidUsd,
          status,
          paid_at: paidAt,
          metadata: { source: "admin_monthly_payout", executed_by: owner.callsign || "OWNER", executed_at: nowIso },
        },
        { onConflict: "pilot_id,period_year,period_month" }
      );
      if (ledgerError) throw new Error(ledgerError.message);

      if (status === "paid" && row.netPaidUsd > 0) {
        const { error: walletError } = await admin
          .from("pilot_profiles")
          .update({ wallet_balance: roundMoney(row.walletBeforeUsd + row.netPaidUsd), updated_at: nowIso })
          .eq("id", row.pilotId);
        if (walletError) throw new Error(walletError.message);
      }
      results.push({ callsign: row.callsign, pilotId: row.pilotId, status, netPaidUsd: row.netPaidUsd });
    }

    return json({ ok: true, period: summary.period, totals: summary.totals, results });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "No se pudo ejecutar liquidacion." }, 400);
  }
}
