import type { SupabaseClient, User } from "@supabase/supabase-js";
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

const DELETABLE_STATUSES = new Set([
  "reserved",
  "dispatch_ready",
  "dispatched",
  "in_progress",
  "in_flight",
  "active",
  "confirmed",
  "booked",
  "ready",
  "cancelled",
]);

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBearerToken(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function isPermissionError(error: unknown) {
  const payload = (error ?? {}) as Record<string, unknown>;
  const code = asText(payload.code).toUpperCase();
  const message = `${asText(payload.message)} ${asText(payload.details)} ${asText(payload.hint)}`.toLowerCase();
  return code === "42501" || message.includes("permission denied") || message.includes("rls");
}

function isIgnorableDeleteError(error: unknown) {
  if (isPermissionError(error)) return true;
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

function normalizeCallsignFromUser(user: User) {
  const candidates = [
    asText(user.user_metadata?.callsign),
    asText(user.user_metadata?.pilot_callsign),
    asText(user.app_metadata?.callsign),
  ];
  for (const candidate of candidates) {
    if (candidate) return candidate.toUpperCase();
  }
  return "";
}

function canUserCancelReservation(
  user: User,
  reservation: Record<string, unknown>,
  callsignHint: string
) {
  const rowPilotId = asText(reservation.pilot_id);
  const rowCallsign = asText(reservation.pilot_callsign).toUpperCase();
  const userCallsign = normalizeCallsignFromUser(user);
  return (
    (rowPilotId && rowPilotId === user.id) ||
    (callsignHint && rowCallsign === callsignHint) ||
    (userCallsign && rowCallsign === userCallsign)
  );
}

function tryCreateSupabaseAdminClient() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

async function safeDeleteByField(
  client: SupabaseClient,
  table: string,
  field: string,
  value: string
) {
  const { error } = await client.from(table).delete().eq(field, value);
  if (error && !isIgnorableDeleteError(error)) {
    throw new Error(`[${table}] ${error.message}`);
  }
}

async function releaseAircraft(
  writer: SupabaseClient,
  fallback: SupabaseClient | null,
  aircraftId: string,
  nowIso: string
) {
  if (!aircraftId) return;
  const { error } = await writer
    .from("aircraft")
    .update({ status: "available", updated_at: nowIso })
    .eq("id", aircraftId);

  if (error && fallback) {
    await fallback
      .from("aircraft")
      .update({ status: "available", updated_at: nowIso })
      .eq("id", aircraftId);
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

    const ownerClient = createSupabaseServerClient(accessToken);
    const adminClient = tryCreateSupabaseAdminClient();
    const writer = adminClient ?? ownerClient;
    const reservationCallsignHint = asText(body?.pilotCallsign).toUpperCase();

    let reservation: Record<string, unknown> | null = null;

    const { data: ownerReservation } = await ownerClient
      .from("flight_reservations")
      .select("id,pilot_id,pilot_callsign,status,aircraft_id")
      .eq("id", reservationId)
      .maybeSingle();

    if (ownerReservation) {
      reservation = ownerReservation as Record<string, unknown>;
    }

    if (!reservation && adminClient) {
      const { data: adminReservation } = await adminClient
        .from("flight_reservations")
        .select("id,pilot_id,pilot_callsign,status,aircraft_id")
        .eq("id", reservationId)
        .maybeSingle();
      if (adminReservation) {
        reservation = adminReservation as Record<string, unknown>;
      }
    }

    if (!reservation) {
      return NextResponse.json({ error: "No se encontro la reserva activa." }, { status: 404 });
    }

    if (!canUserCancelReservation(user, reservation, reservationCallsignHint)) {
      return NextResponse.json({ error: "No autorizado para cancelar esta reserva." }, { status: 403 });
    }

    const status = asText(reservation.status).toLowerCase();
    if (!DELETABLE_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `La reserva esta en estado "${status}" y no se puede eliminar por este flujo.` },
        { status: 409 }
      );
    }

    const aircraftId = asText(reservation.aircraft_id);
    const rowCallsign = asText(reservation.pilot_callsign).toUpperCase();
    const nowIso = new Date().toISOString();

    if (adminClient) {
      const children: Array<[string, string]> = [
        ["dispatch_packages", "reservation_id"],
        ["flight_economy_snapshots", "reservation_id"],
        ["airline_ledger", "reservation_id"],
        ["aircraft_damage_events", "reservation_id"],
        ["flight_reservation_audit", "reservation_id"],
        ["pw_flight_score_reports", "reservation_id"],
        ["pw_pilot_score_ledger", "reservation_id"],
        ["pw_pilot_scores", "reservation_id"],
        ["acars_test_evaluations", "reservation_id"],
        ["pirep_reports", "reservation_id"],
        ["pirep_reports", "reference_code"],
      ];
      for (const [table, field] of children) {
        await safeDeleteByField(adminClient, table, field, reservationId);
      }
    }

    const { error: deleteReservationError } = await writer
      .from("flight_reservations")
      .delete()
      .eq("id", reservationId);

    if (deleteReservationError) {
      const fallbackPayload: Record<string, unknown> = {
        status: "cancelled",
        cancelled_at: nowIso,
        cancelled_reason: "manual_cancel_delete_fallback",
        updated_at: nowIso,
        pilot_callsign: null,
      };

      let { error: cancelFallbackError } = await writer
        .from("flight_reservations")
        .update(fallbackPayload)
        .eq("id", reservationId);

      if (cancelFallbackError && asText(cancelFallbackError.code) === "23502") {
        const fallbackCallsign = rowCallsign || reservationCallsignHint || normalizeCallsignFromUser(user) || "PILOT";
        const escapedFallback = `${fallbackCallsign}-CXL-${reservationId.slice(0, 8)}`.slice(0, 40);
        ({ error: cancelFallbackError } = await writer
          .from("flight_reservations")
          .update({
            status: "cancelled",
            cancelled_at: nowIso,
            cancelled_reason: "manual_cancel_delete_fallback",
            updated_at: nowIso,
            pilot_callsign: escapedFallback,
          })
          .eq("id", reservationId));
      }

      if (cancelFallbackError) {
        return NextResponse.json(
          {
            error: `No se pudo eliminar ni cancelar la reserva: ${deleteReservationError.message} | ${cancelFallbackError.message}`,
          },
          { status: 500 }
        );
      }

      await releaseAircraft(writer, adminClient, aircraftId, nowIso);

      return NextResponse.json({
        ok: true,
        deleted: false,
        cancelled: true,
        reservationId,
        warning: deleteReservationError.message,
      });
    }

    await releaseAircraft(writer, adminClient, aircraftId, nowIso);

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
