import { NextRequest, NextResponse } from "next/server";
import {
  loadReservationContext,
  persistOfficialCloseout,
  type AcarsFlightInput,
  type AcarsReportInput,
  type AcarsTelemetrySample,
  type AircraftDamageEventInput,
  type AcarsCloseoutPayloadInput,
  type PreparedDispatchInput,
} from "@/lib/acars-official";
import { getSayIntentionsServerConfig, writeSayIntentionsLog } from "@/lib/sayintentions";

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("Falta Authorization Bearer.");
  }
  return authorization.slice(7).trim();
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    const payload = (await request.json()) as {
      report?: AcarsReportInput | null;
      activeFlight?: AcarsFlightInput | null;
      preparedDispatch?: PreparedDispatchInput | null;
      telemetryLog?: AcarsTelemetrySample[] | null;
      lastSimData?: AcarsTelemetrySample | null;
      damageEvents?: AircraftDamageEventInput[] | null;
      closeoutPayload?: AcarsCloseoutPayloadInput | null;
    };

    const reservationId =
      payload.report?.reservationId?.trim() ||
      payload.activeFlight?.reservationId?.trim() ||
      payload.preparedDispatch?.reservationId?.trim() ||
      "";

    if (!reservationId) {
      return NextResponse.json({ error: "Falta reservationId para finalize." }, { status: 400 });
    }

    const context = await loadReservationContext(accessToken, reservationId);
    let fallbackWarnings: string[] = [];
    const result = await (async () => {
      try {
        return await persistOfficialCloseout({
          accessToken,
          user: context.user,
          profile: context.profile,
          reservation: context.reservation,
          dispatchPackage: context.dispatchPackage,
          aircraft: context.aircraft,
          aircraftCondition: context.aircraftCondition,
          activeFlight: payload.activeFlight ?? null,
          preparedDispatch: payload.preparedDispatch ?? null,
          report: payload.report ?? null,
          telemetryLog: payload.telemetryLog ?? [],
          lastSimData: payload.lastSimData ?? null,
          damageEvents: payload.damageEvents ?? [],
          closeoutPayload: payload.closeoutPayload ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "finalize_failed";
        if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
          fallbackWarnings = ["degraded_finalize_missing_service_role_key"];
          const closeoutStatus = payload.report?.remarks?.toLowerCase().includes("closeout:crashed") ? "crashed" : "manual_review";
          const now = new Date().toISOString();
          const supabase = context.supabase;
          await supabase
            .from("flight_reservations")
            .update({
              status: closeoutStatus,
              scoring_status: "pending_server_closeout",
              completed_at: now,
              updated_at: now,
            })
            .eq("id", reservationId);

          await supabase
            .from("dispatch_packages")
            .update({
              dispatch_status: closeoutStatus,
              updated_at: now,
            })
            .eq("reservation_id", reservationId);

          return {
            official: {
              finalStatus: closeoutStatus,
              procedureScore: 0,
              missionScore: 0,
              safetyScore: 0,
              efficiencyScore: 0,
              finalScore: 0,
              scoringStatus: "pending_server_closeout",
            },
            evaluationStatus: "no_evaluable",
            economyEligible: false,
            salaryAccrued: false,
            ledgerWritten: false,
            warnings: ["degraded_finalize_missing_service_role_key", "closeout_not_evaluable"],
            resultUrl: `/flights/${reservationId}`,
            reservation: {
              ...(context.reservation ?? {}),
              status: closeoutStatus,
              id: reservationId,
            },
          } as const;
        }

        throw error;
      }
    })();

    const sayIntentionsConfig = getSayIntentionsServerConfig();
    if (sayIntentionsConfig.enabled && sayIntentionsConfig.vaApiKeyPresent) {
      const endpoint = `${sayIntentionsConfig.baseUrl}/getCommsHistory`;
      const commsResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: sayIntentionsConfig.vaApiKey,
          reservation_id: reservationId,
          flight_number: payload.activeFlight?.flightNumber ?? payload.report?.flightNumber ?? null,
          dep: payload.activeFlight?.departureIcao ?? payload.preparedDispatch?.departureIcao ?? payload.report?.departureIcao ?? null,
          arr: payload.activeFlight?.arrivalIcao ?? payload.preparedDispatch?.arrivalIcao ?? payload.report?.arrivalIcao ?? null,
        }),
        cache: "no-store",
      }).catch(() => null);

      await writeSayIntentionsLog({
        reservation_id: reservationId,
        pilot_id: context.user.id,
        sync_type: "getCommsHistory",
        status: commsResponse?.ok ? "completed" : "warning",
        source: "acars_finalize",
        response_payload: commsResponse ? await commsResponse.json().catch(() => null) : null,
        error_message: commsResponse?.ok ? null : "comms_history_unavailable",
        created_at: new Date().toISOString(),
      });
    }

    const requestOrigin = request.nextUrl.origin || "";
    const origin = requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1")
      ? "https://www.patagoniaw.com"
      : (requestOrigin || "https://www.patagoniaw.com");

    const { data: reservationCheck, error: reservationCheckError } = await context.supabase
      .from("flight_reservations")
      .select("id,status")
      .eq("id", reservationId)
      .maybeSingle();

    const persisted = !reservationCheckError && Boolean(reservationCheck?.id);
    const normalizedStatus = String(reservationCheck?.status ?? "").trim().toLowerCase();
    const activeStatuses = new Set(["reserved", "in_progress", "in_flight", "dispatched", "dispatch_ready"]);
    const reservationClosed = persisted && !activeStatuses.has(normalizedStatus);
    const summaryPath = result.resultUrl || `/flights/${reservationId}`;
    const summaryUrl = summaryPath.startsWith("http://") || summaryPath.startsWith("https://")
      ? summaryPath
      : `${origin}${summaryPath.startsWith("/") ? "" : "/"}${summaryPath}`;
    const summaryUrlValid = /^https?:\/\//i.test(summaryUrl);

    if (!persisted || !reservationClosed || !summaryUrlValid) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          persisted,
          reservationClosed,
          reservationId,
          status: normalizedStatus || result.official.finalStatus,
          summaryUrl: summaryUrlValid ? summaryUrl : null,
          resultStatus: normalizedStatus || result.official.finalStatus,
          evaluationStatus: result.evaluationStatus ?? "no_evaluable",
          economyEligible: result.economyEligible ?? false,
          salaryAccrued: result.salaryAccrued ?? false,
          ledgerWritten: result.ledgerWritten ?? false,
          warnings: [
            ...fallbackWarnings,
            ...(result.warnings ?? []),
            !persisted ? "reservation_not_persisted" : null,
            !reservationClosed ? "reservation_not_closed" : null,
            !summaryUrlValid ? "summary_url_invalid" : null,
          ].filter(Boolean),
          error: !reservationClosed ? "reservation_not_closed" : "finalize_not_confirmed",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      reservationClosed,
      persisted,
      reservationId,
      status: normalizedStatus || result.official.finalStatus,
      summaryUrl,
      resultStatus: normalizedStatus || result.official.finalStatus,
      evaluationStatus: result.evaluationStatus ?? "evaluable",
      economyEligible: result.economyEligible ?? false,
      salaryAccrued: result.salaryAccrued ?? false,
      ledgerWritten: result.ledgerWritten ?? false,
      resultUrl: summaryUrl,
      warnings: [...fallbackWarnings, ...(result.warnings ?? [])],
      officialScores: {
        procedure_score: result.official.procedureScore,
        mission_score: result.official.missionScore,
        safety_score: result.official.safetyScore,
        efficiency_score: result.official.efficiencyScore,
        final_score: result.official.finalScore,
        scoring_status: result.official.scoringStatus,
      },
      reservation: result.reservation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cerrar el vuelo oficialmente.";
    return NextResponse.json(
      {
        success: false,
        reservationClosed: false,
        error: message === "reservation_not_closed" ? "reservation_not_closed" : message,
      },
      { status: 500 }
    );
  }
}
