import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildSimbriefApiLoaderUrl,
  buildSimbriefDispatchPrefillUrl,
  buildSimbriefEditUrl,
  buildSimbriefFetchUrl,
  buildStaticId,
  normalizeSimbriefFlightNumber,
  isUsableSimbriefApiKey,
  resolveSimbriefGenerationMode,
  resolveSimbriefType,
  type SimbriefDispatchPayload,
  type SimbriefDispatchResponse,
} from "@/lib/simbrief";

function cleanBaseUrl(value: string | undefined | null) {
  const trimmed = value?.trim().replace(/\/+$/, "") ?? "";
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return null;
  }
}

function resolveReturnBaseUrl(request: NextRequest) {
  return (
    cleanBaseUrl(process.env.SIMBRIEF_RETURN_BASE_URL) ??
    cleanBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    request.nextUrl.origin
  );
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SIMBRIEF_API_KEY?.trim();
    const requestedMode = resolveSimbriefGenerationMode(process.env.SIMBRIEF_GENERATION_MODE);
    const canUseApiLoader = requestedMode === "api" && isUsableSimbriefApiKey(apiKey);

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
    const returnBaseUrl = resolveReturnBaseUrl(request);
    const outputpage = `${returnBaseUrl}/api/simbrief/return?tab=dispatch&static_id=${encodeURIComponent(
      staticId
    )}&username=${encodeURIComponent(payload.simbriefUsername)}`;

    const normalizedPayload: SimbriefDispatchPayload = {
      userId: payload.userId,
      reservationId: payload.reservationId ?? null,
      callsign: payload.callsign ?? "PWG000",
      simbriefUsername: payload.simbriefUsername,
      firstName: payload.firstName ?? null,
      lastName: payload.lastName ?? null,
      flightNumber: normalizeSimbriefFlightNumber(payload.flightNumber ?? "1000"),
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
    };

    const apicode = canUseApiLoader
      ? createHash("md5")
          .update(
            `${apiKey}${payload.origin.toUpperCase()}${payload.destination.toUpperCase()}${type}${timestamp}${outputpage}`
          )
          .digest("hex")
      : null;

    const generateUrl = canUseApiLoader
      ? buildSimbriefApiLoaderUrl({
          origin: payload.origin,
          destination: payload.destination,
          type,
          timestamp,
          outputpage,
          apicode: apicode ?? "",
          payload: normalizedPayload,
          staticId,
        })
      : buildSimbriefDispatchPrefillUrl({
          origin: payload.origin,
          destination: payload.destination,
          type,
          payload: normalizedPayload,
          staticId,
        });

    const result: SimbriefDispatchResponse = {
      ok: true,
      staticId,
      type,
      timestamp,
      mode: canUseApiLoader ? "api" : "redirect",
      generateUrl,
      outputpage,
      fetchUrl: buildSimbriefFetchUrl(payload.simbriefUsername, staticId),
      editUrl: buildSimbriefEditUrl(staticId),
      generated: false,
      popupRequired: canUseApiLoader,
      warning: canUseApiLoader
        ? "Se abrirá una ventana pequeña de SimBrief para generar el OFP. Al terminar, volverá automáticamente a Patagonia Wings."
        : "Modo seguro sin API key: se abrirá SimBrief prellenado. Para generación API con retorno automático, configura SIMBRIEF_GENERATION_MODE=api y una SIMBRIEF_API_KEY válida.",
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