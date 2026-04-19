import { NextRequest, NextResponse } from "next/server";
import { loadReservationContext } from "@/lib/acars-official";

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
      phase?: string | null;
      telemetry?: Record<string, unknown> | null;
    };

    const reservationId = payload.reservationId?.trim() ?? "";
    if (!reservationId) {
      return NextResponse.json({ error: "Falta reservationId para telemetría." }, { status: 400 });
    }

    const context = await loadReservationContext(accessToken, reservationId);
    const existingPayload =
      context.reservation.score_payload && typeof context.reservation.score_payload === "object"
        ? (context.reservation.score_payload as Record<string, unknown>)
        : {};
    const telemetry = payload.telemetry ?? {};
    const nowIso = new Date().toISOString();

    const livePayload = {
      ...existingPayload,
      acars_live: {
        received_at: nowIso,
        phase: payload.phase ?? "unknown",
        last_sample: telemetry,
      },
    };

    const { error } = await context.supabase
      .from("flight_reservations")
      .update({
        status: "in_progress",
        score_payload: livePayload,
        updated_at: nowIso,
      })
      .eq("id", reservationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      reservationId,
      status: "in_progress",
      phase: payload.phase ?? "unknown",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar telemetría." },
      { status: 500 }
    );
  }
}
