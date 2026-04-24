import "server-only";

import { cookies } from "next/headers";

import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const ACCESS_COOKIE = "pwg_cc_access_token";
export const REFRESH_COOKIE = "pwg_cc_refresh_token";

export type AuthSessionUser = {
  id: string;
  email: string;
};

export async function getSessionUser(): Promise<AuthSessionUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user?.email) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}
