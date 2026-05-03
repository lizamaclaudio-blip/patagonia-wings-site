import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, hasSupabaseServiceRoleKey } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ReadinessState = "READY" | "WARN" | "BLOCK";

type Check = {
  key: string;
  state: ReadinessState;
  message: string;
  detail?: Record<string, unknown>;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value).trim();
}

function hasAnyText(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern.toLowerCase()));
}

function summarizePayload(payload: unknown) {
  const sp = asObject(payload);
  const rawText = JSON.stringify(payload ?? {});
  const altitude = asObject(sp.altitude_summary);
  const phaseSequence = asObject(sp.phase_sequence_summary);

  return {
    officialAuthority: asText(sp.official_scoring_authority) || asText(sp.officialAuthority),
    closeoutStatus:
      asText(sp.official_closeout_scoring_status) ||
      asText(sp.closeout_status) ||
      asText(sp.finalStatus) ||
      asText(sp.status),
    finalScore:
      asText(sp.final_score) ||
      asText(sp.finalScore) ||
      asText(sp.totalScore) ||
      asText(sp.patagoniaScore) ||
      asText(asObject(sp.officialScores).final_score) ||
      asText(asObject(sp.officialScores).finalScore),
    c0c8Detected:
      sp.pirepPerfectC0C8Detected === true ||
      sp.pirep_perfect_c0_c8_detected === true ||
      Boolean(sp.pirep_perfect_c0_c8) ||
      hasAnyText(rawText, [
        "<Altitude",
        "PhaseAuditReport",
        "PhasePrevalidationPackage",
        "PhaseAcceptanceMatrix",
        "PhaseTestRunManifest",
      ]),
    altitudeReliable: sp.altitudeReliable ?? altitude.isReliable ?? altitude.is_reliable ?? null,
    phaseAuditReady: sp.phaseAuditReady ?? null,
    phaseScoreEligible: sp.phaseScoreEligible ?? false,
    maxAltitudeMslFt:
      altitude.maxAltitudeMslFt ??
      altitude.max_altitude_msl_ft ??
      asObject(sp.pirep_perfect_normalized).maxAltitudeMslFt ??
      null,
    maxAglFt:
      altitude.maxAglFt ??
      altitude.max_agl_ft ??
      asObject(sp.pirep_perfect_normalized).maxAglFt ??
      null,
    observedPhases:
      phaseSequence.observedPhases ??
      phaseSequence.observed_phases ??
      asObject(sp.pirep_perfect_normalized).observedPhases ??
      null,
    hasRawXml: hasAnyText(rawText, ["<Pirep", "<PIREP"]),
    hasC0Altitude: hasAnyText(rawText, ["<Altitude"]),
    hasC1PhaseState: hasAnyText(rawText, ["OperationalPhaseCode"]),
    hasC2Checklist: hasAnyText(rawText, ["PhaseOperationalChecklist"]),
    hasC3Transitions: hasAnyText(rawText, ["PhaseTransitionReason"]),
    hasC4Audit: hasAnyText(rawText, ["PhaseAuditReport"]),
    hasC5Contract: hasAnyText(rawText, ["PhaseReviewContracts"]),
    hasC6Prevalidation: hasAnyText(rawText, ["PhasePrevalidationPackage"]),
    hasC7Acceptance: hasAnyText(rawText, ["PhaseAcceptanceMatrix"]),
    hasC8Manifest: hasAnyText(rawText, ["PhaseTestRunManifest"]),
  };
}

function globalState(checks: Check[]): ReadinessState {
  if (checks.some((check) => check.state === "BLOCK")) return "BLOCK";
  if (checks.some((check) => check.state === "WARN")) return "WARN";
  return "READY";
}

async function countRows(table: string): Promise<{ table: string; count: number | null; error?: string }> {
  try {
    const supabase = createSupabaseAdminClient();
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    return { table, count: typeof count === "number" ? count : null, error: error?.message };
  } catch (error) {
    return { table, count: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: NextRequest) {
  const configuredToken = process.env.ACARS_AUDIT_TOKEN?.trim() ?? "";
  const providedToken = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "5");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 20) : 5;

  if (!configuredToken) {
    return NextResponse.json(
      {
        success: false,
        error: "audit_token_not_configured",
        message: "Define ACARS_AUDIT_TOKEN en Vercel/local para usar este endpoint.",
      },
      { status: 503 }
    );
  }

  if (!providedToken || providedToken !== configuredToken) {
    return NextResponse.json(
      {
        success: false,
        error: "unauthorized",
      },
      { status: 401 }
    );
  }

  const checks: Check[] = [];

  checks.push({
    key: "env.supabase_service_role",
    state: hasSupabaseServiceRoleKey() ? "READY" : "BLOCK",
    message: hasSupabaseServiceRoleKey()
      ? "SUPABASE_SERVICE_ROLE_KEY disponible para lecturas/escrituras server-side."
      : "Falta SUPABASE_SERVICE_ROLE_KEY; finalize/scoring server-side puede fallar.",
  });

  checks.push({
    key: "env.audit_token",
    state: "READY",
    message: "ACARS_AUDIT_TOKEN configurado y validado.",
  });

  let recentCloseouts: unknown[] = [];
  let recentSummaries: unknown[] = [];
  let dbError = "";

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("flight_reservations")
      .select("id,status,scoring_status,completed_at,updated_at,score_payload")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      dbError = error.message;
      checks.push({
        key: "db.flight_reservations_recent",
        state: "BLOCK",
        message: "No se pudieron leer últimos cierres.",
        detail: { error: error.message },
      });
    } else {
      recentCloseouts = data ?? [];
      recentSummaries = (data ?? []).map((row) => {
        const r = asObject(row);
        return {
          id: r.id,
          status: r.status,
          scoringStatus: r.scoring_status,
          completedAt: r.completed_at,
          updatedAt: r.updated_at,
          payload: summarizePayload(r.score_payload),
        };
      });

      checks.push({
        key: "db.flight_reservations_recent",
        state: recentCloseouts.length > 0 ? "READY" : "WARN",
        message: recentCloseouts.length > 0 ? "Últimos cierres disponibles." : "No hay cierres recientes para auditar.",
        detail: { count: recentCloseouts.length },
      });
    }
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
    checks.push({
      key: "db.connectivity",
      state: "BLOCK",
      message: "No se pudo inicializar cliente Supabase admin.",
      detail: { error: dbError },
    });
  }

  const tableCounts = await Promise.all(
    [
      "flight_reservations",
      "pw_flight_score_reports",
      "pw_pilot_score_ledger",
      "pw_pilot_scores",
      "pw_scoring_rules",
      "acars_penalty_catalog",
    ].map((table) => countRows(table))
  );

  const rulesCount = tableCounts.find((item) => item.table === "pw_scoring_rules")?.count ?? 0;
  const penaltiesCount = tableCounts.find((item) => item.table === "acars_penalty_catalog")?.count ?? 0;

  checks.push({
    key: "db.reglaje_catalogs",
    state: rulesCount > 0 && penaltiesCount > 0 ? "READY" : "WARN",
    message:
      rulesCount > 0 && penaltiesCount > 0
        ? "Reglaje base disponible en Supabase."
        : "Faltan reglas o penalizaciones base para scoring oficial.",
    detail: { rulesCount, penaltiesCount },
  });

  const lastSummary = asObject(recentSummaries[0]);
  const lastPayload = asObject(lastSummary.payload);
  const lastHasC0C8 = lastPayload.c0c8Detected === true;

  checks.push({
    key: "c0_c8.last_closeout_detection",
    state: recentSummaries.length === 0 ? "WARN" : lastHasC0C8 ? "READY" : "WARN",
    message:
      recentSummaries.length === 0
        ? "Sin cierres recientes para verificar C0-C8."
        : lastHasC0C8
          ? "El último cierre contiene evidencia C0-C8 o XML compatible."
          : "El último cierre no contiene todavía evidencia C0-C8; normal si aún no se probó ACARS local C0-C8.",
    detail: { lastCloseout: recentSummaries[0] ?? null },
  });

  const response = {
    success: globalState(checks) !== "BLOCK",
    readiness: globalState(checks),
    generatedAt: new Date().toISOString(),
    mode: "web_D8_acars_c0_c8_readiness",
    checks,
    tableCounts,
    recentCloseouts: recentSummaries,
    nextSteps: [
      "Mantener phaseScoreEligible=false hasta prueba real en simulador.",
      "Validar ACARS C0-C8 con XML real antes de activar score por fases.",
      "Confirmar que XPDR/Doors/Gear unsupported queden N/D y no penalizables.",
      "Auditar pw_pilot_score_ledger y pw_pilot_scores después de un cierre scored.",
    ],
    dbError: dbError || null,
  };

  return NextResponse.json(response, { status: response.success ? 200 : 503 });
}
