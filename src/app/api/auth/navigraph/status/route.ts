import { NextRequest, NextResponse } from "next/server";
import {
  NAVIGRAPH_COOKIE_ACCESS,
  NAVIGRAPH_COOKIE_EXPIRES_AT,
  NAVIGRAPH_COOKIE_REFRESH,
  decodeJwtPayload,
  getCookieBaseOptions,
  isExpiringSoon,
  refreshAccessToken,
  getTokenExpiryIso,
} from "@/lib/navigraph-auth";

type StatusResponse = {
  configured: boolean;
  connected: boolean;
  hasRefreshToken: boolean;
  expiresAt: string | null;
  scopes: string[];
  subscriptions: string[];
  clientId: string | null;
  subject: string | null;
  error: string | null;
};

function extractScopes(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return value.split(/\s+/).filter(Boolean);
  }

  return [];
}

function extractSubscriptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export async function GET(request: NextRequest) {
  const clientId = process.env.NAVIGRAPH_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.NAVIGRAPH_CLIENT_SECRET?.trim() || null;
  const redirectUri = process.env.NAVIGRAPH_REDIRECT_URI?.trim() || null;

  const configured = Boolean(clientId && clientSecret && redirectUri);

  if (!configured) {
    return NextResponse.json<StatusResponse>({
      configured: false,
      connected: false,
      hasRefreshToken: false,
      expiresAt: null,
      scopes: [],
      subscriptions: [],
      clientId: null,
      subject: null,
      error: "Faltan variables NAVIGRAPH_* en el entorno.",
    });
  }

  let accessToken = request.cookies.get(NAVIGRAPH_COOKIE_ACCESS)?.value ?? null;
  let refreshToken = request.cookies.get(NAVIGRAPH_COOKIE_REFRESH)?.value ?? null;
  let expiresAt = request.cookies.get(NAVIGRAPH_COOKIE_EXPIRES_AT)?.value ?? null;

  const response = NextResponse.next();

  if (refreshToken && (!accessToken || isExpiringSoon(expiresAt))) {
    try {
      const refreshed = await refreshAccessToken(refreshToken);

      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      expiresAt = getTokenExpiryIso(refreshed.expiresIn);

      response.cookies.set(
        NAVIGRAPH_COOKIE_ACCESS,
        accessToken,
        getCookieBaseOptions(Math.max(60, refreshed.expiresIn))
      );

      if (refreshToken) {
        response.cookies.set(
          NAVIGRAPH_COOKIE_REFRESH,
          refreshToken,
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
    } catch (error) {
      response.cookies.delete(NAVIGRAPH_COOKIE_ACCESS);
      response.cookies.delete(NAVIGRAPH_COOKIE_REFRESH);
      response.cookies.delete(NAVIGRAPH_COOKIE_EXPIRES_AT);

      return NextResponse.json<StatusResponse>({
        configured: true,
        connected: false,
        hasRefreshToken: false,
        expiresAt: null,
        scopes: [],
        subscriptions: [],
        clientId: null,
        subject: null,
        error:
          error instanceof Error
            ? error.message
            : "La sesión Navigraph expiró y no pudo refrescarse.",
      });
    }
  }

  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  const scopes = extractScopes(payload?.scope);
  const subscriptions = extractSubscriptions(payload?.subscriptions);

  return NextResponse.json<StatusResponse>({
    configured: true,
    connected: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    expiresAt,
    scopes,
    subscriptions,
    clientId: typeof payload?.client_id === "string" ? payload.client_id : null,
    subject: typeof payload?.sub === "string" ? payload.sub : null,
    error: null,
  }, {
    headers: response.headers,
  });
}