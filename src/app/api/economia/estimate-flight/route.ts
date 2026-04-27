import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { estimateFlightEconomy } from "@/lib/pilot-economy";

export const dynamic = "force-dynamic";

type AirportPoint = {
  ident: string | null;
  latitude_deg: number | string | null;
  longitude_deg: number | string | null;
  iso_country?: string | null;
  municipality?: string | null;
  name?: string | null;
};

function normalizeIcao(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function haversineNm(a: AirportPoint, b: AirportPoint) {
  const lat1 = toNumber(a.latitude_deg);
  const lon1 = toNumber(a.longitude_deg);
  const lat2 = toNumber(b.latitude_deg);
  const lon2 = toNumber(b.longitude_deg);
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const radiusNm = 3440.065;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(radiusNm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = normalizeIcao(searchParams.get("origin"));
    const destination = normalizeIcao(searchParams.get("destination"));
    const aircraftType = (searchParams.get("aircraftType") ?? "A320").trim().toUpperCase();
    const operationType = (searchParams.get("operationType") ?? "CAREER").trim().toUpperCase();
    const operationCategory = (searchParams.get("operationCategory") ?? "").trim().toLowerCase();

    if (origin.length !== 4 || destination.length !== 4 || origin === destination) {
      return NextResponse.json({ ok: false, error: "Debes indicar origen y destino ICAO válidos y diferentes." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("airports")
      .select("ident, latitude_deg, longitude_deg, iso_country, municipality, name")
      .in("ident", [origin, destination]);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const airports = (data ?? []) as AirportPoint[];
    const originAirport = airports.find((airport) => airport.ident === origin) ?? null;
    const destinationAirport = airports.find((airport) => airport.ident === destination) ?? null;
    const distanceNm = originAirport && destinationAirport ? haversineNm(originAirport, destinationAirport) : null;

    if (!distanceNm || distanceNm <= 0) {
      return NextResponse.json({ ok: false, error: "No se pudo calcular distancia para esos aeropuertos." }, { status: 404 });
    }

    const estimate = estimateFlightEconomy({
      distanceNm,
      aircraftTypeCode: aircraftType,
      operationType,
      originIcao: origin,
      destinationIcao: destination,
      originCountry: originAirport?.iso_country ?? null,
      destinationCountry: destinationAirport?.iso_country ?? null,
      originCity: originAirport?.municipality ?? originAirport?.name ?? null,
      destinationCity: destinationAirport?.municipality ?? destinationAirport?.name ?? null,
      economySource: "estimate",
      operationCategory,
    });

    return NextResponse.json({
      ok: true,
      origin,
      destination,
      aircraftType,
      operationType,
      ...estimate,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error al estimar economía." }, { status: 500 });
  }
}
