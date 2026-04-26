import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AirportRow = {
  ident: string;
  name: string | null;
  municipality: string | null;
  iso_country: string | null;
  type: string | null;
  latitude_deg: number | null;
  longitude_deg: number | null;
};

export type LiveTransferOption = {
  type: "ground" | "flight_domestic" | "flight_regional" | "flight_international";
  icao: string;
  name: string;
  city: string;
  country: string;
  distanceKm: number | null;
  priceUsd: number;
  durationLabel: string;
};

export type TransferOptionsPayload = {
  origin: { icao: string; name: string; continent: string };
  ground: LiveTransferOption[];
  flights: LiveTransferOption[];
  international: LiveTransferOption[];
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function groundPriceUsd(km: number): number {
  return Math.min(Math.max(10, Math.round(10 + km * 0.06)), 180);
}

function flightPriceUsd(km: number): number {
  if (km < 500) return Math.max(45, Math.round(35 + km * 0.13));
  if (km < 2000) return Math.max(110, Math.round(70 + km * 0.09));
  return Math.max(200, Math.round(100 + km * 0.08));
}

function detectContinent(lat: number, lon: number): string {
  if (lat >= -56 && lat <= 13 && lon >= -82 && lon <= -34) return "SA";
  if (lat >= 15 && lat <= 84 && lon >= -170 && lon <= -50) return "NA";
  if (lat >= 34 && lat <= 72 && lon >= -25 && lon <= 50) return "EU";
  if (lat >= -35 && lat <= 38 && lon >= -18 && lon <= 55) return "AF";
  if (lat >= -10 && lat <= 55 && lon >= 25 && lon <= 150) return "AS";
  if (lat >= -50 && lat <= 20 && lon >= 110 && lon <= 180) return "OC";
  return "SA"; // default para Patagonia Wings
}

const INTERNATIONAL_HUBS: Record<
  string,
  Array<{ icao: string; name: string; city: string; country: string; priceUsd: number; duration: string }>
> = {
  NA: [
    { icao: "KMIA", name: "Miami International", city: "Miami", country: "Estados Unidos", priceUsd: 420, duration: "8h – 11h" },
    { icao: "KJFK", name: "John F. Kennedy Intl", city: "Nueva York", country: "Estados Unidos", priceUsd: 520, duration: "10h – 13h" },
    { icao: "KLAX", name: "Los Angeles Intl", city: "Los Ángeles", country: "Estados Unidos", priceUsd: 580, duration: "12h – 15h" },
  ],
  EU: [
    { icao: "LEMD", name: "Adolfo Suárez Madrid-Barajas", city: "Madrid", country: "España", priceUsd: 680, duration: "12h – 15h" },
    { icao: "EGLL", name: "Heathrow Airport", city: "Londres", country: "Reino Unido", priceUsd: 760, duration: "14h – 17h" },
    { icao: "LFPG", name: "Charles de Gaulle", city: "París", country: "Francia", priceUsd: 730, duration: "13h – 16h" },
  ],
  AS: [
    { icao: "OMDB", name: "Dubai International", city: "Dubái", country: "Emiratos Árabes", priceUsd: 940, duration: "17h – 21h" },
    { icao: "WSSS", name: "Changi Airport", city: "Singapur", country: "Singapur", priceUsd: 1080, duration: "20h – 24h" },
    { icao: "RJTT", name: "Tokyo Haneda", city: "Tokio", country: "Japón", priceUsd: 1150, duration: "21h – 26h" },
  ],
  AF: [
    { icao: "FAOR", name: "O.R. Tambo International", city: "Johannesburgo", country: "Sudáfrica", priceUsd: 800, duration: "14h – 18h" },
    { icao: "HECA", name: "Cairo International", city: "El Cairo", country: "Egipto", priceUsd: 860, duration: "16h – 20h" },
    { icao: "DNMM", name: "Murtala Muhammed Intl", city: "Lagos", country: "Nigeria", priceUsd: 920, duration: "15h – 19h" },
  ],
  OC: [
    { icao: "YSSY", name: "Sydney Kingsford Smith", city: "Sídney", country: "Australia", priceUsd: 1020, duration: "18h – 22h" },
    { icao: "NZAA", name: "Auckland Airport", city: "Auckland", country: "Nueva Zelanda", priceUsd: 1060, duration: "16h – 20h" },
    { icao: "YMML", name: "Melbourne Airport", city: "Melbourne", country: "Australia", priceUsd: 1000, duration: "17h – 21h" },
  ],
  SA: [
    { icao: "SBGR", name: "Guarulhos International", city: "São Paulo", country: "Brasil", priceUsd: 280, duration: "3h – 5h" },
    { icao: "SAEZ", name: "Ministro Pistarini", city: "Buenos Aires", country: "Argentina", priceUsd: 160, duration: "1h 30m – 2h 30m" },
    { icao: "SKBO", name: "El Dorado International", city: "Bogotá", country: "Colombia", priceUsd: 340, duration: "5h – 7h" },
  ],
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest) {
  const icao = request.nextUrl.searchParams.get("icao")?.trim().toUpperCase();
  if (!icao) return json({ error: "Falta ICAO." }, 400);

  const supabase = createSupabaseServerClient();

  const { data: originData } = await supabase
    .from("airports")
    .select("ident, name, municipality, iso_country, type, latitude_deg, longitude_deg")
    .eq("ident", icao)
    .maybeSingle();

  const origin = originData as AirportRow | null;
  const lat = origin?.latitude_deg ?? null;
  const lon = origin?.longitude_deg ?? null;

  if (lat === null || lon === null) {
    return json({ error: "Aeropuerto no encontrado o sin coordenadas." }, 404);
  }

  const continent = detectContinent(lat, lon);

  // Buscar aeropuertos cercanos dentro de un bounding box de ~1 400 km
  const latD = 12;
  const lonD = 16;

  const { data: nearbyData } = await supabase
    .from("airports")
    .select("ident, name, municipality, iso_country, type, latitude_deg, longitude_deg")
    .neq("ident", icao)
    .in("type", ["large_airport", "medium_airport", "small_airport"])
    .gte("latitude_deg", lat - latD)
    .lte("latitude_deg", lat + latD)
    .gte("longitude_deg", lon - lonD)
    .lte("longitude_deg", lon + lonD)
    .not("latitude_deg", "is", null)
    .not("longitude_deg", "is", null)
    .limit(300);

  const nearby = ((nearbyData ?? []) as AirportRow[])
    .map((ap) => ({
      ...ap,
      distanceKm: haversineKm(lat, lon, ap.latitude_deg!, ap.longitude_deg!),
    }))
    .filter((ap) => ap.distanceKm > 8)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // Terrestre: 3 más cercanos dentro de 250 km
  const ground: LiveTransferOption[] = nearby
    .filter((ap) => ap.distanceKm <= 250)
    .slice(0, 3)
    .map((ap) => ({
      type: "ground",
      icao: ap.ident,
      name: ap.name ?? ap.municipality ?? ap.ident,
      city: ap.municipality ?? "",
      country: ap.iso_country ?? "",
      distanceKm: Math.round(ap.distanceKm),
      priceUsd: groundPriceUsd(ap.distanceKm),
      durationLabel: `${Math.max(1, Math.round(ap.distanceKm / 75))}h aprox`,
    }));

  // Vuelos domésticos/regionales: entre 80 y 2 500 km, solo medium/large
  const flights: LiveTransferOption[] = nearby
    .filter(
      (ap) =>
        ap.distanceKm >= 80 &&
        ap.distanceKm <= 2500 &&
        ["large_airport", "medium_airport"].includes(ap.type ?? ""),
    )
    .slice(0, 3)
    .map((ap) => ({
      type: ap.distanceKm <= 1000 ? "flight_domestic" : "flight_regional",
      icao: ap.ident,
      name: ap.name ?? ap.municipality ?? ap.ident,
      city: ap.municipality ?? "",
      country: ap.iso_country ?? "",
      distanceKm: Math.round(ap.distanceKm),
      priceUsd: flightPriceUsd(ap.distanceKm),
      durationLabel: `${(Math.round(((ap.distanceKm / 820) + 1.2) * 10) / 10)}h`,
    }));

  // Internacionales: destinos en otros continentes
  const targetContinents = continent === "SA"
    ? ["NA", "EU", "AS"]
    : ["SA", "NA", "EU"].filter((c) => c !== continent).slice(0, 3);

  const international: LiveTransferOption[] = targetContinents.flatMap((c) =>
    (INTERNATIONAL_HUBS[c] ?? []).slice(0, 1).map((hub) => ({
      type: "flight_international" as const,
      icao: hub.icao,
      name: hub.name,
      city: hub.city,
      country: hub.country,
      distanceKm: null,
      priceUsd: hub.priceUsd,
      durationLabel: hub.duration,
    })),
  );

  return json({
    origin: { icao, name: origin?.name ?? icao, continent },
    ground,
    flights,
    international,
  } satisfies TransferOptionsPayload);
}
