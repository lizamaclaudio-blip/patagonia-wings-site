import { NextRequest, NextResponse } from "next/server";
import {
  NAVIGRAPH_COOKIE_DEVICE_CODE,
  NAVIGRAPH_COOKIE_DEVICE_EXPIRES_AT,
  NAVIGRAPH_COOKIE_DEVICE_INTERVAL,
  NAVIGRAPH_COOKIE_DEVICE_USER_CODE,
  NAVIGRAPH_COOKIE_DEVICE_VERIFIER,
  NAVIGRAPH_COOKIE_NEXT,
  getCookieBaseOptions,
  getTokenExpiryIso,
  normalizeInternalNextPath,
  startDeviceAuthorization,
} from "@/lib/navigraph-auth";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(params: {
  nextPath: string;
  verificationUriComplete: string;
  verificationUri: string;
  userCode: string;
  interval: number;
}) {
  const {
    nextPath,
    verificationUriComplete,
    verificationUri,
    userCode,
    interval,
  } = params;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Conectando Navigraph...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        font-family: Inter, Arial, sans-serif;
        background: #07111f;
        color: #e8f1ff;
      }
      .wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(560px, 100%);
        border-radius: 20px;
        padding: 28px;
        background: rgba(15, 23, 42, 0.88);
        border: 1px solid rgba(148, 163, 184, 0.18);
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
      }
      h1 {
        margin: 0 0 10px;
        font-size: 26px;
      }
      p {
        margin: 0 0 14px;
        line-height: 1.5;
        color: #c8d7f0;
      }
      .code {
        margin: 18px 0;
        padding: 16px;
        border-radius: 14px;
        background: rgba(30, 41, 59, 0.85);
        border: 1px solid rgba(148, 163, 184, 0.16);
        font-size: 28px;
        letter-spacing: 0.12em;
        text-align: center;
        font-weight: 700;
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 16px;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 16px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: #2563eb;
        color: white;
        text-decoration: none;
        font-weight: 600;
      }
      .btn.secondary {
        background: rgba(30, 41, 59, 0.9);
      }
      .status {
        margin-top: 18px;
        font-size: 14px;
        color: #93c5fd;
      }
      .small {
        font-size: 13px;
        color: #93a7c7;
        margin-top: 12px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Conectar Navigraph</h1>
        <p>
          Se abrió el flujo correcto de autorización. Deja esta ventana abierta
          mientras autorizas tu cuenta en Navigraph.
        </p>
        <p>Si no se abre automáticamente, usa este código:</p>
        <div class="code">${escapeHtml(userCode)}</div>
        <div class="actions">
          <a class="btn" href="${escapeHtml(
            verificationUriComplete
          )}" target="_blank" rel="noopener noreferrer">
            Abrir Navigraph
          </a>
          <a class="btn secondary" href="${escapeHtml(
            verificationUri
          )}" target="_blank" rel="noopener noreferrer">
            Abrir página manual
          </a>
        </div>
        <div class="status" id="status">
          Esperando autorización de Navigraph...
        </div>
        <div class="small">
          Cuando termines de autorizar, esta página volverá sola a Patagonia Wings.
        </div>
      </div>
    </div>

    <script>
      (function () {
        const verificationUrl = ${JSON.stringify(verificationUriComplete)};
        const nextPath = ${JSON.stringify(nextPath)};
        const initialIntervalMs = ${Math.max(3, interval) * 1000};

        function appendParam(path, key, value) {
          const hasQuery = path.includes("?");
          return path + (hasQuery ? "&" : "?") + key + "=" + encodeURIComponent(value);
        }

        function goConnected() {
          window.location.assign(appendParam(nextPath, "ng", "connected"));
        }

        function goError(message) {
          window.location.assign(
            appendParam(
              nextPath,
              "ng_error",
              message || "Falló la autorización con Navigraph."
            )
          );
        }

        function setStatus(message) {
          const el = document.getElementById("status");
          if (el) {
            el.textContent = message;
          }
        }

        try {
          window.open(verificationUrl, "_blank", "noopener,noreferrer");
        } catch {
          // no-op
        }

        async function poll(delayMs) {
          setTimeout(async () => {
            try {
              const response = await fetch("/api/auth/navigraph/device/poll", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                  Accept: "application/json"
                }
              });

              const payload = await response.json().catch(() => null);

              if (!response.ok) {
                goError(
                  payload && typeof payload.message === "string"
                    ? payload.message
                    : "No se pudo consultar el estado de Navigraph."
                );
                return;
              }

              if (!payload || typeof payload !== "object") {
                goError("La respuesta del estado de Navigraph fue inválida.");
                return;
              }

              if (payload.status === "authorized") {
                goConnected();
                return;
              }

              if (payload.status === "pending") {
                setStatus("Esperando autorización de Navigraph...");
                poll(
                  typeof payload.interval === "number" && payload.interval > 0
                    ? payload.interval * 1000
                    : initialIntervalMs
                );
                return;
              }

              if (payload.status === "denied" || payload.status === "expired") {
                goError(
                  typeof payload.message === "string"
                    ? payload.message
                    : "La autorización con Navigraph no se completó."
                );
                return;
              }

              if (payload.status === "error") {
                goError(
                  typeof payload.message === "string"
                    ? payload.message
                    : "No se pudo completar la conexión con Navigraph."
                );
                return;
              }

              goError("Estado de Navigraph no reconocido.");
            } catch (error) {
              goError(
                error instanceof Error
                  ? error.message
                  : "Error consultando el estado de Navigraph."
              );
            }
          }, delayMs);
        }

        poll(initialIntervalMs);
      })();
    </script>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  try {
    const requestedNextPath = request.nextUrl.searchParams.get("next");
    const nextPath = normalizeInternalNextPath(requestedNextPath);

    const device = await startDeviceAuthorization();
    const expiresAt = getTokenExpiryIso(device.expiresIn);

    const html = buildHtml({
      nextPath,
      verificationUriComplete: device.verificationUriComplete,
      verificationUri: device.verificationUri,
      userCode: device.userCode,
      interval: device.interval,
    });

    const response = new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });

    response.cookies.set(
      NAVIGRAPH_COOKIE_NEXT,
      nextPath,
      getCookieBaseOptions(device.expiresIn)
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_DEVICE_CODE,
      device.deviceCode,
      getCookieBaseOptions(device.expiresIn)
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_DEVICE_USER_CODE,
      device.userCode,
      getCookieBaseOptions(device.expiresIn)
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_DEVICE_VERIFIER,
      device.codeVerifier,
      getCookieBaseOptions(device.expiresIn)
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_DEVICE_INTERVAL,
      String(device.interval),
      getCookieBaseOptions(device.expiresIn)
    );

    response.cookies.set(
      NAVIGRAPH_COOKIE_DEVICE_EXPIRES_AT,
      expiresAt,
      getCookieBaseOptions(device.expiresIn)
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

    const response = NextResponse.redirect(url);

    response.cookies.delete(NAVIGRAPH_COOKIE_DEVICE_CODE);
    response.cookies.delete(NAVIGRAPH_COOKIE_DEVICE_USER_CODE);
    response.cookies.delete(NAVIGRAPH_COOKIE_DEVICE_VERIFIER);
    response.cookies.delete(NAVIGRAPH_COOKIE_DEVICE_INTERVAL);
    response.cookies.delete(NAVIGRAPH_COOKIE_DEVICE_EXPIRES_AT);

    return response;
  }
}
