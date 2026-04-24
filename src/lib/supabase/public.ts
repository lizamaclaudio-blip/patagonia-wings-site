import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export function createPublicSupabaseClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
