import { NextResponse } from "next/server";
import { getUserFromAccessToken, createSupabaseServerClient } from "@/lib/supabase/server";
import { PILOT_EXPENSE_PLAN, getPilotExpenseCategoryLabel } from "@/lib/pilot-economy";

export const dynamic = "force-dynamic";

type DbExpense = {
  code?: string | null;
  category?: string | null;
  label?: string | null;
  amount_usd?: number | string | null;
  metadata?: Record<string, unknown> | null;
};

type PilotExpenseItem = {
  code: string;
  category: string;
  label: string;
  amountUsd: number;
  description?: string;
  phase?: string;
  requiredFor?: string;
};

type PilotExpenseLedgerRow = {
  id?: string;
  expense_code?: string | null;
  category?: string | null;
  amount_usd?: number | string | null;
  description?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
  balance_after_usd?: number | string | null;
};

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function readBearer(request: Request) {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function catalogFallbackItems(): PilotExpenseItem[] {
  return PILOT_EXPENSE_PLAN.map((item) => ({ ...item, amountUsd: item.amountUsd }));
}

function groupExpenses(items: PilotExpenseItem[]) {
  const groups: Record<string, { category: string; label: string; totalUsd: number; items: PilotExpenseItem[] }> = {};
  for (const item of items) {
    if (!groups[item.category]) {
      groups[item.category] = {
        category: item.category,
        label: getPilotExpenseCategoryLabel(item.category),
        totalUsd: 0,
        items: [],
      };
    }
    groups[item.category].items.push(item);
    groups[item.category].totalUsd += item.amountUsd;
  }
  return Object.values(groups).map((group) => ({
    ...group,
    totalUsd: Math.round(group.totalUsd * 100) / 100,
  }));
}

async function loadCatalog(supabase = createSupabaseServerClient()) {
  const fallbackItems = catalogFallbackItems();

  try {
    const { data, error } = await supabase
      .from("pilot_expense_catalog")
      .select("code, category, label, amount_usd, metadata")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("amount_usd", { ascending: true });

    if (error || !data || data.length === 0) {
      return { source: "fallback", items: fallbackItems };
    }

    const dbItems = (data as DbExpense[]).map((row) => ({
      code: row.code ?? "",
      category: row.category ?? "other",
      label: row.label ?? row.code ?? "Gasto operacional",
      amountUsd: asNumber(row.amount_usd),
      description: typeof row.metadata?.description === "string" ? row.metadata.description : undefined,
      phase: typeof row.metadata?.phase === "string" ? row.metadata.phase : undefined,
      requiredFor:
        typeof row.metadata?.required_for === "string"
          ? row.metadata.required_for
          : typeof row.metadata?.requiredFor === "string"
            ? row.metadata.requiredFor
            : undefined,
    }));

    return { source: "supabase", items: dbItems };
  } catch {
    return { source: "fallback", items: fallbackItems };
  }
}

async function loadPilotWalletContext(request: Request) {
  const token = readBearer(request);
  if (!token) {
    throw new Error("Debes iniciar sesión para usar la billetera del piloto.");
  }

  const user = await getUserFromAccessToken(token);
  const supabase = createSupabaseServerClient(token);

  const { data: profile, error: profileError } = await supabase
    .from("pilot_profiles")
    .select("id, callsign, wallet_balance")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "No se encontró el perfil del piloto.");
  }

  return {
    token,
    user,
    supabase,
    profile: profile as { id: string; callsign?: string | null; wallet_balance?: number | string | null },
  };
}

async function loadMyLedger(request: Request) {
  const { supabase, profile } = await loadPilotWalletContext(request);
  const { data, error } = await supabase
    .from("pilot_expense_ledger")
    .select("id, expense_code, category, amount_usd, description, metadata, balance_after_usd, created_at")
    .eq("pilot_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return { ledger: [], ledgerError: error.message, walletBalanceUsd: asNumber(profile.wallet_balance), profile };
  }

  const ledger = ((data ?? []) as PilotExpenseLedgerRow[]).map((row) => ({
    id: row.id ?? "",
    code: row.expense_code ?? "",
    category: row.category ?? "other",
    amountUsd: asNumber(row.amount_usd),
    description: row.description ?? "Gasto del piloto",
    createdAt: row.created_at ?? null,
    label: typeof row.metadata?.label === "string" ? row.metadata.label : row.expense_code ?? "Gasto",
    balanceAfterUsd: asNumber(row.balance_after_usd ?? row.metadata?.wallet_after_usd),
  }));

  return { ledger, ledgerError: null, walletBalanceUsd: asNumber(profile.wallet_balance), profile };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeMine = searchParams.get("mine") === "1" || searchParams.get("mine") === "true";

  try {
    const supabase = createSupabaseServerClient(includeMine ? readBearer(request) : undefined);
    const catalog = await loadCatalog(supabase);
    const basePayload = {
      ok: true,
      source: catalog.source,
      items: catalog.items,
      groups: groupExpenses(catalog.items),
    };

    if (!includeMine) {
      return NextResponse.json(basePayload);
    }

    const my = await loadMyLedger(request);
    return NextResponse.json({
      ...basePayload,
      walletBalanceUsd: my.walletBalanceUsd,
      callsign: my.profile.callsign ?? null,
      ledger: my.ledger,
      ledgerError: my.ledgerError,
    });
  } catch (error) {
    const fallbackItems = catalogFallbackItems();
    const message = error instanceof Error ? error.message : "No se pudo cargar el catálogo de gastos.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        source: "fallback",
        items: fallbackItems,
        groups: groupExpenses(fallbackItems),
      },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, profile } = await loadPilotWalletContext(request);
    const body = (await request.json().catch(() => ({}))) as { code?: string; note?: string };
    const code = normalizeCode(body.code);

    if (!code) {
      return NextResponse.json({ ok: false, error: "Falta el código del gasto." }, { status: 400 });
    }

    const catalog = await loadCatalog(supabase);
    const item = catalog.items.find((expense) => normalizeCode(expense.code) === code);

    if (!item || item.amountUsd <= 0) {
      return NextResponse.json({ ok: false, error: "El gasto seleccionado no existe o no está activo." }, { status: 404 });
    }

    const walletBefore = asNumber(profile.wallet_balance);
    const amount = Math.round(item.amountUsd * 100) / 100;

    if (walletBefore < amount) {
      return NextResponse.json(
        {
          ok: false,
          error: "Saldo insuficiente en la billetera del piloto.",
          walletBalanceUsd: walletBefore,
          requiredUsd: amount,
        },
        { status: 409 }
      );
    }

    const walletAfter = Math.round((walletBefore - amount) * 100) / 100;
    const nowIso = new Date().toISOString();
    const description = `${item.label} — descuento billetera piloto`;

    const { error: updateError } = await supabase
      .from("pilot_profiles")
      .update({ wallet_balance: walletAfter, updated_at: nowIso })
      .eq("id", profile.id);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    const metadata = {
      label: item.label,
      phase: item.phase ?? null,
      required_for: item.requiredFor ?? null,
      description: item.description ?? null,
      wallet_before_usd: walletBefore,
      wallet_after_usd: walletAfter,
      source: "profile_wallet_purchase",
      note: body.note ?? null,
    };

    const { data: ledgerRow, error: ledgerError } = await supabase
      .from("pilot_expense_ledger")
      .insert({
        pilot_id: profile.id,
        pilot_callsign: profile.callsign ?? null,
        expense_code: item.code,
        category: item.category,
        amount_usd: -amount,
        description,
        metadata,
        balance_before_usd: walletBefore,
        balance_after_usd: walletAfter,
        status: "completed",
        reference_code: `EXP-${Date.now()}`,
        created_at: nowIso,
      })
      .select("id, expense_code, category, amount_usd, description, metadata, balance_after_usd, created_at")
      .maybeSingle();

    if (ledgerError) {
      // Rollback best-effort: if ledger insert fails, restore wallet to avoid a hidden charge.
      await supabase
        .from("pilot_profiles")
        .update({ wallet_balance: walletBefore, updated_at: new Date().toISOString() })
        .eq("id", profile.id);

      return NextResponse.json({ ok: false, error: ledgerError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      walletBalanceUsd: walletAfter,
      purchased: {
        code: item.code,
        category: item.category,
        label: item.label,
        amountUsd: amount,
      },
      ledger: ledgerRow,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo registrar el gasto." },
      { status: 500 }
    );
  }
}
