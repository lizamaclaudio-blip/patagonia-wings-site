create table if not exists public.acars_sessions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  pilot_id uuid null,
  pilot_callsign text null,
  session_status text not null default 'in_progress',
  simulator_type text null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.acars_telemetry_points (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  session_id uuid null,
  captured_at_utc timestamptz not null,
  phase text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.acars_flight_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  session_id uuid null,
  event_code text not null,
  phase text null,
  severity text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.aircraft_damage_events (
  id uuid primary key default gen_random_uuid(),
  aircraft_id uuid null,
  reservation_id uuid not null,
  event_code text not null,
  phase text null,
  severity text null,
  details jsonb not null default '{}'::jsonb,
  captured_at_utc timestamptz not null default now()
);

create table if not exists public.flight_reservation_audit (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  audit_type text not null,
  actor_type text not null,
  actor_id text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.flight_reservations
  add column if not exists scoring_status text,
  add column if not exists scoring_applied_at timestamptz,
  add column if not exists score_payload jsonb default '{}'::jsonb;
