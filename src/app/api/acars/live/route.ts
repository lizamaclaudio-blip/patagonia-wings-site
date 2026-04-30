import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const reservationId = searchParams.get("reservationId")?.trim() ?? "";
    const accessToken = getBearerToken(request);

    if (!reservationId) {
      return NextResponse.json({ error: "Falta reservationId." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(accessToken ?? undefined);

    const { data: reservation, error } = await supabase
      .from("flight_reservations")
      .select(
        "id, status, score_payload, updated_at, pilot_id, flight_number, origin_icao, destination_icao, aircraft_registration, aircraft_type_code"
      )
      .eq("id", reservationId)
      .maybeSingle();

    if (error || !reservation) {
      return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
    }

    const scorePayload =
      reservation.score_payload && typeof reservation.score_payload === "object"
        ? (reservation.score_payload as Record<string, unknown>)
        : {};

    const acarsLive = scorePayload.acars_live
      ? (scorePayload.acars_live as Record<string, unknown>)
      : null;

    return NextResponse.json({
      ok: true,
      reservationId,
      status: reservation.status,
      updatedAt: reservation.updated_at,
      flightNumber: reservation.flight_number,
      origin: reservation.origin_icao,
      destination: reservation.destination_icao,
      aircraftRegistration: reservation.aircraft_registration,
      aircraftType: reservation.aircraft_type_code,
      acarsLive,
      hasLiveData: acarsLive !== null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al obtener log en vivo." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Falta Authorization Bearer." }, { status: 401 });
    }

    const payload = (await request.json()) as {
      reservationId?: string | null;
      phase?: string | null;
      telemetry?: Record<string, unknown> | null;
      events?: unknown[] | null;
      elapsedSeconds?: number | null;
      airborneSeconds?: number | null;
      warnings?: string[] | null;
    };

    const reservationId = payload.reservationId?.trim() ?? "";
    if (!reservationId) {
      return NextResponse.json({ error: "Falta reservationId." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(accessToken);

    const { data: reservation, error: readError } = await supabase
      .from("flight_reservations")
      .select("id, pilot_id, score_payload, status")
      .eq("id", reservationId)
      .maybeSingle();

    if (readError || !reservation) {
      return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
    }

    const existingPayload =
      reservation.score_payload && typeof reservation.score_payload === "object"
        ? (reservation.score_payload as Record<string, unknown>)
        : {};

    const nowIso = new Date().toISOString();
    const livePayload = {
      ...existingPayload,
      acars_live: {
        received_at: nowIso,
        phase: payload.phase ?? "unknown",
        last_sample: payload.telemetry ?? {},
        events: payload.events ?? [],
        elapsed_seconds: payload.elapsedSeconds ?? null,
        airborne_seconds: payload.airborneSeconds ?? null,
        warnings: payload.warnings ?? [],
      },
    };

    const { error: updateError } = await supabase
      .from("flight_reservations")
      .update({
        score_payload: livePayload,
        updated_at: nowIso,
      })
      .eq("id", reservationId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reservationId, receivedAt: nowIso });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al guardar telemetria en vivo." },
      { status: 500 }
    );
  }
}
