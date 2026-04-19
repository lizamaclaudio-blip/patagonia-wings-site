import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function assertServerEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
}

export function createSupabaseServerClient(accessToken?: string): SupabaseClient {
  assertServerEnv();

  return createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

export async function getUserFromAccessToken(accessToken: string): Promise<User> {
  if (!accessToken.trim()) {
    throw new Error("Falta el bearer token de Supabase.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error(error?.message ?? "No se pudo validar la sesión de Supabase.");
  }

  return data.user;
}
