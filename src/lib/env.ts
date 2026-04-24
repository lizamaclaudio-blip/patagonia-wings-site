const requiredClientEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const requiredServerEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function splitCsv(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function assertValue(name: string, value?: string) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const env = {
  supabaseUrl: assertValue(
    "NEXT_PUBLIC_SUPABASE_URL",
    requiredClientEnv.supabaseUrl
  ),
  supabaseAnonKey: assertValue(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    requiredClientEnv.supabaseAnonKey
  ),
  supabaseServiceRoleKey: assertValue(
    "SUPABASE_SERVICE_ROLE_KEY",
    requiredServerEnv.supabaseServiceRoleKey
  ),
  airlineId: process.env.NEXT_PUBLIC_AIRLINE_ID ?? null,
  ownerEmails: splitCsv(process.env.CONTROL_CENTER_OWNER_EMAILS),
  adminEmails: splitCsv(process.env.CONTROL_CENTER_ADMIN_EMAILS),
  staffEmails: splitCsv(process.env.CONTROL_CENTER_STAFF_EMAILS),
  siteUrl: process.env.CONTROL_CENTER_SITE_URL ?? "http://localhost:3002",
};
