"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthPageFrame from "@/components/site/AuthPageFrame";
import PublicHeader from "@/components/site/PublicHeader";
import ProtectedPage, {
  useProtectedSession,
} from "@/components/site/ProtectedPage";
import {
  ensurePilotProfile,
  updatePilotProfile,
  type PilotProfileRecord,
} from "@/lib/pilot-profile";
import { getRankInsignia } from "@/lib/rank-insignias";
import { supabase } from "@/lib/supabase/browser";
import { resolveSurScore } from "@/lib/sur-score";

type ProfileFormState = {
  first_name: string;
  last_name: string;
  callsign: string;
  email: string;
  country: string;
  base_hub: string;
  simulator: string;
  simbrief_username: string;
  vatsim_id: string;
  ivao_id: string;
};

type ProfileView = "perfil" | "datos" | "economia";

type NavigraphStatusResponse = {
  configured: boolean;
  connected: boolean;
  hasRefreshToken: boolean;
  expiresAt: string | null;
  scopes: string[];
  subscriptions: string[];
  clientId: string | null;
  subject: string | null;
  error: string | null;
};


type PilotScoreRow = {
  pulso_10: number | null;
  ruta_10: number | null;
  legado_points: number | null;
};

const EMPTY_FORM: ProfileFormState = {
  first_name: "",
  last_name: "",
  callsign: "",
  email: "",
  country: "Chile",
  base_hub: "SCEL",
  simulator: "MSFS 2020",
  simbrief_username: "",
  vatsim_id: "",
  ivao_id: "",
};

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNavigraphExpiry(value: string | null | undefined) {
  if (!value) {
    return "Sin sesión activa";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}


function getTotalHours(profile: PilotProfileRecord | null) {
  if (!profile) {
    return 0;
  }

  const raw = profile as PilotProfileRecord & {
    total_hours?: number | string | null;
    career_hours?: number | string | null;
    transferred_hours?: number | string | null;
  };

  const totalHours = toNumber(raw.total_hours);
  if (totalHours > 0) {
    return totalHours;
  }

  return toNumber(raw.career_hours) + toNumber(raw.transferred_hours);
}

function getPilotName(form: ProfileFormState) {
  const value = [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(" ");
  return value || form.callsign || "Piloto Patagonia Wings";
}

function readView(value: string | null): ProfileView {
  if (value === "datos") return "datos";
  if (value === "economia") return "economia";
  return "perfil";
}

// ─── Pilot Economy Types ──────────────────────────────────────────────────────

type PilotSalaryHistoryItem = {
  periodYear: number;
  periodMonth: number;
  flightsCount: number;
  blockHoursTotal: number;
  commissionTotalUsd: number;
  baseSalaryUsd: number;
  damageDeductionsUsd: number;
  expensesTotalUsd: number;
  netPaidUsd: number;
  status: string;
  paidAt: string | null;
};

type PilotSalaryData = {
  period: { year: number; month: number };
  paymentDate: string;
  pilot?: { walletBalanceUsd?: number; callsign?: string | null; name?: string | null };
  flightsCount: number;
  blockMinutesTotal?: number;
  blockHoursTotal?: number;
  commissionTotalUsd: number;
  damageDeductionsUsd: number;
  expensesTotalUsd?: number;
  expensesByCategory?: Record<string, number>;
  baseSalaryUsd: number;
  grossTotalUsd?: number;
  netPaidUsd: number;
  qualifiesForBase: boolean;
  ledger: Record<string, unknown> | null;
  recentFlights: Array<{
    id: string;
    flightNumber?: string;
    origin?: string;
    destination?: string;
    commissionUsd: number;
    damageDeductionUsd: number;
    blockMinutes?: number;
    completedAt: string;
  }>;
  expenses?: Array<{
    id: string;
    code: string;
    category: string;
    amountUsd: number;
    description: string;
    createdAt: string | null;
  }>;
  monthlyHistory?: PilotSalaryHistoryItem[];
};

type PilotExpenseWalletItem = {
  code: string;
  category: string;
  label: string;
  amountUsd: number;
  description?: string;
  phase?: string;
  requiredFor?: string;
};

type PilotExpenseWalletGroup = {
  category: string;
  label: string;
  totalUsd: number;
  items: PilotExpenseWalletItem[];
};

type PilotExpenseLedgerItem = {
  id: string;
  code: string;
  category: string;
  amountUsd: number;
  description: string;
  createdAt: string | null;
  label: string;
  balanceAfterUsd: number;
};

type PilotExpenseWalletResponse = {
  ok: boolean;
  error?: string;
  walletBalanceUsd?: number;
  groups?: PilotExpenseWalletGroup[];
  ledger?: PilotExpenseLedgerItem[];
};

const MONTH_NAMES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function fmtUsd(n: number) {
  return `$${Math.abs(n).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USD`;
}

function PilotExpenseWalletPanel({ session, initialWalletUsd }: { session: import("@supabase/supabase-js").Session; initialWalletUsd: number }) {
  const [groups, setGroups] = useState<PilotExpenseWalletGroup[]>([]);
  const [ledger, setLedger] = useState<PilotExpenseLedgerItem[]>([]);
  const [wallet, setWallet] = useState(initialWalletUsd);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadExpenses() {
    setLoading(true);
    setError("");
    try {
      const token = session.access_token ?? "";
      const res = await fetch("/api/economia/pilot-expenses?mine=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as PilotExpenseWalletResponse;
      if (!json.ok) throw new Error(json.error ?? "No se pudo cargar la billetera operacional.");
      setGroups(json.groups ?? []);
      setLedger(json.ledger ?? []);
      setWallet(toNumber(json.walletBalanceUsd ?? initialWalletUsd));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar gastos del piloto.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExpenses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.access_token]);

  async function purchaseExpense(item: PilotExpenseWalletItem) {
    setBusyCode(item.code);
    setError("");
    setMessage("");
    try {
      const token = session.access_token ?? "";
      const res = await fetch("/api/economia/pilot-expenses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: item.code }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; walletBalanceUsd?: number; purchased?: { label?: string; amountUsd?: number } };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudo registrar el gasto.");
      setWallet(toNumber(json.walletBalanceUsd ?? wallet));
      setMessage(`${json.purchased?.label ?? item.label} descontado correctamente por ${fmtUsd(toNumber(json.purchased?.amountUsd ?? item.amountUsd))}.`);
      await loadExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al descontar gasto.");
    } finally {
      setBusyCode("");
    }
  }

  const recommendedGroups = groups.filter((group) => ["theory_exam", "license", "certification", "type_rating", "training"].includes(group.category));

  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.02] px-5 py-5 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Billetera operacional</p>
          <h3 className="mt-1 text-lg font-black text-white">Licencias, pruebas y habilitaciones</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">
            Usa tu saldo virtual para pagar pruebas teóricas, checkrides, licencias y habilitaciones. Cada movimiento queda registrado para historial y métricas.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-3 text-right">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Saldo disponible</p>
          <p className="mt-1 text-xl font-black text-emerald-200">{fmtUsd(wallet)}</p>
        </div>
      </div>

      {loading ? <div className="mt-5 text-sm text-white/40">Cargando catálogo operacional...</div> : null}
      {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {message ? <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

      {!loading && recommendedGroups.length > 0 ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {recommendedGroups.map((group) => (
            <div key={group.category} className="rounded-[18px] border border-white/8 bg-black/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-white">{group.label}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/36">Total {fmtUsd(group.totalUsd)}</p>
              </div>
              <div className="mt-3 space-y-2">
                {group.items.slice(0, 4).map((item) => {
                  const canPay = wallet >= item.amountUsd;
                  const busy = busyCode === item.code;
                  return (
                    <div key={item.code} className="rounded-2xl border border-white/6 bg-white/[0.018] px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white/88">{item.label}</p>
                          <p className="mt-0.5 text-[11px] leading-4 text-white/44">{item.requiredFor ? `${item.requiredFor} · ` : ""}{item.phase ?? "Operación"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-cyan-200">{fmtUsd(item.amountUsd)}</span>
                          <button
                            type="button"
                            onClick={() => purchaseExpense(item)}
                            disabled={!canPay || Boolean(busyCode)}
                            className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold transition ${
                              canPay
                                ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300/40"
                                : "border-white/8 bg-white/[0.025] text-white/28"
                            }`}
                          >
                            {busy ? "Procesando..." : canPay ? "Pagar" : "Saldo insuf."}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {ledger.length > 0 ? (
        <div className="mt-5 rounded-[18px] border border-white/8 bg-black/10 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Últimos gastos registrados</p>
          <div className="mt-3 space-y-2">
            {ledger.slice(0, 6).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.015] px-3 py-2 text-xs">
                <div>
                  <p className="font-semibold text-white/78">{row.label || row.description}</p>
                  <p className="text-white/34">{row.createdAt ? new Date(row.createdAt).toLocaleDateString("es-CL") : "Sin fecha"} · {row.category}</p>
                </div>
                <p className="font-black text-rose-200">−{fmtUsd(Math.abs(row.amountUsd))}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}


function PilotEconomyView({ session, profile }: { session: import("@supabase/supabase-js").Session; profile: import("@/lib/pilot-profile").PilotProfileRecord | null }) {
  const [data, setData] = useState<PilotSalaryData | null>(null);
  const [loadingEco, setLoadingEco] = useState(true);
  const [errorEco, setErrorEco] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingEco(true);
      setErrorEco("");
      try {
        const token = session.access_token ?? "";
        const res = await fetch("/api/pilot/salary/monthly", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("No se pudo cargar la liquidación.");
        const json = (await res.json()) as PilotSalaryData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setErrorEco(err instanceof Error ? err.message : "Error al cargar.");
      } finally {
        if (!cancelled) setLoadingEco(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [session]);

  function buildPdfHtml() {
    const monthName = MONTH_NAMES_ES[(data!.period.month - 1)] ?? "";
    const callsign = profile?.callsign ?? "—";
    const walletBal = toNumber(((profile as unknown) as Record<string, unknown> | null)?.wallet_balance ?? 0);
    const rows = [
      ["Callsign", callsign],
      ["Período", `${monthName} ${data!.period.year}`],
      ["Fecha de pago estimada", data!.paymentDate],
      ["Vuelos completados", String(data!.flightsCount)],
      ["Califica sueldo base (≥5 vuelos)", data!.qualifiesForBase ? "Sí" : "No"],
      ["Comisiones", `+${fmtUsd(data!.commissionTotalUsd)}`],
      ["Sueldo base", `+${fmtUsd(data!.baseSalaryUsd)}`],
      ["Deducciones por daño", data!.damageDeductionsUsd > 0 ? `−${fmtUsd(data!.damageDeductionsUsd)}` : "$0 USD"],
      ["TOTAL NETO", fmtUsd(data!.netPaidUsd)],
      ["Saldo billetera", fmtUsd(walletBal)],
      ["Estado del período", (data!.ledger as Record<string, unknown> | null)?.status === "paid" ? "PAGADO" : "PENDIENTE"],
    ];

    const tableRows = rows.map(([label, value]) =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;text-align:right">${value}</td></tr>`
    ).join("");

    const flightRows = (data!.recentFlights ?? []).slice(0, 15).map((f, i) => {
      const dateStr = f.completedAt ? new Date(f.completedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : "—";
      return `<tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"}"><td style="padding:6px 12px;font-size:12px;color:#374151">${i + 1}</td><td style="padding:6px 12px;font-size:12px;color:#374151">${dateStr}</td><td style="padding:6px 12px;font-size:12px;text-align:right;color:#059669;font-weight:600">+${fmtUsd(f.commissionUsd)}</td><td style="padding:6px 12px;font-size:12px;text-align:right;color:${f.damageDeductionUsd > 0 ? "#dc2626" : "#9ca3af"};font-weight:600">${f.damageDeductionUsd > 0 ? `−${fmtUsd(f.damageDeductionUsd)}` : "—"}</td></tr>`;
    }).join("");

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Liquidación ${callsign} — ${monthName} ${data!.period.year}</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:32px;color:#111827;background:#fff}h1{font-size:22px;font-weight:800;margin:0 0 4px}p.sub{font-size:13px;color:#6b7280;margin:0 0 24px}hr{border:none;border-top:2px solid #e5e7eb;margin:20px 0}table{width:100%;border-collapse:collapse}th{padding:10px 12px;background:#f3f4f6;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;text-align:left}th:last-child{text-align:right}.footer{margin-top:32px;font-size:11px;color:#9ca3af;text-align:center}@media print{body{padding:16px}}</style></head><body>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
  <div><h1>Patagonia Wings — Liquidación de haberes</h1><p class="sub">${monthName} ${data!.period.year} · Piloto: ${callsign}</p></div>
  <div style="font-size:28px">✈</div>
</div>
<hr>
<table><tbody>${tableRows}</tbody></table>
${flightRows ? `<hr><h2 style="font-size:15px;font-weight:700;margin:16px 0 8px">Detalle de vuelos (${data!.recentFlights.length})</h2><table><thead><tr><th>#</th><th>Fecha</th><th style="text-align:right">Comisión</th><th style="text-align:right">Deducción</th></tr></thead><tbody>${flightRows}</tbody></table>` : ""}
<div class="footer"><p>Documento generado el ${new Date().toLocaleDateString("es-CL")} · No es un documento oficial. Solo para uso interno Patagonia Wings Virtual Airline.</p></div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;
  }

  async function handleDownloadPdf() {
    if (!data) return;
    const token = session.access_token ?? "";
    const query = new URLSearchParams({
      year: String(data.period.year),
      month: String(data.period.month),
    });

    const res = await fetch(`/api/pilot/salary/monthly/pdf?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setErrorEco("No se pudo generar el PDF de liquidación.");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `liquidacion-${profile?.callsign ?? "piloto"}-${data.period.year}-${String(data.period.month).padStart(2, "0")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  if (loadingEco) {
    return (
      <div className="py-10 text-center text-sm text-white/40">Cargando datos económicos...</div>
    );
  }

  if (errorEco) {
    return (
      <div className="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{errorEco}</div>
    );
  }

  if (!data) return null;

  const walletBalance = toNumber(data.pilot?.walletBalanceUsd ?? ((profile as unknown) as Record<string, unknown> | null)?.wallet_balance ?? 0);
  const monthName = MONTH_NAMES_ES[(data.period.month - 1)] ?? "";
  const ledgerStatus = (data.ledger as Record<string, unknown> | null)?.status as string | undefined;
  const isPaid = ledgerStatus === "paid";
  const isSkipped = ledgerStatus === "skipped";

  const econCards = [
    { emoji: "💼", label: "Saldo billetera", value: fmtUsd(walletBalance), tone: walletBalance >= 0 ? "text-emerald-300" : "text-rose-300", bg: "from-emerald-500/10" },
    { emoji: "✈️", label: "Vuelos completados", value: String(data.flightsCount), tone: "text-white", bg: "from-sky-500/10" },
    { emoji: "⏱️", label: "Horas bloque", value: `${formatDecimal(toNumber(data.blockHoursTotal))} h`, tone: "text-white", bg: "from-indigo-500/10" },
    { emoji: "💵", label: "Comisiones del mes", value: fmtUsd(data.commissionTotalUsd), tone: "text-cyan-300", bg: "from-cyan-500/10" },
    { emoji: "📅", label: "Sueldo base", value: data.qualifiesForBase ? fmtUsd(data.baseSalaryUsd) : "No califica (< 5 vuelos)", tone: data.qualifiesForBase ? "text-violet-300" : "text-white/40", bg: "from-violet-500/10" },
    { emoji: "🎓", label: "Gastos piloto", value: toNumber(data.expensesTotalUsd) > 0 ? `−${fmtUsd(toNumber(data.expensesTotalUsd))}` : "Sin gastos", tone: toNumber(data.expensesTotalUsd) > 0 ? "text-amber-300" : "text-white/40", bg: "from-amber-500/10" },
    { emoji: "🔧", label: "Deducciones daño", value: data.damageDeductionsUsd > 0 ? `−${fmtUsd(data.damageDeductionsUsd)}` : "Sin deducciones", tone: data.damageDeductionsUsd > 0 ? "text-rose-300" : "text-white/40", bg: "from-rose-500/10" },
    { emoji: "🏦", label: "Neto del período", value: fmtUsd(data.netPaidUsd), tone: "text-emerald-300", bg: "from-emerald-500/10" },
  ];

  return (
    <div className="space-y-6 print:text-black">
      {/* Print header (only visible on print) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Patagonia Wings — Liquidación de haberes</h1>
        <p className="text-sm">{monthName} {data.period.year} · Piloto: {profile?.callsign ?? "—"}</p>
        <hr className="mt-2" />
      </div>

      {/* Period header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40 print:text-gray-500">Período actual</p>
          <h3 className="mt-1 text-xl font-bold text-white print:text-black">{monthName} {data.period.year}</h3>
          <p className="mt-1 text-xs text-white/48 print:text-gray-600">Fecha de pago estimada: {data.paymentDate}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${
            isPaid ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
            : isSkipped ? "border-white/10 bg-white/[0.04] text-white/40"
            : "border-amber-300/20 bg-amber-400/10 text-amber-200"
          }`}>
            {isPaid ? "✅ Pagado" : isSkipped ? "Sin actividad" : "🕐 Pendiente"}
          </span>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="hidden sm:flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/40 hover:bg-emerald-400/14 print:hidden"
          >
            📄 Descargar PDF
          </button>
        </div>
      </div>

      {/* Economy cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {econCards.map((card) => (
          <div key={card.label} className={`rounded-[20px] border border-white/8 bg-gradient-to-br ${card.bg} to-transparent px-5 py-5 print:border print:border-gray-200 print:bg-white`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl print:hidden">{card.emoji}</span>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40 print:text-gray-500">{card.label}</p>
            </div>
            <p className={`text-xl font-black ${card.tone} print:text-black`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Payment info */}
      <div className="rounded-[20px] border border-white/8 bg-white/[0.02] px-5 py-5 print:border print:border-gray-200">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 print:text-gray-500 mb-3">Resumen del período</p>
        <div className="space-y-2">
          {[
            { label: "Comisiones", value: `+${fmtUsd(data.commissionTotalUsd)}`, color: "text-emerald-300" },
            { label: `Sueldo base (${data.qualifiesForBase ? "5+ vuelos ✓" : "< 5 vuelos ✗"})`, value: data.qualifiesForBase ? `+${fmtUsd(data.baseSalaryUsd)}` : "$0 USD", color: data.qualifiesForBase ? "text-violet-300" : "text-white/40" },
            { label: "Gastos pagados por el piloto", value: toNumber(data.expensesTotalUsd) > 0 ? `−${fmtUsd(toNumber(data.expensesTotalUsd))}` : "$0 USD", color: toNumber(data.expensesTotalUsd) > 0 ? "text-amber-300" : "text-white/40" },
            { label: "Deducciones por daño", value: data.damageDeductionsUsd > 0 ? `−${fmtUsd(data.damageDeductionsUsd)}` : "$0 USD", color: data.damageDeductionsUsd > 0 ? "text-rose-300" : "text-white/40" },
          ].map((row) => (
            <div key={row.label} className="flex justify-between text-sm">
              <span className="text-white/60 print:text-gray-600">{row.label}</span>
              <span className={`font-bold ${row.color} print:text-black`}>{row.value}</span>
            </div>
          ))}
          <div className="mt-2 border-t border-white/8 pt-2 flex justify-between text-sm print:border-t print:border-gray-200">
            <span className="font-bold text-white print:text-black">Total neto</span>
            <span className="font-black text-emerald-300 print:text-black">{fmtUsd(data.netPaidUsd)}</span>
          </div>
        </div>
      </div>

      <PilotExpenseWalletPanel session={session} initialWalletUsd={walletBalance} />

      {/* Recent flights */}
      {data.recentFlights.length > 0 && (
        <div className="rounded-[20px] border border-white/8 bg-white/[0.02] px-5 py-5 print:border print:border-gray-200">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 print:text-gray-500 mb-3">Vuelos del período ({data.recentFlights.length})</p>
          <div className="space-y-1.5">
            {data.recentFlights.slice(0, 10).map((f, i) => {
              const dateStr = f.completedAt ? new Date(f.completedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : "—";
              return (
                <div key={i} className="flex items-center justify-between rounded-[10px] border border-white/5 bg-white/[0.015] px-3 py-2 print:border print:border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/30 print:text-gray-400">✈</span>
                    <span className="text-xs text-white/60 print:text-gray-600">{dateStr} · {f.flightNumber ?? "Vuelo"} · {f.origin ?? "---"}-{f.destination ?? "---"}</span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-emerald-300 font-semibold print:text-black">+{fmtUsd(f.commissionUsd)}</span>
                    {f.damageDeductionUsd > 0 && (
                      <span className="text-rose-300 font-semibold print:text-gray-600">−{fmtUsd(f.damageDeductionUsd)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Salary history */}
      {data.monthlyHistory && data.monthlyHistory.length > 0 ? (
        <div className="rounded-[20px] border border-white/8 bg-white/[0.02] px-5 py-5 print:border print:border-gray-200">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 print:text-gray-500 mb-3">Historial mensual</p>
          <div className="space-y-1.5">
            {data.monthlyHistory.slice(0, 8).map((row) => {
              const label = `${MONTH_NAMES_ES[(row.periodMonth - 1)] ?? "Mes"} ${row.periodYear}`;
              return (
                <div key={`${row.periodYear}-${row.periodMonth}`} className="grid gap-2 rounded-[12px] border border-white/5 bg-white/[0.015] px-3 py-2 text-xs sm:grid-cols-[1fr_auto_auto_auto] print:border print:border-gray-100">
                  <span className="font-semibold text-white/72 print:text-black">{label}</span>
                  <span className="text-white/46 print:text-gray-600">{row.flightsCount} vuelos · {formatDecimal(toNumber(row.blockHoursTotal))} h</span>
                  <span className="text-emerald-300 font-bold print:text-black">{fmtUsd(row.netPaidUsd)}</span>
                  <span className="text-white/36 print:text-gray-500">{row.status === "paid" ? "Pagado" : row.status === "skipped" ? "Sin actividad" : "Pendiente"}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Print footer */}
      <div className="hidden print:block mt-6 text-xs text-gray-500 border-t pt-4">
        <p>Patagonia Wings Virtual Airline — Documento generado el {new Date().toLocaleDateString("es-CL")}. Documento no oficial.</p>
      </div>
    </div>
  );
}

function ProfileContent() {
  const session = useProtectedSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [profile, setProfile] = useState<PilotProfileRecord | null>(null);
  const [activeView, setActiveView] = useState<ProfileView>(readView(searchParams.get("view")));
  const [score, setScore] = useState({
    pulso10: 0,
    ruta10: 0,
    legado: 0,
  });
  const surScore = resolveSurScore(score);

  const [navigraphStatus, setNavigraphStatus] = useState<NavigraphStatusResponse | null>(null);
  const [loadingNavigraphStatus, setLoadingNavigraphStatus] = useState(false);

  const [form, setForm] = useState<ProfileFormState>({
    ...EMPTY_FORM,
    email: session.user.email ?? "",
  });

  useEffect(() => {
    setActiveView(readView(searchParams.get("view")));
  }, [searchParams]);


  useEffect(() => {
    let cancelled = false;

    async function loadNavigraphStatus() {
      setLoadingNavigraphStatus(true);

      try {
        const response = await fetch("/api/auth/navigraph/status", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        const payload = (await response.json()) as NavigraphStatusResponse;

        if (!cancelled) {
          if (response.ok) {
            setNavigraphStatus(payload);
          } else {
            setNavigraphStatus(payload);
            if (payload?.error) {
              setErrorMessage(payload.error);
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setNavigraphStatus(null);
          setErrorMessage(
            error instanceof Error ? error.message : "No se pudo consultar Navigraph."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingNavigraphStatus(false);
        }
      }
    }

    const ng = searchParams.get("ng");
    const ngError = searchParams.get("ng_error");

    if (ng === "connected") {
      setInfoMessage("Navigraph conectado correctamente.");
      setErrorMessage("");
    } else if (ngError) {
      setErrorMessage(ngError);
    }

    void loadNavigraphStatus();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);

      try {
        const currentProfile = await ensurePilotProfile(session.user);

        if (cancelled) {
          return;
        }

        setProfile(currentProfile);
        setForm({
          first_name: currentProfile?.first_name ?? "",
          last_name: currentProfile?.last_name ?? "",
          callsign: currentProfile?.callsign ?? "",
          email: currentProfile?.email ?? session.user.email ?? "",
          country: currentProfile?.country ?? "Chile",
          base_hub: currentProfile?.base_hub ?? "SCEL",
          simulator: "MSFS 2020",
          simbrief_username: currentProfile?.simbrief_username ?? "",
          vatsim_id: currentProfile?.vatsim_id ?? "",
          ivao_id: currentProfile?.ivao_id ?? "",
        });

        if (currentProfile?.callsign) {
          const { data } = await supabase
            .from("pw_pilot_scores")
            .select("pulso_10, ruta_10, legado_points")
            .eq("pilot_callsign", currentProfile.callsign)
            .maybeSingle();

          if (!cancelled) {
            const row = (data ?? null) as PilotScoreRow | null;
            setScore({
              pulso10: toNumber(row?.pulso_10),
              ruta10: toNumber(row?.ruta_10),
              legado: toNumber(row?.legado_points),
            });
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session.user]);

  function updateField<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function switchView(nextView: ProfileView) {
    setActiveView(nextView);
    router.replace(`/profile?view=${nextView}`);
  }


  async function handleDisconnectNavigraph() {
    setLoadingNavigraphStatus(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const response = await fetch("/api/auth/navigraph/disconnect", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("No se pudo desconectar Navigraph.");
      }

      setNavigraphStatus((current) =>
        current
          ? {
              ...current,
              connected: false,
              hasRefreshToken: false,
              expiresAt: null,
              subject: null,
            }
          : null
      );
      setInfoMessage("Sesión Navigraph desconectada correctamente.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo desconectar Navigraph."
      );
    } finally {
      setLoadingNavigraphStatus(false);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const updated = await updatePilotProfile(session.user.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        country: form.country.trim(),
        simbrief_username: form.simbrief_username.trim() || null,
        vatsim_id: form.vatsim_id.trim() || null,
        ivao_id: form.ivao_id.trim() || null,
      });

      setProfile(updated);
      setInfoMessage("Tus datos se guardaron correctamente.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudieron guardar los datos."
      );
    } finally {
      setSaving(false);
    }
  }

  const rankInsignia = useMemo(
    () => getRankInsignia(profile?.career_rank_code ?? profile?.rank_code),
    [profile?.career_rank_code, profile?.rank_code]
  );

  const pilotName = useMemo(() => getPilotName(form), [form]);
  const rankLabel = useMemo(
    () => rankInsignia.name,
    [rankInsignia.name]
  );

  return (
    <AuthPageFrame>
      <div className="space-y-6">
        <section className="glass-panel rounded-[30px] p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="parallax-chip">Cuenta piloto</span>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-[40px]">
                Área personal Patagonia Wings
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
                Aquí dejamos el perfil limpio: datos del piloto por un lado y ficha operacional por otro, sin mezclar Navigraph ni pasos de despacho.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => switchView("perfil")}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeView === "perfil"
                    ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                    : "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                }`}
              >
                Mi perfil
              </button>
              <button
                type="button"
                onClick={() => switchView("datos")}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeView === "datos"
                    ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                    : "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                }`}
              >
                Mis datos
              </button>
              <button
                type="button"
                onClick={() => switchView("economia")}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeView === "economia"
                    ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                    : "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                }`}
              >
                💰 Mi economía
              </button>
            </div>
          </div>
        </section>

        {activeView === "perfil" ? (
          <section className="glass-panel rounded-[30px] p-6 sm:p-7">
            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="surface-outline rounded-[26px] p-6 text-center">
                <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-[32px] border border-white/12 bg-[radial-gradient(circle_at_top,rgba(103,215,255,0.22),rgba(4,20,40,0.9))] text-4xl font-semibold tracking-[0.16em] text-white shadow-[0_18px_46px_rgba(0,0,0,0.28)]">
                  {(form.first_name.charAt(0) + form.last_name.charAt(0) || form.callsign.slice(0, 2) || "PW").toUpperCase()}
                </div>

                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/56">
                  {form.callsign || "PWG000"}
                </p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight text-white">
                  {pilotName}
                </h2>

                <div className="mt-5 flex items-center justify-center">
                  <img
                    src={rankInsignia.asset}
                    alt={`Insignia ${rankInsignia.name}`}
                    className="h-24 w-24 object-contain sm:h-32 sm:w-32"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                <p className="mt-3 text-sm font-semibold text-cyan-100">{rankInsignia.name}</p>

                <p className="mt-3 text-sm text-white/66">Foto de piloto pendiente por cargar</p>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    { label: "Rango", value: rankLabel },
                    { label: "Horas totales", value: formatDecimal(getTotalHours(profile)) },
                    {
                      label: "Estado",
                      value: profile?.status?.trim().toLowerCase() === "inactive" ? "Inactivo" : "Activo",
                    },
                    { label: "País", value: form.country || "Chile" },
                    { label: "Hub base", value: form.base_hub || "SCEL" },
                    { label: "SimBrief", value: form.simbrief_username || "Pendiente" },
                    { label: "VATSIM ID", value: form.vatsim_id || "—" },
                    { label: "IVAO ID", value: form.ivao_id || "—" },
                    { label: "Simulador", value: "MSFS 2020" },
                  ].map((item) => (
                    <div key={item.label} className="surface-outline rounded-[22px] px-5 py-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/54">
                        {item.label}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">{loading ? "…" : item.value}</p>
                    </div>
                  ))}
                </div>


                <div className="surface-outline rounded-[24px] px-5 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/54">
                        Integración Navigraph
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {loadingNavigraphStatus
                          ? "Consultando..."
                          : navigraphStatus?.connected
                            ? "Conectado"
                            : navigraphStatus?.configured
                              ? "Pendiente"
                              : "Sin configurar"}
                      </p>
                    </div>

                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      navigraphStatus?.connected
                        ? "border border-emerald-300/20 bg-emerald-500/[0.12] text-emerald-100"
                        : "border border-white/10 bg-white/[0.05] text-white/70"
                    }`}>
                      {navigraphStatus?.connected ? "Activo" : "Web auth"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/54">Subject</p>
                      <p className="mt-2 text-sm font-medium text-white">{navigraphStatus?.subject || "Sin enlazar"}</p>
                    </div>
                    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/54">Expira</p>
                      <p className="mt-2 text-sm font-medium text-white">{formatNavigraphExpiry(navigraphStatus?.expiresAt)}</p>
                    </div>
                    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/54">Scopes</p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {navigraphStatus?.scopes?.length ? navigraphStatus.scopes.join(", ") : "Pendiente"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href="/api/auth/navigraph/start?next=%2Fprofile%3Fview%3Dperfil"
                      className="button-primary"
                    >
                      {navigraphStatus?.connected ? "Reconectar Navigraph" : "Conectar Navigraph"}
                    </a>

                    {navigraphStatus?.connected ? (
                      <button type="button" className="button-secondary" onClick={() => void handleDisconnectNavigraph()}>
                        Desconectar
                      </button>
                    ) : null}
                  </div>

                  <p className="mt-4 text-sm leading-7 text-white/68">
                    La conexión web de Navigraph se usará para abrir y validar el flujo OFP / SimBrief desde el despacho de Patagonia Wings.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-1">
                  {[
                    { label: "Patagonia Score", value: formatDecimal(surScore) },
                  ].map((item) => (
                    <div key={item.label} className="surface-outline rounded-[22px] px-5 py-5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/54">
                        {item.label}
                      </p>
                      <p className="mt-2 text-[28px] font-semibold text-white">{loading ? "…" : item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "economia" ? (
          <section className="glass-panel rounded-[30px] p-6 sm:p-7">
            <div className="mb-5">
              <span className="section-chip">Mi economía</span>
              <h2 className="mt-4 text-3xl font-semibold text-white">💰 Liquidación del período actual</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72">
                Tus comisiones, sueldo base y deducciones del mes en curso. El pago se realiza el último día hábil del mes.
              </p>
            </div>
            <PilotEconomyView session={session} profile={profile} />
          </section>
        ) : null}

        {activeView === "datos" ? (
          <section className="glass-panel rounded-[30px] p-6 sm:p-7">
            <div className="mb-5">
              <span className="section-chip">Datos personales</span>
              <h2 className="mt-4 text-3xl font-semibold text-white">Editar información del piloto</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72">
                Dejamos el hub bloqueado porque solo se define al registrarte. El simulador también queda fijo en MSFS 2020 por ahora.
              </p>
            </div>

            <form onSubmit={handleSave}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Nombre</label>
                  <input
                    className="input-premium"
                    value={form.first_name}
                    onChange={(event) => updateField("first_name", event.target.value)}
                  />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Apellido</label>
                  <input
                    className="input-premium"
                    value={form.last_name}
                    onChange={(event) => updateField("last_name", event.target.value)}
                  />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Callsign</label>
                  <input className="input-premium opacity-70" value={form.callsign} readOnly />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Email</label>
                  <input className="input-premium opacity-70" value={form.email} readOnly />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">País</label>
                  <input
                    className="input-premium"
                    value={form.country}
                    onChange={(event) => updateField("country", event.target.value)}
                  />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Hub base</label>
                  <input className="input-premium opacity-70" value={`${form.base_hub} · Bloqueado`} readOnly />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Simulador</label>
                  <input className="input-premium opacity-70" value="MSFS 2020" readOnly />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Usuario SimBrief</label>
                  <input
                    className="input-premium"
                    value={form.simbrief_username}
                    onChange={(event) => updateField("simbrief_username", event.target.value)}
                    placeholder="Ej: candonga5"
                  />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">VATSIM ID</label>
                  <input
                    className="input-premium"
                    value={form.vatsim_id}
                    onChange={(event) => updateField("vatsim_id", event.target.value)}
                  />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">IVAO ID</label>
                  <input
                    className="input-premium"
                    value={form.ivao_id}
                    onChange={(event) => updateField("ivao_id", event.target.value)}
                  />
                </div>
              </div>

              {errorMessage ? (
                <div className="mt-5 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {errorMessage}
                </div>
              ) : null}

              {infoMessage ? (
                <div className="mt-5 rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                  {infoMessage}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="submit" className="button-primary" disabled={saving || loading}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => switchView("perfil")}
                >
                  Volver a mi perfil
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </AuthPageFrame>
  );
}

export default function ProfilePage() {
  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="relative z-10">
          <header className="pw-container sticky top-4 z-40 pt-5">
            <PublicHeader />
          </header>

          <ProtectedPage>
            <ProfileContent />
          </ProtectedPage>
        </div>
      </section>
    </main>
  );
}
