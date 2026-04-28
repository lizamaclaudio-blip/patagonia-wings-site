import { NextRequest, NextResponse } from "next/server";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(request: NextRequest) {
  const staticId = request.nextUrl.searchParams.get("static_id") ?? "";
  const username = request.nextUrl.searchParams.get("username") ?? "";
  const dashboardUrl = new URL("/dashboard?tab=dispatch&simbrief_return=1", request.nextUrl.origin);

  if (staticId) dashboardUrl.searchParams.set("static_id", staticId);
  if (username) dashboardUrl.searchParams.set("username", username);

  const safeStaticId = escapeHtml(staticId);
  const safeUsername = escapeHtml(username);
  const safeDashboard = escapeHtml(dashboardUrl.toString());

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SimBrief generado · Patagonia Wings</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #020817; color: #e2f7ff; font-family: Arial, sans-serif; }
    .card { width: min(420px, calc(100vw - 32px)); border: 1px solid rgba(45, 212, 191, .25); border-radius: 22px; padding: 24px; background: rgba(8, 22, 42, .92); box-shadow: 0 24px 70px rgba(0,0,0,.42); }
    .tag { color: #67e8f9; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; font-weight: 700; }
    h1 { font-size: 22px; margin: 10px 0; }
    p { color: rgba(226,247,255,.72); line-height: 1.55; }
    a { color: #2dd4bf; font-weight: 700; }
  </style>
</head>
<body>
  <main class="card">
    <div class="tag">Patagonia Wings</div>
    <h1>OFP SimBrief generado</h1>
    <p>Estamos devolviendo el despacho a Patagonia Wings para cargar el OFP automáticamente.</p>
    <p><strong>static_id:</strong> ${safeStaticId || "pendiente"}</p>
    <p>Si esta ventana no se cierra, <a href="${safeDashboard}">volver al despacho</a>.</p>
  </main>
  <script>
    const payload = {
      type: "PWG_SIMBRIEF_OFP_READY",
      staticId: ${JSON.stringify(staticId)},
      username: ${JSON.stringify(username)}
    };
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, window.location.origin);
        setTimeout(() => window.close(), 900);
      } else {
        window.location.href = ${JSON.stringify(dashboardUrl.toString())};
      }
    } catch (error) {
      window.location.href = ${JSON.stringify(dashboardUrl.toString())};
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
