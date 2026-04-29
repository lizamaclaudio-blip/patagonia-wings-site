import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RouteSuggestionRow = {
  id: string;
  route_text: string;
  source: string | null;
  flight_level: string | null;
  usage_count: number | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function cleanRoute(route: string, origin: string, destination: string) {
  const tokens = route
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((token) => !/^[KN]\d{4}F\d{3}$/i.test(token))
    .filter((token) => token !== "PWG")
    .filter((token) => token !== origin && token !== destination)
    .filter((token) => !/^\d{1,6}$/.test(token));
  return tokens.join(" ").trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      origin?: string;
      destination?: string;
      flightLevel?: string | null;
      aircraftType?: string | null;
      aircraftRegistration?: string | null;
    };

    const origin = normalize(body.origin);
    const destination = normalize(body.destination);
    const flightLevel = normalize(body.flightLevel || null);
    const aircraftType = normalize(body.aircraftType || null);

    if (!origin || !destination) {
      return NextResponse.json({ error: "origin y destination son obligatorios." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const candidates = [flightLevel || null, null];
    const aircraftCandidates = [aircraftType || null, null];

    let selected: RouteSuggestionRow | null = null;

    for (const fl of candidates) {
      for (const at of aircraftCandidates) {
        let query = supabase
          .from("dispatch_route_suggestions")
          .select("id, route_text, source, flight_level, usage_count")
          .eq("is_active", true)
          .ilike("origin_icao", origin)
          .ilike("destination_icao", destination)
          .order("updated_at", { ascending: false })
          .limit(1);

        query = fl ? query.ilike("flight_level", fl) : query.is("flight_level", null);
        query = at ? query.ilike("aircraft_type", at) : query.is("aircraft_type", null);

        const { data } = await query.maybeSingle<RouteSuggestionRow>();
        if (data) {
          selected = data;
          break;
        }
      }
      if (selected) break;
    }

    if (!selected) {
      return NextResponse.json({
        route: null,
        source: "not_found",
        flightLevel: flightLevel || null,
      });
    }

    const cleaned = cleanRoute(selected.route_text, origin, destination);

    const nowIso = new Date().toISOString();
    void supabase
      .from("dispatch_route_suggestions")
      .update({
        usage_count: Math.max(0, selected.usage_count ?? 0) + 1,
        last_used_at: nowIso,
      })
      .eq("id", selected.id);

    return NextResponse.json({
      route: cleaned || null,
      source: selected.source ?? "internal",
      flightLevel: selected.flight_level ?? flightLevel ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo buscar ruta interna.",
      },
      { status: 500 }
    );
  }
}
