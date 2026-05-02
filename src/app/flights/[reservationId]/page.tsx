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

type TestFinalizePreview = {
  finalStatus?: string;
  evaluationStatus?: string;
  scoringStatus?: string;
  penalties?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  timeline?: Record<string, unknown>;
  officialScore?: number;
  closeoutEvidence?: Record<string, unknown>;
  closeoutWarnings?: string[];
  no_evaluable?: boolean;
};

type TestFinalizeResponse = {
  ok?: boolean;
  fixtureName?: string;
  resultStatus?: string;
  evaluationStatus?: string;
  scoringStatus?: string;
  economyMode?: string;
  economyEligible?: boolean;
  salaryAccrued?: boolean;
  ledgerWritten?: boolean;
  walletMovement?: boolean;
  warnings?: string[];
  evaluationPreview?: TestFinalizePreview;
};

const TEST_FIXTURE_NAMES = [
  "pirep-valid-sample.xml",
  "pirep-no-events.xml",
  "pirep-hard-landing.xml",
  "pirep-overspeed.xml",
  "pirep-completed-normal.xml",
] as const;

const DEFAULT_OWNER_CALLSIGNS = ["PWG001"];

function parseOwnerList(value: string | undefined, fallback: string[]) {
  const parsed = (value ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function isOwnerIdentity(callsign?: string | null, email?: string | null) {
  const ownerCallsigns = parseOwnerList(process.env.NEXT_PUBLIC_PWG_OWNER_CALLSIGNS, DEFAULT_OWNER_CALLSIGNS);
  const ownerEmails = parseOwnerList(process.env.NEXT_PUBLIC_PWG_OWNER_EMAILS, []);
  const normalizedCallsign = (callsign ?? "").trim().toUpperCase();
  const normalizedEmail = (email ?? "").trim().toUpperCase();
  return Boolean(
    (normalizedCallsign && ownerCallsigns.includes(normalizedCallsign)) ||
    (normalizedEmail && ownerEmails.includes(normalizedEmail))
  );
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asBoolean(value: unknown) {
  return value === true;
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
    pending_server_closeout: "Cierre pendiente servidor",
    incomplete_closeout: "Cierre incompleto",
    no_evaluable: "Cierre no evaluable",
    manual_review: "Revisión manual",
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
  if (normalized === "pending_server_closeout" || normalized === "incomplete_closeout" || normalized === "manual_review" || normalized === "no_evaluable") {
    return "text-rose-200 border-rose-400/20 bg-rose-500/10";
  }
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


function formatTimeOnly(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function formatMoney(value: unknown, options?: { signed?: boolean; zeroLabel?: string }) {
  const number = asNumber(value);
  if (number === 0) return options?.zeroLabel ?? "—";
  const prefix = options?.signed && number > 0 ? "+" : "";
  return `${prefix}$${number.toFixed(0)}`;
}

function formatKg(value: unknown) {
  const number = asNumber(value);
  return number > 0 ? `${Math.round(number)} kg` : "—";
}

function formatNm(value: unknown) {
  const number = asNumber(value);
  return number > 0 ? `${Math.round(number)} NM` : "—";
}

function formatPts(value: unknown) {
  const number = asNumber(value);
  return number > 0 ? `${Math.round(number)} pts` : "0 pts";
}

function scoreTextTone(value: unknown) {
  const number = asNumber(value);
  if (number >= 90) return "text-emerald-300";
  if (number >= 70) return "text-sky-200";
  if (number > 0) return "text-amber-200";
  return "text-rose-200";
}

function scoreLabel(value: unknown, noEvaluable = false) {
  if (noEvaluable) return "No evaluable";
  const number = asNumber(value);
  if (number >= 100) return "Excelente";
  if (number >= 85) return "Satisfactorio";
  if (number >= 60) return "Aceptable";
  if (number > 0) return "Deficiente";
  return "Sin puntaje";
}

function scoreStars(value: unknown, noEvaluable = false) {
  if (noEvaluable) return "—";
  const number = asNumber(value);
  if (number >= 110) return "★★★";
  if (number >= 85) return "★★";
  if (number > 0) return "★";
  return "—";
}

function getRecordText(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asText(item[key]);
    if (value) return value;
  }
  return "";
}

function getRecordNumber(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const number = asNumber(item[key]);
    if (number !== 0) return number;
  }
  return 0;
}

function itemPoints(item: Record<string, unknown>, fallbackSign: "positive" | "negative") {
  const number = getRecordNumber(item, ["points", "score", "score_delta", "scoreDelta", "delta", "deduction", "penalty_points", "bonus_points"]);
  if (number === 0) return fallbackSign === "negative" ? "-" : "+";
  const signed = number > 0 ? `+${Math.round(number)}` : `${Math.round(number)}`;
  return `${signed} pts`;
}

function itemTitle(item: Record<string, unknown>) {
  return getRecordText(item, ["title", "label", "name", "code", "event_code", "rule", "stage"]) || "Registro operacional";
}

function itemDescription(item: Record<string, unknown>) {
  return getRecordText(item, ["description", "detail", "message", "reason", "explanation", "summary"]) || "Registro generado por ACARS/Web según reglaje vigente.";
}

function itemStage(item: Record<string, unknown>) {
  const stage = getRecordText(item, ["stage", "phase", "category", "group"]);
  if (!stage) return "General";
  return stage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function payloadText(payload: Record<string, unknown>, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = asText(payload[key]);
    if (value) return value;
  }
  return fallback;
}

function payloadNumber(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const number = asNumber(payload[key]);
    if (number !== 0) return number;
  }
  return 0;
}

function formatClockValue(value?: string | null) {
  const raw = asText(value);
  if (!raw) return "—";
  if (/^\d{1,2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  return formatTimeOnly(raw);
}

type InfoCell = {
  label: string;
  value: string;
  tone?: string;
};

type EvaluationGroup = {
  title: string;
  score: string;
  items: Array<Record<string, unknown>>;
  fallback: string;
  positive?: boolean;
};

function SurHeading({ icon, label, strong }: { icon: string; label: string; strong: string }) {
  return (
    <div className="mb-4 mt-8 flex items-center gap-3 border-b border-white/10 pb-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-base">{icon}</span>
      <h2 className="text-xl font-semibold text-white">
        {label} <strong className="text-emerald-200">{strong}</strong>
      </h2>
    </div>
  );
}

function InfoTable({ columns, rows }: { columns: string[]; rows: InfoCell[][] }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03]">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <div key={column} className="border-b border-white/10 bg-white/[0.06] px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/52">
            {column}
          </div>
        ))}
        {rows.flatMap((row, rowIndex) =>
          row.map((cell, cellIndex) => (
            <div
              key={`${rowIndex}-${cell.label}-${cellIndex}`}
              className="min-h-[70px] border-b border-white/5 px-3 py-4 text-center last:border-b-0"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 md:hidden">{cell.label}</p>
              <p className={`mt-1 text-base font-semibold ${cell.tone ?? "text-white"}`}>{cell.value}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EvaluationBlock({ title, score, label, stars, description, groups, noEvaluable }: {
  title: string;
  score: number;
  label: string;
  stars: string;
  description: string;
  groups: EvaluationGroup[];
  noEvaluable?: boolean;
}) {
  return (
    <section className="glass-panel rounded-[30px] p-7">
      <SurHeading icon={title.toLowerCase().includes("performance") ? "📶" : "📋"} label="Evaluación de" strong={title} />
      <div className="grid gap-4 lg:grid-cols-[0.8fr_0.45fr_1.75fr]">
        <div className="surface-outline rounded-[22px] px-5 py-5 text-center">
          <p className="text-2xl text-amber-200">{stars}</p>
          <p className="mt-2 text-base font-semibold text-white">{label}</p>
        </div>
        <div className="surface-outline rounded-[22px] px-5 py-5 text-center">
          <p className={`text-3xl font-bold ${scoreTextTone(score)}`}>{noEvaluable ? "—" : Math.round(score)}</p>
        </div>
        <div className="surface-outline rounded-[22px] px-5 py-5">
          <p className="text-sm leading-7 text-white/78">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {groups.map((group) => (
          <details key={group.title} open className="rounded-[20px] border border-white/10 bg-black/15 px-5 py-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-white">
              <span className="mr-2 text-white/45">＋</span>{group.title} <strong className={group.positive ? "text-emerald-300" : "text-sky-200"}>{group.score}</strong>
            </summary>
            <div className="mt-4 space-y-4">
              {group.items.length ? group.items.slice(0, 12).map((item, index) => (
                <div key={`${group.title}-${itemTitle(item)}-${index}`} className="grid gap-2 border-t border-white/8 pt-3 md:grid-cols-[1fr_96px]">
                  <div>
                    <p className="text-sm font-semibold text-white">• {itemTitle(item)}</p>
                    <p className="mt-1 text-xs italic leading-6 text-white/58">{itemDescription(item)}</p>
                  </div>
                  <p className={`text-sm font-semibold ${group.positive ? "text-emerald-300" : "text-sky-200"}`}>{itemPoints(item, group.positive ? "positive" : "negative")}</p>
                </div>
              )) : (
                <p className="border-t border-white/8 pt-3 text-sm leading-7 text-white/62">{group.fallback}</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
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
  const [testFixture, setTestFixture] = useState<(typeof TEST_FIXTURE_NAMES)[number]>("pirep-completed-normal.xml");
  const [testRawXml, setTestRawXml] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<TestFinalizeResponse | null>(null);
  const [testToolError, setTestToolError] = useState("");

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
    if (!reservationId || !reservation) return;
    let cancelled = false;
    async function loadEconomyRows() {
      const periodSource = reservation?.completed_at ?? reservation?.updated_at ?? reservation?.created_at ?? null;
      const periodDate = periodSource ? new Date(periodSource) : null;
      const periodYear = periodDate && !Number.isNaN(periodDate.getTime()) ? periodDate.getUTCFullYear() : null;
      const periodMonth = periodDate && !Number.isNaN(periodDate.getTime()) ? periodDate.getUTCMonth() + 1 : null;
      const callsign = asText(reservation?.pilot_callsign).toUpperCase();

      const salaryQuery = periodYear && periodMonth && callsign
        ? supabase
            .from("pilot_salary_ledger")
            .select("id", { count: "exact", head: true })
            .eq("pilot_callsign", callsign)
            .eq("period_year", periodYear)
            .eq("period_month", periodMonth)
        : Promise.resolve({ count: 0 });

      const [economyRes, ledgerRes, salaryRes] = await Promise.all([
        supabase
          .from("flight_economy_snapshots")
          .select("economy_source,fuel_kg_estimated,fuel_kg_actual,block_minutes_estimated,block_minutes_actual,passenger_revenue_usd,cargo_revenue_usd,onboard_service_revenue_usd,onboard_sales_revenue_usd,fuel_cost_usd,maintenance_cost_usd,airport_fees_usd,handling_cost_usd,total_cost_usd,net_profit_usd,pilot_payment_usd,repair_cost_usd,metadata")
          .eq("reservation_id", reservationId)
          .in("economy_source", ["simbrief", "estimate", "actual"])
          .order("created_at", { ascending: false }),
        supabase.from("airline_ledger").select("id", { count: "exact", head: true }).eq("reservation_id", reservationId),
        salaryQuery,
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
  }, [reservationId, reservation]);

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
  const isReservationOwner =
    pilotCallsign.length > 0 &&
    asText(reservation?.pilot_callsign).toUpperCase() === pilotCallsign;
  const canSeeAppeal = isReservationOwner || isAdminReviewer;
  const canUsePirepTester =
    isAdminReviewer || isOwnerIdentity(pilotCallsign, session?.user?.email ?? "");

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
  const officialCloseout = asObject(mergedScorePayload.official_closeout);
  const closeoutWarnings = Array.isArray(mergedScorePayload.closeout_warnings)
    ? (mergedScorePayload.closeout_warnings as string[])
    : [];
  const closeoutEvidence = asObject(mergedScorePayload.closeout_evidence);
  const blackboxEvents = Array.isArray(mergedScorePayload.blackbox_events)
    ? (mergedScorePayload.blackbox_events as Array<Record<string, unknown>>)
    : Array.isArray(mergedScorePayload.blackbox_event_log)
      ? (mergedScorePayload.blackbox_event_log as Array<Record<string, unknown>>)
      : [];
  const evaluationStatus =
    asText(mergedScorePayload.evaluation_status) ||
    asText(officialCloseout.evaluation_status) ||
    "evaluable";
  const economyEligible =
    mergedScorePayload.economy_eligible === true ||
    officialCloseout.economy_eligible === true;
  const salaryAccrued =
    mergedScorePayload.salary_accrued === true ||
    asObject(mergedScorePayload.economy_accounting).pilot_rewards_applied_at != null;
  const ledgerWritten = hasLedgerEntry;
  const scoringStatus = asText(mergedScorePayload.scoring_status) || asText(asObject(mergedScorePayload.official_closeout).scoring_status);
  const telemetrySamples = asNumber(closeoutEvidence.telemetry_samples);
  const elapsedSeconds = asNumber(closeoutEvidence.elapsed_seconds);
  const distanceNmEvidence = asNumber(closeoutEvidence.distance_nm);
  const noEvidenceSignals =
    penalties.length === 0 &&
    officialEvents.length === 0 &&
    blackboxEvents.length === 0 &&
    telemetrySamples <= 0 &&
    elapsedSeconds <= 0 &&
    distanceNmEvidence <= 0;
  const noEvaluableCloseout =
    evaluationStatus === "no_evaluable" ||
    scoringStatus === "pending_server_closeout" ||
    scoringStatus === "incomplete_closeout" ||
    noEvidenceSignals;
  const rawPirepFileName = asText(mergedScorePayload.raw_pirep_file_name);

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

  const procedureScoreValue = noEvaluableCloseout ? 0 : asNumber(scoreReport?.procedure_score ?? reservation?.procedure_score);
  const performanceScoreValue = noEvaluableCloseout ? 0 : asNumber(scoreReport?.performance_score ?? reservation?.performance_score);
  const missionScoreValue = noEvaluableCloseout ? 0 : asNumber(reservation?.mission_score);
  const totalScoreValue = noEvaluableCloseout ? 0 : (surScore || procedureScoreValue + performanceScoreValue + missionScoreValue);
  const originIdent = asText(reservation?.origin_ident) || "---";
  const destinationIdent = asText(reservation?.destination_ident) || "---";
  const aircraftCode = asText(reservation?.aircraft_type_code) || "—";
  const aircraftRegistration = asText(reservation?.aircraft_registration) || "—";
  const aircraftDisplay = [aircraftCode, aircraftRegistration].filter((item) => item && item !== "—").join(" · ") || "—";
  const flightTypeLabel = payloadText(mergedScorePayload, ["flight_type", "operation_type", "route_band", "mission_type"], "—");
  const rankLabel = payloadText(mergedScorePayload, ["pilot_rank", "rank_name", "career_rank"], "Piloto Patagonia Wings");
  const pilotHours = payloadNumber(mergedScorePayload, ["pilot_hours", "pilot_total_hours", "total_hours"]);
  const scheduledDeparture = formatClockValue(payloadText(mergedScorePayload, ["scheduled_departure", "scheduled_etd", "etd", "std"], ""));
  const scheduledArrival = formatClockValue(payloadText(mergedScorePayload, ["scheduled_arrival", "scheduled_eta", "eta", "sta"], ""));
  const actualStart = formatClockValue(payloadText(mergedScorePayload, ["actual_start_time", "started_at", "flight_started_at", "block_off_at", "engine_start_at"], reservation?.created_at ?? ""));
  const actualEnd = formatClockValue(payloadText(mergedScorePayload, ["actual_end_time", "landed_at", "completed_at", "block_on_at"], reservation?.completed_at ?? reservation?.updated_at ?? ""));
  const picFalseCount = payloadNumber(mergedScorePayload, ["pic_false_count", "pic_false", "pic_falses", "picFalse"]);
  const stallSeconds = payloadNumber(mergedScorePayload, ["stall_seconds", "stall_time_seconds", "stallSeconds"]);
  const overspeedSeconds = payloadNumber(mergedScorePayload, ["overspeed_seconds", "overspeed_time_seconds", "overspeedSeconds"]);
  const maxGForce = payloadNumber(mergedScorePayload, ["landing_g_force", "max_g_force", "g_force", "touchdown_g"]);
  const departureWind = payloadText(mergedScorePayload, ["departure_wind_summary", "departure_wind", "takeoff_wind", "dep_wind"], "Sin datos recibidos");
  const arrivalWind = payloadText(mergedScorePayload, ["arrival_wind_summary", "arrival_wind", "landing_wind", "arr_wind"], "Sin datos recibidos");
  const departureRunway = payloadText(mergedScorePayload, ["departure_runway", "takeoff_runway", "dep_runway"], "RWY N/D");
  const arrivalRunway = payloadText(mergedScorePayload, ["arrival_runway", "landing_runway", "arr_runway"], "RWY N/D");
  const cruiseLevel = payloadText(mergedScorePayload, ["cruise_level", "flight_level", "planned_flight_level", "fl"], "—");
  const routeText = payloadText(mergedScorePayload, ["route", "route_string", "ofp_route", "filed_route"], "Sin ruta cargada");
  const simName = payloadText(mergedScorePayload, ["simulator", "sim", "sim_name"], "Microsoft Flight Simulator / ACARS Patagonia Wings");
  const acarsVersion = payloadText(mergedScorePayload, ["acars_version", "client_version", "version"], "—");
  const procedureGroups: EvaluationGroup[] = [
    {
      title: "Procedimientos observados",
      score: penalties.length ? `${penalties.length} registros` : "Sin descuentos",
      items: penalties,
      fallback: noEvaluableCloseout ? "No se aplicó evaluación de procedimientos porque el cierre no tiene evidencia mínima." : "Sin penalizaciones de procedimiento registradas.",
    },
  ];
  const performanceGroups: EvaluationGroup[] = [
    {
      title: "Planificación",
      score: plannedSnapshot ? "Datos SimBrief cargados" : "Sin OFP consolidado",
      positive: true,
      items: [],
      fallback: plannedSnapshot ? "El despacho SimBrief fue encontrado y se usa como referencia planificada." : "Sin snapshot planificado disponible para este vuelo.",
    },
    {
      title: "Maniobras y eventos",
      score: officialEvents.length ? `${officialEvents.length} eventos` : "Sin eventos",
      positive: true,
      items: officialEvents,
      fallback: noEvaluableCloseout ? "No hay eventos evaluables desde caja negra/ACARS." : "Sin eventos operacionales registrados por el servidor.",
    },
    {
      title: "Aterrizaje",
      score: landingVs ? `${Math.round(landingVs)} fpm` : "Sin touchdown",
      positive: true,
      items: damageEvents,
      fallback: landingVs ? "Touchdown registrado sin eventos de daño asociados." : "Sin dato de touchdown disponible.",
    },
    {
      title: "Condiciones adicionales",
      score: economyEligible ? "Computa economía" : "No computa economía",
      positive: true,
      items: [],
      fallback: economyEligible ? "El vuelo es elegible para devengo operacional y trazabilidad económica." : "No se generó devengo ni ledger por falta de cierre evaluable.",
    },
  ];
  const jefeFlotaFeedback = observations || (noEvaluableCloseout
    ? "El cierre fue recibido, pero no contiene evidencia mínima de vuelo para evaluar procedimientos, performance ni economía. Se recomienda repetir la prueba verificando inicio ACARS, telemetría viva y cierre con caja negra completa."
    : `El vuelo ${originIdent}-${destinationIdent} con la aeronave ${aircraftDisplay} fue procesado por ACARS y evaluado por el servidor. Revisa los apartados de procedimientos, performance, combustible y economía para identificar oportunidades de mejora.`);

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

  async function handleRunPirepTest() {
    if (!reservationId) return;
    setTestRunning(true);
    setTestToolError("");
    setTestResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Debes iniciar sesión como owner/admin para probar PIREP XML.");

      const response = await fetch("/api/acars/finalize/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId,
          fixtureName: testFixture,
          raw_pirep_xml: testRawXml.trim() || undefined,
          testMode: true,
          dryRun: true,
          saveTestEvaluation: true,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as TestFinalizeResponse & { error?: string };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "No se pudo ejecutar el preview de reglaje.");
      }

      setTestResult(payload);
    } catch (runError) {
      setTestToolError(runError instanceof Error ? runError.message : "Error ejecutando PIREP test.");
    } finally {
      setTestRunning(false);
    }
  }

  return (
    <div className="pw-container py-10 sm:py-14 lg:py-16">
      <section className="glass-panel rounded-[34px] p-7 sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className="parallax-chip mb-5">PIREP / RESUMEN OFICIAL</span>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Pirep <strong className="text-emerald-200">#{flightNumber}</strong>
            </h1>
            <p className="mt-3 text-base leading-8 text-white/78">
              {originIdent} → {destinationIdent} · Evaluación Patagonia Wings ACARS/Web
            </p>
          </div>
          <div className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${statusTone(noEvaluableCloseout ? "no_evaluable" : reservation?.status)}`}>
            {formatStatus(noEvaluableCloseout ? "no_evaluable" : reservation?.status)}
          </div>
        </div>
      </section>

      {loading ? (
        <section className="mt-6 glass-panel rounded-[30px] p-7 text-white/70">Cargando resultado...</section>
      ) : error ? (
        <section className="mt-6 glass-panel rounded-[30px] p-7 text-rose-300">{error}</section>
      ) : reservation ? (
        <div className="mt-6 grid gap-6">
          {noEvaluableCloseout ? (
            <section className="rounded-[24px] border border-rose-400/25 bg-rose-500/10 px-6 py-5">
              <p className="text-sm font-semibold text-rose-100">
                Cierre recibido, pero no evaluable por falta de evidencia de vuelo.
              </p>
              <p className="mt-2 text-sm text-rose-100/80">
                No se generó devengo, wallet, salary real ni ledger aerolínea. La información queda solo como trazabilidad.
              </p>
            </section>
          ) : null}

          <section className="glass-panel rounded-[30px] p-7">
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="button-ghost">Volver al dashboard</Link>
              <Link href={`/flights/${reservationId}`} className="button-ghost">Resumen del vuelo</Link>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Log ACARS: {rawPirepFileName || "score_payload"}
              </span>
            </div>

            <SurHeading icon="👨‍✈️" label="Piloto al" strong="Mando" />
            <InfoTable
              columns={["Piloto al mando", "Rango", "Horas", "Tipo de vuelo"]}
              rows={[[
                { label: "Piloto al mando", value: `${asText(reservation.pilot_callsign) || "—"}` },
                { label: "Rango", value: rankLabel },
                { label: "Horas", value: pilotHours > 0 ? pilotHours.toFixed(1) : formatMinutes(reservation.actual_block_minutes) },
                { label: "Tipo de vuelo", value: flightTypeLabel },
              ]]}
            />

            <SurHeading icon="📅" label="Vuelo" strong="Programado" />
            <InfoTable
              columns={["Nro. vuelo", "Origen", "ETD", "Destino", "ETA", "Equipo", "Matrícula"]}
              rows={[[
                { label: "Nro. vuelo", value: flightNumber, tone: "text-emerald-200" },
                { label: "Origen", value: originIdent },
                { label: "ETD", value: scheduledDeparture },
                { label: "Destino", value: destinationIdent },
                { label: "ETA", value: scheduledArrival },
                { label: "Equipo", value: aircraftCode },
                { label: "Matrícula", value: aircraftRegistration },
              ]]}
            />

            <SurHeading icon="✈️" label="Vuelo" strong="Realizado" />
            <InfoTable
              columns={["Duración", "Origen", "Comienzo", "Destino", "Fin", "Equipo", "Estado"]}
              rows={[[
                { label: "Duración", value: formatMinutes(reservation.actual_block_minutes) },
                { label: "Origen", value: originIdent },
                { label: "Comienzo", value: actualStart, tone: "text-emerald-300" },
                { label: "Destino", value: destinationIdent },
                { label: "Fin", value: actualEnd, tone: "text-sky-200" },
                { label: "Equipo", value: aircraftCode },
                { label: "Estado", value: noEvaluableCloseout ? "No evaluable" : formatStatus(reservation.status), tone: noEvaluableCloseout ? "text-rose-200" : "text-emerald-300" },
              ]]}
            />
          </section>

          {canUsePirepTester ? (
            <section className="glass-panel rounded-[30px] p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Herramienta owner · Probar PIREP XML</p>
                  <p className="mt-2 text-sm text-white/70">Modo test/dryRun: evalúa reglaje y resumen sin mover wallet ni generar ledger real.</p>
                </div>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  OWNER
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[280px_1fr]">
                <label className="space-y-2 text-sm text-white/80">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Fixture</span>
                  <select
                    value={testFixture}
                    onChange={(event) => setTestFixture(event.target.value as (typeof TEST_FIXTURE_NAMES)[number])}
                    className="w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                  >
                    {TEST_FIXTURE_NAMES.map((fixture) => (
                      <option key={fixture} value={fixture}>{fixture}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-white/80">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">XML manual opcional</span>
                  <textarea
                    value={testRawXml}
                    onChange={(event) => setTestRawXml(event.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-xs text-white outline-none"
                    placeholder="Si lo dejas vacío, el endpoint usa el fixture seleccionado."
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void handleRunPirepTest()} disabled={testRunning} className="button-primary disabled:cursor-not-allowed disabled:opacity-60">
                  {testRunning ? "Ejecutando preview..." : "Ejecutar evaluación test"}
                </button>
                <p className="text-xs text-white/60">Sin cierre pagable, sin salary ledger real, sin airline ledger real.</p>
              </div>

              {testToolError ? <p className="mt-4 text-sm text-rose-300">{testToolError}</p> : null}
              {testResult?.ok ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">Estado</p>
                    <p className="mt-1 font-semibold text-white">{testResult.resultStatus || "—"}</p>
                  </div>
                  <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">Evaluación</p>
                    <p className="mt-1 font-semibold text-white">{testResult.evaluationStatus || "—"} · {testResult.scoringStatus || "—"}</p>
                  </div>
                  <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">Economía</p>
                    <p className="mt-1 font-semibold text-white">{testResult.economyMode || "preview"} · salary={String(asBoolean(testResult.salaryAccrued))} · ledger={String(asBoolean(testResult.ledgerWritten))}</p>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="glass-panel rounded-[30px] p-7">
            <SurHeading icon="📊" label="Puntaje del" strong="Vuelo" />
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03]">
              <div className="grid grid-cols-5 text-center">
                <div className="border-b border-white/10 bg-white/[0.06] px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/52">Procedimientos</div>
                <div className="border-b border-white/10 bg-white/[0.06] px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/52">+ o -</div>
                <div className="border-b border-white/10 bg-white/[0.06] px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/52">Performance</div>
                <div className="border-b border-white/10 bg-white/[0.06] px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/52">=</div>
                <div className="border-b border-white/10 bg-white/[0.06] px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/52">Puntaje</div>
                <div className="px-3 py-5"><h3 className={`text-2xl font-bold ${scoreTextTone(procedureScoreValue)}`}>{formatPts(procedureScoreValue)}</h3></div>
                <div className="px-3 py-5"><h3 className="text-2xl font-bold text-white/60">+</h3></div>
                <div className="px-3 py-5"><h3 className={`text-2xl font-bold ${scoreTextTone(performanceScoreValue)}`}>{formatPts(performanceScoreValue)}</h3></div>
                <div className="px-3 py-5"><h3 className="text-2xl font-bold text-white/60">=</h3></div>
                <div className="px-3 py-5"><h3 className={`text-2xl font-bold ${scoreTextTone(totalScoreValue)}`}>{formatPts(totalScoreValue)}</h3></div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03]">
              <div className="grid gap-0 md:grid-cols-7">
                {[
                  { label: "Vientos salida", value: `${departureRunway}\n${departureWind}`, tone: "text-emerald-200" },
                  { label: "PIC False", value: `${picFalseCount}`, tone: picFalseCount > 0 ? "text-rose-200" : "text-emerald-200" },
                  { label: "Stall", value: `${stallSeconds} seg`, tone: stallSeconds > 0 ? "text-rose-200" : "text-emerald-200" },
                  { label: "Overspeed", value: `${overspeedSeconds} seg`, tone: overspeedSeconds > 0 ? "text-rose-200" : "text-emerald-200" },
                  { label: "G-Force", value: maxGForce > 0 ? `${maxGForce.toFixed(2)}g` : "—", tone: maxGForce > 1.6 ? "text-rose-200" : "text-emerald-200" },
                  { label: "Touchdown", value: landingVs ? `${Math.round(landingVs)} ft/min` : "—", tone: landingVs && Math.abs(landingVs) > 700 ? "text-rose-200" : "text-emerald-200" },
                  { label: "Vientos llegada", value: `${arrivalRunway}\n${arrivalWind}`, tone: "text-emerald-200" },
                ].map((item) => (
                  <div key={item.label} className="border-b border-white/10 px-3 py-4 text-center md:border-b-0 md:border-r md:border-white/10 md:last:border-r-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">{item.label}</p>
                    <p className={`mt-2 whitespace-pre-line text-sm font-semibold ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <EvaluationBlock
            title="Procedimientos"
            score={procedureScoreValue}
            label={scoreLabel(procedureScoreValue, noEvaluableCloseout)}
            stars={scoreStars(procedureScoreValue, noEvaluableCloseout)}
            description={noEvaluableCloseout ? "La operación no tiene evidencia mínima suficiente para aplicar reglaje de procedimientos." : "Detalle de descuentos, advertencias y observaciones de procedimiento detectadas por ACARS/Web."}
            groups={procedureGroups}
            noEvaluable={noEvaluableCloseout}
          />

          <EvaluationBlock
            title="Performance"
            score={performanceScoreValue}
            label={scoreLabel(performanceScoreValue, noEvaluableCloseout)}
            stars={scoreStars(performanceScoreValue, noEvaluableCloseout)}
            description={noEvaluableCloseout ? "La performance no se evalúa si no hay caja negra o telemetría mínima confiable." : "Detalle de métricas de performance, planificación, maniobras, aterrizaje y condiciones adicionales."}
            groups={performanceGroups}
            noEvaluable={noEvaluableCloseout}
          />

          <section className="glass-panel rounded-[30px] p-7">
            <SurHeading icon="🧑‍✈️" label="Feedback del" strong="Jefe de Flota" />
            <div className="rounded-[22px] border-l-4 border-emerald-300/60 bg-emerald-300/8 px-5 py-5">
              <p className="text-sm italic leading-8 text-white/80">“{jefeFlotaFeedback}”</p>
            </div>
          </section>

          <section className="glass-panel rounded-[30px] p-7">
            <SurHeading icon="💰" label="Economía / Coins del" strong="Vuelo" />
            <InfoTable
              columns={["Vuelo", "Tiempo", "Consumo", "Performance", "Procedimiento", "Adicional", "Total"]}
              rows={[[
                { label: "Vuelo", value: economyEligible ? formatMoney(reservation.commission_usd, { signed: true, zeroLabel: "$0" }) : "$0", tone: economyEligible ? "text-emerald-300" : "text-white/50" },
                { label: "Tiempo", value: formatMinutes(reservation.actual_block_minutes) },
                { label: "Consumo", value: formatKg(fuelUsedKg) },
                { label: "Performance", value: formatPts(performanceScoreValue) },
                { label: "Procedimiento", value: formatPts(procedureScoreValue) },
                { label: "Adicional", value: economyEligible ? "Computa" : "No computa", tone: economyEligible ? "text-emerald-300" : "text-rose-200" },
                { label: "Total", value: economyEligible ? formatMoney(actualSnapshot?.pilot_payment_usd || reservation.commission_usd, { signed: true, zeroLabel: "$0" }) : "$0", tone: economyEligible ? "text-emerald-300" : "text-white/50" },
              ]]}
            />

            <SurHeading icon="⚖️" label="Despacho de Peso y" strong="Combustible" />
            <InfoTable
              columns={["TOW despachado", "TOW del avión", "Fuel despachado", "Fuel al iniciar", "Fuel consumido"]}
              rows={[[
                { label: "TOW despachado", value: formatKg(payloadNumber(mergedScorePayload, ["tow_dispatched_kg", "planned_tow_kg", "tow_kg"])) },
                { label: "TOW del avión", value: formatKg(payloadNumber(mergedScorePayload, ["actual_tow_kg", "aircraft_tow_kg"])) },
                { label: "Fuel despachado", value: formatKg(plannedSnapshot?.fuel_kg_estimated) },
                { label: "Fuel al iniciar", value: formatKg(fuelStartKg) },
                { label: "Fuel consumido", value: formatKg(fuelUsedKg || actualSnapshot?.fuel_kg_actual) },
              ]]}
            />
          </section>

          <section className="glass-panel rounded-[30px] p-7">
            <SurHeading icon="🗺️" label="Plan de" strong="Vuelo" />
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-5 text-center">
              <p className="text-sm font-semibold leading-7 text-white">{routeText}</p>
            </div>

            <SurHeading icon="⚙️" label="Parámetros de" strong="Vuelo" />
            <InfoTable
              columns={["Nivel de vuelo", "Combustible utilizado", "Distancia recorrida", "Pista y condiciones de salida", "Pista y condiciones de llegada"]}
              rows={[[
                { label: "Nivel de vuelo", value: cruiseLevel },
                { label: "Combustible utilizado", value: formatKg(fuelUsedKg || actualSnapshot?.fuel_kg_actual) },
                { label: "Distancia recorrida", value: formatNm(distanceNmEvidence || reservation.distance_nm) },
                { label: "Pista y condiciones de salida", value: `${departureRunway} · ${departureWind}` },
                { label: "Pista y condiciones de llegada", value: `${arrivalRunway} · ${arrivalWind}` },
              ]]}
            />

            <SurHeading icon="💻" label="Detalles del" strong="Simulador" />
            <InfoTable
              columns={["Simulador", "ACARS", "PIREP XML", "Muestras", "Elapsed", "Estado server"]}
              rows={[[
                { label: "Simulador", value: simName },
                { label: "ACARS", value: acarsVersion },
                { label: "PIREP XML", value: rawPirepFileName || "score_payload" },
                { label: "Muestras", value: String(telemetrySamples) },
                { label: "Elapsed", value: elapsedSeconds > 0 ? `${elapsedSeconds}s` : "—" },
                { label: "Estado server", value: scoringStatus || "scored" },
              ]]}
            />

            <SurHeading icon="📈" label="Planificado vs" strong="Real" />
            <InfoTable
              columns={["Fuel", "Block", "Ingresos USD", "Costos USD", "Utilidad USD", "Comisión USD"]}
              rows={[[
                { label: "Fuel", value: `${formatKg(plannedSnapshot?.fuel_kg_estimated)} / ${formatKg(actualSnapshot?.fuel_kg_actual)}` },
                { label: "Block", value: `${formatMinutes(asNumber(plannedSnapshot?.block_minutes_estimated))} / ${formatMinutes(asNumber(actualSnapshot?.block_minutes_actual) || reservation.actual_block_minutes)}` },
                { label: "Ingresos USD", value: `${formatMoney(plannedRevenue, { zeroLabel: "Sin datos" })} / ${formatMoney(actualRevenue, { zeroLabel: "Sin datos" })}` },
                { label: "Costos USD", value: `${formatMoney(plannedSnapshot?.total_cost_usd, { zeroLabel: "Sin datos" })} / ${formatMoney(actualSnapshot?.total_cost_usd, { zeroLabel: "Sin datos" })}` },
                { label: "Utilidad USD", value: noEvaluableCloseout ? "No aplicable" : `${formatMoney(plannedSnapshot?.net_profit_usd, { zeroLabel: "Sin datos" })} / ${formatMoney(actualSnapshot?.net_profit_usd, { zeroLabel: "Sin datos" })}` },
                { label: "Comisión USD", value: noEvaluableCloseout ? "$0 / $0" : `${formatMoney(plannedSnapshot?.pilot_payment_usd, { zeroLabel: "Sin datos" })} / ${formatMoney(actualSnapshot?.pilot_payment_usd || reservation.commission_usd, { zeroLabel: "Sin datos" })}` },
              ]]}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <p className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">Snapshot: {actualSnapshot ? "Creado" : "Sin datos recibidos"}</p>
              <p className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">Ledger: {hasLedgerEntry ? "Creado" : "Sin datos recibidos"}</p>
              <p className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">Salary mensual: {hasSalaryEntry ? "Sí" : "No devengado"}</p>
            </div>
            <p className="mt-3 text-sm text-white/66">
              {asText(actualMeta.onboard_quality_reason) || "Sin motivo operacional adicional para ajuste de ventas/servicio."}
            </p>
          </section>

          <section className="glass-panel rounded-[30px] p-7">
            <SurHeading icon="⚠️" label="Trazabilidad de" strong="Cierre" />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-rose-400/15 bg-rose-400/5 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/80">Detalle penalizaciones</p>
                <div className="mt-4 space-y-3">
                  {penalties.length ? penalties.slice(0, 10).map((item, index) => (
                    <div key={`${asText(item.code)}-${index}`} className="rounded-[18px] border border-white/10 bg-black/15 px-4 py-3">
                      <p className="text-sm font-semibold text-white">{itemTitle(item)}</p>
                      <p className="mt-1 text-xs text-white/54">{itemStage(item)} · {asText(item.severity) || "reglaje"}</p>
                      <p className="mt-2 text-sm text-white/78">{itemDescription(item)}</p>
                    </div>
                  )) : <p className="text-sm text-white/64">Sin penalizaciones registradas.</p>}
                </div>
              </div>

              <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/5 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Timeline servidor / caja negra</p>
                <div className="mt-4 space-y-3">
                  {officialEvents.length ? officialEvents.slice(0, 10).map((item, index) => (
                    <div key={`${asText(item.code)}-${index}`} className="rounded-[18px] border border-white/10 bg-black/15 px-4 py-3">
                      <p className="text-sm font-semibold text-white">{itemTitle(item)}</p>
                      <p className="mt-1 text-xs text-white/54">{itemStage(item)} · {asText(item.severity) || "evento"}</p>
                      <p className="mt-2 text-sm text-white/78">{itemDescription(item)}</p>
                    </div>
                  )) : <p className="text-sm text-white/64">Sin eventos oficiales registrados.</p>}
                </div>
              </div>
            </div>

            {(closeoutWarnings.length > 0 || noEvaluableCloseout) ? (
              <div className="mt-4 rounded-[18px] border border-rose-400/20 bg-rose-500/8 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-100/90">Motivo de no evaluación</p>
                {closeoutWarnings.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-rose-100/85">
                    {closeoutWarnings.map((warning) => <li key={warning}>• {warning}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-rose-100/85">No hay evidencia mínima de vuelo suficiente para aplicar reglaje/economía.</p>
                )}
              </div>
            ) : null}
          </section>

          {canSeeAppeal ? (
            <section className="glass-panel rounded-[30px] p-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Derecho a réplica</p>
                  <p className="mt-2 text-sm text-white/70">
                    {currentAppeal.status === "pending"
                      ? `Apelación pendiente hasta ${formatDateTime(asText(currentAppeal.deadline_at))}.`
                      : currentAppeal.status
                        ? `Apelación ${asText(currentAppeal.status)}${asText(currentAppeal.resolved_at) ? ` el ${formatDateTime(asText(currentAppeal.resolved_at))}` : ""}.`
                        : "Si este cierre requiere revisión manual, déjalo aquí dentro de 48 horas."}
                  </p>
                </div>
                <Link href="/dashboard" className="button-ghost">Volver</Link>
              </div>

              {currentAppeal.status === "pending" ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[22px] border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
                    {asText(currentAppeal.category).toUpperCase()} · {asText(currentAppeal.reason) || "Sin motivo"}
                    {asText(currentAppeal.comment) ? ` · ${asText(currentAppeal.comment)}` : ""}
                  </div>
                  {isAdminReviewer ? (
                    <div className="flex flex-wrap justify-end gap-3">
                      <button type="button" disabled={saving} onClick={() => void handleAppealDecision("rejected")} className="button-ghost disabled:cursor-not-allowed disabled:opacity-60">
                        {saving ? "Guardando..." : "Rechazar"}
                      </button>
                      <button type="button" disabled={saving} onClick={() => void handleAppealDecision("resolved")} className="button-primary disabled:cursor-not-allowed disabled:opacity-60">
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
                      <select value={appealCategory} onChange={(event) => setAppealCategory(event.target.value as AppealCategory)} className="rounded-[14px] border border-white/12 bg-[#031428] px-4 py-3 text-sm text-white focus:border-sky-400/60 focus:outline-none">
                        <option value="score">Score</option>
                        <option value="damage">Daño</option>
                        <option value="dispatch">Despacho</option>
                        <option value="system">Sistema / addon</option>
                        <option value="other">Otro</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Motivo breve</span>
                      <input value={appealReason} onChange={(event) => setAppealReason(event.target.value)} required className="rounded-[14px] border border-white/12 bg-[#031428] px-4 py-3 text-sm text-white focus:border-sky-400/60 focus:outline-none" placeholder="Describe el punto a revisar" />
                    </label>
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Comentario</span>
                    <textarea value={appealComment} onChange={(event) => setAppealComment(event.target.value)} required rows={4} className="rounded-[14px] border border-white/12 bg-[#031428] px-4 py-3 text-sm text-white focus:border-sky-400/60 focus:outline-none" placeholder="Explica qué revisar manualmente" />
                  </label>

                  {saveMessage ? <p className="text-sm text-emerald-300">{saveMessage}</p> : null}

                  <div className="flex justify-end">
                    <button type="submit" disabled={saving} className="button-primary disabled:cursor-not-allowed disabled:opacity-60">
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
