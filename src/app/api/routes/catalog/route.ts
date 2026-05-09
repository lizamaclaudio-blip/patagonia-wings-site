import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    const [catalogRes, networkRoutesRes, networkAircraftRes] = await Promise.all([
      supabase
        .from("pw_v_route_catalog_v2")
        .select(
          "route_id, flight_number, simbrief_flight_number, route_key, origin_ident, destination_ident, origin_country, destination_country, route_name, route_category, service_type, operation_type, distance_nm, block_minutes, expected_block_p50, expected_block_p80, compatible_aircraft_types, aircraft_options, is_active",
        )
        .order("route_category", { ascending: true })
        .order("flight_number", { ascending: true }),
      supabase
        .from("network_routes")
        .select("id, route_code, origin_ident, destination_ident, route_group, service_profile, service_level, distance_nm, is_active, notes, flight_number, flight_designator, route_pair_key")
        .order("flight_designator", { ascending: true }),
      supabase
        .from("network_route_aircraft")
        .select("route_id, aircraft_type_code"),
    ]);

    return NextResponse.json(
      {
        ok: !(catalogRes.error && networkRoutesRes.error),
        catalogRows: catalogRes.data ?? [],
        networkRoutesRows: networkRoutesRes.data ?? [],
        networkAircraftRows: networkAircraftRes.data ?? [],
        errors: {
          catalog: catalogRes.error?.message ?? null,
          networkRoutes: networkRoutesRes.error?.message ?? null,
          networkAircraft: networkAircraftRes.error?.message ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo cargar cat\u00e1logo de rutas.",
      },
      { status: 500 },
    );
  }
}

