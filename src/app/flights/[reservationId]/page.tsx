"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PublicHeader from "@/components/site/PublicHeader";
import { OptionalAuthPage, useOptionalSession } from "@/components/site/ProtectedPage";
import { ensurePilotProfile } from "@/lib/pilot-profile";
import { supabase } from "@/lib/supabase/browser";
import { resolvePatagoniaScore } from "@/lib/sur-score";

type FlightReservationResultRow = {
  id: string;
  pilot_callsign?: string | null;
  route_code?: string | null;
  reservation_code?: string | null;
  origin_ident?: string | null;
  destination_ident?: string | null;
  aircraft_type_code?: string | null;
  aircraft_registration?: string | null;
  aircraft_variant_code?: string | null;
  addon_provider?: string | null;
  status?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
  actual_block_minutes?: number | null;
  procedure_score?: number | null;
  performance_score?: number | null;
  procedure_grade?: string | null;
  performance_grade?: string | null;
  mission_score?: number | null;
  score_payload?: Record<string, unknown> | null;
  commission_usd?: number | null;
  damage_deduction_usd?: number | null;
  airline_revenue_usd?: number | null;
  fuel_cost_usd?: number | null;
  maintenance_cost_usd?: number | null;
  distance_nm?: number | null;
  net_profit_usd?: number | null;
};

type FlightEconomySnapshotRow = {
  economy_source?: string | null;
  fuel_kg_estimated?: number | null;
  fuel_kg_actual?: number | null;
  block_minutes_estimated?: number | null;
  block_minutes_actual?: number | null;
  passenger_revenue_usd?: number | null;
  cargo_revenue_usd?: number | null;
  onboard_service_revenue_usd?: number | null;
  onboard_sales_revenue_usd?: number | null;
  fuel_cost_usd?: number | null;
  maintenance_cost_usd?: number | null;
  airport_fees_usd?: number | null;
  handling_cost_usd?: number | null;
  total_cost_usd?: number | null;
  net_profit_usd?: number | null;
  pilot_payment_usd?: number | null;
  repair_cost_usd?: number | null;
  metadata?: Record<string, unknown> | null;
};

type FlightScoreReportRow = {
  reservation_id?: string | null;
  procedure_score?: number | null;
  performance_score?: number | null;
  procedure_grade?: string | null;
  performance_grade?: string | null;
  notes?: string | null;
  score_payload?: Record<string, unknown> | null;
  scored_at?: string | null;
};

type AppealCategory = "score" | "damage" | "dispatch" | "system" | "other";

type FlightAppeal = {
  status: string;
  category: AppealCategory;
  reason: string;
  comment: string;
  created_at: string;
  deadline_at: string;
  reservation_id: string;
  report_id: string | null;
  pilot_callsign: string;
  flight_number: string;
  aircraft: string;
  aircraft_registration: string;
  aircraft_variant_code: string;
  addon_provider: string;
  flight_status: string;
  score_payload: Record<string, unknown>;
  resolved_at?: string;
  resolved_by?: string;
};

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatDetailValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-CL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(value?: number | null) {
  const total = asNumber(value);
  if (total <= 0) return "—";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatStatus(value?: string | null) {
  const normalized = asText(value).toLowerCase();
  const labels: Record<string, string> = {
    completed: "Completado",
    cancelled: "Cancelado",
    interrupted: "Interrumpido",
    crashed: "Accidentado",
    aborted: "Abortado",
    in_progress: "En vuelo",
    in_flight: "En vuelo",
    dispatch_ready: "Despachado",
    dispatched: "Despachado",
    reserved: "Reservado",
  };
  return labels[normalized] ?? (normalized ? normalized.toUpperCase() : "—");
}

function statusTone(value?: string | null) {
  const normalized = asText(value).toLowerCase();
  if (normalized === "completed") return "text-emerald-300 border-emerald-400/20 bg-emerald-400/10";
  if (normalized === "crashed") return "text-rose-300 border-rose-400/20 bg-rose-400/10";
  if (normalized === "cancelled" || normalized === "interrupted") {
    return "text-amber-300 border-amber-400/20 bg-amber-400/10";
  }
  if (normalized === "aborted") return "text-amber-300 border-amber-400/20 bg-amber-400/10";
  if (normalized === "in_progress" || normalized === "in_flight") {
    return "text-cyan-200 border-cyan-400/20 bg-cyan-400/10";
  }
  return "text-white/78 border-white/12 bg-white/5";
}

function FlightResultContent() {
  const session = useOptionalSession();
  const params = useParams<{ reservationId: string }>();
  const reservationId = Array.isArray(params?.reservationId)
    ? params.reservationId[0]
    : params?.reservationId ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [reservation, setReservation] = useState<FlightReservationResultRow | null>(null);
  const [scoreReport, setScoreReport] = useState<FlightScoreReportRow | null>(null);
  const [plannedSnapshot, setPlannedSnapshot] = useState<FlightEconomySnapshotRow | null>(null);
  const [actualSnapshot, setActualSnapshot] = useState<FlightEconomySnapshotRow | null>(null);
  const [hasLedgerEntry, setHasLedgerEntry] = useState(false);
  const [hasSalaryEntry, setHasSalaryEntry] = useState(false);
  const [pilotCallsign, setPilotCallsign] = useState("");
  const [appealCategory, setAppealCategory] = useState<AppealCategory>("score");
  const [appealReason, setAppealReason] = useState("");
  const [appealComment, setAppealComment] = useState("");

  useEffect(() => {
    // session === undefined means still resolving — wait
    if (session === undefined) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      // If authenticated, resolve callsign for ownership check
      if (session) {
        const profile = await ensurePilotProfile(session.user);
        const nextCallsign = asText(profile?.callsign).toUpperCase();
        setPilotCallsign(nextCallsign);
      }

      if (!reservationId) {
        if (!cancelled) {
          setError("No se pudo validar el vuelo solicitado.");
          setLoading(false);
        }
        return;
      }

      const [reservationRes, scoreRes] = await Promise.all([
        supabase
          .from("flight_reservations")
          .select(
            "id, pilot_callsign, route_code, reservation_code, origin_ident, destination_ident, aircraft_type_code, aircraft_registration, addon_provider, status, created_at, completed_at, updated_at, actual_block_minutes, procedure_score, performance_score, procedure_grade, performance_grade, mission_score, score_payload, commission_usd, damage_deduction_usd, airline_revenue_usd, fuel_cost_usd, maintenance_cost_usd, distance_nm"
          )
          .eq("id", reservationId)
          .maybeSingle(),
        supabase
          .from("pw_flight_score_reports")
          .select(
            "reservation_id, procedure_score, performance_score, procedure_grade, performance_grade, notes, score_payload, scored_at"
          )
          .eq("reservation_id", reservationId)
          .order("scored_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (reservationRes.error || !reservationRes.data) {
        setError(reservationRes.error?.message ?? "No se encontró el resultado del vuelo.");
        setLoading(false);
        return;
      }

      setReservation(reservationRes.data as FlightReservationResultRow);
      setScoreReport((scoreRes.data ?? null) as FlightScoreReportRow | null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reservationId, session]);

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;
    async function loadEconomyRows() {
      const [economyRes, ledgerRes, salaryRes] = await Promise.all([
        supabase
          .from("flight_economy_snapshots")
          .select("economy_source,fuel_kg_estimated,fuel_kg_actual,block_minutes_estimated,block_minutes_actual,passenger_revenue_usd,cargo_revenue_usd,onboard_service_revenue_usd,onboard_sales_revenue_usd,fuel_cost_usd,maintenance_cost_usd,airport_fees_usd,handling_cost_usd,total_cost_usd,net_profit_usd,pilot_payment_usd,repair_cost_usd,metadata")
          .eq("reservation_id", reservationId)
          .in("economy_source", ["simbrief", "estimate", "actual"])
          .order("created_at", { ascending: false }),
        supabase.from("airline_ledger").select("id", { count: "exact", head: true }).eq("reservation_id", reservationId),
        supabase.from("pilot_salary_ledger").select("id", { count: "exact", head: true }).eq("reservation_id", reservationId),
      ]);
      if (cancelled) return;
      const rows = (economyRes.data ?? []) as FlightEconomySnapshotRow[];
      const actual = rows.find((row) => asText(row.economy_source).toLowerCase() === "actual") ?? null;
      const planned = rows.find((row) => {
        const source = asText(row.economy_source).toLowerCase();
        return source === "simbrief" || source === "estimate";
      }) ?? null;
      setActualSnapshot(actual);
      setPlannedSnapshot(planned);
      setHasLedgerEntry((ledgerRes.count ?? 0) > 0);
      setHasSalaryEntry((salaryRes.count ?? 0) > 0);
    }
    void loadEconomyRows();
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  const mergedScorePayload = useMemo(() => {
    const reservationPayload = asObject(reservation?.score_payload);
    const reportPayload = asObject(scoreReport?.score_payload);
    return {
      ...reservationPayload,
      ...reportPayload,
    };
  }, [reservation?.score_payload, scoreReport?.score_payload]);

  const currentAppeal = useMemo(
    () => asObject(mergedScorePayload.flight_appeal) as Partial<FlightAppeal>,
    [mergedScorePayload]
  );
  const isAdminReviewer = pilotCallsign === "PWG001";
  const isOwner =
    pilotCallsign.length > 0 &&
    asText(reservation?.pilot_callsign).toUpperCase() === pilotCallsign;
  const canSeeAppeal = isOwner || isAdminReviewer;

  const damageSummary = useMemo(
    () => asObject(mergedScorePayload.damage_summary),
    [mergedScorePayload]
  );

  const damageEvents = Array.isArray(damageSummary.events)
    ? (damageSummary.events as Array<Record<string, unknown>>)
    : [];

  const penalties = Array.isArray(mergedScorePayload.penalties_json)
    ? (mergedScorePayload.penalties_json as Array<Record<string, unknown>>)
    : [];
  const officialEvents = Array.isArray(mergedScorePayload.events_json)
    ? (mergedScorePayload.events_json as Array<Record<string, unknown>>)
    : [];
  const rawPirepFileName = asText(mergedScorePayload.raw_pirep_file_name);
  const scoringStatus = asText(mergedScorePayload.scoring_status) || asText(asObject(mergedScorePayload.official_closeout).scoring_status);

  const flightNumber =
    asText(reservation?.reservation_code) ||
    asText(reservation?.route_code) ||
    reservationId;

  const surScore = resolvePatagoniaScore({
    scorePayload: mergedScorePayload,
    procedureScore: scoreReport?.procedure_score ?? reservation?.procedure_score,
    performanceScore: scoreReport?.performance_score ?? reservation?.performance_score,
    missionScore: reservation?.mission_score,
  });

  const fuelStartKg = asNumber(mergedScorePayload.fuel_start_kg);
  const fuelEndKg = asNumber(mergedScorePayload.fuel_end_kg);
  const fuelUsedKg = asNumber(mergedScorePayload.fuel_used_kg);
  const landingVs = asNumber(mergedScorePayload.landing_vs_fpm);
  const observations =
    asText(scoreReport?.notes) ||
    asText(mergedScorePayload.procedural_summary) ||
    asText(mergedScorePayload.summary);
  const actualMeta = asObject(actualSnapshot?.metadata);
  const plannedRevenue = asNumber(plannedSnapshot?.passenger_revenue_usd) + asNumber(plannedSnapshot?.cargo_revenue_usd) + asNumber(plannedSnapshot?.onboard_service_revenue_usd) + asNumber(plannedSnapshot?.onboard_sales_revenue_usd);
  const actualRevenue = asNumber(actualSnapshot?.passenger_revenue_usd) + asNumber(actualSnapshot?.cargo_revenue_usd) + asNumber(actualSnapshot?.onboard_service_revenue_usd) + asNumber(actualSnapshot?.onboard_sales_revenue_usd);

  async function handleAppealSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reservation) return;

    setSaving(true);
    setSaveMessage("");
    setError("");

    const createdAt = new Date().toISOString();
    const deadlineAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const nextAppeal: FlightAppeal = {
      status: "pending",
      category: appealCategory,
      reason: appealReason.trim(),
      comment: appealComment.trim(),
      created_at: createdAt,
      deadline_at: deadlineAt,
      reservation_id: reservation.id,
      report_id: reservation.id,
      pilot_callsign: asText(reservation.pilot_callsign),
      flight_number: flightNumber,
      aircraft: asText(reservation.aircraft_type_code),
      aircraft_registration: asText(reservation.aircraft_registration),
      aircraft_variant_code: asText(reservation.aircraft_variant_code),
      addon_provider: asText(reservation.addon_provider),
      flight_status: asText(reservation.status),
      score_payload: mergedScorePayload,
    };

    const nextPayload = {
      ...mergedScorePayload,
      flight_appeal: nextAppeal,
    };

    const { error: updateError, data } = await supabase
      .from("flight_reservations")
      .update({
        score_payload: nextPayload,
        updated_at: createdAt,
      })
      .eq("id", reservation.id)
      .select(
        "id, pilot_callsign, route_code, reservation_code, origin_ident, destination_ident, aircraft_type_code, aircraft_registration, addon_provider, status, created_at, completed_at, updated_at, actual_block_minutes, procedure_score, performance_score, procedure_grade, performance_grade, mission_score, score_payload"
      )
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setReservation((data ?? reservation) as FlightReservationResultRow);
    setSaveMessage("Apelación guardada. Queda pendiente por 48 horas.");
    setSaving(false);
  }
  async function handleAppealDecision(nextStatus: "resolved" | "rejected") {
    if (!reservation || !isAdminReviewer || currentAppeal.status !== "pending") return;

    setSaving(true);
    setSaveMessage("");
    setError("");

    const resolvedAt = new Date().toISOString();
    const nextAppeal = {
      ...currentAppeal,
      status: nextStatus,
      resolved_at: resolvedAt,
      resolved_by: pilotCallsign,
    };

    const nextPayload = {
      ...mergedScorePayload,
      flight_appeal: nextAppeal,
    };

    const { error: updateError, data } = await supabase
      .from("flight_reservations")
      .update({
        score_payload: nextPayload,
        updated_at: resolvedAt,
      })
      .eq("id", reservation.id)
      .select(
        "id, pilot_callsign, route_code, reservation_code, origin_ident, destination_ident, aircraft_type_code, aircraft_registration, addon_provider, status, created_at, completed_at, updated_at, actual_block_minutes, procedure_score, performance_score, procedure_grade, performance_grade, mission_score, score_payload"
      )
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setReservation((data ?? reservation) as FlightReservationResultRow);
    setSaveMessage(nextStatus === "resolved" ? "Apelacion resuelta." : "Apelacion rechazada.");
    setSaving(false);
  }

  return (
    <div className="pw-container py-12 sm:py-16 lg:py-20">
      <section className="glass-panel rounded-[34px] p-7 sm:p-9">
        <span className="parallax-chip mb-6">RESULTADO DE VUELO</span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
              {flightNumber}
            </h1>
            <p className="mt-4 text-base leading-8 text-white/78">
              {reservation ? `${asText(reservation.origin_ident) || "---"} → ${asText(reservation.destination_ident) || "---"}` : "Cargando resultado..."}
            </p>
          </div>
          <div className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${statusTone(reservation?.status)}`}>
            {formatStatus(reservation?.status)}
          </div>
        </div>
      </section>

      {loading ? (
        <section className="mt-6 glass-panel rounded-[30px] p-7 text-white/70">Cargando resultado...</section>
      ) : error ? (
        <section className="mt-6 glass-panel rounded-[30px] p-7 text-rose-300">{error}</section>
      ) : reservation ? (
        <div className="mt-6 grid gap-6">
          <section className="glass-panel rounded-[30px] p-7">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Avión", value: asText(reservation.aircraft_type_code) || "—" },
                { label: "Matrícula", value: asText(reservation.aircraft_registration) || "—" },
                { label: "Variante", value: asText(reservation.aircraft_variant_code) || "—" },
                { label: "Addon", value: asText(reservation.addon_provider) || "—" },
                { label: "Inicio", value: formatDateTime(reservation.created_at) },
                { label: "Cierre", value: formatDateTime(reservation.completed_at ?? reservation.updated_at) },
                { label: "Block real", value: formatMinutes(reservation.actual_block_minutes) },
                { label: "Landing V/S", value: landingVs ? `${Math.round(landingVs)} fpm` : "—" },
                { label: "Patagonia Score", value: surScore ? String(Math.round(surScore)) : "—" },
                { label: "Comb. inicial", value: fuelStartKg ? `${Math.round(fuelStartKg)} kg` : "—" },
                { label: "Comb. final / usado", value: fuelEndKg || fuelUsedKg ? `${Math.round(fuelEndKg)} kg / ${Math.round(fuelUsedKg)} kg` : "—" },
              ].map((item) => (
                <div key={item.label} className="surface-outline rounded-[22px] px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">{item.label}</p>
                  <p className="mt-2 text-base font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="glass-panel rounded-[30px] p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Observaciones del reglaje</p>
              <p className="mt-4 text-sm leading-7 text-white/80">
                {observations || "Sin observaciones adicionales en este cierre."}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="surface-outline rounded-[22px] px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Calificación SUR</p>
                  <p className="mt-2 text-base font-semibold text-white">{asText(scoreReport?.procedure_grade) || asText(reservation.procedure_grade) || "—"}</p>
                </div>
                <div className="surface-outline rounded-[22px] px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Calificación técnica</p>
                  <p className="mt-2 text-base font-semibold text-white">{asText(scoreReport?.performance_grade) || asText(reservation.performance_grade) || "—"}</p>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[30px] p-7">
            <div className="glass-panel rounded-[30px] p-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Evaluación oficial servidor</p>
                  <p className="mt-2 text-sm text-white/70">
                    ACARS registró el PIREP RAW; Supabase/Web calculó este resultado contra el reglaje vigente.
                  </p>
                </div>
                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
                  {scoringStatus || "scored"}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="surface-outline rounded-[22px] px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">PIREP XML</p>
                  <p className="mt-2 truncate text-sm font-semibold text-white">{rawPirepFileName || "Guardado en score_payload"}</p>
                </div>
                <div className="surface-outline rounded-[22px] px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Penalizaciones</p>
                  <p className="mt-2 text-base font-semibold text-white">{penalties.length}</p>
                </div>
                <div className="surface-outline rounded-[22px] px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Eventos</p>
                  <p className="mt-2 text-base font-semibold text-white">{officialEvents.length}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-rose-400/15 bg-rose-400/5 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/80">Detalle penalizaciones</p>
                  <div className="mt-4 space-y-3">
                    {penalties.length ? penalties.slice(0, 10).map((item, index) => (
                      <div key={`${asText(item.code)}-${index}`} className="rounded-[18px] border border-white/10 bg-black/15 px-4 py-3">
                        <p className="text-sm font-semibold text-white">{asText(item.code) || "PENALTY"}</p>
                        <p className="mt-1 text-xs text-white/54">{asText(item.stage)} · {asText(item.severity)}</p>
                        <p className="mt-2 text-sm text-white/78">{asText(item.detail)}</p>
                      </div>
                    )) : <p className="text-sm text-white/64">Sin penalizaciones registradas.</p>}
                  </div>
                </div>

                <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/5 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Timeline servidor</p>
                  <div className="mt-4 space-y-3">
                    {officialEvents.length ? officialEvents.slice(0, 10).map((item, index) => (
                      <div key={`${asText(item.code)}-${index}`} className="rounded-[18px] border border-white/10 bg-black/15 px-4 py-3">
                        <p className="text-sm font-semibold text-white">{asText(item.code) || "EVENT"}</p>
                        <p className="mt-1 text-xs text-white/54">{asText(item.stage)} · {asText(item.severity)}</p>
                        <p className="mt-2 text-sm text-white/78">{asText(item.detail)}</p>
                      </div>
                    )) : <p className="text-sm text-white/64">Sin eventos oficiales registrados.</p>}
                  </div>
                </div>
              </div>
            </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Daño aplicado</p>
              {damageEvents.length ? (
                <div className="mt-4 space-y-3">
                  {damageEvents.slice(0, 6).map((eventItem, index) => (
                    <div key={`${asText(eventItem.event_code)}-${index}`} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
                      <p className="text-sm font-semibold text-white">{asText(eventItem.event_code) || "DAMAGE_EVENT"}</p>
                      <p className="mt-1 text-xs text-white/54">{asText(eventItem.phase) || asText(eventItem.severity) || "Sin fase"}</p>
                      <p className="mt-2 text-sm text-white/78">{formatDetailValue(eventItem.details) || "Evento registrado por ACARS."}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/70">Sin eventos de daño informados en este cierre.</p>
              )}
            </div>
          </section>

          {/* Economy section — only shown for completed flights with data */}
          {(reservation.commission_usd != null || asNumber(mergedScorePayload.fuel_used_kg) > 0) ? (
          <section className="glass-panel rounded-[30px] p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Economia del vuelo</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Pago piloto",
                  value: reservation.commission_usd != null ? `+$${asNumber(reservation.commission_usd).toFixed(2)}` : (mergedScorePayload.commission_usd != null ? `+$${asNumber(mergedScorePayload.commission_usd).toFixed(2)}` : "—"),
                  tone: "text-emerald-300",
                },
                {
                  label: "Descuento daño",
                  value: reservation.damage_deduction_usd != null && asNumber(reservation.damage_deduction_usd) > 0
                    ? `-$${asNumber(reservation.damage_deduction_usd).toFixed(2)}`
                    : "Sin descuento",
                  tone: asNumber(reservation.damage_deduction_usd) > 0 ? "text-rose-300" : "text-white/60",
                },
                {
                  label: "Combustible usado",
                  value: asNumber(mergedScorePayload.fuel_used_kg) > 0
                    ? `${Math.round(asNumber(mergedScorePayload.fuel_used_kg))} kg`
                    : (reservation.fuel_cost_usd != null ? `$${asNumber(reservation.fuel_cost_usd).toFixed(0)} costo` : "—"),
                  tone: "text-white",
                },
                {
                  label: "Distancia ruta",
                  value: reservation.distance_nm != null && asNumber(reservation.distance_nm) > 0
                    ? `${Math.round(asNumber(reservation.distance_nm))} NM`
                    : "—",
                  tone: "text-white",
                },
                {
                  label: "Costo combustible",
                  value: reservation.fuel_cost_usd != null ? `-$${asNumber(reservation.fuel_cost_usd).toFixed(2)}` : "—",
                  tone: "text-amber-200",
                },
                {
                  label: "Mantenimiento",
                  value: reservation.maintenance_cost_usd != null ? `-$${asNumber(reservation.maintenance_cost_usd).toFixed(2)}` : "—",
                  tone: "text-amber-200",
                },
                {
                  label: "Ingreso aerolinea",
                  value: reservation.airline_revenue_usd != null ? `$${asNumber(reservation.airline_revenue_usd).toFixed(2)}` : "—",
                  tone: "text-sky-200",
                },
                {
                  label: "Neto aerolinea",
                  value: (reservation.airline_revenue_usd != null && reservation.fuel_cost_usd != null && reservation.maintenance_cost_usd != null)
                    ? (() => {
                        const net = asNumber(reservation.airline_revenue_usd) - asNumber(reservation.fuel_cost_usd) - asNumber(reservation.maintenance_cost_usd) - asNumber(reservation.commission_usd);
                        return `${net >= 0 ? "+" : ""}$${net.toFixed(2)}`;
                      })()
                    : "—",
                  tone: (() => {
                    if (reservation.airline_revenue_usd == null) return "text-white/60";
                    const net = asNumber(reservation.airline_revenue_usd) - asNumber(reservation.fuel_cost_usd) - asNumber(reservation.maintenance_cost_usd) - asNumber(reservation.commission_usd);
                    return net >= 0 ? "text-emerald-300" : "text-rose-300";
                  })(),
                },
              ].map((item) => (
                <div key={item.label} className="surface-outline rounded-[22px] px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">{item.label}</p>
                  <p className={`mt-2 text-base font-semibold ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          <section className="glass-panel rounded-[30px] p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Planificado vs real</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Fuel (kg)", value: `${Math.round(asNumber(plannedSnapshot?.fuel_kg_estimated)) || 0} / ${Math.round(asNumber(actualSnapshot?.fuel_kg_actual)) || 0}` },
                { label: "Block", value: `${formatMinutes(asNumber(plannedSnapshot?.block_minutes_estimated))} / ${formatMinutes(asNumber(actualSnapshot?.block_minutes_actual) || reservation?.actual_block_minutes)}` },
                { label: "Ingresos USD", value: `${plannedRevenue ? `$${plannedRevenue.toFixed(0)}` : "Sin datos recibidos"} / ${actualRevenue ? `$${actualRevenue.toFixed(0)}` : "Sin datos recibidos"}` },
                { label: "Costos USD", value: `${asNumber(plannedSnapshot?.total_cost_usd) ? `$${asNumber(plannedSnapshot?.total_cost_usd).toFixed(0)}` : "Sin datos recibidos"} / ${asNumber(actualSnapshot?.total_cost_usd) ? `$${asNumber(actualSnapshot?.total_cost_usd).toFixed(0)}` : "Sin datos recibidos"}` },
                { label: "Utilidad USD", value: `${asNumber(plannedSnapshot?.net_profit_usd) ? `$${asNumber(plannedSnapshot?.net_profit_usd).toFixed(0)}` : "Sin datos recibidos"} / ${asNumber(actualSnapshot?.net_profit_usd) ? `$${asNumber(actualSnapshot?.net_profit_usd).toFixed(0)}` : "Sin datos recibidos"}` },
                { label: "Comisión USD", value: `${asNumber(plannedSnapshot?.pilot_payment_usd) ? `$${asNumber(plannedSnapshot?.pilot_payment_usd).toFixed(0)}` : "Sin datos recibidos"} / ${asNumber(actualSnapshot?.pilot_payment_usd || reservation?.commission_usd) ? `$${asNumber(actualSnapshot?.pilot_payment_usd || reservation?.commission_usd).toFixed(0)}` : "Sin datos recibidos"}` },
                { label: "Ventas a bordo", value: `${asNumber(plannedSnapshot?.onboard_sales_revenue_usd) ? `$${asNumber(plannedSnapshot?.onboard_sales_revenue_usd).toFixed(0)}` : "Sin datos recibidos"} / ${asNumber(actualSnapshot?.onboard_sales_revenue_usd) ? `$${asNumber(actualSnapshot?.onboard_sales_revenue_usd).toFixed(0)}` : "Sin datos recibidos"}` },
                { label: "Servicio a bordo", value: `${asNumber(plannedSnapshot?.onboard_service_revenue_usd) ? `$${asNumber(plannedSnapshot?.onboard_service_revenue_usd).toFixed(0)}` : "Sin datos recibidos"} / ${asNumber(actualSnapshot?.onboard_service_revenue_usd) ? `$${asNumber(actualSnapshot?.onboard_service_revenue_usd).toFixed(0)}` : "Sin datos recibidos"}` },
              ].map((item) => (
                <div key={item.label} className="surface-outline rounded-[22px] px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">{item.label}</p>
                  <p className="mt-2 text-base font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <p className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">Snapshot: {actualSnapshot ? "Creado" : "Sin datos recibidos"}</p>
              <p className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">Ledger: {hasLedgerEntry ? "Creado" : "Sin datos recibidos"}</p>
              <p className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">Salary acumulado: {hasSalaryEntry ? "Sí" : "No devengado o sin consolidación"}</p>
            </div>
            <p className="mt-3 text-sm text-white/66">
              {asText(actualMeta.onboard_quality_reason) || "Sin motivo operacional adicional para ajuste de ventas/servicio."}
            </p>
          </section>

          {canSeeAppeal ? (
          <section className="glass-panel rounded-[30px] p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Apelación de vuelo</p>
                <p className="mt-2 text-sm text-white/70">
                  {currentAppeal.status === "pending"
                    ? `Apelación pendiente hasta ${formatDateTime(asText(currentAppeal.deadline_at))}.`
                    : currentAppeal.status
                      ? `Apelacion ${asText(currentAppeal.status)}${asText(currentAppeal.resolved_at) ? ` el ${formatDateTime(asText(currentAppeal.resolved_at))}` : ""}.`
                      : "Si este cierre requiere revisión manual, déjalo aquí dentro de 48 horas."}
                </p>
              </div>
              <Link href="/dashboard" className="button-ghost">Volver al dashboard</Link>
            </div>

            {currentAppeal.status === "pending" ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[22px] border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
                  {asText(currentAppeal.category).toUpperCase()} · {asText(currentAppeal.reason) || "Sin motivo"}
                  {asText(currentAppeal.comment) ? ` · ${asText(currentAppeal.comment)}` : ""}
                </div>
                {isAdminReviewer ? (
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleAppealDecision("rejected")}
                      className="button-ghost disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Guardando..." : "Rechazar"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleAppealDecision("resolved")}
                      className="button-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Guardando..." : "Resolver"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <form onSubmit={handleAppealSubmit} className="mt-5 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Categoría</span>
                    <select
                      value={appealCategory}
                      onChange={(event) => setAppealCategory(event.target.value as AppealCategory)}
                      className="rounded-[14px] border border-white/12 bg-[#031428] px-4 py-3 text-sm text-white focus:border-sky-400/60 focus:outline-none"
                    >
                      <option value="score">Score</option>
                      <option value="damage">Daño</option>
                      <option value="dispatch">Despacho</option>
                      <option value="system">Sistema / addon</option>
                      <option value="other">Otro</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Motivo breve</span>
                    <input
                      value={appealReason}
                      onChange={(event) => setAppealReason(event.target.value)}
                      required
                      className="rounded-[14px] border border-white/12 bg-[#031428] px-4 py-3 text-sm text-white focus:border-sky-400/60 focus:outline-none"
                      placeholder="Describe el punto a revisar"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Comentario</span>
                  <textarea
                    value={appealComment}
                    onChange={(event) => setAppealComment(event.target.value)}
                    required
                    rows={4}
                    className="rounded-[14px] border border-white/12 bg-[#031428] px-4 py-3 text-sm text-white focus:border-sky-400/60 focus:outline-none"
                    placeholder="Explica qué revisar manualmente"
                  />
                </label>

                {saveMessage ? <p className="text-sm text-emerald-300">{saveMessage}</p> : null}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="button-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Apelar vuelo"}
                  </button>
                </div>
              </form>
            )}
          </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function FlightResultPage() {
  return (
    <OptionalAuthPage>
      <PublicHeader />
      <FlightResultContent />
    </OptionalAuthPage>
  );
}
