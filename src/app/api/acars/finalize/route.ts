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

    return NextResponse.json({
      ok: true,
      reservationId,
      resultStatus: result.official.finalStatus,
      resultUrl: result.resultUrl,
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cerrar el vuelo oficialmente." },
      { status: 500 }
    );
  }
}
