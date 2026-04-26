import { NextRequest, NextResponse } from "next/server";

type AviationWeatherMetarRow = {
  icaoId?: string | null;
  stationId?: string | null;
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
    .slice(0, 8);

  return normalized;
}

function getMetarRaw(row?: AviationWeatherMetarRow | null) {
  return row?.rawOb ?? row?.raw_text ?? row?.raw ?? null;
}

function getMetarStation(row?: AviationWeatherMetarRow | null) {
  const explicit = (row?.icaoId ?? row?.stationId ?? "").trim().toUpperCase();
  if (explicit) {
    return explicit;
  }

  const raw = getMetarRaw(row)?.trim().toUpperCase() ?? "";
  const firstToken = raw.split(/\s+/)[0] ?? "";
  return /^[A-Z0-9]{4}$/.test(firstToken) ? firstToken : null;
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

    const rows = Array.isArray(payload) ? (payload as AviationWeatherMetarRow[]) : [];
    const firstWithRaw =
      ids
        .map((id) => rows.find((row) => getMetarStation(row) === id && Boolean(getMetarRaw(row))))
        .find(Boolean) ?? rows.find((row) => Boolean(getMetarRaw(row))) ?? null;

    return NextResponse.json(
      {
        ok: true,
        metar: firstWithRaw
          ? {
              raw: getMetarRaw(firstWithRaw),
              observed:
                firstWithRaw.obsTime ??
                firstWithRaw.observationTime ??
                firstWithRaw.reportTime ??
                null,
              station: getMetarStation(firstWithRaw),
              requestedIds: ids,
            }
          : null,
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
