import { NextRequest, NextResponse } from "next/server";
import {
  NAVIGRAPH_COOKIE_ACCESS,
  NAVIGRAPH_COOKIE_DEVICE_CODE,
  NAVIGRAPH_COOKIE_DEVICE_EXPIRES_AT,
  NAVIGRAPH_COOKIE_DEVICE_INTERVAL,
  NAVIGRAPH_COOKIE_DEVICE_USER_CODE,
  NAVIGRAPH_COOKIE_DEVICE_VERIFIER,
  NAVIGRAPH_COOKIE_EXPIRES_AT,
  NAVIGRAPH_COOKIE_NEXT,
  NAVIGRAPH_COOKIE_REFRESH,
  getCookieBaseOptions,
  getTokenExpiryIso,
  pollDeviceAuthorization,
} from "@/lib/navigraph-auth";

function clearDeviceCookies(response: NextResponse) {
  response.cookies.delete(NAVIGRAPH_COOKIE_DEVICE_CODE);
  response.cookies.delete(NAVIGRAPH_COOKIE_DEVICE_USER_CODE);
  response.cookies.delete(NAVIGRAPH_COOKIE_DEVICE_VERIFIER);
  response.cookies.delete(NAVIGRAPH_COOKIE_DEVICE_INTERVAL);
  response.cookies.delete(NAVIGRAPH_COOKIE_DEVICE_EXPIRES_AT);
}

export async function GET(request: NextRequest) {
  const deviceCode =
    request.cookies.get(NAVIGRAPH_COOKIE_DEVICE_CODE)?.value ?? null;
  const codeVerifier =
    request.cookies.get(NAVIGRAPH_COOKIE_DEVICE_VERIFIER)?.value ?? null;
  const intervalRaw =
    request.cookies.get(NAVIGRAPH_COOKIE_DEVICE_INTERVAL)?.value ?? "5";
  const interval = Number(intervalRaw);

  if (!deviceCode || !codeVerifier) {
    const response = NextResponse.json(
      {
        status: "error",
        message:
          "No se encontró una autorización device activa para Navigraph.",
      },
      { status: 400 }
    );

    clearDeviceCookies(response);
    return response;
  }

  try {
    const result = await pollDeviceAuthorization(
      deviceCode,
      codeVerifier,
      Number.isFinite(interval) && interval > 0 ? interval : 5
    );

    if (result.status === "authorized") {
      const expiresAt = getTokenExpiryIso(result.token.expiresIn);

      const response = NextResponse.json(
        {
          status: "authorized",
          message: "Navigraph conectado correctamente.",
        },
        { status: 200 }
      );

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
      } else {
        response.cookies.delete(NAVIGRAPH_COOKIE_REFRESH);
      }

      response.cookies.set(
        NAVIGRAPH_COOKIE_EXPIRES_AT,
        expiresAt,
        getCookieBaseOptions(60 * 60 * 24 * 30)
      );

      clearDeviceCookies(response);

      return response;
    }

    if (result.status === "pending") {
      return NextResponse.json(
        {
          status: "pending",
          interval: result.interval,
        },
        { status: 200 }
      );
    }

    if (result.status === "denied" || result.status === "expired") {
      const response = NextResponse.json(
        {
          status: result.status,
          message: result.message,
        },
        { status: 200 }
      );

      clearDeviceCookies(response);
      response.cookies.delete(NAVIGRAPH_COOKIE_ACCESS);
      response.cookies.delete(NAVIGRAPH_COOKIE_REFRESH);
      response.cookies.delete(NAVIGRAPH_COOKIE_EXPIRES_AT);

      return response;
    }

    const response = NextResponse.json(
      {
        status: "error",
        message: "Estado inesperado en el flujo de Navigraph.",
      },
      { status: 500 }
    );

    clearDeviceCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo consultar el estado de Navigraph.",
      },
      { status: 500 }
    );

    clearDeviceCookies(response);
    response.cookies.delete(NAVIGRAPH_COOKIE_NEXT);

    return response;
  }
}