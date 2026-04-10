import { NextResponse } from "next/server";
import {
  NAVIGRAPH_COOKIE_DEVICE_CODE,
  NAVIGRAPH_COOKIE_DEVICE_EXPIRES_AT,
  NAVIGRAPH_COOKIE_DEVICE_INTERVAL,
  NAVIGRAPH_COOKIE_DEVICE_USER_CODE,
  NAVIGRAPH_COOKIE_DEVICE_VERIFIER,
  getCookieBaseOptions,
  getTokenExpiryIso,
  startDeviceAuthorization,
} from "@/lib/navigraph-auth";

export async function POST() {
  try {
    const session = await startDeviceAuthorization();
    const expiresAt = getTokenExpiryIso(session.expiresIn);

    const response = NextResponse.json({
      ok: true,
      deviceCode: session.deviceCode,
      userCode: session.userCode,
      verificationUri: session.verificationUri,
      verificationUriComplete: session.verificationUriComplete,
      expiresIn: session.expiresIn,
      interval: session.interval,
    });

    response.cookies.set(
      NAVIGRAPH_COOKIE_DEVICE_CODE,
      session.deviceCode,
      getCookieBaseOptions(Math.max(60, session.expiresIn))
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_DEVICE_USER_CODE,
      session.userCode,
      getCookieBaseOptions(Math.max(60, session.expiresIn))
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_DEVICE_VERIFIER,
      session.codeVerifier,
      getCookieBaseOptions(Math.max(60, session.expiresIn))
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_DEVICE_INTERVAL,
      String(session.interval),
      getCookieBaseOptions(Math.max(60, session.expiresIn))
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_DEVICE_EXPIRES_AT,
      expiresAt,
      getCookieBaseOptions(Math.max(60, session.expiresIn))
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la conexión device con Navigraph.",
      },
      { status: 500 }
    );
  }
}
