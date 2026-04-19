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
      flight?: { reservationId?: string | null; flightNumber?: string | null; departureIcao?: string | null; arrivalIcao?: string | null; aircraftId?: string | null };
      preparedDispatch?: { reservationId?: string | null; dispatchId?: string | null; departureIcao?: string | null; arrivalIcao?: string | null };
    };

    const reservationId =
      payload.flight?.reservationId?.trim() ||
      payload.preparedDispatch?.reservationId?.trim() ||
      "";

    if (!reservationId) {
      return NextResponse.json({ error: "Falta reservationId para iniciar ACARS." }, { status: 400 });
    }

    const context = await loadReservationContext(accessToken, reservationId);
    const routeMismatch =
      ((context.reservation.origin_ident as string | undefined)?.toUpperCase() ?? "") !==
        (payload.flight?.departureIcao?.trim().toUpperCase() ?? payload.preparedDispatch?.departureIcao?.trim().toUpperCase() ?? "") ||
      ((context.reservation.destination_ident as string | undefined)?.toUpperCase() ?? "") !==
        (payload.flight?.arrivalIcao?.trim().toUpperCase() ?? payload.preparedDispatch?.arrivalIcao?.trim().toUpperCase() ?? "");

    if (routeMismatch) {
      return NextResponse.json(
        { error: "El despacho oficial no coincide con origen/destino del cliente ACARS." },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    const nextPayload = {
      ...(context.reservation.score_payload && typeof context.reservation.score_payload === "object"
        ? (context.reservation.score_payload as Record<string, unknown>)
        : {}),
      acars_session: {
        started_at: nowIso,
        source: "web_server_authoritative",
        dispatch_package_id: payload.preparedDispatch?.dispatchId ?? null,
        flight_number: payload.flight?.flightNumber ?? null,
      },
      scoring_status: "pending_server_closeout",
    };

    const { data, error } = await context.supabase
      .from("flight_reservations")
      .update({
        status: "in_progress",
        score_payload: nextPayload,
        updated_at: nowIso,
      })
      .eq("id", reservationId)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "No se pudo marcar in_progress oficialmente." },
        { status: 500 }
      );
    }

    await context.supabase
      .from("dispatch_packages")
      .update({
        dispatch_status: "released",
        updated_at: nowIso,
      })
      .eq("reservation_id", reservationId);

    return NextResponse.json({
      ok: true,
      reservationId,
      status: "in_progress",
      serverAuthoritative: true,
      reservation: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar el vuelo oficial." },
      { status: 500 }
    );
  }
}
