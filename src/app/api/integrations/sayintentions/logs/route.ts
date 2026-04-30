import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getUserFromAccessToken } from "@/lib/supabase/server";

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("Falta Authorization Bearer.");
  }
  return authorization.slice(7).trim();
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    const user = await getUserFromAccessToken(accessToken);
    const reservationId = request.nextUrl.searchParams.get("reservationId");
    const supabase = createSupabaseServerClient(accessToken);

    let query = supabase
      .from("sayintentions_sync_log")
      .select("id,reservation_id,pilot_id,sync_type,status,source,error_message,created_at,response_payload")
      .eq("pilot_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (reservationId) {
      query = query.eq("reservation_id", reservationId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, logs: data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "No se pudo cargar logs." }, { status: 500 });
  }
}
