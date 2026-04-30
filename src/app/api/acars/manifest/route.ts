import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/acars/manifest
 *
 * Sirve el manifest de release activo desde la tabla acars_release_manifest.
 * ACARS lo puede usar como UpdateChannelUrl alternativo para deteccion
 * en tiempo real: cualquier upsert a la tabla (via deploy-to-web.ps1 o
 * un hotfix manual) se refleja aqui sin necesitar redeploy de Vercel.
 *
 * Fallback: si la tabla no existe o esta vacia, redirige al channel.json
 * estatico en Supabase Storage (comportamiento legacy compatible).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientVersion  = searchParams.get("v")  ?? "";
  const clientRevision = searchParams.get("rev") ?? "";

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("acars_release_manifest")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return staticChannelFallback();
    }

    const manifest = data.manifest_json as Record<string, unknown>;
    if (!manifest || typeof manifest !== "object") {
      return staticChannelFallback();
    }

    const latestRevision = String(manifest.revision ?? "");
    const latestVersion  = String(manifest.version  ?? "");

    const updateAvailable =
      isNewer(latestVersion, clientVersion) ||
      (latestVersion === clientVersion && isNewer(latestRevision, clientRevision));

    return NextResponse.json(
      { ...manifest, updateAvailable, servedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Acars-Latest-Version":  latestVersion,
          "X-Acars-Latest-Revision": latestRevision,
          "X-Update-Available":      String(updateAvailable),
        },
      }
    );
  } catch {
    return staticChannelFallback();
  }
}

/**
 * POST /api/acars/manifest
 *
 * Llamado por deploy-to-web.ps1 al final de cada deploy para upsert
 * del manifest activo en la tabla. Requiere service-role key en el header.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!serviceKey || !authHeader.endsWith(serviceKey.slice(-20))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body.version || !body.revision) {
      return NextResponse.json({ error: "version and revision required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("acars_release_manifest")
      .upsert(
        {
          id:            1,
          version:       String(body.version),
          revision:      String(body.revision),
          channel:       String(body.channel ?? "stable"),
          manifest_json: body,
          updated_at:    new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, version: body.version, revision: body.revision });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function staticChannelFallback() {
  const storageBase =
    "https://qoradagitvccyabfkgkw.supabase.co/storage/v1/object/public/acars-releases";
  return NextResponse.redirect(`${storageBase}/channel.json`, { status: 302 });
}

function isNewer(remote: string, local: string): boolean {
  if (!remote || !local) return !!remote;
  const rp = remote.split(".").map(Number);
  const lp = local.split(".").map(Number);
  const len = Math.max(rp.length, lp.length);
  for (let i = 0; i < len; i++) {
    const r = rp[i] ?? 0;
    const l = lp[i] ?? 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}
