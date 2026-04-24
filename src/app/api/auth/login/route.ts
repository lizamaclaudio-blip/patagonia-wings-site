import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/session";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export async function POST(request: NextRequest) {
  const secure = process.env.NODE_ENV === "production";
  const { email, password } = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json(
      { error: "Debes ingresar email y contraseña." },
      { status: 400 }
    );
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session?.access_token || !data.session.refresh_token) {
    return NextResponse.json(
      { error: error?.message ?? "Credenciales inválidas." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(ACCESS_COOKIE, data.session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: data.session.expires_in,
  });

  response.cookies.set(REFRESH_COOKIE, data.session.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
