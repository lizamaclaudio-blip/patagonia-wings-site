import { NextRequest, NextResponse } from "next/server";
import { loadReservationContext, persistOfficialCloseout, type AcarsTelemetrySample } from "@/lib/acars-official";

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
      reservationId?: string | null;
      closeoutStatus?: string | null;
      telemetry?: AcarsTelemetrySample | null;
    };
    const reservationId = payload.reservationId?.trim() ?? "";

    if (!reservationId) {
      return NextResponse.json({ error: "Falta reservationId para closeout." }, { status: 400 });
    }

    const context = await loadReservationContext(accessToken, reservationId);
    const synthesizedTelemetry = payload.telemetry ? [payload.telemetry] : [];
    const syntheticDamageEvents =
      (payload.closeoutStatus ?? "").trim().toLowerCase() === "crashed"
        ? [
            {
              reservationId,
              aircraftId: context.reservation.aircraft_id as string | undefined,
              eventCode: "ACARS_CLOSEOUT_CRASH",
              phase: "closeout",
              severity: "critical",
              details: { source: "closeout_route" },
              capturedAtUtc: new Date().toISOString(),
            },
          ]
        : [];

    const result = await persistOfficialCloseout({
      accessToken,
      user: context.user,
      profile: context.profile,
      reservation: context.reservation,
      dispatchPackage: context.dispatchPackage,
      aircraft: context.aircraft,
      aircraftCondition: context.aircraftCondition,
      telemetryLog: synthesizedTelemetry,
      lastSimData: payload.telemetry ?? null,
      report: {
        reservationId,
        departureIcao: context.reservation.origin_ident as string | undefined,
        arrivalIcao: context.reservation.destination_ident as string | undefined,
        remarks: `closeout:${payload.closeoutStatus ?? "interrupted"}`,
      },
      damageEvents: syntheticDamageEvents,
    });

    return NextResponse.json({
      ok: true,
      reservationId,
      resultStatus: result.official.finalStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar el closeout oficial." },
      { status: 500 }
    );
  }
}
