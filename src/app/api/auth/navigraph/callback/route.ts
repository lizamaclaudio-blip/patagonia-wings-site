import { NextRequest, NextResponse } from "next/server";
import {
  NAVIGRAPH_COOKIE_ACCESS,
  NAVIGRAPH_COOKIE_EXPIRES_AT,
  NAVIGRAPH_COOKIE_NEXT,
  NAVIGRAPH_COOKIE_REFRESH,
  NAVIGRAPH_COOKIE_STATE,
  NAVIGRAPH_COOKIE_VERIFIER,
  exchangeAuthorizationCode,
  getCookieBaseOptions,
  getTokenExpiryIso,
  normalizeInternalNextPath,
} from "@/lib/navigraph-auth";

function buildRedirect(request: NextRequest, nextPath: string, status: "connected" | "error", message?: string) {
  const url = new URL(nextPath, request.url);

  if (status === "connected") {
    url.searchParams.set("ng", "connected");
  } else {
    url.searchParams.set("ng_error", message || "Falló la autorización con Navigraph.");
  }

  return url;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  const oauthErrorDescription =
    request.nextUrl.searchParams.get("error_description");

  const storedState = request.cookies.get(NAVIGRAPH_COOKIE_STATE)?.value ?? null;
  const verifier = request.cookies.get(NAVIGRAPH_COOKIE_VERIFIER)?.value ?? null;
  const nextPath = normalizeInternalNextPath(
    request.cookies.get(NAVIGRAPH_COOKIE_NEXT)?.value
  );

  if (oauthError) {
    const response = NextResponse.redirect(
      buildRedirect(
        request,
        nextPath,
        "error",
        oauthErrorDescription || oauthError
      )
    );

    response.cookies.delete(NAVIGRAPH_COOKIE_STATE);
    response.cookies.delete(NAVIGRAPH_COOKIE_VERIFIER);
    response.cookies.delete(NAVIGRAPH_COOKIE_NEXT);

    return response;
  }

  if (!code || !returnedState || !storedState || returnedState !== storedState) {
    const response = NextResponse.redirect(
      buildRedirect(
        request,
        nextPath,
        "error",
        "La respuesta de Navigraph llegó sin un state válido."
      )
    );

    response.cookies.delete(NAVIGRAPH_COOKIE_STATE);
    response.cookies.delete(NAVIGRAPH_COOKIE_VERIFIER);
    response.cookies.delete(NAVIGRAPH_COOKIE_NEXT);

    return response;
  }

  if (!verifier) {
    const response = NextResponse.redirect(
      buildRedirect(
        request,
        nextPath,
        "error",
        "No se encontró el verificador PKCE para completar la conexión."
      )
    );

    response.cookies.delete(NAVIGRAPH_COOKIE_STATE);
    response.cookies.delete(NAVIGRAPH_COOKIE_VERIFIER);
    response.cookies.delete(NAVIGRAPH_COOKIE_NEXT);

    return response;
  }

  try {
    const token = await exchangeAuthorizationCode({
      code,
      codeVerifier: verifier,
    });

    const expiresAt = getTokenExpiryIso(token.expiresIn);

    const response = NextResponse.redirect(
      buildRedirect(request, nextPath, "connected")
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_ACCESS,
      token.accessToken,
      getCookieBaseOptions(Math.max(60, token.expiresIn))
    );

    if (token.refreshToken) {
      response.cookies.set(
        NAVIGRAPH_COOKIE_REFRESH,
        token.refreshToken,
        getCookieBaseOptions(60 * 60 * 24 * 30)
      );
    }

    response.cookies.set(
      NAVIGRAPH_COOKIE_EXPIRES_AT,
      expiresAt,
      getCookieBaseOptions(60 * 60 * 24 * 30)
    );

    response.cookies.delete(NAVIGRAPH_COOKIE_STATE);
    response.cookies.delete(NAVIGRAPH_COOKIE_VERIFIER);
    response.cookies.delete(NAVIGRAPH_COOKIE_NEXT);

    return response;
  } catch (error) {
    const response = NextResponse.redirect(
      buildRedirect(
        request,
        nextPath,
        "error",
        error instanceof Error
          ? error.message
          : "No se pudo intercambiar el código con Navigraph."
      )
    );

    response.cookies.delete(NAVIGRAPH_COOKIE_STATE);
    response.cookies.delete(NAVIGRAPH_COOKIE_VERIFIER);
    response.cookies.delete(NAVIGRAPH_COOKIE_NEXT);
    response.cookies.delete(NAVIGRAPH_COOKIE_ACCESS);
    response.cookies.delete(NAVIGRAPH_COOKIE_REFRESH);
    response.cookies.delete(NAVIGRAPH_COOKIE_EXPIRES_AT);

    return response;
  }
}