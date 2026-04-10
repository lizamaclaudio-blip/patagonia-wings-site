import { createHash, randomBytes } from "node:crypto";

const NAVIGRAPH_AUTHORIZE_URL =
  "https://identity.api.navigraph.com/connect/authorize";
const NAVIGRAPH_TOKEN_URL =
  "https://identity.api.navigraph.com/connect/token";
const NAVIGRAPH_DEVICE_AUTH_URL =
  "https://identity.api.navigraph.com/connect/deviceauthorization";

export const NAVIGRAPH_COOKIE_ACCESS = "pwg_ng_access";
export const NAVIGRAPH_COOKIE_REFRESH = "pwg_ng_refresh";
export const NAVIGRAPH_COOKIE_EXPIRES_AT = "pwg_ng_expires_at";
export const NAVIGRAPH_COOKIE_STATE = "pwg_ng_state";
export const NAVIGRAPH_COOKIE_VERIFIER = "pwg_ng_verifier";
export const NAVIGRAPH_COOKIE_NEXT = "pwg_ng_next";

export type NavigraphTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  tokenType: string;
  scope?: string | string[] | null;
};

export type NavigraphDeviceAuthorizationResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
  codeVerifier: string;
};

export type NavigraphDeviceTokenPollResult =
  | { status: "authorized"; token: NavigraphTokenResponse }
  | { status: "pending"; interval: number; error: "authorization_pending" | "slow_down" }
  | { status: "denied"; error: "access_denied"; message: string }
  | { status: "expired"; error: "expired_token"; message: string };

type AuthorizationUrlResult = {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
};

type ExchangeAuthorizationCodeInput = {
  code: string;
  codeVerifier: string;
};

type NavigraphOAuthError = Error & {
  oauthError?: string;
  oauthDescription?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Falta ${name} en las variables de entorno.`);
  }

  return value;
}

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createCodeVerifier() {
  return base64UrlEncode(randomBytes(48));
}

function createCodeChallenge(codeVerifier: string) {
  return base64UrlEncode(createHash("sha256").update(codeVerifier).digest());
}

function parseNavigraphScopes() {
  const raw = process.env.NAVIGRAPH_SCOPES?.trim();

  if (!raw) {
    return "openid simbrief ofp offline_access";
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .join(" ");
    }
  } catch {
    // no-op
  }

  return raw.replace(/[\[\]",]/g, " ").replace(/\s+/g, " ").trim();
}

function createOauthError(message: string, oauthError?: string, oauthDescription?: string) {
  const error = new Error(message) as NavigraphOAuthError;
  error.oauthError = oauthError;
  error.oauthDescription = oauthDescription;
  return error;
}

function parseTokenPayload(payload: unknown): NavigraphTokenResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Navigraph devolvió una respuesta de token inválida.");
  }

  const record = payload as Record<string, unknown>;
  const accessToken = typeof record.access_token === "string" ? record.access_token : null;
  const refreshToken = typeof record.refresh_token === "string" ? record.refresh_token : null;
  const expiresIn =
    typeof record.expires_in === "number"
      ? record.expires_in
      : Number(record.expires_in ?? 0);
  const tokenType = typeof record.token_type === "string" ? record.token_type : "Bearer";

  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("Navigraph no entregó access_token o expires_in válidos.");
  }

  return {
    accessToken,
    refreshToken,
    expiresIn,
    tokenType,
    scope:
      typeof record.scope === "string" || Array.isArray(record.scope)
        ? (record.scope as string | string[])
        : null,
  };
}

async function parseJsonSafe(response: Response) {
  const rawText = await response.text();
  let parsed: unknown = null;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = null;
  }

  return { rawText, parsed };
}

async function requestNavigraphToken(body: URLSearchParams) {
  const response = await fetch(NAVIGRAPH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const { rawText, parsed } = await parseJsonSafe(response);

  if (!response.ok) {
    const oauthError =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as Record<string, unknown>).error)
        : undefined;
    const description =
      parsed && typeof parsed === "object" && "error_description" in parsed
        ? String((parsed as Record<string, unknown>).error_description)
        : rawText || `Navigraph respondió ${response.status}.`;

    throw createOauthError(description, oauthError, description);
  }

  return parseTokenPayload(parsed);
}

export function normalizeInternalNextPath(value?: string | null) {
  if (!value) {
    return "/profile";
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/profile";
  }

  return trimmed;
}

export function getCookieBaseOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function getTokenExpiryIso(expiresIn: number) {
  return new Date(Date.now() + Math.max(1, expiresIn) * 1000).toISOString();
}

export function isExpiringSoon(expiresAt?: string | null, thresholdSeconds = 90) {
  if (!expiresAt) {
    return true;
  }

  const expiresAtMs = new Date(expiresAt).getTime();

  if (Number.isNaN(expiresAtMs)) {
    return true;
  }

  return expiresAtMs - Date.now() <= thresholdSeconds * 1000;
}

export function decodeJwtPayload(token: string) {
  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildAuthorizationUrl(nextPath?: string | null): AuthorizationUrlResult {
  void nextPath;

  const clientId = getRequiredEnv("NAVIGRAPH_CLIENT_ID");
  const redirectUri = getRequiredEnv("NAVIGRAPH_REDIRECT_URI");
  const scopes = parseNavigraphScopes();

  const state = base64UrlEncode(randomBytes(24));
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);

  const url = new URL(NAVIGRAPH_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return {
    authorizationUrl: url.toString(),
    state,
    codeVerifier,
  };
}

export async function exchangeAuthorizationCode({
  code,
  codeVerifier,
}: ExchangeAuthorizationCodeInput) {
  const clientId = getRequiredEnv("NAVIGRAPH_CLIENT_ID");
  const clientSecret = getRequiredEnv("NAVIGRAPH_CLIENT_SECRET");
  const redirectUri = getRequiredEnv("NAVIGRAPH_REDIRECT_URI");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });

  return await requestNavigraphToken(body);
}

export async function startDeviceAuthorization(): Promise<NavigraphDeviceAuthorizationResponse> {
  const clientId = getRequiredEnv("NAVIGRAPH_CLIENT_ID");
  const clientSecret = getRequiredEnv("NAVIGRAPH_CLIENT_SECRET");
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = await fetch(NAVIGRAPH_DEVICE_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const { rawText, parsed } = await parseJsonSafe(response);

  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object" && "error_description" in parsed
        ? String((parsed as Record<string, unknown>).error_description)
        : rawText || "No se pudo iniciar Device Authorization en Navigraph.";
    const oauthError =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as Record<string, unknown>).error)
        : undefined;

    throw createOauthError(message, oauthError, message);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Navigraph devolvió una respuesta inválida al iniciar Device Authorization.");
  }

  const record = parsed as Record<string, unknown>;
  const deviceCode = typeof record.device_code === "string" ? record.device_code : null;
  const userCode = typeof record.user_code === "string" ? record.user_code : null;
  const verificationUri = typeof record.verification_uri === "string" ? record.verification_uri : null;
  const verificationUriComplete =
    typeof record.verification_uri_complete === "string"
      ? record.verification_uri_complete
      : verificationUri;
  const expiresIn =
    typeof record.expires_in === "number"
      ? record.expires_in
      : Number(record.expires_in ?? 0);
  const interval =
    typeof record.interval === "number"
      ? record.interval
      : Number(record.interval ?? 5);

  if (
    !deviceCode ||
    !userCode ||
    !verificationUri ||
    !verificationUriComplete ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new Error("Navigraph no entregó todos los datos requeridos para el flujo device.");
  }

  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete,
    expiresIn,
    interval: Number.isFinite(interval) && interval > 0 ? interval : 5,
    codeVerifier,
  };
}

export async function pollDeviceAuthorization(
  deviceCode: string,
  codeVerifier: string,
  intervalSeconds = 5
): Promise<NavigraphDeviceTokenPollResult> {
  const clientId = getRequiredEnv("NAVIGRAPH_CLIENT_ID");
  const clientSecret = getRequiredEnv("NAVIGRAPH_CLIENT_SECRET");
  const scope = parseNavigraphScopes();

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: deviceCode,
    code_verifier: codeVerifier,
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  try {
    const token = await requestNavigraphToken(body);
    return { status: "authorized", token };
  } catch (error) {
    const oauthError = (error as NavigraphOAuthError | undefined)?.oauthError;
    const message =
      error instanceof Error ? error.message : "No se pudo consultar el estado de autorización con Navigraph.";

    if (oauthError === "authorization_pending") {
      return { status: "pending", interval: intervalSeconds, error: "authorization_pending" };
    }

    if (oauthError === "slow_down") {
      return { status: "pending", interval: intervalSeconds + 5, error: "slow_down" };
    }

    if (oauthError === "access_denied") {
      return { status: "denied", error: "access_denied", message };
    }

    if (oauthError === "expired_token") {
      return { status: "expired", error: "expired_token", message };
    }

    throw error;
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const clientId = getRequiredEnv("NAVIGRAPH_CLIENT_ID");
  const clientSecret = getRequiredEnv("NAVIGRAPH_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  return await requestNavigraphToken(body);
}
