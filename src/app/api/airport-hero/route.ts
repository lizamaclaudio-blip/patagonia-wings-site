import { access } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

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

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

function sanitizeChunk(value: string | null) {
  return (value ?? "").trim();
}

async function findLocalAirportImage(icao: string) {
  const normalizedUpper = sanitizeChunk(icao).toUpperCase();
  const normalizedLower = normalizedUpper.toLowerCase();
  const publicAirportsDir = path.join(process.cwd(), "public", "airports");

  for (const extension of IMAGE_EXTENSIONS) {
    for (const filename of [
      `${normalizedUpper}.${extension}`,
      `${normalizedLower}.${extension}`,
    ]) {
      try {
        await access(path.join(publicAirportsDir, filename));
        return `/airports/${filename}`;
      } catch {
        // continue
      }
    }
  }

  return null;
}

function buildSearchQueries({
  airportName,
  city,
  country,
}: {
  airportName: string;
  city: string;
  country: string;
}) {
  const cleanedAirport = sanitizeChunk(airportName).replace(/\bAirport\b/gi, "").trim();
  const cleanedCity = sanitizeChunk(city);
  const cleanedCountry = sanitizeChunk(country);

  return [
    [cleanedCity, cleanedCountry, "city skyline"].filter(Boolean).join(" "),
    [cleanedCity, cleanedCountry, "aerial city"].filter(Boolean).join(" "),
    [cleanedAirport, cleanedCity, cleanedCountry].filter(Boolean).join(" "),
    [cleanedCity, cleanedCountry].filter(Boolean).join(" "),
  ].filter(Boolean);
}

async function searchPexelsPhoto(query: string, apiKey: string) {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("size", "large");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: apiKey,
    },
    next: { revalidate: 21600 },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as PexelsPhotoResponse | null;
  const photo = payload?.photos?.[0];

  if (!photo?.src) {
    return null;
  }

  const imageUrl =
    photo.src.landscape ??
    photo.src.large2x ??
    photo.src.large ??
    photo.src.original ??
    photo.src.medium ??
    null;

  if (!imageUrl) {
    return null;
  }

  return {
    imageUrl,
    source: "pexels" as const,
    photographerName: photo.photographer ?? null,
    photographerUrl: photo.photographer_url ?? null,
    providerName: "Pexels",
    providerUrl: "https://www.pexels.com",
    photoPageUrl: photo.url ?? null,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}

export async function GET(request: NextRequest) {
  const icao = sanitizeChunk(request.nextUrl.searchParams.get("icao"));
  const airportName = sanitizeChunk(request.nextUrl.searchParams.get("airportName"));
  const city = sanitizeChunk(request.nextUrl.searchParams.get("city"));
  const country = sanitizeChunk(request.nextUrl.searchParams.get("country"));

  if (!icao) {
    return jsonResponse({ error: "Falta ICAO." }, 400);
  }

  const localImageUrl = await findLocalAirportImage(icao);

  if (localImageUrl) {
    return jsonResponse({
      imageUrl: localImageUrl,
      source: "local",
      providerName: "Patagonia Wings",
      providerUrl: null,
      photographerName: null,
      photographerUrl: null,
      photoPageUrl: null,
    });
  }

  const pexelsApiKey = process.env.PEXELS_API_KEY?.trim();

  if (!pexelsApiKey) {
    return jsonResponse({ error: "No existe imagen local ni PEXELS_API_KEY." }, 404);
  }

  const queries = buildSearchQueries({ airportName, city, country });

  for (const query of queries) {
    try {
      const result = await searchPexelsPhoto(query, pexelsApiKey);
      if (result) {
        return jsonResponse(result);
      }
    } catch {
      // continue with next query
    }
  }

  return jsonResponse({ error: "No se encontró imagen para este aeropuerto." }, 404);
}
