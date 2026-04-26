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


function formatRankLabel(value: string | null | undefined) {
  const normalized = (value ?? "CADET").trim();
  if (!normalized) {
    return "Cadet";
  }

  return normalized
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
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

function getRankBadge(rank: string | null | undefined) {
  const code = (rank ?? "CADET").trim().toUpperCase();

  if (code.includes("LEGEND")) {
    return { symbol: "✦", label: "Leyenda Patagonia" };
  }

  if (code.includes("INSPECTOR") || code.includes("CHECK") || code.includes("MASTER")) {
    return { symbol: "★", label: "Inspector de línea" };
  }

  if (code.includes("COMMANDER")) {
    return { symbol: "◆", label: "Comandante regional" };
  }

  if (code.includes("CAPTAIN")) {
    return { symbol: "▲", label: "Capitán de línea" };
  }

  if (code.includes("FIRST_OFFICER")) {
    return { symbol: "■", label: "Primer oficial" };
  }

  if (code.includes("SECOND_OFFICER")) {
    return { symbol: "●", label: "Segundo oficial" };
  }

  return { symbol: "◈", label: "Cadete" };
}

function readView(value: string | null): ProfileView {
  if (value === "datos") return "datos";
  if (value === "economia") return "economia";
  return "perfil";
}

// ─── Pilot Economy Types ──────────────────────────────────────────────────────

type PilotSalaryData = {
  period: { year: number; month: number };
  paymentDate: string;
  flightsCount: number;
  commissionTotalUsd: number;
  damageDeductionsUsd: number;
  baseSalaryUsd: number;
  netPaidUsd: number;
  qualifiesForBase: boolean;
  ledger: Record<string, unknown> | null;
  recentFlights: Array<{ id: string; commissionUsd: number; damageDeductionUsd: number; completedAt: string }>;
};

const MONTH_NAMES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function fmtUsd(n: number) {
  return `$${Math.abs(n).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USD`;
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

  function handlePrint() {
    window.print();
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

  const walletBalance = toNumber(((profile as unknown) as Record<string, unknown> | null)?.wallet_balance ?? 0);
  const monthName = MONTH_NAMES_ES[(data.period.month - 1)] ?? "";
  const ledgerStatus = (data.ledger as Record<string, unknown> | null)?.status as string | undefined;
  const isPaid = ledgerStatus === "paid";
  const isSkipped = ledgerStatus === "skipped";

  const econCards = [
    { emoji: "💼", label: "Saldo billetera", value: fmtUsd(walletBalance), tone: walletBalance >= 0 ? "text-emerald-300" : "text-rose-300", bg: "from-emerald-500/10" },
    { emoji: "✈️", label: "Vuelos completados", value: String(data.flightsCount), tone: "text-white", bg: "from-sky-500/10" },
    { emoji: "💵", label: "Comisiones del mes", value: fmtUsd(data.commissionTotalUsd), tone: "text-cyan-300", bg: "from-cyan-500/10" },
    { emoji: "📅", label: "Sueldo base", value: data.qualifiesForBase ? fmtUsd(data.baseSalaryUsd) : "No califica (< 5 vuelos)", tone: data.qualifiesForBase ? "text-violet-300" : "text-white/40", bg: "from-violet-500/10" },
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
            onClick={handlePrint}
            className="hidden sm:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/20 hover:text-white print:hidden"
          >
            🖨 Imprimir liquidación
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
                    <span className="text-xs text-white/60 print:text-gray-600">{dateStr}</span>
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

  const rankBadge = useMemo(
    () => getRankBadge(profile?.career_rank_code ?? profile?.rank_code),
    [profile?.career_rank_code, profile?.rank_code]
  );

  const pilotName = useMemo(() => getPilotName(form), [form]);
  const rankLabel = useMemo(
    () => formatRankLabel(profile?.career_rank_code ?? profile?.rank_code),
    [profile?.career_rank_code, profile?.rank_code]
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

                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base">
                    {rankBadge.symbol}
                  </span>
                  <span className="font-semibold">{rankBadge.label}</span>
                </div>

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

