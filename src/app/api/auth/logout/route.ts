import { NextResponse } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });

  return response;
}
