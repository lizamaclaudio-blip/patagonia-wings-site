import { NextRequest, NextResponse } from "next/server";

type AviationWeatherMetarRow = {
  rawOb?: string | null;
  raw_text?: string | null;
  raw?: string | null;
  obsTime?: string | null;
  observationTime?: string | null;
  reportTime?: string | null;
};

function normalizeIds(value: string | null) {
  const normalized = (value ?? "")
    .toUpperCase()
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => /^[A-Z0-9]{4}$/.test(item))
    .slice(0, 5);

  return normalized;
}

export async function GET(request: NextRequest) {
  const ids = normalizeIds(request.nextUrl.searchParams.get("ids"));

  if (!ids.length) {
    return NextResponse.json(
      {
        error: "Debes indicar al menos un ICAO válido en ids.",
      },
      { status: 400 },
    );
  }

  const url = new URL("https://aviationweather.gov/api/data/metar");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "PatagoniaWingsWeb/1.0 (+dashboard central metar)",
      },
      cache: "no-store",
      next: { revalidate: 900 },
    });

    if (response.status === 204) {
      return NextResponse.json(
        {
          ok: true,
          metar: null,
        },
        { status: 200 },
      );
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "No se pudo consultar el METAR oficial.",
        },
        { status: response.status || 502 },
      );
    }

    const first = Array.isArray(payload)
      ? (payload[0] as AviationWeatherMetarRow | undefined)
      : null;

    return NextResponse.json(
      {
        ok: true,
        metar: {
          raw: first?.rawOb ?? first?.raw_text ?? first?.raw ?? null,
          observed:
            first?.obsTime ?? first?.observationTime ?? first?.reportTime ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar el METAR.",
      },
      { status: 500 },
    );
  }
}
