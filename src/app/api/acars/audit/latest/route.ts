import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, hasSupabaseServiceRoleKey } from "@/lib/supabase/server";

type GenericObject = Record<string, unknown>;

function asObject(value: unknown): GenericObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as GenericObject) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const parsed = asText(value);
    if (parsed) return parsed;
  }
  return "";
}

function firstObject(...values: unknown[]): GenericObject {
  for (const value of values) {
    const parsed = asObject(value);
    if (Object.keys(parsed).length > 0) return parsed;
  }
  return {};
}

function hasXmlTag(rawXml: string, tag: string): boolean {
  if (!rawXml) return false;
  return new RegExp(`<${tag}(\\s|>|/)`, "i").test(rawXml);
}

function scorePayloadText(payload: GenericObject): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return "";
  }
}

function extractRawPirepXml(payload: GenericObject): string {
  const closeout = asObject(payload.closeoutPayload);
  const raw = asObject(payload.raw);
  const normalized = asObject(payload.pirep_perfect_normalized);
  return firstText(
    payload.raw_pirep_xml,
    payload.rawPirepXml,
    payload.pirep_xml,
    payload.pirepXml,
    payload.xml,
    closeout.raw_pirep_xml,
    closeout.rawPirepXml,
    closeout.pirepXmlContent,
    raw.raw_pirep_xml,
    normalized.raw_pirep_xml,
  );
}

function summarizeScorePayload(row: GenericObject) {
  const payload = asObject(row.score_payload);
  const officialScores = firstObject(payload.officialScores, payload.official_scores);
  const c0c8 = firstObject(payload.pirep_perfect_c0_c8, payload.pirepPerfectC0C8);
  const normalized = firstObject(payload.pirep_perfect_normalized, payload.pirepPerfectNormalized);
  const altitudeSummary = firstObject(
    payload.altitude_summary,
    c0c8.altitude_summary,
    normalized.altitude_summary,
  );
  const phaseSequenceSummary = firstObject(
    payload.phase_sequence_summary,
    c0c8.phase_sequence_summary,
    normalized.phase_sequence_summary,
  );
  const phaseAuditReport = firstObject(payload.phase_audit_report, c0c8.phase_audit_report, normalized.phase_audit_report);
  const phasePrevalidationPackage = firstObject(
    payload.phase_prevalidation_package,
    c0c8.phase_prevalidation_package,
    normalized.phase_prevalidation_package,
  );
  const phaseAcceptanceMatrix = firstObject(
    payload.phase_acceptance_matrix,
    c0c8.phase_acceptance_matrix,
    normalized.phase_acceptance_matrix,
  );
  const phaseTestRunManifest = firstObject(
    payload.phase_test_run_manifest,
    c0c8.phase_test_run_manifest,
    normalized.phase_test_run_manifest,
  );

  const rawXml = extractRawPirepXml(payload);
  const payloadText = scorePayloadText(payload);
  const hasByPayload = (needle: string) => payloadText.toLowerCase().includes(needle.toLowerCase());

  const detectedBlocks = {
    c0Altitude: Boolean(Object.keys(altitudeSummary).length) || hasXmlTag(rawXml, "Altitude") || hasByPayload("AltitudeMslFt"),
    c1PhaseStateMachine: hasByPayload("OperationalPhaseCode") || hasByPayload("PhaseMatrixVersion") || hasByPayload("C1"),
    c2OperationalChecklist: hasXmlTag(rawXml, "PhaseOperationalChecklist") || hasByPayload("PhaseOperationalChecklist"),
    c3TransitionMatrix: hasByPayload("PhaseTransitionReason") || hasByPayload("PhaseMatrixVersion") || hasByPayload("C3"),
    c4AuditReport: Boolean(Object.keys(phaseAuditReport).length) || hasXmlTag(rawXml, "PhaseAuditReport"),
    c5ReviewContract: hasXmlTag(rawXml, "PhaseReviewContracts") || hasByPayload("PhaseReviewContracts"),
    c6Prevalidation: Boolean(Object.keys(phasePrevalidationPackage).length) || hasXmlTag(rawXml, "PhasePrevalidationPackage"),
    c7AcceptanceMatrix: Boolean(Object.keys(phaseAcceptanceMatrix).length) || hasXmlTag(rawXml, "PhaseAcceptanceMatrix"),
    c8TestRunManifest: Boolean(Object.keys(phaseTestRunManifest).length) || hasXmlTag(rawXml, "PhaseTestRunManifest"),
  };

  const detectedBlockCount = Object.values(detectedBlocks).filter(Boolean).length;
  const eventTimeline = asArray(
    (normalized.event_timeline as unknown) ??
    (normalized.eventTimeline as unknown) ??
    (c0c8.event_timeline as unknown) ??
    (c0c8.eventTimeline as unknown),
  );

  return {
    reservationId: row.id,
    status: row.status,
    scoringStatus: row.scoring_status,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    officialScoringAuthority: firstText(payload.official_scoring_authority, payload.officialAuthority),
    officialCloseoutScoringStatus: firstText(payload.official_closeout_scoring_status, payload.closeout_status, payload.finalStatus),
    reservationClosed: firstText(payload.reservationClosed, payload.reservation_closed),
    acarsClientScoreIgnored: firstText(payload.acars_client_score_ignored, payload.acarsClientScoreIgnored),
    finalScore: firstText(
      payload.final_score,
      payload.finalScore,
      payload.totalScore,
      payload.patagoniaScore,
      officialScores.final_score,
      officialScores.finalScore,
      officialScores.totalScore,
    ),
    c0c8Detected: Boolean(payload.pirepPerfectC0C8Detected) || detectedBlockCount > 0,
    detectedBlockCount,
    detectedBlocks,
    altitudeReliable: Boolean(payload.altitudeReliable ?? altitudeSummary.isReliable ?? altitudeSummary.is_reliable),
    phaseAuditReady: Boolean(payload.phaseAuditReady) || Object.keys(phaseAuditReport).length > 0,
    phaseScoreEligible: Boolean(payload.phaseScoreEligible),
    altitudeSummary: {
      maxMslFt: asNumber(altitudeSummary.maxAltitudeMslFt ?? altitudeSummary.max_msl_ft ?? altitudeSummary.maxMslFt),
      maxAglFt: asNumber(altitudeSummary.maxAltitudeAglFt ?? altitudeSummary.max_agl_ft ?? altitudeSummary.maxAglFt),
      displayMode: firstText(altitudeSummary.displayMode, altitudeSummary.display_mode),
      source: firstText(altitudeSummary.source, altitudeSummary.altitudeSource, altitudeSummary.altitude_source),
      isReliable: altitudeSummary.isReliable ?? altitudeSummary.is_reliable ?? null,
    },
    phaseSequenceSummary,
    eventCount: eventTimeline.length,
    phaseAuditReport,
    phasePrevalidationPackage,
    phaseAcceptanceMatrix,
    phaseTestRunManifest,
    hasRawPirepXml: Boolean(rawXml),
    rawPirepXmlSize: rawXml.length,
  };
}

async function getTableCount(tableName: string): Promise<number | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { count, error } = await supabase.from(tableName).select("*", { count: "exact", head: true });
    if (error) return null;
    return count ?? null;
  } catch {
    return null;
  }
}

function authorizeAuditRequest(req: NextRequest): { ok: true } | { ok: false; response: NextResponse } {
  const configuredToken = process.env.ACARS_AUDIT_TOKEN?.trim();
  if (!configuredToken) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          status: "audit_token_not_configured",
          message: "Configura ACARS_AUDIT_TOKEN en variables de entorno para habilitar este endpoint diagnóstico.",
        },
        { status: 503 },
      ),
    };
  }

  const incomingToken = firstText(
    req.headers.get("x-acars-audit-token"),
    req.nextUrl.searchParams.get("token"),
  );

  if (incomingToken !== configuredToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, status: "unauthorized", message: "Token de auditoría inválido." },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}

export async function GET(req: NextRequest) {
  const auth = authorizeAuditRequest(req);
  if (!auth.ok) return auth.response;

  if (!hasSupabaseServiceRoleKey()) {
    return NextResponse.json(
      {
        success: false,
        status: "service_role_missing",
        message: "Falta SUPABASE_SERVICE_ROLE_KEY para leer auditoría server-side.",
      },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const reservationId = firstText(req.nextUrl.searchParams.get("reservationId"));
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 5);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 20) : 5;

  let query = supabase.from("flight_reservations").select("*");

  if (reservationId) {
    query = query.eq("id", reservationId).limit(1);
  } else {
    query = query.order("updated_at", { ascending: false, nullsFirst: false }).limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      {
        success: false,
        status: "flight_reservations_query_failed",
        message: error.message,
      },
      { status: 500 },
    );
  }

  const reservations = (data ?? []).map((row) => summarizeScorePayload(row as GenericObject));
  const latestReservationId = firstText(reservations[0]?.reservationId);

  let related = {};
  if (latestReservationId) {
    const [scoreReports, scoreLedger] = await Promise.all([
      supabase.from("pw_flight_score_reports").select("*").eq("reservation_id", latestReservationId).limit(5),
      supabase.from("pw_pilot_score_ledger").select("*").eq("reservation_id", latestReservationId).limit(5),
    ]);

    related = {
      scoreReports: scoreReports.error ? { error: scoreReports.error.message } : { rows: scoreReports.data ?? [] },
      pilotScoreLedger: scoreLedger.error ? { error: scoreLedger.error.message } : { rows: scoreLedger.data ?? [] },
    };
  }

  const counts = {
    flight_reservations: await getTableCount("flight_reservations"),
    pw_flight_score_reports: await getTableCount("pw_flight_score_reports"),
    pw_pilot_score_ledger: await getTableCount("pw_pilot_score_ledger"),
    pw_pilot_scores: await getTableCount("pw_pilot_scores"),
  };

  return NextResponse.json({
    success: true,
    status: "ok",
    generatedAt: new Date().toISOString(),
    query: { reservationId: reservationId || null, limit },
    counts,
    reservations,
    related,
    notes: [
      "Endpoint diagnóstico protegido por ACARS_AUDIT_TOKEN.",
      "phaseScoreEligible=false indica que el score por fases C0-C8 aún está en modo trazabilidad hasta prueba real.",
    ],
  });
}
