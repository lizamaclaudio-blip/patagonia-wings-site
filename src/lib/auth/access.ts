import "server-only";

import { redirect } from "next/navigation";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";

export type AdminRole = "owner" | "admin" | "staff";

export type AdminContext = {
  user: {
    id: string;
    email: string;
  };
  role: AdminRole;
  profile: Record<string, unknown> | null;
  pilotAccount: Record<string, unknown> | null;
};

function includesEmail(list: string[], email?: string | null) {
  return Boolean(email && list.includes(email.trim().toLowerCase()));
}

function truthyInt(value: unknown) {
  return value === 1 || value === true;
}

export async function resolveAdminContext(): Promise<AdminContext | null> {
  const user = await getSessionUser();

  if (!user) {
    return null;
  }

  const admin = createAdminSupabaseClient();

  const { data: profile } = await admin
    .from("pilot_profiles")
    .select("*")
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email}`)
    .limit(1)
    .maybeSingle();

  const callsign =
    typeof profile?.callsign === "string" ? profile.callsign : null;

  const { data: pilotAccount } = callsign
    ? await admin
        .from("pilot_accounts")
        .select("*")
        .eq("callsign", callsign)
        .limit(1)
        .maybeSingle()
    : { data: null };

  let role: AdminRole | null = null;

  if (includesEmail(env.ownerEmails, user.email)) {
    role = "owner";
  } else if (
    truthyInt(pilotAccount?.is_system_master) ||
    includesEmail(env.adminEmails, user.email)
  ) {
    role = "admin";
  } else if (includesEmail(env.staffEmails, user.email)) {
    role = "staff";
  }

  if (!role) {
    return null;
  }

  if (
    pilotAccount &&
    Object.prototype.hasOwnProperty.call(pilotAccount, "access_enabled") &&
    !truthyInt(pilotAccount.access_enabled) &&
    role !== "owner"
  ) {
    return null;
  }

  return {
    user,
    role,
    profile: (profile ?? null) as Record<string, unknown> | null,
    pilotAccount: (pilotAccount ?? null) as Record<string, unknown> | null,
  };
}

export async function requireAdminContext() {
  const context = await resolveAdminContext();

  if (!context) {
    const user = await getSessionUser();
    if (!user) {
      redirect("/login");
    }

    redirect("/access-denied");
  }

  return context;
}
