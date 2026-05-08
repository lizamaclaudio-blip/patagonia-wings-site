import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getUserFromAccessToken,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RpcExecutionMode = "public_admin" | "authenticated_user";

type RpcRule = {
  mode: RpcExecutionMode;
};

const RPC_ALLOWLIST: Record<string, RpcRule> = {
  // Public read-only site data. Runs server-side so the function no longer needs to be called from browser.
  pw_get_public_site_metrics: { mode: "public_admin" },
  pw_get_public_fleet_showcase: { mode: "public_admin" },

  // Authenticated operational RPCs. C20A keeps the user JWT execution context to avoid breaking functions
  // that depend on auth.uid()/auth.jwt(). C20B can migrate each function to service-role APIs one by one.
  create_flight_reservation: { mode: "authenticated_user" },
  generate_next_pwg_callsign: { mode: "authenticated_user" },
  get_available_aircraft_for_pilot: { mode: "authenticated_user" },
  get_available_itineraries_for_pilot: { mode: "authenticated_user" },
  pw_cancel_active_reservation: { mode: "authenticated_user" },
  pw_create_charter_reservation_v2: { mode: "authenticated_user" },
  pw_create_dispatch_package_v2: { mode: "authenticated_user" },
  pw_get_available_aircraft_display: { mode: "authenticated_user" },
  pw_get_pilot_career_office: { mode: "authenticated_user" },
  pw_get_active_reservation_for_pilot: { mode: "authenticated_user" },
  pw_get_visible_routes_for_pilot: { mode: "authenticated_user" },
  pw_list_charter_aircraft: { mode: "authenticated_user" },
  pw_list_dispatch_aircraft: { mode: "authenticated_user" },
  pw_list_dispatch_itineraries: { mode: "authenticated_user" },
  pw_refresh_pilot_aircraft_training: { mode: "authenticated_user" },
  pw_request_aircraft_checkride: { mode: "authenticated_user" },
  pw_request_promotion_checkride: { mode: "authenticated_user" },
  pw_search_airports_for_dispatch: { mode: "authenticated_user" },
  pw_start_aircraft_training: { mode: "authenticated_user" },
};

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function safeRpcArgs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { functionName?: unknown; args?: unknown }
      | null;

    const functionName = typeof body?.functionName === "string" ? body.functionName.trim() : "";
    const rule = RPC_ALLOWLIST[functionName];

    if (!functionName || !rule) {
      return NextResponse.json(
        { error: { message: "RPC_NOT_ALLOWED" } },
        { status: 403 },
      );
    }

    const args = safeRpcArgs(body?.args);

    if (rule.mode === "public_admin") {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase.rpc(functionName, args);

      if (error) {
        return NextResponse.json(
          { error: { message: error.message, code: error.code, details: error.details } },
          { status: 400 },
        );
      }

      return NextResponse.json({ data });
    }

    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: { message: "AUTH_REQUIRED" } },
        { status: 401 },
      );
    }

    await getUserFromAccessToken(accessToken);

    // C20A intentionally preserves user execution context for RPCs that still rely on auth.uid().
    // This removes direct browser RPC calls and centralizes the allowlist without changing behavior.
    const supabase = createSupabaseServerClient(accessToken);
    const { data, error } = await supabase.rpc(functionName, args);

    if (error) {
      return NextResponse.json(
        { error: { message: error.message, code: error.code, details: error.details } },
        { status: 400 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : "SECURE_RPC_SERVER_ERROR",
        },
      },
      { status: 500 },
    );
  }
}
