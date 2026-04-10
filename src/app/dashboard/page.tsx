"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PublicHeader from "@/components/site/PublicHeader";
import ProtectedPage, {
  useProtectedSession,
} from "@/components/site/ProtectedPage";
import {
  ensurePilotProfile,
  type PilotProfileRecord,
} from "@/lib/pilot-profile";
import { supabase } from "@/lib/supabase/browser";

type DashboardMetrics = {
  pilotStatus: string;
  monthLabel: string;
  monthPosition: number | null;
  monthHours: number;
  totalPireps: number;
  totalHours: number;
  pulso10: number;
  ruta10: number;
  legadoPoints: number;
  walletBalance: number;
  careerRank: string;
};

type ScoreLedgerRow = {
  pilot_callsign: string | null;
  flight_hours: number | null;
  created_at: string | null;
};

type ScoreRow = {
  pilot_callsign: string;
  pulso_10: number | null;
  ruta_10: number | null;
  legado_points: number | null;
};

type PilotHoursRow = {
  callsign: string | null;
  total_hours?: number | null;
  career_hours?: number | null;
  transferred_hours?: number | null;
};

type DashboardTabKey = "central" | "dispatch" | "office" | "training";
type DispatchStepKey = "aircraft" | "itinerary" | "dispatch_flow" | "summary";

type MetricDisplayItem = {
  label: string;
  type: "text" | "number" | "currency";
  value: string | number;
  decimals?: number;
};

const EMPTY_METRICS: DashboardMetrics = {
  pilotStatus: "ACTIVO",
  monthLabel: "Mes actual",
  monthPosition: null,
  monthHours: 0,
  totalPireps: 0,
  totalHours: 0,
  pulso10: 0,
  ruta10: 0,
  legadoPoints: 0,
  walletBalance: 0,
  careerRank: "Cadet",
};

const DASHBOARD_TABS: Array<{ key: DashboardTabKey; label: string }> = [
  { key: "central", label: "Central" },
  { key: "dispatch", label: "Despacho" },
  { key: "office", label: "Oficina" },
  { key: "training", label: "Entrenamiento" },
];

const DISPATCH_STEPS: Array<{ key: DispatchStepKey; label: string; shortLabel: string }> = [
  { key: "aircraft", label: "1. Aeronave", shortLabel: "Aeronave" },
  { key: "itinerary", label: "2. Itinerario", shortLabel: "Itinerario" },
  { key: "dispatch_flow", label: "3. Despacho", shortLabel: "Despacho" },
  { key: "summary", label: "4. Resumen", shortLabel: "Resumen" },
];


function toSafeNumber(value: unknown) {
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

function formatCurrency(value: number) {
  return `$${formatInteger(value)}`;
}

function getShortPilotName(profile: PilotProfileRecord | null, email?: string | null) {
  const firstName = profile?.first_name?.trim().split(/\s+/)[0] ?? "";
  const firstLastName = profile?.last_name?.trim().split(/\s+/)[0] ?? "";
  const shortName = [firstName, firstLastName].filter(Boolean).join(" ").trim();

  if (shortName) {
    return shortName;
  }

  if (firstName) {
    return firstName;
  }

  if (email) {
    const localPart = email.split("@")[0]?.trim();
    if (localPart) {
      return localPart;
    }
  }

  return profile?.callsign ?? "Piloto";
}

function getProfileTotalHours(profile: PilotProfileRecord | null) {
  if (!profile) {
    return 0;
  }

  const raw = profile as PilotProfileRecord & {
    total_hours?: number | string | null;
    career_hours?: number | string | null;
    transferred_hours?: number | string | null;
  };

  const directTotal = toSafeNumber(raw.total_hours);
  if (directTotal > 0) {
    return directTotal;
  }

  const careerHours = toSafeNumber(raw.career_hours);
  const transferredHours = toSafeNumber(raw.transferred_hours);
  return careerHours + transferredHours;
}

function getProfileWallet(profile: PilotProfileRecord | null) {
  if (!profile) {
    return 0;
  }

  const raw = profile as PilotProfileRecord & {
    wallet_balance?: number | string | null;
  };

  return toSafeNumber(raw.wallet_balance);
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

function buildMonthLabel() {
  const raw = new Intl.DateTimeFormat("es-CL", { month: "long" }).format(new Date());
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

async function loadDashboardMetrics(profile: PilotProfileRecord) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthLabel = buildMonthLabel();
  const callsign = profile.callsign?.trim().toUpperCase();

  const [scoreRes, monthLedgerRes, allMonthLedgerRes, pirepCountRes, pilotProfilesRes] = await Promise.all([
    supabase
      .from("pw_pilot_scores")
      .select("pilot_callsign, pulso_10, ruta_10, legado_points")
      .eq("pilot_callsign", callsign)
      .maybeSingle(),
    supabase
      .from("pw_pilot_score_ledger")
      .select("pilot_callsign, flight_hours, created_at")
      .eq("pilot_callsign", callsign)
      .gte("created_at", startOfMonth),
    supabase
      .from("pw_pilot_score_ledger")
      .select("pilot_callsign, flight_hours, created_at")
      .gte("created_at", startOfMonth),
    supabase
      .from("flight_reservations")
      .select("id", { count: "exact", head: true })
      .eq("pilot_callsign", callsign)
      .eq("status", "completed"),
    supabase
      .from("pilot_profiles")
      .select("callsign, total_hours, career_hours, transferred_hours"),
  ]);

  const monthHours = (monthLedgerRes.data ?? []).reduce((acc, row) => {
    return acc + toSafeNumber((row as ScoreLedgerRow).flight_hours);
  }, 0);

  const allPilotMonthHours = new Map<string, number>();
  for (const rawRow of (allMonthLedgerRes.data ?? []) as ScoreLedgerRow[]) {
    const pilotCallsign = rawRow.pilot_callsign?.trim().toUpperCase();
    if (!pilotCallsign) {
      continue;
    }

    const current = allPilotMonthHours.get(pilotCallsign) ?? 0;
    allPilotMonthHours.set(pilotCallsign, current + toSafeNumber(rawRow.flight_hours));
  }

  const rankingRows = ((pilotProfilesRes.data ?? []) as PilotHoursRow[])
    .map((row) => {
      const pilotCallsign = row.callsign?.trim().toUpperCase();
      if (!pilotCallsign) {
        return null;
      }

      const totalHours =
        toSafeNumber(row.total_hours) ||
        toSafeNumber(row.career_hours) + toSafeNumber(row.transferred_hours);

      return {
        callsign: pilotCallsign,
        totalHours,
        monthHours: allPilotMonthHours.get(pilotCallsign) ?? 0,
      };
    })
    .filter((row): row is { callsign: string; totalHours: number; monthHours: number } => Boolean(row))
    .sort((a, b) => {
      if (b.monthHours !== a.monthHours) {
        return b.monthHours - a.monthHours;
      }

      if (b.totalHours !== a.totalHours) {
        return b.totalHours - a.totalHours;
      }

      return a.callsign.localeCompare(b.callsign);
    });

  const monthPosition = rankingRows.findIndex((row) => row.callsign === callsign);
  const totalHours = getProfileTotalHours(profile);
  const pilotStatus = profile.status?.trim().toLowerCase() === "inactive" ? "INACTIVO" : "ACTIVO";

  return {
    pilotStatus,
    monthLabel,
    monthPosition: monthPosition >= 0 ? monthPosition + 1 : rankingRows.length ? rankingRows.length + 1 : 1,
    monthHours,
    totalPireps: pirepCountRes.count ?? 0,
    totalHours,
    pulso10: toSafeNumber((scoreRes.data as ScoreRow | null)?.pulso_10),
    ruta10: toSafeNumber((scoreRes.data as ScoreRow | null)?.ruta_10),
    legadoPoints: toSafeNumber((scoreRes.data as ScoreRow | null)?.legado_points),
    walletBalance: getProfileWallet(profile),
    careerRank: formatRankLabel(profile.career_rank_code ?? profile.rank_code),
  } satisfies DashboardMetrics;
}

function AnimatedMetricValue({
  item,
  animateKey,
}: {
  item: MetricDisplayItem;
  animateKey: string;
}) {
  const isNumeric = item.type !== "text" && typeof item.value === "number";
  const [displayValue, setDisplayValue] = useState<number>(0);

  useEffect(() => {
    if (!isNumeric) {
      return;
    }

    const target = Number(item.value) || 0;
    const duration = 900;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(target * eased);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    setDisplayValue(0);
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [animateKey, isNumeric, item.type, item.value]);

  if (!isNumeric) {
    return <>{String(item.value)}</>;
  }

  if (item.type === "currency") {
    return <>{formatCurrency(displayValue)}</>;
  }

  if ((item.decimals ?? 0) > 0) {
    return <>{formatDecimal(displayValue)}</>;
  }

  return <>{formatInteger(displayValue)}</>;
}

function DashboardWorkspace({
  activeTab,
  onChangeTab,
  metrics,
}: {
  activeTab: DashboardTabKey;
  onChangeTab: (tab: DashboardTabKey) => void;
  metrics: DashboardMetrics;
}) {
  const [dispatchStep, setDispatchStep] = useState<DispatchStepKey>("aircraft");

  return (
    <section className="mt-6 glass-panel rounded-[30px] p-4 sm:p-5 lg:p-6">
      <div className="border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {DASHBOARD_TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChangeTab(tab.key)}
                className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                    : "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-5">
        {activeTab === "central" ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="surface-outline rounded-[24px] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Central operativa
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Centro de control del piloto</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
                Aquí irá el panel principal del piloto con accesos directos, estado de carrera,
                recordatorios de operación y el resumen rápido del día, sin salir del dashboard.
              </p>
            </div>

            <div className="surface-outline rounded-[24px] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Estado actual
              </p>
              <div className="mt-4 grid gap-3 text-sm text-white/76">
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span>Rango vigente</span>
                  <strong className="text-white">{metrics.careerRank}</strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span>Estado del piloto</span>
                  <strong className="text-white">{metrics.pilotStatus}</strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span>Billetera actual</span>
                  <strong className="text-white">{formatCurrency(metrics.walletBalance)}</strong>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "dispatch" ? (
          <div className="space-y-4">
            <div className="surface-outline rounded-[26px] p-4 sm:p-5 lg:p-6">
              <div className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(6,22,44,0.88),rgba(4,15,30,0.92))] p-4 sm:p-5">
                <div className="flex flex-col gap-4 border-b border-white/8 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                      Workspace Dispatch
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white sm:text-[28px]">
                      Flujo central reutilizando la lógica real del despacho
                    </h3>
                    <p className="mt-3 max-w-4xl text-sm leading-7 text-white/72 sm:text-[15px]">
                      No eliminamos nada de lo ya construido. Esta ventana pasa a ser el frente visual del flujo
                      operativo que ya veníamos usando: primero la aeronave, luego el itinerario, después el
                      despacho y al final el resumen validado para ACARS.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-400/16 bg-emerald-500/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    Flujo base preservado
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-b border-white/8 pb-4">
                  {DISPATCH_STEPS.map((step) => {
                    const isActive = step.key === dispatchStep;
                    return (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() => setDispatchStep(step.key)}
                        className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                          isActive
                            ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                            : "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                        }`}
                      >
                        {step.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 min-h-[620px] rounded-[22px] border border-cyan-400/14 bg-[radial-gradient(circle_at_top,rgba(22,168,255,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 sm:min-h-[700px] lg:min-h-[820px] lg:p-5">
                  {dispatchStep === "aircraft" ? (
                    <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                          Paso 1
                        </p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">Selección de aeronave</h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          El flujo arranca aquí. Primero tomamos una aeronave disponible en el aeropuerto actual del
                          piloto, respetando rango, permisos y estado operativo de la flota.
                        </p>

                        <div className="mt-5 space-y-3 text-sm leading-7 text-white/76">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Flota disponible en el aeropuerto actual
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Validación por rango y habilitación del piloto
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Estado de aeronave, matrícula y posición real
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Qué se conserva</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Reutilizamos la lógica que ya teníamos en operaciones para no romper reservas, lectura de
                              flota ni filtros desde Supabase.
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Objetivo visual</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Esta ventana será el contenedor del flujo completo, sin sacar al usuario del dashboard y
                              manteniendo el header principal fijo.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-[#031428]/58 p-4 text-sm leading-7 text-white/64">
                          Zona preparada para incrustar la selección real de aeronaves en el siguiente ajuste fino.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <Link href="/operations" className="button-primary py-3">
                            Abrir flujo real de aeronaves
                          </Link>
                          <button type="button" onClick={() => setDispatchStep("itinerary")} className="button-secondary py-3">
                            Continuar a itinerario
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {dispatchStep === "itinerary" ? (
                    <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                          Paso 2
                        </p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">Elegir itinerario</h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Una vez definida la aeronave, aquí se muestran solo los itinerarios que esa aeronave puede
                          volar, según la red, el rango del piloto y el reglaje operativo que ya construimos.
                        </p>

                        <div className="mt-5 space-y-3 text-sm leading-7 text-white/76">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Filtrado por compatibilidad aeronave / ruta
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Solo rutas visibles desde el aeropuerto actual
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Numeración de vuelo, banderas y block real preservados
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Qué mostrará aquí</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              El itinerario elegido, origen y destino con banderas, designador de vuelo tipo PWG### y
                              duración tomada desde la red real cuando exista en base.
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Qué no se pierde</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Se mantiene la misma lógica de reservas y compatibilidad que veníamos usando en el
                              despacho anterior. Solo cambiamos el contenedor visual.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-[#031428]/58 p-4 text-sm leading-7 text-white/64">
                          Zona preparada para incrustar la selección real de itinerarios filtrados por aeronave.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button type="button" onClick={() => setDispatchStep("aircraft")} className="button-secondary py-3">
                            Volver a aeronave
                          </button>
                          <button type="button" onClick={() => setDispatchStep("dispatch_flow")} className="button-primary py-3">
                            Continuar a despacho
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {dispatchStep === "dispatch_flow" ? (
                    <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                          Paso 3
                        </p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">Despacho</h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Aquí queda el bloque OFP / SimBrief / Navigraph que ya teníamos antes, solo que ahora vive
                          dentro de este panel. La idea es conservar la lógica real y usar este dashboard como shell.
                        </p>

                        <div className="mt-5 space-y-3 text-sm leading-7 text-white/76">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Conexión y estado de Navigraph
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Apertura y recarga de OFP / SimBrief
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Validaciones previas contra la reserva real
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Reutilización</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              El objetivo no es rehacer el despacho desde cero, sino enchufar aquí el flujo real que ya
                              estaba operativo para reserva, OFP, validación y persistencia.
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Scroll permitido</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Si este bloque crece, baja toda la página. El header de arriba se mantiene fijo y el mini
                              menú interno sigue siempre dentro de esta misma ventana.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-[#031428]/58 p-4 text-sm leading-7 text-white/64">
                          Zona preparada para incrustar el despacho real con OFP, validaciones y estado listo para ACARS.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <Link href="/operations" className="button-primary py-3">
                            Abrir despacho real actual
                          </Link>
                          <button type="button" onClick={() => setDispatchStep("summary")} className="button-secondary py-3">
                            Continuar a resumen
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {dispatchStep === "summary" ? (
                    <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                      <div className="rounded-[22px] border border-white/8 bg-[#031428]/65 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                          Paso 4
                        </p>
                        <h4 className="mt-3 text-2xl font-semibold text-white">Resumen final y envío a ACARS</h4>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Última validación del flujo. Aquí se confirma que todo coincida antes de liberar el vuelo hacia
                          ACARS: aeronave, itinerario, despacho y reglas finales de salida.
                        </p>

                        <div className="mt-5 space-y-3 text-sm leading-7 text-white/76">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Coincidencia reserva ↔ aeronave ↔ OFP
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Validación final de origen, destino y número de vuelo
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                            Estado listo para enviar a ACARS
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Qué se ve aquí</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Un resumen limpio del vuelo listo para salir, con semáforos de validación y el botón final
                              de envío cuando todo esté correcto.
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-sm font-semibold text-white">Compatibilidad futura</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Este mismo panel podrá recibir luego economía, score, tolerancias y auditoría sin romper la
                              estructura que ya dejamos armada hoy.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-[#031428]/58 p-4 text-sm leading-7 text-white/64">
                          Zona preparada para incrustar el resumen final validado y el estado listo para ACARS.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button type="button" onClick={() => setDispatchStep("dispatch_flow")} className="button-secondary py-3">
                            Volver a despacho
                          </button>
                          <Link href="/operations" className="button-primary py-3">
                            Ir al flujo operativo actual
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "office" ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="surface-outline rounded-[24px] p-5 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Oficina del piloto
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Perfil, carrera y administración</h2>
              <p className="mt-3 text-sm leading-7 text-white/72">
                Este espacio será la oficina del piloto para revisar rango, progreso, transferencias,
                billetera, historial y documentos internos, manteniendo todo dentro de la misma base visual.
              </p>
            </div>

            <div className="surface-outline rounded-[24px] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Accesos
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <Link href="/profile" className="button-secondary">
                  Abrir perfil
                </Link>
                <button type="button" className="button-ghost">
                  Historial
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "training" ? (
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="surface-outline rounded-[24px] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Entrenamiento
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Centro de práctica y preparación</h2>
              <p className="mt-3 text-sm leading-7 text-white/72">
                Aquí quedará el acceso a entrenamiento, checkrides y futuras habilitaciones,
                siempre dentro del mismo panel interno para que el dashboard se sienta como una cabina de control.
              </p>
            </div>

            <div className="surface-outline rounded-[24px] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">
                Vista inicial
              </p>
              <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-white/76">
                Más adelante esta pestaña podrá mostrar cursos, pendientes y misiones de entrenamiento
                sin salir de esta misma ventana central.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DashboardContent() {
  const session = useProtectedSession();
  const [profile, setProfile] = useState<PilotProfileRecord | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [activeTab, setActiveTab] = useState<DashboardTabKey>("central");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      const nextProfile = await ensurePilotProfile(session.user);

      if (!isMounted || !nextProfile) {
        return;
      }

      setProfile(nextProfile);

      try {
        const nextMetrics = await loadDashboardMetrics(nextProfile);
        if (isMounted) {
          setMetrics(nextMetrics);
        }
      } catch (error) {
        console.error("No se pudieron cargar las métricas del dashboard:", error);
        if (isMounted) {
          setMetrics((current) => ({
            ...current,
            pilotStatus:
              nextProfile.status?.trim().toLowerCase() === "inactive" ? "INACTIVO" : "ACTIVO",
            monthLabel: buildMonthLabel(),
            totalHours: getProfileTotalHours(nextProfile),
            walletBalance: getProfileWallet(nextProfile),
            careerRank: formatRankLabel(nextProfile.career_rank_code ?? nextProfile.rank_code),
          }));
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [session.user]);

  const pilotName = useMemo(
    () => getShortPilotName(profile, session.user.email),
    [profile, session.user.email],
  );

  const compactMetrics = useMemo<MetricDisplayItem[]>(
    () => [
      { label: "Estado", type: "text", value: metrics.pilotStatus },
      { label: "Pulso 10", type: "number", value: metrics.pulso10, decimals: 1 },
      { label: "Ruta 10", type: "number", value: metrics.ruta10, decimals: 1 },
      { label: "Rango", type: "text", value: metrics.careerRank },
      {
        label: `Posición ${metrics.monthLabel}`,
        type: "number",
        value: metrics.monthPosition ?? 0,
      },
      { label: `Hs. ${metrics.monthLabel}`, type: "number", value: metrics.monthHours, decimals: 1 },
      { label: "Pireps", type: "number", value: metrics.totalPireps },
      { label: "Horas", type: "number", value: metrics.totalHours, decimals: 1 },
      { label: "Legado", type: "number", value: metrics.legadoPoints },
      { label: "Billetera", type: "currency", value: metrics.walletBalance },
    ],
    [metrics],
  );

  const animationSeed = useMemo(
    () => JSON.stringify({
      monthPosition: metrics.monthPosition,
      monthHours: metrics.monthHours,
      totalPireps: metrics.totalPireps,
      totalHours: metrics.totalHours,
      pulso10: metrics.pulso10,
      ruta10: metrics.ruta10,
      legadoPoints: metrics.legadoPoints,
      walletBalance: metrics.walletBalance,
    }),
    [metrics],
  );

  return (
    <div className="pw-container py-10 sm:py-14 lg:py-16">
      <section className="glass-panel rounded-[30px] px-6 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Bienvenido, {pilotName}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/76 sm:text-[15px]">
              Queremos ser la mejor aerolínea virtual del sur del mundo. Ayúdanos a seguir mejorando cada vuelo.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/operations" className="button-primary py-3">
              Ir a operaciones
            </Link>
            <Link href="/profile" className="button-secondary py-3">
              Abrir perfil
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="glass-panel rounded-[30px] px-4 py-4 sm:px-5 lg:px-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10">
            {compactMetrics.map((item) => (
              <div
                key={item.label}
                className="flex min-h-[82px] flex-col items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.03] px-2 py-3 text-center"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/58">
                  {item.label}
                </span>
                <span className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">
                  <AnimatedMetricValue item={item} animateKey={animationSeed} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DashboardWorkspace activeTab={activeTab} onChangeTab={setActiveTab} metrics={metrics} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen overflow-x-hidden">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="relative z-10">
          <header className="pw-container sticky top-4 z-40 pt-5">
            <PublicHeader />
          </header>

          <ProtectedPage>
            <DashboardContent />
          </ProtectedPage>
        </div>
      </section>
    </main>
  );
}
