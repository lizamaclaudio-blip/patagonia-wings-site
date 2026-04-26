import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PEXELS_REVALIDATE_SECONDS = 60 * 60 * 6; // 6 hours

type PexelsPhotoResponse = {
  photos?: Array<{
    url?: string | null;
    photographer?: string | null;
    photographer_url?: string | null;
    src?: {
      original?: string | null;
      large2x?: string | null;
      large?: string | null;
      landscape?: string | null;
      medium?: string | null;
    } | null;
  }>;
};

function sanitize(value: string | null | undefined) {
  return (value ?? "").trim();
}

async function searchPexelsPhoto(query: string, apiKey: string) {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("size", "large");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: apiKey },
    next: { revalidate: PEXELS_REVALIDATE_SECONDS },
  });

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => null)) as PexelsPhotoResponse | null;
  const photo = payload?.photos?.[0];
  if (!photo?.src) return null;

  const imageUrl =
    photo.src.landscape ??
    photo.src.large2x ??
    photo.src.large ??
    photo.src.original ??
    photo.src.medium ??
    null;

  if (!imageUrl) return null;

  return {
    imageUrl,
    source: "pexels" as const,
    photographerName: photo.photographer ?? null,
    photographerUrl: photo.photographer_url ?? null,
    providerName: "Pexels",
    providerUrl: "https://www.pexels.com",
    photoPageUrl: photo.url ?? null,
    query,
  };
}

function buildAircraftQueries(typeCode: string, model: string) {
  const code = typeCode.toUpperCase().replace(/\s/g, "");
  const cleanModel = sanitize(model);

  const queries = new Set<string>();

  if (cleanModel) {
    queries.add(`${cleanModel} aircraft cockpit`);
    queries.add(`${cleanModel} airplane flight`);
    queries.add(`${cleanModel} aircraft exterior`);
  }
  if (code) {
    queries.add(`${code} airplane cockpit`);
    queries.add(`${code} aircraft flight`);
  }
  // Generic fallback queries
  queries.add("commercial airplane cockpit");
  queries.add("airline aircraft flight");
  queries.add("passenger jet airplane");

  return Array.from(queries).filter((q) => q.length >= 6);
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(request: NextRequest) {
  const typeCode = sanitize(request.nextUrl.searchParams.get("typeCode"));
  const model = sanitize(request.nextUrl.searchParams.get("model"));

  if (!typeCode && !model) {
    return jsonResponse({ error: "Falta typeCode o model." }, 400);
  }

  const pexelsApiKey = process.env.PEXELS_API_KEY?.trim();

  if (!pexelsApiKey) {
    return jsonResponse(
      { error: "PEXELS_API_KEY no configurado.", source: "fallback" },
      404,
    );
  }

  const queries = buildAircraftQueries(typeCode, model);

  for (const query of queries) {
    try {
      const result = await searchPexelsPhoto(query, pexelsApiKey);
      if (result) return jsonResponse(result);
    } catch {
      // continue
    }
  }

  return jsonResponse(
    { error: "No se encontró imagen para esta aeronave.", source: "fallback" },
    404,
  );
}
