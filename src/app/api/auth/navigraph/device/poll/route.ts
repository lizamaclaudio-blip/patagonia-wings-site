import { NextRequest, NextResponse } from "next/server";
import {
  NAVIGRAPH_COOKIE_ACCESS,
  NAVIGRAPH_COOKIE_EXPIRES_AT,
  NAVIGRAPH_COOKIE_REFRESH,
  NAVIGRAPH_COOKIE_VERIFIER,
  getCookieBaseOptions,
  getTokenExpiryIso,
  pollDeviceAuthorization,
} from "@/lib/navigraph-auth";

export async function POST(request: NextRequest) {
  const verifier = request.cookies.get(NAVIGRAPH_COOKIE_VERIFIER)?.value ?? null;

  if (!verifier) {
    return NextResponse.json(
      { error: "No se encontró el verificador PKCE de Navigraph. Inicia la conexión nuevamente." },
      { status: 400 }
    );
  }

  let body: { deviceCode?: string; interval?: number } = {};

  try {
    body = (await request.json()) as { deviceCode?: string; interval?: number };
  } catch {
    body = {};
  }

  const deviceCode = body.deviceCode?.trim();
  const interval = Number.isFinite(body.interval) ? Number(body.interval) : 5;

  if (!deviceCode) {
    return NextResponse.json(
      { error: "Falta deviceCode para continuar la autorización con Navigraph." },
      { status: 400 }
    );
  }

  try {
    const result = await pollDeviceAuthorization(deviceCode, verifier, interval);

    if (result.status === "pending") {
      return NextResponse.json({
        ok: false,
        status: result.status,
        interval: result.interval,
        error: result.error,
      });
    }

    if (result.status === "denied" || result.status === "expired") {
      const response = NextResponse.json(
        {
          ok: false,
          status: result.status,
          error: result.error,
          message: result.message,
        },
        { status: 400 }
      );

      response.cookies.delete(NAVIGRAPH_COOKIE_VERIFIER);
      return response;
    }

    const expiresAt = getTokenExpiryIso(result.token.expiresIn);
    const response = NextResponse.json({
      ok: true,
      status: "authorized",
      expiresAt,
    });

    response.cookies.set(
      NAVIGRAPH_COOKIE_ACCESS,
      result.token.accessToken,
      getCookieBaseOptions(Math.max(60, result.token.expiresIn))
    );

    if (result.token.refreshToken) {
      response.cookies.set(
        NAVIGRAPH_COOKIE_REFRESH,
        result.token.refreshToken,
        getCookieBaseOptions(60 * 60 * 24 * 30)
      );
    }

    response.cookies.set(
      NAVIGRAPH_COOKIE_EXPIRES_AT,
      expiresAt,
      getCookieBaseOptions(60 * 60 * 24 * 30)
    );

    response.cookies.delete(NAVIGRAPH_COOKIE_VERIFIER);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo completar el polling de Navigraph.",
      },
      { status: 500 }
    );
  }
}
