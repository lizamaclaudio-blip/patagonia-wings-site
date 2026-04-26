import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Initial capital = 58 pilots × $3,000 avg monthly salary × 6 months × 1.25 safety factor
const INITIAL_CAPITAL_USD = 58 * 3000 * 6 * 1.25; // $1,305,000

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST() {
  try {
    const supabase = createSupabaseServerClient();

    // Check if initial_capital entry already exists
    const { data: existing } = await supabase
      .from("airline_ledger")
      .select("id, amount_usd")
      .eq("entry_type", "initial_capital")
      .maybeSingle();

    if (existing) {
      return jsonResponse({
        ok: true,
        skipped: true,
        message: "Capital inicial ya registrado.",
        amount_usd: existing.amount_usd,
      });
    }

    // Insert initial capital entry
    const nowIso = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from("airline_ledger")
      .insert({
        entry_type: "initial_capital",
        amount_usd: INITIAL_CAPITAL_USD,
        description: `Capital inicial aerolínea — 58 pilotos × $3,000 × 6 meses × 1.25`,
        created_at: nowIso,
      })
      .select("id, amount_usd")
      .maybeSingle();

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    // Update airlines balance_usd to reflect initial capital
    const { data: airline } = await supabase
      .from("airlines")
      .select("id, balance_usd")
      .limit(1)
      .maybeSingle();

    if (airline) {
      const newBalance = (Number(airline.balance_usd) || 0) + INITIAL_CAPITAL_USD;
      await supabase
        .from("airlines")
        .update({ balance_usd: Math.round(newBalance * 100) / 100 })
        .eq("id", airline.id);
    }

    return jsonResponse({
      ok: true,
      inserted: true,
      message: `Capital inicial de $${INITIAL_CAPITAL_USD.toLocaleString("es-CL")} USD registrado.`,
      amount_usd: inserted?.amount_usd ?? INITIAL_CAPITAL_USD,
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : "Error al sembrar capital inicial." },
      500,
    );
  }
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("airline_ledger")
      .select("id, amount_usd, created_at")
      .eq("entry_type", "initial_capital")
      .maybeSingle();

    return jsonResponse({
      ok: true,
      exists: Boolean(existing),
      entry: existing ?? null,
      target_amount_usd: INITIAL_CAPITAL_USD,
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : "Error." },
      500,
    );
  }
}
