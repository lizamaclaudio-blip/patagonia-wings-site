import { NextResponse } from "next/server";
import {
  NAVIGRAPH_COOKIE_VERIFIER,
  getCookieBaseOptions,
  startDeviceAuthorization,
} from "@/lib/navigraph-auth";

export async function POST() {
  try {
    const session = await startDeviceAuthorization();

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
      NAVIGRAPH_COOKIE_VERIFIER,
      session.codeVerifier,
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
