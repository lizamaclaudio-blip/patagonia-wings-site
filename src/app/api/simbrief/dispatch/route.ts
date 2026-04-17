import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildSimbriefEditUrl,
  buildSimbriefFetchUrl,
  buildSimbriefRedirectUrl,
  buildStaticId,
  resolveSimbriefType,
  type SimbriefDispatchPayload,
  type SimbriefDispatchResponse,
} from "@/lib/simbrief";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SIMBRIEF_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta SIMBRIEF_API_KEY en variables de entorno." },
        { status: 500 }
      );
    }

    const payload = (await request.json()) as Partial<SimbriefDispatchPayload>;

    if (!payload?.userId || !payload?.simbriefUsername) {
      return NextResponse.json(
        { error: "Faltan datos del piloto para generar el despacho." },
        { status: 400 }
      );
    }

    if (!payload.origin || !payload.destination || !payload.aircraftCode) {
      return NextResponse.json(
        { error: "Faltan origen, destino o aeronave para despachar." },
        { status: 400 }
      );
    }

    const staticId = buildStaticId({
      userId: payload.userId,
      reservationId: payload.reservationId ?? null,
      flightNumber: payload.flightNumber ?? "PWG",
      origin: payload.origin,
      destination: payload.destination,
    });

    const type = resolveSimbriefType(payload.aircraftCode);
    const timestamp = Math.floor(Date.now() / 1000);
    const outputpage = `${request.nextUrl.origin}/dashboard?tab=dispatch&simbrief_return=1&static_id=${encodeURIComponent(
      staticId
    )}&username=${encodeURIComponent(payload.simbriefUsername)}`;

    const apicode = createHash("md5")
      .update(
        `${apiKey}${payload.origin.toUpperCase()}${payload.destination.toUpperCase()}${type}${timestamp}${outputpage}`
      )
      .digest("hex");

    const generateUrl = buildSimbriefRedirectUrl({
      origin: payload.origin,
      destination: payload.destination,
      type,
      timestamp,
      outputpage,
      apicode,
      payload: {
        userId: payload.userId,
        reservationId: payload.reservationId ?? null,
        callsign: payload.callsign ?? "PWG000",
        simbriefUsername: payload.simbriefUsername,
        firstName: payload.firstName ?? null,
        lastName: payload.lastName ?? null,
        flightNumber: payload.flightNumber ?? "1000",
        origin: payload.origin,
        destination: payload.destination,
        alternate: payload.alternate ?? null,
        aircraftCode: payload.aircraftCode,
        aircraftTailNumber: payload.aircraftTailNumber ?? null,
        routeText: payload.routeText ?? "",
        scheduledDeparture: payload.scheduledDeparture ?? new Date().toISOString(),
        eteMinutes: payload.eteMinutes ?? 60,
        pax: payload.pax ?? 0,
        cargoKg: payload.cargoKg ?? 0,
        remarks: payload.remarks ?? "PATAGONIA WINGS WEB DISPATCH",
      },
      staticId,
    });

    const result: SimbriefDispatchResponse = {
      ok: true,
      staticId,
      type,
      timestamp,
      generateUrl,
      outputpage,
      fetchUrl: buildSimbriefFetchUrl(payload.simbriefUsername, staticId),
      editUrl: buildSimbriefEditUrl(staticId),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo construir la URL real de SimBrief.",
      },
      { status: 500 }
    );
  }
}
