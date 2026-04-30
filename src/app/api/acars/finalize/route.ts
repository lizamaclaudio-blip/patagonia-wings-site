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
    const result = await persistOfficialCloseout({
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
    const summaryPath = result.resultUrl || `/flights/${reservationId}`;
    const summaryUrl = summaryPath.startsWith("http://") || summaryPath.startsWith("https://")
      ? summaryPath
      : `${origin}${summaryPath.startsWith("/") ? "" : "/"}${summaryPath}`;

    return NextResponse.json({
      ok: true,
      success: true,
      reservationClosed: true,
      persisted: true,
      reservationId,
      status: result.official.finalStatus,
      summaryUrl,
      resultStatus: result.official.finalStatus,
      resultUrl: summaryUrl,
      warnings: [],
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
