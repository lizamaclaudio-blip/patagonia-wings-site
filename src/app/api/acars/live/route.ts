import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

type GenericObject = Record<string, unknown>;

function asObject(value: unknown): GenericObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as GenericObject) : {};
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value).trim();
}

function appendLiveSample(existingPayload: GenericObject, telemetry: GenericObject, nowIso: string) {
  const existingLive = asObject(existingPayload.acars_live);
  const existingTail = Array.isArray(existingLive.samples_tail) ? existingLive.samples_tail : [];
  const previousCount = typeof existingLive.sample_count === "number" ? existingLive.sample_count : existingTail.length;
  const sample = {
    ...telemetry,
    received_at: nowIso,
  };

  return {
    sample,
    samplesTail: [...existingTail.slice(-29), sample],
    sampleCount: previousCount + 1,
    firstSampleAt: asText(existingLive.first_sample_at) || nowIso,
  };
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
      .select("*")
      .eq("id", reservationId)
      .maybeSingle();

    if (error || !reservation) {
      return NextResponse.json({ error: error?.message ?? "Reserva no encontrada." }, { status: 404 });
    }

    const row = reservation as GenericObject;
    const scorePayload = asObject(row.score_payload);
    const acarsLive = scorePayload.acars_live ? asObject(scorePayload.acars_live) : null;

    return NextResponse.json({
      ok: true,
      reservationId,
      status: row.status ?? null,
      updatedAt: row.updated_at ?? null,
      flightNumber: row.flight_number ?? row.route_code ?? null,
      origin: row.origin_icao ?? row.departure_icao ?? row.origin_ident ?? row.origin ?? null,
      destination: row.destination_icao ?? row.arrival_icao ?? row.destination_ident ?? row.destination ?? null,
      aircraftRegistration: row.aircraft_registration ?? row.tail_number ?? row.registration ?? null,
      aircraftType: row.aircraft_type_code ?? row.aircraft_type ?? row.equipment ?? null,
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
      .select("*")
      .eq("id", reservationId)
      .maybeSingle();

    if (readError || !reservation) {
      return NextResponse.json({ error: readError?.message ?? "Reserva no encontrada." }, { status: 404 });
    }

    const row = reservation as GenericObject;
    const existingPayload = asObject(row.score_payload);
    const telemetry = asObject(payload.telemetry);
    const nowIso = new Date().toISOString();
    const liveSample = appendLiveSample(existingPayload, telemetry, nowIso);

    const livePayload = {
      ...existingPayload,
      acars_live: {
        ...asObject(existingPayload.acars_live),
        received_at: nowIso,
        phase: payload.phase ?? "unknown",
        last_sample: telemetry,
        samples_tail: liveSample.samplesTail,
        sample_count: liveSample.sampleCount,
        first_sample_at: liveSample.firstSampleAt,
        last_sample_at: nowIso,
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

    return NextResponse.json({ ok: true, reservationId, receivedAt: nowIso, sampleCount: liveSample.sampleCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al guardar telemetria en vivo." },
      { status: 500 }
    );
  }
}
