import { NextRequest, NextResponse } from "next/server";
import { getUserFromAccessToken } from "@/lib/supabase/server";
import { getSayIntentionsServerConfig, writeSayIntentionsLog } from "@/lib/sayintentions";

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
    const user = await getUserFromAccessToken(accessToken);
    const body = (await request.json()) as Record<string, unknown>;
    const reservationId = typeof body.reservationId === "string" ? body.reservationId : null;
    const config = getSayIntentionsServerConfig();

    if (!config.enabled || !config.vaApiKeyPresent) {
      await writeSayIntentionsLog({
        pilot_id: user.id,
        reservation_id: reservationId,
        sync_type: "importVAData",
        status: "skipped",
        source: "patagonia_web",
        error_message: "sayintentions_import_skipped_missing_server_config",
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({
        success: true,
        synced: false,
        reason: "sayintentions_import_skipped_missing_server_config",
      }, { status: 202 });
    }

    const payload = {
      va_api_key: process.env.SAYINTENTIONS_VA_API_KEY,
      crew_data: body.crew_data ?? {},
      dispatcher_data: body.dispatcher_data ?? {},
      copilot_data: body.copilot_data ?? {},
      skyops_data: body.skyops_data ?? {},
    };

    const response = await fetch(`${config.baseUrl}/importVAData`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const responsePayload = await response.json().catch(() => null);
    await writeSayIntentionsLog({
      pilot_id: user.id,
      reservation_id: reservationId,
      sync_type: "importVAData",
      status: response.ok ? "completed" : "error",
      source: "patagonia_web",
      request_payload: {
        reservationId,
        hasCrewData: Boolean(body.crew_data),
        hasDispatcherData: Boolean(body.dispatcher_data),
      },
      response_payload: responsePayload,
      error_message: response.ok ? null : `http_${response.status}`,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: response.ok,
      synced: response.ok,
      status: response.status,
      warnings: response.ok ? [] : ["sayintentions_import_failed"],
    }, { status: response.ok ? 200 : 202 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "No se pudo sincronizar SayIntentions." }, { status: 500 });
  }
}
