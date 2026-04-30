import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabaseServiceRoleKey } from "@/lib/supabase/server";

export type SayIntentionsSettingsInput = {
  enabled?: boolean;
  use_local_flight_json?: boolean;
  enable_va_import?: boolean;
  enable_acars_messages?: boolean;
  enable_comms_history?: boolean;
  enable_weather_sync?: boolean;
  enable_frequency_read?: boolean;
  callsign_override?: string | null;
  api_key_storage_mode?: "local_acars" | "encrypted_server" | "flight_json";
};

export const DEFAULT_SAYINTENTIONS_SETTINGS: Required<SayIntentionsSettingsInput> = {
  enabled: false,
  use_local_flight_json: true,
  enable_va_import: true,
  enable_acars_messages: false,
  enable_comms_history: true,
  enable_weather_sync: true,
  enable_frequency_read: true,
  callsign_override: "",
  api_key_storage_mode: "local_acars",
};

export function getSayIntentionsServerConfig() {
  return {
    enabled: String(process.env.SAYINTENTIONS_ENABLED ?? "false").toLowerCase() === "true",
    vaApiKeyPresent: Boolean(process.env.SAYINTENTIONS_VA_API_KEY?.trim()),
    baseUrl: process.env.SAYINTENTIONS_SAPI_BASE_URL?.trim() || "https://apipri.sayintentions.ai/sapi",
  };
}

export async function getSayIntentionsSettings(accessToken: string, pilotId: string) {
  const supabase = createSupabaseServerClient(accessToken);
  const { data, error } = await supabase
    .from("pilot_sayintentions_settings")
    .select("*")
    .eq("pilot_id", pilotId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? {
        ...DEFAULT_SAYINTENTIONS_SETTINGS,
        ...data,
      }
    : {
        ...DEFAULT_SAYINTENTIONS_SETTINGS,
        pilot_id: pilotId,
      };
}

export async function upsertSayIntentionsSettings(accessToken: string, pilotId: string, input: SayIntentionsSettingsInput) {
  const supabase = createSupabaseServerClient(accessToken);
  const payload = {
    pilot_id: pilotId,
    enabled: Boolean(input.enabled),
    use_local_flight_json: input.use_local_flight_json ?? true,
    enable_va_import: input.enable_va_import ?? true,
    enable_acars_messages: input.enable_acars_messages ?? false,
    enable_comms_history: input.enable_comms_history ?? true,
    enable_weather_sync: input.enable_weather_sync ?? true,
    enable_frequency_read: input.enable_frequency_read ?? true,
    callsign_override: input.callsign_override?.trim() || null,
    api_key_storage_mode: input.api_key_storage_mode ?? "local_acars",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("pilot_sayintentions_settings")
    .upsert(payload, { onConflict: "pilot_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function writeSayIntentionsLog(entry: Record<string, unknown>) {
  if (!hasSupabaseServiceRoleKey()) {
    console.warn("sayintentions log skipped: missing service role");
    return { success: false, reason: "missing_service_role" as const };
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("sayintentions_sync_log").insert(entry);
  if (error) {
    console.warn("sayintentions log insert failed:", error.message);
    return { success: false, reason: "insert_failed" as const };
  }
  return { success: true as const };
}
