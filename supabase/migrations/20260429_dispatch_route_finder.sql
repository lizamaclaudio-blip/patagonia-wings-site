-- Bloque: Route Finder Interno (pre-SimBrief)
-- Objetivo: crear catálogo interno de rutas sugeridas para despacho web
-- Tipo: estructura + policies (sin cambios contables)

create extension if not exists pgcrypto;

create table if not exists public.dispatch_route_suggestions (
  id uuid primary key default gen_random_uuid(),
  origin_icao text not null,
  destination_icao text not null,
  flight_level text null,
  aircraft_type text null,
  route_text text not null,
  source text not null default 'internal',
  is_active boolean not null default true,
  usage_count integer not null default 0,
  last_used_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_dispatch_route_suggestions_lookup
  on public.dispatch_route_suggestions (origin_icao, destination_icao, flight_level, aircraft_type)
  where is_active = true;

create unique index if not exists uq_dispatch_route_suggestions_active
  on public.dispatch_route_suggestions (
    upper(origin_icao),
    upper(destination_icao),
    coalesce(upper(flight_level), ''),
    coalesce(upper(aircraft_type), ''),
    upper(route_text)
  );

create or replace function public.set_dispatch_route_suggestions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_dispatch_route_suggestions_updated_at on public.dispatch_route_suggestions;
create trigger trg_dispatch_route_suggestions_updated_at
before update on public.dispatch_route_suggestions
for each row
execute function public.set_dispatch_route_suggestions_updated_at();

alter table public.dispatch_route_suggestions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dispatch_route_suggestions'
      and policyname = 'dispatch_route_suggestions_read_authenticated'
  ) then
    create policy dispatch_route_suggestions_read_authenticated
      on public.dispatch_route_suggestions
      for select
      to authenticated
      using (is_active = true);
  end if;
end $$;
