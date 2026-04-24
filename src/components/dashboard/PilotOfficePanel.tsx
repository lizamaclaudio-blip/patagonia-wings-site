"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import {
  AIRCRAFT_LICENSE_REQUIREMENTS,
  CAREER_RANKS,
  calculateCareerProgress,
  getCareerRankByCode,
  type AircraftLicenseStatus,
} from "@/lib/career-progression";

type PilotOfficeProfile = {
  id?: string | null;
  callsign?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  country?: string | null;
  base_hub?: string | null;
  base_hub_code?: string | null;
  current_airport_icao?: string | null;
  current_airport_code?: string | null;
  simulator?: string | null;
  simbrief_username?: string | null;
  vatsim_id?: string | null;
  ivao_id?: string | null;
  status?: string | null;
  rank_code?: string | null;
  career_rank_code?: string | null;
  total_hours?: number | null;
  career_hours?: number | null;
  active_qualifications?: string | null;
  active_certifications?: string | null;
};

type DashboardMetricsLike = {
  pilotStatus?: string;
  monthLabel?: string;
  monthPosition?: number | null;
  monthHours?: number;
  totalPireps?: number;
  totalHours?: number;
  surScore?: number;
  pulso10?: number;
  ruta10?: number;
  legadoPoints?: number;
  walletBalance?: number;
  careerRank?: string;
};

type FlightLike = {
  id?: string | null;
  route_code?: string | null;
  flight_number?: string | null;
  aircraft_type_code?: string | null;
  aircraft_registration?: string | null;
  origin_ident?: string | null;
  destination_ident?: string | null;
  status?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  procedure_score?: number | null;
  performance_score?: number | null;
  mission_score?: number | null;
  flight_mode_code?: string | null;
};

type CareerOfficeRpcResult = {
  ok?: boolean;
  error?: string;
  pilot?: Record<string, unknown>;
  metrics?: {
    total_hours?: number;
    valid_flights?: number;
    average_score?: number;
    last10_average_score?: number;
  };
  current_rank?: Record<string, unknown> | null;
  next_rank?: Record<string, unknown> | null;
  next_requirements?: Array<{
    key?: string;
    label?: string;
    current?: number;
    required?: number;
    met?: boolean;
  }>;
  aircraft_licenses?: Array<Record<string, unknown>>;
  theory_courses?: Array<Record<string, unknown>>;
  certifications?: Array<Record<string, unknown>>;
};

type OfficeTabKey =
  | "summary"
  | "career"
  | "licenses"
  | "training"
  | "theory"
  | "checkrides"
  | "certifications";

type Props = {
  profile: PilotOfficeProfile;
  metrics: DashboardMetricsLike;
  activeReservation?: FlightLike | null;
  recentFlights?: FlightLike[];
  onGoDispatch?: () => void;
};

const OFFICE_TABS: Array<{ key: OfficeTabKey; label: string }> = [
  { key: "summary", label: "Resumen" },
  { key: "career", label: "Carrera" },
  { key: "licenses", label: "Licencias" },
  { key: "training", label: "Entrenamiento" },
  { key: "theory", label: "Teorico" },
  { key: "checkrides", label: "Checkrides" },
  { key: "certifications", label: "Certificaciones" },
];

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function formatNumber(value: unknown, digits = 0) {
  const parsed = asNumber(value);
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(parsed);
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return "Pendiente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pendiente";
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusLabel(status: unknown) {
  const normalized = asString(status, "NOT_OBTAINED").toUpperCase();

  const labels: Record<string, string> = {
    LOCKED: "Bloqueada",
    NOT_OBTAINED: "No obtenida",
    TRAINING: "En entrenamiento",
    ELIGIBLE_FOR_CHECKRIDE: "Elegible",
    CHECKRIDE_REQUESTED: "Checkride solicitado",
    VALID: "Vigente",
    EXPIRED: "Vencida",
    SUSPENDED: "Suspendida",
    REJECTED: "Rechazada",
    AVAILABLE: "Disponible",
    NOT_STARTED: "No iniciado",
    IN_PROGRESS: "En curso",
    PASSED: "Aprobado",
    PENDING: "Pendiente",
  };

  return labels[normalized] ?? normalized;
}

function getStatusClasses(status: unknown) {
  const normalized = asString(status, "NOT_OBTAINED").toUpperCase();

  if (normalized === "VALID" || normalized === "PASSED") {
    return "border-emerald-400/30 bg-emerald-400/12 text-emerald-200";
  }

  if (normalized === "AVAILABLE" || normalized === "ELIGIBLE_FOR_CHECKRIDE") {
    return "border-cyan-300/30 bg-cyan-300/12 text-cyan-100";
  }

  if (normalized === "TRAINING" || normalized === "IN_PROGRESS" || normalized === "CHECKRIDE_REQUESTED" || normalized === "PENDING") {
    return "border-amber-300/30 bg-amber-300/12 text-amber-100";
  }

  if (normalized === "SUSPENDED" || normalized === "REJECTED" || normalized === "EXPIRED") {
    return "border-rose-300/30 bg-rose-400/12 text-rose-100";
  }

  return "border-white/10 bg-white/[0.055] text-white/62";
}

function StatusPill({ status }: { status: unknown }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClasses(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#0ca66b,#67d7ff)] transition-all duration-500"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

function SurfaceCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`surface-outline rounded-[24px] border border-white/8 bg-white/[0.035] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.18)] ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/48">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">{description}</p> : null}
    </div>
  );
}

function normalizeRankFromRpc(rank: Record<string, unknown> | null | undefined) {
  if (!rank) return null;

  const code = asString(rank.code ?? rank.rank_code);
  const localRank = getCareerRankByCode(code);

  return {
    code,
    name: asString(rank.name ?? rank.rank_name, localRank?.name ?? "Sin rango"),
    minHours: asNumber(rank.min_total_hours ?? rank.min_hours, localRank?.minHours ?? 0),
    minFlights: asNumber(rank.min_valid_flights, localRank?.minValidFlights ?? 0),
    minScore: asNumber(rank.min_average_score, localRank?.minAverageScore ?? 0),
    sortOrder: asNumber(rank.sort_order, localRank?.sortOrder ?? 1),
    description: asString(rank.description, localRank?.description ?? ""),
  };
}

function getDisplayName(profile: PilotOfficeProfile) {
  const explicit = profile.display_name?.trim();
  if (explicit) return explicit;

  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return fullName || profile.callsign || "Piloto Patagonia";
}

function getInitials(profile: PilotOfficeProfile) {
  const first = profile.first_name?.[0] ?? "";
  const last = profile.last_name?.[0] ?? "";
  const fromName = `${first}${last}`.trim();
  return (fromName || profile.callsign?.slice(0, 2) || "PW").toUpperCase();
}

function routeLabel(flight: FlightLike) {
  const origin = flight.origin_ident ?? "";
  const destination = flight.destination_ident ?? "";
  if (origin && destination) return `${origin} - ${destination}`;
  return flight.route_code ?? flight.flight_number ?? "Vuelo";
}

export default function PilotOfficePanel({
  profile,
  metrics,
  activeReservation,
  recentFlights = [],
  onGoDispatch,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get("officeTab") as OfficeTabKey | null) ?? "summary";
  const [activeOfficeTab, setActiveOfficeTab] = useState<OfficeTabKey>(
    OFFICE_TABS.some((tab) => tab.key === initialTab) ? initialTab : "summary",
  );
  const [careerData, setCareerData] = useState<CareerOfficeRpcResult | null>(null);
  const [loadingCareer, setLoadingCareer] = useState(true);

  const callsign = profile.callsign ?? "";
  const totalHours = asNumber(careerData?.metrics?.total_hours, asNumber(metrics.totalHours ?? profile.career_hours ?? profile.total_hours));
  const validFlights = asNumber(careerData?.metrics?.valid_flights, asNumber(metrics.totalPireps));
  const averageScore = asNumber(careerData?.metrics?.average_score, asNumber(metrics.surScore));
  const last10Score = asNumber(careerData?.metrics?.last10_average_score, averageScore);

  const localProgress = useMemo(
    () =>
      calculateCareerProgress({
        totalHours,
        validFlights,
        averageScore,
        currentRankCode: profile.career_rank_code ?? profile.rank_code ?? null,
      }),
    [averageScore, profile.career_rank_code, profile.rank_code, totalHours, validFlights],
  );

  const rpcCurrentRank = normalizeRankFromRpc(careerData?.current_rank);
  const rpcNextRank = normalizeRankFromRpc(careerData?.next_rank);
  const currentRankName = rpcCurrentRank?.name ?? localProgress.currentRank.name;
  const nextRankName = rpcNextRank?.name ?? localProgress.nextRank?.name ?? "Rango maximo";
  const nextRequirements = careerData?.next_requirements?.length
    ? careerData.next_requirements
    : localProgress.requirements.map((item) => ({
        key: item.key,
        label: item.label,
        current: item.current,
        required: item.required,
        met: item.met,
      }));

  const aircraftLicenses = careerData?.aircraft_licenses?.length
    ? careerData.aircraft_licenses
    : AIRCRAFT_LICENSE_REQUIREMENTS.map((item) => ({
        aircraft_type_code: item.aircraftTypeCode,
        display_name: item.displayName,
        family_code: item.familyCode,
        min_rank_code: item.minRankCode,
        min_rank_name: getCareerRankByCode(item.minRankCode)?.name ?? item.minRankCode,
        is_school_aircraft: item.isSchoolAircraft,
        training_hours_required: item.trainingHoursRequired,
        training_flights_required: item.trainingFlightsRequired,
        min_training_score: item.minTrainingScore,
        checkride_required: item.checkrideRequired,
        checkride_template_code: item.checkrideTemplateCode,
        status: item.minRankCode === "CADET" ? "AVAILABLE" : "LOCKED",
        training_hours: 0,
        training_flights: 0,
      }));

  const theoryCourses = careerData?.theory_courses ?? [];
  const certifications = careerData?.certifications ?? [];

  const currentTrainingLicenses = aircraftLicenses.filter((item) => {
    const status = asString(item.status).toUpperCase();
    return status === "TRAINING" || status === "ELIGIBLE_FOR_CHECKRIDE" || status === "CHECKRIDE_REQUESTED";
  });

  const validLicenses = aircraftLicenses.filter((item) => asString(item.status).toUpperCase() === "VALID");
  const availableLicenses = aircraftLicenses.filter((item) => {
    const status = asString(item.status).toUpperCase();
    return status === "AVAILABLE" || status === "NOT_OBTAINED" || status === "ELIGIBLE_FOR_CHECKRIDE";
  });

  const checkrideCandidates = aircraftLicenses.filter((item) => {
    const status = asString(item.status).toUpperCase();
    const trainingHours = asNumber(item.training_hours);
    const trainingRequired = asNumber(item.training_hours_required);
    const trainingFlights = asNumber(item.training_flights);
    const flightsRequired = asNumber(item.training_flights_required);
    const requiresCheckride = Boolean(item.checkride_required);
    return requiresCheckride && (status === "ELIGIBLE_FOR_CHECKRIDE" || (trainingHours >= trainingRequired && trainingFlights >= flightsRequired));
  });

  useEffect(() => {
    let mounted = true;

    async function loadCareerOffice() {
      if (!profile.id) {
        setCareerData(null);
        setLoadingCareer(false);
        return;
      }

      setLoadingCareer(true);

      const { data, error } = await supabase.rpc("pw_get_pilot_career_office", {
        p_pilot_id: profile.id,
      });

      if (!mounted) return;

      if (error) {
        setCareerData(null);
      } else {
        setCareerData((data ?? null) as CareerOfficeRpcResult | null);
      }

      setLoadingCareer(false);
    }

    void loadCareerOffice();

    return () => {
      mounted = false;
    };
  }, [profile.id]);

  function changeOfficeTab(tab: OfficeTabKey) {
    setActiveOfficeTab(tab);

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "office");
    params.set("officeTab", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const requirementProgress = nextRequirements.length
    ? Math.round(
        nextRequirements.reduce((sum, item) => {
          const required = asNumber(item.required);
          const current = asNumber(item.current);
          if (required <= 0) return sum + 100;
          return sum + Math.max(0, Math.min(100, Math.round((current / required) * 100)));
        }, 0) / nextRequirements.length,
      )
    : 100;

  return (
    <div className="flex flex-col gap-5">
      <SurfaceCard>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0ca66b,#67d7ff)] shadow-[0_12px_30px_rgba(12,166,107,0.22)]">
              <span className="text-xl font-bold text-white">{getInitials(profile)}</span>
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/48">Oficina del piloto</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white">{getDisplayName(profile)}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                  {callsign || "Sin callsign"}
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                  {currentRankName}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-[11px] font-semibold text-white/70">
                  {profile.current_airport_icao ?? profile.current_airport_code ?? "SCEL"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-[430px]">
            <div className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Horas</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(totalHours, 1)}</p>
            </div>
            <div className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Vuelos</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(validFlights)}</p>
            </div>
            <div className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Score</p>
              <p className="mt-2 text-2xl font-semibold text-[#67d7ff]">{formatNumber(averageScore, 1)}</p>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-white/8 bg-white/[0.035] p-2">
        {OFFICE_TABS.map((tab) => {
          const active = activeOfficeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => changeOfficeTab(tab.key)}
              className={`shrink-0 rounded-[16px] px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-[#67d7ff] text-[#04162a] shadow-[0_10px_30px_rgba(103,215,255,0.24)]"
                  : "text-white/62 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeOfficeTab === "summary" ? (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <SurfaceCard>
            <SectionTitle
              eyebrow="Proximo objetivo"
              title={localProgress.nextRank ? `Ascenso a ${nextRankName}` : "Rango maximo alcanzado"}
              description={loadingCareer ? "Actualizando datos desde Supabase..." : localProgress.nextRecommendedAction}
            />

            <div className="mt-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-white/78">Progreso general</p>
                <p className="text-sm font-bold text-[#67d7ff]">{requirementProgress}%</p>
              </div>
              <div className="mt-3">
                <ProgressBar value={requirementProgress} />
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {nextRequirements.map((item) => {
                const required = asNumber(item.required);
                const current = asNumber(item.current);
                const progress = required <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((current / required) * 100)));

                return (
                  <div key={asString(item.key, asString(item.label))} className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">{asString(item.label)}</p>
                      <StatusPill status={item.met ? "PASSED" : "PENDING"} />
                    </div>
                    <p className="mt-3 text-xl font-semibold text-white">
                      {formatNumber(current, asString(item.key) === "average_score" ? 1 : 0)} / {formatNumber(required, asString(item.key) === "average_score" ? 1 : 0)}
                    </p>
                    <div className="mt-3">
                      <ProgressBar value={progress} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <SectionTitle eyebrow="Estado operacional" title="Resumen actual" />
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-3">
                <span className="text-sm text-white/50">Rango actual</span>
                <span className="text-sm font-semibold text-white">{currentRankName}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-3">
                <span className="text-sm text-white/50">Siguiente rango</span>
                <span className="text-sm font-semibold text-[#67d7ff]">{nextRankName}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-3">
                <span className="text-sm text-white/50">Score ultimos 10</span>
                <span className="text-sm font-semibold text-white">{formatNumber(last10Score, 1)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-3">
                <span className="text-sm text-white/50">Licencias vigentes</span>
                <span className="text-sm font-semibold text-emerald-200">{validLicenses.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-white/50">Disponibles ahora</span>
                <span className="text-sm font-semibold text-cyan-100">{availableLicenses.length}</span>
              </div>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {activeOfficeTab === "career" ? (
        <SurfaceCard>
          <SectionTitle
            eyebrow="Carrera"
            title={localProgress.nextRank ? `Objetivo actual: ${nextRankName}` : "Escalafon completado"}
            description="La Oficina muestra solo el siguiente objetivo activo. Cuando se apruebe, se habilitara el proximo escalon."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Escalon actual</p>
              <p className="mt-3 text-3xl font-semibold text-white">{currentRankName}</p>
              <p className="mt-3 text-sm leading-6 text-white/55">{rpcCurrentRank?.description ?? localProgress.currentRank.description}</p>
            </div>

            <div className="rounded-[22px] border border-cyan-300/14 bg-cyan-300/[0.045] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/60">Siguiente paso</p>
              <p className="mt-3 text-3xl font-semibold text-white">{nextRankName}</p>
              <p className="mt-3 text-sm leading-6 text-white/58">{localProgress.nextRecommendedAction}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {nextRequirements.map((item) => {
              const required = asNumber(item.required);
              const current = asNumber(item.current);
              const progress = required <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((current / required) * 100)));

              return (
                <div key={asString(item.key, asString(item.label))} className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_180px_120px] md:items-center">
                    <div>
                      <p className="text-sm font-semibold text-white">{asString(item.label)}</p>
                      <div className="mt-2">
                        <ProgressBar value={progress} />
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-white/80 md:text-right">
                      {formatNumber(current, asString(item.key) === "average_score" ? 1 : 0)} / {formatNumber(required, asString(item.key) === "average_score" ? 1 : 0)}
                    </p>
                    <div className="md:text-right">
                      <StatusPill status={item.met ? "PASSED" : "PENDING"} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      ) : null}

      {activeOfficeTab === "licenses" ? (
        <SurfaceCard>
          <SectionTitle
            eyebrow="Licencias"
            title="Habilitaciones por aeronave"
            description="Cada aeronave puede exigir rango minimo, horas de entrenamiento, vuelos de entrenamiento y checkride."
          />

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">
                  <th className="pb-3">Avion</th>
                  <th className="pb-3">Familia</th>
                  <th className="pb-3">Rango minimo</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3 text-right">Horas</th>
                  <th className="pb-3 text-right">Vuelos</th>
                  <th className="pb-3">Checkride</th>
                  <th className="pb-3">Otorgada</th>
                </tr>
              </thead>
              <tbody>
                {aircraftLicenses.map((item) => (
                  <tr key={asString(item.aircraft_type_code)} className="border-b border-white/6 last:border-0">
                    <td className="py-3">
                      <p className="font-semibold text-white">{asString(item.display_name, asString(item.aircraft_type_code))}</p>
                      <p className="text-xs text-white/38">{asString(item.aircraft_type_code)}</p>
                    </td>
                    <td className="py-3 text-white/62">{asString(item.family_code)}</td>
                    <td className="py-3 text-white/62">{asString(item.min_rank_name, asString(item.min_rank_code))}</td>
                    <td className="py-3"><StatusPill status={item.status as AircraftLicenseStatus} /></td>
                    <td className="py-3 text-right text-white/70">
                      {formatNumber(item.training_hours, 1)} / {formatNumber(item.training_hours_required, 1)}
                    </td>
                    <td className="py-3 text-right text-white/70">
                      {formatNumber(item.training_flights)} / {formatNumber(item.training_flights_required)}
                    </td>
                    <td className="py-3 text-white/62">{item.checkride_required ? asString(item.checkride_template_code, "Requerido") : "No inicial"}</td>
                    <td className="py-3 text-white/45">{formatDate(item.granted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      ) : null}

      {activeOfficeTab === "training" ? (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <SurfaceCard>
            <SectionTitle
              eyebrow="Entrenamiento"
              title="Aeronaves en progreso"
              description="Aqui se consolidaran las horas de entrenamiento por aeronave y la elegibilidad para checkride."
            />
            <div className="mt-5 space-y-3">
              {currentTrainingLicenses.length > 0 ? (
                currentTrainingLicenses.map((item) => (
                  <div key={asString(item.aircraft_type_code)} className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{asString(item.display_name)}</p>
                        <p className="mt-1 text-xs text-white/42">{asString(item.aircraft_type_code)} - {asString(item.family_code)}</p>
                      </div>
                      <StatusPill status={item.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Horas</p>
                        <p className="mt-1 text-sm font-semibold text-white">{formatNumber(item.training_hours, 1)} / {formatNumber(item.training_hours_required, 1)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Vuelos</p>
                        <p className="mt-1 text-sm font-semibold text-white">{formatNumber(item.training_flights)} / {formatNumber(item.training_flights_required)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4 text-sm text-white/55">
                  No hay entrenamientos activos registrados. Selecciona una aeronave disponible y reserva un vuelo de entrenamiento.
                </p>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <SectionTitle eyebrow="Reserva" title="Entrenar ahora" />
            <p className="mt-3 text-sm leading-6 text-white/58">
              Usa el despacho en modo entrenamiento para comenzar a sumar horas por aeronave. Luego se habilitara el checkride correspondiente.
            </p>
            {activeReservation ? (
              <div className="mt-5 rounded-[18px] border border-cyan-300/16 bg-cyan-300/[0.045] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/55">Reserva activa</p>
                <p className="mt-2 text-lg font-semibold text-white">{routeLabel(activeReservation)}</p>
                <p className="mt-1 text-sm text-white/55">{activeReservation.aircraft_type_code ?? "Aeronave pendiente"} {activeReservation.aircraft_registration ? `- ${activeReservation.aircraft_registration}` : ""}</p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onGoDispatch}
              className="mt-5 rounded-[14px] bg-[#67d7ff] px-5 py-3 text-sm font-bold text-[#04162a] transition hover:bg-[#8be2ff]"
            >
              Ir a Despacho
            </button>
          </SurfaceCard>
        </div>
      ) : null}

      {activeOfficeTab === "theory" ? (
        <SurfaceCard>
          <SectionTitle
            eyebrow="Teorico"
            title="Cursos y examenes"
            description="Los cursos se desbloquean segun tu rango y preparan ascensos, licencias y certificaciones."
          />
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {theoryCourses.length > 0 ? (
              theoryCourses.map((course) => (
                <div key={asString(course.code)} className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{asString(course.title, asString(course.code))}</p>
                      <p className="mt-1 text-xs text-white/42">Aprobacion minima: {formatNumber(course.passing_score)}%</p>
                    </div>
                    <StatusPill status={course.status} />
                  </div>
                  <p className="mt-3 text-sm text-white/50">
                    Requerido para: {asString(course.required_for_rank_code, "Progresion")}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/55">No hay cursos teoricos cargados o disponibles para este piloto.</p>
            )}
          </div>
        </SurfaceCard>
      ) : null}

      {activeOfficeTab === "checkrides" ? (
        <SurfaceCard>
          <SectionTitle
            eyebrow="Checkrides"
            title="Vuelos de evaluacion"
            description="Cuando completes el entrenamiento requerido, podras solicitar el checkride de la aeronave o ascenso."
          />
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {checkrideCandidates.length > 0 ? (
              checkrideCandidates.map((item) => (
                <div key={asString(item.aircraft_type_code)} className="rounded-[18px] border border-cyan-300/16 bg-cyan-300/[0.045] p-4">
                  <p className="font-semibold text-white">{asString(item.display_name)}</p>
                  <p className="mt-1 text-sm text-white/55">{asString(item.checkride_template_code, "Checkride requerido")}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <StatusPill status={item.status} />
                    <button type="button" className="rounded-[12px] border border-white/12 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-white/70">
                      Solicitud pendiente
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4 text-sm text-white/55">
                Todavia no hay checkrides elegibles. Completa las horas y vuelos de entrenamiento requeridos.
              </p>
            )}
          </div>
        </SurfaceCard>
      ) : null}

      {activeOfficeTab === "certifications" ? (
        <SurfaceCard>
          <SectionTitle
            eyebrow="Certificaciones"
            title="Habilitaciones operacionales"
            description="IFR, IMC, CAT, viento cruzado, Long Haul, ETOPS e Instructor se administraran desde esta seccion."
          />
          <div className="mt-6 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {certifications.length > 0 ? (
              certifications.map((cert) => (
                <div key={asString(cert.code)} className="rounded-[18px] border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{asString(cert.title, asString(cert.code))}</p>
                      <p className="mt-1 text-xs text-white/42">Desde {asString(cert.min_rank_code)}</p>
                    </div>
                    <StatusPill status={cert.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Horas</p>
                      <p className="mt-1 font-semibold text-white">{formatNumber(cert.min_hours, 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Score</p>
                      <p className="mt-1 font-semibold text-white">{formatNumber(cert.min_average_score, 1)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/55">No hay certificaciones cargadas o disponibles.</p>
            )}
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <SectionTitle eyebrow="Historial reciente" title="Ultimos vuelos del piloto" />
        {recentFlights.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">
                  <th className="pb-3">Ruta</th>
                  <th className="pb-3">Aeronave</th>
                  <th className="pb-3">Modo</th>
                  <th className="pb-3 text-right">Score</th>
                  <th className="pb-3 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentFlights.slice(0, 8).map((flight, index) => (
                  <tr key={flight.id ?? `${routeLabel(flight)}-${index}`} className="border-b border-white/6 last:border-0">
                    <td className="py-3 font-medium text-white">
                      {flight.id ? (
                        <Link href={`/flights/${flight.id}`} className="transition hover:text-[#67d7ff]">
                          {routeLabel(flight)}
                        </Link>
                      ) : (
                        routeLabel(flight)
                      )}
                    </td>
                    <td className="py-3 text-white/65">{flight.aircraft_type_code ?? "Pendiente"}</td>
                    <td className="py-3 text-white/45">{flight.flight_mode_code ?? flight.status ?? "Vuelo"}</td>
                    <td className="py-3 text-right font-semibold text-[#67d7ff]">
                      {flight.procedure_score != null
                        ? formatNumber(flight.procedure_score, 1)
                        : flight.performance_score != null
                          ? formatNumber(flight.performance_score, 1)
                          : flight.mission_score != null
                            ? formatNumber(flight.mission_score, 1)
                            : "-"}
                    </td>
                    <td className="py-3 text-right text-white/38">{formatDate(flight.completed_at ?? flight.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/48">Sin vuelos recientes registrados.</p>
        )}
      </SurfaceCard>
    </div>
  );
}
