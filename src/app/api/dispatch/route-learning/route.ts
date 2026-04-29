import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function cleanRoute(route: string, origin: string, destination: string, flightNumber?: string | null) {
  const cleanFn = normalize(flightNumber);
  const tokens = route
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((token) => !/^[KN]\d{4}F\d{3}$/i.test(token))
    .filter((token) => token !== "PWG")
    .filter((token) => token !== origin && token !== destination)
    .filter((token) => token !== cleanFn)
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
      aircraftDisplayName?: string | null;
      aircraftCategory?: string | null;
      routeText?: string | null;
      source?: string | null;
      flightNumber?: string | null;
      metadata?: Record<string, unknown> | null;
    };

    const origin = normalize(body.origin);
    const destination = normalize(body.destination);
    const flightLevel = normalize(body.flightLevel || null) || null;
    const aircraftType = normalize(body.aircraftType || null) || null;
    const aircraftRegistration = normalize(body.aircraftRegistration || null) || null;
    const aircraftDisplayName = (body.aircraftDisplayName ?? "").trim() || null;
    const aircraftCategory = normalize(body.aircraftCategory || null) || null;
    const source = (body.source ?? "internal").trim().toLowerCase();
    const routeText = cleanRoute(body.routeText ?? "", origin, destination, body.flightNumber);

    if (!origin || !destination || !routeText) {
      return NextResponse.json({ ok: false, error: "origin, destination y routeText limpio son obligatorios." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    let existingQuery = supabase
      .from("dispatch_route_suggestions")
      .select("id, usage_count")
      .ilike("origin_icao", origin)
      .ilike("destination_icao", destination)
      .ilike("route_text", routeText)
      .eq("is_active", true)
      .eq("aircraft_type", aircraftType)
      .order("updated_at", { ascending: false })
      .limit(1);

    existingQuery = flightLevel
      ? existingQuery.ilike("flight_level", flightLevel)
      : existingQuery.is("flight_level", null);

    const { data: existing } = await existingQuery.maybeSingle<{ id: string; usage_count: number | null }>();

    const nowIso = new Date().toISOString();
    const payload = {
      origin_icao: origin,
      destination_icao: destination,
      flight_level: flightLevel,
      aircraft_type: aircraftType,
      aircraft_registration: aircraftRegistration,
      aircraft_display_name: aircraftDisplayName,
      aircraft_category: aircraftCategory,
      route_text: routeText,
      source,
      is_active: true,
      last_used_at: nowIso,
      metadata: body.metadata ?? {},
    };

    if (existing?.id) {
      await supabase
        .from("dispatch_route_suggestions")
        .update({
          ...payload,
          usage_count: Math.max(0, existing.usage_count ?? 0) + 1,
        })
        .eq("id", existing.id);
      return NextResponse.json({ ok: true, mode: "updated", route: routeText });
    }

    await supabase
      .from("dispatch_route_suggestions")
      .insert({
        ...payload,
        usage_count: 1,
      });

    return NextResponse.json({ ok: true, mode: "inserted", route: routeText });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar aprendizaje de ruta." },
      { status: 500 }
    );
  }
}
