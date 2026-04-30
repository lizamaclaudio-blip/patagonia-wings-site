import { NextRequest, NextResponse } from "next/server";
import { getUserFromAccessToken } from "@/lib/supabase/server";
import { getSayIntentionsServerConfig, getSayIntentionsSettings, upsertSayIntentionsSettings, type SayIntentionsSettingsInput } from "@/lib/sayintentions";

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("Falta Authorization Bearer.");
  }
  return authorization.slice(7).trim();
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    const user = await getUserFromAccessToken(accessToken);
    const settings = await getSayIntentionsSettings(accessToken, user.id);
    const config = getSayIntentionsServerConfig();
    return NextResponse.json({
      success: true,
      settings,
      server: {
        enabled: config.enabled,
        configured: config.vaApiKeyPresent,
        apiKeyStoredClientSide: false,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "No se pudo cargar settings." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    const user = await getUserFromAccessToken(accessToken);
    const body = (await request.json()) as SayIntentionsSettingsInput;
    const settings = await upsertSayIntentionsSettings(accessToken, user.id, body);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "No se pudo guardar settings." }, { status: 500 });
  }
}
