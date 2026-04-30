import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabaseServiceRoleKey } from "@/lib/supabase/server";

type RouteSuggestionRow = {
  id: string;
  route_text: string;
  source: string | null;
  flight_level: string | null;
  aircraft_type: string | null;
  aircraft_registration: string | null;
  aircraft_display_name: string | null;
  aircraft_category: string | null;
  usage_count: number | null;
  created_at?: string | null;
  last_used_at?: string | null;
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
      aircraftCategory?: string | null;
    };

    const origin = normalize(body.origin);
    const destination = normalize(body.destination);
    const flightLevel = normalize(body.flightLevel || null);
    const aircraftType = normalize(body.aircraftType || null);
    const aircraftCategory = normalize(body.aircraftCategory || null);

    if (!origin || !destination) {
      return NextResponse.json({ error: "origin y destination son obligatorios." }, { status: 400 });
    }

    const canWriteLearning = hasSupabaseServiceRoleKey();
    const supabase = canWriteLearning ? createSupabaseAdminClient() : createSupabaseServerClient();
    const strategies: Array<{
      flightLevel: string | null;
      aircraftType: string | null;
      aircraftCategory: string | null;
    }> = [
      { flightLevel: flightLevel || null, aircraftType: aircraftType || null, aircraftCategory: null },
      { flightLevel: null, aircraftType: aircraftType || null, aircraftCategory: null },
      { flightLevel: flightLevel || null, aircraftType: null, aircraftCategory: aircraftCategory || null },
      { flightLevel: flightLevel || null, aircraftType: null, aircraftCategory: null },
      { flightLevel: null, aircraftType: null, aircraftCategory: null },
    ];

    let selected: RouteSuggestionRow | null = null;

    for (const strategy of strategies) {
      let query = supabase
        .from("dispatch_route_suggestions")
        .select("id, route_text, source, flight_level, aircraft_type, aircraft_registration, aircraft_display_name, aircraft_category, usage_count, created_at, last_used_at")
        .eq("is_active", true)
        .ilike("origin_icao", origin)
        .ilike("destination_icao", destination)
        .order("usage_count", { ascending: false })
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1);

      query = strategy.flightLevel ? query.ilike("flight_level", strategy.flightLevel) : query;
      query = strategy.aircraftType ? query.ilike("aircraft_type", strategy.aircraftType) : query;
      query = strategy.aircraftCategory ? query.ilike("aircraft_category", strategy.aircraftCategory) : query;

      const { data } = await query.maybeSingle<RouteSuggestionRow>();
      if (data) {
        selected = data;
        break;
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

    if (canWriteLearning) {
      const nowIso = new Date().toISOString();
      void supabase
        .from("dispatch_route_suggestions")
        .update({
          usage_count: Math.max(0, selected.usage_count ?? 0) + 1,
          last_used_at: nowIso,
        })
        .eq("id", selected.id);
    } else {
      console.warn("[route-finder] route learning usage update skipped: missing service role");
    }

    return NextResponse.json({
      route: cleaned || null,
      source: selected.source ?? "internal",
      flightLevel: selected.flight_level ?? flightLevel ?? null,
      usageCount: selected.usage_count ?? 0,
      aircraftType: selected.aircraft_type ?? null,
      aircraftRegistration: selected.aircraft_registration ?? null,
      aircraftDisplayName: selected.aircraft_display_name ?? null,
      aircraftCategory: selected.aircraft_category ?? null,
      lastUsedAt: selected.last_used_at ?? null,
      learningSaved: canWriteLearning,
      learningReason: canWriteLearning ? null : "learning_skipped_missing_admin_key",
    });
  } catch (error) {
    console.error("[route-finder] failed:", error);
    return NextResponse.json(
      {
        error: "No se pudo buscar ruta interna.",
      },
      { status: 500 }
    );
  }
}
