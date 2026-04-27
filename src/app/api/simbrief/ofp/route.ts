import { NextRequest, NextResponse } from "next/server";
import {
  buildSimbriefFetchUrl,
  buildSimbriefXmlFetchUrl,
  extractSimbriefOfpSummary,
} from "@/lib/simbrief";

async function fetchSimbrief(url: string) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json, text/plain, */*",
    },
  });

  const rawText = await response.text();

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    rawText,
    parsed,
  };
}

async function fetchSimbriefXml(username: string, staticId: string | null) {
  const response = await fetch(buildSimbriefXmlFetchUrl(username, staticId), {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/xml, text/xml, text/plain, */*",
    },
  });

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  return text.trim() ? text : null;
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim();
  const staticId = request.nextUrl.searchParams.get("static_id")?.trim() ?? null;

  if (!username) {
    return NextResponse.json(
      { error: "Debes indicar username para consultar el OFP." },
      { status: 400 }
    );
  }

  const primaryUrl = buildSimbriefFetchUrl(username, staticId);
  const fallbackUrl = buildSimbriefFetchUrl(username, null);

  try {
    let result = await fetchSimbrief(primaryUrl);
    let matchedByStaticId = Boolean(staticId && result.ok);

    if (!result.ok && staticId) {
      result = await fetchSimbrief(fallbackUrl);
      matchedByStaticId = false;
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.rawText ||
            "SimBrief devolvió un error al consultar el OFP más reciente.",
        },
        { status: 502 }
      );
    }

    const summary = extractSimbriefOfpSummary(result.parsed, staticId);
    summary.matchedByStaticId = matchedByStaticId || summary.matchedByStaticId;
    const rawXml = await fetchSimbriefXml(username, staticId);

    if (staticId && !summary.matchedByStaticId) {
      return NextResponse.json(
        {
          error:
            "El OFP importado no coincide con el static_id de este despacho. Vuelve a abrir SimBrief desde esta reserva y genera/importa el plan correcto.",
          matchedByStaticId: false,
          summary,
          raw: result.parsed,
          rawXml,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        matchedByStaticId: summary.matchedByStaticId,
        summary,
        raw: result.parsed,
        rawXml,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar SimBrief.",
      },
      { status: 500 }
    );
  }
}
