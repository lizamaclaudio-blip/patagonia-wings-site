import { NextResponse } from "next/server";
import {
  NAVIGRAPH_COOKIE_ACCESS,
  NAVIGRAPH_COOKIE_EXPIRES_AT,
  NAVIGRAPH_COOKIE_NEXT,
  NAVIGRAPH_COOKIE_REFRESH,
  NAVIGRAPH_COOKIE_STATE,
  NAVIGRAPH_COOKIE_VERIFIER,
} from "@/lib/navigraph-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.delete(NAVIGRAPH_COOKIE_ACCESS);
  response.cookies.delete(NAVIGRAPH_COOKIE_REFRESH);
  response.cookies.delete(NAVIGRAPH_COOKIE_EXPIRES_AT);
  response.cookies.delete(NAVIGRAPH_COOKIE_STATE);
  response.cookies.delete(NAVIGRAPH_COOKIE_VERIFIER);
  response.cookies.delete(NAVIGRAPH_COOKIE_NEXT);

  return response;
}