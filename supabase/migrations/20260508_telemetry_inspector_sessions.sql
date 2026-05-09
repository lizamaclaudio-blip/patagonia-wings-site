-- 20260508_telemetry_inspector_sessions.sql
-- Idempotent schema for ACARS Data Lab traces

create table if not exists public.acars_telemetry_inspector_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pilot_callsign text null,
  reservation_id uuid null,
  aircraft_title text null,
  detected_profile_code text null,
  aircraft_type_code text null,
  addon_source text null,
  profile_status text null,
  detection_confidence text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  csv_row_count integer not null default 0,
  app_version text null,
  notes text null
);

create index if not exists idx_acars_ti_created_at on public.acars_telemetry_inspector_sessions(created_at desc);
create index if not exists idx_acars_ti_profile on public.acars_telemetry_inspector_sessions(detected_profile_code);

alter table public.acars_telemetry_inspector_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='acars_telemetry_inspector_sessions' and policyname='ti_owner_select'
  ) then
    create policy ti_owner_select on public.acars_telemetry_inspector_sessions
      for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- Rollback
-- drop table if exists public.acars_telemetry_inspector_sessions;
