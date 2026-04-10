import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/browser";

export type PilotProfileRecord = {
  id: string;
  airline_id?: string | null;
  email: string;
  callsign: string;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  base_hub: string | null;
  current_airport_icao?: string | null;
  current_airport_code?: string | null;
  simulator: string | null;
  rank_code?: string | null;
  career_rank_code?: string | null;
  simbrief_username: string | null;
  vatsim_id: string | null;
  ivao_id: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
};

function buildFallbackCallsign(user: User) {
  const metadataCallsign =
    typeof user.user_metadata?.callsign === "string"
      ? user.user_metadata.callsign.trim().toUpperCase()
      : "";

  return metadataCallsign || "PWG---";
}

function isOfficialPwgCallsign(value?: string | null) {
  return typeof value === "string" && /^PWG\d+$/.test(value.trim().toUpperCase());
}

function normalizeProfileRecord(
  user: Pick<User, "id" | "email" | "user_metadata">,
  data?: Partial<PilotProfileRecord> | null
): PilotProfileRecord {
  const metadata = user.user_metadata ?? {};
  const baseHub = (data?.base_hub ??
    (metadata.base_hub as string | undefined) ??
    "SCEL") as string;

  return {
    id: data?.id ?? user.id,
    airline_id: data?.airline_id ?? null,
    email: data?.email ?? user.email ?? "",
    callsign: data?.callsign ?? buildFallbackCallsign(user as User),
    first_name:
      data?.first_name ??
      ((metadata.first_name as string | undefined) ?? null),
    last_name:
      data?.last_name ??
      ((metadata.last_name as string | undefined) ?? null),
    country:
      data?.country ?? ((metadata.country as string | undefined) ?? "Chile"),
    base_hub: baseHub,
    current_airport_icao: data?.current_airport_icao ?? data?.current_airport_code ?? baseHub,
    current_airport_code: data?.current_airport_code ?? data?.current_airport_icao ?? baseHub,
    simulator:
      data?.simulator ??
      ((metadata.simulator as string | undefined) ?? "MSFS 2020"),
    simbrief_username:
      data?.simbrief_username ??
      ((metadata.simbrief_username as string | undefined) ?? null),
    vatsim_id:
      data?.vatsim_id ?? ((metadata.vatsim_id as string | undefined) ?? null),
    ivao_id:
      data?.ivao_id ?? ((metadata.ivao_id as string | undefined) ?? null),
    status: data?.status ?? "active",
    created_at: data?.created_at,
    updated_at: data?.updated_at,
  };
}

async function fetchPilotProfile(userId: string) {
  const { data, error } = await supabase
    .from("pilot_profiles")
    .select("*")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error obteniendo pilot_profiles:", error.message);
    return null;
  }

  return (data ?? null) as PilotProfileRecord | null;
}

async function getPatagoniaAirlineId() {
  const { data, error } = await supabase
    .from("airlines")
    .select("id")
    .eq("code", "PWG")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("No se pudo resolver airline_id PWG:", error.message);
    return null;
  }

  return data?.id ?? null;
}

async function getNextPwgCallsign() {
  const { data, error } = await supabase.rpc("generate_next_pwg_callsign");

  if (error) {
    console.error("No se pudo generar el próximo callsign PWG:", error.message);
    return null;
  }

  return typeof data === "string" ? data : null;
}

async function repairPilotProfileIfNeeded(
  user: User,
  profile: PilotProfileRecord
): Promise<PilotProfileRecord> {
  const metadata = user.user_metadata ?? {};
  const patch: Partial<PilotProfileRecord> = {};

  if (!profile.airline_id) {
    const airlineId = await getPatagoniaAirlineId();
    if (airlineId) {
      patch.airline_id = airlineId;
    }
  }

  if (!isOfficialPwgCallsign(profile.callsign)) {
    const nextCallsign = await getNextPwgCallsign();
    if (nextCallsign) {
      patch.callsign = nextCallsign;
    }
  }

  if (!profile.base_hub) {
    patch.base_hub = ((metadata.base_hub as string | undefined) ?? "SCEL").toUpperCase();
  }

  if (!profile.current_airport_icao) {
    patch.current_airport_icao = (patch.base_hub ?? profile.base_hub ?? "SCEL").toUpperCase();
  }

  if (Object.keys(patch).length === 0) {
    return normalizeProfileRecord(user, profile);
  }

  const { data, error } = await supabase
    .from("pilot_profiles")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("No se pudo reparar pilot_profiles:", error.message);
    return normalizeProfileRecord(user, { ...profile, ...patch });
  }

  return normalizeProfileRecord(user, data ?? { ...profile, ...patch });
}

export async function ensurePilotProfile(
  user: User
): Promise<PilotProfileRecord | null> {
  const existing = await fetchPilotProfile(user.id);

  if (existing) {
    return repairPilotProfileIfNeeded(user, existing);
  }

  const metadata = user.user_metadata ?? {};
  const airlineId = await getPatagoniaAirlineId();
  const callsign = (await getNextPwgCallsign()) ?? buildFallbackCallsign(user);
  const baseHub = ((metadata.base_hub as string | undefined) ?? "SCEL").toUpperCase();

  const payload = {
    id: user.id,
    airline_id: airlineId,
    email: user.email ?? "",
    callsign,
    first_name: (metadata.first_name as string | undefined) ?? null,
    last_name: (metadata.last_name as string | undefined) ?? null,
    country: (metadata.country as string | undefined) ?? "Chile",
    base_hub: baseHub,
    current_airport_icao: baseHub,
    simulator: (metadata.simulator as string | undefined) ?? "MSFS 2020",
    simbrief_username:
      (metadata.simbrief_username as string | undefined) ?? null,
    vatsim_id: (metadata.vatsim_id as string | undefined) ?? null,
    ivao_id: (metadata.ivao_id as string | undefined) ?? null,
    status: "active",
  };

  const { data, error } = await supabase
    .from("pilot_profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Error asegurando pilot_profiles:", error.message);
    return normalizeProfileRecord(user, payload);
  }

  return normalizeProfileRecord(user, data ?? payload);
}

export async function getPilotProfile(userId: string) {
  return await fetchPilotProfile(userId);
}

export async function updatePilotProfile(
  userId: string,
  updates: Partial<PilotProfileRecord>
) {
  const safeUpdates: Partial<PilotProfileRecord> = {
    first_name:
      typeof updates.first_name === "string"
        ? updates.first_name.trim() || null
        : undefined,
    last_name:
      typeof updates.last_name === "string"
        ? updates.last_name.trim() || null
        : undefined,
    country:
      typeof updates.country === "string"
        ? updates.country.trim() || "Chile"
        : undefined,
    simulator:
      typeof updates.simulator === "string"
        ? updates.simulator.trim() || "MSFS 2020"
        : undefined,
    simbrief_username:
      typeof updates.simbrief_username === "string"
        ? updates.simbrief_username.trim() || null
        : updates.simbrief_username ?? undefined,
    vatsim_id:
      typeof updates.vatsim_id === "string"
        ? updates.vatsim_id.trim() || null
        : updates.vatsim_id ?? undefined,
    ivao_id:
      typeof updates.ivao_id === "string"
        ? updates.ivao_id.trim() || null
        : updates.ivao_id ?? undefined,
    updated_at: new Date().toISOString(),
  };

  Object.keys(safeUpdates).forEach((key) => {
    if (typeof safeUpdates[key as keyof PilotProfileRecord] === "undefined") {
      delete safeUpdates[key as keyof PilotProfileRecord];
    }
  });

  const { data, error } = await supabase
    .from("pilot_profiles")
    .update(safeUpdates)
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as PilotProfileRecord;
  }

  const refreshed = await fetchPilotProfile(userId);

  if (refreshed) {
    return refreshed;
  }

  return {
    id: userId,
    airline_id: null,
    email: "",
    callsign: "PWG---",
    first_name:
      typeof safeUpdates.first_name === "string" ? safeUpdates.first_name : null,
    last_name:
      typeof safeUpdates.last_name === "string" ? safeUpdates.last_name : null,
    country:
      typeof safeUpdates.country === "string" ? safeUpdates.country : "Chile",
    base_hub: "SCEL",
    current_airport_icao: "SCEL",
    simulator:
      typeof safeUpdates.simulator === "string"
        ? safeUpdates.simulator
        : "MSFS 2020",
    simbrief_username:
      typeof safeUpdates.simbrief_username === "string"
        ? safeUpdates.simbrief_username
        : null,
    vatsim_id:
      typeof safeUpdates.vatsim_id === "string" ? safeUpdates.vatsim_id : null,
    ivao_id:
      typeof safeUpdates.ivao_id === "string" ? safeUpdates.ivao_id : null,
    status: "active",
    updated_at:
      typeof safeUpdates.updated_at === "string"
        ? safeUpdates.updated_at
        : new Date().toISOString(),
  } as PilotProfileRecord;
}