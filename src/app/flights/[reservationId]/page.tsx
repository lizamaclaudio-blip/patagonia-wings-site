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
            "id, pilot_callsign, route_code, reservation_code, origin_ident, destination_ident, aircraft_type_code, aircraft_registration, aircraft_variant_code, addon_provider, status, created_at, completed_at, updated_at, actual_block_minutes, procedure_score, performance_score, procedure_grade, performance_grade, mission_score, score_payload"
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
        "id, pilot_callsign, route_code, reservation_code, origin_ident, destination_ident, aircraft_type_code, aircraft_registration, aircraft_variant_code, addon_provider, status, created_at, completed_at, updated_at, actual_block_minutes, procedure_score, performance_score, procedure_grade, performance_grade, mission_score, score_payload"
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
        "id, pilot_callsign, route_code, reservation_code, origin_ident, destination_ident, aircraft_type_code, aircraft_registration, aircraft_variant_code, addon_provider, status, created_at, completed_at, updated_at, actual_block_minutes, procedure_score, performance_score, procedure_grade, performance_grade, mission_score, score_payload"
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

