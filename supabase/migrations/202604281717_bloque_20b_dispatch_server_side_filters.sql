-- Patagonia Wings - Bloque 20B
-- Server-side dispatch filters for aircraft, charter, rank permissions and range.
--
-- Audit source used before writing this migration:
-- - PostgREST OpenAPI exposed RPC signatures:
--   - pw_list_dispatch_aircraft(p_origin_icao text)
--   - pw_list_charter_aircraft(p_origin_icao text)
--   - pw_list_dispatch_itineraries(p_origin_icao text)
-- - Existing exposed columns:
--   - pilot_profiles: id, callsign, auth_user_id, rank_code, career_rank_code,
--     current_airport_icao, current_airport_code, base_hub,
--     active_qualifications, active_certifications
--   - aircraft: id, registration, aircraft_type_code, aircraft_model_code,
--     aircraft_variant_code, addon_provider, variant_name,
--     aircraft_display_name, current_airport_code, status, is_active
--   - aircraft_models: code, display_name, display_category, category, is_active
--   - aircraft_economy_profiles: aircraft_type, category, seats, cargo_kg,
--     practical_range_nm, international_capable, long_haul_capable
--   - network_routes: id, route_code, origin_ident, destination_ident,
--     route_group, service_profile, service_level, priority, distance_nm, is_active
--   - network_route_aircraft: route_id, aircraft_type_code
--   - pilot_rank_aircraft_permissions: rank_code, aircraft_type_code
--   - pw_pilot_rank_aircraft_families: rank_code, family_code, is_active
--   - pw_aircraft_family_variants: family_code, aircraft_type_code, is_active
--
-- Notes:
-- - This migration is intentionally non-destructive for data.
-- - It uses CREATE OR REPLACE FUNCTION and CREATE INDEX IF NOT EXISTS.
-- - Charter range filtering is added as a complementary route-aware RPC because
--   the legacy pw_list_charter_aircraft signature only receives origin.
-- - PostgreSQL cannot change RETURNS TABLE with CREATE OR REPLACE, so the three
--   public RPC wrappers are dropped/recreated by signature. This does not delete data.

begin;

drop function if exists public.pw_list_dispatch_aircraft(text);
drop function if exists public.pw_list_charter_aircraft(text);
drop function if exists public.pw_list_dispatch_itineraries(text);

create index if not exists idx_aircraft_dispatch_origin_status
  on public.aircraft (current_airport_code, status, is_active);

create index if not exists idx_network_routes_origin_active
  on public.network_routes (origin_ident, is_active);

create index if not exists idx_network_route_aircraft_route_type
  on public.network_route_aircraft (route_id, aircraft_type_code);

create index if not exists idx_aircraft_economy_profiles_type
  on public.aircraft_economy_profiles (aircraft_type);

create index if not exists idx_pilot_rank_aircraft_permissions_rank
  on public.pilot_rank_aircraft_permissions (rank_code, aircraft_type_code);

create or replace function public.pw_20b_norm_code(p_value text)
returns text
language sql
immutable
as $$
  select nullif(upper(trim(coalesce(p_value, ''))), '');
$$;

create or replace function public.pw_20b_base_aircraft_code(p_value text)
returns text
language sql
immutable
as $$
  select nullif(split_part(upper(trim(coalesce(p_value, ''))), '_', 1), '');
$$;

create or replace function public.pw_20b_type_matches(p_left text, p_right text)
returns boolean
language sql
immutable
as $$
  select
    public.pw_20b_norm_code(p_left) = public.pw_20b_norm_code(p_right)
    or public.pw_20b_base_aircraft_code(p_left) = public.pw_20b_base_aircraft_code(p_right);
$$;

create or replace function public.pw_20b_current_pilot_profile()
returns table (
  pilot_id uuid,
  callsign text,
  rank_code text,
  current_airport text,
  active_qualifications text,
  active_certifications text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.callsign,
    coalesce(nullif(p.career_rank_code, ''), nullif(p.rank_code, ''), 'CADET') as rank_code,
    coalesce(nullif(p.current_airport_icao, ''), nullif(p.current_airport_code, ''), nullif(p.base_hub, ''), 'SCEL') as current_airport,
    p.active_qualifications::text,
    p.active_certifications::text
  from public.pilot_profiles p
  where p.auth_user_id = auth.uid()
     or p.id = auth.uid()
  order by p.updated_at desc nulls last, p.created_at desc nulls last
  limit 1;
$$;

create or replace function public.pw_20b_permitted_aircraft_types(p_rank_code text)
returns table (aircraft_type_code text)
language sql
stable
security definer
set search_path = public
as $$
  with raw_permissions as (
    select public.pw_20b_norm_code(p.aircraft_type_code) as code
    from public.pilot_rank_aircraft_permissions p
    where public.pw_20b_norm_code(p.rank_code) = public.pw_20b_norm_code(p_rank_code)

    union

    select public.pw_20b_norm_code(v.aircraft_type_code) as code
    from public.pw_v_rank_allowed_variants v
    where public.pw_20b_norm_code(v.rank_code) = public.pw_20b_norm_code(p_rank_code)

    union

    select public.pw_20b_norm_code(av.aircraft_type_code) as code
    from public.pw_pilot_rank_aircraft_families f
    join public.pw_aircraft_family_variants av
      on public.pw_20b_norm_code(av.family_code) = public.pw_20b_norm_code(f.family_code)
     and coalesce(av.is_active, true)
    where public.pw_20b_norm_code(f.rank_code) = public.pw_20b_norm_code(p_rank_code)
      and coalesce(f.is_active, true)
  ),
  expanded as (
    select code from raw_permissions where code is not null
    union
    select public.pw_20b_base_aircraft_code(code) from raw_permissions where code is not null
  )
  select distinct code
  from expanded
  where code is not null;
$$;

create or replace function public.pw_20b_aircraft_allowed_for_rank(
  p_rank_code text,
  p_aircraft_type_code text,
  p_aircraft_model_code text default null,
  p_aircraft_variant_code text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pw_20b_permitted_aircraft_types(p_rank_code) perm
    where public.pw_20b_type_matches(perm.aircraft_type_code, p_aircraft_type_code)
       or public.pw_20b_type_matches(perm.aircraft_type_code, p_aircraft_model_code)
       or public.pw_20b_type_matches(perm.aircraft_type_code, p_aircraft_variant_code)
  );
$$;

create or replace function public.pw_20b_airport_distance_nm(p_origin text, p_destination text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when o.latitude_deg is null or o.longitude_deg is null
        or d.latitude_deg is null or d.longitude_deg is null
      then null
      else round((
        3440.065 * acos(
          least(1, greatest(-1,
            sin(radians(o.latitude_deg)) * sin(radians(d.latitude_deg)) +
            cos(radians(o.latitude_deg)) * cos(radians(d.latitude_deg)) *
            cos(radians(d.longitude_deg - o.longitude_deg))
          ))
        )
      )::numeric, 1)
    end
  from public.airports o
  join public.airports d
    on public.pw_20b_norm_code(d.ident) = public.pw_20b_norm_code(p_destination)
    or public.pw_20b_norm_code(d.icao_code) = public.pw_20b_norm_code(p_destination)
    or public.pw_20b_norm_code(d.gps_code) = public.pw_20b_norm_code(p_destination)
  where public.pw_20b_norm_code(o.ident) = public.pw_20b_norm_code(p_origin)
     or public.pw_20b_norm_code(o.icao_code) = public.pw_20b_norm_code(p_origin)
     or public.pw_20b_norm_code(o.gps_code) = public.pw_20b_norm_code(p_origin)
  limit 1;
$$;

create or replace function public.pw_list_dispatch_aircraft(p_origin_icao text)
returns table (
  aircraft_id text,
  registration text,
  tail_number text,
  aircraft_type_code text,
  aircraft_model_code text,
  aircraft_variant_code text,
  addon_provider text,
  variant_name text,
  display_name text,
  aircraft_name text,
  current_airport_code text,
  current_airport_icao text,
  status text,
  display_status text,
  selectable boolean,
  display_category text,
  server_rank_filtered boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with pilot as (
    select * from public.pw_20b_current_pilot_profile()
  )
  select
    a.id::text as aircraft_id,
    a.registration,
    a.registration as tail_number,
    public.pw_20b_norm_code(coalesce(a.aircraft_type_code, a.aircraft_model_code)) as aircraft_type_code,
    public.pw_20b_norm_code(a.aircraft_model_code) as aircraft_model_code,
    public.pw_20b_norm_code(a.aircraft_variant_code) as aircraft_variant_code,
    a.addon_provider,
    a.variant_name,
    coalesce(a.aircraft_display_name, m.display_name, a.aircraft_model_code, a.aircraft_type_code) as display_name,
    coalesce(a.aircraft_display_name, m.display_name, a.aircraft_model_code, a.aircraft_type_code) as aircraft_name,
    a.current_airport_code,
    a.current_airport_code as current_airport_icao,
    a.status,
    case when lower(coalesce(a.status, '')) = 'available' then 'Disponible' else 'No disponible' end as display_status,
    (lower(coalesce(a.status, '')) = 'available' and coalesce(a.is_active, true)) as selectable,
    coalesce(m.display_category, m.category, ep.category, 'Operacion general') as display_category,
    true as server_rank_filtered
  from pilot p
  join public.aircraft a
    on public.pw_20b_norm_code(a.current_airport_code) = public.pw_20b_norm_code(p_origin_icao)
  left join public.aircraft_models m
    on public.pw_20b_type_matches(m.code, coalesce(a.aircraft_model_code, a.aircraft_type_code))
  left join public.aircraft_economy_profiles ep
    on public.pw_20b_type_matches(ep.aircraft_type, coalesce(a.aircraft_type_code, a.aircraft_model_code))
  where public.pw_20b_norm_code(p.current_airport) = public.pw_20b_norm_code(p_origin_icao)
    and coalesce(a.is_active, true)
    and lower(coalesce(a.status, '')) = 'available'
    and public.pw_20b_aircraft_allowed_for_rank(
      p.rank_code,
      a.aircraft_type_code,
      a.aircraft_model_code,
      a.aircraft_variant_code
    )
  order by a.aircraft_model_code nulls last, a.addon_provider nulls last, a.registration;
$$;

create or replace function public.pw_list_charter_aircraft(p_origin_icao text)
returns table (
  aircraft_id text,
  registration text,
  tail_number text,
  aircraft_type_code text,
  aircraft_model_code text,
  aircraft_variant_code text,
  addon_provider text,
  variant_name text,
  display_name text,
  aircraft_name text,
  current_airport_code text,
  current_airport_icao text,
  status text,
  display_status text,
  selectable boolean,
  display_category text,
  license_status text,
  license_granted_at text,
  server_rank_filtered boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.aircraft_id,
    d.registration,
    d.tail_number,
    d.aircraft_type_code,
    d.aircraft_model_code,
    d.aircraft_variant_code,
    d.addon_provider,
    d.variant_name,
    d.display_name,
    d.aircraft_name,
    d.current_airport_code,
    d.current_airport_icao,
    d.status,
    d.display_status,
    d.selectable,
    d.display_category,
    null::text as license_status,
    null::text as license_granted_at,
    true as server_rank_filtered
  from public.pw_list_dispatch_aircraft(p_origin_icao) d;
$$;

create or replace function public.pw_list_charter_aircraft_for_route(
  p_origin_icao text,
  p_destination_icao text
)
returns table (
  aircraft_id text,
  registration text,
  tail_number text,
  aircraft_type_code text,
  aircraft_model_code text,
  aircraft_variant_code text,
  addon_provider text,
  variant_name text,
  display_name text,
  aircraft_name text,
  current_airport_code text,
  current_airport_icao text,
  status text,
  display_status text,
  selectable boolean,
  display_category text,
  license_status text,
  license_granted_at text,
  distance_nm numeric,
  practical_range_nm numeric,
  aircraft_compatible boolean,
  compatibility_reason text,
  server_rank_filtered boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with route_distance as (
    select public.pw_20b_airport_distance_nm(p_origin_icao, p_destination_icao) as distance_nm
  )
  select
    c.aircraft_id,
    c.registration,
    c.tail_number,
    c.aircraft_type_code,
    c.aircraft_model_code,
    c.aircraft_variant_code,
    c.addon_provider,
    c.variant_name,
    c.display_name,
    c.aircraft_name,
    c.current_airport_code,
    c.current_airport_icao,
    c.status,
    c.display_status,
    c.selectable,
    c.display_category,
    c.license_status,
    c.license_granted_at,
    rd.distance_nm,
    ep.practical_range_nm,
    (
      rd.distance_nm is not null
      and ep.practical_range_nm is not null
      and rd.distance_nm <= ep.practical_range_nm * 0.85
    ) as aircraft_compatible,
    case
      when rd.distance_nm is null then 'No se pudo calcular distancia por coordenadas de aeropuertos.'
      when ep.practical_range_nm is null then 'Perfil de autonomia no disponible para esta aeronave.'
      when rd.distance_nm <= ep.practical_range_nm * 0.85 then 'Compatible con autonomia operacional.'
      else 'Ruta supera autonomia operacional con reserva del 15%.'
    end as compatibility_reason,
    true as server_rank_filtered
  from public.pw_list_charter_aircraft(p_origin_icao) c
  cross join route_distance rd
  left join public.aircraft_economy_profiles ep
    on public.pw_20b_type_matches(ep.aircraft_type, c.aircraft_type_code)
  where rd.distance_nm is not null
    and ep.practical_range_nm is not null
    and rd.distance_nm <= ep.practical_range_nm * 0.85
  order by c.aircraft_model_code nulls last, c.registration;
$$;

create or replace function public.pw_list_dispatch_itineraries(p_origin_icao text)
returns table (
  route_id text,
  id text,
  route_code text,
  route_key text,
  flight_number text,
  flight_designator text,
  origin_ident text,
  origin_icao text,
  destination_ident text,
  destination_icao text,
  route_name text,
  route_category text,
  route_group text,
  service_profile text,
  service_level text,
  distance_nm numeric,
  block_minutes numeric,
  compatible_aircraft_types text[],
  available_aircraft_count integer,
  server_rank_filtered boolean,
  source text
)
language sql
stable
security definer
set search_path = public
as $$
  with pilot as (
    select * from public.pw_20b_current_pilot_profile()
  ),
  permitted as (
    select aircraft_type_code from public.pw_20b_permitted_aircraft_types((select rank_code from pilot))
  ),
  available_origin_types as (
    select distinct
      public.pw_20b_norm_code(coalesce(a.aircraft_type_code, a.aircraft_model_code)) as aircraft_type_code
    from pilot p
    join public.aircraft a
      on public.pw_20b_norm_code(a.current_airport_code) = public.pw_20b_norm_code(p_origin_icao)
    where public.pw_20b_norm_code(p.current_airport) = public.pw_20b_norm_code(p_origin_icao)
      and coalesce(a.is_active, true)
      and lower(coalesce(a.status, '')) = 'available'
      and public.pw_20b_aircraft_allowed_for_rank(
        p.rank_code,
        a.aircraft_type_code,
        a.aircraft_model_code,
        a.aircraft_variant_code
      )
  ),
  active_routes as (
    select r.*
    from pilot p
    join public.network_routes r
      on public.pw_20b_norm_code(r.origin_ident) = public.pw_20b_norm_code(p_origin_icao)
    where public.pw_20b_norm_code(p.current_airport) = public.pw_20b_norm_code(p_origin_icao)
      and coalesce(r.is_active, true)
      and r.distance_nm is not null
      and r.distance_nm > 0
  ),
  route_declared_types as (
    select
      r.id as route_id,
      public.pw_20b_norm_code(nra.aircraft_type_code) as aircraft_type_code
    from active_routes r
    join public.network_route_aircraft nra
      on nra.route_id = r.id
  ),
  route_candidate_types as (
    select route_id, aircraft_type_code from route_declared_types

    union

    select r.id as route_id, aot.aircraft_type_code
    from active_routes r
    cross join available_origin_types aot
    where not exists (
      select 1 from route_declared_types rdt where rdt.route_id = r.id
    )
  ),
  eligible_route_types as (
    select
      r.id as route_id,
      r.route_code,
      r.origin_ident,
      r.destination_ident,
      r.route_group,
      r.service_profile,
      r.service_level,
      r.priority,
      r.distance_nm,
      r.flight_number,
      r.flight_designator,
      rct.aircraft_type_code
    from active_routes r
    join route_candidate_types rct
      on rct.route_id = r.id
    join available_origin_types aot
      on public.pw_20b_type_matches(aot.aircraft_type_code, rct.aircraft_type_code)
    join permitted p
      on public.pw_20b_type_matches(p.aircraft_type_code, rct.aircraft_type_code)
    join public.aircraft_economy_profiles ep
      on public.pw_20b_type_matches(ep.aircraft_type, rct.aircraft_type_code)
    where ep.practical_range_nm is not null
      and r.distance_nm <= ep.practical_range_nm * 0.85
  )
  select
    e.route_id::text,
    e.route_id::text as id,
    e.route_code,
    e.route_code as route_key,
    e.flight_number,
    e.flight_designator,
    e.origin_ident,
    e.origin_ident as origin_icao,
    e.destination_ident,
    e.destination_ident as destination_icao,
    concat(e.origin_ident, ' -> ', e.destination_ident) as route_name,
    case
      when lower(coalesce(e.route_group, '')) in ('continental_longhaul') then 'long_haul'
      when lower(coalesce(e.route_group, '')) in ('transoceanic') then 'intercontinental'
      when lower(coalesce(e.route_group, '')) in ('south_america_regional') then 'international'
      when lower(coalesce(e.route_group, '')) in ('domestic_chile', 'domestic_argentina', 'transborder_patagonia') then 'regional'
      when lower(coalesce(e.service_profile, '')) in ('heavy', 'longhaul') then 'long_haul'
      when lower(coalesce(e.service_profile, '')) in ('trunk') then 'national'
      when lower(coalesce(e.service_profile, '')) in ('feeder', 'regional') then 'regional'
      else null
    end as route_category,
    e.route_group,
    e.service_profile,
    e.service_level,
    e.distance_nm,
    null::numeric as block_minutes,
    array_agg(distinct e.aircraft_type_code order by e.aircraft_type_code) as compatible_aircraft_types,
    count(distinct e.aircraft_type_code)::integer as available_aircraft_count,
    true as server_rank_filtered,
    'DISPATCH_ITINERARIES_20B'::text as source
  from eligible_route_types e
  group by
    e.route_id,
    e.route_code,
    e.origin_ident,
    e.destination_ident,
    e.route_group,
    e.service_profile,
    e.service_level,
    e.distance_nm,
    e.flight_number,
    e.flight_designator,
    e.priority
  order by e.priority nulls last, e.route_code;
$$;

grant execute on function public.pw_20b_norm_code(text) to authenticated, service_role;
grant execute on function public.pw_20b_base_aircraft_code(text) to authenticated, service_role;
grant execute on function public.pw_20b_type_matches(text, text) to authenticated, service_role;
grant execute on function public.pw_20b_current_pilot_profile() to authenticated, service_role;
grant execute on function public.pw_20b_permitted_aircraft_types(text) to authenticated, service_role;
grant execute on function public.pw_20b_aircraft_allowed_for_rank(text, text, text, text) to authenticated, service_role;
grant execute on function public.pw_20b_airport_distance_nm(text, text) to authenticated, service_role;
grant execute on function public.pw_list_dispatch_aircraft(text) to authenticated, service_role;
grant execute on function public.pw_list_charter_aircraft(text) to authenticated, service_role;
grant execute on function public.pw_list_charter_aircraft_for_route(text, text) to authenticated, service_role;
grant execute on function public.pw_list_dispatch_itineraries(text) to authenticated, service_role;

commit;

-- Validation queries after applying manually in Supabase SQL editor:
--
-- 1. Low-rank pilot auth context:
--    Login as a CADET pilot at SCEL and run:
--    select aircraft_type_code, registration
--    from public.pw_list_dispatch_aircraft('SCEL');
--    Expected: no B77W/B789/A359 unless the pilot rank permissions allow them.
--
-- 2. C208 range guard:
--    select *
--    from public.pw_list_dispatch_itineraries('SCEL')
--    where destination_icao = 'KMIA'
--      and 'C208' = any(compatible_aircraft_types);
--    Expected: 0 rows.
--
-- 3. Charter route range guard:
--    select aircraft_type_code, distance_nm, practical_range_nm
--    from public.pw_list_charter_aircraft_for_route('SCEL', 'KMIA')
--    where aircraft_type_code = 'C208';
--    Expected: 0 rows.
--
-- 4. Charter by origin remains compatible with existing frontend:
--    select *
--    from public.pw_list_charter_aircraft('SCEL')
--    limit 5;
--
-- 5. Itineraries return server_rank_filtered = true:
--    select route_code, compatible_aircraft_types, available_aircraft_count, server_rank_filtered
--    from public.pw_list_dispatch_itineraries('SCEL')
--    limit 10;
