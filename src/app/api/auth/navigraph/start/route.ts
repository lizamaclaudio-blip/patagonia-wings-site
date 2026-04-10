import { NextRequest, NextResponse } from "next/server";
import {
  NAVIGRAPH_COOKIE_NEXT,
  NAVIGRAPH_COOKIE_STATE,
  NAVIGRAPH_COOKIE_VERIFIER,
  buildAuthorizationUrl,
  getCookieBaseOptions,
  normalizeInternalNextPath,
} from "@/lib/navigraph-auth";

export async function GET(request: NextRequest) {
  try {
    const requestedNextPath = request.nextUrl.searchParams.get("next");
    const nextPath = normalizeInternalNextPath(requestedNextPath);
    const { authorizationUrl, state, codeVerifier } = buildAuthorizationUrl(nextPath);

    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set(
      NAVIGRAPH_COOKIE_STATE,
      state,
      getCookieBaseOptions(60 * 10)
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_VERIFIER,
      codeVerifier,
      getCookieBaseOptions(60 * 10)
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_NEXT,
      nextPath,
      getCookieBaseOptions(60 * 10)
    );

    return response;
  } catch (error) {
    const url = new URL("/profile", request.url);
    url.searchParams.set(
      "ng_error",
      error instanceof Error
        ? error.message
        : "No se pudo iniciar la conexión con Navigraph."
    );

    return NextResponse.redirect(url);
  }
}
