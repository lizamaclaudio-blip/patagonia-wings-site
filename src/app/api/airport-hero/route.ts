import { access } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
const PEXELS_REVALIDATE_SECONDS = 60 * 60 * 6;

function sanitizeChunk(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeSearchText(value: string | null | undefined) {
  return sanitizeChunk(value)
    .replace(/\bAirport\b/gi, "")
    .replace(/\bInternational\b/gi, "")
    .replace(/\bIntl\b/gi, "")
    .replace(/\bAeropuerto\b/gi, "")
    .replace(/\bAerodromo\b/gi, "")
    .replace(/\bAeródromo\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findLocalAirportImage(icao: string) {
  const normalizedUpper = sanitizeChunk(icao).toUpperCase();
  const normalizedLower = normalizedUpper.toLowerCase();
  const publicAirportsDir = path.join(process.cwd(), "public", "airports");

  for (const extension of IMAGE_EXTENSIONS) {
    for (const filename of [`${normalizedUpper}.${extension}`, `${normalizedLower}.${extension}`]) {
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
  icao,
  airportName,
  city,
  country,
}: {
  icao: string;
  airportName: string;
  city: string;
  country: string;
}) {
  const cleanedIcao = sanitizeChunk(icao).toUpperCase();
  const cleanedAirport = normalizeSearchText(airportName);
  const cleanedCity = normalizeSearchText(city);
  const cleanedCountry = normalizeSearchText(country);

  return Array.from(
    new Set(
      [
        [cleanedIcao, "airport runway"].filter(Boolean).join(" "),
        [cleanedIcao, "airport terminal"].filter(Boolean).join(" "),
        [cleanedAirport, cleanedCity, cleanedCountry, "airport runway"].filter(Boolean).join(" "),
        [cleanedAirport, cleanedCity, cleanedCountry, "airport terminal"].filter(Boolean).join(" "),
        [cleanedAirport, cleanedCity, cleanedCountry, "airport aerial"].filter(Boolean).join(" "),
        [cleanedCity, cleanedCountry, "airport runway"].filter(Boolean).join(" "),
        [cleanedCity, cleanedCountry, "airport terminal"].filter(Boolean).join(" "),
        [cleanedCity, cleanedCountry, "airfield runway"].filter(Boolean).join(" "),
      ]
        .map((item) => item.trim())
        .filter((item) => item.length >= 7),
    ),
  );
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
    next: { revalidate: PEXELS_REVALIDATE_SECONDS },
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
    query,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function GET(request: NextRequest) {
  const icao = sanitizeChunk(request.nextUrl.searchParams.get("icao"));
  const airportName = sanitizeChunk(request.nextUrl.searchParams.get("airportName"));
  const city = sanitizeChunk(request.nextUrl.searchParams.get("city"));
  const country = sanitizeChunk(request.nextUrl.searchParams.get("country"));
  const prefer = sanitizeChunk(request.nextUrl.searchParams.get("prefer")).toLowerCase();

  if (!icao) {
    return jsonResponse({ error: "Falta ICAO." }, 400);
  }

  const pexelsApiKey = process.env.PEXELS_API_KEY?.trim();
  const shouldPreferPexels = prefer === "pexels" || prefer === "dynamic";

  if (pexelsApiKey && shouldPreferPexels) {
    const queries = buildSearchQueries({ icao, airportName, city, country });

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

  if (pexelsApiKey && !shouldPreferPexels) {
    const queries = buildSearchQueries({ icao, airportName, city, country });

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
  }

  return jsonResponse(
    {
      error: pexelsApiKey
        ? "No se encontró imagen dinámica ni local para este aeropuerto."
        : "No existe imagen local y falta PEXELS_API_KEY.",
      source: "fallback",
    },
    404,
  );
}
