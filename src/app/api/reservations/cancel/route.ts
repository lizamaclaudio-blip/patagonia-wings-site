import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getUserFromAccessToken,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CancelReservationRequest = {
  reservationId?: string | null;
  pilotCallsign?: string | null;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBearerToken(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function isIgnorableDeleteError(error: unknown) {
  const payload = (error ?? {}) as Record<string, unknown>;
  const code = asText(payload.code).toUpperCase();
  const message = `${asText(payload.message)} ${asText(payload.details)} ${asText(payload.hint)}`.toLowerCase();
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    code === "42703" ||
    message.includes("relation") ||
    message.includes("column") ||
    message.includes("schema cache")
  );
}

async function safeDeleteByField(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  field: string,
  value: string
) {
  const { error } = await admin.from(table).delete().eq(field, value);
  if (error && !isIgnorableDeleteError(error)) {
    throw new Error(`[${table}] ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const user = await getUserFromAccessToken(accessToken);
    const body = (await request.json().catch(() => null)) as CancelReservationRequest | null;
    const reservationId = asText(body?.reservationId);
    if (!reservationId) {
      return NextResponse.json({ error: "Falta reservationId para cancelar." }, { status: 400 });
    }

    const userSupabase = createSupabaseServerClient(accessToken);
    const reservationCallsignHint = asText(body?.pilotCallsign).toUpperCase();
    const reservationQuery = userSupabase
      .from("flight_reservations")
      .select("id,pilot_id,pilot_callsign,status,aircraft_id")
      .eq("id", reservationId);

    // Prefer exact callsign scope when provided by UI; if not found, fallback to plain id lookup.
    const { data: reservationScoped, error: reservationScopedError } =
      reservationCallsignHint
        ? await reservationQuery.eq("pilot_callsign", reservationCallsignHint).maybeSingle()
        : { data: null, error: null as unknown };

    const { data: reservationFallback, error: reservationFallbackError } =
      reservationScoped
        ? { data: reservationScoped, error: null as unknown }
        : await userSupabase
            .from("flight_reservations")
            .select("id,pilot_id,pilot_callsign,status,aircraft_id")
            .eq("id", reservationId)
            .maybeSingle();

    const reservation = reservationScoped ?? reservationFallback;
    const reservationError = reservationScopedError ?? reservationFallbackError;
    const reservationErrorMessage =
      reservationError && typeof reservationError === "object"
        ? asText((reservationError as Record<string, unknown>).message)
        : "";

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: reservationErrorMessage || "No se encontro la reserva activa." },
        { status: 404 }
      );
    }

    const status = asText((reservation as Record<string, unknown>).status).toLowerCase();
    const deletableStatuses = new Set([
      "reserved",
      "dispatch_ready",
      "dispatched",
      "in_progress",
      "in_flight",
      "active",
      "confirmed",
      "booked",
      "ready",
    ]);

    if (!deletableStatuses.has(status)) {
      return NextResponse.json(
        { error: `La reserva estÃ¡ en estado "${status}" y no se puede eliminar por este flujo.` },
        { status: 409 }
      );
    }

    const aircraftId = asText((reservation as Record<string, unknown>).aircraft_id);
    const nowIso = new Date().toISOString();
    const admin = createSupabaseAdminClient();

    // Eliminar relaciones de forma tolerante para evitar bloqueos de FK en reservas activas.
    await safeDeleteByField(admin, "dispatch_packages", "reservation_id", reservationId);
    await safeDeleteByField(admin, "flight_economy_snapshots", "reservation_id", reservationId);
    await safeDeleteByField(admin, "airline_ledger", "reservation_id", reservationId);
    await safeDeleteByField(admin, "aircraft_damage_events", "reservation_id", reservationId);
    await safeDeleteByField(admin, "flight_reservation_audit", "reservation_id", reservationId);
    await safeDeleteByField(admin, "pw_flight_score_reports", "reservation_id", reservationId);
    await safeDeleteByField(admin, "pw_pilot_score_ledger", "reservation_id", reservationId);
    await safeDeleteByField(admin, "pw_pilot_scores", "reservation_id", reservationId);
    await safeDeleteByField(admin, "acars_test_evaluations", "reservation_id", reservationId);
    await safeDeleteByField(admin, "pirep_reports", "reservation_id", reservationId);
    await safeDeleteByField(admin, "pirep_reports", "reference_code", reservationId);

    const { error: deleteReservationError } = await admin
      .from("flight_reservations")
      .delete()
      .eq("id", reservationId);

    if (deleteReservationError) {
      // Fallback hardening: at least remove it from active flow if FK blocks physical delete.
      const { error: cancelFallbackError } = await admin
        .from("flight_reservations")
        .update({
          status: "cancelled",
          cancelled_at: nowIso,
          cancelled_reason: "manual_cancel_delete_fallback",
          updated_at: nowIso,
        })
        .eq("id", reservationId);

      if (cancelFallbackError) {
        return NextResponse.json(
          {
            error: `No se pudo eliminar ni cancelar la reserva: ${deleteReservationError.message} | ${cancelFallbackError.message}`,
          },
          { status: 500 }
        );
      }

      if (aircraftId) {
        await admin
          .from("aircraft")
          .update({ status: "available", updated_at: nowIso })
          .eq("id", aircraftId);
      }

      return NextResponse.json({
        ok: true,
        deleted: false,
        cancelled: true,
        reservationId,
        warning: deleteReservationError.message,
      });
    }

    if (aircraftId) {
      await admin
        .from("aircraft")
        .update({ status: "available", updated_at: nowIso })
        .eq("id", aircraftId);
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
      cancelled: true,
      reservationId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cancelar la reserva." },
      { status: 500 }
    );
  }
}
