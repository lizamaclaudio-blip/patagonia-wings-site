create table if not exists public.pilot_sayintentions_settings (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  use_local_flight_json boolean not null default true,
  enable_va_import boolean not null default true,
  enable_acars_messages boolean not null default false,
  enable_comms_history boolean not null default true,
  enable_weather_sync boolean not null default true,
  enable_frequency_read boolean not null default true,
  callsign_override text,
  api_key_encrypted text,
  api_key_storage_mode text not null default 'local_acars',
  last_detected_callsign text,
  last_detected_origin text,
  last_detected_destination text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_id),
  constraint pilot_sayintentions_settings_api_key_storage_mode_check
    check (api_key_storage_mode in ('local_acars','encrypted_server','flight_json'))
);

create table if not exists public.sayintentions_sync_log (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid,
  pilot_id uuid,
  sync_type text not null,
  status text not null default 'pending',
  source text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sayintentions_sync_log_reservation
  on public.sayintentions_sync_log (reservation_id, created_at desc);

create index if not exists idx_sayintentions_sync_log_pilot
  on public.sayintentions_sync_log (pilot_id, created_at desc);

alter table public.pilot_sayintentions_settings enable row level security;
alter table public.sayintentions_sync_log enable row level security;

drop policy if exists pilot_sayintentions_settings_select_own on public.pilot_sayintentions_settings;
create policy pilot_sayintentions_settings_select_own
on public.pilot_sayintentions_settings
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists pilot_sayintentions_settings_upsert_own on public.pilot_sayintentions_settings;
create policy pilot_sayintentions_settings_upsert_own
on public.pilot_sayintentions_settings
for all
to authenticated
using (pilot_id = auth.uid())
with check (pilot_id = auth.uid());

drop policy if exists sayintentions_sync_log_select_own on public.sayintentions_sync_log;
create policy sayintentions_sync_log_select_own
on public.sayintentions_sync_log
for select
to authenticated
using (pilot_id = auth.uid());
