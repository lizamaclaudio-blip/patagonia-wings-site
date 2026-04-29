-- Bloque: Route Learning PWG con aeronave
-- Objetivo: extender dispatch_route_suggestions para aprendizaje por aeronave/uso real
-- Tipo: estructura (sin cambios contables)

alter table if exists public.dispatch_route_suggestions
  add column if not exists aircraft_registration text null,
  add column if not exists aircraft_display_name text null,
  add column if not exists aircraft_category text null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_dispatch_route_suggestions_priority
  on public.dispatch_route_suggestions (
    origin_icao,
    destination_icao,
    aircraft_type,
    aircraft_category,
    flight_level,
    usage_count desc,
    last_used_at desc
  )
  where is_active = true;
