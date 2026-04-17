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
  const nextPath = normalizeInternalNextPath(
    request.nextUrl.searchParams.get("next")
  );

  try {
    const { authorizationUrl, state, codeVerifier } = buildAuthorizationUrl(
      nextPath
    );

    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set(
      NAVIGRAPH_COOKIE_STATE,
      state,
      getCookieBaseOptions(60 * 15)
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_VERIFIER,
      codeVerifier,
      getCookieBaseOptions(60 * 15)
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_NEXT,
      nextPath,
      getCookieBaseOptions(60 * 15)
    );

    return response;
  } catch (error) {
    const fallback = new URL(nextPath, request.url);
    fallback.searchParams.set(
      "ng_error",
      error instanceof Error
        ? error.message
        : "No se pudo iniciar la conexión con Navigraph."
    );

    const response = NextResponse.redirect(fallback);
    response.cookies.delete(NAVIGRAPH_COOKIE_STATE);
    response.cookies.delete(NAVIGRAPH_COOKIE_VERIFIER);
    response.cookies.delete(NAVIGRAPH_COOKIE_NEXT);
    return response;
  }
}
