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
  "manual_review",
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

async function tryResolveReservationByCallsign(
  client: SupabaseClient,
  callsign: string
) {
  const normalized = asText(callsign).toUpperCase();
  if (!normalized) return null;
  const { data } = await client
    .from("flight_reservations")
    .select("id,pilot_id,pilot_callsign,status,aircraft_id")
    .eq("pilot_callsign", normalized)
    .in("status", [...DELETABLE_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as Record<string, unknown> | null;
}

async function purgeByCallsign(
  admin: SupabaseClient,
  callsign: string,
) {
  const normalized = asText(callsign).toUpperCase();
  if (!normalized) return 0;
  const reservationIds = await listPilotActiveReservationIds(admin, "", normalized);
  let removed = 0;
  for (const id of reservationIds) {
    await purgeReservationArtifacts(admin, id);
    const { error } = await admin.from("flight_reservations").delete().eq("id", id);
    if (error && !isIgnorableDeleteError(error)) {
      throw new Error(`No se pudo eliminar reserva ${id}: ${error.message}`);
    }
    removed += 1;
  }
  const { error: orphanDispatchError } = await admin
    .from("dispatch_packages")
    .delete()
    .eq("pilot_callsign", normalized);
  if (orphanDispatchError && !isIgnorableDeleteError(orphanDispatchError)) {
    throw new Error(`No se pudieron limpiar dispatch packages del callsign: ${orphanDispatchError.message}`);
  }
  return removed;
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

const RESERVATION_CHILD_DELETE_TARGETS: Array<[string, string]> = [
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
  ["sayintentions_sync_log", "reservation_id"],
];

async function purgeReservationArtifacts(
  admin: SupabaseClient,
  reservationId: string,
) {
  for (const [table, field] of RESERVATION_CHILD_DELETE_TARGETS) {
    await safeDeleteByField(admin, table, field, reservationId);
  }
}

async function listPilotActiveReservationIds(
  admin: SupabaseClient,
  pilotId: string,
  pilotCallsign: string,
) {
  let query = admin
    .from("flight_reservations")
    .select("id,status")
    .in("status", [...DELETABLE_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(30);

  if (pilotId) {
    query = query.eq("pilot_id", pilotId);
  } else if (pilotCallsign) {
    query = query.eq("pilot_callsign", pilotCallsign);
  } else {
    return [] as string[];
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [] as string[];
  return data
    .map((row) => asText((row as Record<string, unknown>).id))
    .filter(Boolean);
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

    if (!reservation && reservationCallsignHint) {
      reservation =
        (await tryResolveReservationByCallsign(ownerClient, reservationCallsignHint)) ??
        (adminClient ? await tryResolveReservationByCallsign(adminClient, reservationCallsignHint) : null);
    }

    if (!reservation) {
      // Si viene callsign, purgar cualquier residuo activo ligado al piloto.
      if (adminClient && reservationCallsignHint) {
        const removed = await purgeByCallsign(adminClient, reservationCallsignHint);
        return NextResponse.json({
          ok: true,
          deleted: removed > 0,
          cancelled: true,
          reservationId: reservationId || null,
          warning: removed > 0 ? "PURGED_BY_CALLSIGN" : "NO_ACTIVE_RESERVATION",
        });
      }

      // Fallback sin admin: intenta RPC autenticado para cancelar activa por usuario.
      const { error: rpcCancelError } = await ownerClient.rpc("pw_cancel_active_reservation");
      if (rpcCancelError && !isIgnorableDeleteError(rpcCancelError)) {
        return NextResponse.json(
          { error: `No se encontró reserva por id y tampoco se pudo cancelar la activa: ${rpcCancelError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        deleted: false,
        cancelled: true,
        reservationId: reservationId || null,
        warning: "NO_ACTIVE_RESERVATION",
      });
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
    const pilotId = asText(reservation.pilot_id);
    const rowCallsign = asText(reservation.pilot_callsign).toUpperCase();
    const nowIso = new Date().toISOString();

    if (adminClient) {
      // Purga fuerte de esta reserva y cualquier reserva activa residual del mismo piloto.
      const activeReservationIds = await listPilotActiveReservationIds(adminClient, pilotId, rowCallsign);
      const reservationIds = Array.from(
        new Set([reservationId, ...activeReservationIds].filter(Boolean))
      );

      for (const id of reservationIds) {
        await purgeReservationArtifacts(adminClient, id);
      }

      for (const id of reservationIds) {
        const { error: hardDeleteError } = await adminClient
          .from("flight_reservations")
          .delete()
          .eq("id", id);

        if (hardDeleteError && !isIgnorableDeleteError(hardDeleteError)) {
          return NextResponse.json(
            { error: `No se pudo eliminar la reserva ${id}: ${hardDeleteError.message}` },
            { status: 500 }
          );
        }
      }

      if (rowCallsign) {
        // Limpia paquetes huérfanos ligados al callsign.
        const { error: orphanDispatchError } = await adminClient
          .from("dispatch_packages")
          .delete()
          .eq("pilot_callsign", rowCallsign);
        if (orphanDispatchError && !isIgnorableDeleteError(orphanDispatchError)) {
          return NextResponse.json(
            { error: `No se pudieron limpiar dispatch packages: ${orphanDispatchError.message}` },
            { status: 500 }
          );
        }
      }

      await releaseAircraft(adminClient, null, aircraftId, nowIso);

      return NextResponse.json({
        ok: true,
        deleted: true,
        cancelled: true,
        reservationId,
      });
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
