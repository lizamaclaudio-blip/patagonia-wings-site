import { NextRequest, NextResponse } from "next/server";
import { loadReservationContext } from "@/lib/acars-official";

type GenericObject = Record<string, unknown>;

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("Falta Authorization Bearer.");
  }
  return authorization.slice(7).trim();
}

function asObject(value: unknown): GenericObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as GenericObject) : {};
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value).trim();
}

function appendTelemetrySample(existingPayload: GenericObject, telemetry: GenericObject, nowIso: string) {
  const existingLive = asObject(existingPayload.acars_live);
  const existingTail = Array.isArray(existingLive.samples_tail) ? existingLive.samples_tail : [];
  const previousCount = typeof existingLive.sample_count === "number" ? existingLive.sample_count : existingTail.length;
  const sample = {
    ...telemetry,
    received_at: nowIso,
  };

  return {
    samplesTail: [...existingTail.slice(-29), sample],
    sampleCount: previousCount + 1,
    firstSampleAt: asText(existingLive.first_sample_at) || nowIso,
  };
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
    const existingPayload = asObject(context.reservation.score_payload);
    const telemetry = asObject(payload.telemetry);
    const nowIso = new Date().toISOString();
    const sampleState = appendTelemetrySample(existingPayload, telemetry, nowIso);

    const livePayload = {
      ...existingPayload,
      acars_live: {
        ...asObject(existingPayload.acars_live),
        received_at: nowIso,
        phase: payload.phase ?? "unknown",
        last_sample: telemetry,
        samples_tail: sampleState.samplesTail,
        sample_count: sampleState.sampleCount,
        first_sample_at: sampleState.firstSampleAt,
        last_sample_at: nowIso,
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
      sampleCount: sampleState.sampleCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar telemetría." },
      { status: 500 }
    );
  }
}
